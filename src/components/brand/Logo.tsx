/**
 * TriloWMS brand logo — three stacked isometric blocks forming a "T".
 * <LogoMark/> is the symbol only; <Logo/> adds the TRILO / WMS wordmark.
 * theme="dark" is for dark backgrounds (default, matches the app), "light" for white/grey backgrounds.
 */
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

const DARK_POLYS: [string, string][] = [
  ["#F39D0B", "104,256 208,316 208,539 104,479"],
  ["#E4570B", "208,316 312,256 312,479 208,539"],
  ["#FAD24D", "104,256 208,196 312,256 208,316"],
  ["#F39D0B", "0,60 147,145 147,265 0,180"],
  ["#E4570B", "147,145 251,85 251,205 147,265"],
  ["#FAD24D", "0,60 104,0 251,85 147,145"],
  ["#F39D0B", "164,156 312,241 312,361 164,276"],
  ["#E4570B", "312,241 416,181 416,301 312,361"],
  ["#FAD24D", "164,156 268,96 416,181 312,241"],
];
const LIGHT_POLYS: [string, string][] = [
  ["#E4570B", "104,256 208,316 208,539 104,479"],
  ["#9A3010", "208,316 312,256 312,479 208,539"],
  ["#F39D0B", "104,256 208,196 312,256 208,316"],
  ["#E4570B", "0,60 147,145 147,265 0,180"],
  ["#9A3010", "147,145 251,85 251,205 147,265"],
  ["#F39D0B", "0,60 104,0 251,85 147,145"],
  ["#E4570B", "164,156 312,241 312,361 164,276"],
  ["#9A3010", "312,241 416,181 416,301 312,361"],
  ["#F39D0B", "164,156 268,96 416,181 312,241"],
];

export function LogoMark({ size = 32, theme = "dark", className }: { size?: number; theme?: Theme; className?: string }) {
  const polys = theme === "dark" ? DARK_POLYS : LIGHT_POLYS;
  return (
    <svg
      viewBox="0 0 416 539"
      width={size * (416 / 539)}
      height={size}
      role="img"
      aria-label="TriloWMS"
      className={cn("shrink-0", className)}
    >
      {polys.map(([fill, points], i) => (
        <polygon key={i} fill={fill} stroke={fill} strokeWidth={0.6} strokeLinejoin="round" points={points} />
      ))}
    </svg>
  );
}

export function LogoWordmark({ theme = "dark", className, fontSize }: { theme?: Theme; className?: string; fontSize?: number }) {
  return (
    <span className={cn("uppercase leading-none tracking-[0.02em]", className)} style={fontSize ? { fontSize } : undefined}>
      <span className="font-extrabold" style={{ color: theme === "dark" ? "#fff" : "#0F1115" }}>Trilo</span>
      <span className="font-light" style={{ color: theme === "dark" ? "#F39D0B" : "#E4570B" }}>WMS</span>
    </span>
  );
}

/** layout="horizontal": symbol left of the wordmark. layout="stacked": symbol above the wordmark. */
export function Logo({
  layout = "horizontal", theme = "dark", size = 32, className, subtitle,
}: { layout?: "horizontal" | "stacked"; theme?: Theme; size?: number; className?: string; subtitle?: React.ReactNode }) {
  const text = Math.round(size * 0.62);
  if (layout === "stacked") {
    return (
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <LogoMark size={size} theme={theme} />
        <LogoWordmark theme={theme} fontSize={Math.round(size * 0.62)} />
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} theme={theme} />
      <div className="flex flex-col justify-center">
        <LogoWordmark theme={theme} fontSize={text} />
        {subtitle}
      </div>
    </div>
  );
}
