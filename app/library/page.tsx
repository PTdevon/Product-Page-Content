"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import { PRODUCT_TAXONOMY } from "@/data/taxonomy";
import type { WhyChooseThisEntry, PerfectForEntry } from "@/lib/types";
import type { WCTEdit, PFEdit } from "@/lib/library-edits-store";

const WCT_CATEGORIES = ["Stands Out", "Gift Impact", "Trusted Pick", "Worth Keeping"] as const;
const PF_CATEGORIES  = ["Occasion", "Person", "Context"] as const;

type WCTRow = WhyChooseThisEntry & { _edit: WCTEdit | null };
type PFRow  = PerfectForEntry  & { _edit: PFEdit  | null };

type PushEvent =
  | { type: "progress"; title: string; status: "updated" | "error" }
  | { type: "done"; total: number; updated: number; skipped: number; failed: number };

function IconImg({ icon, size = 20 }: { icon: string; size?: number }) {
  if (!icon) return <span className="text-gray-300 text-xs">—</span>;
  if (icon.startsWith("https://"))
    return <img src={icon} alt="" style={{ width: size, height: size }} className="object-contain" />;
  if (icon.startsWith("<svg"))
    return <span style={{ width: size, height: size, display: "inline-flex", alignItems: "center" }} dangerouslySetInnerHTML={{ __html: icon }} />;
  return <img src={`/icons/${icon}.svg`} alt={icon} style={{ width: size, height: size }} className="object-contain" />;
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

type SavedPatch = { id: string; text?: string; subtext?: string; phrase?: string };

interface EditModalProps {
  tab: "why" | "perfect";
  entry: WCTRow | PFRow | null; // null = new entry
  onClose: () => void;
  onSaved: (patch?: SavedPatch) => void;
  taxonomy: Record<string, string[]>;
}

function EditModal({ tab, entry, onClose, onSaved, taxonomy }: EditModalProps) {
  const isNew = !entry;

  // WCT fields
  const [text, setText]       = useState((entry as WCTRow)?.text ?? "");
  const [subtext, setSubtext] = useState((entry as WCTRow)?.subtext ?? "");

  // PF fields
  const [phrase, setPhrase]         = useState((entry as PFRow)?.phrase ?? "");
  const [timeSensitive, setTimeSensitive] = useState<string | null>((entry as PFRow)?.timeSensitive ?? null);

  // Shared for new entries
  const [productType, setProductType] = useState(entry?.productType ?? "");
  const [productStyle, setProductStyle] = useState(entry?.productStyle ?? "");
  const [category, setCategory] = useState(entry?.category ?? "");

  // Multi type/style for new PF entries
  const [typeStylePairs, setTypeStylePairs] = useState<{ type: string; style: string }[]>([]);
  const [addingType, setAddingType] = useState("");
  const [addingStyle, setAddingStyle] = useState("");
  const addingStyles = addingType ? (taxonomy[addingType] ?? []) : [];

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Find / update state
  const [findPhase, setFindPhase] = useState<"idle" | "finding" | "found" | "updating" | "done">("idle");
  const [foundProducts, setFoundProducts] = useState<{ id: string; title: string }[]>([]);
  const [updateLog, setUpdateLog] = useState<{ title: string; status: "updated" | "error" }[]>([]);
  const [updateResult, setUpdateResult] = useState<{ updated: number; skipped: number; failed: number } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const updatingRef = useRef(false);

  const availableStyles = productType ? (taxonomy[productType] ?? []) : [];

  const [justSaved, setJustSaved] = useState(false);
  const [savedConfirm, setSavedConfirm] = useState(false);
  const hasEdit = !!entry?._edit;
  const canFind = !isNew && (justSaved || (hasEdit && !entry._edit!.isNew));

  async function handleSave() {
    setSaving(true);
    setSaveError("");

    // New PF entry: create one library entry per type/style pair
    if (isNew && tab === "perfect") {
      if (!phrase.trim()) { setSaveError("Enter a phrase"); setSaving(false); return; }
      if (typeStylePairs.length === 0) { setSaveError("Add at least one product type"); setSaving(false); return; }
      if (!category) { setSaveError("Select a category"); setSaving(false); return; }
      let created = 0;
      for (const pair of typeStylePairs) {
        const res = await fetch("/api/library/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "pf", entry: { productType: pair.type, productStyle: pair.style || "ALL", category, phrase: phrase.trim(), icon: "", timeSensitive: timeSensitive, filterByInterest: false, applicabilityCount: 0, searchPhrase: "" } }),
        });
        if (!res.ok) {
          if (created > 0) { setTypeStylePairs((prev) => prev.slice(created)); onSaved(); }
          setSaveError(`Saved ${created} of ${typeStylePairs.length} — please retry the rest`);
          setSaving(false);
          return;
        }
        created++;
      }
      setSaving(false);
      onSaved();
      onClose();
      return;
    }

    const body = tab === "why"
      ? {
          type: "wct",
          entry: {
            id: entry?.id,
            productType: isNew ? productType : entry!.productType,
            productStyle: isNew ? productStyle : entry!.productStyle,
            category: isNew ? category : entry!.category,
            text, subtext,
            searchFormatted: (entry as WCTRow)?._edit?.searchFormatted ?? "",
          },
        }
      : {
          type: "pf",
          entry: {
            id: entry?.id,
            productType: entry!.productType,
            productStyle: entry!.productStyle,
            category: entry!.category,
            phrase,
            icon: (entry as PFRow)?.icon ?? "",
            timeSensitive: timeSensitive,
            filterByInterest: (entry as PFRow)?.filterByInterest ?? false,
            applicabilityCount: (entry as PFRow)?.applicabilityCount ?? 0,
            searchPhrase: (entry as PFRow)?._edit?.searchPhrase ?? "",
          },
        };

    const res = await fetch("/api/library/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSaveError(err.error ?? "Save failed — please try again");
      return;
    }
    if (!isNew) {
      const patch: SavedPatch = tab === "why"
        ? { id: entry!.id, text, subtext }
        : { id: entry!.id, phrase };
      onSaved(patch);
      setJustSaved(true);
      setSavedConfirm(true);
      setTimeout(() => setSavedConfirm(false), 2000);
      return;
    }
    onSaved();
    onClose();
  }

  async function handleFind() {
    if (!entry) return;
    setFindPhase("finding");
    setFoundProducts([]);
    try {
      const res = await fetch("/api/library/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: tab === "why" ? "wct" : "pf", id: entry.id }),
      });
      const data = res.ok ? await res.json() : { products: [] };
      setFoundProducts(data.products ?? []);
      setFindPhase("found");
    } catch {
      setFindPhase("idle");
    }
  }

  async function handleUpdate() {
    if (!entry || updatingRef.current) return;
    updatingRef.current = true;
    setFindPhase("updating");
    setUpdateLog([]);
    setUpdateResult(null);

    const res = await fetch("/api/library/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: tab === "why" ? "wct" : "pf", id: entry.id }),
    });

    if (!res.ok || !res.body) {
      updatingRef.current = false;
      setFindPhase("found");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedDone = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as PushEvent;
            if (event.type === "progress") {
              setUpdateLog((prev) => [...prev, { title: event.title, status: event.status }]);
              setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 0);
            } else if (event.type === "done") {
              setUpdateResult({ updated: event.updated, skipped: event.skipped, failed: event.failed });
              setFindPhase("done");
              receivedDone = true;
            }
          } catch { /* ignore malformed SSE frame */ }
        }
        if (receivedDone) break;
      }
    } catch { /* network error mid-stream */ } finally {
      updatingRef.current = false;
    }

    onSaved();
    if (!receivedDone) setFindPhase("found");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            {isNew ? (tab === "why" ? "New Why Choose This entry" : "New Perfect For entry") : "Edit entry"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Fields */}
        <div className="px-6 py-4 space-y-4">
          {/* New WCT entry: single type/style/category */}
          {isNew && tab === "why" && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Product Type</label>
                <select value={productType} onChange={(e) => { setProductType(e.target.value); setProductStyle(""); }}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select type…</option>
                  {Object.keys(taxonomy).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Product Style</label>
                <select value={productStyle} onChange={(e) => setProductStyle(e.target.value)} disabled={!productType}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40">
                  <option value="">Select style…</option>
                  {availableStyles.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select category…</option>
                  {WCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>
          )}

          {/* New PF entry: phrase + category + multi type/style */}
          {isNew && tab === "perfect" && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Phrase</label>
                <input type="text" value={phrase} onChange={(e) => setPhrase(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select category…</option>
                  {PF_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Seasonal Occasion</label>
                <select value={timeSensitive ?? ""} onChange={(e) => setTimeSensitive(e.target.value || null)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">None</option>
                  <option value="mothers-day">Mother&apos;s Day</option>
                  <option value="fathers-day">Father&apos;s Day</option>
                  <option value="valentines-day">Valentine&apos;s Day</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Product Types</label>
                <div className="space-y-2">
                  {typeStylePairs.map((pair, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700">
                        {pair.type}{pair.style ? ` · ${pair.style}` : ""}
                      </span>
                      <button onClick={() => setTypeStylePairs((prev) => prev.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 transition-colors">&times;</button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <select value={addingType} onChange={(e) => { setAddingType(e.target.value); setAddingStyle(""); }}
                      className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Add type…</option>
                      {Object.keys(taxonomy).map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {addingStyles.length > 0 && (
                      <select value={addingStyle} onChange={(e) => setAddingStyle(e.target.value)}
                        className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">All styles</option>
                        {addingStyles.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                    {addingType && (
                      <button
                        onClick={() => { setTypeStylePairs((prev) => [...prev, { type: addingType, style: addingStyle }]); setAddingType(""); setAddingStyle(""); }}
                        className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                      >Add</button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "why" ? (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Text (bold)</label>
                <input type="text" value={text} onChange={(e) => { setText(e.target.value); setJustSaved(false); }}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Subtext</label>
                <input type="text" value={subtext} onChange={(e) => { setSubtext(e.target.value); setJustSaved(false); }}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {!isNew && (
                <div className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2">
                  Preview: <strong>{text}</strong> {subtext}
                </div>
              )}
            </>
          ) : !isNew && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Phrase</label>
                <input type="text" value={phrase} onChange={(e) => { setPhrase(e.target.value); setJustSaved(false); }}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {tab === "perfect" && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Seasonal Occasion</label>
                  <select value={timeSensitive ?? ""} onChange={(e) => { setTimeSensitive(e.target.value || null); setJustSaved(false); }}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">None</option>
                    <option value="mothers-day">Mother&apos;s Day</option>
                    <option value="fathers-day">Father&apos;s Day</option>
                    <option value="valentines-day">Valentine&apos;s Day</option>
                  </select>
                </div>
              )}
            </>
          )}

          {saveError && <p className="text-red-600 text-xs">{saveError}</p>}
        </div>

        {/* Find / update panel */}
        {findPhase !== "idle" && (
          <div className="mx-6 mb-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
              {findPhase === "finding" && "Searching products…"}
              {findPhase === "found" && `${foundProducts.length} product${foundProducts.length !== 1 ? "s" : ""} found`}
              {findPhase === "updating" && "Updating products…"}
              {findPhase === "done" && updateResult && `Done — ${updateResult.updated} updated · ${updateResult.skipped} skipped · ${updateResult.failed} failed`}
            </div>
            <div ref={logRef} className="max-h-36 overflow-y-auto p-3 space-y-0.5 font-mono text-xs">
              {findPhase === "finding" && <div className="text-gray-400">Scanning products…</div>}
              {findPhase === "found" && foundProducts.length === 0 && <div className="text-gray-500">No products found</div>}
              {findPhase === "found" && foundProducts.map((p) => (
                <div key={p.id} className="text-gray-700">{p.title}</div>
              ))}
              {(findPhase === "updating" || findPhase === "done") && updateLog.length === 0 && findPhase === "updating" && (
                <div className="text-gray-400">Starting…</div>
              )}
              {(findPhase === "updating" || findPhase === "done") && updateLog.map((e, i) => (
                <div key={i} className={e.status === "updated" ? "text-green-700" : "text-red-600"}>
                  {e.status === "updated" ? "✓" : "✗"} {e.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={findPhase === "updating"}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            {findPhase === "done" ? "Close" : "Cancel"}
          </button>
          <div className="flex-1" />

          {findPhase === "idle" && (
            <>
              {canFind && (
                <button onClick={handleFind} disabled={saving}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-40 transition-colors">
                  Find Products Using This Phrase
                </button>
              )}
              <button onClick={handleSave} disabled={saving || savedConfirm}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-40 transition-colors">
                {saving ? "Saving…" : savedConfirm ? "Saved ✓" : "Save"}
              </button>
            </>
          )}

          {findPhase === "finding" && (
            <button disabled className="px-4 py-2 text-sm border border-gray-300 rounded opacity-40">
              Searching…
            </button>
          )}

          {findPhase === "found" && (
            <>
              <button
                onClick={() => { setFindPhase("idle"); setFoundProducts([]); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleUpdate}
                disabled={foundProducts.length === 0}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {foundProducts.length > 0 ? `Update All (${foundProducts.length})` : "Update All"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  return <Suspense><LibraryPageInner /></Suspense>;
}

function LibraryPageInner() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"why" | "perfect">(searchParams.get("tab") === "perfect" ? "perfect" : "why");

  useEffect(() => {
    setTab(searchParams.get("tab") === "perfect" ? "perfect" : "why");
  }, [searchParams]);

  const [taxonomy, setTaxonomy] = useState<Record<string, string[]>>(PRODUCT_TAXONOMY);
  const [productType, setProductType] = useState(searchParams.get("type") ?? "");
  const [productStyle, setProductStyle] = useState(searchParams.get("style") ?? "");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  const [entries, setEntries] = useState<(WCTRow | PFRow)[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editTarget, setEditTarget] = useState<WCTRow | PFRow | null | undefined>(undefined); // undefined = closed
  const [addingNew, setAddingNew] = useState(false);

  useEffect(() => {
    fetch("/api/taxonomy").then((r) => r.ok ? r.json() : null).then((d) => { if (d?.taxonomy) setTaxonomy(d.taxonomy); }).catch(() => {});
  }, []);

  const availableStyles = productType ? (taxonomy[productType] ?? []) : [];

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: tab === "why" ? "why" : "perfect" });
    if (productType) params.set("productType", productType);
    if (productStyle) params.set("productStyle", productStyle);
    if (category) params.set("category", category);
    if (search) params.set("search", search);

    const res = await fetch(`/api/library?${params}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setEntries(data.entries ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [tab, productType, productStyle, category, search]);

  useEffect(() => {
    setCategory(""); setProductStyle(""); setEntries([]);
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { setProductStyle(""); }, [productType]);

  function closeModal() { setEditTarget(undefined); setAddingNew(false); }
  function afterSave(patch?: SavedPatch) {
    if (patch) {
      setEntries((prev) => prev.map((e) => e.id === patch.id ? { ...e, ...patch } : e));
    } else {
      fetchEntries();
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <Nav active={tab === "perfect" ? "perfect-for" : "library"} subActive={tab === "perfect" ? "phrases" : undefined} />

      {/* Filter bar */}
      <div className="border-b border-gray-200 px-4 py-3 flex gap-3 items-center bg-white shrink-0 flex-wrap">
        <input type="search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <select value={productType} onChange={(e) => setProductType(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="">All types</option>
          {Object.keys(taxonomy).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={productStyle} onChange={(e) => setProductStyle(e.target.value)} disabled={!productType}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-40">
          <option value="">All styles</option>
          {availableStyles.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="">All categories</option>
          {(tab === "why" ? WCT_CATEGORIES : PF_CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-sm text-gray-400">
          {loading ? "Loading…" : `${total} ${total === 1 ? "entry" : "entries"}`}
        </span>
        <div className="flex-1" />
        <button onClick={() => setAddingNew(true)}
          className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 transition-colors">
          + Add new
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="max-w-5xl mx-auto px-6 py-4">
          {tab === "why" ? (
            <WctTable entries={entries as WCTRow[]} loading={loading} onEdit={setEditTarget} />
          ) : (
            <PfTable entries={entries as PFRow[]} loading={loading} onEdit={setEditTarget} />
          )}
        </div>
      </div>

      {/* Edit modal */}
      {(editTarget !== undefined || addingNew) && (
        <EditModal
          tab={tab}
          entry={addingNew ? null : editTarget!}
          onClose={closeModal}
          onSaved={afterSave}
          taxonomy={taxonomy}
        />
      )}
    </div>
  );
}

// ── Tables ────────────────────────────────────────────────────────────────────

function WctTable({ entries, loading, onEdit }: { entries: WCTRow[]; loading: boolean; onEdit: (e: WCTRow) => void }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
        <tr>
          <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Type</th>
          <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Style</th>
          <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs uppercase tracking-wide w-40">Category</th>
          <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Text</th>
          <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Subtext</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {loading && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>}
        {!loading && entries.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No entries found</td></tr>}
        {entries.map((e) => (
          <tr key={e.id} onClick={() => onEdit(e)} className={`cursor-pointer hover:bg-gray-50 ${e._edit && !e._edit.isNew ? "bg-amber-50" : ""}`}>
            <td className="px-4 py-3 text-gray-500">{e.productType}</td>
            <td className="px-4 py-3 text-gray-500">{e.productStyle}</td>
            <td className="px-4 py-3 w-40">
              <span className="px-2 py-0.5 rounded-full text-sm bg-blue-50 text-blue-700 whitespace-nowrap">{e.category}</span>
            </td>
            <td className="px-4 py-3 font-medium text-gray-900">{e.text}</td>
            <td className="px-4 py-3 text-gray-500">{e.subtext}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type SortCol = "phrase" | "category" | "productType" | "productStyle" | "filterByInterest" | "timeSensitive";

function PfTable({ entries, loading, onEdit }: { entries: PFRow[]; loading: boolean; onEdit: (e: PFRow) => void }) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const sorted = sortCol
    ? [...entries].sort((a, b) => {
        if (sortCol === "filterByInterest") {
          const av = a.filterByInterest ? 1 : 0;
          const bv = b.filterByInterest ? 1 : 0;
          return sortDir === "asc" ? av - bv : bv - av;
        }
        const av = (sortCol === "timeSensitive" ? a.timeSensitive : a[sortCol as Exclude<SortCol, "timeSensitive" | "filterByInterest">]) ?? "";
        const bv = (sortCol === "timeSensitive" ? b.timeSensitive : b[sortCol as Exclude<SortCol, "timeSensitive" | "filterByInterest">]) ?? "";
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      })
    : entries;

  function SortHeader({ col, label }: { col: SortCol; label: string }) {
    const active = sortCol === col;
    return (
      <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">
        <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-gray-900 transition-colors">
          {label}
          <span className={active ? "text-gray-900" : "text-gray-300"}>
            {active && sortDir === "desc" ? "↓" : "↑"}
          </span>
        </button>
      </th>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
        <tr>
          <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Icon</th>
          <SortHeader col="phrase" label="Phrase" />
          <SortHeader col="category" label="Category" />
          <SortHeader col="productType" label="Type" />
          <SortHeader col="productStyle" label="Style" />
          <SortHeader col="filterByInterest" label="Interest" />
          <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs w-36">
            <button onClick={() => toggleSort("timeSensitive")} className="flex items-center gap-1 hover:text-gray-900 transition-colors">
              Seasonal
              <span className={sortCol === "timeSensitive" ? "text-gray-900" : "text-gray-300"}>
                {sortCol === "timeSensitive" && sortDir === "desc" ? "↓" : "↑"}
              </span>
            </button>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>}
        {!loading && sorted.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No entries found</td></tr>}
        {sorted.map((e) => (
          <tr key={e.id} onClick={() => onEdit(e)} className={`cursor-pointer hover:bg-gray-50 ${e._edit && !e._edit.isNew ? "bg-amber-50" : ""}`}>
            <td className="px-4 py-3"><IconImg icon={e.icon} size={20} /></td>
            <td className="px-4 py-3 font-medium text-gray-900">{e.phrase}</td>
            <td className="px-4 py-3">
              <span className="px-2 py-0.5 rounded-full text-sm bg-purple-50 text-purple-700">{e.category}</span>
            </td>
            <td className="px-4 py-3 text-gray-500">{e.productType}</td>
            <td className="px-4 py-3 text-gray-500">{e.productStyle}</td>
            <td className="px-4 py-3">
              {e.filterByInterest && <span className="px-2 py-0.5 rounded-full text-sm bg-green-50 text-green-700">Yes</span>}
            </td>
            <td className="px-4 py-3">
              {e.timeSensitive === "mothers-day" && <span className="px-2 py-0.5 rounded-full text-xs bg-pink-50 text-pink-700">Mother&apos;s Day</span>}
              {e.timeSensitive === "fathers-day" && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">Father&apos;s Day</span>}
              {e.timeSensitive === "valentines-day" && <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700">Valentine&apos;s Day</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
