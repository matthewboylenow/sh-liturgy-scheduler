import { createRemoteJWKSet, jwtVerify } from "jose";
import { randomBytes, createHash } from "crypto";
import { env } from "./env";

/**
 * Minimal OpenID Connect (authorization code + PKCE) against Microsoft Entra ID.
 * Staff sign in with their work Microsoft 365 account; we match them to an existing
 * admin/coordinator by Entra object id or by email. No self-provisioning.
 */

export function microsoftConfigured() {
  const m = env.microsoft();
  return Boolean(m.tenantId && m.clientId && m.clientSecret);
}

function authority() {
  const { tenantId } = env.microsoft();
  return `https://login.microsoftonline.com/${tenantId}/v2.0`;
}

export function redirectUri() {
  return `${env.appUrl()}/api/auth/microsoft/callback`;
}

export function beginMicrosoft(next: string) {
  const { clientId } = env.microsoft();
  const state = randomBytes(16).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(`${authority()}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return { url: url.toString(), state, nonce, verifier, next };
}

export type MicrosoftIdentity = { oid: string; email: string | null; name: string | null };

export async function finishMicrosoft(code: string, verifier: string, nonce: string): Promise<MicrosoftIdentity> {
  const { clientId, clientSecret, tenantId } = env.microsoft();
  const res = await fetch(`${authority()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Microsoft token exchange failed: ${res.status} ${await res.text()}`);
  const tokens = (await res.json()) as { id_token: string };

  const jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`));
  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    audience: clientId,
  });
  if (payload.nonce !== nonce) throw new Error("Nonce mismatch");
  const email = (payload.email as string | undefined) ?? (payload.preferred_username as string | undefined) ?? null;
  return {
    oid: String(payload.oid),
    email: email ? email.toLowerCase() : null,
    name: (payload.name as string | undefined) ?? null,
  };
}
