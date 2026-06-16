// Shared client-side reader for the SSE cascade routes (rename-style, rename-type,
// library/replace, library/push). Each route streams `{ type: "progress", id?, title,
// status, ...extra }` events followed by one `{ type: "done", failed, ...extra }` event.

export interface CascadeProgressEvent {
  type: "progress";
  id?: string;
  title: string;
  status: "updated" | "error";
  [key: string]: unknown;
}

interface CascadeDoneEvent {
  type: "done";
  failed: number;
  [key: string]: unknown;
}

type CascadeEvent = CascadeProgressEvent | CascadeDoneEvent | { type: "error"; message: string };

export async function runCascadeStream(
  endpoint: string,
  body: Record<string, unknown>,
  onProgress: (ev: CascadeProgressEvent) => void
): Promise<{ failed: number; receivedDone: boolean }> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) return { failed: 0, receivedDone: false };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedDone = false;
  let failed = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6)) as CascadeEvent;
          if (event.type === "progress") {
            onProgress(event);
          } else if (event.type === "done") {
            failed = event.failed;
            receivedDone = true;
          }
        } catch { /* ignore malformed line */ }
      }
      if (receivedDone) break;
    }
  } catch { /* network error */ }

  return { failed, receivedDone };
}
