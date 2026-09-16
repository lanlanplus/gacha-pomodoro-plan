const pad = (value) => String(value).padStart(2, "0");

export const HUNDRED_BALL_START_DATE = "2026-09-01";

export function localDateKey(dateInput) {
  const date = new Date(dateInput);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function normalizeCompletionHistory(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const completedAt = item.completed_at || item.completedAt;
      if (!localDateKey(completedAt)) return null;
      const minutes = Number(item.minutes);
      return {
        id: item.id || `${completedAt}-${item.task_name || item.name || "task"}`,
        name: item.name || item.task_name || "未命名任务",
        category: item.category,
        minutes: Number.isFinite(minutes) && minutes >= 0 ? minutes : null,
        completedAt,
      };
    })
    .filter(Boolean);
}

function completionSignature(item) {
  return [item.completedAt, item.name, item.category, item.minutes ?? ""].join("|");
}

export function mergeCompletionHistory(...collections) {
  const merged = new Map();
  collections.flatMap(normalizeCompletionHistory).forEach((item) => {
    merged.set(completionSignature(item), item);
  });
  return [...merged.values()].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  );
}

export function monthGrid(anchorInput) {
  const anchor = new Date(anchorInput);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1, 12);
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((leading + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - leading + 1;
    if (day < 1 || day > daysInMonth) return null;
    const date = new Date(year, month, day, 12);
    return { day, date, key: localDateKey(date) };
  });
}

export function shiftMonth(anchorInput, amount) {
  const anchor = new Date(anchorInput);
  return new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1, 12);
}

export function groupCompletionsByDate(items) {
  return normalizeCompletionHistory(items).reduce((groups, item) => {
    const key = localDateKey(item.completedAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}

export function completionStickerWindow(items, limit = 8) {
  const entries = normalizeCompletionHistory(items);
  return {
    visible: entries.slice(-limit),
    hiddenCount: Math.max(0, entries.length - limit),
  };
}

export function summarizeCompletionDay(items) {
  const entries = normalizeCompletionHistory(items);
  const categoryTotals = entries.reduce((totals, item) => {
    const current = totals[item.category] || { count: 0, minutes: 0 };
    current.count += 1;
    if (Number.isFinite(item.minutes)) current.minutes += item.minutes;
    totals[item.category] = current;
    return totals;
  }, {});
  const dominantCategory = Object.entries(categoryTotals).sort(
    ([, a], [, b]) => b.minutes - a.minutes || b.count - a.count,
  )[0]?.[0] || null;

  return {
    entries,
    count: entries.length,
    minutes: entries.reduce(
      (sum, item) => sum + (Number.isFinite(item.minutes) ? item.minutes : 0),
      0,
    ),
    categoryTotals,
    dominantCategory,
  };
}

export function hundredBallMilestone(items, startDate = HUNDRED_BALL_START_DATE) {
  const entries = normalizeCompletionHistory(items).filter(
    (item) => localDateKey(item.completedAt) >= startDate,
  ).sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  );
  const record = entries[99];
  return record ? { record, dateKey: localDateKey(record.completedAt) } : null;
}
