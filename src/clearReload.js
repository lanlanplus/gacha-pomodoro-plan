export function buildClearReloadState(currentState) {
  return {
    tasks: [],
    completed: [],
    dailyDraws: [],
    dailyTarget: currentState.dailyTarget,
    specialEnabled: currentState.specialEnabled,
    current: null,
    quickNotes: currentState.quickNotes || [],
  };
}

export function resetDrawTransientState({
  cancelPendingDraw,
  setPendingPrize,
  setDrawInProgress,
  setDrawPhase,
}) {
  cancelPendingDraw();
  setPendingPrize(null);
  setDrawInProgress(false);
  setDrawPhase("idle");
}
