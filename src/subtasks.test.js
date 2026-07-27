import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeQuickNotes,
  settleCompletedTask,
  toggleSubtaskInState,
} from "./subtasks.js";

const unfinished = { id: "s1", text: "继续优化", completed: false, createdAt: "2026-07-27" };
const done = { id: "s2", text: "已经完成", completed: true, createdAt: "2026-07-27" };

test("未完成子事项优先转移到另一颗同名未完成任务球", () => {
  const current = { id: "a", name: "优化项目", category: "work", subtasks: [unfinished, done] };
  const state = {
    tasks: [current, { id: "b", name: " 优化项目 ", category: "work", subtasks: [] }],
    quickNotes: [],
    completed: [],
  };
  const result = settleCompletedTask(state, current, { id: "a" });
  assert.deepEqual(result.tasks[0].subtasks, [unfinished]);
  assert.equal(result.quickNotes.length, 0);
});

test("无同名球时未完成子事项退回随手记并保留分类", () => {
  const current = { id: "a", name: "优化项目", category: "creative", subtasks: [unfinished, done] };
  const state = { tasks: [current], quickNotes: [], completed: [] };
  const result = settleCompletedTask(state, current, { id: "a" });
  assert.deepEqual(
    result.quickNotes.map(({ id, text, category }) => ({ id, text, category })),
    [{ id: "s1", text: "继续优化", category: "creative" }],
  );
});

test("已完成子事项不会转移或退回", () => {
  const current = { id: "a", name: "优化项目", category: "work", subtasks: [done] };
  const state = { tasks: [current], quickNotes: [], completed: [] };
  const result = settleCompletedTask(state, current, { id: "a" });
  assert.equal(result.quickNotes.length, 0);
});

test("随手记始终按时间倒序展示", () => {
  const notes = normalizeQuickNotes(
    [
      { id: "old", text: "较早", category: "work", createdAt: "2026-07-20T08:00:00Z" },
      { id: "new", text: "较新", category: "study", createdAt: "2026-07-27T08:00:00Z" },
    ],
    ["work", "study"],
  );
  assert.deepEqual(notes.map((item) => item.id), ["new", "old"]);
});

test("勾选会同步写入当前球和任务池，并在重新进入时保留", () => {
  const current = { id: "a", name: "优化项目", category: "work", subtasks: [unfinished, done] };
  const state = { tasks: [current], current, quickNotes: [], completed: [] };
  const result = toggleSubtaskInState(state, "a", "s1");

  assert.equal(result.current.subtasks[0].completed, true);
  assert.equal(result.tasks[0].subtasks[0].completed, true);
  assert.deepEqual(result.tasks[0].subtasks, result.current.subtasks);
});

test("部分勾选后清空球时只转移仍未完成的子事项", () => {
  const first = { id: "s1", text: "已勾选", completed: false, createdAt: "2026-07-27" };
  const second = { id: "s2", text: "未勾选", completed: false, createdAt: "2026-07-27" };
  const current = { id: "a", name: "优化项目", category: "work", subtasks: [first, second] };
  const duplicate = { id: "b", name: "优化项目", category: "work", subtasks: [] };
  const toggled = toggleSubtaskInState(
    { tasks: [current, duplicate], current, quickNotes: [], completed: [] },
    "a",
    "s1",
  );
  const result = settleCompletedTask(toggled, toggled.current, { id: "a" });

  assert.deepEqual(result.tasks[0].subtasks.map((item) => item.id), ["s2"]);
  assert.equal(result.quickNotes.length, 0);
});

test("部分勾选且无同名球时只把未完成项退回原分类随手记", () => {
  const first = { id: "s1", text: "已勾选", completed: false, createdAt: "2026-07-27" };
  const second = { id: "s2", text: "未勾选", completed: false, createdAt: "2026-07-27" };
  const current = { id: "a", name: "优化项目", category: "health", subtasks: [first, second] };
  const toggled = toggleSubtaskInState(
    { tasks: [current], current, quickNotes: [], completed: [] },
    "a",
    "s1",
  );
  const result = settleCompletedTask(toggled, toggled.current, { id: "a" });

  assert.deepEqual(
    result.quickNotes.map(({ id, category }) => ({ id, category })),
    [{ id: "s2", category: "health" }],
  );
});
