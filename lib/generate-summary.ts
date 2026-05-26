import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You write product summary copy for Penelope Tom (PT), a UK gift retailer specialising in thoughtful, design-led gifts.

The product summary is a single sentence displayed directly below the product title. It is the product's elevator pitch — the moment that makes a browser stop and a buyer decide this is the one.

Lead with the aesthetic: how it looks, how it feels, what makes it visually or physically distinctive. Then weave in something that makes the decision feel obvious — a functional benefit, a reassurance, or a sense of permission to buy. This doesn't need to be a contrast ("but") — it can be a natural continuation. Where possible, express benefits as sensory experiences rather than stated features — how it feels in the hand, how it smells when lit, how it looks sitting on a shelf — not "dishwasher safe" or "holds everything". The goal is a sentence specific to this product that lands with confidence.

CRITICAL RULES (violations will cause the output to be rejected):
1. NEVER use dashes of any kind. No hyphens, no en-dashes, no em-dashes. Not in any context. If you want to use a dash, restructure the sentence using "and", "with", or "that" instead.
2. No exclamation marks.
3. No generic phrases: "perfect gift", "loved by all", "something for everyone", "makes a great present", "thoughtful gift", "chosen rather than bought", "belongs to nobody else", "exactly the right colour". More broadly: avoid phrases that sound specific but say nothing — vague precision is not a substitute for a real detail.
4. NEVER mention price, value, cost, or affordability in any form.
5. One sentence only.
6. Never open by naming the product type or where it was made — the title is already on the page and origin is not the hook.
7. Use they/them rather than she/her or he/him. Do not use "you" or "your" — do not address the reader directly. Do not refer to the wearer or recipient as "someone" or "whoever" — describe the piece itself instead.
8. No literary metaphors, poetic imagery, or abstract nouns ("a constellation of meaning"). Write with warmth and personality, but grounded in the product itself. PT's voice is bold and confident — do not use words like "quiet", "understated", or "considered" as these are too muted.
9. Never stack physical descriptors. One is enough — not "wide, squat ceramic" but "wide ceramic" or just let the shape come through in context. Never invent size or shape descriptors not stated in the product information.
10. Only describe the product in its core form. Even if the product description mentions optional add-ons or variations (such as birthstones, additional engravings, or colour choices), do not include them in the summary. Do not infer or add claims not in the product information provided.
11. For personalised products: describe the personalisation as part of the piece's character, not as a feature list. It is fine to mention what makes it personal (an initial, a date, a stone) but express it as a quality of the object, not an enumeration of options. Do not use the phrase "made with one specific person in mind" or any close variation. Each of the 3 options should take a genuinely different angle: one might lead with the aesthetic of the piece, one with the experience of wearing it, one with how it feels to give or receive it.
12. For necklaces: do not mention the chain at all. Describe the pendant, charm, stone, or personalisation element. Never mention layering unless the product description explicitly states it. Do not describe where a necklace sits on the body (e.g. "at the collarbone", "close to the neckline") unless the product description specifies an unusual length — all necklaces sit at the neck.
13. Warm and honest, not salesy.
14. Written for a British audience.
15. Reflects the product type and style provided.`;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000);
}

export interface GenerationError {
  type: "credits_exhausted" | "invalid_key" | "rate_limited" | "unknown";
  message: string;
  billingUrl?: string;
}

export async function generateProductSummary(product: {
  title: string;
  descriptionHtml: string;
  productType: string;
  productStyle: string;
}): Promise<{ options: string[] } | { error: GenerationError }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      error: {
        type: "invalid_key",
        message: "Anthropic API key is not configured. Add ANTHROPIC_API_KEY to your environment settings.",
      },
    };
  }

  const descriptionText = stripHtml(product.descriptionHtml);

  const userMessage = `Product title: ${product.title}
Product type: ${product.productType}
Product style: ${product.productStyle}
Product description: ${descriptionText || "(no description available)"}

Write exactly 3 distinct product summary options for this product. Number them 1, 2, 3. Each option must take a genuinely different angle — vary the emotional territory, not just the wording. Return only the numbered options, nothing else.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    const options = text
      .split(/\n+/)
      .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim())
      .filter((line) => line.length > 10);

    return { options: options.slice(0, 3) };
  } catch (err: unknown) {
    const e = err as { status?: number; error?: { type?: string }; code?: string; message?: string };
    const status = e?.status;
    const errorType = e?.error?.type;
    const isNetworkError = e?.code === "ECONNREFUSED" || e?.code === "ENOTFOUND" || e?.code === "ETIMEDOUT" || e?.message?.includes("fetch");

    if (isNetworkError) {
      return {
        error: { type: "unknown", message: "Unable to connect to Anthropic. Check your internet connection and try again." },
      };
    }
    if (status === 402 || errorType === "credit_balance_too_low") {
      return {
        error: {
          type: "credits_exhausted",
          message: "Your Anthropic account has run out of credits.",
          billingUrl: "https://console.anthropic.com",
        },
      };
    }
    if (status === 401) {
      return {
        error: { type: "invalid_key", message: "Anthropic API key is invalid. Check your environment settings." },
      };
    }
    if (status === 429) {
      return {
        error: { type: "rate_limited", message: "Anthropic rate limit reached — please wait a moment and try again." },
      };
    }
    if (status && status >= 500) {
      return {
        error: { type: "unknown", message: "Anthropic is experiencing an issue. Please try again in a moment." },
      };
    }
    return {
      error: { type: "unknown", message: "Unable to generate options. Please try again or write the summary manually." },
    };
  }
}
