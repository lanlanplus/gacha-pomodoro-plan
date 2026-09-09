import test from "node:test";
import assert from "node:assert/strict";
import * as timer from "./focusSession.js";
import { appHarness } from "./focusTestHarness.js";

test("真实完成处理函数：延迟点击仍向本地与日志写入相同结束时间和固定分钟", () => {
  const c = appHarness();
  const endedAt = Date.now() - 3600000;
  c.finishTimer(timer.advanceFocusSession(timer.startFocusSession("a", 25, endedAt - 25 * 60000), endedAt));
  c.completeCurrentTask();
  assert.equal(c.state.completed[0].completedAt, new Date(endedAt).toISOString());
  assert.equal(c.state.completed[0].minutes, 25);
  assert.equal(c.logs[0].completedAt, c.state.completed[0].completedAt);
  assert.equal(c.logs[0].minutes, 25);
  assert.equal(c.focusSessionRef.current, null);
  assert.equal(c.localStorage.getItem(timer.focusSessionKey("test")), null);
});

test("真实完成处理函数：提前完成按已运行分钟计，不使用陈旧界面剩余值", () => {
  const c = appHarness();
  c.persistFocusSession(timer.startFocusSession("a", 25, Date.now() - 8 * 60000));
  c.completeCurrentTask();
  assert.equal(c.logs[0].minutes, 8);
});

test("实际恢复 effect：重新加载后恢复结束画面与原定结束时间", async () => {
  const { readFileSync } = await import("node:fs");
  const { compileFunction } = await import("node:vm");
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  const begin = app.indexOf("  useEffect(() => {\n    if (authLoading || !remoteReady)");
  const end = app.indexOf("\n\n  useEffect", begin);
  const c = appHarness();
  const endedAt = Date.now() - 3600000;
  timer.saveFocusSession(c.localStorage, "test", timer.startFocusSession("a", 25, endedAt - 25 * 60000));
  c.state.current = null;
  c.authLoading = false;
  c.remoteReady = true;
  c.session = { user: { id: "test" } };
  c.restoredFocusOwnerRef.current = null;
  c.useEffect = (fn) => fn();
  compileFunction(`with (context) { ${app.slice(begin, end)} }`, ["context"])(c);
  assert.equal(c.state.current.id, "a");
  assert.equal(c.TimerFinished, true);
  assert.equal(c.FocusMode, true);
  assert.equal(c.TimerRemaining, 0);
  c.completeCurrentTask();
  assert.equal(c.logs[0].completedAt, new Date(endedAt).toISOString());
});
