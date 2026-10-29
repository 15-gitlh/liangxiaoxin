import OpenAI from "openai";

let client = null;

export function isLlmConfigured() {
  return Boolean(process.env.LLM_API_KEY);
}

function getClient() {
  if (!isLlmConfigured()) {
    throw new Error("LLM_NOT_CONFIGURED");
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
      baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com/v1"
    });
  }

  return client;
}

export async function generateAnswer(messages, options = {}) {
  const result = await getClient().chat.completions.create({
    model: process.env.LLM_MODEL || "deepseek-chat",
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 900,
    stream: false
  });

  const content = result.choices?.[0]?.message?.content;
  return String(content || "").trim();
}
