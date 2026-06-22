import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildFocusConfetti, createWakeLockController } from "./focusMode.js";
import { chooseTask, isoWeekKey, todayKey } from "./planning.js";
import {
  getTaskHistorySuggestions,
  normalizeTaskHistory,
  recordTaskHistory,
} from "./taskHistory.js";
import {
  activeCategoryStats,
  buildCategoryStats,
  buildFocusStory,
  buildWeeklyHighlights,
  buildWeeklyMessage,
  groupCompletedTasks,
} from "./weeklySummary.js";
import { groupTaskPool } from "./taskGroups.js";

const categories = [
  { id: "work", name: "工作", color: "#4d7fd6" },
  { id: "health", name: "健康", color: "#64a84f" },
  { id: "study", name: "学习", color: "#f3b43f" },
  { id: "life", name: "生活", color: "#1f9c95" },
  { id: "creative", name: "创意", color: "#d95f92" },
];

const specials = [
  { icon: "☕", name: "自由时间", text: "给自己一段不带内疚感的空白。" },
  { icon: "🎉", name: "小奖励", text: "完成到这里很可以，领一个小奖励。" },
  { icon: "🔀", name: "自选任务", text: "这次由你挑一颗最想做的球。" },
  { icon: "⏭", name: "跳过券", text: "保留精力，跳过当前阻力最大的事。" },
];

const storageKey = "gacha-pomodoro-week-plan";
const weekendCategoriesKey = "gacha-pomodoro-weekend-categories";
const taskHistoryKey = "gacha-pomodoro-task-history";
const mondayTipKeyPrefix = "gacha-pomodoro-monday-tip";
const initialTimerMinutes = 25;
const defaultDailyTarget = 3;
const minDailyTarget = 1;
const maxDailyTarget = 16;
const celebrationDuration = 4200;

const ballLayouts = [
  { left: 2, top: 58, size: 24, rotate: -14 },
  { left: 20, top: 68, size: 22, rotate: 18 },
  { left: 39, top: 57, size: 27, rotate: -7 },
  { left: 61, top: 67, size: 22, rotate: 22 },
  { left: 75, top: 54, size: 25, rotate: -21 },
  { left: 8, top: 35, size: 22, rotate: 11 },
  { left: 29, top: 34, size: 25, rotate: -19 },
  { left: 53, top: 39, size: 22, rotate: 16 },
  { left: 72, top: 29, size: 24, rotate: -8 },
  { left: 17, top: 13, size: 23, rotate: 20 },
  { left: 43, top: 10, size: 26, rotate: -13 },
  { left: 1, top: 79, size: 21, rotate: 25 },
  { left: 56, top: 81, size: 24, rotate: -17 },
  { left: 79, top: 78, size: 21, rotate: 9 },
  { left: 33, top: 82, size: 22, rotate: -24 },
  { left: 1, top: 17, size: 24, rotate: 7 },
  { left: 79, top: 8, size: 21, rotate: -16 },
  { left: 48, top: 62, size: 23, rotate: 13 },
];

const ballAssets = {
  work: "/assets/task-ball-blue.png",
  health: "/assets/task-ball-mint.png",
  study: "/assets/task-ball-yellow.png",
  life: "/assets/task-ball-purple.png",
  creative: "/assets/task-ball-pink.png",
};

function makeTask(name, category, dailyExclusive = false) {
  return {
    id: crypto.randomUUID(),
    name,
    category,
    dailyExclusive,
    createdAt: new Date().toISOString(),
  };
}

function seedState() {
  return {
    tasks: [
      makeTask("规划本周三个关键结果", "work"),
      makeTask("有氧运动", "health"),
      makeTask("有氧运动", "health"),
      makeTask("读 20 页书", "study"),
      makeTask("整理房间 15 分钟", "life"),
      makeTask("写一个小点子", "creative"),
    ],
    completed: [],
    dailyDraws: [],
    dailyTarget: defaultDailyTarget,
    specialEnabled: true,
    current: null,
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    return normalizeState(parsed);
  } catch {
    return seedState();
  }
}

function loadWeekendCategories() {
  try {
    const parsed = JSON.parse(localStorage.getItem(weekendCategoriesKey));
    const validIds = categories.map((category) => category.id);
    const selected = Array.isArray(parsed) ? parsed.filter((id) => validIds.includes(id)) : validIds;
    return selected.length ? selected : [];
  } catch {
    return categories.map((category) => category.id);
  }
}

function loadTaskHistory() {
  try {
    return normalizeTaskHistory(JSON.parse(localStorage.getItem(taskHistoryKey)));
  } catch {
    return [];
  }
}

function categoryById(id) {
  return categories.find((category) => category.id === id) || categories[0];
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function taskKey(name) {
  return name.trim().toLowerCase();
}

function normalizeState(parsed) {
  const seeded = seedState();
  const state = parsed ? { ...seeded, ...parsed } : seeded;
  return {
    ...state,
    dailyDraws: Array.isArray(state.dailyDraws) ? state.dailyDraws : [],
    tasks: Array.isArray(state.tasks)
      ? state.tasks.map((task) => ({ dailyExclusive: false, ...task }))
      : seeded.tasks,
    dailyTarget: Math.min(
      maxDailyTarget,
      Math.max(minDailyTarget, Number(state.dailyTarget) || defaultDailyTarget),
    ),
  };
}

function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function buildPrizePieces() {
  const colors = ["#ef5b53", "#f3b43f", "#1f9c95", "#4d7fd6", "#d95f92", "#ffffff"];
  const fireworks = [
    { x: 22, y: 26, delay: 0.1 },
    { x: 75, y: 24, delay: 0.22 },
    { x: 50, y: 12, delay: 0.34 },
    { x: 14, y: 62, delay: 0.48 },
    { x: 84, y: 60, delay: 0.62 },
  ];
  const confetti = Array.from({ length: 54 }, (_, index) => ({
    x: 5 + ((index * 17) % 90),
    delay: 0.08 + ((index % 9) * 0.055),
    drift: (index % 2 === 0 ? 1 : -1) * (18 + ((index * 11) % 48)),
    rotate: (index * 31) % 180,
    color: colors[index % colors.length],
  }));

  return {
    fireworks: fireworks.map((item, index) => ({ ...item, color: colors[index % colors.length] })),
    confetti,
  };
}

export default function App() {
  const navItems = [
    ["machine", "◎", "摇蛋机"],
    ["add", "＋", "添加任务"],
    ["progress", "▦", "进度"],
    ["summary", "◷", "周总结"],
  ];
  const [view, setView] = useState("machine");
  const [state, setState] = useState(loadState);
  const [currentDate, setCurrentDate] = useState(todayKey);
  const [weekendCategories, setWeekendCategories] = useState(loadWeekendCategories);
  const [showMondayTip, setShowMondayTip] = useState(false);
  const [notice, setNotice] = useState("");
  const [machineMode, setMachineMode] = useState(() => (state.current ? "current" : "draw"));
  const [taskName, setTaskName] = useState("");
  const [taskCategory, setTaskCategory] = useState(categories[0].id);
  const [taskCount, setTaskCount] = useState(1);
  const [taskDailyExclusive, setTaskDailyExclusive] = useState(false);
  const [taskHistory, setTaskHistory] = useState(loadTaskHistory);
  const [showTaskSuggestions, setShowTaskSuggestions] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(initialTimerMinutes);
  const [timerRemaining, setTimerRemaining] = useState(initialTimerMinutes * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const [elapsedBeforeStart, setElapsedBeforeStart] = useState(0);
  const [drawInProgress, setDrawInProgress] = useState(false);
  const [drawPhase, setDrawPhase] = useState("idle");
  const [finishPieces, setFinishPieces] = useState({ fireworks: [], confetti: [] });
  const [showFinishCelebration, setShowFinishCelebration] = useState(false);
  const [pendingPrize, setPendingPrize] = useState(null);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(null);
  const audioRef = useRef(null);
  const wakeLockControllerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const controller = createWakeLockController();
    wakeLockControllerRef.current = controller;
    return () => {
      wakeLockControllerRef.current = null;
      void controller.destroy();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(weekendCategoriesKey, JSON.stringify(weekendCategories));
  }, [weekendCategories]);

  useEffect(() => {
    localStorage.setItem(taskHistoryKey, JSON.stringify(taskHistory));
  }, [taskHistory]);

  useEffect(() => {
    const checkDate = () => {
      const nextDate = todayKey();
      if (nextDate !== currentDate) setCurrentDate(nextDate);
    };
    const interval = window.setInterval(checkDate, 60000);
    return () => window.clearInterval(interval);
  }, [currentDate]);

  useEffect(() => {
    const now = new Date();
    if (now.getDay() !== 1) return;
    const tipKey = `${mondayTipKeyPrefix}-${isoWeekKey(now)}`;
    if (!localStorage.getItem(tipKey)) setShowMondayTip(true);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    startedAtRef.current = Date.now();
    intervalRef.current = window.setInterval(() => {
      setTimerRemaining((remaining) => {
        if (remaining <= 1) {
          finishTimer();
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalRef.current);
    };
  }, [timerRunning]);

  const weekStats = useMemo(() => {
    const total = state.tasks.length + state.completed.length;
    const done = state.completed.length;
    const percent = total ? Math.round((done / total) * 100) : 100;
    return { total, done, percent };
  }, [state.tasks.length, state.completed.length]);

  const summaryTotal = useMemo(
    () => state.completed.reduce((sum, item) => sum + item.minutes, 0),
    [state.completed],
  );
  const categoryStats = useMemo(
    () => buildCategoryStats(categories, state.tasks, state.completed),
    [state.tasks, state.completed],
  );
  const weeklyMessage = useMemo(
    () => buildWeeklyMessage(weekStats.percent, categoryStats),
    [weekStats.percent, categoryStats],
  );
  const completedToday = useMemo(
    () =>
      state.completed.filter((item) => new Date(item.completedAt).toLocaleDateString("en-CA") === currentDate).length,
    [state.completed, currentDate],
  );
  const suggestedToday = state.dailyTarget;
  const todayGoalReached = completedToday >= suggestedToday;
  const todayProgress = suggestedToday
    ? Math.min(100, Math.round((completedToday / suggestedToday) * 100))
    : 100;

  function resetTimer(minutes = timerMinutes) {
    const safeMinutes = Math.min(120, Math.max(1, Number(minutes) || initialTimerMinutes));
    stopTimer();
    setTimerMinutes(safeMinutes);
    setTimerRemaining(safeMinutes * 60);
    setTimerFinished(false);
    setElapsedBeforeStart(0);
  }

  function stopTimer() {
    window.clearInterval(intervalRef.current);
    setTimerRunning(false);
    void wakeLockControllerRef.current?.setRunning(false);
    if (startedAtRef.current) {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedBeforeStart((value) => value + elapsed);
      startedAtRef.current = null;
    }
  }

  function getAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!audioRef.current) audioRef.current = new AudioContext();
    if (audioRef.current.state === "suspended") audioRef.current.resume();
    return audioRef.current;
  }

  function playTone(frequency, start, duration, type = "sine", volume = 0.12) {
    const context = getAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
    gain.gain.setValueAtTime(0.001, context.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + start);
    oscillator.stop(context.currentTime + start + duration + 0.03);
  }

  function playSound(kind) {
    if (kind === "turn") {
      [170, 205, 185, 230, 200, 260].forEach((frequency, index) =>
        playTone(frequency, index * 0.075, 0.075, "square", 0.055),
      );
    }
    if (kind === "drop") {
      playTone(220, 0, 0.18, "sine", 0.08);
      playTone(105, 0.16, 0.16, "triangle", 0.13);
    }
    if (kind === "click") {
      [560, 760].forEach((frequency, index) => playTone(frequency, index * 0.045, 0.13, "triangle", 0.09));
    }
    if (kind === "finish") {
      [392, 523, 659, 784, 1046].forEach((frequency, index) => playTone(frequency, index * 0.1, 0.28, "triangle", 0.11));
    }
  }

  function finishTimer() {
    stopTimer();
    void wakeLockControllerRef.current?.release();
    setTimerRemaining(0);
    setTimerFinished(true);
    playSound("finish");
  }

  function startTimer() {
    if (!state.current || state.current.kind !== "task") return;
    getAudioContext();
    void wakeLockControllerRef.current?.activate();
    setFocusMode(true);
    setTimerFinished(false);
    if (!timerRunning) setTimerRunning(true);
  }

  function drawTask() {
    if (drawInProgress) return;
    stopTimer();
    setMachineMode("draw");
    playSound("turn");
    const getsSpecial = state.specialEnabled && Math.random() < 0.08;
    const selectedPrize = getsSpecial
      ? { kind: "special", ...pick(specials) }
      : state.tasks.length
        ? (() => {
            const result = chooseTask({
              tasks: state.tasks,
              dailyDraws: state.dailyDraws,
              suggestedToday,
              weekendCategories,
            });
            if (result?.weekendFallback) {
              setNotice("你选择的周末类别已完成，从所有任务里随机啦");
            }
            return result?.task ? { kind: "task", ...result.task } : null;
          })()
        : null;

    setDrawInProgress(true);
    setDrawPhase("turning");
    setPendingPrize(selectedPrize);
    setState((currentState) => ({ ...currentState, current: null }));

    window.setTimeout(() => {
      resetTimer(timerMinutes);
      if (selectedPrize) {
        setDrawPhase("dropping");
        playSound("drop");
        window.setTimeout(() => setDrawPhase("prize"), 760);
      } else {
        setDrawPhase("idle");
        setDrawInProgress(false);
      }
    }, 620);
  }

  function openPrizeBall() {
    if (drawPhase !== "prize") return;
    playSound("click");
    setState((currentState) => ({
      ...currentState,
      current: pendingPrize,
      dailyDraws:
        pendingPrize?.kind === "task"
          ? [
              ...(currentState.dailyDraws || []).filter((item) => item.date === todayKey()).slice(-80),
              {
                date: todayKey(),
                key: taskKey(pendingPrize.name),
                taskId: pendingPrize.id,
                category: pendingPrize.category,
              },
            ]
          : currentState.dailyDraws,
    }));
    if (pendingPrize) setMachineMode("current");
    setPendingPrize(null);
    setDrawPhase("idle");
    setDrawInProgress(false);
  }

  function chooseTaskDirectly(task) {
    stopTimer();
    resetTimer(timerMinutes);
    setDrawInProgress(false);
    setDrawPhase("idle");
    setPendingPrize(null);
    setState((currentState) => ({
      ...currentState,
      current: { kind: "task", ...task },
      dailyDraws: [
        ...(currentState.dailyDraws || []).filter((item) => item.date === todayKey()).slice(-80),
        { date: todayKey(), key: taskKey(task.name), taskId: task.id, category: task.category },
      ],
    }));
    setMachineMode("current");
    setView("machine");
  }

  function addTasks(event) {
    event.preventDefault();
    const cleanName = taskName.trim();
    const count = Math.min(20, Math.max(1, Number(taskCount) || 1));
    if (!cleanName) return;

    setState((currentState) => ({
      ...currentState,
      tasks: [
        ...currentState.tasks,
        ...Array.from({ length: count }, () => makeTask(cleanName, taskCategory, taskDailyExclusive)),
      ],
    }));
    setTaskHistory((history) => recordTaskHistory(history, cleanName, taskCategory));
    setTaskName("");
    setTaskCount(1);
    setTaskDailyExclusive(false);
    setShowTaskSuggestions(false);
  }

  function completeCurrentTask() {
    const current = state.current;
    if (!current || current.kind !== "task") return;
    stopTimer();
    void wakeLockControllerRef.current?.release();
    const elapsed = Math.max(elapsedBeforeStart, timerMinutes * 60 - timerRemaining);
    const minutes = Math.max(1, Math.round(elapsed / 60));

    setState((currentState) => ({
      ...currentState,
      tasks: currentState.tasks.filter((task) => task.id !== current.id),
      completed: [
        ...currentState.completed,
        {
          id: current.id,
          name: current.name,
          category: current.category,
          minutes,
          completedAt: new Date().toISOString(),
        },
      ],
      current: null,
    }));
    setFocusMode(false);
    setTimerFinished(false);
    setView("machine");
    setMachineMode("draw");
    resetTimer(timerMinutes);
  }

  function resetWeek() {
    if (!confirm("开启新一周会清空当前任务池和本周总结。确定继续吗？")) return;
    stopTimer();
    setState((currentState) => ({
      tasks: [],
      completed: [],
      dailyDraws: [],
      dailyTarget: currentState.dailyTarget,
      specialEnabled: currentState.specialEnabled,
      current: null,
    }));
    setMachineMode("draw");
    resetTimer(timerMinutes);
  }

  function claimSpecial() {
    setState((currentState) => ({ ...currentState, current: null }));
    setMachineMode("draw");
  }

  function clearCompleted() {
    setState((currentState) => ({ ...currentState, completed: [] }));
  }

  function toggleWeekendCategory(categoryId) {
    setWeekendCategories((selected) =>
      selected.includes(categoryId)
        ? selected.filter((id) => id !== categoryId)
        : [...selected, categoryId],
    );
  }

  function closeMondayTip() {
    localStorage.setItem(`${mondayTipKeyPrefix}-${isoWeekKey()}`, "shown");
    setShowMondayTip(false);
  }

  const timerText = `${Math.floor(timerRemaining / 60).toString().padStart(2, "0")}:${Math.floor(
    timerRemaining % 60,
  )
    .toString()
    .padStart(2, "0")}`;
  const showCurrentPanel = machineMode === "current" && state.current;
  const taskSuggestions = useMemo(
    () => getTaskHistorySuggestions(taskHistory, taskName),
    [taskHistory, taskName],
  );

  function selectTaskSuggestion(suggestion) {
    setTaskName(suggestion.name);
    setTaskCategory(suggestion.category);
    setShowTaskSuggestions(false);
  }

  function returnToMachine() {
    stopTimer();
    setMachineMode("draw");
  }

  function abandonFocusTask() {
    if (!confirm("放弃后这颗球会放回扭蛋机，确认放弃？")) return;
    stopTimer();
    void wakeLockControllerRef.current?.release();
    setFocusMode(false);
    setTimerFinished(false);
    setState((currentState) => ({ ...currentState, current: null }));
    setMachineMode("draw");
    setView("machine");
    resetTimer(timerMinutes);
  }

  function exitPausedFocus() {
    if (timerRunning) return;
    void wakeLockControllerRef.current?.release();
    setFocusMode(false);
  }

  if (focusMode && state.current?.kind === "task") {
    return (
      <FocusMode
        current={state.current}
        timerText={timerText}
        timerRunning={timerRunning}
        timerFinished={timerFinished}
        timerMinutes={timerMinutes}
        progressPercent={
          timerMinutes ? Math.max(0, Math.min(100, (timerRemaining / (timerMinutes * 60)) * 100)) : 0
        }
        onPause={stopTimer}
        onContinue={startTimer}
        onAbandon={abandonFocusTask}
        onExit={exitPausedFocus}
        onComplete={completeCurrentTask}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            ●
          </div>
          <div>
            <h1>扭蛋番茄</h1>
            <p>本周清空所有球</p>
          </div>
        </div>

        <div className="week-meter">
          <div className="meter-label">
            <span>本周完成</span>
            <strong>{weekStats.percent}%</strong>
          </div>
          <div className="meter-track">
            <div className="meter-fill" style={{ width: `${weekStats.percent}%` }} />
          </div>
          <p>
            {weekStats.done} / {weekStats.total} 颗球
          </p>
        </div>
      </aside>

      <main>
        <section id="machine" className={`view ${view === "machine" ? "active" : ""}`} aria-labelledby="machineTitle">
          <div className={`machine-layout ${showCurrentPanel ? "is-current" : "is-draw"}`}>
            {!showCurrentPanel && (
              <section className="machine-stage" aria-labelledby="machineTitle">
                <div className="stage-copy">
                  <div>
                    <p className="eyebrow">GACHA POMODORO</p>
                    <h2 id="machineTitle">扭出下一颗任务球</h2>
                    <div className={`today-rhythm ${todayGoalReached ? "is-complete" : ""}`}>
                      <span>
                        {todayGoalReached
                          ? "今日目标达成 ✓"
                          : `今天建议 ${suggestedToday} 颗 · 已完成 ${completedToday} 颗`}
                      </span>
                      <div className="today-progress-track" aria-hidden="true">
                        <div className="today-progress-fill" style={{ width: `${todayProgress}%` }} />
                      </div>
                    </div>
                  </div>
                  <button className="new-week-action" type="button" onClick={resetWeek}>
                    新一周
                  </button>
                </div>

                <div className="gacha-wrap">
                  <div
                    className={`gacha-machine ${drawInProgress ? "has-turned" : ""} ${
                      drawPhase === "turning" ? "turning" : ""
                    }`}
                  >
                    <div className="machine-ball-window" aria-hidden="true">
                      {state.tasks.slice(0, 18).map((task, index) => {
                        const layout = ballLayouts[index % ballLayouts.length];
                        return (
                          <img
                            key={task.id}
                            className="mini-ball"
                            src={ballAssets[task.category] || ballAssets.work}
                            alt=""
                            style={{
                              left: `${layout.left}%`,
                              top: `${layout.top}%`,
                              width: `${layout.size}%`,
                              "--base-rotate": `${layout.rotate}deg`,
                              "--i": index,
                            }}
                          />
                        );
                      })}
                    </div>
                    <img className="machine-art" src="/assets/gacha-machine.png" alt="薄荷绿色透明扭蛋机" />
                    <img className="machine-sticker" src="/assets/gacha-sticker.png" alt="" aria-hidden="true" />
                    <button
                      className="turn-knob"
                      type="button"
                      onClick={drawTask}
                      disabled={drawInProgress}
                      aria-label="扭一下抽取任务球"
                    >
                      <img src="/assets/gacha-knob.png" alt="" />
                    </button>
                    {(drawPhase === "dropping" || drawPhase === "prize") && pendingPrize && (
                      <button
                        className={`dropped-task-ball ${drawPhase === "prize" ? "ready" : ""}`}
                        type="button"
                        onClick={openPrizeBall}
                        disabled={drawPhase !== "prize"}
                        aria-label={drawPhase === "prize" ? "点击任务球查看任务" : "任务球正在掉落"}
                      >
                        <img
                          src={
                            pendingPrize.kind === "task"
                              ? ballAssets[pendingPrize.category] || ballAssets.work
                              : ballAssets.study
                          }
                          alt=""
                        />
                      </button>
                    )}
                  </div>
                  <div className="turn-instruction" aria-live="polite">
                    <strong>
                      {drawPhase === "turning"
                        ? "正在扭动…"
                        : drawPhase === "dropping"
                          ? "任务球掉出来了…"
                          : drawPhase === "prize"
                            ? "点击任务球"
                            : "扭一下"}
                    </strong>
                    <span>{state.tasks.length ? "让下一件事自己出现" : "先添加任务球再来扭"}</span>
                  </div>
                </div>
              </section>
            )}

            {showCurrentPanel && (
              <CurrentPanel
                current={state.current}
                timerText={timerText}
                timerRunning={timerRunning}
                timerMinutes={timerMinutes}
                setTimerMinutes={(value) => {
                  setTimerMinutes(value);
                  resetTimer(value);
                }}
                startTimer={startTimer}
                stopTimer={stopTimer}
                resetTimer={() => resetTimer(timerMinutes)}
                completeCurrentTask={completeCurrentTask}
                claimSpecial={claimSpecial}
                onBack={returnToMachine}
              />
            )}
          </div>
        </section>

        <FinishCelebration show={showFinishCelebration} pieces={finishPieces} />

        <section id="add" className={`view ${view === "add" ? "active" : ""}`} aria-labelledby="addTitle">
          <div className="section-head">
            <p className="eyebrow">ADD BALLS</p>
            <h2 id="addTitle">添加任务球</h2>
          </div>

          <form className="task-form" onSubmit={addTasks}>
            <label className="field full task-name-field">
              <span>任务名</span>
              <input
                type="text"
                maxLength="36"
                placeholder="例如：有氧运动"
                required
                value={taskName}
                onFocus={() => setShowTaskSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowTaskSuggestions(false), 100)}
                onChange={(event) => {
                  setTaskName(event.target.value);
                  setShowTaskSuggestions(true);
                }}
              />
              {showTaskSuggestions && taskSuggestions.length > 0 && (
                <div className="task-suggestions" role="listbox" aria-label="历史任务建议">
                  {taskSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.name.toLocaleLowerCase()}
                      type="button"
                      role="option"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectTaskSuggestion(suggestion)}
                    >
                      <span>{suggestion.name}</span>
                      <small>{categoryById(suggestion.category).name}</small>
                    </button>
                  ))}
                </div>
              )}
            </label>

            <label className="field">
              <span>类别</span>
              <select value={taskCategory} onChange={(event) => setTaskCategory(event.target.value)}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="field">
              <span>数量</span>
              <div className="quantity-stepper">
                <button
                  type="button"
                  onClick={() => setTaskCount((count) => Math.max(1, Number(count) - 1))}
                  disabled={Number(taskCount) <= 1}
                  aria-label="减少任务数量"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={taskCount}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTaskCount(value === "" ? "" : Math.min(20, Math.max(1, Number(value) || 1)));
                  }}
                  onBlur={() => setTaskCount(Math.min(20, Math.max(1, Number(taskCount) || 1)))}
                  aria-label="任务数量"
                  required
                />
                <button
                  type="button"
                  onClick={() => setTaskCount((count) => Math.min(20, Number(count) + 1))}
                  disabled={Number(taskCount) >= 20}
                  aria-label="增加任务数量"
                >
                  +
                </button>
              </div>
            </div>

            <label className="toggle-row full">
              <input
                type="checkbox"
                checked={state.specialEnabled}
                onChange={(event) =>
                  setState((currentState) => ({ ...currentState, specialEnabled: event.target.checked }))
                }
              />
              <span>开启特殊球</span>
            </label>

            <div className="field full daily-target-field">
              <span>每日目标球数</span>
              <div className="quantity-stepper">
                <button
                  type="button"
                  onClick={() =>
                    setState((currentState) => ({
                      ...currentState,
                      dailyTarget: Math.max(minDailyTarget, currentState.dailyTarget - 1),
                    }))
                  }
                  disabled={state.dailyTarget <= minDailyTarget}
                  aria-label="减少每日目标球数"
                >
                  −
                </button>
                <input
                  type="number"
                  min={minDailyTarget}
                  max={maxDailyTarget}
                  value={state.dailyTarget}
                  readOnly
                  aria-label="每日目标球数"
                />
                <button
                  type="button"
                  onClick={() =>
                    setState((currentState) => ({
                      ...currentState,
                      dailyTarget: Math.min(maxDailyTarget, currentState.dailyTarget + 1),
                    }))
                  }
                  disabled={state.dailyTarget >= maxDailyTarget}
                  aria-label="增加每日目标球数"
                >
                  +
                </button>
              </div>
            </div>

            <label className="toggle-row full">
              <input
                type="checkbox"
                checked={taskDailyExclusive}
                onChange={(event) => setTaskDailyExclusive(event.target.checked)}
              />
              <span>同名任务当天只抽一次</span>
            </label>

            <fieldset className="weekend-settings full">
              <legend>周末只摇以下类别</legend>
              <p>默认全选；周六、周日会自动避开未选类别。</p>
              <div className="category-options">
                {categories.map((category) => (
                  <label key={category.id} className="category-option">
                    <input
                      type="checkbox"
                      checked={weekendCategories.includes(category.id)}
                      onChange={() => toggleWeekendCategory(category.id)}
                    />
                    <span className="swatch" style={{ background: category.color }} />
                    <span>{category.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button className="primary-action full" type="submit">
              加入摇蛋机
            </button>
          </form>

          <section className="queue-section" aria-labelledby="queueTitle">
            <div className="section-head compact">
              <h3 id="queueTitle">本周任务池</h3>
              <button className="ghost-action small" type="button" onClick={clearCompleted}>
                清理完成记录
              </button>
            </div>
            <TaskQueue tasks={state.tasks} completed={state.completed} onChooseTask={chooseTaskDirectly} />
          </section>
        </section>

        <section id="progress" className={`view ${view === "progress" ? "active" : ""}`} aria-labelledby="progressTitle">
          <div className="section-head">
            <p className="eyebrow">BALANCE</p>
            <h2 id="progressTitle">分类进度</h2>
          </div>
          <CategoryProgress tasks={state.tasks} completed={state.completed} />
        </section>

        <section id="summary" className={`view ${view === "summary" ? "active" : ""}`} aria-labelledby="summaryTitle">
          <div className="section-head">
            <p className="eyebrow">WEEKLY REVIEW</p>
            <h2 id="summaryTitle">周总结</h2>
          </div>

          <p className="weekly-message">{weeklyMessage}</p>

          <section className="summary-overview" aria-label="本周整体完成情况">
            <div className="completion-ring-wrap">
              <div
                className="completion-ring"
                style={{ "--completion": `${weekStats.percent * 3.6}deg` }}
                role="img"
                aria-label={`本周完成率 ${weekStats.percent}%`}
              >
                <div className="completion-ring-center">
                  <strong>{weekStats.percent}%</strong>
                  <span>本周完成</span>
                </div>
              </div>
              <p>
                完成 {weekStats.done} 颗 · 剩余 {state.tasks.length} 颗
              </p>
            </div>

            <div className="focus-story">
              <span aria-hidden="true">◷</span>
              <p>{buildFocusStory(summaryTotal)}</p>
            </div>
          </section>

          <section className="summary-categories" aria-labelledby="summaryCategoriesTitle">
            <div className="section-head compact">
              <h3 id="summaryCategoriesTitle">本周亮点</h3>
            </div>
            <WeeklyHighlights categoryStats={categoryStats} />
          </section>

          <div className="section-head compact summary-history-head">
            <h3>完成记录</h3>
            <span>{state.completed.length} 次完成</span>
          </div>
          <SummaryList completed={state.completed} />
        </section>
      </main>

      <nav className="nav-tabs" aria-label="页面">
        {navItems.map(([id, icon, label]) => (
          <button
            key={id}
            data-view={id}
            className={`nav-tab ${view === id ? "active" : ""}`}
            type="button"
            onClick={() => setView(id)}
          >
            <span aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {notice && (
        <div className="app-toast" role="status" aria-live="polite">
          {notice}
        </div>
      )}

      {showMondayTip && (
        <div className="monday-sheet-backdrop" role="presentation">
          <section className="monday-sheet" role="dialog" aria-modal="true" aria-labelledby="mondayTipTitle">
            <div className="sheet-handle" aria-hidden="true" />
            <h2 id="mondayTipTitle">这周的节奏已经算好啦</h2>
            <p>
              本周共 {weekStats.total} 颗球，你设置的每日目标是 {suggestedToday} 颗 💪
            </p>
            <button className="primary-action" type="button" onClick={closeMondayTip}>
              好的，开摇
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function FocusMode({
  current,
  timerText,
  timerRunning,
  timerFinished,
  timerMinutes,
  progressPercent,
  onPause,
  onContinue,
  onAbandon,
  onExit,
  onComplete,
}) {
  const category = categoryById(current.category);
  const confetti = useMemo(() => buildFocusConfetti(), []);

  return (
    <main className={`focus-mode ${timerFinished ? "is-celebrating" : ""}`} aria-label="专注模式">
      {timerFinished && (
        <div className="focus-confetti" aria-hidden="true">
          {confetti.map((piece, index) => (
            <span
              key={`focus-confetti-${index}`}
              style={{
                "--x": `${piece.x}%`,
                "--size": `${piece.size}px`,
                "--height": `${piece.height}px`,
                "--delay": `${piece.delay}s`,
                "--duration": `${piece.duration}s`,
                "--drift": `${piece.drift}px`,
                "--rotate": `${piece.rotate}deg`,
                "--color": piece.color,
                "--radius": piece.round ? "50%" : "2px",
              }}
            />
          ))}
        </div>
      )}

      <header className="focus-header">
        <span className="category-chip" style={{ background: category.color }}>
          {category.name}
        </span>
        <h1>{current.name}</h1>
      </header>

      <section className="focus-timer" aria-live="polite">
        {timerFinished ? (
          <div className="focus-finish-stage">
            <strong className="focus-finish-countdown">{timerText}</strong>
            <p className="focus-finished-label">专注了 {timerMinutes} 分钟 🎉</p>
          </div>
        ) : (
          <strong>{timerText}</strong>
        )}
        <div className="focus-progress-track" aria-label={`剩余时间 ${Math.round(progressPercent)}%`}>
          <div className="focus-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      <div className="focus-actions">
        {timerFinished ? (
          <button className="focus-complete-action focus-complete-reveal" type="button" onClick={onComplete}>
            完成这颗球 ✓
          </button>
        ) : (
          <>
            <button className="focus-primary-action" type="button" onClick={timerRunning ? onPause : onContinue}>
              {timerRunning ? "暂停" : "继续"}
            </button>
            <button className="focus-abandon-action" type="button" onClick={onAbandon}>
              放弃这颗球
            </button>
            {!timerRunning && (
              <button className="focus-exit-action" type="button" onClick={onExit}>
                结束专注
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function CurrentPanel({
  current,
  timerText,
  timerRunning,
  timerMinutes,
  setTimerMinutes,
  startTimer,
  stopTimer,
  resetTimer,
  completeCurrentTask,
  claimSpecial,
  onBack,
}) {
  return (
    <section className="current-panel" aria-label="当前任务">
      <button className="back-action" type="button" onClick={onBack}>
        ← 返回
      </button>

      {!current && (
        <div className="empty-state">
          <strong>任务球等待被摇出</strong>
          <span>添加任务后，摇蛋机会从未完成任务里随机抽取。</span>
        </div>
      )}

      {current?.kind === "task" && (
        <div className="task-state">
          <div className="task-heading">
            <span className="category-chip" style={{ background: categoryById(current.category).color }}>
              {categoryById(current.category).name}
            </span>
            <span className="type-chip">任务球</span>
          </div>
          <h3>{current.name}</h3>
          <div className="timer-face">
            <span>{timerText}</span>
          </div>
          <div className="timer-controls">
            <button className="timer-start-button" type="button" onClick={timerRunning ? stopTimer : startTimer}>
              {timerRunning ? "暂停专注 Ⅱ" : "开始专注 ▶"}
            </button>
            <button type="button" onClick={resetTimer}>
              ↺
            </button>
            <label>
              <span>分钟</span>
              <input
                type="number"
                min="1"
                max="120"
                value={timerMinutes}
                onChange={(event) => setTimerMinutes(Number(event.target.value) || initialTimerMinutes)}
              />
            </label>
          </div>
          <button className="task-skip-complete" type="button" onClick={completeCurrentTask}>
            完成此任务
          </button>
        </div>
      )}

      {current?.kind === "special" && (
        <div className="special-state">
          <span className="special-icon">{current.icon}</span>
          <h3>{current.name}</h3>
          <p>{current.text}</p>
          <button className="complete-action" type="button" onClick={claimSpecial}>
            收下惊喜
          </button>
        </div>
      )}
    </section>
  );
}

function FinishCelebration({ show, pieces }) {
  if (!show) return null;

  return (
    <div className="finish-celebration" aria-live="polite" role="status">
      <div className="modal-prize-burst" aria-hidden="true">
        {pieces.fireworks.map((item, index) => (
          <span
            key={`finish-firework-${index}`}
            className="firework"
            style={{
              "--x": `${item.x}%`,
              "--y": `${item.y}%`,
              "--delay": `${item.delay}s`,
              "--c": item.color,
            }}
          />
        ))}
        {pieces.confetti.map((item, index) => (
          <span
            key={`finish-confetti-${index}`}
            className="confetti"
            style={{
              "--x": `${item.x}%`,
              "--delay": `${item.delay}s`,
              "--drift": `${item.drift * 1.35}px`,
              "--r": `${item.rotate}deg`,
              "--c": item.color,
            }}
          />
        ))}
      </div>
      <strong>Amazing</strong>
    </div>
  );
}

function TaskQueue({ tasks, completed, onChooseTask }) {
  const [expandedGroups, setExpandedGroups] = useState([]);
  const taskGroups = useMemo(() => groupTaskPool(tasks, completed), [tasks, completed]);

  function toggleGroup(groupKey) {
    setExpandedGroups((current) =>
      current.includes(groupKey) ? current.filter((key) => key !== groupKey) : [...current, groupKey],
    );
  }

  if (!taskGroups.length) {
    return (
      <div className="task-queue">
        <div className="task-row">
          <strong>本周还没有任务球</strong>
          <span className="task-meta">添加任务后会显示在这里。</span>
        </div>
      </div>
    );
  }

  return (
    <div className="task-queue">
      {taskGroups.map((group) => {
        const category = categoryById(group.category);
        const isExpanded = expandedGroups.includes(group.key);
        return (
          <article className={`task-group-card ${isExpanded ? "is-expanded" : ""}`} key={group.key}>
            <div className="task-group-main">
              <button
                className="task-group-toggle"
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "收起" : "展开"}${group.name}任务球详情`}
              >
                <span className="task-group-copy">
                  <strong>{group.name}</strong>
                  <span className="task-meta">
                    {category.name}
                    {group.dailyExclusive ? " · 同名当天只抽一次" : ""}
                  </span>
                </span>
                <span className="task-group-summary">
                  <span className="swatch" style={{ background: category.color }} />
                  {group.allCompleted ? (
                    <span className="task-all-complete">✓ 全部完成</span>
                  ) : (
                    group.pending.length > 1 && <strong>× {group.pending.length}</strong>
                  )}
                  <span className="task-expand-arrow" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </button>
              {!group.allCompleted && (
                <button
                  className="choose-task-action"
                  type="button"
                  onClick={() => onChooseTask(group.pending[0])}
                >
                  指定完成
                </button>
              )}
            </div>

            {isExpanded && (
              <div className="task-ball-details">
                {group.pending.map((task, index) => (
                  <div className="task-ball-status" key={`pending-${task.id}`}>
                    <span className="task-ball-index">球 {index + 1}</span>
                    <span className="task-status-pending">待完成</span>
                  </div>
                ))}
                {group.completed.map((task, index) => (
                  <div className="task-ball-status is-complete" key={`completed-${task.id}-${task.completedAt}`}>
                    <span className="task-ball-index">球 {group.pending.length + index + 1}</span>
                    <span className="task-status-complete">✓ 已完成</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function CategoryProgress({ tasks, completed }) {
  const activeCategories = activeCategoryStats(buildCategoryStats(categories, tasks, completed));

  return (
    <div className="progress-grid">
      {activeCategories.map((category) => {
        return (
          <article className="progress-card" key={category.id}>
            <div className="progress-top">
              <span className="progress-name">
                <span className="swatch" style={{ background: category.color }} />
                {category.name}
              </span>
              <strong>{category.percent}%</strong>
            </div>
            <div className="meter-track">
              <div
                className="meter-fill"
                style={{ width: `${category.percent}%`, background: category.color }}
              />
            </div>
            <p className="task-meta">
              {category.done} 完成 / {category.remaining} 剩余
            </p>
          </article>
        );
      })}
    </div>
  );
}

function WeeklyHighlights({ categoryStats }) {
  const highlights = buildWeeklyHighlights(categoryStats);

  return (
    <div className="weekly-highlights">
      {highlights.length ? (
        highlights.map((highlight) => (
          <div className="weekly-highlight" key={highlight.type}>
            <div className="weekly-highlight-mark" aria-hidden="true">
              <span className="swatch" style={{ background: highlight.category.color }} />
              <span>{highlight.emoji}</span>
            </div>
            <p>
              <strong>{highlight.category.name}</strong>
              <span> · {highlight.text}</span>
            </p>
          </div>
        ))
      ) : (
        <p className="weekly-highlights-empty">这周还没有完成记录，快去摇球吧 🎲</p>
      )}
    </div>
  );
}

function SummaryList({ completed }) {
  if (!completed.length) {
    return (
      <div className="summary-list">
        <div className="summary-item">
          <strong>还没有完成记录</strong>
          <span className="summary-meta">完成任务后会自动累计时间。</span>
        </div>
      </div>
    );
  }

  const grouped = groupCompletedTasks(completed);

  return (
    <div className="summary-list">
      {grouped.map((item) => {
        const category = categoryById(item.category);
        return (
          <article className="summary-item" key={item.key}>
            <div>
              <strong>
                {item.name}
                {item.count > 1 && <span className="summary-count"> × {item.count}</span>}
              </strong>
              <div className="summary-meta">
                {category.name} · {item.dateLabel}
              </div>
            </div>
            <strong>{formatMinutes(item.minutes)}</strong>
          </article>
        );
      })}
    </div>
  );
}
