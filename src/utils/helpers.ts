import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  DispatchScanRequest,
  GetScanIssueRequest,
  GetScanStatusRequest,
  IssuesResponseObject,
  ScanStatusResponseObject,
} from "./types";

export function getEnvironmentInputs() {
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
  return { apiKey, environment, apiUrl };
}

export function getGitHubContextInputs() {
  const repoId = github.context.payload.repository?.id;
  const runId = github.context.runId;
  const eventName = github.context.eventName;
  const prUrl = github.context.payload.pull_request?.html_url ?? null;
  const targetBranch =
    eventName === "pull_request"
      ? github.context.payload.pull_request?.head.ref
      : github.context.ref.replace("refs/heads/", "");
  const eventType: "pull-request" | "commit" =
    eventName === "pull_request"
      ? "pull-request"
      : eventName === "push"
      ? "commit"
      : (() => {
          throw new Error(`Unsupported event type: ${eventName}`);
        })();
  return { repoId, runId, eventName, prUrl, targetBranch, eventType };
}

export async function queueScan(params: {
  apiKey: string;
  repoId: number;
  runId: number;
  eventType: "pull-request" | "commit";
  prUrl: string | null;
  targetBranch: string;
  apiUrl: string;
}) {
  core.info("Queueing scan...");
  const queueRequest: DispatchScanRequest = {
    apiKey: params.apiKey,
    repoId: params.repoId,
    actionRunId: params.runId,
    eventType: params.eventType,
    pullRequest: params.prUrl,
    targetBranch: params.targetBranch,
  };
  const queueResponse = await fetch(`${params.apiUrl}/scans/github/dispatch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(queueRequest),
  });

  if (!queueResponse.ok) {
    const result = await queueResponse.json();
    throw new Error(`Failed to queue scan: ${result.message}`);
  }
  core.info(`Scan queued...`);
}

export async function getScanStatus(params: {
  apiKey: string;
  repoId: number;
  runId: number;
  apiUrl: string;
}) {
  const statusRequest: GetScanStatusRequest = {
    apiKey: params.apiKey,
    repoId: params.repoId,
    actionRunId: params.runId,
  };

  // try for 1 hour
  const maxAttempts = 1200;
  for (let i = 0; i < maxAttempts; i++) {
    const statusResponse = await fetch(`${params.apiUrl}/scans/github/status`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
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
      ScanStatusResponseObject.parse(responseData);

    core.info(`Current scan status: ${status}`);
    if (status === "done" && errorMessage) {
      core.setFailed(`Error occurred during scan: ${errorMessage}`);
      return {
        status: "error",
        scanId: id,
      };
    }
    if (status === "done") {
      return { status, scanId: id };
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  core.setFailed("Scan timed out");
  return {
    status: "error",
    scanId: null,
  };
}

export async function getScanIssues(params: {
  apiKey: string;
  scanId: string;
  apiUrl: string;
}) {
  const issuesRequest: GetScanIssueRequest = {
    apiKey: params.apiKey,
    scanId: params.scanId,
  };
  const issuesResponse = await fetch(`${params.apiUrl}/scans/github/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(issuesRequest),
  });
  if (!issuesResponse.ok) {
    const errorText = await issuesResponse.text();

    throw new Error(`Failed to get scan issues ${errorText}`);
  }
  const { issues } = IssuesResponseObject.parse(await issuesResponse.json());
  const validIssues = issues.filter(
    (issue) => !issue.falsePositive || !issue.falsePositive.falsePositive
  );
  const falsePositiveCount = issues.length - validIssues.length;

  return { falsePositiveCount, validIssuesCount: validIssues.length };
}
