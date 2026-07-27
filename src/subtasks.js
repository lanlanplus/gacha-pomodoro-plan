export function makeSubtask(text) {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

export function makeQuickNote(text, category) {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    category,
    createdAt: new Date().toISOString(),
  };
}

export function normalizeSubtasks(value) {
  return Array.isArray(value)
    ? value
        .filter((item) => item && typeof item.text === "string" && item.text.trim())
        .map((item) => ({
          id: item.id || crypto.randomUUID(),
          text: item.text.trim(),
          completed: Boolean(item.completed),
          createdAt: item.createdAt || new Date().toISOString(),
        }))
    : [];
}

export function normalizeQuickNotes(value, validCategories) {
  const fallbackCategory = validCategories[0];
  const notes = Array.isArray(value)
    ? value
        .filter((item) => item && typeof item.text === "string" && item.text.trim())
        .map((item) => ({
          id: item.id || crypto.randomUUID(),
          text: item.text.trim(),
          category: validCategories.includes(item.category) ? item.category : fallbackCategory,
          createdAt: item.createdAt || new Date().toISOString(),
        }))
    : [];
  return notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function toggleSubtaskInState(state, taskId, subtaskId) {
  const toggle = (items) =>
    normalizeSubtasks(items).map((item) =>
      item.id === subtaskId ? { ...item, completed: !item.completed } : item,
    );

  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId ? { ...task, subtasks: toggle(task.subtasks) } : task,
    ),
    current:
      state.current?.id === taskId
        ? { ...state.current, subtasks: toggle(state.current.subtasks) }
        : state.current,
  };
}

export function settleCompletedTask(state, current, completion) {
  const unfinished = normalizeSubtasks(current.subtasks).filter((item) => !item.completed);
  const remainingTasks = state.tasks.filter((task) => task.id !== current.id);
  const sameNameIndex = remainingTasks.findIndex(
    (task) => task.name.trim().toLocaleLowerCase() === current.name.trim().toLocaleLowerCase(),
  );

  if (unfinished.length && sameNameIndex >= 0) {
    const target = remainingTasks[sameNameIndex];
    remainingTasks[sameNameIndex] = {
      ...target,
      subtasks: [...normalizeSubtasks(target.subtasks), ...unfinished],
    };
  }

  const returnedNotes =
    unfinished.length && sameNameIndex < 0
      ? unfinished.map((item) => ({
          id: item.id,
          text: item.text,
          category: current.category,
          createdAt: new Date().toISOString(),
        }))
      : [];

  return {
    ...state,
    tasks: remainingTasks,
    quickNotes: [...returnedNotes, ...(state.quickNotes || [])],
    completed: [...state.completed, completion],
    current: null,
  };
}
