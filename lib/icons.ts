import * as fs from "fs";
import * as path from "path";

export interface IconEntry {
  name: string;
  type: "builtin" | "uploaded";
  url?: string;
}

// Returns icon names from /public/icons/ at build/request time
export function getBuiltinIcons(): string[] {
  try {
    const iconsDir = path.join(process.cwd(), "public", "icons");
    return fs
      .readdirSync(iconsDir)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => f.replace(".svg", ""))
      .sort();
  } catch {
    return [];
  }
}

// Reads an SVG file from /public/icons/ and returns its contents
export function getBuiltinSvg(name: string): string | null {
  try {
    const filePath = path.join(process.cwd(), "public", "icons", `${name}.svg`);
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// When writing a bullet's icon to a metafield:
// - builtin names → resolve to SVG string so the theme can output inline
// - CDN URLs → store the URL as-is (theme renders as <img>)
export function resolveIconForMetafield(icon: string): string {
  if (icon.startsWith("https://")) return icon;
  const svg = getBuiltinSvg(icon);
  return svg ?? icon;
}
