"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface IconEntry {
  handle: string;
  id: string;
  svg: string;
}

const IconsContext = createContext<Map<string, string>>(new Map());

export function IconsProvider({ children }: { children: ReactNode }) {
  const [iconMap, setIconMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetch("/api/icons")
      .then((r) => r.json())
      .then((d: { icons?: IconEntry[] }) => {
        if (d.icons) {
          const map = new Map<string, string>();
          for (const icon of d.icons) map.set(icon.handle, icon.svg);
          setIconMap(map);
        }
      })
      .catch(() => {});
  }, []);

  return <IconsContext.Provider value={iconMap}>{children}</IconsContext.Provider>;
}

function renderInlineSvg(svg: string, size: number): string {
  return svg.replace(
    /<svg([^>]*)>/,
    (_, attrs) =>
      `<svg${attrs.replace(/\s*(width|height)="[^"]*"/g, "")} width="${size}" height="${size}" style="display:block">`
  );
}

export function IconImg({
  icon,
  size = 20,
  className = "",
}: {
  icon: string;
  size?: number;
  className?: string;
}) {
  const iconMap = useContext(IconsContext);

  if (!icon) return <span className="text-gray-300 text-xs">—</span>;

  if (icon.startsWith("https://"))
    return (
      <img
        src={icon}
        alt=""
        style={{ width: size, height: size }}
        className={`object-contain ${className}`.trim()}
      />
    );

  let svgContent: string | null = null;
  if (icon.startsWith("<svg")) {
    svgContent = icon;
  } else {
    svgContent = iconMap.get(icon) ?? null;
  }

  if (svgContent) {
    return (
      <span
        style={{
          width: size,
          height: size,
          minWidth: size,
          display: "inline-flex",
          alignItems: "center",
          overflow: "hidden",
        }}
        className={className}
        dangerouslySetInnerHTML={{ __html: renderInlineSvg(svgContent, size) }}
      />
    );
  }

  // Fallback while icons are still loading
  return (
    <img
      src={`/icons/${icon}.svg`}
      alt={icon}
      style={{ width: size, height: size }}
      className={`object-contain ${className}`.trim()}
    />
  );
}
