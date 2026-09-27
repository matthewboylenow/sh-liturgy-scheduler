import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { parseISO } from "date-fns";
import { db } from "@/db";
import { assignments, auditLog, liturgies, massTimes, ministries, ministryMembers, positions, presiderImports, users, type PresiderImportPayload } from "@/db/schema";
import { env } from "./env";
import { createLiturgyFromMassTime, ScheduleError } from "./schedule";

/**
 * Presiders whose initials never appear in the PDF legend. The pastor signs the
 * schedule, so the music director leaves him off the key.
 */
export const KNOWN_PRESIDERS: Record<string, string> = {
  TPN: "Fr. Tom Nydegger",
};

const Extracted = z.object({
  legend: z.array(z.object({ initials: z.string(), name: z.string() })),
  masses: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD"),
      time: z.string().describe("24-hour HH:mm, e.g. 08:00, 17:00"),
      initials: z.string().describe("Presider initials exactly as printed, upper case"),
      sunday_name: z.string().nullable().describe("The Sunday or feast printed in that day's cell, e.g. '14th Sunday in Ordinary Time', else null"),
    }),
  ),
});

const PROMPT = `This is a parish celebrant (presider) schedule laid out as a monthly calendar grid, one month per page.

Extract every Mass that has a presider assigned. A Mass is a line like "8am - NS" or "5pm - TPN" inside a day cell: the time, a dash, then the presider's initials. Read the calendar carefully so each Mass is attached to the correct date; the grid can flatten oddly when read as text, so use the visual layout.

Rules:
- Include every Mass on every day, including weekday Masses. Do not skip any.
- Output times in 24-hour HH:mm. "8am" is 08:00, "12pm" is 12:00, "5pm" is 17:00, "6pm" is 18:00.
- Initials exactly as printed, upper case, no periods.
- Lines that are not a Mass (Baptisms, Confessions, "AWAY" notes, funerals) are not included.
- The legend at the top maps initials to names. Include every legend entry.
- sunday_name: the liturgical title printed in the Sunday's cell (for example "14th Sunday in OTIME" or "18th Sun. In OTIME"). Expand "OT", "OTIME", "Ord. Time" to "Ordinary Time" and "Sun." to "Sunday". For a weekday cell use the feast printed there if any, else null.
- Use the month and year printed on each page for the dates.`;

/** Send the PDF to Claude and return the weekend Masses that fit the weekly pattern. */
export async function parsePresiderPdf(pdf: Buffer): Promise<PresiderImportPayload> {
  if (!env.anthropicKey()) throw new Error("ANTHROPIC_API_KEY is not set, so PDFs cannot be read yet.");
  const client = new Anthropic({ apiKey: env.anthropicKey() });
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(Extracted) },
  });
  const out = response.parsed_output;
  if (!out) throw new Error("Could not read a schedule out of that PDF.");
  return shapePayload(out);
}

/** Keep the Masses that match an active Mass time; everything else is reported as skipped. Exported for tests and fixtures. */
export async function shapePayload(out: z.infer<typeof Extracted>): Promise<PresiderImportPayload> {
  const pattern = await db.select().from(massTimes).where(eq(massTimes.active, true));
  const legend: Record<string, string> = { ...KNOWN_PRESIDERS };
  for (const e of out.legend) legend[e.initials.toUpperCase().replace(/\W/g, "")] = e.name.trim();

  const rows: PresiderImportPayload["rows"] = [];
  const skipped: PresiderImportPayload["skipped"] = [];
  const seen = new Set<string>();
  for (const m of out.masses) {
    const initials = m.initials.toUpperCase().replace(/\W/g, "");
    const time = normalizeTime(m.time);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date) || !time || !initials) {
      skipped.push({ date: m.date, time: m.time, initials: m.initials, reason: "unreadable" });
      continue;
    }
    const dow = parseISO(m.date).getDay();
    const mt = pattern.find((p) => p.dayOfWeek === dow && p.time === time);
    if (!mt) {
      skipped.push({ date: m.date, time, initials, reason: "not a weekend Mass time" });
      continue;
    }
    const key = `${m.date}|${time}`;
    if (seen.has(key)) {
      skipped.push({ date: m.date, time, initials, reason: "duplicate" });
      continue;
    }
    seen.add(key);
    rows.push({ date: m.date, time, initials, sundayName: m.sunday_name?.trim() || null });
  }
  rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return { legend, rows, skipped };
}

function normalizeTime(t: string): string | null {
  const m = t.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ?? "00";
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${min}`;
}

/** Split "Msgr. Tim Shugrue" into a first name that keeps the title and a last name. */
export function splitClergyName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const lastName = parts.pop()!;
  return { firstName: parts.join(" "), lastName };
}

export async function presiderMinistry() {
  const [m] = await db.select().from(ministries).where(eq(ministries.slug, "presider"));
  if (!m) throw new ScheduleError("There is no Presider ministry. Add one with the slug \"presider\" first.");
  return m;
}

/** People who can be picked as a presider: members of the Presider ministry, plus anyone with initials on file. */
export async function presiderCandidates() {
  const m = await presiderMinistry();
  const rows = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, initials: users.initials, status: users.status })
    .from(ministryMembers)
    .innerJoin(users, eq(users.id, ministryMembers.userId))
    .where(eq(ministryMembers.ministryId, m.id));
  return rows.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}

/**
 * Write a reviewed import to the schedule. `mapping` is initials -> user id, or "new" to create the
 * person named in the legend. Masses missing from the range are created as drafts; the Sunday name
 * becomes the Mass title where none is set; the presider seat is (re)assigned and marked confirmed.
 */
export async function applyPresiderImport(importId: string, mapping: Record<string, string>, actorId: string) {
  const [imp] = await db.select().from(presiderImports).where(eq(presiderImports.id, importId));
  if (!imp) throw new ScheduleError("That import no longer exists.");
  if (imp.appliedAt) throw new ScheduleError("That import was already applied.");
  const ministry = await presiderMinistry();
  const payload = imp.payload;

  // Resolve every initials to a user id, creating clergy accounts where asked.
  const userFor = new Map<string, string>();
  for (const initials of new Set(payload.rows.map((r) => r.initials))) {
    const choice = mapping[initials];
    if (!choice) throw new ScheduleError(`Pick a person for ${initials}.`);
    let userId = choice;
    if (choice === "new") {
      const name = payload.legend[initials];
      if (!name) throw new ScheduleError(`${initials} is not in the legend, so there is no name to create.`);
      const { firstName, lastName } = splitClergyName(name);
      const [u] = await db
        .insert(users)
        .values({ firstName, lastName: lastName || initials, role: "volunteer", status: "inactive", notifySms: false, notifyEmail: false, initials, notes: "Clergy. Created from a presider schedule import." })
        .returning();
      userId = u.id;
    }
    await db.insert(ministryMembers).values({ userId, ministryId: ministry.id }).onConflictDoNothing();
    // Remember the initials for next time (clear them from anyone else first).
    await db.update(users).set({ initials: null }).where(and(eq(users.initials, initials), ne(users.id, userId)));
    await db.update(users).set({ initials, updatedAt: new Date() }).where(eq(users.id, userId));
    userFor.set(initials, userId);
  }

  const pattern = await db.query.massTimes.findMany({ where: eq(massTimes.active, true), with: { templates: { with: { ministry: true } } } });
  let created = 0, assigned = 0, unchanged = 0, titled = 0;
  for (const row of payload.rows) {
    const dow = parseISO(row.date).getDay();
    const mt = pattern.find((p) => p.dayOfWeek === dow && p.time === row.time);
    if (!mt) continue; // pattern changed since upload
    let l = await db.query.liturgies.findFirst({ where: and(eq(liturgies.date, row.date), eq(liturgies.time, row.time)) });
    if (!l) {
      l = await createLiturgyFromMassTime(mt, row.date, { status: "draft", title: row.sundayName });
      created++;
    } else if (!l.title && row.sundayName) {
      await db.update(liturgies).set({ title: row.sundayName }).where(eq(liturgies.id, l.id));
      titled++;
    }
    let [pos] = await db.select().from(positions).where(and(eq(positions.liturgyId, l.id), eq(positions.ministryId, ministry.id))).orderBy(positions.sortOrder).limit(1);
    if (!pos) [pos] = await db.insert(positions).values({ liturgyId: l.id, ministryId: ministry.id, sortOrder: 0 }).returning();
    const userId = userFor.get(row.initials)!;
    const [live] = await db.select().from(assignments).where(and(eq(assignments.positionId, pos.id), ne(assignments.status, "declined"))).limit(1);
    if (live?.userId === userId) {
      unchanged++;
      continue;
    }
    if (live) await db.update(assignments).set({ status: "declined", updatedAt: new Date() }).where(eq(assignments.id, live.id));
    await db.insert(assignments).values({ positionId: pos.id, userId, status: "confirmed", assignedById: actorId });
    assigned++;
  }

  const from = payload.rows[0]?.date ?? "";
  const to = payload.rows.at(-1)?.date ?? "";
  const summary = `${assigned} presider${assigned === 1 ? "" : "s"} assigned, ${created} Mass${created === 1 ? "" : "es"} created as drafts${titled ? `, ${titled} titled` : ""}${unchanged ? `, ${unchanged} already set` : ""}.`;
  await db.update(presiderImports).set({ appliedAt: new Date(), summary }).where(eq(presiderImports.id, importId));
  await db.insert(auditLog).values({ actorId, action: "presiders.apply", subjectType: "presider_import", subjectId: importId, detail: `${from}..${to}: ${summary}` });
  return { from, to, summary, created, assigned, unchanged };
}
