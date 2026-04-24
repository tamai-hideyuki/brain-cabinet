export type GoldenEntry = {
  query: string;
  relevant: string[];
  notes?: string;
}

export type Metrics = {
  ndcg10: number;
  mrr: number;
  recall20: number;
  precision10: number;
}

export type PerQueryResult = {
  query: string;
  relevant: string[];
  retrieved: string[];
  firstRelevantRank: number | null;
  ndcg10: number;
}

export type ModeReport = {
  mode: "keyword" | "semantic" | "hybrid";
  metrics: Metrics;
  perQuery: PerQueryResult[];
  failedQueries: string[];
}

export type SearchMode = ModeReport["mode"];
