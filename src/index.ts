// src/index.ts
import * as core from "@actions/core";
import * as github from "@actions/github";
import fetch from "node-fetch";
import { z } from "zod";
const DispatchScanRequest = z.object({
  apiKey: z.string(),
  repoId: z.number(),
  eventType: z.enum(["pull-request", "commit"]),
  actionRunId: z.number(),
});

const GetScanStatusRequest = z.object({
  apiKey: z.string(),
  repoId: z.number(),
  actionRunId: z.number(),
});

const ScanStatusResponse = z.object({
  id: z.string(),
  status: z.enum(["scanning", "triaging", "done", "generating patches"]),
});

async function run() {
  try {
    const apiKey = core.getInput("api-key", { required: true });
    const environment = core.getInput("environment", { required: false });
    let apiUrl =
      environment && environment === "dev"
        ? "https://josh-pensar-api.pensar.dev"
        : "https://pensar-api.pensar.dev";

    // Queue the scan
    const repoId = github.context.payload.repository?.id;
    const runId = github.context.runId;
    const eventName = github.context.eventName;
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
    };
    const queueResponse = await fetch(`${apiUrl}/scans/dispatch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(queueRequest),
    });

    if (!queueResponse.ok) {
      throw new Error(`Failed to queue scan: ${queueResponse.statusText}`);
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
      const statusResponse = await fetch(`${apiUrl}/scans/status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(statusRequest),
      });
      core.info(`${statusResponse.status}`);
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
      core.info(`Current scan status: ${JSON.stringify(responseData)}`);

      const { status } = ScanStatusResponse.parse(responseData);

      core.info(`Current scan status: ${status}`);

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
