import assert from "node:assert/strict";
import test from "node:test";
import { getTaskHistorySuggestions, recordTaskHistory } from "./taskHistory.js";

test("records frequency and keeps the most recently used category", () => {
  let history = recordTaskHistory([], "有氧运动", "health", 1);
  history = recordTaskHistory(history, "有氧运动", "life", 2);

  assert.equal(history.length, 1);
  assert.deepEqual(history[0], {
    name: "有氧运动",
    category: "life",
    count: 2,
    lastUsedAt: 2,
  });
});

test("sorts by frequency, filters by query, and limits suggestions", () => {
  const history = [
    { name: "读书", category: "study", count: 2, lastUsedAt: 2 },
    { name: "读论文", category: "study", count: 4, lastUsedAt: 1 },
    { name: "跑步", category: "health", count: 8, lastUsedAt: 3 },
  ];

  assert.deepEqual(
    getTaskHistorySuggestions(history, "读").map((item) => item.name),
    ["读论文", "读书"],
  );
  assert.equal(getTaskHistorySuggestions(history, "", 2).length, 2);
});
