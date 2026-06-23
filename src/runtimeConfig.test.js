import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimeConfig } from "./runtimeConfig.js";

test("uses accelerated timer settings only in development mode", () => {
  assert.deepEqual(createRuntimeConfig(true), {
    initialTimerMinutes: 5,
    treeStageSeconds: 60,
  });
  assert.deepEqual(createRuntimeConfig(false), {
    initialTimerMinutes: 25,
    treeStageSeconds: 300,
  });
});
