export type LineIdTokenPayload = {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  name?: string;
  picture?: string;
  email?: string;
};

export class LineVerifyError extends Error {}

export async function verifyLineIdToken(idToken: string): Promise<LineIdTokenPayload> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: process.env.LINE_CHANNEL_ID!,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new LineVerifyError(data.error_description ?? "LINE ID token verification failed");
  }

  return data as LineIdTokenPayload;
}
