import { supabase } from "../lib/supabase";

export type WebsiteInquiryStatus = "new" | "contacted" | "demo_scheduled" | "closed";
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
