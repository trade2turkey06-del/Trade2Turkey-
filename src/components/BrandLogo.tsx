import React from "react";

interface BrandLogoProps {
  /** Size preset for the logo layout */
  size?: "sm" | "md" | "lg" | "xl";
  /** Whether to render only the sphere icon/globe, or the full brand block with logo texts */
  layout?: "icon" | "full" | "horizontal";
  /** Optional theme override for dark or light backgrounds */
  theme?: "light" | "dark";
  /** CSS class to apply to the top wrapper */
  className?: string;
}

export default function BrandLogo({
  size = "md",
  layout = "full",
  theme = "dark",
  className = "",
}: BrandLogoProps) {
  // Dimensions based on preset sizes
  const getDims = () => {
    switch (size) {
      case "sm":
        return { svg: "h-8 w-8", title: "text-base", sub: "text-[8px]", letterSpacing: "tracking-wider" };
      case "lg":
        return { svg: "h-24 w-24", title: "text-3xl", sub: "text-xs", letterSpacing: "tracking-widest" };
      case "xl":
        return { svg: "h-36 w-36", title: "text-4xl", sub: "text-sm", letterSpacing: "tracking-widest" };
      case "md":
      default:
        return { svg: "h-14 w-14", title: "text-xl", sub: "text-[10px]", letterSpacing: "tracking-widest" };
    }
  };

  const dims = getDims();

  // Primary colors
  // Text coloring based on light/dark backgrounds
  const textTitleColor = theme === "dark" ? "text-white" : "text-slate-900";
  const textSubColor = theme === "dark" ? "text-slate-350" : "text-slate-600";
  const navyTextColor = theme === "dark" ? "text-sky-300" : "text-navy";

  // Full-fidelity vector rendering of the constellation/network trade globe
  const globeIcon = (
    <svg
      className={`${dims.svg} select-none overflow-visible filter drop-shadow-[0_0_15px_rgba(34,211,238,0.25)]`}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Core sphere gradient resembling the glowing cyan-blue orb */}
        <radialGradient
          id="t2tGlobeCore"
          cx="38"
          cy="38"
          r="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#22d3ee" /> {/* Glowing light cyan center */}
          <stop offset="40%" stopColor="#0ea5e9" /> {/* Bright ocean blue mid */}
          <stop offset="80%" stopColor="#0B2545" /> {/* Corporate Navy outer */}
          <stop offset="100%" stopColor="#030712" /> {/* Space depth boundary */}
        </radialGradient>

        {/* Glow drop-shadow effects */}
        <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        
        {/* Slower glow for larger nodes */}
        <filter id="vertexGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Behind-shadow for deep glow */}
      <circle cx="50" cy="50" r="40" fill="#00f0ff" opacity="0.12" filter="url(#vertexGlow)" />

      {/* 3D Core Sphere body */}
      <circle cx="50" cy="50" r="38" fill="url(#t2tGlobeCore)" stroke="#0369a1" strokeWidth="0.5" />

      {/* Translucent grid lines & latitudes */}
      <g opacity="0.2">
        <circle cx="50" cy="50" r="30" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="4 2" />
        <circle cx="50" cy="50" r="20" stroke="#22d3ee" strokeWidth="0.5" />
        <ellipse cx="50" cy="50" rx="38" ry="12" stroke="#38bdf8" strokeWidth="0.5" />
        <ellipse cx="50" cy="50" rx="12" ry="38" stroke="#38bdf8" strokeWidth="0.4" />
      </g>

      {/* Surrounding orbital trajectories (3 outer rings with high quality perspective) */}
      <g opacity="0.38">
        <ellipse
          cx="50"
          cy="50"
          rx="44"
          ry="15"
          stroke="#22d3ee"
          strokeWidth="0.75"
          transform="rotate(-23 50 50)"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="45"
          ry="13"
          stroke="#38bdf8"
          strokeWidth="0.6"
          transform="rotate(27 50 50)"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="46"
          ry="10"
          stroke="#06b6d4"
          strokeWidth="0.5"
          transform="rotate(65 50 50)"
          strokeDasharray="5 5"
        />
      </g>

      {/* Connecting Network/Mesh lines (trade connectivity) */}
      <g stroke="white" strokeWidth="0.38" opacity="0.55">
        <line x1="28" y1="35" x2="50" y2="28" />
        <line x1="28" y1="35" x2="35" y2="52" />
        <line x1="50" y1="28" x2="68" y2="34" />
        <line x1="35" y1="52" x2="50" y2="65" />
        <line x1="50" y1="65" x2="72" y2="58" />
        <line x1="68" y1="34" x2="72" y2="58" />
        
        {/* Interior diagonals */}
        <line x1="28" y1="35" x2="50" y2="50" stroke="#e0f2fe" strokeWidth="0.5" />
        <line x1="68" y1="34" x2="50" y2="50" stroke="#e0f2fe" strokeWidth="0.5" />
        <line x1="35" y1="52" x2="50" y2="50" stroke="#38bdf8" strokeWidth="0.4" />
        <line x1="72" y1="58" x2="50" y2="50" stroke="#38bdf8" strokeWidth="0.4" />
        
        {/* More peripheral connections */}
        <line x1="50" y1="28" x2="50" y2="50" />
        <line x1="50" y1="65" x2="50" y2="50" />
        <line x1="25" y1="50" x2="35" y2="52" />
        <line x1="68" y1="34" x2="80" y2="42" strokeDasharray="2 1" />
        <line x1="72" y1="58" x2="78" y2="50" />
        <line x1="28" y1="35" x2="30" y2="25" />
      </g>

      {/* Network Nodes (Vertices) - Shiny White and Neon Cyan */}
      <g>
        {/* Core Center Node */}
        <circle cx="50" cy="50" r="3.2" fill="white" filter="url(#neonGlow)" />
        <circle cx="50" cy="50" r="1.5" fill="#22d3ee" />

        {/* Node A (Upper Left) */}
        <circle cx="28" cy="35" r="2.5" fill="white" filter="url(#neonGlow)" />
        <circle cx="28" cy="35" r="4.5" stroke="#22d3ee" strokeWidth="0.75" opacity="0.8" />

        {/* Node B (Upper Right) */}
        <circle cx="68" cy="34" r="2.2" fill="white" />
        <circle cx="68" cy="34" r="1" fill="#38bdf8" />

        {/* Node C (Mid Left) */}
        <circle cx="35" cy="52" r="2.5" fill="white" filter="url(#neonGlow)" />

        {/* Node D (Lower Right) */}
        <circle cx="72" cy="58" r="3" fill="white" filter="url(#neonGlow)" />
        <circle cx="72" cy="58" r="5" stroke="#06b6d4" strokeWidth="0.5" opacity="0.6" />

        {/* Node E (Top North) */}
        <circle cx="50" cy="28" r="2" fill="#22d3ee" />

        {/* Node F (Bottom South) */}
        <circle cx="50" cy="65" r="2.5" fill="#38bdf8" />

        {/* High Latitude tiny stars / micro nodes */}
        <circle cx="42" cy="40" r="1" fill="white" opacity="0.9" />
        <circle cx="58" cy="44" r="1" fill="white" opacity="0.9" />
        <circle cx="62" cy="48" r="1.2" fill="#38bdf8" />
        <circle cx="40" cy="60" r="0.8" fill="white" />
        <circle cx="30" cy="25" r="1.5" fill="#0ea5e9" />
        <circle cx="78" cy="50" r="1.5" fill="#22d3ee" />
        <circle cx="25" cy="50" r="1.2" fill="#0ea5e9" opacity="0.8" />
      </g>
    </svg>
  );

  if (layout === "icon") {
    return <div className={`inline-flex items-center justify-center ${className}`}>{globeIcon}</div>;
  }

  if (layout === "horizontal") {
    return (
      <div className={`flex items-center gap-3.5 ${className}`}>
        {globeIcon}
        <div className="flex flex-col justify-center text-left">
          <h1 className={`${dims.title} font-black tracking-tight leading-none font-display flex items-baseline`}>
            <span className={theme === "dark" || theme === "light" && navbarThemeStyle(theme) === "dark" ? "text-white" : "text-slate-900"}>Trade</span>
            <span className="text-sky-400 font-extrabold px-0.5">2</span>
            <span className={theme === "dark" || theme === "light" && navbarThemeStyle(theme) === "dark" ? "text-white" : "text-slate-900"}>Turkey</span>
          </h1>
          <p className="text-[9px] font-bold text-slate-450 mt-1 uppercase tracking-widest font-mono">
            Dijital İş Akışları
          </p>
        </div>
      </div>
    );
  }

  // Full Stacked/Centered Brand Block (exactly resembling the corporate branding sheet!)
  return (
    <div className={`flex flex-col items-center text-center space-y-4 ${className}`}>
      {/* Globe Icon */}
      <div className="relative inline-flex items-center justify-center">
        {globeIcon}
      </div>

      {/* Typography block */}
      <div className="space-y-1.5">
        <h2 className={`${dims.title} font-extrabold tracking-tight font-display text-slate-900 leading-none flex items-center justify-center`}>
          <span className={theme === "dark" ? "text-white" : "text-navy"}>Trade</span>
          <span className="text-teal-500 font-black px-0.5 transform tracking-tight">2</span>
          <span className={theme === "dark" ? "text-white" : "text-navy"}>Turkey</span>
        </h2>
        
        <p className={`${dims.sub} font-semibold ${theme === "dark" ? "text-slate-300" : "text-slate-700"} uppercase tracking-wider font-sans`}>
          Dijital İş Akışları, Disiplinli Tedarik
        </p>
        
        <p className="text-xs font-black tracking-[0.25em] text-cyan-600 font-sans uppercase">
          T2T
        </p>
      </div>
    </div>
  );
}

// Helper to handle navbar text color when light theme is active
function navbarThemeStyle(theme: string): string {
  return "light";
}
