import { useId } from "react";
import { cn } from "@/lib/utils";
import { MARK_PATH, MARK_VIEWBOX, WORDMARK_PATH, WORDMARK_CAP_VIEWBOX, WORDMARK_CAP_ASPECT } from "@/components/brand/paths";

/**
 * StudyOS identity. Geometry comes from scripts/brand/build_brand.py (paths.ts is generated),
 * so the in-app logo and the exported icons can never drift apart. See docs/BRAND.md.
 *
 *  - <LogoMark />  the bare symbol (a circle with an S cut out of it); takes the text colour
 *  - <AppIcon />   the full-colour app tile (what you see on the Home Screen)
 *  - <Wordmark />  "StudyOS" outlines; takes the text colour
 *  - <Logo />      tile + wordmark lockup
 */

export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" className={cn("shrink-0", className)}>
      <path d={MARK_PATH} />
    </svg>
  );
}

export function AppIcon({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} aria-hidden="true" focusable="false" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#2E6CFF" /><stop offset="0.55" stopColor="#1B3FB4" /><stop offset="1" stopColor="#0A1236" />
        </linearGradient>
        <radialGradient id={`${id}gl`} cx="0.22" cy="0.04" r="0.8">
          <stop offset="0" stopColor="#9CC0FF" stopOpacity="0.38" /><stop offset="1" stopColor="#9CC0FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}dg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#CCDEFF" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="228" fill={`url(#${id}bg)`} />
      <rect width="1024" height="1024" rx="228" fill={`url(#${id}gl)`} />
      <path d={MARK_PATH} fill={`url(#${id}dg)`} />
    </svg>
  );
}

/** `cap` is the height of the capital letters in px (descenders overhang, so it centres on the caps). */
export function Wordmark({ cap = 14, className }: { cap?: number; className?: string }) {
  return (
    <svg viewBox={WORDMARK_CAP_VIEWBOX} width={cap * WORDMARK_CAP_ASPECT} height={cap} fill="currentColor" aria-hidden="true" focusable="false"
      style={{ overflow: "visible" }} className={cn("shrink-0", className)}>
      <path d={WORDMARK_PATH} />
    </svg>
  );
}

export function Logo({ iconSize = 36, className }: { iconSize?: number; className?: string }) {
  return (
    <span role="img" aria-label="StudyOS" className={cn("inline-flex items-center gap-2.5", className)}>
      <AppIcon size={iconSize} />
      <Wordmark cap={Math.round(iconSize * 0.4)} className="text-ink" />
    </span>
  );
}
