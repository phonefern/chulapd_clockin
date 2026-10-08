import type { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hashLinkToken, newLinkToken } from "@/lib/signedUrl";

type Supabase = ReturnType<typeof getSupabaseAdmin>;

export const APPROVAL_LINK_TTL_DAYS = 14;

export type ApprovalLink = {
  id: string;
  report_month: string;
  employee_ids: string[];
  approver_name: string;
  approver_role: string;
  created_by_email: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export const APPROVAL_LINK_COLUMNS =
  "id, report_month, employee_ids, approver_name, approver_role, created_by_email, expires_at, revoked_at, created_at";

export function approvalLinkUrl(origin: string, token: string) {
  return `${origin}/approve/${token}`;
}

export async function createApprovalLink(
  supabase: Supabase,
  input: {
    month: string;
    employeeIds: string[];
    approverName: string;
    approverRole: string;
    createdBy: string;
    createdByEmail: string | null;
  }
): Promise<{ token: string; link: ApprovalLink }> {
  const token = newLinkToken();
  const { data, error } = await supabase
    .from("report_approval_links")
    .insert({
      token_hash: hashLinkToken(token),
      report_month: input.month,
      employee_ids: input.employeeIds,
      approver_name: input.approverName,
      approver_role: input.approverRole,
      created_by: input.createdBy,
      created_by_email: input.createdByEmail,
      expires_at: new Date(Date.now() + APPROVAL_LINK_TTL_DAYS * 86400_000).toISOString(),
    })
    .select(APPROVAL_LINK_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "สร้างลิงก์ไม่สำเร็จ");
  return { token, link: data as ApprovalLink };
}

export type ResolvedLink =
  | { ok: true; link: ApprovalLink }
  | { ok: false; reason: "not_found" | "expired" | "revoked" };

export async function resolveApprovalLink(supabase: Supabase, token: string): Promise<ResolvedLink> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { ok: false, reason: "not_found" };
  const { data, error } = await supabase
    .from("report_approval_links")
    .select(APPROVAL_LINK_COLUMNS)
    .eq("token_hash", hashLinkToken(token))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ok: false, reason: "not_found" };
  const link = data as ApprovalLink;
  if (link.revoked_at) return { ok: false, reason: "revoked" };
  if (new Date(link.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, link };
}

export async function listActiveApprovalLinks(supabase: Supabase, month: string): Promise<ApprovalLink[]> {
  const { data, error } = await supabase
    .from("report_approval_links")
    .select(APPROVAL_LINK_COLUMNS)
    .eq("report_month", month)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApprovalLink[];
}
