import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileFunction } from "node:vm";
import * as timer from "./focusSession.js";
import { settleCompletedTask } from "./subtasks.js";
import { getIsoWeek } from "./weeklySummary.js";
const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

export function appHarness() {
  const disk = new Map();
  const task = { id: "a", name: "读书", category: "study", kind: "task" };
  const context = {
    ...timer, settleCompletedTask, getIsoWeek,
    state: { tasks: [task], completed: [], current: task },
    focusSessionRef: { current: null }, restoredFocusOwnerRef: { current: "test" },
    wakeLockControllerRef: { current: null }, intervalRef: { current: null }, hasDistractedRef: { current: false },
    timerMinutes: 25, initialTimerMinutes: 25, session: null,
    window: { clearInterval() {} }, confirm: () => true,
    localStorage: { getItem: (key) => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value), removeItem: (key) => disk.delete(key) },
    logs: [], notice: "", playSound() {},
    setState: (update) => { context.state = update(context.state); },
    writeCompletionLog: (entry) => context.logs.push(entry),
    setNotice: (notice) => { context.notice = notice; },
  };
  for (const name of ["TimerMinutes", "TimerRemaining", "TimerFinished", "TimerRunning", "FocusMode", "HasDistracted", "TreeGrowthStartRemaining", "View", "MachineMode"]) {
    context[`set${name}`] = (value) => { context[name] = value; };
  }
  for (const name of ["persistFocusSession", "showFocusSession", "stopTimer", "resetTimer", "finishTimer", "completeCurrentTask", "abandonFocusTask"]) {
    const begin = app.indexOf(`  function ${name}(`);
    const end = app.indexOf("\n  }", begin) + 4;
    assert.ok(begin >= 0 && end > begin);
    context[name] = compileFunction(`with (context) { ${app.slice(begin, end)}; return ${name}; }`, ["context"])(context);
  }
  return context;
}
