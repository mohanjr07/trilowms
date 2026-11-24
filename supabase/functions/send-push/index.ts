// Supabase Edge Function: send-push
// Body: { emails?: string[], roles?: string[], all?: boolean, title: string, body: string, data?: Record<string,string> }
// Auth: caller must be a signed-in user whose wms_role is not "auditor". Broadcasts (roles/all) need an admin/manager role.
// Secret required: FCM_SERVICE_ACCOUNT (the Firebase service-account JSON, as one string).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function fcmAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${head}.${claim}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${b64url(sig)}` }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("FCM auth failed: " + JSON.stringify(j));
  return j.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error: uerr } = await admin.auth.getUser(jwt);
    if (uerr || !u.user) return json({ error: "Not signed in" }, 401);
    const callerRole = String((u.user.app_metadata as Record<string, unknown>)?.wms_role ?? "");
    if (!callerRole || callerRole === "auditor") return json({ error: "Not allowed" }, 403);

    const p = await req.json();
    const title = String(p.title ?? "").slice(0, 120);
    const body = String(p.body ?? "").slice(0, 300);
    if (!title) return json({ error: "title required" }, 400);

    const emails: string[] = (Array.isArray(p.emails) ? p.emails : []).map((e: string) => String(e).toLowerCase());
    const roles: string[] = Array.isArray(p.roles) ? p.roles.map(String) : [];
    const isBroadcast = p.all === true || p.broadcast === true;
    if (isBroadcast && !["super_admin", "warehouse_admin", "operations_manager"].includes(callerRole)) return json({ error: "Broadcast needs an admin role" }, 403);

    let q = admin.from("device_tokens").select("token,email,role");
    if (p.all === true) { /* everyone */ }
    else if (emails.length || roles.length) {
      const parts: string[] = [];
      if (emails.length) parts.push(`email.in.(${emails.map((e) => `"${e}"`).join(",")})`);
      if (roles.length) parts.push(`role.in.(${roles.map((r) => `"${r}"`).join(",")})`);
      q = q.or(parts.join(","));
    } else return json({ sent: 0, reason: "no recipients" });
    const { data: rows, error } = await q;
    if (error) return json({ error: error.message }, 500);
    const tokens = [...new Set((rows ?? []).map((r) => r.token as string))];
    if (!tokens.length) return json({ sent: 0, reason: "no registered devices" });

    const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "{}");
    if (!sa.project_id) return json({ error: "FCM_SERVICE_ACCOUNT secret missing" }, 500);
    const access = await fcmAccessToken(sa);
    const data: Record<string, string> = Object.fromEntries(Object.entries(p.data ?? {}).map(([k, v]) => [k, String(v)]));

    let sent = 0; const dead: string[] = [];
    await Promise.all(tokens.map(async (token) => {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { token, notification: { title, body }, data, android: { priority: "HIGH", notification: { channel_id: "tasks", sound: "default" } } } }),
      });
      if (r.ok) sent++;
      else { const t = await r.text(); if (/UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(t)) dead.push(token); }
    }));
    if (dead.length) await admin.from("device_tokens").delete().in("token", dead);
    return json({ sent, removed: dead.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
