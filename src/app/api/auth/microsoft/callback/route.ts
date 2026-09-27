import { NextRequest, NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users, auditLog } from "@/db/schema";
import { finishMicrosoft } from "@/lib/microsoft";
import { createSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const cookieState = req.cookies.get("ms_state")?.value;
  const nonce = req.cookies.get("ms_nonce")?.value;
  const verifier = req.cookies.get("ms_verifier")?.value;
  const next = req.cookies.get("ms_next")?.value ?? "/admin";

  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/admin/login?error=${reason}`, req.url));
    for (const c of ["ms_state", "ms_nonce", "ms_verifier", "ms_next"]) res.cookies.delete(c);
    return res;
  };

  if (sp.get("error")) return fail("ms_denied");
  if (!code || !state || !cookieState || state !== cookieState || !nonce || !verifier) return fail("ms_state");

  let identity;
  try {
    identity = await finishMicrosoft(code, verifier, nonce);
  } catch (e) {
    console.error(e);
    return fail("ms_exchange");
  }

  // Match an existing staff account. We never create accounts from a Microsoft login.
  const conds = [eq(users.entraOid, identity.oid)];
  if (identity.email) conds.push(eq(users.email, identity.email));
  const match = await db.select().from(users).where(or(...conds)).limit(1);
  const user = match[0];
  if (!user || user.status !== "active" || (user.role !== "admin" && user.role !== "coordinator")) {
    return fail("ms_no_account");
  }
  if (!user.entraOid) {
    await db.update(users).set({ entraOid: identity.oid, emailVerified: true }).where(eq(users.id, user.id));
  }
  await createSession(user.id);
  await db.insert(auditLog).values({ actorId: user.id, action: "login.microsoft" });

  const res = NextResponse.redirect(new URL(next, req.url));
  for (const c of ["ms_state", "ms_nonce", "ms_verifier", "ms_next"]) res.cookies.delete(c);
  return res;
}
