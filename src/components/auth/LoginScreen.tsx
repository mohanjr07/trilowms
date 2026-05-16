/**
 * TriloWMS — Enterprise Login Screen
 * Premium dark industrial authentication UI
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Eye, EyeOff, Lock, Mail, Forklift, Loader2, AlertCircle,
  ChevronRight, ShieldCheck, ArrowRight, X,
} from "lucide-react";
import { useAuthStore, DEMO_USERS, ROLE_DEFINITIONS } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

// ─── Animated warehouse background ───────────────────────────────────────────

function WarehouseBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Animated particles representing warehouse activity
    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number; color: string }[] = [];
    const COLORS = ["#f59e0b", "#0ea5e9", "#10b981", "#8b5cf6"];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }

    // Rack silhouette lines
    const racks: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < 8; i++) {
      racks.push({
        x: (window.innerWidth / 8) * i + Math.random() * 40,
        y: window.innerHeight * 0.3 + Math.random() * 200,
        w: 60 + Math.random() * 40,
        h: 120 + Math.random() * 80,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dark gradient background
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, "#060b12");
      grad.addColorStop(0.5, "#080f1a");
      grad.addColorStop(1, "#060b12");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid floor perspective
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      const gridOriginY = canvas.height * 0.62;
      const horizons = 20;
      for (let i = 0; i <= horizons; i++) {
        const y = gridOriginY + (i / horizons) * canvas.height * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      const vLines = 20;
      for (let i = 0; i <= vLines; i++) {
        const t = i / vLines;
        const vanishX = canvas.width / 2;
        const vanishY = gridOriginY;
        const startX = t * canvas.width;
        ctx.beginPath();
        ctx.moveTo(vanishX + (startX - vanishX) * 0.1, vanishY);
        ctx.lineTo(startX, canvas.height);
        ctx.stroke();
      }

      // Rack silhouettes
      racks.forEach((rack) => {
        const pulse = Math.sin(time * 0.8 + rack.x * 0.01) * 0.015 + 0.02;
        ctx.fillStyle = `rgba(15, 25, 40, ${pulse + 0.04})`;
        ctx.strokeStyle = `rgba(245, 158, 11, ${pulse + 0.06})`;
        ctx.lineWidth = 0.8;
        ctx.fillRect(rack.x, rack.y, rack.w, rack.h);
        ctx.strokeRect(rack.x, rack.y, rack.w, rack.h);
        // shelf lines
        const shelves = 4;
        for (let s = 1; s < shelves; s++) {
          const sy = rack.y + (rack.h / shelves) * s;
          ctx.beginPath();
          ctx.moveTo(rack.x, sy);
          ctx.lineTo(rack.x + rack.w, sy);
          ctx.stroke();
        }
      });

      // Scanning beam animation
      const beamY = gridOriginY + ((Math.sin(time * 0.3) + 1) / 2) * (canvas.height - gridOriginY) * 0.6;
      const beamGrad = ctx.createLinearGradient(0, beamY - 2, 0, beamY + 2);
      beamGrad.addColorStop(0, "transparent");
      beamGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.12)");
      beamGrad.addColorStop(1, "transparent");
      ctx.fillStyle = beamGrad;
      ctx.fillRect(0, beamY - 2, canvas.width, 4);

      // Particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });

      // Accent glow top-left
      const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 400);
      glowGrad.addColorStop(0, "rgba(245,158,11,0.06)");
      glowGrad.addColorStop(1, "transparent");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, 400, 400);

      time += 0.016;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ─── Demo credentials panel ───────────────────────────────────────────────────

function DemoPanel({ onSelect, onClose }: { onSelect: (e: string, p: string) => void; onClose: () => void }) {
  return (
    <div className="absolute right-4 top-4 z-20 w-72 bg-[#0d1724]/95 backdrop-blur border border-border/60 rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="text-xs font-bold tracking-wider text-amber-400">DEMO CREDENTIALS</div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {DEMO_USERS.map((u) => {
          const def = ROLE_DEFINITIONS[u.role];
          return (
            <button
              key={u.id}
              onClick={() => { onSelect(u.email, u.password); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-border/30 last:border-0"
            >
              <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold border", def.bgColor)}>
                {u.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{u.name}</div>
                <div className={cn("text-[10px] truncate", def.color)}>{def.label}</div>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Forgot password modal ────────────────────────────────────────────────────

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"email" | "sent" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0d1724] border border-border/60 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="text-sm font-bold tracking-wider">
            {step === "email" && "FORGOT PASSWORD"}
            {step === "sent" && "CHECK YOUR EMAIL"}
            {step === "reset" && "RESET PASSWORD"}
            {step === "done" && "PASSWORD RESET"}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {step === "email" && (
            <>
              <p className="text-sm text-muted-foreground">Enter your work email to receive a reset link.</p>
              <div>
                <label className="text-[10px] font-bold tracking-wider text-muted-foreground">WORK EMAIL</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@trilowms.com"
                  className="mt-1 w-full bg-background/60 border border-border/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/60" />
              </div>
              <button onClick={() => email && setStep("sent")} className="w-full py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors">
                Send Reset Link
              </button>
            </>
          )}
          {step === "sent" && (
            <>
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="h-14 w-14 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-green-400" />
                </div>
                <p className="text-sm text-center text-muted-foreground">A reset code has been sent to <span className="text-foreground font-medium">{email}</span></p>
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-wider text-muted-foreground">6-DIGIT CODE</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6}
                  className="mt-1 w-full bg-background/60 border border-border/60 rounded-lg px-3 py-2.5 text-sm text-center tracking-widest font-mono focus:outline-none focus:border-amber-500/60" />
              </div>
              <button onClick={() => code.length === 6 && setStep("reset")} className="w-full py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors">
                Verify Code
              </button>
            </>
          )}
          {step === "reset" && (
            <>
              <p className="text-sm text-muted-foreground">Enter your new password.</p>
              <div>
                <label className="text-[10px] font-bold tracking-wider text-muted-foreground">NEW PASSWORD</label>
                <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="Min 8 characters"
                  className="mt-1 w-full bg-background/60 border border-border/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/60" />
              </div>
              <button onClick={() => pw.length >= 6 && setStep("done")} className="w-full py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors">
                Reset Password
              </button>
            </>
          )}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="h-14 w-14 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-green-400" />
              </div>
              <p className="text-sm text-center text-muted-foreground">Password reset successfully. You can now log in with your new password.</p>
              <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors">
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Login Component ─────────────────────────────────────────────────────

export function LoginScreen() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError, role } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [validationError, setValidationError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!email.trim()) { setValidationError("Email is required."); return; }
    if (!password) { setValidationError("Password is required."); return; }

    const ok = await login(email.trim(), password);
    if (ok) {
      const r = useAuthStore.getState().role();
      navigate({ to: r?.defaultRoute ?? "/" });
    }
  };

  const handleDemoSelect = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    clearError();
    setValidationError("");
  };

  const displayError = validationError || error;

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#060b12]">
      <WarehouseBackground />

      {/* Demo credentials panel */}
      {showDemo && (
        <DemoPanel onSelect={handleDemoSelect} onClose={() => setShowDemo(false)} />
      )}

      {/* Forgot password */}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}

      {/* Left panel — branding */}
      <div className="relative hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-10 border-r border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Forklift className="h-5 w-5 text-black" />
            </div>
            <div>
              <div className="font-black tracking-wider text-lg">TRILO<span className="text-amber-400">WMS</span></div>
              <div className="text-[10px] text-muted-foreground font-mono">v4.2.1 ENTERPRISE</div>
            </div>
          </div>

          <div className="mt-16">
            <div className="text-3xl font-black leading-tight">
              Enterprise Warehouse<br />
              <span className="text-amber-400">Management</span><br />
              System
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xs">
              Real-time warehouse operations, 3D digital twin, inventory control, and end-to-end supply chain visibility.
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {[
              { label: "3D Digital Twin", desc: "Live warehouse visualization" },
              { label: "Role-Based Access", desc: "12 operational roles" },
              { label: "Real-Time KPIs", desc: "Live operational dashboards" },
              { label: "Enterprise Grade", desc: "SAP-level WMS capabilities" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-muted-foreground">— {f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span>All systems operational</span>
          </div>
          <div className="text-[10px] text-muted-foreground/50">
            © 2026 TriloWMS — Enterprise Edition. ISO 27001 Certified.
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="relative flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden mb-8">
            <div className="h-9 w-9 rounded-lg bg-amber-500 flex items-center justify-center">
              <Forklift className="h-4.5 w-4.5 text-black" />
            </div>
            <div className="font-black tracking-wider">TRILO<span className="text-amber-400">WMS</span></div>
          </div>

          <div className="bg-[#0d1724]/90 backdrop-blur-xl border border-white/8 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-8 pb-6 border-b border-border/40">
              <div className="text-[10px] font-bold tracking-widest text-amber-400 mb-1">SECURE LOGIN</div>
              <div className="text-xl font-bold">Sign in to TriloWMS</div>
              <div className="text-xs text-muted-foreground mt-1">Use your work credentials to access the system</div>
            </div>

            <form onSubmit={handleLogin} className="px-8 py-6 space-y-5">
              {/* Email */}
              <div>
                <label className="block text-[10px] font-bold tracking-wider text-muted-foreground mb-1.5">
                  WORK EMAIL
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setValidationError(""); clearError(); }}
                    placeholder="you@trilowms.com"
                    autoComplete="email"
                    className="w-full bg-background/50 border border-border/60 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/60 focus:bg-background/80 transition-colors placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold tracking-wider text-muted-foreground mb-1.5">
                  PASSWORD
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setValidationError(""); clearError(); }}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full bg-background/50 border border-border/60 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-amber-500/60 focus:bg-background/80 transition-colors placeholder:text-muted-foreground/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {displayError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {displayError}
                </div>
              )}

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setRemember((v) => !v)}
                    className={cn(
                      "h-4 w-4 rounded border transition-colors cursor-pointer flex items-center justify-center",
                      remember ? "bg-amber-500 border-amber-500" : "border-border/60 bg-background/50",
                    )}
                  >
                    {remember && <div className="h-2 w-2 bg-black rounded-sm" />}
                  </div>
                  <span className="text-xs text-muted-foreground">Remember me (8h)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 active:bg-amber-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Authenticating…</>
                ) : (
                  <>Sign In <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>

            {/* Demo credentials CTA */}
            <div className="px-8 pb-6">
              <div className="border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDemo((v) => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs text-amber-400/80 hover:text-amber-400 transition-colors rounded-lg hover:bg-amber-400/5 border border-amber-400/20"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  View Demo Credentials (12 roles)
                </button>
              </div>
            </div>
          </div>

          {/* System status */}
          <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-muted-foreground/60">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              System Online
            </div>
            <span>·</span>
            <span>TLS 1.3 Encrypted</span>
            <span>·</span>
            <span>SOC 2 Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
}
