import { supabase } from "../lib/supabase";

export type LegalSlug = "privacy-policy" | "terms-of-service" | "data-processing-agreement" | "cookie-policy";
export type LegalStatus = "draft" | "published" | "archived";

export interface LegalDocument {
  id: string;
  slug: LegalSlug;
  title: string;
  version: string;
  locale: string;
  body_markdown: string;
  content_sha256: string;
  status: LegalStatus;
  is_required: boolean;
  is_test_only: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  effective_at: string | null;
  acceptance_count: number;
}

export interface LegalAcceptanceSummary {
  total_acceptance_events: number;
  users_missing_current_acceptance: number;
  recent_acceptances: Array<{
    user_email: string;
    document_slug: string;
    document_title: string;
    document_version: string;
    content_sha256: string;
    acceptance_scope: "user" | "institute";
    acceptance_method: string;
    institute_id: string | null;
    accepted_at: string;
  }>;
}

export interface RequiredLegalDocument {
  id: string;
  slug: LegalSlug;
  title: string;
  version: string;
  locale: string;
  content_sha256: string;
  is_test_only: boolean;
  body_markdown?: string;
}

export interface MyLegalStatus {
  required_documents: RequiredLegalDocument[];
  missing_document_slugs: string[];
}

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export async function getPublishedRequiredLegalDocuments(includeBody = false): Promise<RequiredLegalDocument[]> {
  const columns = includeBody
    ? "id,slug,title,version,locale,content_sha256,is_test_only,body_markdown"
    : "id,slug,title,version,locale,content_sha256,is_test_only";
  const { data, error } = await supabase
    .from("legal_documents")
    .select(columns)
    .eq("status", "published")
    .eq("locale", "en-IN")
    .in("slug", ["privacy-policy", "terms-of-service"])
    .eq("is_required", true)
    .order("slug", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as RequiredLegalDocument[];
}

export async function getPublishedLegalDocument(slug: LegalSlug): Promise<RequiredLegalDocument | null> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select("id,slug,title,version,locale,content_sha256,is_test_only,body_markdown")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("locale", "en-IN")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as RequiredLegalDocument | null;
}

export const getMyLegalStatus = () => rpc<MyLegalStatus>("get_my_legal_status");

export const acceptCurrentLegalDocuments = (method: "required_reacceptance" = "required_reacceptance") =>
  rpc<MyLegalStatus>("accept_current_legal_documents", {
    p_acceptance_method: method,
    p_user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
  });

export async function listPlatformLegalDocuments(): Promise<LegalDocument[]> {
  const result = await rpc<{ documents: LegalDocument[] }>("platform_admin_list_legal_documents");
  return result.documents ?? [];
}

export const getPlatformLegalAcceptanceSummary = () =>
  rpc<LegalAcceptanceSummary>("platform_admin_legal_acceptance_summary");

export interface LegalAdminAuditEvent {
  action: "DRAFT_CREATED" | "DRAFT_UPDATED" | "DOCUMENT_PUBLISHED" | "DOCUMENT_ARCHIVED";
  details: Record<string, unknown>;
  created_at: string;
  actor_email: string | null;
  document_slug: LegalSlug | null;
  document_title: string | null;
  document_version: string | null;
}

export const listPlatformLegalAdminAudit = (limit = 100) =>
  rpc<LegalAdminAuditEvent[]>("platform_admin_legal_audit_logs", { p_limit: limit });

export interface PlatformLegalAcceptanceRecord {
  id: string;
  user_email: string;
  document_slug: string;
  document_title: string;
  document_version: string;
  document_locale: string;
  content_sha256: string;
  acceptance_scope: "user" | "institute";
  institute_id: string | null;
  acceptance_method: string;
  user_agent: string | null;
  accepted_at: string;
}

export const exportPlatformLegalAcceptances = (limit = 10000) =>
  rpc<PlatformLegalAcceptanceRecord[]>("platform_admin_export_legal_acceptances", { p_limit: limit });

export const savePlatformLegalDocument = (input: {
  id?: string | null;
  slug: LegalSlug;
  title: string;
  version: string;
  locale: string;
  body: string;
  required: boolean;
  testOnly: boolean;
}) => rpc<string>("platform_admin_save_legal_document", {
  p_document_id: input.id ?? null,
  p_slug: input.slug,
  p_title: input.title,
  p_version: input.version,
  p_locale: input.locale,
  p_body_markdown: input.body,
  p_is_required: input.required,
  p_is_test_only: input.testOnly,
});

export const publishPlatformLegalDocument = (id: string) =>
  rpc<void>("platform_admin_publish_legal_document", {
    p_document_id: id,
    p_confirm_reviewed: true,
  });

export const archivePlatformLegalDocument = (id: string) =>
  rpc<void>("platform_admin_archive_legal_document", { p_document_id: id });

export interface PrivacyConsent {
  product_updates: boolean;
  updated_at: string | null;
  privacy_document_version: string | null;
}

export const getMyPrivacyConsents = () => rpc<PrivacyConsent>("get_my_privacy_consents");

export const setMyProductUpdateConsent = (granted: boolean) =>
  rpc<PrivacyConsent>("set_privacy_consent", { p_purpose: "product_updates", p_granted: granted });

export interface MyDpaRequirements {
  document: {
    id: string;
    title: string;
    version: string;
    locale: string;
    content_sha256: string;
    published_at: string;
    is_test_only: boolean;
  } | null;
  institutes: Array<{
    institute_id: string;
    institute_name: string;
    accepted: boolean;
    accepted_by: string | null;
    accepted_at: string | null;
  }>;
  missing_institute_ids: string[];
}

export const getMyDpaRequirements = () => rpc<MyDpaRequirements>("get_my_dpa_requirements");

export interface InstituteDpaStatus {
  document: { id: string; title: string; version: string; content_sha256: string; published_at: string } | null;
  accepted: boolean;
  accepted_by?: string | null;
  accepted_at?: string | null;
}

export const getInstituteDpaStatus = (instituteId: string) =>
  rpc<InstituteDpaStatus>("get_institute_dpa_status", { p_institute_id: instituteId });

export const acceptInstituteDpa = (instituteId: string) =>
  rpc<InstituteDpaStatus>("accept_current_institute_dpa", {
    p_institute_id: instituteId,
    p_user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
  });

export interface UserLegalAcceptance {
  user_email: string;
  document_title: string;
  document_slug: string;
  document_version: string;
  content_sha256: string;
  acceptance_method: string;
  accepted_at: string;
}

export async function listMyLegalAcceptances(): Promise<UserLegalAcceptance[]> {
  const { data, error } = await supabase
    .from("user_legal_acceptances")
    .select("user_email,document_title,document_slug,document_version,content_sha256,acceptance_method,accepted_at")
    .eq("acceptance_scope", "user")
    .order("accepted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserLegalAcceptance[];
}
