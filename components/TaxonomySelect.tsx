"use client";
import type { ChangeEvent } from "react";

// Encodes type+style as "type" or "type||style"; "" means all types.
export function encodeTaxonomyValue(type: string, style: string) {
  return style ? `${type}||${style}` : type;
}

export function decodeTaxonomyValue(value: string): { type: string; style: string } {
  const sep = value.indexOf("||");
  if (sep === -1) return { type: value, style: "" };
  return { type: value.slice(0, sep), style: value.slice(sep + 2) };
}

interface TaxonomySelectProps {
  taxonomy: Record<string, string[]>;
  value: string; // "" | "type" | "type||style"
  onChange: (type: string, style: string) => void;
  className?: string;
}

export function TaxonomySelect({ taxonomy, value, onChange, className }: TaxonomySelectProps) {
  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const { type, style } = decodeTaxonomyValue(e.target.value);
    onChange(type, style);
  }

  return (
    <select value={value} onChange={handleChange} className={className}>
      <option value="">All types</option>
      {Object.entries(taxonomy).map(([type, styles]) =>
        styles.length === 0 ? (
          <option key={type} value={type}>{type}</option>
        ) : (
          <optgroup key={type} label={type}>
            <option value={type}>All styles</option>
            {styles.map((style) => (
              <option key={style} value={`${type}||${style}`}>{style}</option>
            ))}
          </optgroup>
        )
      )}
    </select>
  );
}
