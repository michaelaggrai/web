// Short conversation IDs for the /app/c/{id} URL pattern.
//
// V1: sessionStorage-backed — IDs only resolve in the same browser session
// that created them. Sharing a URL with someone else just shows them the
// empty input box.
//
// V2 (AGG-44): same URL shape, but Supabase-backed for signed-in users so
// conversations work cross-device + cross-browser, and a separate Share
// button generates a public /share/{share-id} snapshot.

const KEY_PREFIX = "aggrai-conv-";

// 8 chars × 62 alphabet = ~218 trillion ids — vastly more than we need
// for a per-session collision-free pool. Crypto-grade random for safety.
export function generateConvId(): string {
  const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export interface ConvPayload {
  question: string;
  models: string[];
}

export function storeConv(id: string, payload: ConvPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY_PREFIX + id, JSON.stringify(payload));
  } catch {
    // sessionStorage full / disabled — silently no-op. The URL will still
    // navigate; /app/c/{id} just falls through to the empty state.
  }
}

export function loadConv(id: string): ConvPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.question === "string" &&
      Array.isArray(parsed?.models) &&
      parsed.models.every((m: unknown) => typeof m === "string")
    ) {
      return { question: parsed.question, models: parsed.models };
    }
    return null;
  } catch {
    return null;
  }
}
