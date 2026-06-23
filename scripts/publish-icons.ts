/**
 * One-off: publish all pdp_icon metaobjects that are currently in draft status.
 * Run with: npx tsx --env-file .env.local scripts/publish-icons.ts
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
        publishedStatus: capabilities { publishable { status } }
      }
    }
  }
`;

const PUBLISH_ICON = `
  mutation MetaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

async function getAllIcons() {
  const icons: Array<{ id: string; handle: string; status: string }> = [];
  let cursor: string | undefined;
  while (true) {
    const data = await shopifyGraphQL<{
      metaobjects: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        nodes: Array<{
          id: string;
          handle: string;
          publishedStatus: { publishable: { status: string } | null } | null;
        }>;
      };
    }>(LIST_ICONS, cursor ? { cursor } : {});
    for (const node of data.metaobjects.nodes) {
      icons.push({
        id: node.id,
        handle: node.handle,
        status: node.publishedStatus?.publishable?.status ?? "UNKNOWN",
      });
    }
    if (!data.metaobjects.pageInfo.hasNextPage) break;
    cursor = data.metaobjects.pageInfo.endCursor;
  }
  return icons;
}

async function main() {
  const icons = await getAllIcons();
  console.log(`Found ${icons.length} icons.\n`);

  let published = 0, skipped = 0, failed = 0;

  for (const icon of icons) {
    if (icon.status === "ACTIVE") {
      console.log(`  · ${icon.handle} — already published`);
      skipped++;
      continue;
    }

    try {
      const result = await shopifyGraphQL<{
        metaobjectUpdate: {
          metaobject: { id: string; handle: string } | null;
          userErrors: Array<{ field: string; message: string }>;
        };
      }>(PUBLISH_ICON, {
        id: icon.id,
        metaobject: { capabilities: { publishable: { status: "ACTIVE" } } },
      });

      if (result.metaobjectUpdate.userErrors.length > 0) {
        console.log(`  ✗ ${icon.handle} — ${result.metaobjectUpdate.userErrors[0].message}`);
        failed++;
      } else {
        console.log(`  ✓ ${icon.handle}`);
        published++;
      }
    } catch (e) {
      console.log(`  ✗ ${icon.handle} — ${e instanceof Error ? e.message : e}`);
      failed++;
    }
  }

  console.log(`\nDone. Published: ${published}  Already active: ${skipped}  Failed: ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
