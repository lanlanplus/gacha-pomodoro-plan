export function normalizeTaskHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item && typeof item.name === "string" && item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      category: item.category,
      count: Math.max(1, Number(item.count) || 1),
      lastUsedAt: Number(item.lastUsedAt) || 0,
    }));
}

export function recordTaskHistory(history, name, category, usedAt = Date.now()) {
  const cleanName = name.trim();
  const key = cleanName.toLocaleLowerCase();
  const current = normalizeTaskHistory(history);
  const existing = current.find((item) => item.name.toLocaleLowerCase() === key);

  if (!existing) {
    return [...current, { name: cleanName, category, count: 1, lastUsedAt: usedAt }];
  }

  return current.map((item) =>
    item === existing
      ? {
          ...item,
          name: cleanName,
          category,
          count: item.count + 1,
          lastUsedAt: usedAt,
        }
      : item,
  );
}

export function getTaskHistorySuggestions(history, query = "", limit = 5) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return normalizeTaskHistory(history)
    .filter((item) => item.name.toLocaleLowerCase().includes(normalizedQuery))
    .sort((left, right) => right.count - left.count || right.lastUsedAt - left.lastUsedAt)
    .slice(0, limit);
}
