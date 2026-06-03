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

export interface PFEdit {
  id: string;
  productType: string;
  productStyle: string;
  category: string;
  phrase: string;
  icon: string;
  timeSensitive: string | null;
  filterByInterest: boolean;
  applicabilityCount: number;
  searchPhrase: string;
  isNew: boolean;
}

export interface LibraryEdits {
  wct: Record<string, WCTEdit>;
  pf: Record<string, PFEdit>;
}

export async function getLibraryEdits(): Promise<LibraryEdits> {
  try {
    const raw = await fs.readFile(EDITS_PATH, "utf-8");
    return JSON.parse(raw) as LibraryEdits;
  } catch {
    return { wct: {}, pf: {} };
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

export function upsertWCTEdit(entry: WCTEdit): Promise<void> {
  return serialized(async () => {
    const edits = await getLibraryEdits();
    edits.wct[entry.id] = entry;
    await persist(edits);
  });
}

export function upsertPFEdit(entry: PFEdit): Promise<void> {
  return serialized(async () => {
    const edits = await getLibraryEdits();
    edits.pf[entry.id] = entry;
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

export function deletePFEdit(id: string): Promise<void> {
  return serialized(async () => {
    const edits = await getLibraryEdits();
    delete edits.pf[id];
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

export function markPFPushed(id: string, newPhrase: string): Promise<void> {
  return serialized(async () => {
    const edits = await getLibraryEdits();
    if (edits.pf[id]) {
      edits.pf[id].searchPhrase = newPhrase;
      await persist(edits);
    }
  });
}
