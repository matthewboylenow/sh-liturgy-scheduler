import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { coverageReport, toCsv } from "@/lib/reports";
import { addDaysLocal, todayLocal } from "@/lib/time";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return new NextResponse("Sign in first", { status: 401 });
  const sp = req.nextUrl.searchParams;
  const today = todayLocal();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("from") ?? "") ? sp.get("from")! : addDaysLocal(today, -56);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("to") ?? "") ? sp.get("to")! : addDaysLocal(today, 28);
  const r = await coverageReport(from, to);
  const admin = user.role === "admin";
  const ministries = r.ministries.filter((m) => admin || user.coordinatorOf.includes(m.key));
  const allowed = new Set(ministries.map((m) => m.label));
  const people = r.people.filter((p) => p.ministries.some((n) => allowed.has(n)));
  const rows: (string | number)[][] = [
    ["Section", "Name", "Seats", "Filled", "Checked in", "No-shows", "Tags", "Ministries"],
    ...ministries.map((m) => ["Ministry", m.label, m.seats, m.filled, m.checkedIn, m.noShows, "", ""]),
    ...r.masses.map((m) => ["Mass time", m.label, m.seats, m.filled, m.checkedIn, m.noShows, "", ""]),
    ...people.map((p) => ["Person", p.name, "", p.served, p.checkedIn, p.noShows, p.tags.join("; "), p.ministries.join("; ")]),
  ];
  return new NextResponse(toCsv(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="liturgy-report-${from}-to-${to}.csv"` },
  });
}
