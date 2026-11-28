import { createClient } from "npm:@supabase/supabase-js@2.110.0";

const responseHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function jsonResponse(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...responseHeaders, "Access-Control-Allow-Origin": origin, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  const appUrl = "https://development--tuition-ms.netlify.app"; // Fixed Development Super Admin origin.

  let allowedOrigin: string;
  try {
    allowedOrigin = new URL(appUrl).origin;
  } catch {
    return jsonResponse({ error: "EDULEDGER_APP_URL must be a valid URL." }, 500, "null");
  }

  const requestOrigin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: { ...responseHeaders, "Access-Control-Allow-Origin": allowedOrigin } });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, allowedOrigin);
  if (requestOrigin && requestOrigin !== allowedOrigin) return jsonResponse({ error: "Origin not allowed." }, 403, allowedOrigin);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "Authentication required." }, 401, allowedOrigin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return jsonResponse({ error: "The Supabase function environment is incomplete." }, 500, allowedOrigin);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userResult, error: userError } = await userClient.auth.getUser();
  if (userError || !userResult.user) return jsonResponse({ error: "Sign-in session could not be verified." }, 401, allowedOrigin);

  const { data: isAdmin, error: adminError } = await userClient.rpc("is_platform_admin");
  if (adminError || isAdmin !== true) {
    console.error("[platform-admin-invitation] admin_check_failed", {
      code: adminError?.code ?? null,
      message: adminError?.message ?? null,
      isAdmin: isAdmin === true,
    });
    return jsonResponse({ error: "Platform administrator access is required." }, 403, allowedOrigin);
  }

  let body: { email?: unknown; role?: unknown; institute_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400, allowedOrigin);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" ? body.role : "";
  const instituteId = typeof body.institute_id === "string" && body.institute_id.trim() ? body.institute_id.trim() : null;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const roleValid = ["owner", "teacher", "accountant"].includes(role);
  const instituteScopeValid = role === "owner" || Boolean(instituteId);
  if (!email || !emailValid || !roleValid || !instituteScopeValid) {
    console.error("[platform-admin-invitation] input_validation_failed", {
      emailPresent: Boolean(email),
      emailValid,
      roleValid,
      instituteScopeValid,
      hasInstituteId: Boolean(instituteId),
    });
    if (!email || !emailValid) return jsonResponse({ error: "Enter a valid email address." }, 400, allowedOrigin);
    if (!roleValid) return jsonResponse({ error: "Select a valid role." }, 400, allowedOrigin);
    return jsonResponse({ error: "Teacher and accountant invitations require an institute." }, 400, allowedOrigin);
  }

  const { data: invitation, error: invitationError } = await userClient.rpc("platform_admin_create_invitation", {
    p_email: email,
    p_role: role,
    p_institute_id: instituteId,
  });
  if (invitationError) {
    console.error("[platform-admin-invitation] invitation_rpc_failed", {
      code: invitationError.code ?? null,
      message: invitationError.message ?? null,
      details: invitationError.details ?? null,
      hint: invitationError.hint ?? null,
    });
    return jsonResponse({ error: invitationError.message ?? "Invitation could not be created." }, 400, allowedOrigin);
  }
  if (!invitation?.raw_token || !invitation?.invitation_id) {
    console.error("[platform-admin-invitation] invitation_rpc_unexpected_result", {
      hasData: Boolean(invitation),
      hasRawToken: Boolean(invitation?.raw_token),
      hasInvitationId: Boolean(invitation?.invitation_id),
      dataType: typeof invitation,
    });
    return jsonResponse({ error: "Invitation service returned an incomplete result." }, 502, allowedOrigin);
  }

  const redirectUrl = new URL("/accept-platform-invitation", appUrl);
  redirectUrl.searchParams.set("token", invitation.raw_token);

  let inviteKind: "invite" | "magiclink" = "invite";
  redirectUrl.searchParams.set("setup", "1");
  let generated = await adminClient.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: redirectUrl.toString() },
  });

  if (generated.error && /already registered|already been registered|user already exists/i.test(generated.error.message)) {
    inviteKind = "magiclink";
    redirectUrl.searchParams.set("setup", "0");
    generated = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: redirectUrl.toString() },
    });
  }

  const actionLink = generated.data?.properties?.action_link;
  if (generated.error || !actionLink) {
    console.error("[platform-admin-invitation] auth_link_generation_failed", {
      code: generated.error?.status ?? null,
      message: generated.error?.message ?? null,
      hasActionLink: Boolean(actionLink),
    });
    const { error: revokeError } = await userClient.rpc("platform_admin_revoke_invitation", { p_invitation_id: invitation.invitation_id });
    if (revokeError) {
      console.error("[platform-admin-invitation] invitation_revoke_after_link_failure_failed", {
        code: revokeError.code ?? null,
        message: revokeError.message ?? null,
      });
    }
    return jsonResponse({ error: generated.error?.message ?? "Supabase did not return an action link." }, 502, allowedOrigin);
  }

  // Supabase Auth can fall back to Site URL when a redirect target is not
  // allowlisted. Never expose an action link carrying a preview/incorrect URL.
  let generatedRedirect: URL | null = null;
  try {
    const linkUrl = new URL(actionLink);
    const redirectParam = linkUrl.searchParams.get("redirect_to");
    if (redirectParam) generatedRedirect = new URL(redirectParam);
  } catch {
    generatedRedirect = null;
  }

  const expectedSetup = inviteKind === "invite" ? "1" : "0";
  const redirectIsCorrect = generatedRedirect !== null
    && generatedRedirect.origin === allowedOrigin
    && generatedRedirect.pathname === "/accept-platform-invitation"
    && Boolean(generatedRedirect.searchParams.get("token"))
    && generatedRedirect.searchParams.get("setup") === expectedSetup;

  if (!redirectIsCorrect) {
    console.error("[platform-admin-invitation] auth_redirect_mismatch", {
      expectedOrigin: allowedOrigin,
      actualOrigin: generatedRedirect?.origin ?? null,
      actualPath: generatedRedirect?.pathname ?? null,
      hasInvitationToken: Boolean(generatedRedirect?.searchParams.get("token")),
      setupMatches: generatedRedirect?.searchParams.get("setup") === expectedSetup,
    });
    const { error: revokeError } = await userClient.rpc("platform_admin_revoke_invitation", { p_invitation_id: invitation.invitation_id });
    if (revokeError) {
      console.error("[platform-admin-invitation] invitation_revoke_after_redirect_mismatch_failed", {
        code: revokeError.code ?? null,
        message: revokeError.message ?? null,
      });
    }
    return jsonResponse({
      error: "Supabase Auth is not allowing the Development invitation redirect yet. Add https://development--tuition-ms.netlify.app/accept-platform-invitation* to Auth Redirect URLs, set Auth Site URL to https://development--tuition-ms.netlify.app, and retry.",
    }, 409, allowedOrigin);
  }

  return jsonResponse({
    invitation_id: invitation.invitation_id,
    action_link: actionLink,
    expires_at: invitation.expires_at,
    requires_password_setup: inviteKind === "invite",
  }, 200, allowedOrigin);
});
