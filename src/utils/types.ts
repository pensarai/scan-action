import z from "zod";

export const FalsePositiveAnalysisObject = z.object({
  falsePositive: z.boolean(),
  confidence: z.number(),
  summaryExplanation: z.string(),
});

export const IssueInfoObject = z.object({
  id: z.string(),
  issueLabel: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  falsePositive: FalsePositiveAnalysisObject.nullable().optional(),
});

export const IssuesResponseObject = z.object({
  count: z.number(),
  issues: IssueInfoObject.array(),
});

export const DispatchScanRequestObject = z.object({
  apiKey: z.string(),
  repoId: z.number(),
  eventType: z.enum(["pull-request", "commit"]),
  actionRunId: z.number(),
  pullRequest: z.string().nullable().optional(),
  targetBranch: z.string(),
});

export const GetScanStatusRequestObject = z.object({
  apiKey: z.string(),
  repoId: z.number(),
  actionRunId: z.number(),
});

export const ScanStatusResponseObject = z.object({
  id: z.string(),
  status: z.enum(["scanning", "triaging", "done", "generating patches"]),
  errorMessage: z.string().nullable(),
});

export const GetScanIssuesRequestObject = z.object({
  apiKey: z.string(),
  scanId: z.string(),
});

export type FalsePositiveAnalysis = z.infer<typeof FalsePositiveAnalysisObject>;
export type IssueInfo = z.infer<typeof IssueInfoObject>;
export type IssuesResponse = z.infer<typeof IssuesResponseObject>;
export type DispatchScanRequest = z.infer<typeof DispatchScanRequestObject>;
export type GetScanStatusRequest = z.infer<typeof GetScanStatusRequestObject>;
export type ScanStatusResponse = z.infer<typeof ScanStatusResponseObject>;
export type GetScanIssueRequest = z.infer<typeof GetScanIssuesRequestObject>;
