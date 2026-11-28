import { createClient } from "npm:@supabase/supabase-js@2.110.0";

const allowedOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" &&
      (url.hostname === "development--tuition-ms.netlify.app" ||
        /^[a-z0-9-]+--tuition-ms\\.netlify\\.app$/.test(url.hostname));
  } catch {
    return false;
  }
};

function json(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "Vary": "Origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin") ?? "";
  if (!allowedOrigin(origin)) return json({ error: "Origin not allowed." }, 403, "null");
  if (request.method === "OPTIONS") return new Response("ok", {
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Demo access service is not configured." }, 503, origin);

  let body: Record<string, unknown>;
  try {
    if (Number(request.headers.get("Content-Length") ?? "0") > 4000) {
      return json({ error: "Request is too large." }, 413, origin);
    }
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return json({ error: "Invalid request." }, 400, origin);
    }
    body = value as Record<string, unknown>;
  } catch {
    return json({ error: "Request must contain valid JSON." }, 400, origin);
  }

  const forwardedFor = request.headers.get("x-forwarded-for") ?? "unknown";
  const clientIp = forwardedFor.split(",")[0].trim().slice(0, 100) || "unknown";
  const ipHash = await sha256(serviceRoleKey + "|classbandhu-demo-access|" + clientIp);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (body.action === "activate") {
    const token = typeof body.token === "string" ? body.token.trim().toLowerCase() : "";
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return json({ error: "This demo invitation is invalid or expired." }, 400, origin);
    }
    const tokenHash = await sha256(token);
    const { data, error } = await admin.rpc("website_demo_activate", {
      p_token_hash: tokenHash,
      p_ip_hash: ipHash,
    });
    if (error || !data?.session_token) {
      return json({ error: "This demo invitation is invalid, expired, already used or temporarily rate-limited." }, 403, origin);
    }
    return json({
      success: true,
      sessionToken: data.session_token,
      expiresAt: data.expires_at,
    }, 200, origin);
  }

  if (body.action === "validate") {
    const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken.trim().toLowerCase() : "";
    if (!/^[a-f0-9]{64}$/.test(sessionToken)) {
      return json({ valid: false }, 200, origin);
    }
    const sessionHash = await sha256(sessionToken);
    const { data, error } = await admin.rpc("website_demo_validate", {
      p_session_hash: sessionHash,
      p_ip_hash: ipHash,
    });
    if (error) return json({ error: "Demo session could not be verified." }, 503, origin);
    return json({
      valid: data?.valid === true,
      expiresAt: data?.expires_at ?? null,
      extensionAvailable: data?.extension_available === true,
    }, 200, origin);
  }

  return json({ error: "Unknown demo access action." }, 400, origin);
});
