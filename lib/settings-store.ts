import { shopifyGraphQL } from "./shopify";
import type { AppSettings } from "./types";

const METAOBJECT_TYPE = "pdp_app_settings";

const DEFAULT_INTEREST_KEYWORDS: Record<string, string[]> = {
  "Travel lovers":        ["travel", "traveller", "traveler", "holiday", "luggage", "passport", "suitcase", "explorer", "wanderlust", "abroad"],
  "Craft Lovers":         ["craft", "knitting", "knit", "sewing", "sew", "crochet", "embroidery", "quilting", "needlework", "maker", "diy"],
  "Foodies":              ["food", "cook", "cooking", "kitchen", "recipe", "baking", "baker", "chef", "gourmet", "culinary", "foodie"],
  "Outdoor Types":        ["outdoor", "garden", "gardening", "hiking", "hike", "camping", "nature", "walking", "rambling", "adventure", "trail"],
  "Outdoor entertaining": ["outdoor", "garden", "barbecue", "bbq", "picnic", "al fresco", "alfresco", "patio", "terrace", "entertaining"],
  "Music Lovers":         ["music", "musician", "guitar", "piano", "violin", "vinyl", "concert", "singing", "band", "instrument", "melody", "song"],
  "Sports Fans":          ["sport", "sports", "football", "rugby", "cricket", "tennis", "golf", "fitness", "gym", "athlete", "team", "match"],
};

const DEFAULT_SETTINGS: AppSettings = {
  dateRanges: { mothersDay: null, fathersDay: null, valentinesDay: null },
  interestKeywords: DEFAULT_INTEREST_KEYWORDS,
};

const LIST_QUERY = `
  query GetSettings {
    metaobjects(type: "${METAOBJECT_TYPE}", first: 1) {
      nodes { id fields { key value } }
    }
  }
`;

const CREATE_MUTATION = `
  mutation CreateSettings($fields: [MetaobjectFieldInput!]!) {
    metaobjectCreate(metaobject: { type: "${METAOBJECT_TYPE}", handle: "main", fields: $fields }) {
      metaobject { id }
      userErrors { field message }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation UpdateSettings($id: ID!, $fields: [MetaobjectFieldInput!]!) {
    metaobjectUpdate(id: $id, metaobject: { fields: $fields }) {
      metaobject { id }
      userErrors { field message }
    }
  }
`;

const CREATE_DEF = `
  mutation CreateSettingsDef {
    metaobjectDefinitionCreate(definition: {
      type: "${METAOBJECT_TYPE}",
      name: "PDP App Settings",
      fieldDefinitions: [
        { name: "Date Ranges", key: "date_ranges", type: "multi_line_text_field" },
        { name: "Interest Keywords", key: "interest_keywords", type: "multi_line_text_field" }
      ]
    }) {
      metaobjectDefinition { id }
      userErrors { field message }
    }
  }
`;

type ShopifyNode = { id: string; fields: { key: string; value: string }[] };

let _nodeId: string | null = null;

function settingsToFields(s: AppSettings) {
  return [
    { key: "date_ranges", value: JSON.stringify(s.dateRanges) },
    { key: "interest_keywords", value: JSON.stringify(s.interestKeywords) },
  ];
}

function fieldsToSettings(fields: { key: string; value: string }[]): AppSettings {
  const drField = fields.find((f) => f.key === "date_ranges");
  const ikField = fields.find((f) => f.key === "interest_keywords");

  let dateRanges = DEFAULT_SETTINGS.dateRanges;
  if (drField) {
    try { dateRanges = JSON.parse(drField.value); } catch { /* use default */ }
  }

  let interestKeywords = DEFAULT_INTEREST_KEYWORDS;
  if (ikField) {
    try { interestKeywords = JSON.parse(ikField.value); } catch { /* use default */ }
  }

  return { dateRanges, interestKeywords };
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const data = await shopifyGraphQL<{
      metaobjects: { nodes: ShopifyNode[] };
    }>(LIST_QUERY);
    const node = data.metaobjects.nodes[0];
    if (!node) return DEFAULT_SETTINGS;
    _nodeId = node.id;
    return fieldsToSettings(node.fields);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function persist(settings: AppSettings): Promise<void> {
  const fields = settingsToFields(settings);

  if (_nodeId) {
    const res = await shopifyGraphQL<{
      metaobjectUpdate: { metaobject: { id: string } | null; userErrors: { message: string }[] };
    }>(UPDATE_MUTATION, { id: _nodeId, fields });
    if (res.metaobjectUpdate.userErrors.length > 0) {
      throw new Error(`Shopify save failed: ${res.metaobjectUpdate.userErrors.map((e) => e.message).join(", ")}`);
    }
    return;
  }

  // No cached node ID — query first
  const check = await shopifyGraphQL<{ metaobjects: { nodes: ShopifyNode[] } }>(LIST_QUERY);
  const existing = check.metaobjects.nodes[0] ?? null;
  if (existing) {
    _nodeId = existing.id;
    const res = await shopifyGraphQL<{
      metaobjectUpdate: { metaobject: { id: string } | null; userErrors: { message: string }[] };
    }>(UPDATE_MUTATION, { id: _nodeId, fields });
    if (res.metaobjectUpdate.userErrors.length > 0) {
      throw new Error(`Shopify save failed: ${res.metaobjectUpdate.userErrors.map((e) => e.message).join(", ")}`);
    }
    return;
  }

  // No node exists yet — try to create it
  const res = await shopifyGraphQL<{
    metaobjectCreate: { metaobject: { id: string } | null; userErrors: { message: string }[] };
  }>(CREATE_MUTATION, { fields });

  if (res.metaobjectCreate.metaobject?.id) {
    _nodeId = res.metaobjectCreate.metaobject.id;
    return;
  }

  // Metaobject type doesn't exist yet — auto-create the definition then retry.
  // Only attempt this for type-missing errors; other errors (permissions, field
  // validation, duplicate handle) should surface immediately.
  if (res.metaobjectCreate.userErrors.length > 0) {
    const isTypeMissing = res.metaobjectCreate.userErrors.some(
      (e) => /type|definition/i.test(e.message) || e.field === "type"
    );
    if (!isTypeMissing) {
      throw new Error(`Shopify save failed: ${res.metaobjectCreate.userErrors.map((e) => e.message).join(", ")}`);
    }

    let defCreated = false;
    let defError = "";
    try {
      const defRes = await shopifyGraphQL<{
        metaobjectDefinitionCreate: {
          metaobjectDefinition: { id: string } | null;
          userErrors: { message: string }[];
        };
      }>(CREATE_DEF);
      defCreated = !!defRes.metaobjectDefinitionCreate.metaobjectDefinition?.id;
      if (!defCreated) {
        defError = defRes.metaobjectDefinitionCreate.userErrors.map((e) => e.message).join(", ") || "unknown error";
      }
    } catch (e) {
      defError = (e as Error).message;
    }

    if (!defCreated) {
      throw new Error(
        `Could not auto-create the "${METAOBJECT_TYPE}" metaobject definition (${defError}). ` +
        `Please create it manually in Shopify Admin → Settings → Custom data → Metaobjects.`
      );
    }

    const retry = await shopifyGraphQL<{
      metaobjectCreate: { metaobject: { id: string } | null; userErrors: { message: string }[] };
    }>(CREATE_MUTATION, { fields });
    if (retry.metaobjectCreate.metaobject?.id) {
      _nodeId = retry.metaobjectCreate.metaobject.id;
      return;
    }
    throw new Error(`Shopify save failed: ${retry.metaobjectCreate.userErrors.map((e) => e.message).join(", ")}`);
  }
}

// Serialize mutations so concurrent requests don't overwrite each other
let mutationChain: Promise<void> = Promise.resolve();
function serialized(fn: () => Promise<void>): Promise<void> {
  const next = mutationChain.then(fn);
  mutationChain = next.catch(() => {});
  return next;
}

export function saveSettings(settings: AppSettings): Promise<void> {
  return serialized(() => persist(settings));
}
