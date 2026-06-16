import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/auth";
import { getProductWithMetafields } from "@/lib/metafields";
import { getTaxonomy } from "@/lib/taxonomy-store";
import { isCreditsExhaustedError } from "@/lib/anthropic-errors";

function buildSystemPrompt(taxonomy: Record<string, string[]>): string {
  const lines = Object.entries(taxonomy)
    .map(([type, styles]) => `${type}: ${styles.join(", ")}`)
    .join("\n");
  return `You are a product taxonomy classifier for Penelope Tom (PT), a UK gift retailer.
Choose exactly one Type and 1–2 Styles from the taxonomy below.

TAXONOMY:
${lines}

RULES:
1. Type MUST be an exact string from the list above.
2. Styles MUST come from that Type's valid styles only.
3. Choose 1 Style (2 only if the product genuinely exhibits both).
4. Return ONLY valid JSON — no prose, no markdown.
5. Format: {"type": "...", "styles": ["..."]}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800);
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

function classifyAnthropicError(err: unknown): { message: string; errorType?: "credits_exhausted" } {
  if (isCreditsExhaustedError(err)) {
    return { message: "Your Anthropic account has run out of credits.", errorType: "credits_exhausted" };
  }
  return { message: err instanceof Error ? err.message : "Classification failed" };
}

async function classifyProduct(
  client: Anthropic,
  gid: string,
  taxonomy: Record<string, string[]>,
  systemPrompt: string
): Promise<{
  title: string;
  imageUrl: string | null;
  existingType: string;
  existingStyle: string;
  suggestedType: string;
  suggestedStyles: string[];
  error?: string;
  errorType?: "credits_exhausted";
}> {
  const { product, metafields } = await getProductWithMetafields(gid);
  const imageUrl = product.featuredImage?.url ?? null;
  const description = stripHtml(product.descriptionHtml);

  const userMessage = `Product title: ${product.title}
Product description: ${description || "(no description available)"}

Classify this product.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const parsed = JSON.parse(extractJsonObject(text) ?? text) as { type?: string; styles?: string[] };

    const rawType = typeof parsed.type === "string" ? parsed.type : "";
    const rawStyles = Array.isArray(parsed.styles) ? parsed.styles.filter((s) => typeof s === "string") : [];

    const validType = rawType in taxonomy ? rawType : "";
    const validStyles = validType
      ? rawStyles.filter((s) => (taxonomy[validType] ?? []).includes(s))
      : [];

    return {
      title: product.title,
      imageUrl,
      existingType: metafields.productTypePt,
      existingStyle: metafields.productStylePt,
      suggestedType: validType,
      suggestedStyles: validStyles,
    };
  } catch (err) {
    const { message, errorType } = classifyAnthropicError(err);
    return {
      title: product.title,
      imageUrl,
      existingType: metafields.productTypePt,
      existingStyle: metafields.productStylePt,
      suggestedType: "",
      suggestedStyles: [],
      error: message,
      ...(errorType && { errorType }),
    };
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { productIds } = await req.json() as { productIds: string[] };

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return new Response(JSON.stringify({ error: "No products selected" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (data: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        for (const productId of productIds) {
          send({ type: "result", productId, title: productId, suggestedType: "", suggestedStyles: [],
            existingType: "", existingStyle: "", error: "ANTHROPIC_API_KEY is not configured" });
        }
        send({ type: "done", total: productIds.length, succeeded: 0, failed: productIds.length });
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const taxonomy = await getTaxonomy();
  const systemPrompt = buildSystemPrompt(taxonomy);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      let succeeded = 0;
      let failed = 0;
      let creditsExhausted = false;

      for (const productId of productIds) {
        try {
          const result = await classifyProduct(client, productId, taxonomy, systemPrompt);
          if (result.error) {
            failed++;
          } else {
            succeeded++;
          }
          send({ type: "result", productId, ...result });
          if (result.errorType === "credits_exhausted") {
            creditsExhausted = true;
            failed += productIds.length - (succeeded + failed);
            break;
          }
        } catch (err) {
          failed++;
          const { message, errorType } = classifyAnthropicError(err);
          send({ type: "result", productId, title: productId, imageUrl: null, suggestedType: "", suggestedStyles: [],
            existingType: "", existingStyle: "", error: message, ...(errorType && { errorType }) });
          if (errorType === "credits_exhausted") {
            creditsExhausted = true;
            failed += productIds.length - (succeeded + failed);
            break;
          }
        }
      }

      send({ type: "done", total: productIds.length, succeeded, failed, ...(creditsExhausted && { creditsExhausted }) });
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
