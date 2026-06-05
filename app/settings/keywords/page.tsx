"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import type { AppSettings, PerfectForEntry } from "@/lib/types";

export default function KeywordsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [rawKeywords, setRawKeywords] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/library?type=perfect").then((r) => r.json()),
    ]).then(([s, lib]: [AppSettings, { entries: PerfectForEntry[] }]) => {
      setSettings(s);
      // Start from saved keywords
      const raw: Record<string, string> = {};
      for (const [phrase, kws] of Object.entries(s.interestKeywords ?? {})) {
        raw[phrase] = kws.join("\n");
      }
      // Add any library phrases marked as interest filter that aren't in settings yet
      const seen = new Set<string>();
      for (const entry of lib.entries ?? []) {
        if (!entry.filterByInterest) continue;
        if (seen.has(entry.phrase)) continue;
        seen.add(entry.phrase);
        if (!(entry.phrase in raw)) raw[entry.phrase] = "";
      }
      setRawKeywords(raw);
      setLoadingSettings(false);
    });
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setSaveError("");
    const interestKeywords: Record<string, string[]> = {};
    for (const [phrase, raw] of Object.entries(rawKeywords)) {
      interestKeywords[phrase] = raw.split("\n").map((k) => k.trim()).filter(Boolean);
    }
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings, interestKeywords }),
    });
    setSaving(false);
    if (!res.ok) {
      setSaveError("Save failed — please try again");
    } else {
      setSavedMsg("Saved");
      setTimeout(() => setSavedMsg(""), 3000);
    }
  }

  const phrases = Object.keys(rawKeywords);

  return (
    <div className="flex flex-col min-h-screen">
      <Nav active="perfect-for" subActive="keywords" helpText={"Manage keywords for interest-filtered Perfect For phrases.\nPhrases only appear on products whose title or description contains at least one of their keywords.\nTo add or remove phrases from this list, tick or untick 'Apply interest filter' on the Phrases tab."} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          <div className="text-sm text-gray-500 mb-6">
            <p>
              Phrases below only appear on products genuinely relevant to that interest. Add keywords — if any appear in a product&apos;s title or description, the phrase will be assigned to it.
              To add or remove phrases from this list, tick or untick <strong>Apply interest filter</strong> on the Phrases tab.
            </p>
          </div>

          {loadingSettings ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : phrases.length === 0 ? (
            <p className="text-sm text-gray-400">
              No interest filter phrases set up yet. Tick <strong>Apply interest filter</strong> on a phrase in the Phrases tab to get started.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                {phrases.map((phrase) => (
                  <div key={phrase} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
                    <p className="font-medium text-sm text-gray-800">{phrase}</p>
                    <textarea
                      value={rawKeywords[phrase] ?? ""}
                      onChange={(e) => setRawKeywords((prev) => ({ ...prev, [phrase]: e.target.value }))}
                      placeholder="One keyword per line…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[300px]"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 mt-6">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-black text-white text-sm font-semibold rounded-md hover:bg-gray-900 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : "Save keywords"}
                </button>
                {savedMsg && <span className="text-emerald-600 text-sm">{savedMsg}</span>}
                {saveError && <span className="text-red-500 text-sm">{saveError}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
