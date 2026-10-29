import OpenAI from "openai";
import { assertVectorDim } from "./vector.js";

let client = null;

function getClient() {
  if (!process.env.EMBEDDING_API_KEY) {
    throw new Error("EMBEDDING_NOT_CONFIGURED");
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.EMBEDDING_API_KEY,
      baseURL:
        process.env.EMBEDDING_BASE_URL ||
        "https://dashscope.aliyuncs.com/compatible-mode/v1"
    });
  }

  return client;
}

function dim() {
  return Number(process.env.EMBEDDING_DIM || 1024);
}

export async function embedQuery(text) {
  const input = String(text || "").trim();
  if (!input) throw new Error("EMBEDDING_EMPTY_INPUT");

  const payload = {
    model: process.env.EMBEDDING_MODEL || "qwen3.7-text-embedding",
    input
  };

  if (process.env.EMBEDDING_SEND_DIMENSIONS !== "false") {
    payload.dimensions = dim();
  }

  const result = await getClient().embeddings.create(payload);
  const vector = result.data?.[0]?.embedding;

  return assertVectorDim(vector, dim(), "query embedding");
}
