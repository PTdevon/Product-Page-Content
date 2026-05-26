"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Nav from "@/components/Nav";
import { PRODUCT_TAXONOMY } from "@/data/taxonomy";
import type { WhyChooseThisEntry, PerfectForEntry } from "@/lib/types";
import type { WCTEdit, PFEdit } from "@/lib/library-edits-store";

const WCT_CATEGORIES = ["Stands Out", "Gift Impact", "Trusted Pick", "Worth Keeping"] as const;
const PF_CATEGORIES  = ["Occasion", "Person", "Context"] as const;
const ALL_TYPES = Object.keys(PRODUCT_TAXONOMY);

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
  return <span className="text-gray-400 text-xs">{icon}</span>;
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

interface EditModalProps {
  tab: "why" | "perfect";
  entry: WCTRow | PFRow | null; // null = new entry
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ tab, entry, onClose, onSaved }: EditModalProps) {
  const isNew = !entry;

  // WCT fields
  const [text, setText]       = useState((entry as WCTRow)?.text ?? "");
  const [subtext, setSubtext] = useState((entry as WCTRow)?.subtext ?? "");

  // PF fields
  const [phrase, setPhrase]   = useState((entry as PFRow)?.phrase ?? "");

  // Shared for new entries
  const [productType, setProductType] = useState(entry?.productType ?? "");
  const [productStyle, setProductStyle] = useState(entry?.productStyle ?? "");
  const [category, setCategory] = useState(entry?.category ?? "");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Push state
  const [pushLog, setPushLog] = useState<PushEvent[]>([]);
  const [pushDone, setPushDone] = useState<{ updated: number; skipped: number; failed: number } | null>(null);
  const [pushing, setPushing] = useState(false);
  const pushRef = useRef<HTMLDivElement>(null);

  const availableStyles = productType ? (PRODUCT_TAXONOMY[productType] ?? []) : [];

  const hasEdit = !!entry?._edit;
  const canPush = hasEdit && !entry._edit!.isNew;

  async function handleSave() {
    setSaving(true);
    setSaveError("");

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
            productType: isNew ? productType : entry!.productType,
            productStyle: isNew ? productStyle : entry!.productStyle,
            category: isNew ? category : entry!.category,
            phrase,
            icon: (entry as PFRow)?.icon ?? "",
            timeSensitive: (entry as PFRow)?.timeSensitive ?? null,
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
    if (!res.ok) { setSaveError("Save failed — please try again"); return; }
    onSaved();
    if (!isNew) return; // keep modal open for push
    onClose();
  }

  async function handlePush() {
    if (!entry || pushing) return;
    setPushing(true);
    setPushLog([]);
    setPushDone(null);

    const res = await fetch("/api/library/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: tab === "why" ? "wct" : "pf", id: entry.id }),
    });

    if (!res.ok || !res.body) { setPushing(false); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

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
            setPushLog((prev) => [...prev, event]);
            setTimeout(() => { if (pushRef.current) pushRef.current.scrollTop = pushRef.current.scrollHeight; }, 0);
          } else if (event.type === "done") {
            setPushDone({ updated: event.updated, skipped: event.skipped, failed: event.failed });
          }
        } catch { /* ignore */ }
      }
    }

    setPushing(false);
    onSaved(); // refresh table after push updates searchFormatted
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
          {isNew && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Product Type</label>
                <select value={productType} onChange={(e) => { setProductType(e.target.value); setProductStyle(""); }}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select type…</option>
                  {ALL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
                  {(tab === "why" ? WCT_CATEGORIES : PF_CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>
          )}

          {tab === "why" ? (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Text (bold)</label>
                <input type="text" value={text} onChange={(e) => setText(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Subtext</label>
                <input type="text" value={subtext} onChange={(e) => setSubtext(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {!isNew && (
                <div className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2">
                  Preview: <strong>{text}</strong> {subtext}
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Phrase</label>
              <input type="text" value={phrase} onChange={(e) => setPhrase(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {saveError && <p className="text-red-600 text-xs">{saveError}</p>}
        </div>

        {/* Push progress */}
        {(pushLog.length > 0 || pushing || pushDone) && (
          <div className="mx-6 mb-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
              {pushing ? "Pushing to products…" : pushDone ? `Done — ${pushDone.updated} updated · ${pushDone.skipped} skipped · ${pushDone.failed} failed` : ""}
            </div>
            <div ref={pushRef} className="max-h-36 overflow-y-auto p-3 space-y-0.5 font-mono text-xs">
              {pushLog.map((e, i) =>
                e.type === "progress" ? (
                  <div key={i} className={e.status === "updated" ? "text-green-700" : "text-red-600"}>
                    {e.status === "updated" ? "✓" : "✗"} {e.title}
                  </div>
                ) : null
              )}
              {pushing && pushLog.length === 0 && <div className="text-gray-400">Scanning products…</div>}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors">
            {pushDone ? "Close" : "Cancel"}
          </button>
          <div className="flex-1" />
          {canPush && !pushDone && (
            <button onClick={handlePush} disabled={pushing || saving}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors">
              {pushing ? "Pushing…" : "Push to products"}
            </button>
          )}
          {!pushDone && (
            <button onClick={handleSave} disabled={saving || pushing}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-40 transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [tab, setTab] = useState<"why" | "perfect">("why");

  const [productType, setProductType] = useState("");
  const [productStyle, setProductStyle] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  const [entries, setEntries] = useState<(WCTRow | PFRow)[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editTarget, setEditTarget] = useState<WCTRow | PFRow | null | undefined>(undefined); // undefined = closed
  const [addingNew, setAddingNew] = useState(false);

  const availableStyles = productType ? (PRODUCT_TAXONOMY[productType] ?? []) : [];

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
  function afterSave() { fetchEntries(); }

  return (
    <div className="flex flex-col h-screen">
      <Nav active="library" />

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white px-4 flex shrink-0">
        {(["why", "perfect"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "why" ? "Why Choose This" : "Perfect For"}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="border-b border-gray-200 px-4 py-3 flex gap-3 items-center bg-white shrink-0 flex-wrap">
        <input type="search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <select value={productType} onChange={(e) => setProductType(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="">All types</option>
          {ALL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
      <div className="flex-1 overflow-y-auto">
        {tab === "why" ? (
          <WctTable entries={entries as WCTRow[]} loading={loading} onEdit={setEditTarget} />
        ) : (
          <PfTable entries={entries as PFRow[]} loading={loading} onEdit={setEditTarget} />
        )}
      </div>

      {/* Edit modal */}
      {(editTarget !== undefined || addingNew) && (
        <EditModal
          tab={tab}
          entry={addingNew ? null : editTarget!}
          onClose={closeModal}
          onSaved={afterSave}
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
          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Type</th>
          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Style</th>
          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Category</th>
          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Text</th>
          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Subtext</th>
          <th className="w-16 px-4 py-2.5"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>}
        {!loading && entries.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No entries found</td></tr>}
        {entries.map((e) => (
          <tr key={e.id} className={`hover:bg-gray-50 ${e._edit && !e._edit.isNew ? "bg-amber-50" : ""}`}>
            <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{e.productType}</td>
            <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{e.productStyle}</td>
            <td className="px-4 py-2.5">
              <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">{e.category}</span>
            </td>
            <td className="px-4 py-2.5 font-medium text-gray-900">{e.text}</td>
            <td className="px-4 py-2.5 text-gray-500">{e.subtext}</td>
            <td className="px-4 py-2.5 text-right">
              <button onClick={() => onEdit(e)} className="text-xs text-blue-600 hover:underline">Edit</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PfTable({ entries, loading, onEdit }: { entries: PFRow[]; loading: boolean; onEdit: (e: PFRow) => void }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
        <tr>
          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Icon</th>
          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Phrase</th>
          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Category</th>
          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Type</th>
          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Style</th>
          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Seasonal</th>
          <th className="w-16 px-4 py-2.5"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>}
        {!loading && entries.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No entries found</td></tr>}
        {entries.map((e) => (
          <tr key={e.id} className={`hover:bg-gray-50 ${e._edit && !e._edit.isNew ? "bg-amber-50" : ""}`}>
            <td className="px-4 py-2.5"><IconImg icon={e.icon} size={22} /></td>
            <td className="px-4 py-2.5 font-medium text-gray-900">{e.phrase}</td>
            <td className="px-4 py-2.5">
              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700">{e.category}</span>
            </td>
            <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{e.productType}</td>
            <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{e.productStyle}</td>
            <td className="px-4 py-2.5 text-xs">
              {e.timeSensitive
                ? <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{e.timeSensitive}</span>
                : <span className="text-gray-300">—</span>}
            </td>
            <td className="px-4 py-2.5 text-right">
              <button onClick={() => onEdit(e)} className="text-xs text-blue-600 hover:underline">Edit</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
