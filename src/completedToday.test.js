import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileFunction } from "node:vm";
import { todayKey } from "./planning.js";
import { buildClearReloadState } from "./clearReload.js";
import { buildWeeklyHistory, selectCurrentWeekCompletionData } from "./weeklySummary.js";

const originalTimezone = process.env.TZ;
process.env.TZ = "Asia/Shanghai";
after(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

// Exercise App's actual selector and dependencies without copying its implementation,
// exporting a new production helper, or starting an app that could access Supabase.
const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const start = app.indexOf("  const completedToday = useMemo(");
const end = app.indexOf("  const suggestedToday =", start);
assert.ok(start >= 0 && end > start, "App's completedToday selector must be present");
const select = compileFunction(`${app.slice(start, end)}\nreturn completedToday;`,
  ["useMemo", "currentWeekCompletions", "currentDate", "todayKey", "state"]);
function home() {
  let previousDependencies, value;
  const useMemo = (calculate, dependencies) => {
    if (!previousDependencies || dependencies.some((dependency, index) =>
      !Object.is(dependency, previousDependencies[index]))) {
      value = calculate();
      previousDependencies = dependencies;
    }
    return value;
  };
  return (completions, date, state = { completed: [] }) => select(useMemo, completions, date, todayKey, state);
}
const now = new Date("2026-09-08T12:00:00+08:00");
const logs = [1, 2, 3].map((id) => ({
  id: `log-${id}`, name: `任务${id}`, category: "work", minutes: 25,
  completed_at: `2026-09-08T0${id}:00:00Z`,
}));
const oldState = {
  tasks: [], completed: [{ id: "task-1", completedAt: logs[0].completed_at }],
  weekStartDate: "2026-09-07", dailyTarget: 5,
};
function recordList(state, entries = logs) {
  return selectCurrentWeekCompletionData(
    buildWeeklyHistory(entries, [], now), state.completed, state.weekStartDate, now,
  ).completions;
}

test("首页与完成记录共用日志：日志3条、旧状态1条时显示3颗", () => {
  const records = recordList(oldState);
  assert.equal(records.length, 3);
  assert.equal(home()(records, "2026-09-08", oldState), records.length);
});

test("清空重装清掉旧状态完成数组后，首页仍统计保留的完成日志", () => {
  const cleared = buildClearReloadState(oldState);
  assert.equal(cleared.completed.length, 0);
  const records = recordList(cleared);
  assert.equal(home()(records, "2026-09-08", cleared), 3);
});

test("无云端日志时兼容完成记录页面回退的 completedAt 字段", () => {
  const records = recordList(oldState, []);
  assert.strictEqual(records, oldState.completed);
  assert.equal(home()(records, "2026-09-08", oldState), 1);
});

test("两种时间字段均可统计，缺失或无效时间不计入今天", () => {
  const records = [
    { completed_at: "2026-09-08T01:00:00Z" },
    { completedAt: "2026-09-08T10:00:00+08:00" },
    { completed_at: "invalid" },
    {},
  ];
  assert.equal(home()(records, "2026-09-08"), 2);
});

test("按本地自然日筛选：午夜属于新一天，跨天后同一数组重新计算", () => {
  const records = [
    { completed_at: "2026-09-08T15:59:59.999Z" }, // 9/8 23:59:59.999
    { completed_at: "2026-09-08T16:00:00.000Z" }, // 9/9 00:00:00
    { completedAt: "2026-09-09T23:59:59.999+08:00" },
    { completedAt: "2026-09-10T00:00:00+08:00" },
  ];
  const count = home();
  assert.equal(count(records, "2026-09-08"), 1);
  assert.equal(count(records, "2026-09-09"), 2);
  assert.equal(count(records, "2026-09-10"), 1);
});

test("新日志返回后更新首页，即使旧状态数组和当前日期没有变化", () => {
  const count = home();
  assert.equal(count(recordList(oldState, logs.slice(0, 2)), "2026-09-08", oldState), 2);
  assert.equal(count(recordList(oldState), "2026-09-08", oldState), 3);
});
