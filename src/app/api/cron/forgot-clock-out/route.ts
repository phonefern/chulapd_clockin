import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { getClockedInNotOutToday } from "@/lib/attendanceCronTargets";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { pushLineMessage, liffUrl } from "@/lib/lineMessaging";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  let result;
  try {
    result = await getClockedInNotOutToday(supabase);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load cron targets" },
      { status: 500 }
    );
  }

  const link = liffUrl();
  let sent = 0;

  for (const employee of result.targets) {
    try {
      await pushLineMessage(
        employee.lineUserId,
        `สวัสดีค่ะ/ครับ คุณ${employee.displayName ?? employee.name}\nวันนี้ Clock in แล้วแต่ยังไม่ได้ Clock out นะครับ กดลิงก์นี้เพื่อลงเวลาออก\n${link}`
      );
      sent++;
    } catch (err) {
      console.error("forgot-clock-out push failed for", employee.id, err);
    }
  }

  return NextResponse.json({ ok: true, checked: result.checked, sent });
}
