import assert from "node:assert/strict";
import test from "node:test";
import {
  activeCategoryStats,
  buildCategoryStats,
  buildFocusStory,
  buildWeeklyHighlights,
  buildWeeklyMessage,
  groupCompletedTasks,
} from "./weeklySummary.js";

const categories = [
  { id: "work", name: "工作", color: "blue" },
  { id: "health", name: "健康", color: "green" },
  { id: "study", name: "学习", color: "yellow" },
];

test("builds a weekly message with the strongest and largest perfect category", () => {
  const stats = [
    { name: "工作", total: 5, done: 4, percent: 80 },
    { name: "健康", total: 2, done: 2, percent: 100 },
    { name: "学习", total: 4, done: 4, percent: 100 },
  ];
  assert.equal(
    buildWeeklyMessage(82, stats),
    "这周状态很好，几乎全部完成 💪 学习投入最多，学习全部完成 💪！",
  );
});

test("calculates category completion stats", () => {
  const stats = buildCategoryStats(
    categories,
    [{ category: "work" }, { category: "health" }],
    [{ category: "work" }, { category: "work" }],
  );
  assert.deepEqual(
    stats.map(({ id, done, total, percent }) => ({ id, done, total, percent })),
    [
      { id: "work", done: 2, total: 3, percent: 67 },
      { id: "health", done: 0, total: 1, percent: 0 },
      { id: "study", done: 0, total: 0, percent: 0 },
    ],
  );
});

test("filters categories with no balls this week", () => {
  assert.deepEqual(
    activeCategoryStats([
      { id: "work", total: 3 },
      { id: "creative", total: 0 },
    ]).map((category) => category.id),
    ["work"],
  );
});

test("builds up to three weekly highlights with distinct completion leaders", () => {
  const highlights = buildWeeklyHighlights([
    { id: "work", name: "工作", done: 2, remaining: 3, total: 5, percent: 40 },
    { id: "health", name: "健康", done: 4, remaining: 1, total: 5, percent: 80 },
    { id: "creative", name: "创意", done: 3, remaining: 0, total: 3, percent: 100 },
  ]);

  assert.deepEqual(
    highlights.map(({ type, category, text }) => ({ type, category: category.id, text })),
    [
      { type: "completion-rate", category: "creative", text: "全部完成！" },
      { type: "most-completed", category: "health", text: "本周完成最多" },
      { type: "most-remaining", category: "work", text: "还有 3 颗留到下周" },
    ],
  );
});

test("breaks equal completion rates by completed count and avoids duplicate leaders", () => {
  const highlights = buildWeeklyHighlights([
    { id: "work", name: "工作", done: 1, remaining: 1, total: 2, percent: 50 },
    { id: "health", name: "健康", done: 3, remaining: 3, total: 6, percent: 50 },
  ]);

  assert.equal(highlights[0].category.id, "health");
  assert.equal(highlights.some((highlight) => highlight.type === "most-completed"), false);
});

test("returns no highlights without completions and omits remaining when the week is complete", () => {
  assert.deepEqual(
    buildWeeklyHighlights([
      { id: "work", name: "工作", done: 0, remaining: 2, total: 2, percent: 0 },
    ]),
    [],
  );

  const completedWeek = buildWeeklyHighlights([
    { id: "study", name: "学习", done: 2, remaining: 0, total: 2, percent: 100 },
  ]);
  assert.deepEqual(completedWeek.map((highlight) => highlight.type), ["completion-rate"]);
});

test("converts focus time into articles or movies", () => {
  assert.match(buildFocusStory(90), /4 篇长文章/);
  assert.match(buildFocusStory(600), /5 部电影/);
});

test("groups same-name records and keeps accurate accumulated minutes", () => {
  const grouped = groupCompletedTasks([
    {
      name: "弹吉他",
      category: "creative",
      minutes: 24,
      completedAt: "2026-06-15T10:00:00+08:00",
    },
    {
      name: "弹吉他",
      category: "creative",
      minutes: 26,
      completedAt: "2026-06-18T10:00:00+08:00",
    },
  ]);
  assert.equal(grouped[0].count, 2);
  assert.equal(grouped[0].minutes, 50);
  assert.equal(grouped[0].dateLabel, "周一至周四完成");
});
