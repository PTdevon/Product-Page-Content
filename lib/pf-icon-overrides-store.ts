import { shopifyGraphQL } from "./shopify";

const TYPE = "pdp_pf_icon_overrides";

const QUERY = `
  query GetPfIconOverrides {
    metaobjects(type: "${TYPE}", first: 1) {
      nodes { id fields { key value } }
    }
  }
`;

const CREATE = `
  mutation CreatePfIconOverrides($f: [MetaobjectFieldInput!]!) {
    metaobjectCreate(metaobject: { type: "${TYPE}", fields: $f }) {
      metaobject { id }
      userErrors { field message }
    }
  }
`;

const UPDATE = `
  mutation UpdatePfIconOverrides($id: ID!, $f: [MetaobjectFieldInput!]!) {
    metaobjectUpdate(id: $id, metaobject: { fields: $f }) {
      metaobject { id }
      userErrors { field message }
    }
  }
`;

const CREATE_DEF = `
  mutation CreatePfIconOverridesDef {
    metaobjectDefinitionCreate(definition: {
      type: "${TYPE}",
      name: "PDP PF Icon Overrides",
      fieldDefinitions: [{ name: "Overrides JSON", key: "overrides_json", type: "multi_line_text_field" }]
    }) {
      metaobjectDefinition { id }
      userErrors { field message }
    }
  }
`;

type Node = { id: string; fields: { key: string; value: string }[] };

async function readNode(): Promise<Node | null> {
  try {
    const data = await shopifyGraphQL<{ metaobjects: { nodes: Node[] } }>(QUERY);
    return data.metaobjects.nodes[0] ?? null;
  } catch {
    return null;
  }
}

export async function getPfIconOverrides(): Promise<Record<string, string>> {
  const node = await readNode();
  if (!node) return {};
  const field = node.fields.find((f) => f.key === "overrides_json");
  if (!field?.value) return {};
  try { return JSON.parse(field.value) as Record<string, string>; } catch { return {}; }
}

async function persist(overrides: Record<string, string>): Promise<void> {
  const f = [{ key: "overrides_json", value: JSON.stringify(overrides) }];
  const node = await readNode();

  if (node) {
    await shopifyGraphQL(UPDATE, { id: node.id, f });
    return;
  }

  const res = await shopifyGraphQL<{
    metaobjectCreate: { metaobject: { id: string } | null; userErrors: { message: string }[] };
  }>(CREATE, { f });

  if (res.metaobjectCreate.userErrors.length > 0) {
    await shopifyGraphQL(CREATE_DEF).catch(() => {});
    await shopifyGraphQL(CREATE, { f });
  }
}

export async function setPfIconOverride(id: string, icon: string): Promise<void> {
  const existing = await getPfIconOverrides();
  await persist({ ...existing, [id]: icon });
}

export async function deletePfIconOverride(id: string): Promise<void> {
  const existing = await getPfIconOverrides();
  const { [id]: _, ...rest } = existing;
  await persist(rest);
}
