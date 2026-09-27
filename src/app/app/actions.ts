"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, blackouts, auditLog } from "@/db/schema";
import { notifyMinistryOpenSlot } from "@/lib/alerts";
import { requireUser, hashPassword, verifyPassword, issueOtp, verifyOtp } from "@/lib/auth";
import { claimPosition, changeAssignment, ScheduleError } from "@/lib/schedule";
import { normalizeEmail, normalizePhone } from "@/lib/phone";
import { regenerateCalendarToken } from "@/lib/ical";

function back(formData: FormData, fallback: string) {
  const r = String(formData.get("return") ?? "");
  return r.startsWith("/") ? r : fallback;
}

export async function signUp(formData: FormData) {
  const user = await requireUser();
  const positionId = String(formData.get("positionId"));
  const ret = back(formData, "/app/schedule");
  try {
    await claimPosition(user, positionId);
  } catch (e) {
    if (e instanceof ScheduleError) redirect(`${ret}${ret.includes("?") ? "&" : "?"}error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/app");
  redirect(`${ret}${ret.includes("?") ? "&" : "?"}ok=signed_up`);
}

export async function updateAssignment(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("assignmentId"));
  const action = String(formData.get("action")) as "drop" | "request_sub" | "confirm" | "undo_sub";
  const ret = back(formData, "/app/mine");
  let result;
  try {
    result = await changeAssignment(user, id, action);
  } catch (e) {
    if (e instanceof ScheduleError) redirect(`${ret}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }

  // If someone drops or asks for a sub within 10 days, let the rest of the ministry know right away.
  if (action === "drop" || action === "request_sub") {
    const l = result.position.liturgy;
    const daysOut = (l.startsAt.getTime() - Date.now()) / 86400_000;
    if (daysOut <= 10) await notifyMinistryOpenSlot(result.position.ministryId, l, user.id);
  }

  revalidatePath("/app");
  redirect(`${ret}?ok=${action}`);
}

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!phone && !email) redirect("/app/profile?error=Enter+a+mobile+number+or+email.");

  const updates: Partial<typeof users.$inferInsert> = {
    notifySms: formData.get("notifySms") === "on",
    notifyEmail: formData.get("notifyEmail") === "on",
    updatedAt: new Date(),
  };
  // Changing phone/email requires verifying the new one
  let verifyDest: string | null = null;
  let channel: "sms" | "email" = "sms";
  if (phone && phone !== user.phone) {
    const clash = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
    if (clash[0]) redirect("/app/profile?error=That+mobile+number+belongs+to+another+account.");
    verifyDest = phone;
    channel = "sms";
  } else if (email && email !== user.email) {
    const clash = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (clash[0]) redirect("/app/profile?error=That+email+belongs+to+another+account.");
    verifyDest = email;
    channel = "email";
  }
  if (!phone && user.phone) updates.phone = null;
  if (!email && user.email) updates.email = null;

  await db.update(users).set(updates).where(eq(users.id, user.id));

  if (verifyDest) {
    await issueOtp({ userId: user.id, destination: verifyDest, channel, purpose: channel === "sms" ? "verify_phone" : "verify_email" });
    redirect(`/app/profile?verify=${encodeURIComponent(verifyDest)}`);
  }
  revalidatePath("/app/profile");
  redirect("/app/profile?ok=saved");
}

export async function confirmContactChange(formData: FormData) {
  const user = await requireUser();
  const dest = String(formData.get("dest") ?? "");
  const code = String(formData.get("code") ?? "");
  const isPhone = dest.startsWith("+");
  const r = await verifyOtp(dest, isPhone ? "verify_phone" : "verify_email", code);
  if (!r.ok || r.userId !== user.id) redirect(`/app/profile?verify=${encodeURIComponent(dest)}&error=${encodeURIComponent(r.error ?? "Bad code")}`);
  await db
    .update(users)
    .set(isPhone ? { phone: dest, phoneVerified: true, updatedAt: new Date() } : { email: dest, emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  revalidatePath("/app/profile");
  redirect("/app/profile?ok=verified");
}

export async function changePassword(formData: FormData) {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) redirect("/app/profile?error=Current+password+is+not+right.");
  if (next.length < 8) redirect("/app/profile?error=Passwords+need+at+least+8+characters.");
  if (next !== confirm) redirect("/app/profile?error=The+two+passwords+do+not+match.");
  await db.update(users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(users.id, user.id));
  redirect("/app/profile?ok=password");
}

export async function setMfa(formData: FormData) {
  const user = await requireUser();
  await db.update(users).set({ mfaRequired: formData.get("mfa") === "on", updatedAt: new Date() }).where(eq(users.id, user.id));
  revalidatePath("/app/profile");
  redirect("/app/profile?ok=saved");
}

export async function addMyBlackout(formData: FormData) {
  const user = await requireUser();
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "") || from;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) redirect("/app/profile?error=Pick+a+valid+date+range.");
  await db.insert(blackouts).values({ userId: user.id, fromDate: from, toDate: to, note, createdById: user.id });
  await db.insert(auditLog).values({ actorId: user.id, action: "blackout.add", subjectType: "user", subjectId: user.id, detail: `${from}..${to}` });
  revalidatePath("/app");
  redirect("/app/profile?ok=away");
}

export async function removeMyBlackout(formData: FormData) {
  const user = await requireUser();
  await db.delete(blackouts).where(and(eq(blackouts.id, String(formData.get("id"))), eq(blackouts.userId, user.id)));
  revalidatePath("/app");
  redirect("/app/profile?ok=saved");
}

export async function resetCalendarLink() {
  const user = await requireUser();
  await regenerateCalendarToken(user.id);
  revalidatePath("/app/profile");
  redirect("/app/profile?ok=calendar");
}
