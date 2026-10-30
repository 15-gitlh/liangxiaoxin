import { retrieve } from "./retrieve.js";
import { buildMessages } from "./prompt.js";
import { generateAnswer } from "./llm.js";

const NO_ANSWER =
  "我暂时没找到足够准确的答案。你可以换个说法再问一次，或者点“转人工”找辅导员/迎新老师确认。";

function toCitation(item) {
  return {
    id: item.entryId,
    chunkId: item.chunkId,
    title: item.title,
    category: item.category,
    source: item.source,
    sourceUrl: item.sourceUrl,
    sourcePage: item.sourcePage,
    updated: item.updated,
    score: Number(item.score.toFixed(4))
  };
}

function pickCitedCitations(answer, contexts) {
  const indexes = new Set();
  for (const match of String(answer).matchAll(/\[(\d+)\]/g)) {
    indexes.add(Number(match[1]) - 1);
  }

  const all = contexts.map(toCitation);
  if (!indexes.size) return all.slice(0, 3);

  return all.filter((_, index) => indexes.has(index));
}

export async function answerQuestion({ message, history = [] }) {
  const contexts = await retrieve(message);

  if (!contexts.length) {
    return {
      answer: NO_ANSWER,
      citations: [],
      confidence: 0,
      handoff: true
    };
  }

  const messages = buildMessages({
    question: message,
    history,
    contexts
  });

  const answer = await generateAnswer(messages);

  if (!answer) {
    return {
      answer: NO_ANSWER,
      citations: contexts.map(toCitation),
      confidence: 0,
      handoff: true
    };
  }

  const confidence = Number(contexts[0].score.toFixed(4));
  const handoffMin = Number(process.env.HANDOFF_MIN_CONFIDENCE || 0.45);

  const handoff = confidence < handoffMin;

  return {
    answer,
    citations: handoff ? [] : pickCitedCitations(answer, contexts),
    confidence,
    handoff
  };
}
