import { NextResponse } from "next/server";
import { getKiosk, kioskToday } from "@/lib/kiosk";

export async function GET() {
  const k = await getKiosk();
  if (!k) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await kioskToday();
  return NextResponse.json({ kiosk: { id: k.id, name: k.name }, ...data, now: new Date().toISOString() });
}
