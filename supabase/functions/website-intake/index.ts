import { createClient } from "npm:@supabase/supabase-js@2.110.0";

const corsHeaders = {
  "Access-Control-Allow-Headers": "apikey, content-type, x-client-info, x-site-client-ip",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function allowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (
      host === "development.classbandhu-website.pages.dev" ||
      host === "classbandhu-website.pages.dev" ||
      /^[a-f0-9]{8}\.classbandhu-website\.pages\.dev$/.test(host)
    );
  } catch { return false; }
}

function json(body: Record<string, unknown>, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), { status, headers: {
    ...corsHeaders, "Access-Control-Allow-Origin": origin, "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  }});
}
function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
async function hashIp(ip: string, secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret + "|website-intake|" + ip));
  return Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin") ?? "";
  if (request.method === "OPTIONS") {
    if (!allowedOrigin(origin)) return new Response("Origin not allowed.", { status: 403 });
    return new Response("ok", { headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin } });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, allowedOrigin(origin) ? origin : "null");
  if (!allowedOrigin(origin)) return json({ error: "Origin not allowed." }, 403, "null");

  const acceptedApiKeys = [Deno.env.get("SUPABASE_ANON_KEY"), Deno.env.get("SUPABASE_PUBLISHABLE_KEY")]
    .filter((value): value is string => Boolean(value));
  if (!acceptedApiKeys.includes(request.headers.get("apikey") ?? "")) {
    return json({ error: "Website integration credentials could not be verified." }, 401, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Website intake service is not configured." }, 503, origin);

  let body: Record<string, unknown>;
  try {
    if (Number(request.headers.get("Content-Length") ?? "0") > 16000) return json({ error: "Request is too large." }, 413, origin);
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid request." }, 400, origin);
    body = parsed as Record<string, unknown>;
  } catch { return json({ error: "Request must contain valid JSON." }, 400, origin); }

  const form = body.form && typeof body.form === "object" && !Array.isArray(body.form) ? body.form as Record<string, unknown> : body;
  if (clean(form.website, 120)) return json({ success: true, reference: "received" }, 201, origin);
  const requesterName = clean(form.requesterName, 100);
  const instituteName = clean(form.instituteName, 150);
  const email = clean(form.email, 254).toLowerCase();
  const phone = clean(form.phone, 30);
  const city = clean(form.city, 80);
  const message = clean(form.message, 1200);
  const ipHash = await hashIp(clean(request.headers.get("x-site-client-ip"), 100) || "unknown", serviceRoleKey);
  if (requesterName.length < 2 || instituteName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please enter your name, institute name and a valid email address." }, 400, origin);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  if (body.type === "access_request") {
    const requestedRole = clean(form.requestedRole, 20).toLowerCase();
    if (!["owner", "teacher", "accountant"].includes(requestedRole)) return json({ error: "Please select the account role you are requesting." }, 400, origin);
    const { data, error } = await admin.rpc("website_submit_access_request", {
      p_requester_name: requesterName, p_institute_name: instituteName, p_email: email, p_requested_role: requestedRole,
      p_phone: phone || null, p_city: city || null, p_message: message || null, p_ip_hash: ipHash,
    });
    if (error) return json({ error: error.message }, error.message.toLowerCase().includes("too many") ? 429 : 400, origin);
    return json({ success: true, reference: data?.reference ?? "" }, 201, origin);
  }
  if (body.type !== "inquiry") return json({ error: "Unknown website request type." }, 400, origin);
  const { data, error } = await admin.rpc("website_submit_inquiry", {
    p_requester_name: requesterName, p_institute_name: instituteName, p_email: email, p_phone: phone || null,
    p_city: city || null, p_enquiry_type: clean(form.enquiryType, 80),
    p_contact_preference: clean(form.contactPreference, 20) || "Email", p_message: message || null, p_ip_hash: ipHash,
  });
  if (error) return json({ error: error.message }, error.message.toLowerCase().includes("too many") ? 429 : 400, origin);
  return json({ success: true, reference: data?.reference ?? "" }, 201, origin);
});