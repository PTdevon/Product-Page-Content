/**
 * One-off: update all pdp_icon metaobject SVGs from stroke-width="1.8" to stroke-width="2".
 * Run with: npx tsx --env-file .env.local scripts/update-icon-stroke.ts
 */

const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const token = process.env.SHOPIFY_ACCESS_TOKEN!;
const API_VERSION = "2025-10";

async function shopifyGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data as T;
}

const LIST_ICONS = `
  query ListPdpIcons($cursor: String) {
    metaobjects(type: "pdp_icon", first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        svgField: field(key: "svg") { value }
      }
    }
  }
`;

const UPDATE_ICON = `
  mutation MetaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

async function getAllIcons() {
  const icons: Array<{ id: string; handle: string; svg: string }> = [];
  let cursor: string | undefined;
  while (true) {
    const data = await shopifyGraphQL<{
      metaobjects: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        nodes: Array<{ id: string; handle: string; svgField: { value: string } | null }>;
      };
    }>(LIST_ICONS, cursor ? { cursor } : {});
    for (const node of data.metaobjects.nodes) {
      icons.push({ id: node.id, handle: node.handle, svg: node.svgField?.value ?? "" });
    }
    if (!data.metaobjects.pageInfo.hasNextPage) break;
    cursor = data.metaobjects.pageInfo.endCursor;
  }
  return icons;
}

async function main() {
  const icons = await getAllIcons();
  console.log(`Found ${icons.length} icons.\n`);

  let updated = 0, skipped = 0, failed = 0;

  for (const icon of icons) {
    if (!icon.svg.includes('stroke-width="1.8"')) {
      console.log(`  · ${icon.handle} — no change needed`);
      skipped++;
      continue;
    }

    const newSvg = icon.svg.replace(/stroke-width="1\.8"/g, 'stroke-width="2"');

    try {
      const result = await shopifyGraphQL<{
        metaobjectUpdate: {
          metaobject: { id: string; handle: string } | null;
          userErrors: Array<{ field: string; message: string }>;
        };
      }>(UPDATE_ICON, {
        id: icon.id,
        metaobject: { fields: [{ key: "svg", value: newSvg }] },
      });

      if (result.metaobjectUpdate.userErrors.length > 0) {
        console.log(`  ✗ ${icon.handle} — ${result.metaobjectUpdate.userErrors[0].message}`);
        failed++;
      } else {
        console.log(`  ✓ ${icon.handle}`);
        updated++;
      }
    } catch (e) {
      console.log(`  ✗ ${icon.handle} — ${e instanceof Error ? e.message : e}`);
      failed++;
    }
  }

  console.log(`\nDone. Updated: ${updated}  Skipped: ${skipped}  Failed: ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
