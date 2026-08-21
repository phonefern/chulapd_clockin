import { NextRequest, NextResponse } from "next/server";
import { verifyLineWebhookSignature } from "@/lib/lineWebhookAuth";
import { replyLineMessage, liffUrl } from "@/lib/lineMessaging";

type LineEvent = {
  type: string;
  replyToken?: string;
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifyLineWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: LineEvent[] };

  for (const event of body.events ?? []) {
    if (event.type === "follow" && event.replyToken) {
      try {
        await replyLineMessage(
          event.replyToken,
          `ยินดีต้อนรับเข้าสู่ระบบลงเวลาทำงานครับ\nกดลิงก์นี้เพื่อ Clock in / Clock out\n${liffUrl()}`
        );
      } catch (err) {
        console.error("follow reply failed", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
