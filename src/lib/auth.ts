import { cookies, headers } from "next/headers";
import { cache } from "react";
import { createHash, randomBytes, randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, sessions, otpCodes, ministryMembers, invites, loginAttempts, type User } from "@/db/schema";
import { env } from "./env";
import { sendSms, sendEmail, emailShell } from "./notify";

export const SESSION_COOKIE = "sh_session";
export const MFA_COOKIE = "sh_mfa";
export const TRUST_COOKIE = "sh_trust"; // "remember this device": skips the code after a password for 30 days
export const ADMIN_SESSION_COOKIE = "sh_admin_session"; // the admin's own session while they are signed in as someone else
const SESSION_DAYS = 30;
const TRUST_DAYS = 30;
const OTP_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MIN = 15;
const LOGIN_MAX_PER_ID = 10;
const LOGIN_MAX_PER_IP = 30;

export function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

function secretKey() {
  return new TextEncoder().encode(env.sessionSecret());
}

// ---------- Passwords ----------

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string | null) {
  if (!hash) return false;
  return bcrypt.compare(pw, hash);
}

// ---------- Password attempt throttling ----------

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/** True when this identifier or this IP has failed too often in the last 15 minutes. */
export async function loginThrottled(identifier: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MIN * 60_000);
  const ip = await clientIp();
  const rows = await db
    .select({ key: loginAttempts.key })
    .from(loginAttempts)
    .where(and(inArray(loginAttempts.key, [`id:${identifier.toLowerCase()}`, `ip:${ip}`]), gt(loginAttempts.createdAt, since)));
  const byId = rows.filter((r) => r.key.startsWith("id:")).length;
  const byIp = rows.filter((r) => r.key.startsWith("ip:")).length;
  return byId >= LOGIN_MAX_PER_ID || byIp >= LOGIN_MAX_PER_IP;
}

export async function recordFailedLogin(identifier: string) {
  const ip = await clientIp();
  await db.insert(loginAttempts).values([{ key: `id:${identifier.toLowerCase()}` }, { key: `ip:${ip}` }]);
}

export async function clearFailedLogins(identifier: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, `id:${identifier.toLowerCase()}`));
}

// ---------- Sessions ----------

export async function createSession(userId: string, opts: { impersonatorId?: string } = {}) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt,
    userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
    impersonatorId: opts.impersonatorId ?? null,
  });
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  c.delete(MFA_COOKIE);
  return token;
}

export async function destroySession() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  c.delete(SESSION_COOKIE);
  // Signing out while impersonating also ends the admin's parked session.
  const adminToken = c.get(ADMIN_SESSION_COOKIE)?.value;
  if (adminToken) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(adminToken)));
    c.delete(ADMIN_SESSION_COOKIE);
  }
}

// ---------- Trusted device (skip the code for 30 days) ----------

export async function trustDevice(userId: string) {
  const jwt = await new SignJWT({ uid: userId, kind: "trust" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${TRUST_DAYS}d`)
    .sign(secretKey());
  const c = await cookies();
  c.set(TRUST_COOKIE, jwt, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TRUST_DAYS * 86400 });
}

export async function deviceTrusted(userId: string): Promise<boolean> {
  const c = await cookies();
  const v = c.get(TRUST_COOKIE)?.value;
  if (!v) return false;
  try {
    const { payload } = await jwtVerify(v, secretKey());
    return payload.kind === "trust" && payload.uid === userId;
  } catch {
    return false;
  }
}

// ---------- Impersonation ----------

/** Start a session as `targetId`, parking the admin's own session in a second cookie. */
export async function impersonate(admin: SessionUser, targetId: string) {
  const c = await cookies();
  const own = c.get(SESSION_COOKIE)?.value;
  if (!own) redirect("/admin/login");
  c.set(ADMIN_SESSION_COOKIE, own, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600 });
  await createSession(targetId, { impersonatorId: admin.id });
}

/** Back to the admin's own session; the impersonated session is deleted. */
export async function stopImpersonating() {
  const c = await cookies();
  const cur = c.get(SESSION_COOKIE)?.value;
  const own = c.get(ADMIN_SESSION_COOKIE)?.value;
  if (cur) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(cur)));
  c.delete(ADMIN_SESSION_COOKIE);
  if (own) {
    c.set(SESSION_COOKIE, own, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(Date.now() + SESSION_DAYS * 86400_000) });
  } else {
    c.delete(SESSION_COOKIE);
  }
}

export type SessionUser = User & { ministryIds: string[]; coordinatorOf: string[]; impersonatorId: string | null };

/** The logged-in user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await db
    .select({ user: users, expiresAt: sessions.expiresAt, impersonatorId: sessions.impersonatorId })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const found = row[0];
  if (!found || found.user.status !== "active") return null;
  const memberships = await db
    .select({ ministryId: ministryMembers.ministryId, isCoordinator: ministryMembers.isCoordinator })
    .from(ministryMembers)
    .where(eq(ministryMembers.userId, found.user.id));
  return {
    ...found.user,
    ministryIds: memberships.map((m) => m.ministryId),
    coordinatorOf: memberships.filter((m) => m.isCoordinator).map((m) => m.ministryId),
    impersonatorId: found.impersonatorId,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export function isAdmin(u: SessionUser | null) {
  return u?.role === "admin";
}
export function isSuperAdmin(u: SessionUser | null) {
  return u?.role === "admin" && u.isSuperAdmin;
}
/** Whether `actor` may change `target`'s role, status, or sign in as them. Super admins can touch anyone; admins cannot touch admins. */
export function canManageUser(actor: SessionUser, target: { id: string; role: string; isSuperAdmin: boolean }) {
  if (actor.role !== "admin") return false;
  if (actor.isSuperAdmin) return true;
  return target.role !== "admin" && !target.isSuperAdmin;
}
export function isStaff(u: SessionUser | null) {
  return u?.role === "admin" || u?.role === "coordinator";
}
/** Can this user manage the given ministry (admin, or coordinator of it)? */
export function canManageMinistry(u: SessionUser, ministryId: string) {
  return u.role === "admin" || u.coordinatorOf.includes(ministryId);
}

export async function requireStaff(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/admin/login");
  if (!isStaff(u)) redirect("/app?denied=1");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/admin/login");
  if (!isAdmin(u)) redirect("/admin?denied=1");
  return u;
}

// ---------- MFA pending ticket (password accepted, code still needed) ----------

export async function setMfaPending(userId: string, next: string) {
  const jwt = await new SignJWT({ uid: userId, next })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(secretKey());
  const c = await cookies();
  c.set(MFA_COOKIE, jwt, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 900 });
}

export async function readMfaPending(): Promise<{ uid: string; next: string } | null> {
  const c = await cookies();
  const v = c.get(MFA_COOKIE)?.value;
  if (!v) return null;
  try {
    const { payload } = await jwtVerify(v, secretKey());
    return { uid: String(payload.uid), next: String(payload.next ?? "/app") };
  } catch {
    return null;
  }
}

// ---------- One-time codes ----------

export type OtpChannel = "sms" | "email";
export type OtpPurpose = "login" | "mfa" | "verify_phone" | "verify_email";

/** Create and deliver a 6-digit code. Returns false if nothing could be sent. */
export async function issueOtp(opts: {
  userId: string | null;
  destination: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
}): Promise<{ ok: boolean; error?: string }> {
  // Throttle: no more than 5 codes per destination per 15 minutes
  const recent = await db
    .select({ id: otpCodes.id })
    .from(otpCodes)
    .where(and(eq(otpCodes.destination, opts.destination), gt(otpCodes.createdAt, new Date(Date.now() - 15 * 60_000))));
  if (recent.length >= 5) return { ok: false, error: "Too many codes. Wait a few minutes." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(otpCodes).values({
    userId: opts.userId,
    destination: opts.destination,
    channel: opts.channel,
    purpose: opts.purpose,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + OTP_MINUTES * 60_000),
  });

  const parish = env.parishName();
  if (opts.channel === "sms") {
    return sendSms(opts.destination, `${parish} Liturgy: your code is ${code}. It expires in ${OTP_MINUTES} minutes.`, {
      userId: opts.userId,
      kind: "otp",
    });
  }
  return sendEmail(
    opts.destination,
    `Your ${parish} Liturgy Scheduler code: ${code}`,
    emailShell("Your sign-in code", `<p style="font-size:28px;letter-spacing:6px;font-weight:bold">${code}</p><p>Expires in ${OTP_MINUTES} minutes. If you did not ask for a code, ignore this email.</p>`),
    { userId: opts.userId, kind: "otp" },
    `Your code is ${code}. It expires in ${OTP_MINUTES} minutes.`,
  );
}

export async function verifyOtp(destination: string, purpose: OtpPurpose, code: string): Promise<{ ok: boolean; userId: string | null; error?: string }> {
  const rows = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.destination, destination), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(otpCodes.createdAt);
  const latest = rows.at(-1);
  if (!latest) return { ok: false, userId: null, error: "That code expired. Send a new one." };
  if (latest.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, userId: null, error: "Too many tries. Send a new code." };
  if (latest.codeHash !== sha256(code.replace(/\D/g, ""))) {
    await db.update(otpCodes).set({ attempts: latest.attempts + 1 }).where(eq(otpCodes.id, latest.id));
    return { ok: false, userId: null, error: "That code is not right." };
  }
  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, latest.id));
  return { ok: true, userId: latest.userId };
}

// ---------- Invites ----------

export async function createInvite(userId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await db.insert(invites).values({
    userId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 14 * 86400_000),
  });
  return token;
}

export async function findInvite(token: string) {
  const rows = await db
    .select({ invite: invites, user: users })
    .from(invites)
    .innerJoin(users, eq(users.id, invites.userId))
    .where(and(eq(invites.tokenHash, sha256(token)), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function sendInvite(user: User, token: string, invitedBy?: string) {
  const url = `${env.appUrl()}/invite/${token}`;
  const parish = env.parishName();
  const results: string[] = [];
  if (user.phone) {
    const r = await sendSms(user.phone, `${parish} Liturgy: ${invitedBy ?? "the parish office"} set up your account for Mass ministry sign-ups. Finish here: ${url}`, {
      userId: user.id,
      kind: "invite",
    });
    if (r.ok) results.push("text");
  }
  if (user.email) {
    const r = await sendEmail(
      user.email,
      `Your ${parish} ministry sign-up account`,
      emailShell(
        `Welcome, ${user.firstName}`,
        `<p>${invitedBy ?? "The parish office"} set up your account for Mass ministry sign-ups. It replaces SignUpGenius.</p>
         <p><a href="${url}" style="display:inline-block;background:#CD5334;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Finish setup</a></p>
         <p style="color:#666;font-size:13px">Or open this link:<br>${url}</p>`,
      ),
      { userId: user.id, kind: "invite" },
      `Finish setup: ${url}`,
    );
    if (r.ok) results.push("email");
  }
  return results;
}
