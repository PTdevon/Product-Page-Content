import { BUILTIN_ICON_NAMES, getBuiltinSvg, minifySvg } from "../lib/icons";

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

const CREATE_ICON = `
  mutation MetaobjectCreate($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

async function createIcon(name: string, svg: string) {
  const result = await shopifyGraphQL<{
    metaobjectCreate: {
      metaobject: { id: string; handle: string } | null;
      userErrors: Array<{ field: string; message: string }>;
    };
  }>(CREATE_ICON, {
    metaobject: {
      type: "pdp_icon",
      handle: name,
      fields: [{ key: "svg", value: minifySvg(svg) }],
    },
  });

  const errors = result.metaobjectCreate.userErrors;
  if (errors.length > 0) {
    const msg = errors[0].message;
    if (/already|taken|duplicate/i.test(msg)) return "skipped";
    throw new Error(msg);
  }
  return "created";
}

async function main() {
  console.log(`Seeding ${BUILTIN_ICON_NAMES.length} icons into pdp_icon metaobjects…\n`);
  let created = 0, skipped = 0, failed = 0;

  for (const name of BUILTIN_ICON_NAMES) {
    const svg = getBuiltinSvg(name);
    if (!svg) { console.log(`  ✗ ${name} — no SVG found`); failed++; continue; }
    try {
      const result = await createIcon(name, svg);
      if (result === "skipped") {
        console.log(`  · ${name} — already exists`);
        skipped++;
      } else {
        console.log(`  ✓ ${name}`);
        created++;
      }
    } catch (e) {
      console.log(`  ✗ ${name} — ${e instanceof Error ? e.message : e}`);
      failed++;
    }
  }

  console.log(`\nDone. Created: ${created}  Skipped: ${skipped}  Failed: ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
