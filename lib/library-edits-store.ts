import { shopifyGraphQL } from "./shopify";

const TYPE = "pdp_library_edits";

const QUERY = `
  query GetLibraryEdits {
    metaobjects(type: "${TYPE}", first: 1) {
      nodes { id fields { key value } }
    }
  }
`;

const CREATE = `
  mutation CreateLibraryEdits($f: [MetaobjectFieldInput!]!) {
    metaobjectCreate(metaobject: { type: "${TYPE}", fields: $f }) {
      metaobject { id }
      userErrors { field message }
    }
  }
`;

const UPDATE = `
  mutation UpdateLibraryEdits($id: ID!, $f: [MetaobjectFieldInput!]!) {
    metaobjectUpdate(id: $id, metaobject: { fields: $f }) {
      metaobject { id }
      userErrors { field message }
    }
  }
`;

const CREATE_DEF = `
  mutation CreateLibraryEditsDef {
    metaobjectDefinitionCreate(definition: {
      type: "${TYPE}",
      name: "PDP Library Edits",
      fieldDefinitions: [{ name: "Edits JSON", key: "edits_json", type: "multi_line_text_field" }]
    }) {
      metaobjectDefinition { id }
      userErrors { field message }
    }
  }
`;

export interface WCTEdit {
  id: string;
  productType: string;
  productStyle: string;
  category: string;
  text: string;
  subtext: string;
  /** The formatted string currently in Shopify product metafields — used to find products during push */
  searchFormatted: string;
  isNew: boolean;
}

export interface PFEdit {
  id: string;
  productType: string;
  productStyle: string;
  category: string;
  phrase: string;
  icon: string;
  timeSensitive: string | null;
  filterByInterest: boolean;
  applicabilityCount: number;
  /** The phrase string currently in Shopify product metafields — used to find products during push */
  searchPhrase: string;
  isNew: boolean;
}

export interface LibraryEdits {
  wct: Record<string, WCTEdit>;
  pf: Record<string, PFEdit>;
}

type Node = { id: string; fields: { key: string; value: string }[] };

async function readNode(): Promise<Node | null> {
  try {
    const data = await shopifyGraphQL<{ metaobjects: { nodes: Node[] } }>(QUERY);
    return data.metaobjects.nodes[0] ?? null;
  } catch {
    return null;
  }
}

export async function getLibraryEdits(): Promise<LibraryEdits> {
  const node = await readNode();
  if (!node) return { wct: {}, pf: {} };
  const field = node.fields.find((f) => f.key === "edits_json");
  if (!field?.value) return { wct: {}, pf: {} };
  try {
    return JSON.parse(field.value) as LibraryEdits;
  } catch {
    return { wct: {}, pf: {} };
  }
}

async function persist(edits: LibraryEdits): Promise<void> {
  const f = [{ key: "edits_json", value: JSON.stringify(edits) }];
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

export async function upsertWCTEdit(entry: WCTEdit): Promise<void> {
  const edits = await getLibraryEdits();
  edits.wct[entry.id] = entry;
  await persist(edits);
}

export async function upsertPFEdit(entry: PFEdit): Promise<void> {
  const edits = await getLibraryEdits();
  edits.pf[entry.id] = entry;
  await persist(edits);
}

export async function deleteWCTEdit(id: string): Promise<void> {
  const edits = await getLibraryEdits();
  delete edits.wct[id];
  await persist(edits);
}

export async function deletePFEdit(id: string): Promise<void> {
  const edits = await getLibraryEdits();
  delete edits.pf[id];
  await persist(edits);
}

/** After a successful push, update searchFormatted so future pushes find the new text */
export async function markWCTPushed(id: string, newFormatted: string): Promise<void> {
  const edits = await getLibraryEdits();
  if (edits.wct[id]) {
    edits.wct[id].searchFormatted = newFormatted;
    await persist(edits);
  }
}

export async function markPFPushed(id: string, newPhrase: string): Promise<void> {
  const edits = await getLibraryEdits();
  if (edits.pf[id]) {
    edits.pf[id].searchPhrase = newPhrase;
    await persist(edits);
  }
}
