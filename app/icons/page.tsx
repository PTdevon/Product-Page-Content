"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Nav from "@/components/Nav";
import IconPicker from "@/components/IconPicker";
import type { PerfectForEntry } from "@/lib/types";
import type { UploadedIcon } from "@/lib/uploaded-icons-store";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">{children}</span>
      <div className="flex-1 border-t border-gray-200" />
    </div>
  );
}

export default function IconsPage() {
  const [builtInIcons, setBuiltInIcons] = useState<string[]>([]);
  const [uploadedIcons, setUploadedIcons] = useState<UploadedIcon[]>([]);
  const [loadingIcons, setLoadingIcons] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pfEntries, setPfEntries] = useState<PerfectForEntry[]>([]);
  const [loadingPf, setLoadingPf] = useState(true);
  const [pfPickerEntry, setPfPickerEntry] = useState<PerfectForEntry | null>(null);

  useEffect(() => {
    fetch("/api/icons")
      .then((r) => r.json())
      .then((d) => {
        setBuiltInIcons(d.builtIn ?? []);
        setUploadedIcons(d.uploaded ?? []);
        setLoadingIcons(false);
      });

    fetch("/api/library?type=perfect")
      .then((r) => r.json())
      .then((d) => { setPfEntries(d.entries ?? []); setLoadingPf(false); });
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    setUploadError("");

    const body = new FormData();
    body.append("file", file);

    const res = await fetch("/api/icons", { method: "POST", body });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setUploadError(data.error ?? "Upload failed");
    } else {
      setUploadedIcons((prev) => {
        const filtered = prev.filter((i) => i.name !== data.name);
        return [...filtered, { name: data.name, svg: data.svg }];
      });
    }
  }

  const pfByIcon = useMemo(() => {
    const map: Record<string, PerfectForEntry[]> = {};
    for (const e of pfEntries) {
      const key = e.icon || "_none";
      (map[key] ??= []).push(e);
    }
    return Object.entries(map)
      .map(([iconKey, entries]) => [
        iconKey,
        entries.filter((e, i, arr) => arr.findIndex((x) => x.phrase === e.phrase) === i),
      ] as [string, PerfectForEntry[]])
      .sort(([a], [b]) => a.localeCompare(b));
  }, [pfEntries]);

  async function handlePfIconSelect(icon: string) {
    if (!pfPickerEntry) return;
    const phrase = pfPickerEntry.phrase;
    setPfPickerEntry(null);
    const matchingIds = pfEntries.filter((e) => e.phrase === phrase).map((e) => e.id);
    await Promise.all(
      matchingIds.map((id) =>
        fetch("/api/library", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, icon }),
        })
      )
    );
    setPfEntries((prev) => prev.map((e) => e.phrase === phrase ? { ...e, icon } : e));
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Nav active="icons" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">

          {/* Icon library */}
          <section>
            <SectionHeading>Icon Library</SectionHeading>

            {loadingIcons ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Built-in ({builtInIcons.length})</p>
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 mb-8">
                  {builtInIcons.map((name) => (
                    <div key={name} className="flex flex-col items-center gap-1 p-2 rounded-lg border border-gray-100 bg-white">
                      <img src={`/icons/${name}.svg`} alt={name} className="w-6 h-6" />
                      <span className="text-[9px] text-gray-400 truncate w-full text-center">{name}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Custom{uploadedIcons.length > 0 ? ` (${uploadedIcons.length})` : ""}
                  </p>
                  <div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-colors"
                    >
                      {uploading ? "Uploading…" : "Upload SVG"}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".svg,image/svg+xml"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {uploadError && <p className="text-red-500 text-sm mb-3">{uploadError}</p>}

                {uploadedIcons.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No custom icons uploaded yet.</p>
                ) : (
                  <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                    {uploadedIcons.map(({ name, svg }) => (
                      <div key={name} className="flex flex-col items-center gap-1 p-2 rounded-lg border border-gray-100 bg-white">
                        <span
                          className="w-6 h-6 flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6"
                          dangerouslySetInnerHTML={{ __html: svg }}
                        />
                        <span className="text-[9px] text-gray-400 truncate w-full text-center">{name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Phrase assignments */}
          <section>
            <SectionHeading>Phrase Assignments</SectionHeading>
            <p className="text-sm text-gray-500 mb-5">
              All Perfect For phrases grouped by their assigned icon. Click any phrase to reassign it.
            </p>

            {loadingPf ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {pfByIcon.map(([iconKey, phrases]) => (
                  <div key={iconKey} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                      {iconKey === "_none" ? (
                        <span className="w-5 h-5 rounded border border-dashed border-gray-300" />
                      ) : iconKey.startsWith("<svg") ? (
                        <span
                          className="w-5 h-5 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 opacity-70"
                          dangerouslySetInnerHTML={{ __html: iconKey }}
                        />
                      ) : (
                        <img src={`/icons/${iconKey}.svg`} alt={iconKey} className="w-5 h-5 opacity-70" />
                      )}
                      <span className="text-xs font-semibold text-gray-600">
                        {iconKey === "_none" ? "No icon" : iconKey}
                      </span>
                      <span className="ml-auto text-xs text-gray-400">{phrases.length}</span>
                    </div>

                    <ul className="divide-y divide-gray-50">
                      {phrases.map((entry) => (
                        <li key={entry.id}>
                          <button
                            onClick={() => setPfPickerEntry(entry)}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 transition-colors"
                          >
                            {entry.phrase}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      {pfPickerEntry && (
        <IconPicker
          current={pfPickerEntry.icon}
          onSelect={handlePfIconSelect}
          onClose={() => setPfPickerEntry(null)}
        />
      )}
    </div>
  );
}
