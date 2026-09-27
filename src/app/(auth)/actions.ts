"use server";

import { redirect } from "next/navigation";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users, invites, auditLog } from "@/db/schema";
import {
  createSession,
  deviceTrusted,
  trustDevice,
  hashPassword,
  issueOtp,
  readMfaPending,
  setMfaPending,
  verifyOtp,
  verifyPassword,
  findInvite,
  sha256,
  isStaff,
} from "@/lib/auth";
import { normalizeEmail, normalizePhone } from "@/lib/phone";

function safeNext(v: unknown, fallback: string) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

/** Step 1 of passwordless login: text (or email) a code. */
export async function requestLoginCode(formData: FormData) {
  const raw = String(formData.get("destination") ?? "").trim();
  const next = safeNext(formData.get("next"), "/app");
  const area = formData.get("area") === "admin" ? "admin" : "app";
  const loginPath = area === "admin" ? "/admin/login" : "/login";

  const phone = normalizePhone(raw);
  const email = normalizeEmail(raw);
  if (!phone && !email) redirect(`${loginPath}?error=bad_destination`);

  const found = await db
    .select()
    .from(users)
    .where(phone ? eq(users.phone, phone) : eq(users.email, email!))
    .limit(1);
  const user = found[0];
  if (!user || user.status !== "active") redirect(`${loginPath}?error=no_account`);
  if (area === "admin" && user.role === "volunteer") redirect(`${loginPath}?error=not_staff`);

  const dest = phone ?? email!;
  const r = await issueOtp({ userId: user.id, destination: dest, channel: phone ? "sms" : "email", purpose: "login" });
  if (!r.ok) redirect(`${loginPath}?error=${encodeURIComponent(r.error ?? "send_failed")}`);
  redirect(`/login/verify?dest=${encodeURIComponent(dest)}&next=${encodeURIComponent(next)}&area=${area}`);
}

/** Step 2 of passwordless login. */
export async function verifyLoginCode(formData: FormData) {
  const dest = String(formData.get("dest") ?? "");
  const code = String(formData.get("code") ?? "");
  const next = safeNext(formData.get("next"), "/app");
  const area = formData.get("area") === "admin" ? "admin" : "app";
  const r = await verifyOtp(dest, "login", code);
  if (!r.ok || !r.userId) {
    redirect(`/login/verify?dest=${encodeURIComponent(dest)}&next=${encodeURIComponent(next)}&area=${area}&error=${encodeURIComponent(r.error ?? "bad_code")}`);
  }
  await createSession(r.userId);
  await db.insert(auditLog).values({ actorId: r.userId, action: "login.code" });
  redirect(next);
}

/** Username/email/phone + password. Staff and anyone with MFA on get a second step. */
export async function passwordLogin(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"), "/app");
  const area = formData.get("area") === "admin" ? "admin" : "app";
  const loginPath = area === "admin" ? "/admin/login" : "/login";

  const phone = normalizePhone(identifier);
  const email = normalizeEmail(identifier);
  const conds = [eq(users.username, identifier.toLowerCase())];
  if (phone) conds.push(eq(users.phone, phone));
  if (email) conds.push(eq(users.email, email));

  const found = await db.select().from(users).where(or(...conds)).limit(1);
  const user = found[0];
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok || user.status !== "active") redirect(`${loginPath}?error=bad_login&tab=password`);
  if (area === "admin" && user.role === "volunteer") redirect(`${loginPath}?error=not_staff&tab=password`);

  const needsMfa = (user.mfaRequired || user.role === "admin" || user.role === "coordinator") && !(await deviceTrusted(user.id));
  if (needsMfa) {
    const dest = user.phone ?? user.email;
    if (!dest) redirect(`${loginPath}?error=mfa_no_destination&tab=password`);
    await issueOtp({ userId: user.id, destination: dest, channel: user.phone ? "sms" : "email", purpose: "mfa" });
    await setMfaPending(user.id, next);
    redirect(`/login/verify?mfa=1&dest=${encodeURIComponent(dest)}&area=${area}`);
  }

  await createSession(user.id);
  await db.insert(auditLog).values({ actorId: user.id, action: "login.password" });
  redirect(next);
}

export async function verifyMfaCode(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const dest = String(formData.get("dest") ?? "");
  const area = formData.get("area") === "admin" ? "admin" : "app";
  const pending = await readMfaPending();
  if (!pending) redirect(area === "admin" ? "/admin/login?error=mfa_expired" : "/login?error=mfa_expired");
  const r = await verifyOtp(dest, "mfa", code);
  if (!r.ok || r.userId !== pending.uid) {
    redirect(`/login/verify?mfa=1&dest=${encodeURIComponent(dest)}&area=${area}&error=${encodeURIComponent(r.error ?? "bad_code")}`);
  }
  await createSession(pending.uid);
  if (formData.get("remember") === "on") await trustDevice(pending.uid);
  await db.insert(auditLog).values({ actorId: pending.uid, action: formData.get("remember") === "on" ? "login.password+mfa (device remembered)" : "login.password+mfa" });
  redirect(pending.next);
}

export async function resendCode(formData: FormData) {
  const dest = String(formData.get("dest") ?? "");
  const mfa = formData.get("mfa") === "1";
  const next = safeNext(formData.get("next"), "/app");
  const area = formData.get("area") === "admin" ? "admin" : "app";
  const phone = normalizePhone(dest);
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(phone ? eq(users.phone, phone) : eq(users.email, dest))
    .limit(1);
  if (found[0]) {
    await issueOtp({ userId: found[0].id, destination: dest, channel: phone ? "sms" : "email", purpose: mfa ? "mfa" : "login" });
  }
  redirect(`/login/verify?${mfa ? "mfa=1&" : ""}dest=${encodeURIComponent(dest)}&next=${encodeURIComponent(next)}&area=${area}&sent=1`);
}

/** Finish account setup from an invite link. */
export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const phoneRaw = String(formData.get("phone") ?? "");
  const emailRaw = String(formData.get("email") ?? "");
  const notifySms = formData.get("notifySms") === "on";
  const notifyEmail = formData.get("notifyEmail") === "on";

  const found = await findInvite(token);
  if (!found) redirect(`/invite/${token}?error=expired`);

  if (password && password.length < 8) redirect(`/invite/${token}?error=short_password`);
  if (password && password !== confirm) redirect(`/invite/${token}?error=mismatch`);

  const phone = normalizePhone(phoneRaw);
  const email = normalizeEmail(emailRaw);
  if (!phone && !email) redirect(`/invite/${token}?error=need_contact`);
  if (!password && !phone && !email) redirect(`/invite/${token}?error=need_login_method`);

  // Make sure phone/email are not already taken by someone else
  if (phone) {
    const clash = await db.select({ id: users.id }).from(users).where(and(eq(users.phone, phone))).limit(1);
    if (clash[0] && clash[0].id !== found.user.id) redirect(`/invite/${token}?error=phone_taken`);
  }
  if (email) {
    const clash = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (clash[0] && clash[0].id !== found.user.id) redirect(`/invite/${token}?error=email_taken`);
  }

  await db
    .update(users)
    .set({
      passwordHash: password ? await hashPassword(password) : found.user.passwordHash,
      phone: phone ?? found.user.phone,
      email: email ?? found.user.email,
      // The invite was delivered to their phone/email, so treat the one that matches as verified
      phoneVerified: found.user.phoneVerified || (!!phone && phone === found.user.phone),
      emailVerified: found.user.emailVerified || (!!email && email === found.user.email),
      notifySms,
      notifyEmail,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(users.id, found.user.id));
  await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.tokenHash, sha256(token)));
  await createSession(found.user.id);
  await db.insert(auditLog).values({ actorId: found.user.id, action: "invite.accepted" });
  redirect(isStaff({ ...found.user, ministryIds: [], coordinatorOf: [], impersonatorId: null }) ? "/admin" : "/app?welcome=1");
}
