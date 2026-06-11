import { shopifyGraphQL } from "./shopify";
import { BUILTIN_ICON_NAMES, getBuiltinSvg, minifySvg } from "./icons";
import { getUploadedIcons } from "./uploaded-icons-store";

export interface IconMetaobject {
  id: string;
  handle: string;
  svg: string;
}

const LIST_ICONS_QUERY = `
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

const GET_ICON_BY_HANDLE_QUERY = `
  query GetPdpIcon($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) {
      id
      handle
      svgField: field(key: "svg") { value }
    }
  }
`;

const CREATE_ICON_MUTATION = `
  mutation MetaobjectCreate($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

const DELETE_ICON_MUTATION = `
  mutation MetaobjectDelete($id: ID!) {
    metaobjectDelete(id: $id) {
      deletedId
      userErrors { field message }
    }
  }
`;

const CHECK_DEFINITION_QUERY = `
  query CheckPdpIconDefinition {
    metaobjectDefinitionByType(type: "pdp_icon") { id }
  }
`;

const CREATE_DEFINITION_MUTATION = `
  mutation MetaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id }
      userErrors { field message }
    }
  }
`;

interface ListIconsResult {
  metaobjects: {
    pageInfo: { hasNextPage: boolean; endCursor: string };
    nodes: Array<{ id: string; handle: string; svgField: { value: string } | null }>;
  };
}

interface GetIconResult {
  metaobjectByHandle: { id: string; handle: string; svgField: { value: string } | null } | null;
}

export async function getAllIcons(): Promise<IconMetaobject[]> {
  const icons: IconMetaobject[] = [];
  let cursor: string | undefined;
  while (true) {
    const data = await shopifyGraphQL<ListIconsResult>(
      LIST_ICONS_QUERY,
      cursor ? { cursor } : {}
    );
    for (const node of data.metaobjects.nodes) {
      icons.push({ id: node.id, handle: node.handle, svg: node.svgField?.value ?? "" });
    }
    if (!data.metaobjects.pageInfo.hasNextPage) break;
    cursor = data.metaobjects.pageInfo.endCursor;
  }
  return icons;
}

export async function getIcon(name: string): Promise<IconMetaobject | null> {
  const data = await shopifyGraphQL<GetIconResult>(GET_ICON_BY_HANDLE_QUERY, {
    handle: { type: "pdp_icon", handle: name },
  });
  const obj = data.metaobjectByHandle;
  if (!obj) return null;
  return { id: obj.id, handle: obj.handle, svg: obj.svgField?.value ?? "" };
}

export async function createIcon(name: string, svg: string): Promise<IconMetaobject> {
  const cleanSvg = minifySvg(svg);
  const result = await shopifyGraphQL<{
    metaobjectCreate: {
      metaobject: { id: string; handle: string } | null;
      userErrors: Array<{ field: string; message: string }>;
    };
  }>(CREATE_ICON_MUTATION, {
    metaobject: {
      type: "pdp_icon",
      handle: name,
      fields: [{ key: "svg", value: cleanSvg }],
    },
  });

  if (result.metaobjectCreate.userErrors.length > 0) {
    throw new Error(result.metaobjectCreate.userErrors[0].message);
  }

  const obj = result.metaobjectCreate.metaobject!;
  return { id: obj.id, handle: obj.handle, svg: cleanSvg };
}

export async function deleteIcon(id: string): Promise<void> {
  const result = await shopifyGraphQL<{
    metaobjectDelete: {
      deletedId: string | null;
      userErrors: Array<{ field: string; message: string }>;
    };
  }>(DELETE_ICON_MUTATION, { id });

  if (result.metaobjectDelete.userErrors.length > 0) {
    throw new Error(result.metaobjectDelete.userErrors[0].message);
  }
}

let _seedInFlight: Promise<void> | null = null;

export function ensureDefinitionAndSeed(): Promise<void> {
  if (!_seedInFlight) {
    _seedInFlight = _doEnsureDefinitionAndSeed().finally(() => { _seedInFlight = null; });
  }
  return _seedInFlight;
}

async function _doEnsureDefinitionAndSeed(): Promise<void> {
  const checkResult = await shopifyGraphQL<{
    metaobjectDefinitionByType: { id: string } | null;
  }>(CHECK_DEFINITION_QUERY);

  // Definition already exists — not a first deploy; don't re-seed
  if (checkResult.metaobjectDefinitionByType) return;

  const defResult = await shopifyGraphQL<{
    metaobjectDefinitionCreate: {
      metaobjectDefinition: { id: string } | null;
      userErrors: Array<{ field: string; message: string }>;
    };
  }>(CREATE_DEFINITION_MUTATION, {
    definition: {
      type: "pdp_icon",
      name: "PDP Icon",
      fieldDefinitions: [
        { name: "SVG", key: "svg", type: "multi_line_text_field" },
      ],
    },
  });

  if (defResult.metaobjectDefinitionCreate.userErrors.length > 0) {
    throw new Error(defResult.metaobjectDefinitionCreate.userErrors[0].message);
  }

  // Seed all 35 built-in icons
  for (const name of BUILTIN_ICON_NAMES) {
    const svg = getBuiltinSvg(name);
    if (!svg) continue;
    try {
      await createIcon(name, svg);
    } catch {
      // Skip if already exists
    }
  }

  // Migrate any previously uploaded icons from pdp_library_edits
  try {
    const uploaded = await getUploadedIcons();
    for (const icon of uploaded) {
      try {
        await createIcon(icon.name, icon.svg);
      } catch {
        // Skip duplicates
      }
    }
  } catch {
    // Migration is best-effort
  }
}
