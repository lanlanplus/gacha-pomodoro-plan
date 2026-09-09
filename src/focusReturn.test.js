import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileFunction } from "node:vm";
import { transformSync } from "esbuild";
import React from "react";
import { appHarness } from "./focusTestHarness.js";
import * as timer from "./focusSession.js";
import { buildFocusConfetti, getFocusCompletionState } from "./focusMode.js";

function finishedScreen(onAbandon) {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  const source = app.slice(app.indexOf("function FocusMode("), app.indexOf("function CurrentPanel("));
  const code = transformSync(source, { loader: "jsx" }).code;
  const component = compileFunction(`${code}; return FocusMode;`, ["React", "useState", "useMemo", "categoryById", "buildFocusConfetti", "getFocusCompletionState"])(
    React, (value) => [value, () => {}], (fn) => fn(), () => ({ name: "学习" }), buildFocusConfetti, getFocusCompletionState,
  );
  return component({ current: { name: "读书", category: "study" }, timerFinished: true, timerMinutes: 25, treeStage: 4, onAbandon });
}
function findReturnButton(node) {
  if (!node || typeof node !== "object") return null;
  if (node.type === "button" && node.props.children === "放回扭蛋机") return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const found = findReturnButton(child);
    if (found) return found;
  }
  return null;
}

test("结束画面的放回按钮独立验证：确认放弃清除持久时间，保留任务，不生成完成记录", () => {
  const c = appHarness();
  const now = Date.now();
  c.finishTimer(timer.advanceFocusSession(timer.startFocusSession("a", 25, now - 25 * 60000), now));
  const button = findReturnButton(finishedScreen(c.abandonFocusTask));
  assert.ok(button, "结束画面必须可操作放回按钮");
  button.props.onClick();
  assert.equal(c.state.current, null);
  assert.equal(c.state.tasks.length, 1);
  assert.equal(c.state.completed.length, 0);
  assert.equal(c.logs.length, 0);
  assert.equal(c.focusSessionRef.current, null);
  assert.equal(c.localStorage.getItem(timer.focusSessionKey("test")), null);
});

test("取消放回确认不清除已结束会话，之后仍可正常完成", () => {
  const c = appHarness();
  const now = Date.now();
  c.finishTimer(timer.advanceFocusSession(timer.startFocusSession("a", 25, now - 25 * 60000), now));
  c.confirm = () => false;
  findReturnButton(finishedScreen(c.abandonFocusTask)).props.onClick();
  assert.ok(c.state.current);
  assert.equal(c.focusSessionRef.current.endsAt, now);
  assert.equal(c.logs.length, 0);
  c.completeCurrentTask();
  assert.equal(c.logs[0].completedAt, new Date(now).toISOString());
});
