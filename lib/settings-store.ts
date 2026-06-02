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
    metaobjectCreate(metaobject: { type: "${METAOBJECT_TYPE}", fields: $fields }) {
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
      metaobjects: { nodes: { id: string; fields: { key: string; value: string }[] }[] };
    }>(LIST_QUERY);
    const node = data.metaobjects.nodes[0];
    if (!node) return DEFAULT_SETTINGS;
    return fieldsToSettings(node.fields);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const fields = settingsToFields(settings);

  // Check if metaobject already exists
  const existing = await shopifyGraphQL<{
    metaobjects: { nodes: { id: string }[] };
  }>(LIST_QUERY);

  const node = existing.metaobjects.nodes[0];

  if (node) {
    await shopifyGraphQL(UPDATE_MUTATION, { id: node.id, fields });
  } else {
    await shopifyGraphQL(CREATE_MUTATION, { fields });
  }
}
