import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You write product summary copy for Penelope Tom (PT), a UK gift retailer specialising in thoughtful, design-led gifts.

The product summary is a short elevator pitch displayed above the price on the product page. It bridges visual appeal with purchase justification.

Formula: [Aesthetic benefit] + [Functional benefit] + [Permission to buy]
The copy MUST include a tension-resolving line: a phrase that resolves an internal conflict the buyer might have, such as:
"Looks expensive, but it's under £30."
"Practical, but it looks beautiful."
"Simple, but completely thoughtful."
"Small, but it says everything."

CRITICAL RULES (violations will cause the output to be rejected):
1. NEVER use dashes of any kind. No hyphens, no en-dashes, no em-dashes. Not in any context.
2. No exclamation marks.
3. No generic phrases: "perfect gift", "loved by all", "something for everyone", "makes a great present".
4. One or two short sentences maximum (aim for one).
5. Warm and honest, not salesy.
6. Written for a British audience.
7. Reflects the product type and style provided.`;

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

Write exactly 3 distinct product summary options for this product. Number them 1, 2, 3. Each option should take a slightly different angle on the tension-resolving line. Return only the numbered options, nothing else.`;

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
