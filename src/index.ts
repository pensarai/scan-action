// src/index.ts
import * as core from "@actions/core";
import fetch from "node-fetch";

async function run() {
  try {
    // const apiKey = core.getInput("api-key", { required: true });
    // const apiUrl = core.getInput("api-url", { required: true });
    // const installationId = core.getInput("installation-id", { required: true });
    // const repository = core.getInput("repository", { required: true });

    // Queue the scan
    core.info("Queueing scan...");
    // const queueResponse = await fetch(`${apiUrl}/scans`, {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Bearer ${apiKey}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     installation_id: installationId,
    //     repository: repository,
    //   }),
    // });

    // if (!queueResponse.ok) {
    //   throw new Error(`Failed to queue scan: ${queueResponse.statusText}`);
    // }

    // const { scan_id } = await queueResponse.json();
    // core.setOutput("scan_id", scan_id);
    // core.info(`Scan queued with ID: ${scan_id}`);

    // // Poll for completion
    // const maxAttempts = 30;
    // for (let i = 0; i < maxAttempts; i++) {
    //   const statusResponse = await fetch(`${apiUrl}/scans/${scan_id}`, {
    //     headers: {
    //       Authorization: `Bearer ${apiKey}`,
    //     },
    //   });

    //   if (!statusResponse.ok) {
    //     throw new Error(
    //       `Failed to check scan status: ${statusResponse.statusText}`
    //     );
    //   }

    //   const { status } = await statusResponse.json();

    //   if (status === "completed") {
    //     core.info("Scan completed successfully");
    //     return;
    //   }

    //   if (status === "failed") {
    //     core.setFailed("Scan failed");
    //     return;
    //   }

    //   core.info(
    //     `Scan in progress (attempt ${
    //       i + 1
    //     }/${maxAttempts}). Waiting 30 seconds...`
    //   );

    core.info(
      `Scan in progress (attempt ${1 + 1}/${1}). Waiting 30 seconds...`
    );
    await new Promise((r) => setTimeout(r, 30000));
    // }

    core.setFailed("Scan timed out");
  } catch (error) {
    core.setFailed(
      error instanceof Error ? error.message : "An unknown error occurred"
    );
  }
}

run();
