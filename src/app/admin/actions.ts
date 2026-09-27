"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@/db";
import {
  users,
  ministries,
  ministryMembers,
  massTimes,
  positionTemplates,
  liturgies,
  positions,
  assignments,
  kiosks,
  auditLog,
} from "@/db/schema";
import { requireAdmin, requireStaff, createInvite, sendInvite, sha256, canManageMinistry, canManageUser, hashPassword, impersonate, stopImpersonating, getCurrentUser } from "@/lib/auth";
import { normalizeEmail, normalizePhone } from "@/lib/phone";
import { datesForWeekday, localToUtc, DAY_NAMES, fmtTime } from "@/lib/time";
import { claimPosition, changeAssignment, createLiturgyFromMassTime, syncUpcomingToPattern, ScheduleError } from "@/lib/schedule";
import { parsePresiderPdf, applyPresiderImport } from "@/lib/presiders";
import { presiderImports, blackouts } from "@/db/schema";
import { saveSettings } from "@/lib/settings";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function str(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}
function fail(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg)}`);
}
function ok(path: string, msg = "Saved."): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);
}

// ---------------- People ----------------

export async function createPerson(formData: FormData) {
  const actor = await requireStaff();
  const firstName = str(formData, "firstName");
  const lastName = str(formData, "lastName");
  const phone = normalizePhone(str(formData, "phone"));
  const email = normalizeEmail(str(formData, "email"));
  let role = actor.role === "admin" ? (str(formData, "role") as "volunteer" | "coordinator" | "admin") || "volunteer" : "volunteer";
  if (role === "admin" && !actor.isSuperAdmin) role = "coordinator";
  const tags = formData.getAll("tags").map(String).filter(Boolean);
  const ministryIds = formData.getAll("ministryIds").map(String).filter(Boolean);
  const sendNow = formData.get("sendInvite") === "on";

  if (!firstName || !lastName) fail("/admin/people", "First and last name are required.");
  if (!phone && !email) fail("/admin/people", "A mobile number or email is required.");
  if (actor.role !== "admin") {
    // coordinators may only add people to their own ministries
    if (ministryIds.some((m) => !actor.coordinatorOf.includes(m))) fail("/admin/people", "You can only add people to ministries you coordinate.");
  }

  if (phone) {
    const c = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
    if (c[0]) fail("/admin/people", "That mobile number is already on another account.");
  }
  if (email) {
    const c = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (c[0]) fail("/admin/people", "That email is already on another account.");
  }

  const [u] = await db
    .insert(users)
    .values({ firstName, lastName, phone, email, role, status: "invited", mfaRequired: role !== "volunteer", tags })
    .returning();
  if (ministryIds.length) {
    await db.insert(ministryMembers).values(ministryIds.map((ministryId) => ({ userId: u.id, ministryId })));
  }
  await db.insert(auditLog).values({ actorId: actor.id, action: "person.create", subjectType: "user", subjectId: u.id });

  if (sendNow) {
    const token = await createInvite(u.id);
    await sendInvite(u, token, `${actor.firstName} ${actor.lastName}`);
  }
  revalidatePath("/admin/people");
  ok(`/admin/people/${u.id}`, sendNow ? "Added and invited." : "Added.");
}

export async function updatePerson(formData: FormData) {
  const actor = await requireStaff();
  const id = str(formData, "id");
  const path = `/admin/people/${id}`;
  const target = await db.query.users.findFirst({ where: eq(users.id, id), with: { memberships: true } });
  if (!target) fail("/admin/people", "Person not found.");

  const firstName = str(formData, "firstName");
  const lastName = str(formData, "lastName");
  const phone = normalizePhone(str(formData, "phone"));
  const email = normalizeEmail(str(formData, "email"));
  const username = str(formData, "username").toLowerCase() || null;
  const notes = str(formData, "notes") || null;
  const status = str(formData, "status") as "invited" | "active" | "inactive";
  const ministryIds = new Set(formData.getAll("ministryIds").map(String).filter(Boolean));
  const coordinatorIds = new Set(formData.getAll("coordinatorIds").map(String).filter(Boolean));

  if (!firstName || !lastName) fail(path, "Name is required.");
  if (!phone && !email) fail(path, "A mobile number or email is required.");

  if (phone) {
    const c = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
    if (c[0] && c[0].id !== id) fail(path, "That mobile number is on another account.");
  }
  if (email) {
    const c = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (c[0] && c[0].id !== id) fail(path, "That email is on another account.");
  }
  if (username) {
    const c = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (c[0] && c[0].id !== id) fail(path, "That username is taken.");
  }

  const isAdmin = actor.role === "admin";
  const mayManage = canManageUser(actor, target);
  if (isAdmin && !mayManage && target.id !== actor.id) fail(path, "Only a super admin can edit another admin.");
  const updates: Partial<typeof users.$inferInsert> = {
    tags: isAdmin ? formData.getAll("tags").map(String).filter(Boolean) : target.tags,
    notifyNoShows: isAdmin && target.role !== "volunteer" ? formData.get("notifyNoShows") === "on" : target.notifyNoShows,
    firstName,
    lastName,
    phone,
    email,
    username,
    notes,
    phoneVerified: phone === target.phone ? target.phoneVerified : false,
    emailVerified: email === target.email ? target.emailVerified : false,
    updatedAt: new Date(),
  };
  if (isAdmin) {
    const role = str(formData, "role") as "volunteer" | "coordinator" | "admin";
    if (["volunteer", "coordinator", "admin"].includes(role)) {
      if (target.id === actor.id && role !== "admin") fail(path, "You cannot remove your own admin role.");
      if ((role === "admin" || target.role === "admin") && role !== target.role && !actor.isSuperAdmin) fail(path, "Only a super admin can grant or remove the admin role.");
      updates.role = role;
      updates.mfaRequired = role !== "volunteer" ? true : formData.get("mfaRequired") === "on";
    }
    if (["invited", "active", "inactive"].includes(status)) {
      if (target.isSuperAdmin && status !== "active" && !actor.isSuperAdmin) fail(path, "Only a super admin can change that account.");
      updates.status = status;
    }
  }
  await db.update(users).set(updates).where(eq(users.id, id));

  // Ministries: admins manage all; coordinators only their own
  const manageable = isAdmin ? null : new Set(actor.coordinatorOf);
  const current = new Map(target.memberships.map((m) => [m.ministryId, m.isCoordinator]));
  const allIds = new Set([...current.keys(), ...ministryIds]);
  for (const mid of allIds) {
    if (manageable && !manageable.has(mid)) continue;
    const want = ministryIds.has(mid);
    const wantCoord = isAdmin && coordinatorIds.has(mid);
    const has = current.has(mid);
    if (want && !has) await db.insert(ministryMembers).values({ userId: id, ministryId: mid, isCoordinator: wantCoord });
    else if (!want && has) await db.delete(ministryMembers).where(and(eq(ministryMembers.userId, id), eq(ministryMembers.ministryId, mid)));
    else if (want && has && isAdmin && current.get(mid) !== wantCoord)
      await db.update(ministryMembers).set({ isCoordinator: wantCoord }).where(and(eq(ministryMembers.userId, id), eq(ministryMembers.ministryId, mid)));
  }
  await db.insert(auditLog).values({ actorId: actor.id, action: "person.update", subjectType: "user", subjectId: id });
  revalidatePath("/admin/people");
  ok(path);
}

export async function resendInvite(formData: FormData) {
  const actor = await requireStaff();
  const id = str(formData, "id");
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) fail("/admin/people", "Person not found.");
  const token = await createInvite(u.id);
  const sent = await sendInvite(u, token, `${actor.firstName} ${actor.lastName}`);
  ok(`/admin/people/${id}`, sent.length ? `Invite sent by ${sent.join(" and ")}.` : "Invite created, but nothing was sent. Check the Twilio and Resend settings.");
}

export async function setTempPassword(formData: FormData) {
  const actor = await requireAdmin();
  const id = str(formData, "id");
  const pw = str(formData, "password");
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) fail("/admin/people", "Person not found.");
  if (!canManageUser(actor, target) && target.id !== actor.id) fail(`/admin/people/${id}`, "Only a super admin can set another admin's password.");
  if (pw.length < 8) fail(`/admin/people/${id}`, "Password needs at least 8 characters.");
  await db.update(users).set({ passwordHash: await hashPassword(pw), status: "active", updatedAt: new Date() }).where(eq(users.id, id));
  await db.insert(auditLog).values({ actorId: actor.id, action: "person.set_password", subjectType: "user", subjectId: id });
  ok(`/admin/people/${id}`, "Password set and account activated.");
}

/** CSV import: first,last,phone,email,ministries (semicolon-separated short names or slugs) */
export async function importPeople(formData: FormData) {
  const actor = await requireAdmin();
  const text = str(formData, "csv");
  const sendNow = formData.get("sendInvite") === "on";
  if (!text) fail("/admin/people/import", "Paste a CSV first.");

  const allMinistries = await db.select().from(ministries);
  const byKey = new Map<string, string>();
  for (const m of allMinistries) {
    byKey.set(m.shortName.toLowerCase(), m.id);
    byKey.set(m.slug.toLowerCase(), m.id);
    byKey.set(m.name.toLowerCase(), m.id);
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let added = 0,
    skipped = 0;
  const problems: string[] = [];
  const header = lines[0]?.toLowerCase();
  const start = header && /first/.test(header) ? 1 : 0;

  for (let i = start; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const [first, last, phoneRaw, emailRaw, minRaw] = cols;
    if (!first || !last) {
      problems.push(`Line ${i + 1}: missing name`);
      continue;
    }
    const phone = normalizePhone(phoneRaw);
    const email = normalizeEmail(emailRaw);
    if (!phone && !email) {
      problems.push(`Line ${i + 1}: ${first} ${last} has no phone or email`);
      continue;
    }
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(phone && email ? and(eq(users.phone, phone)) : phone ? eq(users.phone, phone) : eq(users.email, email!))
      .limit(1);
    let userId = existing[0]?.id;
    if (!userId && email) {
      const byEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      userId = byEmail[0]?.id;
    }
    if (!userId) {
      const [u] = await db.insert(users).values({ firstName: first, lastName: last, phone, email, status: "invited" }).returning();
      userId = u.id;
      added++;
      if (sendNow) {
        const token = await createInvite(u.id);
        await sendInvite(u, token, `${actor.firstName} ${actor.lastName}`);
      }
    } else skipped++;

    const mins = (minRaw ?? "")
      .split(/[;|]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    for (const key of mins) {
      const mid = byKey.get(key);
      if (!mid) {
        problems.push(`Line ${i + 1}: unknown ministry "${key}"`);
        continue;
      }
      await db.insert(ministryMembers).values({ userId, ministryId: mid }).onConflictDoNothing();
    }
  }
  await db.insert(auditLog).values({ actorId: actor.id, action: "person.import", detail: `${added} added, ${skipped} existing` });
  revalidatePath("/admin/people");
  redirect(`/admin/people/import?ok=${encodeURIComponent(`${added} added, ${skipped} already existed.`)}${problems.length ? `&problems=${encodeURIComponent(problems.join("\n"))}` : ""}`);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (ch === "," && !q) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// ---------------- Ministries ----------------

export async function saveMinistry(formData: FormData) {
  const actor = await requireAdmin();
  const id = str(formData, "id");
  const name = str(formData, "name");
  const shortName = str(formData, "shortName");
  if (!name || !shortName) fail("/admin/ministries", "Name and short name are required.");
  // The slug is an identifier (the presider import and CSV import look ministries up by it); never regenerate it on edit.
  const existing = id ? (await db.select({ slug: ministries.slug }).from(ministries).where(eq(ministries.id, id)))[0] : null;
  const values = {
    name,
    shortName,
    slug: existing?.slug ?? slugify(str(formData, "slug") || shortName),
    description: str(formData, "description") || null,
    color: str(formData, "color") || "#1F346D",
    sortOrder: Number(str(formData, "sortOrder") || 100),
    active: formData.get("active") !== "off",
    checkInEnabled: formData.get("checkInEnabled") === "on",
    roles: [...new Set(str(formData, "roles").split(/[,;\n]/).map((r) => r.trim()).filter(Boolean))],
  };
  if (id) await db.update(ministries).set(values).where(eq(ministries.id, id));
  else await db.insert(ministries).values(values);
  await db.insert(auditLog).values({ actorId: actor.id, action: id ? "ministry.update" : "ministry.create", detail: name });
  revalidatePath("/admin/ministries");
  ok("/admin/ministries");
}

export async function toggleMinistry(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const [m] = await db.select().from(ministries).where(eq(ministries.id, id));
  if (m) await db.update(ministries).set({ active: !m.active }).where(eq(ministries.id, id));
  revalidatePath("/admin/ministries");
  ok("/admin/ministries");
}

// ---------------- Mass times and templates ----------------

export async function saveMassTime(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const dayOfWeek = Number(str(formData, "dayOfWeek"));
  const time = str(formData, "time");
  if (!/^\d{2}:\d{2}$/.test(time) || dayOfWeek < 0 || dayOfWeek > 6) fail("/admin/mass-times", "Pick a day and a time.");
  const values = {
    label: str(formData, "label") || `${DAY_NAMES[dayOfWeek]} ${fmtTime(time)}`,
    dayOfWeek,
    time,
    location: str(formData, "location") || "Church",
    sortOrder: Number(str(formData, "sortOrder") || (dayOfWeek === 6 ? 0 : 10) * 100 + Number(time.replace(":", "")) / 10),
    active: formData.get("active") !== "off",
  };
  if (id) await db.update(massTimes).set(values).where(eq(massTimes.id, id));
  else await db.insert(massTimes).values(values);
  revalidatePath("/admin/mass-times");
  ok("/admin/mass-times");
}

export async function toggleMassTime(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const [m] = await db.select().from(massTimes).where(eq(massTimes.id, id));
  if (m) await db.update(massTimes).set({ active: !m.active }).where(eq(massTimes.id, id));
  revalidatePath("/admin/mass-times");
  ok("/admin/mass-times");
}

/** Save the whole template grid: fields named count:<massTimeId>:<ministryId>:<role, URL-encoded, may be empty> */
export async function saveTemplates(formData: FormData) {
  await requireAdmin();
  const entries: { massTimeId: string; ministryId: string; role: string; count: number }[] = [];
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("count:")) continue;
    const [, massTimeId, ministryId, roleRaw = ""] = k.split(":");
    const count = Math.max(0, Math.min(30, Number(v) || 0));
    entries.push({ massTimeId, ministryId, role: decodeURIComponent(roleRaw), count });
  }
  for (const e of entries) {
    const where = and(eq(positionTemplates.massTimeId, e.massTimeId), eq(positionTemplates.ministryId, e.ministryId), eq(positionTemplates.role, e.role));
    if (e.count === 0) {
      await db.delete(positionTemplates).where(where);
    } else {
      await db
        .insert(positionTemplates)
        .values(e)
        .onConflictDoUpdate({ target: [positionTemplates.massTimeId, positionTemplates.ministryId, positionTemplates.role], set: { count: e.count } });
    }
  }
  let note = "Position counts saved.";
  if (formData.get("sync") === "on") {
    const r = await syncUpcomingToPattern();
    note += ` Upcoming Masses updated: ${r.added} seat${r.added === 1 ? "" : "s"} added, ${r.removed} removed, across ${r.masses} Mass${r.masses === 1 ? "" : "es"}.`;
  }
  revalidatePath("/admin/mass-times");
  revalidatePath("/admin/schedule");
  ok("/admin/mass-times", note);
}

// ---------------- Schedule ----------------

/** Create draft liturgies for every active Mass time between two dates, skipping dates that already exist. */
export async function generateLiturgies(formData: FormData) {
  const actor = await requireAdmin();
  const from = str(formData, "from");
  const to = str(formData, "to");
  const publish = formData.get("publish") === "on";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) fail("/admin/schedule", "Pick a valid date range.");
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400_000;
  if (days > 200) fail("/admin/schedule", "Six months at a time at most.");

  const times = await db.query.massTimes.findMany({ where: eq(massTimes.active, true), with: { templates: { with: { ministry: true } } } });
  const existing = await db
    .select({ date: liturgies.date, massTimeId: liturgies.massTimeId })
    .from(liturgies)
    .where(and(gte(liturgies.date, from), lte(liturgies.date, to)));
  const have = new Set(existing.map((e) => `${e.date}|${e.massTimeId}`));

  let created = 0;
  for (const mt of times) {
    for (const date of datesForWeekday(from, to, mt.dayOfWeek)) {
      if (have.has(`${date}|${mt.id}`)) continue;
      await createLiturgyFromMassTime(mt, date, { status: publish ? "published" : "draft" });
      created++;
    }
  }
  await db.insert(auditLog).values({ actorId: actor.id, action: "schedule.generate", detail: `${from}..${to}: ${created} Masses${publish ? " (published)" : ""}` });
  revalidatePath("/admin/schedule");
  ok(`/admin/schedule?from=${from}&to=${to}`, `${created} Masses created${publish ? " and published" : " as drafts"}.`);
}

export async function setLiturgyStatus(formData: FormData) {
  const actor = await requireAdmin();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const status = str(formData, "status") as "draft" | "published" | "cancelled";
  const ret = str(formData, "return") || "/admin/schedule";
  if (!ids.length) fail(ret, "Select at least one Mass.");
  if (!["draft", "published", "cancelled"].includes(status)) fail(ret, "Bad status.");
  await db.update(liturgies).set({ status }).where(inArray(liturgies.id, ids));
  await db.insert(auditLog).values({ actorId: actor.id, action: `schedule.${status}`, detail: `${ids.length} Masses` });
  revalidatePath("/admin/schedule");
  revalidatePath("/app");
  ok(ret, `${ids.length} Mass${ids.length === 1 ? "" : "es"} marked ${status}.`);
}

export async function createOneLiturgy(formData: FormData) {
  const actor = await requireAdmin();
  const date = str(formData, "date");
  const time = str(formData, "time");
  const label = str(formData, "label");
  const title = str(formData, "title") || null;
  const location = str(formData, "location") || "Church";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) fail("/admin/schedule", "Date and time are required.");
  const [l] = await db
    .insert(liturgies)
    .values({ date, time, label: label || fmtTime(time), title, location, startsAt: localToUtc(date, time), status: "draft" })
    .returning();
  await db.insert(auditLog).values({ actorId: actor.id, action: "liturgy.create", subjectId: l.id });
  redirect(`/admin/schedule/${l.id}`);
}

export async function updateLiturgy(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const date = str(formData, "date");
  const time = str(formData, "time");
  const path = `/admin/schedule/${id}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) fail(path, "Date and time are required.");
  await db
    .update(liturgies)
    .set({
      date,
      time,
      startsAt: localToUtc(date, time),
      label: str(formData, "label") || fmtTime(time),
      title: str(formData, "title") || null,
      location: str(formData, "location") || "Church",
      notes: str(formData, "notes") || null,
      status: (str(formData, "status") as "draft" | "published" | "cancelled") || "draft",
    })
    .where(eq(liturgies.id, id));
  revalidatePath("/admin/schedule");
  ok(path);
}

export async function deleteLiturgy(formData: FormData) {
  const actor = await requireAdmin();
  const id = str(formData, "id");
  await db.delete(liturgies).where(eq(liturgies.id, id));
  await db.insert(auditLog).values({ actorId: actor.id, action: "liturgy.delete", subjectId: id });
  revalidatePath("/admin/schedule");
  ok("/admin/schedule", "Mass deleted.");
}

export async function addPosition(formData: FormData) {
  const actor = await requireStaff();
  const liturgyId = str(formData, "liturgyId");
  const ministryId = str(formData, "ministryId");
  const count = Math.max(1, Math.min(20, Number(str(formData, "count") || 1)));
  const path = `/admin/schedule/${liturgyId}`;
  if (!canManageMinistry(actor, ministryId)) fail(path, "You can't add positions for that ministry.");
  const existing = await db.select({ id: positions.id }).from(positions).where(and(eq(positions.liturgyId, liturgyId), eq(positions.ministryId, ministryId)));
  const base = existing.length;
  await db.insert(positions).values(
    Array.from({ length: count }, (_, i) => ({ liturgyId, ministryId, sortOrder: base + i, label: base + count > 1 ? `#${base + i + 1}` : null })),
  );
  revalidatePath(path);
  ok(path);
}

export async function removePosition(formData: FormData) {
  const actor = await requireStaff();
  const id = str(formData, "positionId");
  const [p] = await db.select().from(positions).where(eq(positions.id, id));
  if (!p) fail("/admin/schedule", "Position not found.");
  const path = `/admin/schedule/${p.liturgyId}`;
  if (!canManageMinistry(actor, p.ministryId)) fail(path, "Not your ministry.");
  await db.delete(positions).where(eq(positions.id, id));
  revalidatePath(path);
  ok(path, "Position removed.");
}

export async function assignPerson(formData: FormData) {
  const actor = await requireStaff();
  const positionId = str(formData, "positionId");
  const userId = str(formData, "userId");
  const [p] = await db.select().from(positions).where(eq(positions.id, positionId));
  if (!p) fail("/admin/schedule", "Position not found.");
  const path = `/admin/schedule/${p.liturgyId}`;
  if (!canManageMinistry(actor, p.ministryId)) fail(path, "Not your ministry.");
  const target = await db.query.users.findFirst({ where: eq(users.id, userId), with: { memberships: true } });
  if (!target) fail(path, "Person not found.");
  // Clear any live assignment first (admin override)
  await db.update(assignments).set({ status: "declined", updatedAt: new Date() }).where(and(eq(assignments.positionId, positionId), ne(assignments.status, "declined")));
  try {
    await claimPosition(
      { ...target, ministryIds: target.memberships.map((m) => m.ministryId), coordinatorOf: [], impersonatorId: null },
      positionId,
      actor.id,
    );
  } catch (e) {
    if (e instanceof ScheduleError) fail(path, e.message);
    throw e;
  }
  revalidatePath(path);
  ok(path, `${target.firstName} ${target.lastName} assigned.`);
}

export async function staffAssignmentAction(formData: FormData) {
  const actor = await requireStaff();
  const assignmentId = str(formData, "assignmentId");
  const action = str(formData, "action") as "drop" | "request_sub" | "confirm" | "undo_sub" | "checkin" | "uncheckin";
  const ret = str(formData, "return") || "/admin/schedule";
  if (action === "checkin" || action === "uncheckin") {
    const a = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId), with: { position: true } });
    if (!a) fail(ret, "Assignment not found.");
    if (!canManageMinistry(actor, a.position.ministryId)) fail(ret, "Not your ministry.");
    await db
      .update(assignments)
      .set(action === "checkin" ? { checkedInAt: new Date(), checkedInVia: `admin:${actor.id}` } : { checkedInAt: null, checkedInVia: null })
      .where(eq(assignments.id, assignmentId));
  } else {
    try {
      await changeAssignment(actor, assignmentId, action);
    } catch (e) {
      if (e instanceof ScheduleError) fail(ret, e.message);
      throw e;
    }
  }
  revalidatePath(ret);
  ok(ret);
}

// ---------------- Kiosks ----------------

export async function createKiosk(formData: FormData) {
  const actor = await requireAdmin();
  const name = str(formData, "name") || "Sacristy touchscreen";
  const key = randomBytes(24).toString("base64url");
  await db.insert(kiosks).values({ name, keyHash: sha256(key) });
  await db.insert(auditLog).values({ actorId: actor.id, action: "kiosk.create", detail: name });
  revalidatePath("/admin/kiosks");
  redirect(`/admin/kiosks?newKey=${encodeURIComponent(key)}&name=${encodeURIComponent(name)}`);
}

export async function toggleKiosk(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const [k] = await db.select().from(kiosks).where(eq(kiosks.id, id));
  if (k) await db.update(kiosks).set({ active: !k.active }).where(eq(kiosks.id, id));
  revalidatePath("/admin/kiosks");
  ok("/admin/kiosks");
}

export async function deleteKiosk(formData: FormData) {
  await requireAdmin();
  await db.delete(kiosks).where(eq(kiosks.id, str(formData, "id")));
  revalidatePath("/admin/kiosks");
  ok("/admin/kiosks", "Kiosk removed.");
}

// ---------------- Presider schedule import ----------------

/** Upload the presider PDF, parse it, and go to the review page. Nothing is written to the schedule yet. */
export async function uploadPresiderSchedule(formData: FormData) {
  const actor = await requireAdmin();
  const file = formData.get("pdf");
  const path = "/admin/schedule/presiders";
  if (!(file instanceof File) || file.size === 0) fail(path, "Choose a PDF first.");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) fail(path, "That file is not a PDF.");
  if (file.size > 6 * 1024 * 1024) fail(path, "PDFs up to 6 MB.");
  let payload;
  try {
    payload = await parsePresiderPdf(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    fail(path, e instanceof Error ? e.message : "Could not read that PDF.");
  }
  if (payload.rows.length === 0) fail(path, "No weekend Masses found in that PDF.");
  const [row] = await db.insert(presiderImports).values({ createdById: actor.id, fileName: file.name, payload }).returning();
  await db.insert(auditLog).values({ actorId: actor.id, action: "presiders.upload", subjectType: "presider_import", subjectId: row.id, detail: file.name });
  redirect(`/admin/schedule/presiders/${row.id}`);
}

/** Apply a reviewed import: fields named map:<INITIALS> hold a user id or "new". */
export async function confirmPresiderImport(formData: FormData) {
  const actor = await requireAdmin();
  const id = str(formData, "id");
  const path = `/admin/schedule/presiders/${id}`;
  const mapping: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("map:")) mapping[k.slice(4)] = String(v);
  let result;
  try {
    result = await applyPresiderImport(id, mapping, actor.id);
  } catch (e) {
    if (e instanceof ScheduleError) fail(path, e.message);
    throw e;
  }
  revalidatePath("/admin/schedule");
  ok(`/admin/schedule?from=${result.from}&to=${result.to}`, result.summary);
}

export async function discardPresiderImport(formData: FormData) {
  await requireAdmin();
  await db.delete(presiderImports).where(and(eq(presiderImports.id, str(formData, "id")), isNull(presiderImports.appliedAt)));
  ok("/admin/schedule/presiders", "Discarded.");
}

// ---------------- Sign in as ----------------

export async function signInAs(formData: FormData) {
  const actor = await requireAdmin();
  if (actor.impersonatorId) fail("/admin/people", "You are already signed in as someone else. Return to your own account first.");
  const id = str(formData, "id");
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target) fail("/admin/people", "Person not found.");
  if (!canManageUser(actor, target) || target.id === actor.id) fail(`/admin/people/${id}`, "You cannot sign in as that account.");
  if (target.status !== "active") fail(`/admin/people/${id}`, "That account is not active, so it cannot sign in.");
  await db.insert(auditLog).values({ actorId: actor.id, action: "impersonate.start", subjectType: "user", subjectId: id, detail: `${target.firstName} ${target.lastName}` });
  await impersonate(actor, id);
  redirect(target.role === "volunteer" ? "/app" : "/admin");
}

export async function returnToOwnAccount() {
  const u = await getCurrentUser();
  if (u?.impersonatorId) await db.insert(auditLog).values({ actorId: u.impersonatorId, action: "impersonate.stop", subjectType: "user", subjectId: u.id });
  await stopImpersonating();
  redirect("/admin/people");
}

// ---------------- Blackout dates ----------------

export async function addBlackout(formData: FormData) {
  const actor = await requireStaff();
  const userId = str(formData, "userId");
  const from = str(formData, "from");
  const to = str(formData, "to") || from;
  const note = str(formData, "note") || null;
  const ret = str(formData, "return") || `/admin/people/${userId}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) fail(ret, "Pick a valid date range.");
  const target = await db.query.users.findFirst({ where: eq(users.id, userId), with: { memberships: true } });
  if (!target) fail("/admin/people", "Person not found.");
  if (actor.role !== "admin" && !target.memberships.some((m) => actor.coordinatorOf.includes(m.ministryId))) fail(ret, "Not your ministry.");
  await db.insert(blackouts).values({ userId, fromDate: from, toDate: to, note, createdById: actor.id });
  await db.insert(auditLog).values({ actorId: actor.id, action: "blackout.add", subjectType: "user", subjectId: userId, detail: `${from}..${to}` });
  revalidatePath(ret);
  ok(ret, "Away dates saved.");
}

export async function removeBlackout(formData: FormData) {
  const actor = await requireStaff();
  const id = str(formData, "id");
  const ret = str(formData, "return") || "/admin/people";
  const [b] = await db.select().from(blackouts).where(eq(blackouts.id, id));
  if (!b) fail(ret, "Not found.");
  const target = await db.query.users.findFirst({ where: eq(users.id, b.userId), with: { memberships: true } });
  if (actor.role !== "admin" && !target?.memberships.some((m) => actor.coordinatorOf.includes(m.ministryId))) fail(ret, "Not your ministry.");
  await db.delete(blackouts).where(eq(blackouts.id, id));
  revalidatePath(ret);
  ok(ret, "Removed.");
}

// ---------------- Settings ----------------

export async function saveNoShowSettings(formData: FormData) {
  const actor = await requireAdmin();
  const hours = Math.max(0, Math.min(12, Number(str(formData, "hours")) || 0));
  const minutes = Math.max(0, Math.min(59, Number(str(formData, "minutes")) || 0));
  const noShow = {
    enabled: formData.get("enabled") === "on",
    sms: formData.get("sms") === "on",
    email: formData.get("email") === "on",
    when: (str(formData, "when") === "after" ? "after" : "before") as "before" | "after",
    offsetMinutes: hours * 60 + minutes,
  };
  await saveSettings({ noShow });
  await db.insert(auditLog).values({ actorId: actor.id, action: "settings.no_show", detail: JSON.stringify(noShow) });
  ok("/admin/settings");
}
