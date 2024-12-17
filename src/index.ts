import * as core from "@actions/core";
import * as github from "@actions/github";
import fetch from "node-fetch";
import { z } from "zod";

const GetInitialScanRequest = z.object({
  apiKey: z.string(),
  repoId: z.number(),
  actionRunId: z.number(),
  pullRequest: z.string().nullable(),
});

const ScanResponse = z.object({
  id: z.string(),
  status: z.enum(["scanning", "triaging", "done", "generating patches"]),
  errorMessage: z.string().nullable(),
});

async function getScanId(
  apiUrl: string,
  request: z.infer<typeof GetInitialScanRequest>
): Promise<string> {
  const scanResponse = await fetch(`${apiUrl}/scans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (scanResponse.status === 404) {
    throw new Error("Scan not found");
  }

  if (!scanResponse.ok) {
    const errorText = await scanResponse.text();
    throw new Error(`Failed to get scan: ${scanResponse.status} ${errorText}`);
  }

  const responseData = await scanResponse.json();
  const { id } = ScanResponse.parse(responseData);
  return id;
}

async function getScanStatus(apiUrl: string, scanId: string, apiKey: string) {
  const statusResponse = await fetch(`${apiUrl}/scans/status/${scanId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!statusResponse.ok) {
    const errorText = await statusResponse.text();
    throw new Error(
      `Failed to check scan status: ${statusResponse.status} ${errorText}`
    );
  }

  const responseData = await statusResponse.json();
  return ScanResponse.parse(responseData);
}

async function run() {
  try {
    const apiKey = core.getInput("api-key", { required: true });
    const environment = core.getInput("environment", { required: false });
    let apiUrl =
      environment && environment === "dev"
        ? "https://josh-pensar-api.pensar.dev"
        : "https://pensar-api.pensar.dev";

    // Validate PR context
    if (!github.context.payload.pull_request?.html_url) {
      core.error(`Status check can only be ran in a PR event.`);
      return;
    }

    const repoId = github.context.payload.repository?.id;
    const runId = github.context.runId;
    const prUrl = github.context.payload.pull_request?.html_url;

    // Initial request to get scan ID
    const initialRequest: z.infer<typeof GetInitialScanRequest> = {
      apiKey: apiKey,
      repoId: repoId,
      actionRunId: runId,
      pullRequest: prUrl,
    };

    // Get initial scan ID
    let scanId: string;
    try {
      scanId = await getScanId(apiUrl, initialRequest);
      core.info(`Retrieved scan ID: ${scanId}`);
    } catch (error) {
      if (error instanceof Error && error.message === "Scan not found") {
        core.error("No scan found for this PR");
        return;
      }
      throw error;
    }

    // Poll for status using scan ID
    const maxAttempts = 1200; // try for 1 hour
    for (let i = 0; i < maxAttempts; i++) {
      const { status, errorMessage } = await getScanStatus(
        apiUrl,
        scanId,
        apiKey
      );

      core.info(`Current scan status: ${status}`);

      if (status === "done" && errorMessage) {
        core.error(`Error occurred during scan: ${errorMessage}`);
        return;
      }

      if (status === "done") {
        core.info("Scan completed successfully");
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
