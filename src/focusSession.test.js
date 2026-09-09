import test from "node:test";
import assert from "node:assert/strict";
import * as timer from "./focusSession.js";
const start = Date.parse("2026-09-09T23:40:00+08:00");
const minute = 60000;

function storage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}

test("正常结束立即完成与一小时后完成，时间和分钟完全一致", () => {
  const session = timer.startFocusSession("a", 25, start);
  const finished = timer.advanceFocusSession(session, start + 25 * minute);
  const immediate = timer.completionFromFocusSession(finished, start + 25 * minute);
  const delayed = timer.completionFromFocusSession(finished, start + 85 * minute);
  assert.deepEqual(immediate, delayed);
  assert.equal(immediate.minutes, 25);
  assert.equal(immediate.completedAt, new Date(start + 25 * minute).toISOString());
});

test("无任何后台 tick，完全丢失内存后从持久化数据恢复到理论结束时刻", () => {
  const disk = storage();
  timer.saveFocusSession(disk, "user", timer.startFocusSession("a", 25, start));
  const restored = timer.readFocusSession(disk, "user", start + 90 * minute);
  assert.equal(timer.advanceFocusSession(restored, start + 90 * minute).status, "finished");
  assert.equal(timer.completionFromFocusSession(restored, start + 90 * minute).completedAt, new Date(start + 25 * minute).toISOString());
  assert.equal(timer.readFocusSession(disk, "other", start + 90 * minute), null);
});

test("暂停冻结剩余时间，杀进程重开后仍暂停；恢复后排除暂停时长", () => {
  const disk = storage();
  const paused = timer.pauseFocusSession(timer.startFocusSession("a", 25, start), start + 10 * minute);
  timer.saveFocusSession(disk, "user", paused);
  const restored = timer.readFocusSession(disk, "user", start + 70 * minute);
  assert.equal(restored.remainingMs, 15 * minute);
  assert.equal(restored.status, "paused");
  const resumed = timer.resumeFocusSession(restored, start + 70 * minute);
  const completed = timer.completionFromFocusSession(resumed, start + 100 * minute);
  assert.equal(completed.completedAt, new Date(start + 85 * minute).toISOString());
  assert.equal(completed.minutes, 25);
});

test("提前手动完成按有效运行时间计算，不把暂停的一个小时算入", () => {
  const paused = timer.pauseFocusSession(timer.startFocusSession("a", 25, start), start + 5 * minute);
  const resumed = timer.resumeFocusSession(paused, start + 65 * minute);
  const completed = timer.completionFromFocusSession(resumed, start + 68 * minute);
  assert.equal(completed.minutes, 8);
  assert.equal(completed.completedAt, new Date(start + 68 * minute).toISOString());
});

test("损坏、负数及明显异常未来时间安全回退；合法过期时间仍可恢复", () => {
  const session = timer.startFocusSession("a", 25, start);
  for (const invalid of [null, {}, { ...session, endsAt: -1 }, { ...session, endsAt: start + 121 * minute }, { ...session, remainingMs: NaN }]) {
    assert.equal(timer.validateFocusSession(invalid, start), null);
    assert.equal(timer.completionFromFocusSession(invalid, start).completedAt, new Date(start).toISOString());
  }
  assert.ok(timer.validateFocusSession(session, start + 86400000));
  const disk = storage();
  disk.setItem(timer.focusSessionKey("user"), "broken json");
  assert.equal(timer.readFocusSession(disk, "user", start), null);
});
