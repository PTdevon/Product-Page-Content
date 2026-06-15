"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import { Tooltip } from "@/components/Tooltip";

interface IconEntry {
  id: string;
  handle: string;
  svg: string;
}

interface DeleteModal {
  handle: string;
  svg: string;
  status: "checking" | "confirm" | "deleting" | "error";
  products: string[];
  phrases: string[];
  errorMsg?: string;
}

interface PasteModal {
  rawSvg: string;
  name: string;
  saving: boolean;
  error: string;
}

interface RenamePrompt {
  oldName: string;
  newName: string;
  products: string[];
  phrases: string[];
  status: "idle" | "updating" | "done";
  updatedCounts?: { products: number; phrases: number };
}

function suggestNameFromSvg(svg: string): string {
  const matches = [...svg.matchAll(/\blucide-([a-z0-9]+(?:-[a-z0-9]+)*)/gi)];
  for (const m of matches) {
    const name = m[1].replace(/-icon$/, "");
    if (name && name !== "icon") return name;
  }
  return "";
}

export default function IconsPage() {
  const [icons, setIcons] = useState<IconEntry[]>([]);
  const [loadingIcons, setLoadingIcons] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [renameError, setRenameError] = useState("");

  const [deleteModal, setDeleteModal] = useState<DeleteModal | null>(null);
  const [pasteModal, setPasteModal] = useState<PasteModal | null>(null);
  const [renamePrompt, setRenamePrompt] = useState<RenamePrompt | null>(null);

  useEffect(() => {
    fetch("/api/icons")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setLoadError(d.error);
        setIcons(d.icons ?? []);
        setLoadingIcons(false);
      })
      .catch(() => {
        setLoadError("Could not reach the icons API.");
        setLoadingIcons(false);
      });
  }, []);

  function openPasteModal() {
    setPasteModal({ rawSvg: "", name: "", saving: false, error: "" });
  }

  function handleSvgPaste(value: string) {
    const suggested = suggestNameFromSvg(value);
    setPasteModal((prev) =>
      prev
        ? { ...prev, rawSvg: value, name: prev.name || suggested, error: "" }
        : null
    );
  }

  async function handleSaveIcon() {
    if (!pasteModal) return;
    setPasteModal((prev) => prev ? { ...prev, saving: true, error: "" } : null);

    const res = await fetch("/api/icons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pasteModal.name, svg: pasteModal.rawSvg }),
    });
    const data = await res.json();

    if (!res.ok) {
      setPasteModal((prev) => prev ? { ...prev, saving: false, error: data.error ?? "Failed to save icon" } : null);
      return;
    }

    setIcons((prev) => [...prev, data as IconEntry]);
    setPasteModal(null);
    window.dispatchEvent(new CustomEvent("pdp:icons-changed"));
  }

  function startEdit(name: string) {
    setEditingName(name);
    setEditValue(name);
    setRenameError("");
  }

  async function handleSaveName(oldHandle: string) {
    const sanitized = editValue
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!sanitized || sanitized === oldHandle) {
      setEditingName(null);
      return;
    }

    setSavingName(true);
    setRenameError("");

    const res = await fetch("/api/icons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldName: oldHandle, newName: sanitized }),
    });
    const data = await res.json();
    setSavingName(false);

    if (!res.ok) {
      setRenameError(data.error ?? "Rename failed");
      return;
    }

    setIcons((prev) =>
      prev.map((i) => (i.handle === oldHandle ? { ...i, handle: data.name } : i))
    );
    setEditingName(null);

    const usage = data.usage as { products: string[]; phrases: string[] } | undefined;
    setRenamePrompt({
      oldName: oldHandle,
      newName: data.name,
      products: usage?.products ?? [],
      phrases: usage?.phrases ?? [],
      status: "idle",
    });
  }

  async function handleCascade() {
    if (!renamePrompt) return;
    setRenamePrompt((prev) => prev ? { ...prev, status: "updating" } : null);

    const res = await fetch("/api/icons/cascade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldName: renamePrompt.oldName, newName: renamePrompt.newName }),
    });
    const data = await res.json();

    if (!res.ok) {
      setRenamePrompt((prev) => prev ? { ...prev, status: "idle" } : null);
      setRenameError(data.error ?? "Update failed");
      return;
    }

    setRenamePrompt((prev) =>
      prev ? { ...prev, status: "done", updatedCounts: data.updated } : null
    );
  }

  function handleDeleteClick(icon: IconEntry) {
    setDeleteModal({ handle: icon.handle, svg: icon.svg, status: "checking", products: [], phrases: [] });
    fetch(`/api/icons?usage=${encodeURIComponent(icon.handle)}`)
      .then((r) => r.json())
      .then((data) => {
        setDeleteModal((prev) =>
          prev ? { ...prev, status: "confirm", products: data.products ?? [], phrases: data.phrases ?? [] } : null
        );
      })
      .catch(() => {
        setDeleteModal((prev) =>
          prev ? { ...prev, status: "error", errorMsg: "Failed to check icon usage." } : null
        );
      });
  }

  async function handleConfirmDelete() {
    if (!deleteModal) return;
    setDeleteModal((prev) => prev ? { ...prev, status: "deleting" } : null);

    const res = await fetch(`/api/icons?name=${encodeURIComponent(deleteModal.handle)}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setIcons((prev) => prev.filter((i) => i.handle !== deleteModal.handle));
      setDeleteModal(null);
      return;
    }

    const data = await res.json();
    setDeleteModal((prev) =>
      prev ? { ...prev, status: "error", errorMsg: data.error ?? "Delete failed" } : null
    );
  }

  const svgIsValid = pasteModal?.rawSvg.includes("<svg");

  return (
    <div className="flex flex-col min-h-screen">
      <Nav
        active="perfect-for"
        subActive="icons"
        helpText={
          "Manage the icons used alongside Perfect For phrases.\nPaste an SVG from Lucide to add a new icon.\nAssign icons to phrases from the Perfect For Phrases page."
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Icon Library{!loadingIcons && icons.length > 0 ? ` (${icons.length})` : ""}
            </p>
            <button
              onClick={openPasteModal}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              Add icon
            </button>
          </div>

          {loadingIcons ? (
            <p className="text-sm text-gray-400">Setting up icons…</p>
          ) : loadError ? (
            <p className="text-sm text-red-500">{loadError}</p>
          ) : icons.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No icons yet. Click "Add icon" to add one from Lucide.</p>
          ) : (
            <>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {icons.map((icon) => (
                  <div
                    key={icon.handle}
                    className="relative group flex flex-col items-center gap-1.5 p-2 pt-4 rounded-lg border border-gray-100 bg-white"
                  >
                    <Tooltip content="Delete this icon." side="top">
                      <button
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 leading-none"
                        onClick={() => handleDeleteClick(icon)}
                      >
                        &times;
                      </button>
                    </Tooltip>

                    <span
                      className="w-6 h-6 flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6"
                      dangerouslySetInnerHTML={{ __html: icon.svg }}
                    />

                    {editingName === icon.handle ? (
                      <input
                        className="text-[11px] w-full text-center border border-blue-400 rounded px-0.5 py-0 outline-none bg-blue-50 disabled:opacity-50"
                        value={editValue}
                        onChange={(e) => {
                          setEditValue(e.target.value);
                          setRenameError("");
                        }}
                        onBlur={() => handleSaveName(icon.handle)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") {
                            setEditingName(null);
                            setRenameError("");
                          }
                        }}
                        autoFocus
                        disabled={savingName}
                      />
                    ) : (
                      <Tooltip content="Click to rename." side="bottom">
                        <button
                          className="text-[11px] text-gray-500 truncate w-full text-center hover:text-blue-600 transition-colors"
                          onClick={() => startEdit(icon.handle)}
                        >
                          {icon.handle}
                        </button>
                      </Tooltip>
                    )}
                  </div>
                ))}
              </div>
              {renameError && <p className="text-red-500 text-xs mt-2">{renameError}</p>}
            </>
          )}
        </div>
      </div>

      {/* Paste modal */}
      {pasteModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !pasteModal.saving && setPasteModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-gray-900">Add icon</h3>
            <p className="text-sm text-gray-600">
              Browse{" "}
              <a
                href="https://lucide.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Lucide icons ↗
              </a>
              , find one you like, click <strong>Copy SVG</strong>, then paste it below.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">SVG code</label>
              <textarea
                className="w-full h-28 text-xs font-mono border border-gray-300 rounded-md p-2 resize-none outline-none focus:border-blue-400"
                placeholder="Paste SVG here…"
                value={pasteModal.rawSvg}
                onChange={(e) => handleSvgPaste(e.target.value)}
                disabled={pasteModal.saving}
              />
            </div>

            {svgIsValid && (
              <div className="flex items-center gap-3">
                <span
                  className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-md [&>svg]:w-6 [&>svg]:h-6"
                  dangerouslySetInnerHTML={{ __html: pasteModal.rawSvg }}
                />
                <span className="text-xs text-gray-400">Preview</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="e.g. heart"
                value={pasteModal.name}
                onChange={(e) => setPasteModal((prev) => prev ? { ...prev, name: e.target.value, error: "" } : null)}
                disabled={pasteModal.saving}
              />
              <p className="text-[11px] text-gray-400 mt-1">Letters, numbers, and hyphens only.</p>
            </div>

            {pasteModal.error && <p className="text-red-500 text-sm">{pasteModal.error}</p>}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setPasteModal(null)}
                disabled={pasteModal.saving}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveIcon}
                disabled={pasteModal.saving || !svgIsValid || !pasteModal.name.trim()}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {pasteModal.saving ? "Saving…" : "Save icon"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => deleteModal.status !== "deleting" && setDeleteModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {deleteModal.status === "checking" && (
              <p className="text-sm text-gray-400 text-center py-4">Checking usage…</p>
            )}

            {deleteModal.status === "confirm" && (
              <>
                <h3 className="font-semibold text-gray-900 mb-2">Delete icon</h3>
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="w-8 h-8 flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6"
                    dangerouslySetInnerHTML={{ __html: deleteModal.svg }}
                  />
                  <span className="text-sm text-gray-700 font-medium">{deleteModal.handle}</span>
                </div>

                {deleteModal.products.length === 0 && deleteModal.phrases.length === 0 ? (
                  <p className="text-sm text-green-700 mb-5">This icon is not used anywhere. Safe to delete.</p>
                ) : (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Remove this icon from all phrases and products before deleting.
                    </p>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50 space-y-0.5">
                      {deleteModal.phrases.length > 0 && (
                        <>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 pb-0.5">
                            Perfect For Phrases
                          </p>
                          {deleteModal.phrases.map((p) => (
                            <div key={p} className="text-sm text-gray-700">{p}</div>
                          ))}
                        </>
                      )}
                      {deleteModal.products.length > 0 && (
                        <>
                          <p className={`text-[11px] font-semibold uppercase tracking-wide text-gray-400 pb-0.5${deleteModal.phrases.length > 0 ? " pt-2" : ""}`}>
                            Products
                          </p>
                          {deleteModal.products.map((p) => (
                            <div key={p} className="text-sm text-gray-700">{p}</div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setDeleteModal(null)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  {deleteModal.products.length === 0 && deleteModal.phrases.length === 0 && (
                    <button
                      onClick={handleConfirmDelete}
                      className="px-4 py-2 text-sm text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}

            {deleteModal.status === "deleting" && (
              <p className="text-sm text-gray-500 text-center py-4">Deleting…</p>
            )}

            {deleteModal.status === "error" && (
              <>
                <h3 className="font-semibold text-gray-900 mb-2">Error</h3>
                <p className="text-sm text-red-600 mb-4">{deleteModal.errorMsg}</p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setDeleteModal(null)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Rename prompt modal */}
      {renamePrompt && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => renamePrompt.status !== "updating" && setRenamePrompt(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {renamePrompt.status === "idle" && (
              <>
                <h3 className="font-semibold text-gray-900 mb-2">Icon renamed</h3>
                {renamePrompt.products.length === 0 && renamePrompt.phrases.length === 0 ? (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      <strong>{renamePrompt.oldName}</strong> renamed to <strong>{renamePrompt.newName}</strong>. This icon isn&rsquo;t used on any products or phrases yet.
                    </p>
                    <div className="flex justify-end">
                      <button
                        onClick={() => setRenamePrompt(null)}
                        className="px-4 py-2 text-sm text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
                      >
                        OK
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      {[
                        renamePrompt.products.length > 0 &&
                          `${renamePrompt.products.length} product${renamePrompt.products.length !== 1 ? "s" : ""}`,
                        renamePrompt.phrases.length > 0 &&
                          `${renamePrompt.phrases.length} phrase${renamePrompt.phrases.length !== 1 ? "s" : ""}`,
                      ]
                        .filter(Boolean)
                        .join(" and ")}{" "}
                      still use the old icon name <strong>{renamePrompt.oldName}</strong>.
                      Update {renamePrompt.products.length + renamePrompt.phrases.length === 1 ? "it" : "them"} to <strong>{renamePrompt.newName}</strong>?
                    </p>
                    <div className="max-h-36 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50 space-y-0.5 mb-4 text-sm text-gray-700">
                      {renamePrompt.phrases.map((p) => <div key={p}>{p}</div>)}
                      {renamePrompt.products.map((p) => <div key={p}>{p}</div>)}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setRenamePrompt(null)}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Skip
                      </button>
                      <button
                        onClick={handleCascade}
                        className="px-4 py-2 text-sm text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
                      >
                        Update now
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {renamePrompt.status === "updating" && (
              <p className="text-sm text-gray-500 text-center py-4">Updating…</p>
            )}

            {renamePrompt.status === "done" && renamePrompt.updatedCounts && (
              <>
                <h3 className="font-semibold text-gray-900 mb-2">Done</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {[
                    renamePrompt.updatedCounts.products > 0 &&
                      `${renamePrompt.updatedCounts.products} product${renamePrompt.updatedCounts.products !== 1 ? "s" : ""}`,
                    renamePrompt.updatedCounts.phrases > 0 &&
                      `${renamePrompt.updatedCounts.phrases} phrase${renamePrompt.updatedCounts.phrases !== 1 ? "s" : ""}`,
                  ]
                    .filter(Boolean)
                    .join(" and ")}{" "}
                  updated to use <strong>{renamePrompt.newName}</strong>.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setRenamePrompt(null)}
                    className="px-4 py-2 text-sm text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
