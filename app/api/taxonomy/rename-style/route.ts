import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { shopifyGraphQL } from "@/lib/shopify";
import { setProductMetafields } from "@/lib/metafields";
import { renameStyleInLibrary } from "@/lib/library-edits-store";

const QUERY = `
  query($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          productTypePt:  metafield(namespace: "product", key: "product_type")  { value }
          productStylePt: metafield(namespace: "product", key: "product_style") { value }
        }
        cursor
      }
      pageInfo { hasNextPage }
    }
  }
`;

type MF = { value: string } | null;
type Row = { id: string; title: string; productTypePt: MF; productStylePt: MF };
type Result = { products: { edges: { node: Row; cursor: string }[]; pageInfo: { hasNextPage: boolean } } };

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { type, oldStyle, newStyle } = await req.json() as { type: string; oldStyle: string; newStyle: string };
  if (!oldStyle || !newStyle) {
    return new Response(JSON.stringify({ error: "oldStyle and newStyle are required" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Collect affected products
      const targets: { id: string; title: string; currentStyle: string }[] = [];
      let cursor: string | null = null;
      let hasMore = true;

      try {
        while (hasMore) {
          const data: Result = await shopifyGraphQL<Result>(QUERY, { first: 250, after: cursor });
          for (const { node } of data.products.edges) {
            const nodeType = node.productTypePt?.value ?? "";
            const nodeStyle = node.productStylePt?.value ?? "";
            if (type && nodeType !== type) continue;
            const styles = nodeStyle.split(",").map((s) => s.trim());
            if (!styles.includes(oldStyle)) continue;
            targets.push({ id: node.id, title: node.title, currentStyle: nodeStyle });
          }
          hasMore = data.products.pageInfo.hasNextPage;
          if (hasMore && data.products.edges.length > 0) {
            cursor = data.products.edges[data.products.edges.length - 1].cursor;
          }
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
        controller.close();
        return;
      }

      // Update library entries first
      try {
        const { wctUpdated, pfUpdated } = await renameStyleInLibrary(type, oldStyle, newStyle);
        if (wctUpdated > 0 || pfUpdated > 0) {
          const parts = [];
          if (wctUpdated > 0) parts.push(`${wctUpdated} Why Choose This`);
          if (pfUpdated > 0) parts.push(`${pfUpdated} Perfect For`);
          send({ type: "progress", title: `Library updated (${parts.join(", ")})`, status: "updated" });
        }
      } catch {
        send({ type: "progress", title: "Library update failed", status: "error" });
      }

      let updated = 0;
      let failed = 0;

      for (const { id, title, currentStyle } of targets) {
        try {
          const newStyleValue = currentStyle
            .split(",")
            .map((s) => s.trim())
            .map((s) => (s === oldStyle ? newStyle : s))
            .join(",");
          await setProductMetafields(id, { productStylePt: newStyleValue });
          updated++;
          send({ type: "progress", title, status: "updated" });
        } catch {
          failed++;
          send({ type: "progress", title, status: "error" });
        }
      }

      send({ type: "done", updated, skipped: 0, failed });
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
