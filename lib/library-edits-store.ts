import fs from "fs/promises";
import path from "path";

const EDITS_PATH = path.join(process.cwd(), "data", "library-edits.json");

export interface WCTEdit {
  id: string;
  productType: string;
  productStyle: string;
  category: string;
  text: string;
  subtext: string;
  searchFormatted: string;
  isNew: boolean;
}

// Phrase-level edit — covers phrase text, icon, category, seasonal, filterByInterest
export interface PFPhraseEdit {
  id: string;           // phraseId
  phrase: string;
  icon: string;
  searchPhrase: string; // original phrase text used to find products that need updating
  isNew: boolean;
  deleted?: boolean;    // true = phrase has been deleted
  // Optional fields — only present when overriding phrase-level attributes
  category?: string;
  timeSensitive?: string | null;
  filterByInterest?: boolean;
}

// Applicability-level edit — adds or removes a type/style assignment
export interface PFApplicabilityEdit {
  id: string;           // applicability ID
  phraseId: string;
  productType: string;
  productStyle: string;
  applicabilityCount: number;
  isNew: boolean;
  deleted?: boolean;    // true = this assignment has been removed
}

export interface LibraryEdits {
  wct: Record<string, WCTEdit>;
  pfPhrases: Record<string, PFPhraseEdit>;
  pfApplicability: Record<string, PFApplicabilityEdit>;
}

export async function getLibraryEdits(): Promise<LibraryEdits> {
  try {
    const raw = await fs.readFile(EDITS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as LibraryEdits;
    // Ensure all sections exist (handles files written before this migration)
    return {
      wct: parsed.wct ?? {},
      pfPhrases: parsed.pfPhrases ?? {},
      pfApplicability: parsed.pfApplicability ?? {},
    };
  } catch {
    return { wct: {}, pfPhrases: {}, pfApplicability: {} };
  }
}

async function persist(edits: LibraryEdits): Promise<void> {
  await fs.writeFile(EDITS_PATH, JSON.stringify(edits, null, 2), "utf-8");
}

// Serialize all mutations so concurrent requests don't overwrite each other
let mutationChain: Promise<void> = Promise.resolve();
function serialized(fn: () => Promise<void>): Promise<void> {
  const next = mutationChain.then(fn);
  mutationChain = next.catch(() => {});
  return next;
}

// ── WCT ──────────────────────────────────────────────────────────────────────

export function upsertWCTEdit(entry: WCTEdit): Promise<void> {
  return serialized(async () => {
    const edits = await getLibraryEdits();
    edits.wct[entry.id] = entry;
    await persist(edits);
  });
}

export function deleteWCTEdit(id: string): Promise<void> {
  return serialized(async () => {
    const edits = await getLibraryEdits();
    delete edits.wct[id];
    await persist(edits);
  });
}

export function markWCTPushed(id: string, newFormatted: string): Promise<void> {
  return serialized(async () => {
    const edits = await getLibraryEdits();
    if (edits.wct[id]) {
      edits.wct[id].searchFormatted = newFormatted;
      await persist(edits);
    }
  });
}

// ── PF Phrases ────────────────────────────────────────────────────────────────

export function upsertPFPhraseEdit(entry: PFPhraseEdit): Promise<void> {
  return serialized(async () => {
    const edits = await getLibraryEdits();
    edits.pfPhrases[entry.id] = entry;
    await persist(edits);
  });
}

export function deletePFPhraseEdit(phraseId: string): Promise<void> {
  return serialized(async () => {
    const edits = await getLibraryEdits();
    delete edits.pfPhrases[phraseId];
    await persist(edits);
  });
}

export function markPFPhrasePushed(phraseId: string, newPhrase: string): Promise<void> {
  return serialized(async () => {
    const edits = await getLibraryEdits();
    if (edits.pfPhrases[phraseId]) {
      edits.pfPhrases[phraseId].searchPhrase = newPhrase;
      await persist(edits);
    }
  });
}

// ── PF Applicability ──────────────────────────────────────────────────────────

export function upsertPFApplicabilityEdit(entry: PFApplicabilityEdit): Promise<void> {
  return serialized(async () => {
    const edits = await getLibraryEdits();
    edits.pfApplicability[entry.id] = entry;
    await persist(edits);
  });
}

export function deletePFApplicabilityEdit(id: string): Promise<void> {
  return serialized(async () => {
    const edits = await getLibraryEdits();
    delete edits.pfApplicability[id];
    await persist(edits);
  });
}
