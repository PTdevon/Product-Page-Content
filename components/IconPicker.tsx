"use client";

import { useState, useEffect } from "react";
import type { UploadedIcon } from "@/lib/uploaded-icons-store";

interface Props {
  current: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
}

export default function IconPicker({ current, onSelect, onClose }: Props) {
  const [builtIn, setBuiltIn] = useState<string[]>([]);
  const [uploaded, setUploaded] = useState<UploadedIcon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/icons")
      .then((r) => r.json())
      .then((d) => {
        setBuiltIn(d.builtIn ?? []);
        setUploaded(d.uploaded ?? []);
        setLoading(false);
      });
  }, []);

  function select(icon: string) {
    onSelect(icon);
    onClose();
  }

  const currentIsUploaded = current.startsWith("<svg");

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xs max-h-[75vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-sm text-gray-900">Choose icon</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2">
                {builtIn.map((name) => {
                  const isSelected = current === name;
                  return (
                    <button
                      key={name}
                      onClick={() => select(name)}
                      title={name}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                        isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      <img src={`/icons/${name}.svg`} alt={name} className="w-6 h-6" />
                      <span className="text-[11px] text-gray-500 truncate w-full text-center">{name}</span>
                    </button>
                  );
                })}
              </div>

              {uploaded.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Custom</p>
                  <div className="grid grid-cols-5 gap-2">
                    {uploaded.map(({ name, svg }) => {
                      const isSelected = currentIsUploaded && current === svg;
                      return (
                        <button
                          key={name}
                          onClick={() => select(svg)}
                          title={name}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                            isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                          }`}
                        >
                          <span
                            className="w-6 h-6 flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6"
                            dangerouslySetInnerHTML={{ __html: svg }}
                          />
                          <span className="text-[11px] text-gray-500 truncate w-full text-center">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
