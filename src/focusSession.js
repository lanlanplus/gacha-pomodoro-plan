const maxDurationMs = 120 * 60 * 1000;
export const focusSessionKey = (owner) => `gacha-focus-session-v1:${owner}`;

export function validateFocusSession(value, now = Date.now()) {
  if (!value || value.version !== 1 || typeof value.taskId !== "string" ||
      !Number.isFinite(value.durationMs) || value.durationMs < 60000 || value.durationMs > maxDurationMs ||
      !Number.isFinite(value.remainingMs) || value.remainingMs < 0 || value.remainingMs > value.durationMs ||
      !["running", "paused", "finished"].includes(value.status)) return null;
  if (value.status !== "paused" && (!Number.isFinite(value.endsAt) || value.endsAt <= 0 ||
      value.endsAt > now + maxDurationMs || !Number.isFinite(new Date(value.endsAt).getTime()))) return null;
  if (value.status === "finished" && (value.remainingMs !== 0 || value.endsAt > now)) return null;
  return value;
}

export function startFocusSession(taskId, minutes, now = Date.now()) {
  const durationMs = Math.min(120, Math.max(1, Number(minutes) || 25)) * 60000;
  return { version: 1, taskId, durationMs, remainingMs: durationMs, status: "running", endsAt: now + durationMs };
}

export function advanceFocusSession(session, now = Date.now()) {
  if (session.status !== "running") return session;
  const remainingMs = Math.max(0, Math.min(session.durationMs, session.endsAt - now));
  return { ...session, remainingMs, status: remainingMs === 0 ? "finished" : "running" };
}

export function pauseFocusSession(session, now = Date.now()) {
  const next = advanceFocusSession(session, now);
  return next.status === "finished" ? next : { ...next, status: "paused", endsAt: null };
}

export function resumeFocusSession(session, now = Date.now()) {
  return session.status === "paused" ? { ...session, status: "running", endsAt: now + session.remainingMs } : session;
}

export function completionFromFocusSession(session, now = Date.now()) {
  const valid = validateFocusSession(session, now);
  if (!valid) return { completedAt: new Date(now).toISOString(), minutes: 1, usedFallback: true };
  const next = advanceFocusSession(valid, now);
  const finished = next.status === "finished";
  return {
    completedAt: new Date(finished ? next.endsAt : now).toISOString(),
    minutes: finished ? next.durationMs / 60000 : Math.max(1, Math.round((next.durationMs - next.remainingMs) / 60000)),
    usedFallback: false,
  };
}

export function readFocusSession(storage, owner, now = Date.now()) {
  try {
    return validateFocusSession(JSON.parse(storage.getItem(focusSessionKey(owner))), now);
  } catch {
    return null;
  }
}

export function saveFocusSession(storage, owner, session) {
  if (session) storage.setItem(focusSessionKey(owner), JSON.stringify(session));
  else storage.removeItem(focusSessionKey(owner));
}
