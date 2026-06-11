/**
 * One-off: show the live library-edits WCT entries and their searchFormatted values.
 * Run: npx tsx --env-file .env.local scripts/check-wct-edit.ts [id]
 */

import { getLibraryEdits } from "../lib/library-edits-store";

const id = process.argv[2];

(async () => {
  const edits = await getLibraryEdits();
  if (id) {
    const entry = edits.wct[id];
    console.log(`\nEntry ${id}:`, entry ? JSON.stringify(entry, null, 2) : "(not found in store)");
    return;
  }
  console.log("All WCT edits in live store:\n");
  for (const [eid, e] of Object.entries(edits.wct)) {
    console.log(`${eid}: "${e.text}" / "${e.subtext}"`);
    console.log(`  searchFormatted: "${e.searchFormatted}"`);
    console.log(`  isNew: ${e.isNew}`);
    console.log();
  }
})();
