import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { shopifyGraphQL } from "@/lib/shopify";
import { getLibraryEdits } from "@/lib/library-edits-store";

const SCAN_QUERY = `
  query ScanProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id title
          typePt:  metafield(namespace: "product",         key: "product_type_pt")  { value }
          stylePt: metafield(namespace: "product",         key: "product_style_pt") { value }
          wct1:    metafield(namespace: "why-choose-this", key: "bullet_1")          { value }
          wct2:    metafield(namespace: "why-choose-this", key: "bullet_2")          { value }
          wct3:    metafield(namespace: "why-choose-this", key: "bullet_3")          { value }
          wct4:    metafield(namespace: "why-choose-this", key: "bullet_4")          { value }
          pf1:     metafield(namespace: "perfect-for",     key: "perfect_bullet_1") { value }
          pf2:     metafield(namespace: "perfect-for",     key: "perfect_bullet_2") { value }
          pf3:     metafield(namespace: "perfect-for",     key: "perfect_bullet_3") { value }
          pf4:     metafield(namespace: "perfect-for",     key: "perfect_bullet_4") { value }
        }
        cursor
      }
      pageInfo { hasNextPage }
    }
  }
`;

type MF = { value: string } | null;
type ScanNode = {
  id: string; title: string;
  typePt: MF; stylePt: MF;
  wct1: MF; wct2: MF; wct3: MF; wct4: MF;
  pf1: MF; pf2: MF; pf3: MF; pf4: MF;
};
type ScanResult = {
  products: { edges: { node: ScanNode; cursor: string }[]; pageInfo: { hasNextPage: boolean } };
};

function formatWCT(text: string, subtext: string) {
  return `<strong>${text}</strong> ${subtext}`;
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { type, id } = await req.json() as { type: "wct" | "pf"; id: string };

  const edits = await getLibraryEdits();
  const entry = type === "wct" ? edits.wct[id] : edits.pf[id];
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const matches: { id: string; title: string }[] = [];
  let cursor: string | null = null;

  if (type === "wct") {
    const wctEntry = edits.wct[id];
    const oldFormatted = wctEntry.searchFormatted;
    if (!oldFormatted) return NextResponse.json({ products: [] });

    const newFormatted = formatWCT(wctEntry.text, wctEntry.subtext);

    while (true) {
      const data: ScanResult = await shopifyGraphQL<ScanResult>(SCAN_QUERY, { first: 250, after: cursor });

      for (const { node } of data.products.edges) {
        const productType = node.typePt?.value ?? "";
        const productStyle = node.stylePt?.value ?? "";
        if (productType !== wctEntry.productType || !productStyle.split(",").map((s: string) => s.trim()).includes(wctEntry.productStyle)) continue;

        const bullets = [node.wct1?.value ?? "", node.wct2?.value ?? "", node.wct3?.value ?? "", node.wct4?.value ?? ""];
        if (bullets.some((b) => b === oldFormatted) && oldFormatted !== newFormatted) {
          matches.push({ id: node.id, title: node.title });
        }
      }

      if (!data.products.pageInfo.hasNextPage) break;
      cursor = data.products.edges[data.products.edges.length - 1]?.cursor ?? null;
    }
  } else {
    const pfEntry = edits.pf[id];
    const oldPhrase = pfEntry.searchPhrase;
    if (!oldPhrase) return NextResponse.json({ products: [] });

    while (true) {
      const data: ScanResult = await shopifyGraphQL<ScanResult>(SCAN_QUERY, { first: 250, after: cursor });

      for (const { node } of data.products.edges) {
        const bullets = [node.pf1?.value ?? "", node.pf2?.value ?? "", node.pf3?.value ?? "", node.pf4?.value ?? ""];
        if (bullets.some((b) => b === oldPhrase) && oldPhrase !== pfEntry.phrase) {
          matches.push({ id: node.id, title: node.title });
        }
      }

      if (!data.products.pageInfo.hasNextPage) break;
      cursor = data.products.edges[data.products.edges.length - 1]?.cursor ?? null;
    }
  }

  return NextResponse.json({ products: matches });
}
