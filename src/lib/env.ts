// Central place for env access so missing config fails loudly with a useful message.

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  appUrl: () => process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000",
  sessionSecret: () => req("SESSION_SECRET"),
  cronSecret: () => process.env.CRON_SECRET,
  twilio: () => ({
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM_NUMBER, // or a Messaging Service SID
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  }),
  resend: () => ({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM ?? "Saint Helen Liturgy <liturgy@sending.sainthelen.org>",
    replyTo: process.env.EMAIL_REPLY_TO ?? "liturgy@sainthelen.org",
  }),
  microsoft: () => ({
    tenantId: process.env.MS_TENANT_ID,
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
  }),
  anthropicKey: () => process.env.ANTHROPIC_API_KEY,
  parishName: () => process.env.PARISH_NAME ?? "Saint Helen",
  timezone: () => process.env.PARISH_TIMEZONE ?? "America/New_York",
  devOtpEcho: () => process.env.DEV_OTP_ECHO === "true", // prints codes to the server log when no SMS provider is configured
};
