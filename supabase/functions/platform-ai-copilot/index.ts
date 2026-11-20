import { createClient } from "npm:@supabase/supabase-js@2.110.0";
const headers = { "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
function response(body: Record<string, unknown>, status: number, origin: string) { return new Response(JSON.stringify(body), { status, headers: { ...headers, "Access-Control-Allow-Origin": origin, "Content-Type": "application/json" } }); }
Deno.serve(async (req) => {
 const appUrl = Deno.env.get("EDULEDGER_APP_URL");
 if (!appUrl) return response({ error: "EDULEDGER_APP_URL is not configured." }, 500, "null");
 let allowedOrigin = ""; try { allowedOrigin = new URL(appUrl).origin; } catch { return response({ error: "EDULEDGER_APP_URL must be a valid URL." }, 500, "null"); }
 if (req.method === "OPTIONS") return new Response("ok", { headers: { ...headers, "Access-Control-Allow-Origin": allowedOrigin } });
 if (req.method !== "POST") return response({ error: "Method not allowed." }, 405, allowedOrigin);
 const origin = req.headers.get("origin") ?? ""; if (origin && origin !== allowedOrigin) return response({ error: "Origin not allowed." }, 403, allowedOrigin);
 const authorization = req.headers.get("Authorization"); if (!authorization?.startsWith("Bearer ")) return response({ error: "Authentication required." }, 401, allowedOrigin);
 const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if (!url || !anon || !service) return response({ error: "Supabase function environment is incomplete." }, 500, allowedOrigin);
 const userClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: authorization } } });
 const adminClient = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
 const { data: userData, error: userError } = await userClient.auth.getUser(); if (userError || !userData.user) return response({ error: "Session could not be verified." }, 401, allowedOrigin);
 const { data: allowed, error: permissionError } = await userClient.rpc("is_platform_admin"); if (permissionError || allowed !== true) return response({ error: "Platform administrator access is required." }, 403, allowedOrigin);
 let body: { action?: unknown; prompt?: unknown }; try { body = await req.json(); } catch { return response({ error: "Request body must be valid JSON." }, 400, allowedOrigin); }
 const action = typeof body.action === "string" ? body.action : "ask", apiKey = Deno.env.get("OPENAI_API_KEY"), model = Deno.env.get("OPENAI_MODEL") ?? "gpt-5-mini";
 if (action === "status") return response({ configured: Boolean(apiKey), model, status: apiKey ? "ready" : "awaiting_api_key" }, 200, allowedOrigin);
 if (action !== "ask") return response({ error: "Unsupported action." }, 400, allowedOrigin);
 const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""; if (!prompt || prompt.length > 2000) return response({ error: "Enter a question of 1–2,000 characters." }, 400, allowedOrigin);
 if (!apiKey) return response({ error: "OpenAI is not connected yet. Add OPENAI_API_KEY as a Supabase Edge Function secret in the development project, then retry.", code: "OPENAI_NOT_CONFIGURED" }, 503, allowedOrigin);
 const recent = await adminClient.rpc("platform_ai_count_recent_requests", { p_actor_id: userData.user.id });
 if (recent.error) return response({ error: "AI usage guard could not be verified. Request blocked for safety." }, 503, allowedOrigin);
 if (Number(recent.data ?? 0) >= 20) return response({ error: "Usage limit reached: 20 requests per administrator per hour. Try again later.", code: "RATE_LIMITED" }, 429, allowedOrigin);
 const [overview, billing] = await Promise.all([userClient.rpc("platform_admin_overview"), userClient.rpc("platform_admin_billing_overview")]);
 if (overview.error || billing.error) return response({ error: "Could not load approved platform metrics." }, 502, allowedOrigin);
 const instructions = "You are EduLedger's private Super Admin copilot. Answer only from the supplied aggregate platform metrics. Do not invent figures or claim access to individual institute student records, personal data, fees, attendance, or message contents. If a requested detail is unavailable, say so. Be concise and practical. You cannot perform actions or change data.";
 let result: Response;
 try { result = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ model, instructions, input: "Approved aggregate context:\n" + JSON.stringify({ platform: overview.data, billing: billing.data }) + "\n\nAdministrator question:\n" + prompt, max_output_tokens: 700 }) }); }
 catch { await adminClient.rpc("platform_ai_log_usage", { p_actor_id:userData.user.id,p_model:model,p_input_tokens:0,p_output_tokens:0,p_total_tokens:0,p_status:"failed",p_error_code:"OPENAI_NETWORK" }); return response({ error: "Could not reach OpenAI. Please retry later." }, 502, allowedOrigin); }
 const payload = await result.json().catch(() => ({}));
 if (!result.ok) { await adminClient.rpc("platform_ai_log_usage", { p_actor_id:userData.user.id,p_model:model,p_input_tokens:0,p_output_tokens:0,p_total_tokens:0,p_status:"failed",p_error_code:"OPENAI_" + result.status }); return response({ error: "OpenAI request failed (" + result.status + "). Check the development API key, model access and billing." }, 502, allowedOrigin); }
 const answer = Array.isArray(payload.output) ? payload.output.flatMap((item: any) => Array.isArray(item.content) ? item.content : []).filter((item: any) => item.type === "output_text").map((item: any) => item.text).join("\n") : "";
 const usage = payload.usage ?? {};
 await adminClient.rpc("platform_ai_log_usage", { p_actor_id:userData.user.id,p_model:model,p_input_tokens:Number(usage.input_tokens ?? 0),p_output_tokens:Number(usage.output_tokens ?? 0),p_total_tokens:Number(usage.total_tokens ?? 0),p_status:"succeeded",p_error_code:null });
 return response({ answer: answer || "The model returned no text. Please try again.", model, usage: { input_tokens:Number(usage.input_tokens ?? 0),output_tokens:Number(usage.output_tokens ?? 0),total_tokens:Number(usage.total_tokens ?? 0) } },200,allowedOrigin);
});