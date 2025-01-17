// src/index.ts
import * as core from "@actions/core";
import {
  getEnvironmentInputs,
  getGitHubContextInputs,
  getScanIssues,
  getScanStatus,
  queueScan,
} from "./utils/helpers";

async function run() {
  try {
    const { apiKey, apiUrl } = getEnvironmentInputs();
    const { repoId, runId, prUrl, targetBranch, eventType } =
      getGitHubContextInputs();

    await queueScan({
      apiKey,
      repoId,
      runId,
      eventType,
      prUrl,
      targetBranch,
      apiUrl,
    });

    const { status, scanId } = await getScanStatus({
      apiKey,
      repoId,
      runId,
      apiUrl,
    });
    if (status === "done" && scanId) {
      const { falsePositiveCount, validIssuesCount } = await getScanIssues({
        apiKey,
        scanId,
        apiUrl,
      });

      if (validIssuesCount > 0) {
        core.setFailed(
          `Scan completed successfully. ${validIssuesCount} issues found (${falsePositiveCount} false positives).`
        );
        return;
      }

      if (falsePositiveCount > 0) {
        core.info(
          `Scan completed successfully. No issues found. (${falsePositiveCount} false positives).`
        );
        return;
      }

      core.info("Scan completed successfully. No issues found.");
      return;
    }
  } catch (error) {
    core.setFailed(
      error instanceof Error ? error.message : "An unknown error occurred"
    );
  }
}

run();
