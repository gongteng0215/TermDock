import assert from "node:assert/strict";

import {
  TRANSFER_PROGRESS_REPORT_BYTES,
  TRANSFER_PROGRESS_REPORT_INTERVAL_MS,
  shouldReportTransferProgress
} from "../dist-electron/main/terminal/transfer-progress.js";

const baseState = {
  lastReportedBytes: 512 * 1024,
  lastReportedAt: 1_000
};

assert.equal(
  shouldReportTransferProgress(baseState, 520 * 1024, 10 * 1024 * 1024, 1_050, false),
  false,
  "small byte/time deltas should stay throttled"
);

assert.equal(
  shouldReportTransferProgress(
    baseState,
    baseState.lastReportedBytes + TRANSFER_PROGRESS_REPORT_BYTES,
    10 * 1024 * 1024,
    1_050,
    false
  ),
  true,
  "large byte deltas should report immediately"
);

assert.equal(
  shouldReportTransferProgress(
    baseState,
    520 * 1024,
    10 * 1024 * 1024,
    baseState.lastReportedAt + TRANSFER_PROGRESS_REPORT_INTERVAL_MS,
    false
  ),
  true,
  "elapsed interval should force a report"
);

assert.equal(
  shouldReportTransferProgress(baseState, 10 * 1024 * 1024, 10 * 1024 * 1024, 1_050, false),
  true,
  "completed transfers should always report"
);

assert.equal(
  shouldReportTransferProgress(baseState, 520 * 1024, 10 * 1024 * 1024, 1_050, true),
  true,
  "force flag should bypass throttling"
);

console.log("transfer-progress: ok");
