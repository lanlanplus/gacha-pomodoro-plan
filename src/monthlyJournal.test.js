import test from "node:test";
import assert from "node:assert/strict";
import {
  completionStickerWindow,
  groupCompletionsByDate,
  hundredBallMilestone,
  mergeCompletionHistory,
  monthGrid,
  summarizeCompletionDay,
} from "./monthlyJournal.js";

test("builds a Monday-first month grid", () => {
  const grid = monthGrid(new Date(2026, 8, 1));
  assert.equal(grid.length, 35);
  assert.equal(grid[0], null);
  assert.equal(grid[1].key, "2026-09-01");
  assert.equal(grid[30].key, "2026-09-30");
});

test("merges local and remote completion copies without duplicates", () => {
  const local = [{ name: "读书", category: "study", minutes: 25, completedAt: "2026-09-15T10:00:00+08:00" }];
  const remote = [{ task_name: "读书", category: "study", minutes: 25, completed_at: "2026-09-15T10:00:00+08:00" }];
  assert.equal(mergeCompletionHistory(local, remote).length, 1);
});

test("groups and summarizes a day by focused minutes", () => {
  const entries = [
    { name: "邮件", category: "work", minutes: 10, completedAt: "2026-09-15T09:00:00+08:00" },
    { name: "阅读", category: "study", minutes: 45, completedAt: "2026-09-15T10:00:00+08:00" },
  ];
  const grouped = groupCompletionsByDate(entries);
  const summary = summarizeCompletionDay(grouped["2026-09-15"]);
  assert.equal(summary.count, 2);
  assert.equal(summary.minutes, 55);
  assert.equal(summary.dominantCategory, "study");
});

test("places the trophy on the one hundredth completion date", () => {
  const entries = [
    ...Array.from({ length: 20 }, (_, index) => ({
      name: `旧任务 ${index + 1}`,
      category: "work",
      minutes: 1,
      completedAt: new Date(2026, 7, 31, 8, index).toISOString(),
    })),
    ...Array.from({ length: 105 }, (_, index) => ({
    name: `任务 ${index + 1}`,
    category: "work",
    minutes: 1,
    completedAt: new Date(2026, 8, 1, 8, index).toISOString(),
    })),
  ];
  assert.equal(hundredBallMilestone(entries).record.name, "任务 100");
});

test("does not award the trophy for completions before September 2026", () => {
  const entries = Array.from({ length: 120 }, (_, index) => ({
    name: `旧任务 ${index + 1}`,
    category: "work",
    minutes: 1,
    completedAt: new Date(2026, 7, 1, 8, index).toISOString(),
  }));
  assert.equal(hundredBallMilestone(entries), null);
});

test("shows the latest eight stickers and reports the hidden remainder", () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    name: `任务 ${index + 1}`,
    category: "work",
    minutes: 1,
    completedAt: new Date(2026, 8, 18, 8, index).toISOString(),
  }));
  const window = completionStickerWindow(entries);
  assert.equal(window.visible.length, 8);
  assert.equal(window.visible[0].name, "任务 5");
  assert.equal(window.visible[7].name, "任务 12");
  assert.equal(window.hiddenCount, 4);
});
