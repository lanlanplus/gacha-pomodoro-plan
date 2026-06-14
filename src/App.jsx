import React, { useEffect, useMemo, useRef, useState } from "react";

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
const initialTimerMinutes = 25;

function makeTask(name, category) {
  return {
    id: crypto.randomUUID(),
    name,
    category,
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
    specialEnabled: true,
    current: null,
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    return parsed ? { ...seedState(), ...parsed } : seedState();
  } catch {
    return seedState();
  }
}

function categoryById(id) {
  return categories.find((category) => category.id === id) || categories[0];
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
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
  ];
  const confetti = Array.from({ length: 30 }, (_, index) => ({
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
  const [view, setView] = useState("machine");
  const [state, setState] = useState(loadState);
  const [taskName, setTaskName] = useState("");
  const [taskCategory, setTaskCategory] = useState(categories[0].id);
  const [taskCount, setTaskCount] = useState(1);
  const [timerMinutes, setTimerMinutes] = useState(initialTimerMinutes);
  const [timerRemaining, setTimerRemaining] = useState(initialTimerMinutes * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedBeforeStart, setElapsedBeforeStart] = useState(0);
  const [drawInProgress, setDrawInProgress] = useState(false);
  const [drawPhase, setDrawPhase] = useState("idle");
  const [prizePieces, setPrizePieces] = useState({ fireworks: [], confetti: [] });
  const [pendingPrize, setPendingPrize] = useState(null);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    startedAtRef.current = Date.now();
    intervalRef.current = window.setInterval(() => {
      setTimerRemaining((remaining) => {
        if (remaining <= 1) {
          stopTimer();
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

  function resetTimer(minutes = timerMinutes) {
    const safeMinutes = Math.min(120, Math.max(1, Number(minutes) || initialTimerMinutes));
    stopTimer();
    setTimerMinutes(safeMinutes);
    setTimerRemaining(safeMinutes * 60);
    setElapsedBeforeStart(0);
  }

  function stopTimer() {
    window.clearInterval(intervalRef.current);
    setTimerRunning(false);
    if (startedAtRef.current) {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedBeforeStart((value) => value + elapsed);
      startedAtRef.current = null;
    }
  }

  function startTimer() {
    if (!state.current || state.current.kind !== "task") return;
    if (!timerRunning) setTimerRunning(true);
  }

  function drawTask() {
    if (drawInProgress) return;
    stopTimer();
    const getsSpecial = state.specialEnabled && Math.random() < 0.08;
    const selectedPrize = getsSpecial
      ? { kind: "special", ...pick(specials) }
      : state.tasks.length
        ? { kind: "task", ...pick(state.tasks) }
        : null;

    setDrawInProgress(true);
    setDrawPhase("rolling");
    setPendingPrize(selectedPrize);
    setPrizePieces({ fireworks: [], confetti: [] });
    setState((currentState) => ({ ...currentState, current: null }));

    window.setTimeout(() => {
      resetTimer(timerMinutes);
      if (selectedPrize) {
        setDrawPhase("prize");
      } else {
        setDrawPhase("idle");
        setDrawInProgress(false);
      }
    }, 900);
  }

  function openPrizeBall() {
    if (drawPhase !== "prize") return;
    setPrizePieces(buildPrizePieces());
    setDrawPhase("celebrating");

    window.setTimeout(() => {
      setState((currentState) => ({ ...currentState, current: pendingPrize }));
      setPrizePieces({ fireworks: [], confetti: [] });
      setPendingPrize(null);
      setDrawPhase("idle");
      setDrawInProgress(false);
    }, 2000);
  }

  function addTasks(event) {
    event.preventDefault();
    const cleanName = taskName.trim();
    const count = Math.min(30, Math.max(1, Number(taskCount) || 1));
    if (!cleanName) return;

    setState((currentState) => ({
      ...currentState,
      tasks: [
        ...currentState.tasks,
        ...Array.from({ length: count }, () => makeTask(cleanName, taskCategory)),
      ],
    }));
    setTaskName("");
    setTaskCount(1);
  }

  function completeCurrentTask() {
    const current = state.current;
    if (!current || current.kind !== "task") return;
    stopTimer();
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
    resetTimer(timerMinutes);
  }

  function resetWeek() {
    if (!confirm("开启新一周会清空当前任务池和本周总结。确定继续吗？")) return;
    stopTimer();
    setState((currentState) => ({
      tasks: [],
      completed: [],
      specialEnabled: currentState.specialEnabled,
      current: null,
    }));
    resetTimer(timerMinutes);
  }

  function claimSpecial() {
    setState((currentState) => ({ ...currentState, current: null }));
  }

  function clearCompleted() {
    setState((currentState) => ({ ...currentState, completed: [] }));
  }

  const timerText = `${Math.floor(timerRemaining / 60).toString().padStart(2, "0")}:${Math.floor(
    timerRemaining % 60,
  )
    .toString()
    .padStart(2, "0")}`;

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

        <nav className="nav-tabs" aria-label="页面">
          {[
            ["machine", "◎", "摇蛋机"],
            ["add", "＋", "添加任务"],
            ["progress", "▦", "进度"],
            ["summary", "◷", "周总结"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              data-view={id}
              className={`nav-tab ${view === id ? "active" : ""}`}
              type="button"
              onClick={() => setView(id)}
            >
              <span aria-hidden="true">{icon}</span> {label}
            </button>
          ))}
        </nav>

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
          <div className="machine-layout">
            <section className="machine-stage" aria-labelledby="machineTitle">
              <div className="stage-copy">
                <p className="eyebrow">GACHA POMODORO</p>
                <h2 id="machineTitle">摇出下一颗任务球</h2>
              </div>

              <div className="gacha-wrap">
                <div
                  className={`gacha-machine ${drawPhase === "rolling" ? "shaking rolling" : ""}`}
                  aria-hidden="true"
                >
                  <div className="gacha-top">
                    <div className="ball-cloud">
                      {state.tasks.slice(0, 18).map((task, index) => {
                        const category = categoryById(task.category);
                        const left = 8 + ((index * 29) % 72);
                        const top = 10 + ((index * 37) % 62);
                        const size = 34 + ((index * 7) % 18);
                        return (
                          <span
                            key={task.id}
                            className="mini-ball"
                            style={{
                              left: `${left}%`,
                              top: `${top}%`,
                              width: `${size}px`,
                              height: `${size}px`,
                              background: category.color,
                              "--i": index,
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="glass-shine" />
                  </div>
                  <div className="gacha-neck" />
                  <div className="gacha-body">
                    <div className="dial">
                      <div className="dial-dot" />
                    </div>
                    <div className="slot" />
                  </div>
                  <div className="gacha-base" />
                </div>
              </div>

              <div className="machine-actions">
                <button className="primary-action" type="button" onClick={drawTask} disabled={drawInProgress}>
                  {drawPhase === "rolling" ? "摇动中..." : drawInProgress ? "开奖中..." : "摇一个！"}
                </button>
                <button className="ghost-action" type="button" onClick={resetWeek}>
                  开启新一周
                </button>
              </div>
            </section>

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
            />
          </div>
        </section>

        <PrizeModal
          phase={drawPhase}
          prizePieces={prizePieces}
          pendingPrize={pendingPrize}
          onOpenPrizeBall={openPrizeBall}
        />

        <section id="add" className={`view ${view === "add" ? "active" : ""}`} aria-labelledby="addTitle">
          <div className="section-head">
            <p className="eyebrow">ADD BALLS</p>
            <h2 id="addTitle">添加任务球</h2>
          </div>

          <form className="task-form" onSubmit={addTasks}>
            <label className="field full">
              <span>任务名</span>
              <input
                type="text"
                maxLength="36"
                placeholder="例如：有氧运动"
                required
                value={taskName}
                onChange={(event) => setTaskName(event.target.value)}
              />
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

            <label className="field">
              <span>数量</span>
              <input
                type="number"
                min="1"
                max="30"
                value={taskCount}
                onChange={(event) => setTaskCount(event.target.value)}
                required
              />
            </label>

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
            <TaskQueue tasks={state.tasks} />
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
          <div className="summary-strip">
            <div>
              <span>总投入</span>
              <strong>{formatMinutes(summaryTotal)}</strong>
            </div>
            <div>
              <span>完成事件</span>
              <strong>{state.completed.length}</strong>
            </div>
            <div>
              <span>剩余球数</span>
              <strong>{state.tasks.length}</strong>
            </div>
          </div>
          <SummaryList completed={state.completed} />
        </section>
      </main>
    </div>
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
}) {
  return (
    <section className="current-panel" aria-label="当前任务">
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
            <button type="button" onClick={timerRunning ? stopTimer : startTimer}>
              {timerRunning ? "Ⅱ" : "▶"}
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
          <button className="complete-action" type="button" onClick={completeCurrentTask}>
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

function PrizeModal({ phase, prizePieces, pendingPrize, onOpenPrizeBall }) {
  if (phase === "idle" || phase === "rolling") return null;

  const category = pendingPrize?.kind === "task" ? categoryById(pendingPrize.category) : null;
  const ballColor = category?.color || "#f3b43f";

  return (
    <div className="prize-modal" aria-live="polite">
      <div className="modal-prize-burst" aria-hidden="true">
        {prizePieces.fireworks.map((item, index) => (
          <span
            key={`modal-firework-${index}`}
            className="firework"
            style={{
              "--x": `${item.x}%`,
              "--y": `${item.y}%`,
              "--delay": `${item.delay}s`,
              "--c": item.color,
            }}
          />
        ))}
        {prizePieces.confetti.map((item, index) => (
          <span
            key={`modal-confetti-${index}`}
            className="confetti"
            style={{
              "--x": `${item.x}%`,
              "--delay": `${item.delay}s`,
              "--drift": `${item.drift}px`,
              "--r": `${item.rotate}deg`,
              "--c": item.color,
            }}
          />
        ))}
      </div>

      {phase === "prize" && (
        <button
          className="modal-prize-ball"
          style={{ "--ball-color": ballColor }}
          type="button"
          onClick={onOpenPrizeBall}
          aria-label="打开扭蛋球"
        >
          <span className="modal-prize-seam" />
          <span className="modal-prize-shine" />
        </button>
      )}

      {phase === "celebrating" && (
        <div className="modal-celebration-badge">
          <span>中奖啦</span>
        </div>
      )}
    </div>
  );
}

function TaskQueue({ tasks }) {
  if (!tasks.length) {
    return (
      <div className="task-queue">
        <div className="task-row">
          <strong>本周任务池已清空</strong>
          <span className="task-meta">漂亮，去看周总结。</span>
        </div>
      </div>
    );
  }

  return (
    <div className="task-queue">
      {tasks.map((task) => {
        const category = categoryById(task.category);
        return (
          <div className="task-row" key={task.id}>
            <div>
              <strong>{task.name}</strong>
              <div className="task-meta">{category.name}</div>
            </div>
            <span className="swatch" style={{ background: category.color }} />
          </div>
        );
      })}
    </div>
  );
}

function CategoryProgress({ tasks, completed }) {
  return (
    <div className="progress-grid">
      {categories.map((category) => {
        const remaining = tasks.filter((task) => task.category === category.id).length;
        const done = completed.filter((task) => task.category === category.id).length;
        const total = remaining + done;
        const percent = total ? Math.round((done / total) * 100) : 0;
        return (
          <article className="progress-card" key={category.id}>
            <div className="progress-top">
              <span className="progress-name">
                <span className="swatch" style={{ background: category.color }} />
                {category.name}
              </span>
              <strong>{percent}%</strong>
            </div>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${percent}%`, background: category.color }} />
            </div>
            <p className="task-meta">
              {done} 完成 / {remaining} 剩余
            </p>
          </article>
        );
      })}
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

  return (
    <div className="summary-list">
      {[...completed].reverse().map((item) => {
        const category = categoryById(item.category);
        const date = new Date(item.completedAt);
        return (
          <article className="summary-item" key={`${item.id}-${item.completedAt}`}>
            <div>
              <strong>{item.name}</strong>
              <div className="summary-meta">
                {category.name} ·{" "}
                {date.toLocaleDateString("zh-CN", { weekday: "short", month: "numeric", day: "numeric" })}
              </div>
            </div>
            <strong>{formatMinutes(item.minutes)}</strong>
          </article>
        );
      })}
    </div>
  );
}
