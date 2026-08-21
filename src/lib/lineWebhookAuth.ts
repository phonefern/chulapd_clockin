import crypto from "crypto";

export function verifyLineWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const hash = crypto
    .createHmac("sha256", process.env.LINE_MESSAGING_CHANNEL_SECRET!)
    .update(rawBody)
    .digest("base64");
  return hash === signature;
}
