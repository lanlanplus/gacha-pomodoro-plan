import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFocusConfetti,
  createFocusDistractionController,
  createWakeLockController,
  getFocusCompletionState,
  getFocusTreeStage,
} from "./focusMode.js";

function createDocumentMock() {
  const listeners = new Map();
  return {
    visibilityState: "visible",
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    removeEventListener(name) {
      listeners.delete(name);
    },
    dispatch(name) {
      listeners.get(name)?.();
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

function createWindowMock() {
  const listeners = new Map();
  return {
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    removeEventListener(name) {
      listeners.delete(name);
    },
    dispatch(name) {
      listeners.get(name)?.();
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

test("builds restrained focus confetti using category colors and 6px to 12px sizes", () => {
  const pieces = buildFocusConfetti();
  assert.equal(pieces.length, 48);
  assert.equal(pieces.every((piece) => piece.size >= 6 && piece.size <= 12), true);
  assert.deepEqual(
    [...new Set(pieces.map((piece) => piece.color))],
    ["#4d7fd6", "#64a84f", "#f3b43f", "#1f9c95", "#d95f92"],
  );
});

test("advances the focus tree every five minutes and caps it at the fifth image", () => {
  const start = 25 * 60;
  assert.equal(getFocusTreeStage(start, start), 0);
  assert.equal(getFocusTreeStage(start, start - 299), 0);
  assert.equal(getFocusTreeStage(start, start - 300), 1);
  assert.equal(getFocusTreeStage(start, start - 1200), 4);
  assert.equal(getFocusTreeStage(start, 0), 4);
});

test("supports one-minute tree stages in development mode", () => {
  const start = 5 * 60;
  assert.equal(getFocusTreeStage(start, start, 60), 0);
  assert.equal(getFocusTreeStage(start, start - 59, 60), 0);
  assert.equal(getFocusTreeStage(start, start - 60, 60), 1);
  assert.equal(getFocusTreeStage(start, start - 240, 60), 4);
  assert.equal(getFocusTreeStage(start, 0, 60), 4);
});

test("restarts tree growth from stage one after the growth baseline is reset", () => {
  assert.equal(getFocusTreeStage(17 * 60, 17 * 60), 0);
  assert.equal(getFocusTreeStage(17 * 60, 12 * 60), 1);
});

test("reports hidden and visible focus-page transitions for distraction handling", () => {
  const documentObject = createDocumentMock();
  const windowObject = createWindowMock();
  let leaves = 0;
  let returns = 0;
  const controller = createFocusDistractionController({
    documentObject,
    windowObject,
    onLeave: () => {
      leaves += 1;
    },
    onReturn: () => {
      returns += 1;
    },
  });

  documentObject.visibilityState = "hidden";
  documentObject.dispatch("visibilitychange");
  documentObject.visibilityState = "visible";
  documentObject.dispatch("visibilitychange");
  windowObject.dispatch("pagehide");
  windowObject.dispatch("blur");

  assert.equal(leaves, 3);
  assert.equal(returns, 1);
  controller.destroy();
  assert.equal(documentObject.listenerCount(), 0);
  assert.equal(windowObject.listenerCount(), 0);
});

test("uses the distracted completion message and suppresses confetti", () => {
  assert.deepEqual(getFocusCompletionState(true, 25), {
    showConfetti: false,
    message: "完成了 25 分钟，下次试试全程专注 🌱",
  });
  assert.deepEqual(getFocusCompletionState(false, 25), {
    showConfetti: true,
    message: "专注了 25 分钟 🎉",
  });
});

test("requests and releases the screen wake lock without reacquiring while paused", async () => {
  const documentObject = createDocumentMock();
  let requests = 0;
  let releases = 0;
  const navigatorObject = {
    wakeLock: {
      async request(type) {
        assert.equal(type, "screen");
        requests += 1;
        return {
          addEventListener() {},
          async release() {
            releases += 1;
          },
        };
      },
    },
  };
  const controller = createWakeLockController({ navigatorObject, documentObject });

  await controller.activate();
  assert.equal(requests, 1);

  await controller.setRunning(false);
  documentObject.visibilityState = "hidden";
  documentObject.dispatch("visibilitychange");
  documentObject.visibilityState = "visible";
  documentObject.dispatch("visibilitychange");
  await Promise.resolve();
  assert.equal(requests, 1);

  await controller.release();
  assert.equal(releases, 1);
});

test("reacquires an automatically released lock when a running timer returns to the foreground", async () => {
  const documentObject = createDocumentMock();
  let requests = 0;
  let releaseListener;
  const navigatorObject = {
    wakeLock: {
      async request() {
        requests += 1;
        return {
          addEventListener(name, listener) {
            if (name === "release") releaseListener = listener;
          },
          async release() {},
        };
      },
    },
  };
  const controller = createWakeLockController({ navigatorObject, documentObject });

  await controller.activate();
  documentObject.visibilityState = "hidden";
  releaseListener();
  documentObject.dispatch("visibilitychange");
  documentObject.visibilityState = "visible";
  documentObject.dispatch("visibilitychange");
  await Promise.resolve();

  assert.equal(requests, 2);
  await controller.destroy();
});

test("silently tolerates browsers without Wake Lock support", async () => {
  const controller = createWakeLockController({
    navigatorObject: {},
    documentObject: createDocumentMock(),
  });
  await assert.doesNotReject(controller.activate());
  await assert.doesNotReject(controller.release());
});
