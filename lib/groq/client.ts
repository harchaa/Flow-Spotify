import { z } from "zod";
import { env, isGroqConfigured } from "@/lib/env";
import { ApiError, FRIENDLY, toApiError } from "@/lib/errors";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_MODEL = "llama-3.3-70b-versatile";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function callGroq(messages: ChatMessage[], temperature: number): Promise<string> {
  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    throw toApiError(err, FRIENDLY.groqDown);
  }
  if (!res.ok) throw new ApiError(FRIENDLY.groqDown);

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new ApiError(FRIENDLY.groqUnreadable);
  return content;
}

/**
 * Structured LLM call: JSON mode + zod validation, with one automatic retry
 * that feeds the validation error back to the model. Never returns free-form
 * text; throws a friendly ApiError if both attempts fail.
 */
export async function groqJson<T>(
  schema: z.ZodType<T>,
  messages: ChatMessage[],
  temperature = 0.7,
): Promise<T> {
  if (!isGroqConfigured) throw new ApiError(FRIENDLY.notConfigured, 503);

  let raw = await callGroq(messages, temperature);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      if (attempt === 1) break;
      raw = await callGroq(
        [
          ...messages,
          { role: "assistant", content: raw },
          {
            role: "user",
            content: `Your previous response did not match the required JSON shape (${parsed.error.issues[0]?.message ?? "invalid"}). Respond again with ONLY valid JSON in the required shape.`,
          },
        ],
        temperature,
      );
    } catch {
      if (attempt === 1) break;
      raw = await callGroq(
        [
          ...messages,
          { role: "assistant", content: raw },
          {
            role: "user",
            content: "Your previous response was not valid JSON. Respond again with ONLY valid JSON in the required shape.",
          },
        ],
        temperature,
      );
    }
  }
  throw new ApiError(FRIENDLY.groqUnreadable);
}
