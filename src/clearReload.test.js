import assert from "node:assert/strict";
import test from "node:test";
import { buildClearReloadState, resetDrawTransientState } from "./clearReload.js";

test("clears the machine while preserving setup preferences and quick notes", () => {
  const currentState = {
    tasks: [{ id: "task-1" }],
    completed: [{ id: "done-1" }],
    dailyDraws: [{ taskId: "task-1" }],
    dailyTarget: 4,
    specialEnabled: false,
    current: { id: "task-1" },
    quickNotes: [{ id: "note-1" }],
  };

  assert.deepEqual(buildClearReloadState(currentState), {
    tasks: [],
    completed: [],
    dailyDraws: [],
    dailyTarget: 4,
    specialEnabled: false,
    current: null,
    quickNotes: [{ id: "note-1" }],
  });
});

test("cancels an in-flight draw and resets every draw transient", () => {
  const calls = [];

  resetDrawTransientState({
    cancelPendingDraw: () => calls.push(["cancel"]),
    setPendingPrize: (value) => calls.push(["pendingPrize", value]),
    setDrawInProgress: (value) => calls.push(["drawInProgress", value]),
    setDrawPhase: (value) => calls.push(["drawPhase", value]),
  });

  assert.deepEqual(calls, [
    ["cancel"],
    ["pendingPrize", null],
    ["drawInProgress", false],
    ["drawPhase", "idle"],
  ]);
});
