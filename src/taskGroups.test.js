import assert from "node:assert/strict";
import test from "node:test";
import { groupTaskPool } from "./taskGroups.js";

test("groups tasks only when both name and category match", () => {
  const groups = groupTaskPool(
    [
      { id: "1", name: "有氧运动", category: "health" },
      { id: "2", name: "有氧运动", category: "health" },
      { id: "3", name: "有氧运动", category: "work" },
    ],
    [],
  );

  assert.equal(groups.length, 2);
  assert.equal(groups.find((group) => group.category === "health").pending.length, 2);
  assert.equal(groups.find((group) => group.category === "work").pending.length, 1);
});

test("keeps completed balls in the group and marks fully completed tasks", () => {
  const groups = groupTaskPool(
    [{ id: "1", name: "读书", category: "study" }],
    [
      { id: "2", name: "读书", category: "study", completedAt: "2026-06-18T10:00:00+08:00" },
      { id: "3", name: "冥想", category: "health", completedAt: "2026-06-18T11:00:00+08:00" },
    ],
  );

  const reading = groups.find((group) => group.name === "读书");
  const meditation = groups.find((group) => group.name === "冥想");
  assert.equal(reading.total, 2);
  assert.equal(reading.pending.length, 1);
  assert.equal(reading.completed.length, 1);
  assert.equal(reading.allCompleted, false);
  assert.equal(meditation.allCompleted, true);
});
