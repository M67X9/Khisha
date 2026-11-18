// Text-only OpenRouter call for answering questions from the person's own memories.
// Free models while testing (fake data only), premium after the bake-off (M5b), chosen by AI_PROFILE like the reader.
// Never logs the question, the memories or the answer.
export type AiProfile = "free" | "premium";

const PROFILES: Record<AiProfile, { models: string[]; privacy: boolean }> = {
  free: { models: ["google/gemma-4-31b-it:free", "nvidia/nemotron-3.5-super-vl:free", "inclusionai/ling-3.2-flash:free"], privacy: false },
  premium: { models: ["anthropic/claude-haiku-5.5", "google/gemini-3.8-flash"], privacy: true },
};

export class AiError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatJson(apiKey: string, profile: AiProfile, messages: ChatMessage[], deadline: number): Promise<unknown> {
  const remaining = deadline - Date.now();
  if (remaining < 8000) throw new AiError("timeout");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(60000, remaining - 2000));

  const config = PROFILES[profile];
  const body: Record<string, unknown> = { models: config.models, messages, response_format: { type: "json_object" }, temperature: 0.2, max_tokens: 1500 };
  if (config.privacy) body.provider = { data_collection: "deny", zdr: true };

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Khisha" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new AiError("timeout");
    throw new AiError("provider_error", "network");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) throw new AiError("ai_not_configured");
  if (res.status === 429) throw new AiError("provider_busy");
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload || payload.error) throw new AiError("provider_error");
  const content = payload.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p: { text?: string }) => p.text ?? "").join("") : "";
  if (!text.trim()) throw new AiError("empty");

  let s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AiError("invalid_output");
  try {
    s = s.slice(start, end + 1);
    return JSON.parse(s);
  } catch {
    throw new AiError("invalid_output");
  }
}

export function profileFromEnv(): AiProfile {
  return Deno.env.get("AI_PROFILE") === "premium" ? "premium" : "free";
}
