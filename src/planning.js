export function todayKey(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

export function daysRemainingInWeek(date = new Date()) {
  const sunday = new Date(date);
  const daysUntilSunday = (7 - date.getDay()) % 7;
  sunday.setDate(date.getDate() + daysUntilSunday);
  sunday.setHours(23, 59, 59, 999);
  return Math.max(1, Math.ceil((sunday.getTime() - date.getTime()) / 86400000));
}

export function suggestedBallCount(remainingCount, date = new Date()) {
  return Math.ceil(remainingCount / daysRemainingInWeek(date));
}

export function isoWeekKey(date = new Date()) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function chooseTask({
  tasks,
  dailyDraws,
  suggestedToday,
  weekendCategories,
  date = new Date(),
  random = Math.random,
}) {
  const dateKey = todayKey(date);
  const todaysDraws = (dailyDraws || []).filter((item) => item.date === dateKey);
  const todaysKeys = new Set(todaysDraws.map((item) => item.key));
  const taskKey = (name) => name.trim().toLowerCase();
  const pick = (items) => items[Math.floor(random() * items.length)];
  const dailyAllowed = tasks.filter((task) => !task.dailyExclusive || !todaysKeys.has(taskKey(task.name)));
  let pool = dailyAllowed.length ? dailyAllowed : tasks.filter((task) => !task.dailyExclusive);
  if (!pool.length) return null;

  let weekendFallback = false;
  if (date.getDay() === 0 || date.getDay() === 6) {
    const weekendPool = pool.filter((task) => weekendCategories.includes(task.category));
    if (weekendPool.length) {
      pool = weekendPool;
    } else {
      weekendFallback = true;
    }
  }

  const fresh = pool.filter((task) => !todaysKeys.has(taskKey(task.name)));
  const randomPool = fresh.length ? fresh : pool;
  const taskDrawCount = todaysDraws.filter((item) => item.category).length;

  if (taskDrawCount < suggestedToday) {
    const categoryCounts = todaysDraws.reduce((counts, item) => {
      if (item.category) counts[item.category] = (counts[item.category] || 0) + 1;
      return counts;
    }, {});
    const availableCategories = [...new Set(randomPool.map((task) => task.category))];
    const minimumCount = Math.min(...availableCategories.map((category) => categoryCounts[category] || 0));
    const preferredCategories = availableCategories.filter(
      (category) => (categoryCounts[category] || 0) === minimumCount,
    );
    const balancedPool = randomPool.filter((task) => preferredCategories.includes(task.category));
    return { task: pick(balancedPool), weekendFallback };
  }

  return { task: pick(randomPool), weekendFallback };
}
