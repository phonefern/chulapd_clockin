import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { getNotYetClockedInToday } from "@/lib/attendanceCronTargets";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { pushLineMessage, liffUrl } from "@/lib/lineMessaging";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  let result;
  try {
    result = await getNotYetClockedInToday(supabase);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load cron targets" },
      { status: 500 }
    );
  }

  const link = liffUrl();

  let sent = 0;
  let lastError: string | null = null;
  for (const employee of result.targets) {
    try {
      await pushLineMessage(
        employee.lineUserId,
        `สวัสดีค่ะ/ครับ คุณ${employee.displayName ?? employee.name}\nวันนี้ยังไม่ได้ Clock in นะครับ กดลิงก์นี้เพื่อลงเวลา\n${link}`
      );
      sent++;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error("late-clock-in push failed for", employee.id, err);
    }
  }

  // Surface a total LINE failure (e.g. monthly quota exhausted, bad token) as a
  // non-2xx so the scheduler records a failed execution instead of a silent success.
  if (result.targets.length > 0 && sent === 0) {
    return NextResponse.json(
      { ok: false, checked: result.checked, targets: result.targets.length, sent, error: lastError },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, checked: result.checked, sent });
}
