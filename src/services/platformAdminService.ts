import { supabase } from "../lib/supabase";

export interface PlatformOverview {
  institute_count: number;
  student_count: number;
  team_member_count: number;
  owner_count: number;
  teacher_count: number;
  accountant_count: number;
  active_members_30d: number;
  active_subscriptions: number;
  suspended_institutes: number;
  database_bytes: number;
  storage_bytes_project_wide: number;
  storage_objects_project_wide: number;
  per_institute_storage_attribution: boolean;
  student_login_tracking_available: boolean;
}

export interface PlatformInstitute {
  institute_id: string;
  name: string;
  slug: string;
  created_at: string;
  student_count: number;
  owner_count: number;
  teacher_count: number;
  accountant_count: number;
  team_member_count: number;
  active_members_30d: number;
  active_owners_30d: number;
  active_teachers_30d: number;
  active_accountants_30d: number;
  last_active_date: string | null;
  access_status: "active" | "suspended";
  plan_code: string;
  subscription_status: "trial" | "active" | "past_due" | "expired" | "cancelled";
  starts_at: string | null;
  expires_at: string | null;
  student_limit: number | null;
  team_limit: number | null;
}

export interface PlatformInvitation {
  id: string;
  email: string;
  role: "owner" | "teacher" | "accountant";
  institute_id: string | null;
  institute_name: string | null;
  status: "Pending" | "Accepted" | "Revoked" | "Expired";
  expires_at: string;
  created_at: string;
}

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const getPlatformOverview = () => rpc<PlatformOverview>("platform_admin_overview");
export const listPlatformInstitutes = () => rpc<PlatformInstitute[]>("platform_admin_list_institutes");
export const listPlatformInvitations = () => rpc<PlatformInvitation[]>("platform_admin_list_invitations");

export async function createPlatformInvitation(input: {
  email: string;
  role: "owner" | "teacher" | "accountant";
  instituteId: string | null;
}) {
  const { data, error } = await supabase.functions.invoke("platform-admin-invitation", {
    body: { email: input.email, role: input.role, institute_id: input.instituteId },
  });
  if (error) throw error;
  if (!data?.action_link) throw new Error(data?.error ?? "Invitation link was not returned.");
  return data as { invitation_id: string; action_link: string; expires_at: string; requires_password_setup: boolean };
}

export const revokePlatformInvitation = (invitationId: string) =>
  rpc<void>("platform_admin_revoke_invitation", { p_invitation_id: invitationId });

export const savePlatformInstituteControls = (input: {
  instituteId: string;
  accessStatus: "active" | "suspended";
  planCode: string;
  subscriptionStatus: "trial" | "active" | "past_due" | "expired" | "cancelled";
  startsAt: string | null;
  expiresAt: string | null;
  studentLimit: number | null;
  teamLimit: number | null;
}) => rpc<void>("platform_admin_set_institute_controls", {
  p_institute_id: input.instituteId,
  p_access_status: input.accessStatus,
  p_plan_code: input.planCode,
  p_subscription_status: input.subscriptionStatus,
  p_starts_at: input.startsAt,
  p_expires_at: input.expiresAt,
  p_student_limit: input.studentLimit,
  p_team_limit: input.teamLimit,
});

export function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return value / (1024 ** index) >= 100
    ? (value / (1024 ** index)).toFixed(0) + " " + units[index]
    : (value / (1024 ** index)).toFixed(1) + " " + units[index];
}
