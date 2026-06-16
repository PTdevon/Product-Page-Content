// Anthropic returns credit exhaustion as a 400 invalid_request_error with a
// "credit balance is too low" message, not a dedicated status/type — so this
// checks the message text rather than relying on a stable error code.
export function isCreditsExhaustedError(err: unknown): boolean {
  const e = err as { status?: number; error?: { type?: string }; message?: string };
  if (e?.status === 402 || e?.error?.type === "credit_balance_too_low") return true;
  return /credit balance is too low/i.test(e?.message ?? "");
}
