const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function getIsoWeek(dateInput = new Date()) {
  const date = new Date(dateInput);
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = localDate.getDay() || 7;
  const start = new Date(localDate);
  start.setDate(localDate.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const thursday = new Date(start);
  thursday.setDate(start.getDate() + 3);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((thursday - yearStart) / 86400000 + yearStart.getDay() + 1) / 7,
  );
  const key = [
    start.getFullYear(),
    String(start.getMonth() + 1).padStart(2, "0"),
    String(start.getDate()).padStart(2, "0"),
  ].join("-");

  return { key, weekNumber, start, end };
}

function markBestWeeks(weeks, now) {
  const chronological = [...weeks]
    .filter((week) => week.precise)
    .sort((a, b) => a.start - b.start);
  let historicalHigh = -1;

  chronological.forEach((week, index) => {
    const ended = week.end < now;
    week.best = ended && index > 0 && week.completed >= historicalHigh;
    week.tiedBest = week.best && week.completed === historicalHigh;
    historicalHigh = Math.max(historicalHigh, week.completed);
  });
}

export function normalizeCompletionLogCategories(logs, categoryIdByName) {
  return logs.map((log) => ({
    ...log,
    category: categoryIdByName[log.category] || log.category,
  }));
}

export function buildWeeklyHistory(logs, taskHistory = [], now = new Date()) {
  const preciseWeeks = new Map();
  logs.forEach((log) => {
    const week = getIsoWeek(log.completed_at || log.completedAt);
    const item = preciseWeeks.get(week.key) || {
      ...week,
      precise: true,
      completed: 0,
      focusMinutes: 0,
      missingMinutesCount: 0,
      categoryCounts: {},
      logs: [],
    };
    item.completed += 1;
    if (Number.isFinite(log.minutes)) {
      item.focusMinutes += log.minutes;
    } else {
      item.missingMinutesCount += 1;
    }
    item.categoryCounts[log.category] = (item.categoryCounts[log.category] || 0) + 1;
    item.logs.push(log);
    preciseWeeks.set(week.key, item);
  });

  const legacyWeeks = new Map();
  taskHistory.forEach((item) => {
    if (!item.lastUsedAt) return;
    const week = getIsoWeek(item.lastUsedAt);
    if (!preciseWeeks.has(week.key)) {
      legacyWeeks.set(week.key, { ...week, precise: false });
    }
  });

  const precise = [...preciseWeeks.values()].sort((a, b) => a.start - b.start);
  precise.forEach((week) => {
    week.hasCompleteFocusMinutes = week.missingMinutesCount === 0;
    week.topCategory = Object.entries(week.categoryCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0] || null;
  });
  markBestWeeks(precise, now);

  return [...precise, ...legacyWeeks.values()].sort((a, b) => b.start - a.start);
}

export function applyWeeklySnapshots(
  history,
  snapshots,
  remainingCount,
  now = new Date(),
) {
  const currentWeekKey = getIsoWeek(now).key;
  const snapshotsByWeek = new Map(
    snapshots.map((snapshot) => [snapshot.week_start_date, snapshot]),
  );
  const merged = history.map((week) => {
    if (!week.precise) return week;
    const snapshot = week.key === currentWeekKey ? null : snapshotsByWeek.get(week.key);
    if (snapshot) {
      return {
        ...week,
        completed: Number(snapshot.completed_count),
        totalCount: Number(snapshot.total_count),
        completionRate: Number(snapshot.completion_rate),
        focusMinutes: Number(snapshot.focus_minutes),
        snapshot: true,
      };
    }

    if (week.key !== currentWeekKey) {
      return {
        ...week,
        totalCount: null,
        completionRate: null,
        snapshot: false,
      };
    }

    const totalCount = remainingCount + week.completed;
    return {
      ...week,
      totalCount,
      completionRate: totalCount ? Math.round((week.completed / totalCount) * 100) : 100,
      snapshot: false,
    };
  });
  markBestWeeks(merged, now);
  return merged;
}

export function selectCurrentWeekCompletionData(
  history,
  completed,
  stateWeekStartDate,
  now = new Date(),
) {
  const currentWeek = getIsoWeek(now);
  const loggedWeek = history.find(
    (week) => week.key === currentWeek.key && week.precise,
  );
  const canUseState = stateWeekStartDate === currentWeek.key;
  return {
    currentWeek,
    loggedWeek,
    completions: loggedWeek?.logs || (canUseState ? completed : []),
    source: loggedWeek ? "logs" : canUseState ? "state" : "empty",
  };
}

export function overlayCurrentWeekState(
  history,
  completed,
  stateWeekStartDate,
  now = new Date(),
) {
  const { currentWeek, loggedWeek: existing } = selectCurrentWeekCompletionData(
    history,
    completed,
    stateWeekStartDate,
    now,
  );
  if (existing) {
    return [
      {
        ...existing,
        current: true,
        best: false,
        tiedBest: false,
      },
      ...history.filter((week) => week.key !== currentWeek.key),
    ];
  }
  if (!existing && (stateWeekStartDate !== currentWeek.key || !completed.length)) return history;

  const categoryCounts = completed.reduce((counts, task) => {
    counts[task.category] = (counts[task.category] || 0) + 1;
    return counts;
  }, {});
  const fallbackFocus = completed.reduce(
    (summary, task) => {
      if (Number.isFinite(task.minutes)) {
        summary.focusMinutes += task.minutes;
      } else {
        summary.missingMinutesCount += 1;
      }
      return summary;
    },
    { focusMinutes: 0, missingMinutesCount: 0 },
  );
  const focusMinutes = fallbackFocus.focusMinutes;
  const missingMinutesCount = fallbackFocus.missingMinutesCount;
  const current = {
    ...currentWeek,
    precise: true,
    current: true,
    completed: completed.length,
    focusMinutes,
    missingMinutesCount,
    hasCompleteFocusMinutes: missingMinutesCount === 0,
    categoryCounts,
    topCategory: Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    best: false,
    tiedBest: false,
  };

  return [current, ...history.filter((week) => week.key !== currentWeek.key)];
}

export function buildCategoryStats(categories, tasks, completed) {
  return categories.map((category) => {
    const remaining = tasks.filter((task) => task.category === category.id).length;
    const done = completed.filter((task) => task.category === category.id).length;
    const total = remaining + done;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return { ...category, remaining, done, total, percent };
  });
}

export function activeCategoryStats(categoryStats) {
  return categoryStats.filter((category) => category.total > 0);
}

export function buildWeeklyHighlights(categoryStats) {
  const activeCategories = activeCategoryStats(categoryStats);
  if (!activeCategories.some((category) => category.done > 0)) return [];

  const highestRate = [...activeCategories].sort(
    (a, b) => b.percent - a.percent || b.done - a.done,
  )[0];
  const mostCompleted = [...activeCategories].sort(
    (a, b) => b.done - a.done || b.percent - a.percent,
  )[0];
  const mostRemaining = [...activeCategories]
    .filter((category) => category.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining || b.done - a.done)[0];

  const highlights = [
    {
      type: "completion-rate",
      emoji: "🏆",
      category: highestRate,
      text: highestRate.percent === 100 ? "全部完成！" : `完成率最高（${highestRate.percent}%）`,
    },
  ];

  if (mostCompleted.id !== highestRate.id) {
    highlights.push({
      type: "most-completed",
      emoji: "⭐",
      category: mostCompleted,
      text: "本周完成最多",
    });
  }

  if (mostRemaining) {
    highlights.push({
      type: "most-remaining",
      emoji: "📌",
      category: mostRemaining,
      text: `还有 ${mostRemaining.remaining} 颗留到下周`,
    });
  }

  return highlights;
}

export function buildWeeklyMessage(percent, categoryStats) {
  let message;
  if (percent === 100) {
    message = "完美收官！这周你把所有球都清空了 🎊";
  } else if (percent >= 80) {
    message = "这周状态很好，几乎全部完成 💪";
  } else if (percent >= 50) {
    message = "这周完成了一大半，稳稳向前 🌱";
  } else {
    message = "这周节奏慢了一点，没关系，下周重新来过 🌙";
  }

  const activeCategories = categoryStats.filter((category) => category.total > 0);
  if (!activeCategories.length) return message;

  const highestRate = [...activeCategories].sort(
    (a, b) => b.percent - a.percent || b.done - a.done || b.total - a.total,
  )[0];
  const perfectCategory = [...activeCategories]
    .filter((category) => category.percent === 100)
    .sort((a, b) => b.total - a.total || b.done - a.done)[0];

  message += ` ${highestRate.name}投入最多`;
  if (perfectCategory) message += `，${perfectCategory.name}全部完成 💪`;
  return `${message}！`;
}

export function buildFocusStory(totalMinutes) {
  if (!totalMinutes) return "这周还没开始累计专注时间，下一颗球就是起点 ✨";

  const hours = totalMinutes / 60;
  const timeText =
    totalMinutes < 60
      ? `${totalMinutes} 分钟`
      : Number.isInteger(hours)
        ? `${hours} 小时`
        : `${hours.toFixed(1)} 小时`;

  if (hours < 2) {
    const articles = Math.max(1, Math.floor(hours * 3));
    return `这周专注了 ${timeText}，相当于读了 ${articles} 篇长文章的时间 📚`;
  }

  const movies = Math.floor(hours / 2);
  return `这周专注了 ${timeText}，相当于看了 ${movies} 部电影的时间 🎬`;
}

export function groupCompletedTasks(completed) {
  const groups = new Map();

  completed.forEach((item) => {
    const key = item.name.trim().toLowerCase();
    const existing = groups.get(key);
    const date = new Date(item.completedAt);
    if (existing) {
      existing.count += 1;
      existing.minutes += item.minutes;
      existing.dates.push(date);
      return;
    }

    groups.set(key, {
      key,
      name: item.name,
      category: item.category,
      count: 1,
      minutes: item.minutes,
      dates: [date],
    });
  });

  return [...groups.values()]
    .map((group) => {
      const dates = group.dates.sort((a, b) => a - b);
      const firstDate = dates[0];
      const lastDate = dates[dates.length - 1];
      const firstDay = weekdayNames[firstDate.getDay()];
      const lastDay = weekdayNames[lastDate.getDay()];
      return {
        ...group,
        dateLabel: firstDate.toDateString() === lastDate.toDateString() ? `${firstDay}完成` : `${firstDay}至${lastDay}完成`,
        latestAt: lastDate.getTime(),
      };
    })
    .sort((a, b) => b.latestAt - a.latestAt);
}
