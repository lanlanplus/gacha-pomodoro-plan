const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

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
