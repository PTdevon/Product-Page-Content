import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { shopifyGraphQL } from "@/lib/shopify";
import { setProductMetafields } from "@/lib/metafields";
import { getLibraryEdits, markWCTPushed, markPFPushed } from "@/lib/library-edits-store";

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
  if (!entry) {
    return new Response(JSON.stringify({ error: "Entry not found" }), { status: 404 });
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

      if (type === "wct") {
        const wctEntry = edits.wct[id];
        const oldFormatted = wctEntry.searchFormatted;
        const newFormatted = formatWCT(wctEntry.text, wctEntry.subtext);

        if (!oldFormatted) {
          send({ type: "done", total: 0, updated: 0, skipped: 0, failed: 0 });
          controller.close();
          return;
        }

        while (true) {
          const data: ScanResult = await shopifyGraphQL<ScanResult>(SCAN_QUERY, { first: 250, after: cursor });

          for (const { node } of data.products.edges) {
            const productType = node.typePt?.value ?? "";
            const productStyle = node.stylePt?.value ?? "";

            // Only check products of matching type/style
            if (productType !== wctEntry.productType || !productStyle.split(",").map((s: string) => s.trim()).includes(wctEntry.productStyle)) {
              skipped++;
              continue;
            }

            const bullets = [
              node.wct1?.value ?? "", node.wct2?.value ?? "",
              node.wct3?.value ?? "", node.wct4?.value ?? "",
            ];

            const hasMatch = bullets.some((b) => b === oldFormatted);
            if (!hasMatch) { skipped++; continue; }

            try {
              const newBullets = bullets.map((b) => b === oldFormatted ? newFormatted : b);
              await setProductMetafields(node.id, {
                whyChooseThis: {
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

        if (updated > 0) await markWCTPushed(id, newFormatted);

      } else {
        const pfEntry = edits.pf[id];
        const oldPhrase = pfEntry.searchPhrase;
        const newPhrase = pfEntry.phrase;

        if (!oldPhrase) {
          send({ type: "done", total: 0, updated: 0, skipped: 0, failed: 0 });
          controller.close();
          return;
        }

        while (true) {
          const data: ScanResult = await shopifyGraphQL<ScanResult>(SCAN_QUERY, { first: 250, after: cursor });

          for (const { node } of data.products.edges) {
            const bullets = [
              node.pf1?.value ?? "", node.pf2?.value ?? "",
              node.pf3?.value ?? "", node.pf4?.value ?? "",
            ];

            const hasMatch = bullets.some((b) => b === oldPhrase);
            if (!hasMatch) { skipped++; continue; }

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

        if (updated > 0) await markPFPushed(id, newPhrase);
      }

      const total = updated + skipped + failed;
      send({ type: "done", total, updated, skipped, failed });
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
