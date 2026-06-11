/**
 * One-off: find all products whose WCT bullets contain a given text snippet.
 * Run: npx tsx --env-file .env.local scripts/find-wct-text.ts "Adds value every day"
 */

import { shopifyGraphQL } from "../lib/shopify";

const searchText = process.argv[2];
if (!searchText) { console.error("Usage: npx tsx --env-file .env.local scripts/find-wct-text.ts \"<text>\""); process.exit(1); }

const QUERY = `
  query ScanProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id title handle
          wct1: metafield(namespace: "why-choose-this", key: "bullet_1") { value }
          wct2: metafield(namespace: "why-choose-this", key: "bullet_2") { value }
          wct3: metafield(namespace: "why-choose-this", key: "bullet_3") { value }
          wct4: metafield(namespace: "why-choose-this", key: "bullet_4") { value }
        }
        cursor
      }
      pageInfo { hasNextPage }
    }
  }
`;

type MF = { value: string } | null;
type ScanResult = { products: { edges: { node: { id: string; title: string; handle: string; wct1: MF; wct2: MF; wct3: MF; wct4: MF }; cursor: string }[]; pageInfo: { hasNextPage: boolean } } };

(async () => {
  const matches: { title: string; handle: string; bullets: string[] }[] = [];
  let cursor: string | null = null;
  let total = 0;

  while (true) {
    const data = await shopifyGraphQL<ScanResult>(QUERY, { first: 250, after: cursor });
    total += data.products.edges.length;
    for (const { node } of data.products.edges) {
      const bullets = [node.wct1?.value ?? "", node.wct2?.value ?? "", node.wct3?.value ?? "", node.wct4?.value ?? ""];
      const matching = bullets.filter(b => b.includes(searchText));
      if (matching.length) matches.push({ title: node.title, handle: node.handle, bullets: matching });
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.edges[data.products.edges.length - 1]?.cursor ?? null;
    process.stdout.write(`\rScanned ${total} products…`);
  }

  console.log(`\rScanned ${total} products. Found ${matches.length} with "${searchText}":\n`);
  for (const m of matches) {
    console.log(`• ${m.title}`);
    for (const b of m.bullets) console.log(`    ${b}`);
  }
  if (matches.length === 0) console.log("(none)");
})();
