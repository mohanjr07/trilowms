/**
 * TriloWMS push notifications (Firebase Cloud Messaging via the Android app).
 * - registerPush(): asks permission, gets the FCM token and stores it in Supabase `device_tokens`.
 * - sendPush(): asks the `send-push` Edge Function to notify users by e-mail or role.
 * All of it is a no-op on the website / when Supabase is not configured.
 */
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  try { if (w.Capacitor?.isNativePlatform?.()) return true; } catch { /* ignore */ }
  return /; wv\)|TriloWMSApp/.test(navigator.userAgent);
}

let currentToken: string | null = null;
let started = false;

export async function registerPush(user: { email: string; role: string }): Promise<void> {
  if (!supabaseConfigured || !isNativeApp() || started) return;
  started = true;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") { started = false; return; }
    await PushNotifications.createChannel({ id: "tasks", name: "Tasks & alerts", importance: 5, visibility: 1, vibration: true }).catch(() => {});
    await PushNotifications.addListener("registration", async (t) => {
      currentToken = t.value;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      await supabase.from("device_tokens").upsert(
        { token: t.value, user_id: data.session.user.id, email: user.email.toLowerCase(), role: user.role, platform: "android", updated_at: new Date().toISOString() },
        { onConflict: "token" },
      );
    });
    await PushNotifications.addListener("registrationError", (e) => console.warn("Push registration failed", e));
    await PushNotifications.addListener("pushNotificationReceived", (n) => { toast(n.title ?? "Notification", { description: n.body }); });
    await PushNotifications.register();
  } catch (e) {
    started = false;
    console.warn("Push setup skipped", e);
  }
}

export async function unregisterPush(): Promise<void> {
  started = false;
  if (!supabaseConfigured || !currentToken) return;
  try { await supabase.from("device_tokens").delete().eq("token", currentToken); } catch { /* ignore */ }
  currentToken = null;
}

export interface PushTarget { emails?: string[]; roles?: string[]; all?: boolean }
const recent = new Map<string, number>();

/** Fire-and-forget. Duplicate (target+title+body) sends within 15 s are dropped. */
export function sendPush(target: PushTarget, title: string, body: string, data: Record<string, string> = {}, broadcast = false): void {
  if (!supabaseConfigured) return;
  const emails = [...new Set((target.emails ?? []).filter(Boolean).map((e) => e.toLowerCase()))];
  if (!emails.length && !(target.roles ?? []).length && !target.all) return;
  const key = JSON.stringify([emails, target.roles, target.all, title, body]);
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - 15000) return;
  recent.set(key, now);
  void supabase.functions.invoke("send-push", { body: { ...target, emails, title, body, data, broadcast } }).catch(() => {});
}

/** Login e-mails an employee could sign in with (profile e-mail, or <employeeId>@trilowms.com). */
export function employeeEmails(e: { email?: string; employeeId?: string } | undefined | null): string[] {
  if (!e) return [];
  return [e.email ?? "", e.employeeId ? `${e.employeeId.toLowerCase()}@trilowms.com` : ""].filter(Boolean);
}
