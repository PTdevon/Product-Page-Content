/**
 * One-off repair: update searchFormatted for wct-013 to match what is
 * currently on products (<strong>Adds instand personality</strong> Bold and confident design).
 * Run: npx tsx --env-file .env.local scripts/repair-wct-013.ts
 */

import { getLibraryEdits, upsertWCTEdit } from "../lib/library-edits-store";

(async () => {
  const edits = await getLibraryEdits();
  const entry = edits.wct["wct-013"];
  if (!entry) { console.error("wct-013 not found"); process.exit(1); }

  console.log("Before:", JSON.stringify(entry, null, 2));

  await upsertWCTEdit({
    ...entry,
    searchFormatted: `<strong>${entry.text}</strong> ${entry.subtext}`,
  });

  console.log("\nUpdated searchFormatted to:", `<strong>${entry.text}</strong> ${entry.subtext}`);
  console.log("Done. You can now update the text in the WCT library and products will be found.");
})();
