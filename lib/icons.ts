export interface IconEntry {
  name: string;
  type: "builtin" | "uploaded";
  url?: string;
}

// Static list of built-in icon names — update when adding/removing icons from BUILTIN_SVG_MAP.
export const BUILTIN_ICON_NAMES: string[] = [
  "baby", "balloons", "bird", "book", "briefcase", "brush", "cake",
  "clover", "cross", "dining", "flag", "flower", "fork", "gift",
  "graduate", "hand-heart", "heart", "heart-bubble", "house", "leaf",
  "music", "pencil", "plane", "prosecco", "rainbow", "ribbon", "rings",
  "scissors", "sparkle", "star", "sun", "tree", "trophy", "watch", "wrench",
];

// SVG content for all built-in icons — used only for seeding pdp_icon metaobjects on first deploy.
const BUILTIN_SVG_MAP: Record<string, string> = {
  "baby": `<svg id="baby" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 12h.01"/>
  <path d="M15 12h.01"/>
  <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/>
  <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>
</svg>`,
  "balloons": `<svg id="balloons" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
  <path d="M9 12c0 1.5-.5 2.5-1 3"/>
  <path d="M8 15c1 .5 2 .5 3 0"/>
  <path d="M15 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
  <path d="M15 10c0 1.5-.5 2.5-1 3"/>
  <path d="M14 13c1 .5 2 .5 3 0"/>
  <path d="M10 18c0 2 1 3 2 3s2-1 2-3"/>
  <path d="M12 21v1"/>
</svg>`,
  "bird": `<svg id="bird" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="15.5" cy="8" r="2.5"/>
  <path d="M17.5 7L21 6.5L17.5 8.5"/>
  <path d="M13.5 10C10 9 6 9 4 12C3 14 4 16 6 16.5C9 17.5 13 16 13.5 13C14.5 11 14.5 10 13.5 10Z"/>
  <path d="M7 10C9 7.5 12 7 13.5 9.5"/>
  <path d="M4 12L2 10.5M4 12.5L1.5 12.5M4 13L2 15"/>
</svg>`,
  "book": `<svg id="book" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 4H9C10.1 4 12 5 12 7V21C10 20 7 20 2 20Z"/>
  <path d="M22 4H15C13.9 4 12 5 12 7V21C14 20 17 20 22 20Z"/>
</svg>`,
  "briefcase": `<svg id="briefcase" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect width="20" height="14" x="2" y="7" rx="2"/>
  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
</svg>`,
  "brush": `<svg id="brush" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="m9.06 11.9 8.07-8.06a2.85 2.83 0 1 1 4.03 4.03l-8.06 8.08"/>
  <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1 1 2.99 2 5 2 2.96 0 5.07-1.56 5.07-4.04 0-1.67-1.37-3-3.07-3z"/>
</svg>`,
  "cake": `<svg id="cake" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/>
  <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/>
  <path d="M2 21h20"/>
  <path d="M7 8v2"/>
  <path d="M12 8v2"/>
  <path d="M17 8v2"/>
  <path d="M7 4 8.5 2 10 4"/>
  <path d="M12 4l1.5-2 1.5 2"/>
  <path d="M17 4l1.5-2 1.5 2"/>
</svg>`,
  "clover": `<svg id="clover" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 12 C11 11 9.5 10 9.5 8.5 C9.5 7 10.5 6 12 7.5 C13.5 6 14.5 7 14.5 8.5 C14.5 10 13 11 12 12"/>
  <path d="M12 12 C11 11 9.5 10 9.5 8.5 C9.5 7 10.5 6 12 7.5 C13.5 6 14.5 7 14.5 8.5 C14.5 10 13 11 12 12" transform="rotate(90,12,12)"/>
  <path d="M12 12 C11 11 9.5 10 9.5 8.5 C9.5 7 10.5 6 12 7.5 C13.5 6 14.5 7 14.5 8.5 C14.5 10 13 11 12 12" transform="rotate(180,12,12)"/>
  <path d="M12 12 C11 11 9.5 10 9.5 8.5 C9.5 7 10.5 6 12 7.5 C13.5 6 14.5 7 14.5 8.5 C14.5 10 13 11 12 12" transform="rotate(270,12,12)"/>
  <path d="M12 17 L12 22"/>
</svg>`,
  "cross": `<svg id="cross" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 2h4v6h6v4h-6v10h-4v-10h-6v-4h6z"/>
</svg>`,
  "dining": `<svg id="dining" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
  <path d="M7 2v20"/>
  <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
</svg>`,
  "flag": `<svg id="flag" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
  <line x1="4" y1="22" x2="4" y2="15"/>
</svg>`,
  "flower": `<svg id="flower" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="10" r="2"/>
  <path d="M12 8 A1.5 3 0 0 0 12 3 A1.5 3 0 0 1 12 8"/>
  <path d="M12 8 A1.5 3 0 0 0 12 3 A1.5 3 0 0 1 12 8" transform="rotate(72,12,10)"/>
  <path d="M12 8 A1.5 3 0 0 0 12 3 A1.5 3 0 0 1 12 8" transform="rotate(144,12,10)"/>
  <path d="M12 8 A1.5 3 0 0 0 12 3 A1.5 3 0 0 1 12 8" transform="rotate(216,12,10)"/>
  <path d="M12 8 A1.5 3 0 0 0 12 3 A1.5 3 0 0 1 12 8" transform="rotate(288,12,10)"/>
  <path d="M12 16 L12 22"/>
</svg>`,
  "fork": `<svg id="fork" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
  <path d="M7 2v20"/>
  <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
</svg>`,
  "gift": `<svg id="gift" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="8" width="18" height="4" rx="1"/>
  <path d="M12 8v13"/>
  <path d="M19 12v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9"/>
  <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>
</svg>`,
  "graduate": `<svg id="graduate" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
</svg>`,
  "hand-heart": `<svg id="hand-heart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 17 C8 14 3 11 3 8.5 C3 5.5 5.5 3.5 8 3.5 C10 3.5 11.5 5 12 5.5 C12.5 5 14 3.5 16 3.5 C18.5 3.5 21 5.5 21 8.5 C21 11 16 14 12 17 Z"/>
  <path d="M5 21 C5 18 8.5 17 12 17 C15.5 17 19 18 19 21"/>
</svg>`,
  "heart": `<svg id="heart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
</svg>`,
  "heart-bubble": `<svg id="heart-bubble" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 16C12 16 5 12 5 8A4.5 4.5 0 0 1 12 4A4.5 4.5 0 0 1 19 8c0 4-7 8-7 8z"/>
  <circle cx="10" cy="19" r="1.5"/>
  <circle cx="8.5" cy="22" r="1"/>
</svg>`,
  "house": `<svg id="house" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  <polyline points="9 22 9 12 15 12 15 22"/>
</svg>`,
  "leaf": `<svg id="leaf" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
</svg>`,
  "music": `<svg id="music" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 18V5l12-2v13"/>
  <circle cx="6" cy="18" r="3"/>
  <circle cx="18" cy="16" r="3"/>
</svg>`,
  "pencil": `<svg id="pencil" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
  <path d="m15 5 4 4"/>
</svg>`,
  "plane": `<svg id="plane" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4s-2 1-3.5 2.5L11 8 2.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 6.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
</svg>`,
  "prosecco": `<svg id="prosecco" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 2h4L7.5 11H5.5L5 2z"/>
  <path d="M6.5 11v8"/>
  <path d="M4 19h5"/>
  <path d="M15 2h4l-1.5 9h-2L15 2z"/>
  <path d="M16.5 11v8"/>
  <path d="M14 19h5"/>
  <path d="M10 3c.5-1.5 3.5-1.5 4 0"/>
</svg>`,
  "rainbow": `<svg id="rainbow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 17a10 10 0 0 0-20 0"/>
  <path d="M18 17a6 6 0 0 0-12 0"/>
  <path d="M14 17a2 2 0 0 0-4 0"/>
</svg>`,
  "ribbon": `<svg id="ribbon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 10 C9 7 5 6 5 8.5 C5 11 9 12 12 10"/>
  <path d="M12 10 C15 7 19 6 19 8.5 C19 11 15 12 12 10"/>
  <path d="M8 21 L12 10 L16 21"/>
</svg>`,
  "rings": `<svg id="rings" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="8.5" cy="12" r="5"/>
  <circle cx="15.5" cy="12" r="5"/>
</svg>`,
  "scissors": `<svg id="scissors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="6" cy="6" r="3"/>
  <circle cx="6" cy="18" r="3"/>
  <path d="M20 4L8.5 15.5"/>
  <path d="M20 20L8.5 8.5"/>
</svg>`,
  "sparkle": `<svg id="sparkle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
  <path d="M5 3v4"/>
  <path d="M19 17v4"/>
  <path d="M3 5h4"/>
  <path d="M17 19h4"/>
</svg>`,
  "star": `<svg id="star" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
</svg>`,
  "sun": `<svg id="sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="4"/>
  <path d="M12 2v2"/>
  <path d="M12 20v2"/>
  <path d="m4.93 4.93 1.41 1.41"/>
  <path d="m17.66 17.66 1.41 1.41"/>
  <path d="M2 12h2"/>
  <path d="M20 12h2"/>
  <path d="m6.34 17.66-1.41 1.41"/>
  <path d="m19.07 4.93-1.41 1.41"/>
</svg>`,
  "tree": `<svg id="tree" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2L8.5 8H15.5Z"/>
  <path d="M12 6L7 13H17Z"/>
  <path d="M12 10L5 18H19Z"/>
  <path d="M11 18V22H13V18"/>
</svg>`,
  "trophy": `<svg id="trophy" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
  <path d="M4 22h16"/>
  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
</svg>`,
  "watch": `<svg id="watch" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="6"/>
  <polyline points="12 10 12 12 13 13"/>
  <path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 3.96"/>
  <path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/>
</svg>`,
  "wrench": `<svg id="wrench" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
</svg>`,
};

export function getBuiltinIcons(): string[] {
  return BUILTIN_ICON_NAMES;
}

export function getBuiltinSvg(name: string): string | null {
  return BUILTIN_SVG_MAP[name] ?? null;
}

export function minifySvg(svg: string): string {
  return svg.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}
