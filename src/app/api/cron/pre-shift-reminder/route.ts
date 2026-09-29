import { NextRequest, NextResponse } from "next/server";
import {
  getClockedInNotOutToday,
  getNotYetClockedInToday,
  type EmployeeTarget,
} from "@/lib/attendanceCronTargets";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { pushLineMessage, liffUrl } from "@/lib/lineMessaging";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  WORK_END_HOUR,
  WORK_END_MINUTE,
  WORK_START_HOUR,
  WORK_START_MINUTE,
} from "@/lib/workSchedule";

type Phase = "start" | "end";

function parsePhase(value: string | null): Phase | null {
  return value === "start" || value === "end" ? value : null;
}

function formatScheduleTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function reminderText(phase: Phase, employee: EmployeeTarget) {
  const link = liffUrl();
  const displayName = employee.displayName ?? employee.name;

  if (phase === "start") {
    return [
      `สวัสดีค่ะ/ครับ คุณ${displayName}`,
      `อีก 10 นาทีจะถึงเวลาทำงาน (${formatScheduleTime(WORK_START_HOUR, WORK_START_MINUTE)} น.) นะครับ`,
      "กดลิงก์นี้เพื่อ Clock in",
      link,
    ].join("\n");
  }

  return [
    `สวัสดีค่ะ/ครับ คุณ${displayName}`,
    `อีก 10 นาทีจะถึงเวลาเลิกงาน (${formatScheduleTime(WORK_END_HOUR, WORK_END_MINUTE)} น.) นะครับ`,
    "อย่าลืม Clock out ก่อนกลับ",
    link,
  ].join("\n");
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phase = parsePhase(req.nextUrl.searchParams.get("phase"));
  if (!phase) {
    return NextResponse.json({ error: "phase must be start or end" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let result;
  try {
    result =
      phase === "start"
        ? await getNotYetClockedInToday(supabase)
        : await getClockedInNotOutToday(supabase);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load cron targets" },
      { status: 500 }
    );
  }

  let sent = 0;
  let lastError: string | null = null;
  for (const employee of result.targets) {
    try {
      await pushLineMessage(employee.lineUserId, reminderText(phase, employee));
      sent++;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`pre-shift-reminder ${phase} push failed for`, employee.id, err);
    }
  }

  // Surface a total LINE failure (e.g. monthly quota exhausted, bad token) as a
  // non-2xx so the scheduler records a failed execution instead of a silent success.
  if (result.targets.length > 0 && sent === 0) {
    return NextResponse.json(
      { ok: false, phase, checked: result.checked, targets: result.targets.length, sent, error: lastError },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    phase,
    checked: result.checked,
    skippedOnLeave: result.skippedOnLeave,
    sent,
  });
}
