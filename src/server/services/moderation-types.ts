export const CONTENT_POLICY_VERSION = "1.0";

export type ContentReviewIssue = {
  excerpt: string;
  start: number;
  end: number;
  category: string;
  rule_reference: string;
  explanation: string;
};
