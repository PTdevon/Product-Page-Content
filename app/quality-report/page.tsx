"use client";

import { useState, useRef } from "react";
import Nav from "@/components/Nav";
import type { ProductSummary } from "@/lib/types";
import { runNonAiChecks, type QualityIssue, type CheckId } from "@/lib/content-quality-checks";

interface ContentRow {
  productId: string;
  title: string;
  imageUrl: string | null;
  productTypePt: string;
  summary: string;
  wctBullets: [string, string, string, string];
  pfBullets: [string, string, string, string];
  pfIcons: [string, string, string, string];
}

interface FlaggedProduct {
  productId: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  productTypePt: string;
  issues: QualityIssue[];
}

type Phase = "idle" | "loading" | "done" | "error";

const CHECK_META: Record<string, { label: string; color: string }> = {
  "wear-language":      { label: "Wear language",      color: "bg-amber-100 text-amber-800" },
  "occasion-missing-pf":{ label: "Occasion not in PF", color: "bg-red-100 text-red-700" },
  "missing-bullets":    { label: "Missing bullets",    color: "bg-red-100 text-red-700" },
  "duplicate-icons":    { label: "Duplicate icons",    color: "bg-amber-100 text-amber-800" },
  "boring-summary":     { label: "AI summary",         color: "bg-amber-100 text-amber-800" },
  "context-mismatch":   { label: "Context mismatch",   color: "bg-amber-100 text-amber-800" },
};

const ALL_CHECK_IDS: CheckId[] = [
  "missing-bullets",
  "occasion-missing-pf",
  "wear-language",
  "duplicate-icons",
  "boring-summary",
  "context-mismatch",
];

function numericId(gid: string): string {
  return gid.split("/").pop() ?? gid;
}

export default function QualityReportPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stageLabel, setStageLabel] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [flagged, setFlagged] = useState<FlaggedProduct[]>([]);
  const [checkedTotal, setCheckedTotal] = useState(0);
  const [filterCheckId, setFilterCheckId] = useState<string>("all");
  const [aiError, setAiError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function mergeAiResults(
    aiResults: { productId: string; issues: QualityIssue[] }[],
    productMap: Map<string, ProductSummary>,
    rowMap: Map<string, ContentRow>,
  ) {
    setFlagged((prev) => {
      const map = new Map(prev.map((p) => [p.productId, p]));
      for (const ai of aiResults) {
        const existing = map.get(ai.productId);
        if (existing) {
          const existingIds = new Set(existing.issues.map((i) => i.checkId));
          const fresh = ai.issues.filter((i) => !existingIds.has(i.checkId));
          if (fresh.length > 0) {
            map.set(ai.productId, { ...existing, issues: [...existing.issues, ...fresh] });
          }
        } else if (ai.issues.length > 0) {
          const product = productMap.get(ai.productId);
          const row = rowMap.get(ai.productId);
          if (row) {
            map.set(ai.productId, {
              productId: ai.productId,
              title: row.title,
              handle: product?.handle ?? "",
              imageUrl: row.imageUrl,
              productTypePt: row.productTypePt,
              issues: ai.issues,
            });
          }
        }
      }
      return Array.from(map.values()).sort((a, b) => b.issues.length - a.issues.length);
    });
  }

  async function runReport() {
    setPhase("loading");
    setFlagged([]);
    setAiError(null);
    setFatalError(null);
    setCheckedTotal(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Stage 1: load all products
      setStageLabel("Loading product list");
      const allProducts: ProductSummary[] = [];
      let cursor: string | null = null;

      do {
        const params = new URLSearchParams({ limit: "50" });
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/products?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to load products");
        const data: { products: ProductSummary[]; nextCursor: string | null } = await res.json();
        allProducts.push(...data.products);
        cursor = data.nextCursor;
        setProgress({ done: allProducts.length, total: 0 }); // total unknown during product list loading
      } while (cursor);

      if (allProducts.length === 0) {
        setPhase("done");
        return;
      }

      const productMap = new Map(allProducts.map((p) => [p.id, p]));

      // Stage 2: fetch content in batches of 50
      setStageLabel("Loading content");
      const rowMap = new Map<string, ContentRow>();
      const CONTENT_BATCH = 50;

      for (let i = 0; i < allProducts.length; i += CONTENT_BATCH) {
        const batch = allProducts.slice(i, i + CONTENT_BATCH);
        const res = await fetch("/api/bulk-content-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: batch.map((p) => p.id), readOnly: true }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to load content");
        const data: { rows: ContentRow[] } = await res.json();
        for (const row of data.rows) rowMap.set(row.productId, row);
        setProgress({ done: rowMap.size, total: allProducts.length });
      }

      // Stage 3: run non-AI checks
      setStageLabel("Running checks");
      const newFlagged: FlaggedProduct[] = [];
      for (const row of rowMap.values()) {
        const issues = runNonAiChecks({
          productId: row.productId,
          title: row.title,
          productTypePt: row.productTypePt,
          summary: row.summary,
          wctBullets: row.wctBullets,
          pfBullets: row.pfBullets,
          pfIcons: row.pfIcons,
        });
        if (issues.length > 0) {
          newFlagged.push({
            productId: row.productId,
            title: row.title,
            handle: productMap.get(row.productId)?.handle ?? "",
            imageUrl: row.imageUrl,
            productTypePt: row.productTypePt,
            issues,
          });
        }
      }
      setFlagged(newFlagged.sort((a, b) => b.issues.length - a.issues.length));

      // Stage 4: AI checks (only products with a summary)
      const rowsWithSummary = Array.from(rowMap.values()).filter((r) => r.summary.trim());

      if (rowsWithSummary.length > 0) {
        setStageLabel("Running AI checks");
        const AI_BATCH = 25;
        let aiDone = 0;

        for (let i = 0; i < rowsWithSummary.length; i += AI_BATCH) {
          const batch = rowsWithSummary.slice(i, i + AI_BATCH);
          setProgress({ done: i, total: rowsWithSummary.length });

          const res = await fetch("/api/quality-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rows: batch.map((r) => ({
                productId: r.productId,
                title: r.title,
                productTypePt: r.productTypePt,
                summary: r.summary,
                wctBullets: r.wctBullets,
                pfBullets: r.pfBullets,
                pfIcons: r.pfIcons,
              })),
            }),
            signal: controller.signal,
          });

          if (res.ok) {
            const data: {
              results: { productId: string; issues: QualityIssue[] }[];
              creditsExhausted?: boolean;
              error?: string;
            } = await res.json();

            if (data.creditsExhausted) {
              setAiError("Anthropic account has run out of credits — AI checks were skipped.");
              break;
            }
            if (data.error && !data.results?.length) {
              setAiError(`AI checks incomplete: ${data.error}`);
              break;
            }
            if (data.results?.length) {
              mergeAiResults(data.results, productMap, rowMap);
            }
          }

          aiDone += batch.length;
          setCheckedTotal(aiDone);
        }
        setProgress({ done: rowsWithSummary.length, total: rowsWithSummary.length });
      }

      setCheckedTotal(allProducts.length);
      setPhase("done");
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setFatalError("Something went wrong loading the report. Please try again.");
      setPhase("error");
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setPhase("idle");
  }

  const filtered = filterCheckId === "all"
    ? flagged
    : flagged.filter((p) => p.issues.some((i) => i.checkId === filterCheckId));

  const countByCheck = ALL_CHECK_IDS.reduce<Record<string, number>>((acc, id) => {
    acc[id] = flagged.filter((p) => p.issues.some((i) => i.checkId === id)).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-screen bg-white">
      <Nav active="quality-report" />

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-xl font-semibold text-gray-900">Content Quality Report</h1>
            <p className="mt-1 text-sm text-gray-500">
              Scan all products for content issues: missing bullets, duplicate icons, occasion mismatches, wear language on non-wearable items, and AI-sounding summaries.
            </p>
            {phase === "idle" && (
              <p className="mt-1 text-xs text-gray-400">
                AI checks use Claude Haiku — approximately $0.05–0.15 per 100 products.
              </p>
            )}
          </div>

          {/* Idle state */}
          {phase === "idle" && (
            <button
              onClick={runReport}
              className="px-5 py-2.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
            >
              Run Report
            </button>
          )}

          {/* Error state */}
          {phase === "error" && (
            <div className="space-y-3">
              <p className="text-sm text-red-600">{fatalError}</p>
              <button
                onClick={runReport}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Loading state */}
          {phase === "loading" && (
            <div className="space-y-4 max-w-sm">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">{stageLabel}</span>
                  <span className="text-xs text-gray-400">
                    {progress.total > 0
                      ? `${progress.done} / ${progress.total}`
                      : progress.done > 0 ? `${progress.done} loaded` : ""}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gray-800 rounded-full transition-all duration-300 ${progress.total === 0 ? "animate-pulse" : ""}`}
                    style={{ width: progress.total > 0 ? `${Math.min(100, (progress.done / progress.total) * 100)}%` : "30%" }}
                  />
                </div>
              </div>
              {stageLabel === "Running AI checks" && (
                <p className="text-xs text-gray-400">
                  AI checks running — this may take a minute for larger catalogues.
                </p>
              )}
              <button
                onClick={cancel}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Results */}
          {(phase === "done" || (phase === "loading" && flagged.length > 0)) && (
            <div className="space-y-5">
              {phase === "done" && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    {flagged.length === 0
                      ? `${checkedTotal} products checked — no issues found`
                      : `${flagged.length} of ${checkedTotal} products have issues`}
                  </span>
                  <button
                    onClick={runReport}
                    className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-0.5 rounded"
                  >
                    Re-run
                  </button>
                </div>
              )}

              {aiError && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  {aiError}
                </p>
              )}

              {flagged.length > 0 && (
                <>
                  {/* Check type summary chips */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFilterCheckId("all")}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        filterCheckId === "all"
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      All issues ({flagged.length})
                    </button>
                    {ALL_CHECK_IDS.filter((id) => countByCheck[id] > 0).map((id) => (
                      <button
                        key={id}
                        onClick={() => setFilterCheckId(filterCheckId === id ? "all" : id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          filterCheckId === id
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {CHECK_META[id]?.label ?? id} ({countByCheck[id]})
                      </button>
                    ))}
                  </div>

                  {/* Results table */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Product</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide w-40">Type</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase tracking-wide">Issues</th>
                          <th className="px-4 py-2.5 w-20"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filtered.map((product) => (
                          <tr key={product.productId} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt=""
                                    className="w-10 h-10 object-cover rounded shrink-0 bg-gray-100"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded bg-gray-100 shrink-0" />
                                )}
                                <span className="font-medium text-gray-900 leading-snug">{product.title}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {product.productTypePt || <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {product.issues.map((issue, idx) => (
                                  <span
                                    key={idx}
                                    title={issue.detail}
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-default ${CHECK_META[issue.checkId]?.color ?? "bg-gray-100 text-gray-600"}`}
                                  >
                                    {issue.label}
                                  </span>
                                ))}
                              </div>
                              {/* Details line */}
                              <div className="mt-1 space-y-0.5">
                                {product.issues.map((issue, idx) => (
                                  <p key={idx} className="text-xs text-gray-400">{issue.detail}</p>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <a
                                href={`/products?id=${numericId(product.productId)}`}
                                className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50"
                              >
                                Edit
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {filtered.length === 0 && (
                      <p className="text-center text-sm text-gray-400 py-8">
                        No products match this filter.
                      </p>
                    )}
                  </div>
                </>
              )}

              {phase === "done" && flagged.length === 0 && checkedTotal > 0 && (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-2xl mb-2">✓</p>
                  <p className="text-sm">All content looks good!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
