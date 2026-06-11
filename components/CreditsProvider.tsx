"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

interface CreditsContextValue {
  creditsExhausted: boolean;
  signalCreditsExhausted: () => void;
}

const CreditsContext = createContext<CreditsContextValue>({
  creditsExhausted: false,
  signalCreditsExhausted: () => {},
});

export function useCredits() {
  return useContext(CreditsContext);
}

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const [creditsExhausted, setCreditsExhausted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const shownRef = useRef(false);

  const signalCreditsExhausted = useCallback(() => {
    setCreditsExhausted(true);
    if (!shownRef.current) {
      shownRef.current = true;
      setModalOpen(true);
    }
  }, []);

  return (
    <CreditsContext.Provider value={{ creditsExhausted, signalCreditsExhausted }}>
      {children}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-sm font-semibold text-gray-900">Out of Anthropic Credits</span>
            </div>

            <div className="px-5 py-4 space-y-3 text-sm text-gray-700">
              <p>
                Your Anthropic account has run out of credits. Content generation is unavailable until credits are topped up.
              </p>
              <p>
                Credits are purchased in <strong>$5 increments</strong>, which covers approximately <strong>400–500 product summaries</strong>.
              </p>
              <p>
                To purchase more credits, log in to the Anthropic console using the{" "}
                <strong>office@ email address</strong>.
              </p>
            </div>

            <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Dismiss
              </button>
              <a
                href="https://console.anthropic.com/settings/billing"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Purchase Credits →
              </a>
            </div>
          </div>
        </div>
      )}
    </CreditsContext.Provider>
  );
}
