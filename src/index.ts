// src/index.ts
import * as core from "@actions/core";
import * as github from "@actions/github";
import fetch from "node-fetch";
import { z } from "zod";

export const FalsePositiveAnalysisObject = z.object({
  falsePositive: z.boolean(),
  confidence: z.number(),
  summaryExplanation: z.string(),
});

export const IssueInfo = z.object({
  id: z.string(),
  issueLabel: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  falsePositive: FalsePositiveAnalysisObject.nullable().optional(),
});

export const IssuesResponse = z.object({
  count: z.number(),
  issues: IssueInfo.array(),
});

const DispatchScanRequest = z.object({
  apiKey: z.string(),
  repoId: z.number(),
  eventType: z.enum(["pull-request", "commit"]),
  actionRunId: z.number(),
  pullRequest: z.string().nullable().optional(),
  targetBranch: z.string(),
});

const GetScanStatusRequest = z.object({
  apiKey: z.string(),
  repoId: z.number(),
  actionRunId: z.number(),
});

const ScanStatusResponse = z.object({
  id: z.string(),
  status: z.enum(["scanning", "triaging", "done", "generating patches"]),
  errorMessage: z.string().nullable(),
});

const GetScanIssuesRequest = z.object({
  apiKey: z.string(),
  scanId: z.string(),
});

async function run() {
  try {
    const apiKey = core.getInput("api-key", { required: true });
    const environment = core.getInput("environment", { required: false });
    let apiUrl =
      environment && environment === "dev"
        ? "https://josh-pensar-api.pensar-ai.com"
        : environment === "staging"
        ? "https://staging-api.pensar.dev"
        : "https://pensar-api.pensar.dev";
    if (environment && environment === "dev") {
      core.info("Running in dev mode, using " + apiUrl);
    }
    // Queue the scan
    const repoId = github.context.payload.repository?.id;
    const runId = github.context.runId;
    const eventName = github.context.eventName;
    const prUrl = github.context.payload.pull_request?.html_url ?? null;
    const targetBranch =
      eventName === "pull_request"
        ? github.context.payload.pull_request?.head.ref
        : github.context.ref.replace("refs/heads/", "");
    const eventType =
      eventName === "pull_request"
        ? "pull-request"
        : eventName === "push"
        ? "commit"
        : (() => {
            throw new Error(`Unsupported event type: ${eventName}`);
          })();
    core.info("Queueing scan...");
    const queueRequest: z.infer<typeof DispatchScanRequest> = {
      apiKey: apiKey,
      repoId: repoId,
      actionRunId: runId,
      eventType: eventType,
      pullRequest: prUrl,
      targetBranch: targetBranch,
    };
    const queueResponse = await fetch(`${apiUrl}/scans/github/dispatch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(queueRequest),
    });

    if (!queueResponse.ok) {
      const result = await queueResponse.json();
      throw new Error(`Failed to queue scan: ${result.message}`);
    }
    core.info(`Scan queued...`);

    // // Poll for completion
    const statusRequest: z.infer<typeof GetScanStatusRequest> = {
      apiKey: apiKey,
      repoId: repoId,
      actionRunId: runId,
    };

    // try for 1 hour
    const maxAttempts = 1200;
    for (let i = 0; i < maxAttempts; i++) {
      const statusResponse = await fetch(`${apiUrl}/scans/github/status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(statusRequest),
      });
      if (statusResponse.status === 404) {
        core.info("Scan not found yet, waiting...");
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new Error(
          `Failed to check scan status: ${statusResponse.status} ${errorText}`
        );
      }

      const responseData = await statusResponse.json();
      const { id, status, errorMessage } =
        ScanStatusResponse.parse(responseData);

      core.info(`Current scan status: ${status}`);
      if (status === "done" && errorMessage) {
        core.setFailed(`Error occurred during scan: ${errorMessage}`);
        return;
      }
      if (status === "done") {
        const issuesRequest: z.infer<typeof GetScanIssuesRequest> = {
          apiKey: apiKey,
          scanId: id,
        };
        const issuesResponse = await fetch(`${apiUrl}/scans/github/issues`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(issuesRequest),
        });
        if (!issuesResponse.ok) {
          throw new Error(`Failed to get scan issues ${issuesResponse.text()}`);
        }
        const { issues } = IssuesResponse.parse(await issuesResponse.json());

        const realIssues = issues.filter(
          (issue) => !issue.falsePositive || !issue.falsePositive.falsePositive
        );
        const falsePositiveCount = issues.length - realIssues.length;

        if (realIssues.length > 0) {
          core.setFailed(
            `Scan completed successfully. ${realIssues.length} issues found (${falsePositiveCount} false positives).`
          );
          return;
        }
        if (falsePositiveCount > 0) {
          core.info(
            `Scan completed successfully. No issues found. (${falsePositiveCount} false positives).`
          );
        }
        core.info("Scan completed successfully. No issues found.");
        return;
      }

      await new Promise((r) => setTimeout(r, 3000));
    }

    core.setFailed("Scan timed out");
  } catch (error) {
    core.setFailed(
      error instanceof Error ? error.message : "An unknown error occurred"
    );
  }
}

run();
