import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 03:30 UTC = 09:00 AM IST
crons.cron(
  "deletion-warning-morning",
  "30 3 * * *",
  internal.jobs.runDeletionWarnings,
);

// 11:30 UTC = 05:00 PM IST
crons.cron(
  "deletion-warning-evening",
  "30 11 * * *",
  internal.jobs.runDeletionWarnings,
);

// 00:00 UTC daily — auto-delete expired records
crons.cron(
  "auto-delete-expired",
  "0 0 * * *",
  internal.jobs.deleteExpiredRecords,
);

// 02:00 UTC every Sunday — orphan file cleanup
crons.cron(
  "cleanup-orphan-files",
  "0 2 * * 0",
  internal.jobs.cleanupOrphanFiles,
);

export default crons;
