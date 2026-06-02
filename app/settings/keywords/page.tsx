"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import { PRODUCT_TAXONOMY } from "@/data/taxonomy";
import type { AppSettings, PerfectForEntry } from "@/lib/types";

const ALL_TYPES = Object.keys(PRODUCT_TAXONOMY);

type ScopeEntry = { id: string; productType: string; productStyle: string };

// ── Scope Modal ───────────────────────────────────────────────────────────────

interface ScopeModalProps {
  phrase: string;
  scopes: ScopeEntry[];
  onClose: () => void;
  onScopeAdded: (phrase: string, scope: ScopeEntry) => void;
  onScopeRemoved: (phrase: string, id: string) => void;
}

function ScopeModal({ phrase, scopes, onClose, onScopeAdded, onScopeRemoved }: ScopeModalProps) {
  const [scopeAdd, setScopeAdd] = useState({ type: "", style: "" });
  const [scopeLoading, setScopeLoading] = useState<Record<string, boolean>>({});
  const availableStyles = scopeAdd.type ? (PRODUCT_TAXONOMY[scopeAdd.type] ?? []) : [];

  async function removeScope(id: string) {
    setScopeLoading((prev) => ({ ...prev, [id]: true }));
    await fetch("/api/library/entry", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "pf", id }),
    });
    onScopeRemoved(phrase, id);
    setScopeLoading((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function handleAddScope() {
    if (!scopeAdd.type) return;
    const style = scopeAdd.style || "ALL";
    setScopeLoading((prev) => ({ ...prev, add: true }));
    const res = await fetch("/api/library/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "pf",
        entry: { productType: scopeAdd.type, productStyle: style, category: "Person", phrase, icon: "", timeSensitive: null, filterByInterest: true, applicabilityCount: 0 },
      }),
    });
    if (res.ok) {
      const { id } = await res.json() as { id: string };
      onScopeAdded(phrase, { id, productType: scopeAdd.type, productStyle: style });
      setScopeAdd({ type: "", style: "" });
    }
    setScopeLoading((prev) => { const n = { ...prev }; delete n.add; return n; });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{phrase} — Product types</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">This phrase will only be assigned to products of these types. Remove a type to stop the phrase appearing there, or add a new one.</p>

          <div className="flex flex-wrap gap-1.5">
            {scopes.map(({ id, productType, productStyle }) => (
              <span key={id} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                {productType}{productStyle !== "ALL" ? ` · ${productStyle}` : ""}
                <button
                  onClick={() => removeScope(id)}
                  disabled={!!scopeLoading[id]}
                  className="text-gray-400 hover:text-red-500 font-medium leading-none disabled:opacity-40 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
            {scopes.length === 0 && <p className="text-sm text-gray-400">No types assigned yet.</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <select
              value={scopeAdd.type}
              onChange={(e) => setScopeAdd({ type: e.target.value, style: "" })}
              className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-md text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Add product type…</option>
              {ALL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {availableStyles.length > 0 && (
              <select
                value={scopeAdd.style}
                onChange={(e) => setScopeAdd((prev) => ({ ...prev, style: e.target.value }))}
                className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-md text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All styles</option>
                {availableStyles.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {scopeAdd.type && (
              <button
                onClick={handleAddScope}
                disabled={!!scopeLoading.add}
                className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {scopeLoading.add ? "…" : "Add"}
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KeywordsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [rawKeywords, setRawKeywords] = useState<Record<string, string>>({});
  const [phraseScopes, setPhraseScopes] = useState<Record<string, ScopeEntry[]>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [saveError, setSaveError] = useState("");
  const [editingPhrase, setEditingPhrase] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deletingPhrase, setDeletingPhrase] = useState<string | null>(null);
  const [showAddPhrase, setShowAddPhrase] = useState(false);
  const [newPhraseName, setNewPhraseName] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/library?type=perfect").then((r) => r.json()),
    ]).then(([s, lib]: [AppSettings, { entries: PerfectForEntry[] }]) => {
      setSettings(s);
      const raw: Record<string, string> = {};
      for (const [phrase, kws] of Object.entries(s.interestKeywords ?? {})) {
        raw[phrase] = kws.join("\n");
      }
      setRawKeywords(raw);
      const scopes: Record<string, ScopeEntry[]> = {};
      for (const entry of lib.entries ?? []) {
        if (!entry.filterByInterest) continue;
        if (!scopes[entry.phrase]) scopes[entry.phrase] = [];
        scopes[entry.phrase].push({ id: entry.id, productType: entry.productType, productStyle: entry.productStyle });
      }
      setPhraseScopes(scopes);
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

  async function deletePhrase(phrase: string) {
    setDeletingPhrase(phrase);
    const scopes = phraseScopes[phrase] ?? [];
    await Promise.all(scopes.map((s) =>
      fetch("/api/library/entry", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pf", id: s.id }),
      })
    ));
    setRawKeywords((prev) => { const n = { ...prev }; delete n[phrase]; return n; });
    setPhraseScopes((prev) => { const n = { ...prev }; delete n[phrase]; return n; });
    setSettings((prev) => {
      if (!prev) return prev;
      const kw = { ...prev.interestKeywords };
      delete kw[phrase];
      return { ...prev, interestKeywords: kw };
    });
    setDeletingPhrase(null);
  }

  function addPhrase() {
    const name = newPhraseName.trim();
    if (!name) return;
    setRawKeywords((prev) => ({ ...prev, [name]: "" }));
    setPhraseScopes((prev) => ({ ...prev, [name]: [] }));
    setSettings((prev) => prev ? { ...prev, interestKeywords: { ...prev.interestKeywords, [name]: [] } } : prev);
    setNewPhraseName("");
    setShowAddPhrase(false);
  }

  const phrases = Object.keys(rawKeywords);

  return (
    <div className="flex flex-col min-h-screen">
      <Nav active="perfect-for" subActive="keywords" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          <div className="text-sm text-gray-500 mb-6 space-y-2">
            <p>
              Each phrase below only appears on products genuinely relevant to that interest — for example,
              <em> Travel lovers</em> shouldn&apos;t appear on a kitchen gift.
            </p>
            <p>
              We check whether a product&apos;s title or description contains any of the listed keywords.
              If none match, the phrase is skipped. Edit the keyword list directly, or click <strong>Edit types</strong> to
              change which product types the phrase applies to.
            </p>
          </div>

          {loadingSettings ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                {phrases.map((phrase) => {
                  const scopes = phraseScopes[phrase] ?? [];
                  return (
                    <div key={phrase} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3">

                      {/* Header */}
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-gray-800">{phrase}</p>
                        <div className="flex items-center gap-3 shrink-0">
                          {confirmingDelete === phrase ? (
                            <>
                              <span className="text-xs text-gray-500">Are you sure?</span>
                              <button
                                onClick={() => { setConfirmingDelete(null); deletePhrase(phrase); }}
                                disabled={deletingPhrase === phrase}
                                className="text-xs text-red-600 hover:underline disabled:opacity-40"
                              >
                                {deletingPhrase === phrase ? "Deleting…" : "Yes"}
                              </button>
                              <button onClick={() => setConfirmingDelete(null)} className="text-xs text-gray-400 hover:underline">No</button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmingDelete(phrase)}
                              className="text-gray-300 hover:text-red-500 transition-colors leading-none text-base"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Scope badges */}
                      <div className="flex flex-wrap items-center gap-1">
                        {scopes.map(({ id, productType, productStyle }) => (
                          <span key={id} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                            {productType}{productStyle !== "ALL" ? ` · ${productStyle}` : ""}
                          </span>
                        ))}
                        <button onClick={() => setEditingPhrase(phrase)} className="text-xs text-blue-600 hover:underline">
                          Edit types
                        </button>
                      </div>

                      {/* Keywords */}
                      <textarea
                        value={rawKeywords[phrase] ?? ""}
                        onChange={(e) => setRawKeywords((prev) => ({ ...prev, [phrase]: e.target.value }))}
                        placeholder="One keyword per line…"
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[120px]"
                      />
                    </div>
                  );
                })}
              </div>

              {showAddPhrase ? (
                <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4 flex gap-2 items-center">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Phrase name e.g. Dog Lovers"
                    value={newPhraseName}
                    onChange={(e) => setNewPhraseName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addPhrase(); if (e.key === "Escape") { setShowAddPhrase(false); setNewPhraseName(""); } }}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={addPhrase} className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 transition-colors">Add</button>
                  <button onClick={() => { setShowAddPhrase(false); setNewPhraseName(""); }} className="px-4 py-1.5 border border-gray-300 text-sm rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddPhrase(true)}
                  className="mt-4 px-4 py-3 border border-dashed border-gray-300 text-sm text-gray-500 rounded-lg hover:border-gray-400 hover:text-gray-700 w-full transition-colors"
                >
                  + Add new phrase
                </button>
              )}

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

      {editingPhrase && (
        <ScopeModal
          phrase={editingPhrase}
          scopes={phraseScopes[editingPhrase] ?? []}
          onClose={() => setEditingPhrase(null)}
          onScopeAdded={(phrase, scope) => setPhraseScopes((prev) => ({ ...prev, [phrase]: [...(prev[phrase] ?? []), scope] }))}
          onScopeRemoved={(phrase, id) => setPhraseScopes((prev) => ({ ...prev, [phrase]: (prev[phrase] ?? []).filter((s) => s.id !== id) }))}
        />
      )}
    </div>
  );
}
