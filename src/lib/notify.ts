import twilio from "twilio";
import { Resend } from "resend";
import { db } from "@/db";
import { notificationLog } from "@/db/schema";
import { env } from "./env";

type Meta = { userId?: string | null; kind: string };

let twilioClient: ReturnType<typeof twilio> | null = null;
function getTwilio() {
  const t = env.twilio();
  if (!t.accountSid || !t.authToken) return null;
  if (!twilioClient) twilioClient = twilio(t.accountSid, t.authToken);
  return twilioClient;
}

let resendClient: Resend | null = null;
function getResend() {
  const r = env.resend();
  if (!r.apiKey) return null;
  if (!resendClient) resendClient = new Resend(r.apiKey);
  return resendClient;
}

export async function sendSms(to: string, body: string, meta: Meta): Promise<{ ok: boolean; error?: string }> {
  const client = getTwilio();
  const t = env.twilio();
  let providerId: string | undefined;
  let error: string | undefined;

  if (!client) {
    if (env.devOtpEcho()) {
      console.log(`[SMS -> ${to}] ${body}`);
    } else {
      error = "Twilio is not configured";
    }
  } else {
    try {
      const msg = await client.messages.create({
        to,
        body,
        ...(t.messagingServiceSid ? { messagingServiceSid: t.messagingServiceSid } : { from: t.from }),
      });
      providerId = msg.sid;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  await db.insert(notificationLog).values({
    userId: meta.userId ?? null,
    channel: "sms",
    destination: to,
    kind: meta.kind,
    body,
    providerId,
    error,
  });
  return { ok: !error, error };
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  meta: Meta,
  text?: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = getResend();
  const r = env.resend();
  let providerId: string | undefined;
  let error: string | undefined;

  if (!client) {
    if (env.devOtpEcho()) {
      console.log(`[EMAIL -> ${to}] ${subject}\n${text ?? html}`);
    } else {
      error = "Resend is not configured";
    }
  } else {
    try {
      const res = await client.emails.send({ from: r.from, to, subject, html, text, replyTo: r.replyTo });
      if (res.error) error = res.error.message;
      providerId = res.data?.id;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  await db.insert(notificationLog).values({
    userId: meta.userId ?? null,
    channel: "email",
    destination: to,
    kind: meta.kind,
    body: `${subject}\n\n${text ?? html}`,
    providerId,
    error,
  });
  return { ok: !error, error };
}

/** Minimal branded email wrapper. */
export function emailShell(title: string, bodyHtml: string): string {
  const parish = env.parishName();
  return `<!doctype html><html><body style="margin:0;background:#FAF9F7;font-family:Georgia,serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="background:#1F346D;color:#FAF9F7;padding:18px 24px;border-radius:8px 8px 0 0;font-size:18px;letter-spacing:.3px">${parish} Liturgy Scheduler</div>
  <div style="background:#fff;padding:24px;border:1px solid #e6e2dc;border-top:0;border-radius:0 0 8px 8px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5">
    <h1 style="font-size:20px;margin:0 0 12px;font-family:Georgia,serif">${title}</h1>
    ${bodyHtml}
  </div>
  <p style="color:#777;font-size:12px;margin-top:16px">Sent to people who serve in a liturgical ministry at ${parish}. Change reminders in your profile.</p>
</div></body></html>`;
}
