/**
 * One-off script: converts perfect-for icon metafields from full SVG strings → icon names.
 * Reads icon_1..4 from the "perfect-for" namespace; if the value is an SVG string with
 * an id="name" attribute, extracts the name and writes it back.
 *
 * Usage: npm run migrate-icons
 */

const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const token  = process.env.SHOPIFY_ACCESS_TOKEN!;
const API_VERSION = "2026-01";

async function shopifyGQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(
    `https://${domain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
    }
  );
  if (!res.ok) throw new Error(`Shopify API ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

const QUERY_PRODUCTS = `
  query($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          metafields(first: 10, namespace: "perfect-for") {
            edges { node { key value } }
          }
        }
      }
    }
  }
`;

const SET_METAFIELDS = `
  mutation($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message }
    }
  }
`;

function extractIconName(value: string): string | null {
  if (!value || value.startsWith("https://") || !value.startsWith("<svg")) return null;
  const match = value.match(/\bid="([^"]+)"/);
  return match ? match[1] : null;
}

async function main() {
  if (!domain || !token) {
    console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN in .env.local");
    process.exit(1);
  }

  console.log('Migrating perfect-for icon metafields from SVG strings → icon names...\n');

  const ICON_KEYS = new Set(["icon_1", "icon_2", "icon_3", "icon_4"]);
  let cursor: string | null = null;
  let totalScanned = 0;
  let totalConverted = 0;
  let totalErrors = 0;

  while (true) {
    const data = await shopifyGQL<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: {
          node: {
            id: string;
            title: string;
            metafields: { edges: { node: { key: string; value: string } }[] };
          };
        }[];
      };
    }>(QUERY_PRODUCTS, { cursor });

    for (const { node: product } of data.products.edges) {
      totalScanned++;

      const toUpdate = product.metafields.edges
        .map((e) => e.node)
        .filter((mf) => ICON_KEYS.has(mf.key))
        .map((mf) => ({ key: mf.key, name: extractIconName(mf.value) }))
        .filter((mf): mf is { key: string; name: string } => mf.name !== null);

      if (toUpdate.length === 0) continue;

      console.log(`${product.title} — converting ${toUpdate.length} icon(s)`);

      const result = await shopifyGQL<{
        metafieldsSet: { userErrors: { field: string; message: string }[] };
      }>(SET_METAFIELDS, {
        metafields: toUpdate.map((mf) => ({
          ownerId:   product.id,
          namespace: "perfect-for",
          key:       mf.key,
          value:     mf.name,
          type:      "single_line_text_field",
        })),
      });

      if (result.metafieldsSet.userErrors.length > 0) {
        console.error(`  ✗ ${JSON.stringify(result.metafieldsSet.userErrors)}`);
        totalErrors++;
      } else {
        for (const mf of toUpdate) {
          console.log(`  ✓ ${mf.key} → "${mf.name}"`);
          totalConverted++;
        }
      }
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  console.log(`\nDone. Scanned ${totalScanned} products, converted ${totalConverted} icon(s), ${totalErrors} error(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
