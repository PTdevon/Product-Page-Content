/** Parse all SSE data events from a streaming Response into an array of objects. */
export async function collectSSE(response: Response): Promise<unknown[]> {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
}

/** Build a NextRequest-compatible Request for API route handlers. */
export function makeRequest(
  url: string,
  init: RequestInit & { searchParams?: Record<string, string> } = {}
): Request {
  const { searchParams, ...rest } = init;
  const u = new URL(url, "http://localhost");
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) u.searchParams.set(k, v);
  }
  return new Request(u.toString(), rest);
}
