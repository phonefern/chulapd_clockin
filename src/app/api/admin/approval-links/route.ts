import { NextRequest, NextResponse } from "next/server";
import { requestOrigin } from "@/lib/appUrl";
import { approvalLinkUrl, createApprovalLink } from "@/lib/approvalLinks";
import { getAdminSessionFromRequest } from "@/lib/requireAdminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidWorkMonth } from "@/lib/workDate";

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Creates a shareable link a supervisor can open (no login) to approve the selected reports.
export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const approverName = cleanText(body.approverName, 120);
  const approverRole = cleanText(body.approverRole, 120);
  const { month, employeeIds } = body;

  if (typeof month !== "string" || !isValidWorkMonth(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }
  if (!Array.isArray(employeeIds) || employeeIds.length === 0 || !employeeIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "กรุณาเลือกพนักงานอย่างน้อย 1 คน" }, { status: 400 });
  }
  if (!approverName || !approverRole) {
    return NextResponse.json({ error: "กรุณากรอกชื่อและตำแหน่งผู้รับรอง" }, { status: 400 });
  }

  try {
    const { token, link } = await createApprovalLink(getSupabaseAdmin(), {
      month,
      employeeIds,
      approverName,
      approverRole,
      createdBy: session.adminUserId,
      createdByEmail: session.email || null,
    });
    return NextResponse.json({ url: approvalLinkUrl(await requestOrigin(), token), link });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "สร้างลิงก์ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
