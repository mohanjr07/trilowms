/** Mobile · More — profile, change password, switch to desktop layout, sign out. */
import { useState } from "react";
import { LogOut, KeyRound, Monitor } from "lucide-react";
import { useAuthStore, ROLE_DEFINITIONS } from "@/lib/auth-store";
import { supabase } from "@/lib/supabase";
import { Card, Chip, BigButton, Field, Row } from "./ui";
import { setViewMode } from "./useMobileMode";

export function MoreScreen() {
  const session = useAuthStore((s) => s.session)!;
  const logout = useAuthStore((s) => s.logout);
  const def = ROLE_DEFINITIONS[session.user.role];
  const [pw, setPw] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const change = async () => {
    if (pw.length < 8) { setMsg({ ok: false, text: "Use at least 8 characters." }); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setMsg({ ok: false, text: error.message });
    else { setMsg({ ok: true, text: "Password changed. Use it next time you sign in." }); setPw(""); }
  };

  return (
    <div className="p-3 space-y-3">
      <Card>
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-lg font-bold text-primary">{session.user.avatar}</div>
          <div className="min-w-0">
            <div className="text-lg font-bold truncate">{session.user.name}</div>
            <div className="text-xs text-muted-foreground truncate">{session.user.email}</div>
            <div className="mt-1"><Chip tone="primary">{def.label}</Chip></div>
          </div>
        </div>
        <div className="mt-3">
          <Row label="Warehouse" value={session.user.warehouse} />
          <Row label="Shift" value={session.user.shift} />
          <Row label="Employee ID" value={session.user.employeeId} />
        </div>
      </Card>

      <Card>
        <button type="button" onClick={() => { setOpen((v) => !v); setMsg(null); }} className="w-full flex items-center gap-3 text-left min-h-[44px]">
          <KeyRound className="h-5 w-5 text-muted-foreground" /><span className="font-semibold">Change password</span>
        </button>
        {open && (
          <div className="mt-2 space-y-2">
            <Field label="New password" value={pw} onChange={setPw} type="password" placeholder="8+ characters" />
            <BigButton className="w-full" onClick={() => void change()}>Save new password</BigButton>
            {msg && <div className={msg.ok ? "text-sm text-emerald-400" : "text-sm text-red-400"}>{msg.text}</div>}
          </div>
        )}
      </Card>

      <Card onClick={() => setViewMode("desktop")} className="flex items-center gap-3 min-h-[56px]">
        <Monitor className="h-5 w-5 text-muted-foreground" /><div><div className="font-semibold">Use desktop layout</div><div className="text-xs text-muted-foreground">Full web screens (best on a PC)</div></div>
      </Card>

      <BigButton tone="danger" className="w-full" onClick={logout}><LogOut className="h-5 w-5" /> Sign out</BigButton>
      <div className="text-center text-[11px] text-muted-foreground pt-1">TriloWMS mobile</div>
    </div>
  );
}
