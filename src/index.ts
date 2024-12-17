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
  errorMessage: z.string(),
});

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

    // try for 1 hour
    const maxAttempts = 1200;
    let scanId: string | null = null;

    for (let i = 0; i < maxAttempts; i++) {
      const scanResponse = await fetch(`${apiUrl}/scans`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(initialRequest),
      });

      if (scanResponse.status === 404) {
        core.info("Scan not found yet, waiting...");
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      if (!scanResponse.ok) {
        const errorText = await scanResponse.text();
        throw new Error(
          `Failed to get scan status: ${scanResponse.status} ${errorText}`
        );
      }

      const responseData = await scanResponse.json();
      core.info(`Received scan data: ${JSON.stringify(responseData)}`);

      const { id, status, errorMessage } = ScanResponse.parse(responseData);
      scanId = id;

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
