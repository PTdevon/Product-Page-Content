"use client";

import { useState, useEffect, useRef } from "react";
import Nav from "@/components/Nav";
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

  useEffect(() => {
    fetch("/api/icons")
      .then((r) => r.json())
      .then((d) => {
        setBuiltInIcons(d.builtIn ?? []);
        setUploadedIcons(d.uploaded ?? []);
        setLoadingIcons(false);
      });
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

  return (
    <div className="flex flex-col min-h-screen">
      <Nav active="perfect-for" subActive="icons" helpText={"Manage the icons used alongside Perfect For phrases.\nUpload your own SVG files or use the built-in icon set.\nAssign icons to phrases from the Perfect For Phrases page."} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">

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

        </div>
      </div>
    </div>
  );
}
