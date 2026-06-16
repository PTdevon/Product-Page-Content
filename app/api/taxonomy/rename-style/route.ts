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

const NODES_QUERY = `
  query($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        title
        productTypePt:  metafield(namespace: "product", key: "product_type")  { value }
        productStylePt: metafield(namespace: "product", key: "product_style") { value }
      }
    }
  }
`;

type MF = { value: string } | null;
type Row = { id: string; title: string; productTypePt: MF; productStylePt: MF };
type Result = { products: { edges: { node: Row; cursor: string }[]; pageInfo: { hasNextPage: boolean } } };
type NodesResult = { nodes: (Row | null)[] };

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { type, oldStyle, newStyle, retryIds, skipLibrary, onlyLibrary } = await req.json() as {
    type: string;
    oldStyle: string;
    newStyle: string;
    retryIds?: string[];
    skipLibrary?: boolean;
    onlyLibrary?: boolean;
  };
  if (!oldStyle || !newStyle) {
    return new Response(JSON.stringify({ error: "oldStyle and newStyle are required" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Retry-only mode: re-run just the library cascade (used when the product
      // update already succeeded but the library write failed and was retried later).
      if (onlyLibrary) {
        try {
          const { wctUpdated, pfUpdated } = await renameStyleInLibrary(type, oldStyle, newStyle);
          const parts = [];
          if (wctUpdated > 0) parts.push(`${wctUpdated} Why Choose This`);
          if (pfUpdated > 0) parts.push(`${pfUpdated} Perfect For`);
          send({ type: "progress", title: parts.length ? `Library updated (${parts.join(", ")})` : "Library update (nothing to change)", status: "updated" });
          send({ type: "done", updated: 0, skipped: 0, failed: 0, libraryFailed: false });
        } catch (err) {
          send({ type: "progress", title: "Library update failed", status: "error" });
          send({ type: "done", updated: 0, skipped: 0, failed: 0, libraryFailed: true, libraryError: err instanceof Error ? err.message : "Unknown error" });
        }
        controller.close();
        return;
      }

      // Collect affected products
      const targets: { id: string; title: string; currentStyle: string }[] = [];

      try {
        if (retryIds && retryIds.length > 0) {
          const data = await shopifyGraphQL<NodesResult>(NODES_QUERY, { ids: retryIds });
          for (const node of data.nodes) {
            if (!node) continue;
            targets.push({ id: node.id, title: node.title, currentStyle: node.productStylePt?.value ?? "" });
          }
        } else {
          let cursor: string | null = null;
          let hasMore = true;
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
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
        controller.close();
        return;
      }

      // Update library entries first — retry a couple of times before giving up, since
      // this write can lose a race with another concurrent edit to the same metaobject.
      let libraryFailed = false;
      if (!skipLibrary) {
        const MAX_ATTEMPTS = 3;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            const { wctUpdated, pfUpdated } = await renameStyleInLibrary(type, oldStyle, newStyle);
            if (wctUpdated > 0 || pfUpdated > 0) {
              const parts = [];
              if (wctUpdated > 0) parts.push(`${wctUpdated} Why Choose This`);
              if (pfUpdated > 0) parts.push(`${pfUpdated} Perfect For`);
              send({ type: "progress", title: `Library updated (${parts.join(", ")})`, status: "updated" });
            }
            libraryFailed = false;
            break;
          } catch {
            libraryFailed = true;
            if (attempt < MAX_ATTEMPTS) continue;
            send({ type: "progress", title: "Library update failed", status: "error" });
          }
        }
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
          send({ type: "progress", id, title, status: "updated" });
        } catch {
          failed++;
          send({ type: "progress", id, title, status: "error" });
        }
      }

      send({ type: "done", updated, skipped: 0, failed, libraryFailed });
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
