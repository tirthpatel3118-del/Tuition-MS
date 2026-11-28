import { supabase } from "../lib/supabase";

export type WebsiteInquiryStatus = "new" | "reviewing" | "contacted" | "demo_scheduled" | "approved" | "rejected" | "link_generated" | "closed";
export type WebsiteAccessStatus = "new" | "reviewing" | "approved" | "rejected" | "closed";
export type WebsiteRequestedRole = "owner" | "teacher" | "accountant";

export interface WebsiteInquiry {
  id: string;
  reference_code: string;
  requester_name: string;
  institute_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  enquiry_type: string;
  contact_preference: string;
  message: string | null;
  student_count: number | null;
  status: WebsiteInquiryStatus;
  admin_notes: string;
  notification_status: string;
  created_at: string;
  updated_at: string;
}

export interface WebsiteAccessRequest {
  id: string;
  reference_code: string;
  requester_name: string;
  institute_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  requested_role: WebsiteRequestedRole;
  message: string | null;
  status: WebsiteAccessStatus;
  admin_notes: string;
  linked_invitation_id: string | null;
  notification_status: string;
  created_at: string;
  updated_at: string;
}


export interface WebsiteDemoRequest {
  id: string;
  reference_code: string;
  requester_name: string;
  institute_name: string;
  email: string;
  phone: string | null;
  student_count: number | null;
  message: string | null;
  status: string;
  admin_notes: string;
  created_at: string;
  updated_at: string;
  demo_access_id: string | null;
  link_expires_at: string | null;
  duration_minutes: number | null;
  activated_at: string | null;
  session_expires_at: string | null;
  extended_at: string | null;
  revoked_at: string | null;
  demo_status: "new" | "reviewing" | "approved" | "rejected" | "link_generated" | "active" | "expired" | "revoked";
}

export interface WebsiteDemoActivity {
  id: string;
  inquiry_id: string;
  demo_access_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  reference_code: string;
  requester_name: string;
  institute_name: string;
  actor_email: string | null;
}

export interface WebsiteDemoSession {
  demo_access_id: string;
  inquiry_id: string;
  reference_code: string;
  requester_name: string;
  institute_name: string;
  email: string;
  link_expires_at: string;
  duration_minutes: number;
  activated_at: string | null;
  session_expires_at: string | null;
  extended_at: string | null;
  revoked_at: string | null;
  created_at: string;
  status: "link_generated" | "active" | "expired" | "revoked";
}

export interface WebsiteNotification {
  id: string;
  notification_type: string;
  related_type: "inquiry" | "access_request";
  related_id: string;
  reference_code: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface WebsiteSummary {
  total_inquiries: number;
  new_inquiries: number;
  open_inquiries: number;
  total_access_requests: number;
  new_access_requests: number;
  unread_notifications: number;
}

async function websiteRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const getWebsiteSummary = () =>
  websiteRpc<WebsiteSummary>("platform_admin_website_summary");

export const listWebsiteInquiries = (search = "", status = "all") =>
  websiteRpc<WebsiteInquiry[]>("platform_admin_website_list_inquiries", {
    p_search: search || null,
    p_status: status,
    p_limit: 200,
    p_offset: 0,
  });

export const listWebsiteAccessRequests = (search = "", status = "all") =>
  websiteRpc<WebsiteAccessRequest[]>("platform_admin_website_list_access_requests", {
    p_search: search || null,
    p_status: status,
    p_limit: 200,
    p_offset: 0,
  });

export const updateWebsiteInquiry = (inquiryId: string, status: WebsiteInquiryStatus, adminNotes: string) =>
  websiteRpc<void>("platform_admin_website_update_inquiry", {
    p_inquiry_id: inquiryId,
    p_status: status,
    p_admin_notes: adminNotes,
  });

export const updateWebsiteAccessRequest = (
  requestId: string,
  status: WebsiteAccessStatus,
  adminNotes: string,
  invitationId: string | null = null,
) =>
  websiteRpc<void>("platform_admin_website_update_access_request", {
    p_request_id: requestId,
    p_status: status,
    p_admin_notes: adminNotes,
    p_invitation_id: invitationId,
  });

export const listWebsiteNotifications = (unreadOnly = false) =>
  websiteRpc<WebsiteNotification[]>("platform_admin_website_list_notifications", {
    p_unread_only: unreadOnly,
  });

export const markWebsiteNotificationRead = (notificationId: string) =>
  websiteRpc<void>("platform_admin_website_mark_notification_read", {
    p_notification_id: notificationId,
  });

export const listWebsiteDemoRequests = () =>
  websiteRpc<WebsiteDemoRequest[]>("platform_admin_demo_list_requests");

export const listWebsiteDemoSessions = () =>
  websiteRpc<WebsiteDemoSession[]>("platform_admin_demo_list_sessions");

export const updateWebsiteDemoRequest = (
  inquiryId: string,
  status: "reviewing" | "approved" | "rejected",
  adminNotes: string,
) => websiteRpc<void>("platform_admin_demo_update_request", {
  p_inquiry_id: inquiryId,
  p_status: status,
  p_admin_notes: adminNotes,
});

export const issueWebsiteDemoAccess = (inquiryId: string) =>
  websiteRpc<{ access_id: string; token: string; link_expires_at: string; duration_minutes: number }>(
    "platform_admin_demo_issue_access",
    { p_inquiry_id: inquiryId },
  );

export const extendWebsiteDemoSession = (accessId: string) =>
  websiteRpc<string>("platform_admin_demo_extend", { p_demo_access_id: accessId });

export const revokeWebsiteDemoSession = (accessId: string) =>
  websiteRpc<void>("platform_admin_demo_revoke", { p_demo_access_id: accessId });

export const listWebsiteDemoActivity = () =>
  websiteRpc<WebsiteDemoActivity[]>("platform_admin_demo_list_activity");
