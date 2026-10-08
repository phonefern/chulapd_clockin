import { NextRequest, NextResponse } from "next/server";
import { requestOrigin } from "@/lib/appUrl";
import { getAdminSessionFromRequest } from "@/lib/requireAdminSession";
import { renderApprovedReportPdf } from "@/lib/reportPdf";
import { verifySignedQuery } from "@/lib/signedUrl";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Chromium cold start + render can take several seconds on Vercel.
export const maxDuration = 60;

// PDF of a certified report. Allowed for a signed-in admin, or via a signed link
// (sent to the employee on LINE and opened in the phone's browser, without a session).
export async function GET(req: NextRequest, { params }: { params: Promise<{ approvalId: string }> }) {
  const { approvalId } = await params;
  const signed = verifySignedQuery("report-pdf", approvalId, {
    exp: req.nextUrl.searchParams.get("exp"),
    sig: req.nextUrl.searchParams.get("sig"),
  });
  if (!signed && !(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: "ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาเปิดจากแอปอีกครั้ง" }, { status: 403 });
  }

  const { data: approval } = await getSupabaseAdmin()
    .from("attendance_report_approvals")
    .select("id, verification_id")
    .eq("id", approvalId)
    .maybeSingle();
  if (!approval) {
    return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });
  }

  try {
    const pdf = await renderApprovedReportPdf(await requestOrigin(), approvalId);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${approval.verification_id}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("report PDF render failed", approvalId, err);
    return NextResponse.json({ error: "สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
