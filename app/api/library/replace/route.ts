import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { shopifyGraphQL } from "@/lib/shopify";
import { setProductMetafields } from "@/lib/metafields";

// Replaces oldPhrase with newPhrase in product Perfect For bullets.
// If productType/productStyle are provided, only updates products matching that type/style.
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

type MF = { value: string } | null;
type ScanNode = {
  id: string; title: string;
  typePt: MF; stylePt: MF;
  pf1: MF; pf2: MF; pf3: MF; pf4: MF;
};
type ScanResult = {
  products: { edges: { node: ScanNode; cursor: string }[]; pageInfo: { hasNextPage: boolean } };
};

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { oldPhrase, newPhrase, productType, productStyle } = await req.json() as {
    oldPhrase: string;
    newPhrase: string;
    productType?: string;
    productStyle?: string;
  };

  if (!oldPhrase || !newPhrase) {
    return new Response(JSON.stringify({ error: "oldPhrase and newPhrase required" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      let updated = 0;
      let skipped = 0;
      let failed = 0;
      let cursor: string | null = null;

      while (true) {
        const data: ScanResult = await shopifyGraphQL<ScanResult>(SCAN_QUERY, { first: 250, after: cursor });

        for (const { node } of data.products.edges) {
          const nodeType = node.typePt?.value ?? "";
          const nodeStyle = node.stylePt?.value ?? "";

          // Apply type/style filter if specified
          if (productType && nodeType !== productType) { skipped++; continue; }
          if (productStyle && productStyle !== "ALL") {
            const styles = nodeStyle.split(",").map((s: string) => s.trim());
            if (!styles.includes(productStyle)) { skipped++; continue; }
          }

          const bullets = [
            node.pf1?.value ?? "", node.pf2?.value ?? "",
            node.pf3?.value ?? "", node.pf4?.value ?? "",
          ];

          if (!bullets.some((b) => b === oldPhrase)) { skipped++; continue; }

          try {
            const newBullets = bullets.map((b) => b === oldPhrase ? newPhrase : b);
            await setProductMetafields(node.id, {
              perfectFor: {
                bullet1: newBullets[0], bullet2: newBullets[1],
                bullet3: newBullets[2], bullet4: newBullets[3],
              },
            });
            updated++;
            send({ type: "progress", title: node.title, status: "updated" });
          } catch {
            failed++;
            send({ type: "progress", title: node.title, status: "error" });
          }
        }

        if (!data.products.pageInfo.hasNextPage) break;
        cursor = data.products.edges[data.products.edges.length - 1]?.cursor ?? null;
      }

      send({ type: "done", total: updated + skipped + failed, updated, skipped, failed });
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
