import type { Metrics } from "./types";

const dcg = (relevances: number[]): number => {
  let sum = 0;
  for (let i = 0; i < relevances.length; i++) {
    sum += relevances[i] / Math.log2(i + 2);
  }
  return sum;
};

export const ndcgAtK = (
  retrieved: string[],
  relevant: Set<string>,
  k: number
): number => {
  if (relevant.size === 0) return 0;
  const topK = retrieved.slice(0, k);
  const gains = topK.map((id) => (relevant.has(id) ? 1 : 0));
  const idealGains = Array(Math.min(relevant.size, k)).fill(1);
  const idcg = dcg(idealGains);
  if (idcg === 0) return 0;
  return dcg(gains) / idcg;
};

const reciprocalRank = (
  retrieved: string[],
  relevant: Set<string>
): number => {
  for (let i = 0; i < retrieved.length; i++) {
    if (relevant.has(retrieved[i])) return 1 / (i + 1);
  }
  return 0;
};

export const firstRelevantRank = (
  retrieved: string[],
  relevant: Set<string>
): number | null => {
  for (let i = 0; i < retrieved.length; i++) {
    if (relevant.has(retrieved[i])) return i + 1;
  }
  return null;
};

const recallAtK = (
  retrieved: string[],
  relevant: Set<string>,
  k: number
): number => {
  if (relevant.size === 0) return 0;
  const topK = new Set(retrieved.slice(0, k));
  let hits = 0;
  for (const id of relevant) if (topK.has(id)) hits++;
  return hits / relevant.size;
};

const precisionAtK = (
  retrieved: string[],
  relevant: Set<string>,
  k: number
): number => {
  const topK = retrieved.slice(0, k);
  if (topK.length === 0) return 0;
  let hits = 0;
  for (const id of topK) if (relevant.has(id)) hits++;
  return hits / topK.length;
};

export const aggregate = (
  perQuery: Array<{
    retrieved: string[];
    relevant: Set<string>;
  }>
): Metrics => {
  if (perQuery.length === 0) {
    return { ndcg10: 0, mrr: 0, recall20: 0, precision10: 0 };
  }
  let ndcg = 0;
  let rr = 0;
  let r20 = 0;
  let p10 = 0;
  for (const { retrieved, relevant } of perQuery) {
    ndcg += ndcgAtK(retrieved, relevant, 10);
    rr += reciprocalRank(retrieved, relevant);
    r20 += recallAtK(retrieved, relevant, 20);
    p10 += precisionAtK(retrieved, relevant, 10);
  }
  const n = perQuery.length;
  return {
    ndcg10: ndcg / n,
    mrr: rr / n,
    recall20: r20 / n,
    precision10: p10 / n,
  };
};
