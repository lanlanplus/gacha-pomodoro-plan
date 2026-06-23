export function createRuntimeConfig(isDevelopment = false) {
  return {
    initialTimerMinutes: isDevelopment ? 5 : 25,
    treeStageSeconds: (isDevelopment ? 1 : 5) * 60,
  };
}

export const runtimeConfig = createRuntimeConfig(Boolean(import.meta.env?.DEV));
