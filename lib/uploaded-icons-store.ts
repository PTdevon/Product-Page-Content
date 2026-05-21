import { shopifyGraphQL } from "./shopify";

export interface UploadedIcon { name: string; svg: string }

const TYPE = "pdp_uploaded_icons";

const QUERY = `
  query GetUploadedIcons {
    metaobjects(type: "${TYPE}", first: 1) {
      nodes { id fields { key value } }
    }
  }
`;

const CREATE = `
  mutation CreateUploadedIcons($f: [MetaobjectFieldInput!]!) {
    metaobjectCreate(metaobject: { type: "${TYPE}", fields: $f }) {
      metaobject { id }
      userErrors { field message }
    }
  }
`;

const UPDATE = `
  mutation UpdateUploadedIcons($id: ID!, $f: [MetaobjectFieldInput!]!) {
    metaobjectUpdate(id: $id, metaobject: { fields: $f }) {
      metaobject { id }
      userErrors { field message }
    }
  }
`;

const CREATE_DEF = `
  mutation CreateUploadedIconsDef {
    metaobjectDefinitionCreate(definition: {
      type: "${TYPE}",
      name: "PDP Uploaded Icons",
      fieldDefinitions: [{ name: "Icons JSON", key: "icons_json", type: "multi_line_text_field" }]
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

export async function getUploadedIcons(): Promise<UploadedIcon[]> {
  const node = await readNode();
  if (!node) return [];
  const field = node.fields.find((f) => f.key === "icons_json");
  if (!field?.value) return [];
  try { return JSON.parse(field.value) as UploadedIcon[]; } catch { return []; }
}

async function persist(icons: UploadedIcon[]): Promise<void> {
  const f = [{ key: "icons_json", value: JSON.stringify(icons) }];
  const node = await readNode();

  if (node) {
    await shopifyGraphQL(UPDATE, { id: node.id, f });
    return;
  }

  const res = await shopifyGraphQL<{
    metaobjectCreate: { metaobject: { id: string } | null; userErrors: { message: string }[] };
  }>(CREATE, { f });

  if (res.metaobjectCreate.userErrors.length > 0) {
    // Metaobject type doesn't exist yet — create the definition then retry
    await shopifyGraphQL(CREATE_DEF).catch(() => {});
    await shopifyGraphQL(CREATE, { f });
  }
}

export async function addUploadedIcon(icon: UploadedIcon): Promise<void> {
  const existing = await getUploadedIcons();
  const deduped = existing.filter((i) => i.name !== icon.name);
  await persist([...deduped, icon]);
}

export async function deleteUploadedIcon(name: string): Promise<void> {
  const existing = await getUploadedIcons();
  await persist(existing.filter((i) => i.name !== name));
}
