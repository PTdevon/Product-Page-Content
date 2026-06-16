"use client";

import { useRef, useEffect } from "react";
import { Tooltip } from "@/components/Tooltip";

interface AffectedProductsModalProps {
  title: string;
  /** What the affected products have in common, e.g. "style", "type", "entry", "phrase" — used to phrase the header. */
  subject?: string;
  phase: "finding" | "found" | "updating" | "done";
  products: { id: string; title: string }[];
  updateLog: { title: string; status: "updated" | "error" }[];
  updateResult: { updated: number; skipped: number; failed: number } | null;
  canUpdate: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
  onRetry?: () => void;
  onRevert?: () => void;
  busy?: boolean;
  notCommittedMessage?: string;
  /** True if the library (Why Choose This / Perfect For) entries failed to update — distinct from product failures. */
  libraryFailed?: boolean;
  onRetryLibrary?: () => void;
}

export default function AffectedProductsModal({
  title,
  subject,
  phase,
  products,
  updateLog,
  updateResult,
  canUpdate,
  onUpdate,
  onDismiss,
  onRetry,
  onRevert,
  busy,
  notCommittedMessage,
  libraryFailed,
  onRetryLibrary,
}: AffectedProductsModalProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [updateLog]);

  const isUpdating = phase === "updating";
  const isDone = phase === "done";
  const hasFailures = isDone && !!updateResult && updateResult.failed > 0;
  const canRetryOrRevert = hasFailures && (onRetry || onRevert);
  const hasLibraryFailure = isDone && !!libraryFailed;

  function handleDismiss() {
    if (canRetryOrRevert || hasLibraryFailure) {
      const parts = [];
      if (canRetryOrRevert) parts.push(`${updateResult!.failed} product${updateResult!.failed !== 1 ? "s" : ""} still ${updateResult!.failed !== 1 ? "are" : "is"} left in a partially-applied state`);
      if (hasLibraryFailure) parts.push("the library entries were not updated");
      const ok = window.confirm(`${parts.join(" and ")} and won't be retried. Close anyway?`);
      if (!ok) return;
    }
    onDismiss();
  }

  function headerText() {
    if (phase === "finding") return "Searching products…";
    if (phase === "found") {
      if (products.length === 0) return subject ? `No products use this ${subject}` : "No products found";
      const n = products.length;
      const noun = `Product${n !== 1 ? "s" : ""}`;
      if (!subject) return `${n} ${noun} affected`;
      return `${n} ${noun} use${n === 1 ? "s" : ""} this ${subject}`;
    }
    if (phase === "updating") return "Updating products…";
    if (busy) return "Working…";
    if (isDone && updateResult) {
      return `Done — ${updateResult.updated} updated${updateResult.failed > 0 ? ` · ${updateResult.failed} failed` : ""}`;
    }
    return title;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={isUpdating || busy ? undefined : handleDismiss}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">{headerText()}</span>
          <button
            onClick={handleDismiss}
            disabled={isUpdating || busy}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg leading-none disabled:opacity-30"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div ref={logRef} className="max-h-52 overflow-y-auto px-5 py-3 space-y-0.5 text-sm">
          {phase === "finding" && (
            <div className="text-gray-400">Scanning products…</div>
          )}
          {phase === "found" && products.length === 0 && (
            <div className="text-gray-500">No products currently use this.</div>
          )}
          {phase === "found" && products.map((p) => (
            <div key={p.id} className="text-gray-700">{p.title}</div>
          ))}
          {(phase === "updating" || isDone) && updateLog.map((e, i) => (
            <div key={i} className={e.status === "updated" ? "text-green-700" : "text-red-600"}>
              {e.status === "updated" ? "✓" : "✗"} {e.title}
            </div>
          ))}
          {phase === "updating" && updateLog.length === 0 && (
            <div className="text-gray-400">Starting update…</div>
          )}
          {hasFailures && (
            <div className="text-amber-600 pt-1.5">
              {notCommittedMessage ?? `Not fully applied — ${updateResult!.failed} still need updating.`}
            </div>
          )}
          {hasLibraryFailure && (
            <div className="text-red-600 pt-1.5 font-medium">
              Library entries (Why Choose This / Perfect For) failed to update — products were updated but the library is now out of sync.
            </div>
          )}
        </div>

        {/* Footer */}
        {(phase === "found" || isDone) && (
          <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-end gap-3">
            {isDone && !canRetryOrRevert && !hasLibraryFailure && (
              <button
                onClick={onDismiss}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            )}
            {isDone && (canRetryOrRevert || hasLibraryFailure) && (
              <>
                <button
                  onClick={handleDismiss}
                  disabled={busy}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  Close
                </button>
                {canRetryOrRevert && onRevert && (
                  <Tooltip content="Undo the products that already updated and abandon this change." side="top">
                    <button
                      onClick={onRevert}
                      disabled={busy}
                      className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-40 transition-colors"
                    >
                      Cancel &amp; Revert
                    </button>
                  </Tooltip>
                )}
                {canRetryOrRevert && onRetry && (
                  <Tooltip content="Retry only the products that failed to update." side="top">
                    <button
                      onClick={onRetry}
                      disabled={busy}
                      className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-40 transition-colors"
                    >
                      Retry failed ({updateResult!.failed})
                    </button>
                  </Tooltip>
                )}
                {hasLibraryFailure && onRetryLibrary && (
                  <Tooltip content="Retry updating the matching Why Choose This / Perfect For library entries." side="top">
                    <button
                      onClick={onRetryLibrary}
                      disabled={busy}
                      className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-40 transition-colors"
                    >
                      Retry library update
                    </button>
                  </Tooltip>
                )}
              </>
            )}
            {phase === "found" && canUpdate && products.length > 0 && (
              <>
                <Tooltip content="Close this without pushing any changes to products." side="top">
                  <button
                    onClick={onDismiss}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    Do Not Update Products
                  </button>
                </Tooltip>
                <Tooltip content="Push this change to all listed products, then commit it." side="top">
                  <button
                    onClick={onUpdate}
                    className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Update Products
                  </button>
                </Tooltip>
              </>
            )}
            {phase === "found" && (!canUpdate || products.length === 0) && (
              <button
                onClick={onDismiss}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
