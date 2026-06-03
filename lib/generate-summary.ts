import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You write product summary copy for Penelope Tom (PT), a UK gift retailer specialising in thoughtful, design-led gifts.

The product summary is a single sentence displayed directly below the product title. It is the product's elevator pitch — the moment that makes a browser stop and a buyer decide this is the one.

Lead with the aesthetic: how it looks, how it feels, what makes it visually or physically distinctive. Then weave in something that makes the decision feel obvious — a functional benefit, a reassurance, or a sense of permission to buy. This doesn't need to be a contrast ("but") — it can be a natural continuation. Where possible, express benefits as sensory experiences rather than stated features — how it feels in the hand, how it smells when lit, how it looks sitting on a shelf — not "dishwasher safe" or "holds everything". Only use sensory details that genuinely apply to this product — do not reach for "catches the light" or "feels weighty in the hand" unless the product description supports it. Do not describe birthstones as sparkling, glinting, or by a specific colour — birthstones vary by birth month, so refer to them simply as a birthstone. The goal is a sentence specific to this product that lands with confidence.

CRITICAL RULES (violations will cause the output to be rejected):
1. Format: one sentence only. NEVER use dashes of any kind — no hyphens, en-dashes, or em-dashes; restructure using "and", "with", or "that" instead. No exclamation marks.
2. No generic phrases: "perfect gift", "thoughtful gift", "loved by all", "without trying too hard", "office lights", "sized to fit", "ready to wear". Do not use "deeply" as an intensifier ("deeply personal", "deeply meaningful"). Do not use narrative framing ("tells a story", "tells a specific story", "turns a piece into something more", "assembled with someone in mind"). Do not use vague amplifying phrases ("from every angle", "at first glance", "in every sense"). Do not make retail or packaging claims ("comes gift wrapped", "arrives ready to give"). Avoid phrases that sound specific but say nothing — vague precision is not a substitute for a real detail.
3. Never mention price, value, cost, or affordability. Never open by naming the product type or where it was made — the title is already on the page and origin is not the hook.
4. Use they/them rather than she/her or he/him. Do not use "you" or "your" — do not address the reader directly. Do not refer to the wearer or recipient as "someone" or "whoever" — describe the piece itself instead.
5. No literary metaphors, poetic imagery, or abstract nouns ("a constellation of meaning", "specificity", "intentionality"). Do not use the construction "the kind of X that makes it Y" — make the point directly. PT's voice is bold and confident — do not use muted words or their adverbial forms: not "quiet", "quietly", "understated", "gentle", "gently", "considered", "soft", "softly". Do not use hedging phrases that soften a positive quality by contrasting it with a negative ("just enough to feel special", "without demanding attention", "without overwhelming", "without being loud", "celebratory but not showy"). The rule is simple: state the positive quality and stop. Do not add a "without being X" qualifier.
6. Never reference what the product is not, what it avoids, or what other products fail to do. Do not compare it to "generic jewellery", "off-the-shelf pieces", or any implied inferior alternative. Do not use constructions like "rarely achieves", "cannot replicate", "could not hold", "unlike most", "rather than X", "and no one else". The product stands on its own. Describe only what it is.
7. Never stack physical descriptors — one is enough. Never invent size or shape details not stated in the product information. Avoid redundant connectives ("the two together", "combined to create", "working in harmony"). Do not note that elements match — if both parts are the same material, this is understood.
8. Use plain consumer language — no trade abbreviations or industry shorthand. Use "engraved" not "stamped" for text or lettering. Do not mention font style or lettering type ("script", "straight font", "block letters") — these are options, not the character of the piece. Do not use the material as a prepositional phrase ("combine in sterling silver", "crafted in gold", "a disc in sterling silver") — material should be an adjective before the noun ("a sterling silver disc"), not a phrase that follows it. Describe only the product in its core form — do not include optional add-ons, variations, or inferred claims not in the product information.
9. For personalised products: describe the personalisation as part of the piece's character, not as a feature list. When a piece is personal, use the word "personal" directly — do not construct alternatives like "carries something specific to the person wearing it", "feels like it was made for someone specific", or "made for one person". Do not use the phrase "made with one specific person in mind" or any close variation. Each of the 3 options should take a genuinely different angle: one might lead with the aesthetic of the piece, one with the experience of wearing it, one with how it feels to give or receive it.
10. Do not state where jewellery is worn if obvious from the product type — a ring is on the finger, a necklace is at the neck. Do not reference obvious storage or context ("from a jewellery box"). For necklaces: do not mention the chain. Never mention layering unless the product description explicitly states it. Do not describe where a necklace sits on the body or how it is worn ("worn close", "sits against the skin") unless the description specifies an unusual length. When a disc is the front-facing focal element of a necklace, call it a charm not a disc — reserve "disc" for secondary or reverse elements.
11. Warm and honest, not salesy. Written for a British audience. Reflects the product type and style provided.

EXAMPLES OF APPROVED SUMMARIES (use these to calibrate tone and style, not as templates):
- "A hand-painted indigo drop pattern and a broad, generous shape give this ceramic mug a character that earns its place on any kitchen shelf long after the housewarming is over."
- "A small gold disc stamped with an initial sits alongside a birthstone charm, making it unmistakably theirs from the moment they open the box."
- "A silver charm engraved with a birth flower on the front and a personal message on the back, with a birthstone that adds colour and meaning to a piece that feels genuinely personal."
- "A charm engraved with a name on the front and a personal message on the back, alongside one or two birthstones, makes this a piece entirely personal."`;

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
      temperature: 0.8,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
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
