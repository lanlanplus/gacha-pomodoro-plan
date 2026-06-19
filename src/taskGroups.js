export function groupTaskPool(tasks, completed) {
  const groups = new Map();

  const ensureGroup = (item) => {
    const key = `${item.category}::${item.name.trim().toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: item.name,
        category: item.category,
        dailyExclusive: Boolean(item.dailyExclusive),
        pending: [],
        completed: [],
      });
    }
    return groups.get(key);
  };

  tasks.forEach((task) => {
    const group = ensureGroup(task);
    group.dailyExclusive ||= Boolean(task.dailyExclusive);
    group.pending.push(task);
  });

  completed.forEach((task) => {
    ensureGroup(task).completed.push(task);
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      total: group.pending.length + group.completed.length,
      allCompleted: group.pending.length === 0 && group.completed.length > 0,
    }))
    .sort((a, b) => {
      if (a.allCompleted !== b.allCompleted) return a.allCompleted ? 1 : -1;
      return a.name.localeCompare(b.name, "zh-CN");
    });
}
