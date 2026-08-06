import assert from "node:assert/strict";
import test from "node:test";
import {
  activeCategoryStats,
  buildCategoryStats,
  buildFocusStory,
  buildWeeklyHighlights,
  buildWeeklyHistory,
  buildWeeklyMessage,
  getIsoWeek,
  groupCompletedTasks,
  normalizeCompletionLogCategories,
  overlayCurrentWeekState,
  selectCurrentWeekCompletionData,
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

test("groups completion logs by local ISO week and keeps legacy weeks imprecise", () => {
  const history = buildWeeklyHistory(
    [
      { category: "work", completed_at: "2026-06-15T10:00:00+08:00" },
      { category: "work", completed_at: "2026-06-21T23:00:00+08:00" },
      { category: "health", completed_at: "2026-06-22T10:00:00+08:00" },
    ],
    [{ lastUsedAt: "2026-06-08T10:00:00+08:00" }],
    new Date("2026-07-01T10:00:00+08:00"),
  );

  assert.deepEqual(
    history.map(({ key, precise, completed }) => ({ key, precise, completed })),
    [
      { key: "2026-06-22", precise: true, completed: 1 },
      { key: "2026-06-15", precise: true, completed: 2 },
      { key: "2026-06-08", precise: false, completed: undefined },
    ],
  );
  assert.equal(history[0].best, false);
  assert.equal(history[1].best, false);
});

test("maps persisted category names back to category ids", () => {
  const normalized = normalizeCompletionLogCategories(
    [
      { category: "工作" },
      { category: "健康" },
      { category: "custom" },
    ],
    { 工作: "work", 健康: "health" },
  );

  assert.deepEqual(normalized.map((log) => log.category), ["work", "health", "custom"]);
  const stats = buildCategoryStats(categories, [], normalized);
  assert.deepEqual(stats.map(({ id, done }) => ({ id, done })), [
    { id: "work", done: 1 },
    { id: "health", done: 1 },
    { id: "study", done: 0 },
  ]);
});

test("returns no weekly history for a new user without logs or legacy activity", () => {
  assert.deepEqual(buildWeeklyHistory([], []), []);
});

test("keeps all-old completion durations explicitly unavailable", () => {
  const history = buildWeeklyHistory(
    [
      { category: "work", completed_at: "2026-06-15T10:00:00+08:00" },
      { category: "study", minutes: null, completed_at: "2026-06-16T10:00:00+08:00" },
    ],
    [],
    new Date("2026-07-01T10:00:00+08:00"),
  );

  assert.equal(history[0].focusMinutes, 0);
  assert.equal(history[0].missingMinutesCount, 2);
  assert.equal(history[0].hasCompleteFocusMinutes, false);
});

test("aggregates focus minutes and reports missing legacy durations", () => {
  const history = buildWeeklyHistory(
    [
      { category: "work", minutes: 25, completed_at: "2026-06-15T10:00:00+08:00" },
      { category: "study", minutes: 15, completed_at: "2026-06-16T10:00:00+08:00" },
      { category: "health", minutes: null, completed_at: "2026-06-17T10:00:00+08:00" },
    ],
    [],
    new Date("2026-07-01T10:00:00+08:00"),
  );

  assert.equal(history[0].focusMinutes, 40);
  assert.equal(history[0].missingMinutesCount, 1);
  assert.equal(history[0].hasCompleteFocusMinutes, false);
});

test("marks focus minutes complete when every completion log has a duration", () => {
  const history = buildWeeklyHistory(
    [
      { category: "work", minutes: 25, completed_at: "2026-06-15T10:00:00+08:00" },
      { category: "study", minutes: 20, completed_at: "2026-06-16T10:00:00+08:00" },
    ],
    [],
    new Date("2026-07-01T10:00:00+08:00"),
  );

  assert.equal(history[0].focusMinutes, 45);
  assert.equal(history[0].missingMinutesCount, 0);
  assert.equal(history[0].hasCompleteFocusMinutes, true);
});

test("awards ended weeks from the second precise week and includes ties", () => {
  const history = buildWeeklyHistory(
    [
      { category: "work", completed_at: "2026-06-01T10:00:00+08:00" },
      { category: "work", completed_at: "2026-06-08T10:00:00+08:00" },
      { category: "health", completed_at: "2026-06-15T10:00:00+08:00" },
    ],
    [],
    new Date("2026-07-01T10:00:00+08:00"),
  );
  const chronological = [...history].reverse();
  assert.deepEqual(chronological.map((week) => week.best), [false, true, true]);
  assert.equal(chronological[1].tiedBest, true);
  assert.equal(getIsoWeek("2026-01-01T10:00:00+08:00").weekNumber, 1);
});

test("prefers current-week logs over state completions", () => {
  const history = buildWeeklyHistory(
    [
      { category: "work", completed_at: "2026-06-15T10:00:00+08:00" },
      { category: "health", completed_at: "2026-06-22T10:00:00+08:00" },
    ],
    [],
    new Date("2026-06-24T10:00:00+08:00"),
  );
  const displayed = overlayCurrentWeekState(
    history,
    [
      { category: "study" },
      { category: "study" },
      { category: "life" },
    ],
    new Date("2026-06-24T10:00:00+08:00"),
  );

  assert.equal(displayed[0].key, "2026-06-22");
  assert.equal(displayed[0].completed, 1);
  assert.equal(displayed[0].topCategory, "health");
  assert.deepEqual(displayed[0].categoryCounts, { health: 1 });
  assert.equal(displayed[1].key, "2026-06-15");
  assert.equal(displayed[1].completed, 1);

  const selected = selectCurrentWeekCompletionData(
    history,
    [{ category: "study" }],
    new Date("2026-06-24T10:00:00+08:00"),
  );
  assert.equal(selected.source, "logs");
  assert.deepEqual(selected.completions.map((item) => item.category), ["health"]);
});

test("keeps logged counts, categories, and focus minutes when state is reset", () => {
  const history = buildWeeklyHistory(
    [
      { category: "工作", minutes: 25, completed_at: "2026-06-22T10:00:00+08:00" },
      { category: "健康", minutes: 20, completed_at: "2026-06-23T10:00:00+08:00" },
    ],
    [],
    new Date("2026-06-24T10:00:00+08:00"),
  );

  const displayed = overlayCurrentWeekState(
    history,
    [],
    new Date("2026-06-24T10:00:00+08:00"),
  );

  assert.equal(displayed[0].completed, 2);
  assert.deepEqual(displayed[0].categoryCounts, { 工作: 1, 健康: 1 });
  assert.equal(displayed[0].focusMinutes, 45);
  assert.equal(displayed[0].missingMinutesCount, 0);
  assert.equal(displayed[0].hasCompleteFocusMinutes, true);
});

test("keeps all logged stats after a same-week reset and a new state completion", () => {
  const history = buildWeeklyHistory(
    [
      { category: "工作", minutes: 25, completed_at: "2026-06-22T10:00:00+08:00" },
      { category: "健康", minutes: 20, completed_at: "2026-06-23T10:00:00+08:00" },
      { category: "学习", minutes: 15, completed_at: "2026-06-24T10:00:00+08:00" },
    ],
    [],
    new Date("2026-06-24T10:30:00+08:00"),
  );

  const displayed = overlayCurrentWeekState(
    history,
    [{ category: "study", minutes: 15 }],
    new Date("2026-06-24T10:30:00+08:00"),
  );

  assert.equal(displayed[0].completed, 3);
  assert.deepEqual(displayed[0].categoryCounts, { 工作: 1, 健康: 1, 学习: 1 });
  assert.equal(displayed[0].focusMinutes, 60);
  assert.equal(displayed[0].missingMinutesCount, 0);
  assert.equal(displayed[0].hasCompleteFocusMinutes, true);
});

test("falls back to local state stats when no current-week logs exist", () => {
  const displayed = overlayCurrentWeekState(
    [],
    [
      { category: "study", minutes: 12 },
      { category: "life", minutes: 18 },
    ],
    new Date("2026-06-24T10:00:00+08:00"),
  );

  assert.equal(displayed[0].completed, 2);
  assert.deepEqual(displayed[0].categoryCounts, { study: 1, life: 1 });
  assert.equal(displayed[0].focusMinutes, 30);
  assert.equal(displayed[0].missingMinutesCount, 0);
  assert.equal(displayed[0].hasCompleteFocusMinutes, true);

  const selected = selectCurrentWeekCompletionData(
    [],
    [{ category: "study", minutes: 12 }],
    new Date("2026-06-24T10:00:00+08:00"),
  );
  assert.equal(selected.source, "state");
  assert.deepEqual(selected.completions, [{ category: "study", minutes: 12 }]);
});
