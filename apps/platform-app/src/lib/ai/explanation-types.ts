export type ExplainLineInput = {
  code: string;
  description: string;
  amountCents: number;
};

/** Where the narrative came from — extend as new adapters ship. */
export type BillExplainSource = "openai" | "azure_openai" | "template";

export type ExplainLineResult = {
  text: string;
  source: BillExplainSource;
};

export type BillLineExplanationProvider = {
  explain(input: ExplainLineInput): Promise<ExplainLineResult>;
};
