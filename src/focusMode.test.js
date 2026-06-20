import assert from "node:assert/strict";
import test from "node:test";
import { buildFocusConfetti, createWakeLockController } from "./focusMode.js";

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
