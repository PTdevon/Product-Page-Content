const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const token = process.env.SHOPIFY_ACCESS_TOKEN!;
const API_VERSION = "2025-10";

async function doRequest(query: string, variables?: Record<string, unknown>): Promise<Response> {
  return fetch(
    `https://${domain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    }
  );
}

export async function shopifyGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  let res = await doRequest(query, variables);

  // Retry once on rate limit, honouring Retry-After header (cap at 5s)
  if (res.status === 429) {
    const retryAfter = Math.min(parseFloat(res.headers.get("Retry-After") ?? "1"), 5);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    res = await doRequest(query, variables);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const url = `https://${domain}/admin/api/${API_VERSION}/graphql.json`;
    throw new Error(`Shopify API error: ${res.status} ${res.statusText} (url: ${url})${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }

  const json = await res.json();

  // Only throw on fatal GraphQL errors (no data returned).
  // Shopify can return data + errors together for partial/field-level issues; those are non-fatal.
  if (json.errors && !json.data) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data as T;
}
