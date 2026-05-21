"use client";

import { useState, useEffect } from "react";
import type { WhyChooseThisEntry, PerfectForEntry } from "@/lib/types";

const WCT_CATEGORY_MAP: Record<number, string> = {
  0: "Stands Out",
  1: "Gift Impact",
  2: "Trusted Pick",
  3: "Worth Keeping",
};

interface Props {
  type: "why" | "perfect";
  slotIndex: number;
  slotLabel?: string;
  productType: string;
  productStyles: string[];
  onSelect: (phrase: string, icon: string, text?: string, subtext?: string) => void;
  onClose: () => void;
}

export default function SwapModal({ type, slotIndex, slotLabel, productType, productStyles, onSelect, onClose }: Props) {
  const [entries, setEntries] = useState<(WhyChooseThisEntry | PerfectForEntry)[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const stylesToFetch = productStyles.length > 0 ? productStyles : [""];
    const apiType = type === "why" ? "why" : "perfect";

    Promise.all(
      stylesToFetch.map((style) => {
        const params = new URLSearchParams({ type: apiType });
        if (productType) params.set("productType", productType);
        if (style) params.set("productStyle", style);
        if (type === "why") params.set("category", WCT_CATEGORY_MAP[slotIndex]);
        return fetch(`/api/library?${params}`).then((r) => r.json());
      })
    ).then((results) => {
      const seen = new Set<string>();
      const merged = results.flatMap((d) => d.entries as (WhyChooseThisEntry | PerfectForEntry)[])
        .filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
      setEntries(merged);
      setLoading(false);
    });
  }, [type, slotIndex, productType, productStyles.join(",")]);

  const filtered = entries.filter((e) => {
    if (type === "perfect" && (e as PerfectForEntry).timeSensitive) return false;
    const text = type === "why"
      ? `${(e as WhyChooseThisEntry).text} ${(e as WhyChooseThisEntry).subtext}`
      : (e as PerfectForEntry).phrase;
    return text.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
              {type === "why" ? "Why People Love This" : "Perfect For"}
            </p>
            <h3 className="font-semibold text-sm text-gray-900">
              {type === "why" ? slotLabel : "Select a phrase"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No entries found for this type/style</div>
          ) : type === "why" ? (
            <ul className="divide-y divide-gray-50">
              {(filtered as WhyChooseThisEntry[]).map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => onSelect("", "", e.text, e.subtext)}
                    className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors group"
                  >
                    <span className="font-medium text-gray-800 text-sm group-hover:text-gray-900">{e.text}</span>
                    {e.subtext && <span className="text-gray-500 text-sm"> — {e.subtext}</span>}
                    <div className="text-[11px] text-gray-400 mt-1">{e.productType} · {e.productStyle}</div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-gray-50">
              {(filtered as PerfectForEntry[]).map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => onSelect(e.phrase, e.icon)}
                    className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors group flex items-center gap-3"
                  >
                    {e.icon && (
                      <img
                        src={e.icon.startsWith("https://") ? e.icon : `/icons/${e.icon}.svg`}
                        alt=""
                        className="w-5 h-5 shrink-0 opacity-60 group-hover:opacity-90"
                      />
                    )}
                    <div className="min-w-0">
                      <span className="text-gray-800 text-sm group-hover:text-gray-900">{e.phrase}</span>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {e.productType} · {e.productStyle} · {e.category}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
