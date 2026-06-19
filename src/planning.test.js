import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseTask,
  daysRemainingInWeek,
  isoWeekKey,
  suggestedBallCount,
  todayKey,
} from "./planning.js";

const monday = new Date(2026, 5, 15, 9);
const saturday = new Date(2026, 5, 20, 9);

const tasks = [
  { id: "w1", name: "工作一", category: "work", dailyExclusive: false },
  { id: "w2", name: "工作二", category: "work", dailyExclusive: false },
  { id: "h1", name: "运动", category: "health", dailyExclusive: false },
];

test("calculates a stable daily suggestion through Sunday", () => {
  assert.equal(daysRemainingInWeek(monday), 7);
  assert.equal(suggestedBallCount(15, monday), 3);
  assert.equal(daysRemainingInWeek(new Date(2026, 5, 21, 23, 30)), 1);
  assert.equal(isoWeekKey(monday), "2026-W25");
});

test("prefers the least-drawn available category inside today's suggestion", () => {
  const result = chooseTask({
    tasks,
    dailyDraws: [{ date: todayKey(monday), key: "工作一", category: "work" }],
    suggestedToday: 3,
    weekendCategories: ["work", "health"],
    date: monday,
    random: () => 0,
  });

  assert.equal(result.task.category, "health");
  assert.equal(result.weekendFallback, false);
});

test("uses the full random pool after today's suggestion is reached", () => {
  const result = chooseTask({
    tasks,
    dailyDraws: [
      { date: todayKey(monday), key: "旧工作", category: "work" },
      { date: todayKey(monday), key: "旧运动", category: "health" },
    ],
    suggestedToday: 2,
    weekendCategories: ["work", "health"],
    date: monday,
    random: () => 0,
  });

  assert.equal(result.task.category, "work");
});

test("filters weekend categories and falls back when the preferred pool is empty", () => {
  const filtered = chooseTask({
    tasks,
    dailyDraws: [],
    suggestedToday: 2,
    weekendCategories: ["health"],
    date: saturday,
    random: () => 0,
  });
  assert.equal(filtered.task.category, "health");
  assert.equal(filtered.weekendFallback, false);

  const fallback = chooseTask({
    tasks: tasks.filter((task) => task.category === "work"),
    dailyDraws: [],
    suggestedToday: 2,
    weekendCategories: ["health"],
    date: saturday,
    random: () => 0,
  });
  assert.equal(fallback.task.category, "work");
  assert.equal(fallback.weekendFallback, true);
});
