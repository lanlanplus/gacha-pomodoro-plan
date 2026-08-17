import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWeeklySnapshotRow,
  getLastCompletedShanghaiWeek,
} from "./weeklySnapshot.js";

test("uses the just-ended Shanghai natural week even when the cron is delayed", () => {
  assert.deepEqual(
    getLastCompletedShanghaiWeek(new Date("2026-08-16T16:42:00.000Z")),
    {
      weekStartDate: "2026-08-10",
      startIso: "2026-08-09T16:00:00.000Z",
      endIso: "2026-08-16T16:00:00.000Z",
    },
  );
});

test("builds the frozen denominator from pending balls and exact weekly logs", () => {
  assert.deepEqual(
    buildWeeklySnapshotRow(
      { user_id: "user-1", app_state: { tasks: [{}, {}, {}] } },
      { completedCount: 7, focusMinutes: 125 },
      "2026-08-10",
    ),
    {
      user_id: "user-1",
      week_start_date: "2026-08-10",
      completed_count: 7,
      total_count: 10,
      completion_rate: 70,
      focus_minutes: 125,
    },
  );
});
