import { shopifyGraphQL } from "./shopify";

const QUERY = `
  query HiddenCollectionProducts($after: String) {
    collectionByHandle(handle: "hidden") {
      products(first: 250, after: $after) {
        nodes { id }
        pageInfo { hasNextPage }
        edges { cursor }
      }
    }
  }
`;

type HiddenCollectionResult = {
  collectionByHandle: {
    products: { nodes: { id: string }[]; pageInfo: { hasNextPage: boolean }; edges: { cursor: string }[] };
  } | null;
};

const CACHE_TTL_MS = 30_000;
let _cache: Set<string> | null = null;
let _cacheExpiry = 0;

export async function getHiddenProductIds(): Promise<Set<string>> {
  if (_cache && Date.now() < _cacheExpiry) return _cache;

  const ids = new Set<string>();
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: HiddenCollectionResult = await shopifyGraphQL<HiddenCollectionResult>(QUERY, { after });

    const products = data.collectionByHandle?.products;
    if (!products) break;

    for (const node of products.nodes) ids.add(node.id);
    hasNextPage = products.pageInfo.hasNextPage;
    after = products.edges[products.edges.length - 1]?.cursor ?? null;
  }

  _cache = ids;
  _cacheExpiry = Date.now() + CACHE_TTL_MS;
  return _cache;
}
