import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { shopifyGraphQL } from "@/lib/shopify";
import { setProductMetafields } from "@/lib/metafields";
import { getPfLibrary } from "@/lib/pf-store";
import type { PerfectForEntry } from "@/lib/types";

// Replaces oldPhrase with newPhrase in product Perfect For bullets.
// If productType/productStyle are provided, only updates products matching that type/style.
// When newPhrase is already present in a product's bullets, falls back to the best
// applicable non-duplicate phrase from the library rather than creating a duplicate.
// Streams SSE progress events.

const SCAN_QUERY = `
  query ScanProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id title
          typePt:  metafield(namespace: "product", key: "product_type")  { value }
          stylePt: metafield(namespace: "product", key: "product_style") { value }
          pf1: metafield(namespace: "perfect-for", key: "perfect_bullet_1") { value }
          pf2: metafield(namespace: "perfect-for", key: "perfect_bullet_2") { value }
          pf3: metafield(namespace: "perfect-for", key: "perfect_bullet_3") { value }
          pf4: metafield(namespace: "perfect-for", key: "perfect_bullet_4") { value }
        }
        cursor
      }
      pageInfo { hasNextPage }
    }
  }
`;

const NODES_QUERY = `
  query($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id title
        typePt:  metafield(namespace: "product", key: "product_type")  { value }
        stylePt: metafield(namespace: "product", key: "product_style") { value }
        pf1: metafield(namespace: "perfect-for", key: "perfect_bullet_1") { value }
        pf2: metafield(namespace: "perfect-for", key: "perfect_bullet_2") { value }
        pf3: metafield(namespace: "perfect-for", key: "perfect_bullet_3") { value }
        pf4: metafield(namespace: "perfect-for", key: "perfect_bullet_4") { value }
      }
    }
  }
`;

type MF = { value: string } | null;
type ScanNode = {
  id: string; title: string;
  typePt: MF; stylePt: MF;
  pf1: MF; pf2: MF; pf3: MF; pf4: MF;
};
type ScanResult = {
  products: { edges: { node: ScanNode; cursor: string }[]; pageInfo: { hasNextPage: boolean } };
};
type NodesResult = { nodes: (ScanNode | null)[] };

// Finds the best phrase from the library that is applicable to the product's type/style
// and doesn't duplicate any of the bullets the product will keep.
function pickAlternative(
  pfLibrary: PerfectForEntry[],
  nodeType: string,
  productStyles: string[],
  excludedPhrases: Set<string>
): string | null {
  const seen = new Set<string>();
  for (const entry of pfLibrary) {
    if (entry.timeSensitive) continue;
    if (seen.has(entry.phrase)) continue;
    seen.add(entry.phrase);
    if (excludedPhrases.has(entry.phrase)) continue;
    const typeMatch = entry.productType === "ALL" || entry.productType === nodeType;
    const styleMatch = entry.productStyle === "ALL" || productStyles.includes(entry.productStyle);
    if (typeMatch && styleMatch) return entry.phrase;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { oldPhrase, newPhrase, productType, productStyle, retryIds, revert } = await req.json() as {
    oldPhrase: string;
    newPhrase: string;
    productType?: string;
    productStyle?: string;
    retryIds?: string[];
    revert?: { id: string; bullets: string[] }[];
  };

  if (!revert && (!oldPhrase || !newPhrase)) {
    return new Response(JSON.stringify({ error: "oldPhrase and newPhrase required" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      // ── Revert mode: restore exact prior bullet values, no matching logic ──────
      if (revert) {
        let updated = 0;
        let failed = 0;
        for (const { id, bullets } of revert) {
          try {
            await setProductMetafields(id, {
              perfectFor: { bullet1: bullets[0], bullet2: bullets[1], bullet3: bullets[2], bullet4: bullets[3] },
            });
            updated++;
            send({ type: "progress", id, title: id, status: "updated" });
          } catch {
            failed++;
            send({ type: "progress", id, title: id, status: "error" });
          }
        }
        send({ type: "done", total: revert.length, updated, swapped: updated, alternated: 0, skipped: 0, failed });
        controller.close();
        return;
      }

      let swapped = 0;      // received the chosen newPhrase
      let alternated = 0;  // duplicate detected — received a library alternative instead
      let skipped = 0;
      let failed = 0;
      // Loaded lazily — only if a duplicate case is encountered
      let pfLibrary: PerfectForEntry[] | null = null;

      const process = async (node: ScanNode) => {
        const nodeType = node.typePt?.value ?? "";
        const nodeStyle = node.stylePt?.value ?? "";

        // Apply type/style filter if specified
        if (productType && nodeType !== productType) { skipped++; return; }
        if (productStyle && productStyle !== "ALL") {
          const styles = nodeStyle.split(",").map((s: string) => s.trim());
          if (!styles.includes(productStyle)) { skipped++; return; }
        }

        const bullets = [
          node.pf1?.value ?? "", node.pf2?.value ?? "",
          node.pf3?.value ?? "", node.pf4?.value ?? "",
        ];

        if (!bullets.some((b) => b === oldPhrase)) { skipped++; return; }

        // Determine the effective replacement phrase for this product
        let effectiveNew = newPhrase;
        if (bullets.some((b) => b === newPhrase)) {
          // newPhrase already present — find an alternative from the library
          if (!pfLibrary) pfLibrary = await getPfLibrary();
          const productStyles = nodeStyle.split(",").map((s: string) => s.trim());
          // Exclude: old phrase, new phrase, and every bullet the product will keep
          const excluded = new Set(bullets.filter((b) => b !== oldPhrase && b !== ""));
          excluded.add(oldPhrase);
          const alt = pickAlternative(pfLibrary, nodeType, productStyles, excluded);
          if (!alt) { skipped++; return; } // no valid alternative — leave this product alone
          effectiveNew = alt;
        }

        try {
          const newBullets = bullets.map((b) => b === oldPhrase ? effectiveNew : b);
          await setProductMetafields(node.id, {
            perfectFor: {
              bullet1: newBullets[0], bullet2: newBullets[1],
              bullet3: newBullets[2], bullet4: newBullets[3],
            },
          });
          if (effectiveNew === newPhrase) swapped++; else alternated++;
          send({ type: "progress", id: node.id, title: node.title, status: "updated", originalBullets: bullets });
        } catch {
          failed++;
          send({ type: "progress", id: node.id, title: node.title, status: "error", originalBullets: bullets });
        }
      };

      if (retryIds && retryIds.length > 0) {
        const data = await shopifyGraphQL<NodesResult>(NODES_QUERY, { ids: retryIds });
        for (const node of data.nodes) {
          if (node) await process(node);
        }
      } else {
        let cursor: string | null = null;
        while (true) {
          const data: ScanResult = await shopifyGraphQL<ScanResult>(SCAN_QUERY, { first: 250, after: cursor });
          for (const { node } of data.products.edges) await process(node);
          if (!data.products.pageInfo.hasNextPage) break;
          cursor = data.products.edges[data.products.edges.length - 1]?.cursor ?? null;
        }
      }

      const updated = swapped + alternated;
      send({ type: "done", total: updated + skipped + failed, updated, swapped, alternated, skipped, failed });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
