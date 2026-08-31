import { NextRequest, NextResponse } from "next/server";
import { getEmployeeMonthSummary, getEmployeeTodayStatus } from "@/lib/attendanceStats";
import {
  formatHelpReply,
  formatMonthDailyLedgerReply,
  formatMonthSummaryReply,
  formatNotRegisteredReply,
  formatTodayStatusReply,
} from "@/lib/lineReplyText";
import { verifyLineWebhookSignature } from "@/lib/lineWebhookAuth";
import { replyLineMessage, liffUrl } from "@/lib/lineMessaging";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMonthInBangkok } from "@/lib/workDate";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: {
    userId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
};

type EmployeeRow = {
  id: string;
  name: string;
  display_name: string | null;
};

function wantsTodayStatus(text: string) {
  return text.includes("วันนี้") || text.includes("สถานะ");
}

function wantsMonthSummary(text: string) {
  return text.includes("เดือนนี้") || text.includes("ชั่วโมง");
}

function wantsMonthDailyLedger(text: string) {
  return text.includes("สรุป");
}

async function handleLineEvent(event: LineEvent) {
  if (event.type === "follow" && event.replyToken) {
    await replyLineMessage(
      event.replyToken,
      `ยินดีต้อนรับเข้าสู่ระบบลงเวลาทำงานครับ\nกดลิงก์นี้เพื่อ Clock in / Clock out\n${liffUrl()}`
    );
    return;
  }

  // This branch only handles incoming LINE message events, never our outgoing replies.
  if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const lineUserId = event.source?.userId;
  const { data: employee } = lineUserId
    ? await supabase
        .from("employees")
        .select("id, name, display_name")
        .eq("line_user_id", lineUserId)
        .eq("active", true)
        .maybeSingle()
    : { data: null };

  if (!employee) {
    await replyLineMessage(event.replyToken, formatNotRegisteredReply(liffUrl()));
    return;
  }

  const employeeRow = employee as EmployeeRow;
  const displayName = employeeRow.display_name ?? employeeRow.name;
  const text = event.message.text?.trim().toLocaleLowerCase("th-TH") ?? "";

  if (wantsTodayStatus(text)) {
    const todayStatus = await getEmployeeTodayStatus(supabase, employeeRow.id);
    await replyLineMessage(event.replyToken, formatTodayStatusReply(displayName, todayStatus));
    return;
  }

  if (wantsMonthDailyLedger(text)) {
    const month = currentMonthInBangkok();
    const summary = await getEmployeeMonthSummary(supabase, employeeRow.id, month);
    await replyLineMessage(event.replyToken, formatMonthDailyLedgerReply(displayName, month, summary));
    return;
  }

  if (wantsMonthSummary(text)) {
    const month = currentMonthInBangkok();
    const summary = await getEmployeeMonthSummary(supabase, employeeRow.id, month);
    await replyLineMessage(event.replyToken, formatMonthSummaryReply(displayName, month, summary));
    return;
  }

  await replyLineMessage(event.replyToken, formatHelpReply(liffUrl()));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifyLineWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: LineEvent[] };

  for (const event of body.events ?? []) {
    try {
      await handleLineEvent(event);
    } catch (err) {
      console.error("LINE event handling failed", err);
    }
  }

  return NextResponse.json({ ok: true });
}
