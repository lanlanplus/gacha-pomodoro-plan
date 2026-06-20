const focusColors = ["#4d7fd6", "#64a84f", "#f3b43f", "#1f9c95", "#d95f92"];

export function buildFocusConfetti(count = 48) {
  return Array.from({ length: count }, (_, index) => {
    const size = 6 + ((index * 5) % 7);
    return {
      x: 2 + ((index * 19) % 96),
      size,
      height: index % 3 === 0 ? size : Math.max(6, Math.round(size * 0.66)),
      delay: (index % 7) * 0.035,
      duration: 2.15 + ((index % 5) * 0.05),
      drift: (index % 2 === 0 ? 1 : -1) * (18 + ((index * 13) % 54)),
      rotate: (index * 47) % 180,
      color: focusColors[index % focusColors.length],
      round: index % 4 === 0,
    };
  });
}

export function createWakeLockController({
  navigatorObject = globalThis.navigator,
  documentObject = globalThis.document,
} = {}) {
  let sentinel = null;
  let active = false;
  let running = false;
  let destroyed = false;

  async function request() {
    if (
      destroyed ||
      !active ||
      !running ||
      sentinel ||
      documentObject?.visibilityState === "hidden" ||
      !navigatorObject?.wakeLock?.request
    ) {
      return;
    }

    try {
      const nextSentinel = await navigatorObject.wakeLock.request("screen");
      if (destroyed || !active) {
        await nextSentinel.release?.();
        return;
      }

      sentinel = nextSentinel;
      nextSentinel.addEventListener?.("release", () => {
        if (sentinel === nextSentinel) sentinel = null;
      });
    } catch {
      // Wake Lock is optional. Unsupported or denied requests must not affect the timer.
    }
  }

  async function release() {
    active = false;
    running = false;
    const currentSentinel = sentinel;
    sentinel = null;
    try {
      await currentSentinel?.release?.();
    } catch {
      // The browser may already have released the lock while the page was hidden.
    }
  }

  function handleVisibilityChange() {
    if (documentObject?.visibilityState === "visible" && active && running) {
      void request();
    }
  }

  documentObject?.addEventListener?.("visibilitychange", handleVisibilityChange);

  return {
    activate() {
      active = true;
      running = true;
      return request();
    },
    setRunning(nextRunning) {
      running = nextRunning;
      return nextRunning ? request() : Promise.resolve();
    },
    release,
    async destroy() {
      destroyed = true;
      documentObject?.removeEventListener?.("visibilitychange", handleVisibilityChange);
      await release();
    },
  };
}
