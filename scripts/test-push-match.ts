/**
 * One-off: simulate the push match logic for a given WCT edit entry.
 * Scans products and shows exactly why each is skipped or matched.
 * Run: npx tsx --env-file .env.local scripts/test-push-match.ts wct-072
 */

import { shopifyGraphQL } from "../lib/shopify";
import { getLibraryEdits } from "../lib/library-edits-store";

const id = process.argv[2];
if (!id) { console.error("Usage: npx tsx --env-file .env.local scripts/test-push-match.ts <wct-id>"); process.exit(1); }

const SCAN_QUERY = `
  query ScanProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id title
          typePt:  metafield(namespace: "product", key: "product_type")  { value }
          stylePt: metafield(namespace: "product", key: "product_style") { value }
          wct1:    metafield(namespace: "why-choose-this", key: "bullet_1") { value }
          wct2:    metafield(namespace: "why-choose-this", key: "bullet_2") { value }
          wct3:    metafield(namespace: "why-choose-this", key: "bullet_3") { value }
          wct4:    metafield(namespace: "why-choose-this", key: "bullet_4") { value }
        }
        cursor
      }
      pageInfo { hasNextPage }
    }
  }
`;

type MF = { value: string } | null;
type ScanResult = { products: { edges: { node: { id: string; title: string; typePt: MF; stylePt: MF; wct1: MF; wct2: MF; wct3: MF; wct4: MF }; cursor: string }[]; pageInfo: { hasNextPage: boolean } } };

function fmt(text: string, subtext: string) { return `<strong>${text}</strong> ${subtext}`; }

(async () => {
  const edits = await getLibraryEdits();
  const entry = edits.wct[id];
  if (!entry) { console.error(`${id} not found in store`); process.exit(1); }

  const newFormatted = fmt(entry.text, entry.subtext);
  const oldFormatted = entry.searchFormatted || newFormatted;

  console.log(`Entry: ${id}`);
  console.log(`  productType: "${entry.productType}"`);
  console.log(`  productStyle: "${entry.productStyle}"`);
  console.log(`  oldFormatted: "${oldFormatted}"`);
  console.log(`  newFormatted: "${newFormatted}"`);
  console.log();

  let typeStyleMatch = 0, bulletMatch = 0, scanned = 0;
  let cursor: string | null = null;

  while (true) {
    const data = await shopifyGraphQL<ScanResult>(SCAN_QUERY, { first: 250, after: cursor });
    for (const { node } of data.products.edges) {
      scanned++;
      const productType = node.typePt?.value ?? "";
      const productStyle = node.stylePt?.value ?? "";
      const styles = productStyle.split(",").map((s: string) => s.trim());

      const typeOk = productType === entry.productType;
      const styleOk = styles.includes(entry.productStyle);

      if (!typeOk || !styleOk) continue;
      typeStyleMatch++;

      const bullets = [node.wct1?.value ?? "", node.wct2?.value ?? "", node.wct3?.value ?? "", node.wct4?.value ?? ""];
      const hasMatch = bullets.some(b => b === oldFormatted);
      if (hasMatch) {
        bulletMatch++;
        console.log(`  MATCH: ${node.title}`);
        console.log(`    type="${productType}" style="${productStyle}"`);
      } else {
        console.log(`  TYPE/STYLE OK but no bullet match: ${node.title}`);
        bullets.filter(b => b).forEach(b => console.log(`    bullet: ${b.substring(0, 80)}`));
      }
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.edges[data.products.edges.length - 1]?.cursor ?? null;
    process.stdout.write(`\rScanned ${scanned}…`);
  }

  console.log(`\nScanned ${scanned} total. Type/style match: ${typeStyleMatch}. Bullet match (would update): ${bulletMatch}.`);
})();
