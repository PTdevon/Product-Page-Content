import { shopifyGraphQL } from "./shopify";
import { getPfLibrary } from "./pf-store";

const USAGE_QUERY = `
  query IconUsagePage($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        title
        pfIcon1: metafield(namespace: "perfect-for", key: "icon_1") { value }
        pfIcon2: metafield(namespace: "perfect-for", key: "icon_2") { value }
        pfIcon3: metafield(namespace: "perfect-for", key: "icon_3") { value }
        pfIcon4: metafield(namespace: "perfect-for", key: "icon_4") { value }
      }
    }
  }
`;

interface UsageQueryResult {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string };
    nodes: Array<{
      title: string;
      pfIcon1: { value: string } | null;
      pfIcon2: { value: string } | null;
      pfIcon3: { value: string } | null;
      pfIcon4: { value: string } | null;
    }>;
  };
}

function iconMatchesName(value: string, name: string): boolean {
  if (value === name) return true;
  // Transition: stored value is an SVG string with id="name"
  if (value.startsWith("<svg")) {
    const match = value.match(/\bid="([^"]+)"/);
    return match?.[1] === name;
  }
  return false;
}

export async function findIconUsage(name: string): Promise<{
  products: string[];
  phrases: string[];
}> {
  const library = await getPfLibrary();
  const seenPhraseIds = new Set<string>();
  const phrases: string[] = [];
  for (const entry of library) {
    if (seenPhraseIds.has(entry.phraseId)) continue;
    seenPhraseIds.add(entry.phraseId);
    if (entry.icon && iconMatchesName(entry.icon.trim(), name)) {
      phrases.push(entry.phrase);
    }
  }

  const products: string[] = [];
  let cursor: string | undefined;
  while (true) {
    const data = await shopifyGraphQL<UsageQueryResult>(
      USAGE_QUERY,
      cursor ? { cursor } : {}
    );
    for (const p of data.products.nodes) {
      const icons = [p.pfIcon1, p.pfIcon2, p.pfIcon3, p.pfIcon4]
        .map((f) => f?.value?.trim() ?? "")
        .filter(Boolean);
      if (icons.some((i) => iconMatchesName(i, name))) {
        products.push(p.title);
      }
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  return { products, phrases };
}
