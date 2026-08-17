const shanghaiOffsetMilliseconds = 8 * 60 * 60 * 1000;
const dayMilliseconds = 24 * 60 * 60 * 1000;

export function getLastCompletedShanghaiWeek(now = new Date()) {
  const shanghaiNow = new Date(now.getTime() + shanghaiOffsetMilliseconds);
  const day = shanghaiNow.getUTCDay() || 7;
  const currentMondayUtc = Date.UTC(
    shanghaiNow.getUTCFullYear(),
    shanghaiNow.getUTCMonth(),
    shanghaiNow.getUTCDate() - day + 1,
  );
  const endMilliseconds = currentMondayUtc - shanghaiOffsetMilliseconds;
  const startMilliseconds = endMilliseconds - 7 * dayMilliseconds;
  const weekStartDate = new Date(startMilliseconds + shanghaiOffsetMilliseconds)
    .toISOString()
    .slice(0, 10);

  return {
    weekStartDate,
    startIso: new Date(startMilliseconds).toISOString(),
    endIso: new Date(endMilliseconds).toISOString(),
  };
}

export function buildWeeklySnapshotRow(userState, aggregate, weekStartDate) {
  const pendingCount = Array.isArray(userState.app_state?.tasks)
    ? userState.app_state.tasks.length
    : 0;
  const completedCount = aggregate?.completedCount || 0;
  const totalCount = pendingCount + completedCount;

  return {
    user_id: userState.user_id,
    week_start_date: weekStartDate,
    completed_count: completedCount,
    total_count: totalCount,
    completion_rate: totalCount
      ? Math.round((completedCount / totalCount) * 100)
      : 100,
    focus_minutes: aggregate?.focusMinutes || 0,
  };
}
