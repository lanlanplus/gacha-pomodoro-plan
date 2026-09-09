import assert from "node:assert/strict";
import test, { after } from "node:test";
import { buildWeeklyHistory, groupCompletedTasks, normalizeCompletionLogCategories, selectCurrentWeekCompletionData } from "./weeklySummary.js";

const originalTimezone = process.env.TZ;
process.env.TZ = "Asia/Shanghai";
after(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});
const now = new Date("2026-09-09T12:00:00+08:00");
const record = (fields) => ({ name: "看书", category: "life", minutes: 25, ...fields });

test("云端日志经实际列表数据链路显示本地具体完成时间", () => {
  const logs = normalizeCompletionLogCategories([
    { task_name: "看书", category: "生活", minutes: 25, completed_at: "2026-09-09T02:03:04Z" },
  ], { 生活: "life" });
  const { completions } = selectCurrentWeekCompletionData(buildWeeklyHistory(logs, [], now), [], "2026-09-07", now);
  assert.equal(groupCompletedTasks(completions)[0].dateLabel, "完成于：2026/09/09 10:03:04");
});

test("旧状态回退与云端时间混合、乱序聚合，显示最近一次而非数组末项", () => {
  const local = [record({ completedAt: "2026-09-09T00:01:02+08:00" })];
  const { completions } = selectCurrentWeekCompletionData([], local, "2026-09-07", now);
  assert.equal(groupCompletedTasks(completions)[0].dateLabel, "完成于：2026/09/09 00:01:02");
  const [group] = groupCompletedTasks([...completions, record({ completed_at: "2026-09-08T15:59:59Z" })]);
  assert.equal(group.dateLabel, "最近完成：2026/09/09 00:01:02");
  assert.equal(group.count, 2);
  assert.equal(group.minutes, 50);
});

test("缺失或无效时间不显示 undefined，不伪造日期，不影响有效时间排序", () => {
  const grouped = groupCompletedTasks([
    record({ name: "未知", completedAt: null }),
    record({ completed_at: "invalid" }),
    record({ completedAt: "2026-09-09T10:00:00+08:00" }),
    record({}),
  ]);
  assert.equal(grouped[0].dateLabel, "最近已知完成：2026/09/09 10:00:00（2 次完成时间未知）");
  assert.equal(grouped[0].count, 3);
  assert.equal(grouped[1].dateLabel, "完成时间未知");
});
