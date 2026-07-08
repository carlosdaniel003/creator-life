import "../college-goals.css";
import { CreatorLife3D } from "./CreatorLife3D";
import { LifeSimulation } from "./LifeSimulation";
import { ProgressionSystem } from "./ProgressionSystem";

type AnyInstance = any;

type GoalMetric =
  | "videos"
  | "subscribers"
  | "freelance"
  | "investment"
  | "courses"
  | "skills"
  | "reputation";

interface CollegeExpansionSave {
  version: 1;
  nextExamDay: number;
  examNumber: number;
  examStudyHours: number;
  totalStudyHours: number;
  totalScholarship: number;
  lastExamScore: number | null;
  lastExamPassed: boolean | null;
  lastExamReward: number;
  examReminderDay: number;
}

interface CollegeSnapshot {
  grade: number;
  weeklyStudy: number;
  examStudyHours: number;
  nextExamDay: number;
  daysUntilExam: number;
  examReady: boolean;
  passChance: number;
  examNumber: number;
  totalScholarship: number;
  lastExamScore: number | null;
  lastExamPassed: boolean | null;
  lastExamReward: number;
}

interface DynamicGoal {
  id: string;
  slot: number;
  metric: GoalMetric;
  tier: number;
  startValue: number;
  targetValue: number;
  reward: number;
  label: string;
  description: string;
}

interface DynamicGoalState {
  version: 1;
  level: number;
  totalClaimed: number;
  totalRewards: number;
  goals: DynamicGoal[];
}

interface ActionResult {
  error: string | null;
  message: string;
  score?: number;
  reward?: number;
  passed?: boolean;
}

declare global {
  interface Window {
    __creatorLifeCollege?: {
      getSnapshot: () => CollegeSnapshot;
      takeExam: () => ActionResult;
    };
  }
}

const EXAM_INTERVAL_DAYS = 28;
const COLLEGE_PATCH = "__collegeExpansionPatched";
const GOALS_PATCH = "__dynamicGoalsPatched";
const MODAL_PATCH = "__collegeModalPatched";
const GOAL_TRACKS: GoalMetric[] = [
  "videos",
  "subscribers",
  "freelance",
  "investment",
  "courses",
  "skills",
  "reputation"
];

let activeLife: AnyInstance | null = null;
let activeProgression: AnyInstance | null = null;

patchCollegeSystem();
patchDynamicGoals();
patchCollegeModals();
installGoalPanelInterception();
installQuickSummaryUpdater();

function patchCollegeSystem(): void {
  const prototype = LifeSimulation.prototype as AnyInstance;
  if (prototype[COLLEGE_PATCH]) return;
  prototype[COLLEGE_PATCH] = true;

  const originalRestore = prototype.restore;
  const originalSerialize = prototype.serialize;
  const originalStudy = prototype.study;
  const originalRenderAgendaHtml = prototype.renderAgendaHtml;
  const originalRenderHud = prototype.renderHud;
  const originalProcessNewDay = prototype.processNewDay;

  prototype.restore = function (saved: AnyInstance): void {
    originalRestore.call(this, saved);
    this.__collegeExpansion = normalizeCollegeSave(
      saved?.collegeExpansion,
      Number(this.host.getState().day ?? 1)
    );
    activeLife = this;
    registerCollegeBridge(this);
    originalRenderHud.call(this);
  };

  prototype.serialize = function (): AnyInstance {
    return {
      ...originalSerialize.call(this),
      collegeExpansion: { ...ensureCollege(this) }
    };
  };

  prototype.study = function (hours: 2 | 4): string | null {
    const result = originalStudy.call(this, hours) as string | null;
    if (result === null) {
      const expansion = ensureCollege(this);
      expansion.examStudyHours += hours;
      expansion.totalStudyHours += hours;
      this.host.onChange();
    }
    return result;
  };

  prototype.evaluatePreviousWeek = function (week: number): void {
    const studied = Number(this.studyHoursThisWeek ?? 0);
    const delta = studied >= 12 ? 3 : studied >= 8 ? 1 : studied >= 5 ? -2 : -6;
    this.collegeGrade = clamp(Number(this.collegeGrade ?? 68) + delta, 0, 100);

    this.host.onEvent(
      studied >= 8
        ? `Boa rotina acadêmica: ${studied.toFixed(1)}h estudadas. Média atual ${this.collegeGrade.toFixed(1)}.`
        : `Você estudou ${studied.toFixed(1)}h nesta semana. Sua média caiu para ${this.collegeGrade.toFixed(1)}.`,
      studied >= 8 ? "success" : "warning"
    );

    this.studyHoursThisWeek = 0;
    this.evaluatedWeek = week;
  };

  prototype.processNewDay = function (day: number): void {
    originalProcessNewDay.call(this, day);
    const expansion = ensureCollege(this);
    if (day >= expansion.nextExamDay && expansion.examReminderDay !== day) {
      expansion.examReminderDay = day;
      this.host.onEvent(
        `A prova ${expansion.examNumber} da faculdade está disponível. Média atual: ${Number(this.collegeGrade).toFixed(1)}.`,
        "neutral"
      );
    }
  };

  prototype.renderAgendaHtml = function (): string {
    return `${originalRenderAgendaHtml.call(this)}${renderCollegeAgenda(this)}`;
  };

  prototype.renderHud = function (): void {
    originalRenderHud.call(this);
    const snapshot = collegeSnapshot(this);
    const hud = this.hud as HTMLElement | undefined;
    const college = hud?.querySelector(
      ".life-calendar-hud__college strong"
    ) as HTMLElement | null | undefined;
    if (college) {
      college.textContent = `Média ${snapshot.grade.toFixed(0)} · ${examDateLabel(snapshot)}`;
    }
    updateCollegeQuickSummary(snapshot);
  };
}

function registerCollegeBridge(instance: AnyInstance): void {
  window.__creatorLifeCollege = {
    getSnapshot: () => collegeSnapshot(instance),
    takeExam: () => takeCollegeExam(instance)
  };
}

function normalizeCollegeSave(
  saved: Partial<CollegeExpansionSave> | null | undefined,
  currentDay: number
): CollegeExpansionSave {
  const nextDefault = Math.max(
    EXAM_INTERVAL_DAYS,
    Math.ceil(currentDay / EXAM_INTERVAL_DAYS) * EXAM_INTERVAL_DAYS
  );
  let nextExamDay = finite(saved?.nextExamDay, nextDefault);
  if (nextExamDay < currentDay - EXAM_INTERVAL_DAYS) {
    nextExamDay = nextDefault;
  }

  return {
    version: 1,
    nextExamDay,
    examNumber: Math.max(1, Math.floor(finite(saved?.examNumber, 1))),
    examStudyHours: Math.max(0, finite(saved?.examStudyHours, 0)),
    totalStudyHours: Math.max(0, finite(saved?.totalStudyHours, 0)),
    totalScholarship: Math.max(0, finite(saved?.totalScholarship, 0)),
    lastExamScore:
      saved?.lastExamScore === null || saved?.lastExamScore === undefined
        ? null
        : clamp(finite(saved.lastExamScore, 0), 0, 100),
    lastExamPassed:
      typeof saved?.lastExamPassed === "boolean" ? saved.lastExamPassed : null,
    lastExamReward: Math.max(0, finite(saved?.lastExamReward, 0)),
    examReminderDay: Math.floor(finite(saved?.examReminderDay, 0))
  };
}

function ensureCollege(instance: AnyInstance): CollegeExpansionSave {
  if (!instance.__collegeExpansion) {
    instance.__collegeExpansion = normalizeCollegeSave(
      null,
      Number(instance.host.getState().day ?? 1)
    );
  }
  return instance.__collegeExpansion as CollegeExpansionSave;
}

function collegeSnapshot(instance: AnyInstance): CollegeSnapshot {
  const expansion = ensureCollege(instance);
  const state = instance.host.getState();
  const grade = clamp(Number(instance.collegeGrade ?? 68), 0, 100);
  const preparation = clamp(expansion.examStudyHours / 40, 0, 1);
  const passChance = clamp(0.2 + grade * 0.0062 + preparation * 0.28, 0.12, 0.97);

  return {
    grade,
    weeklyStudy: Math.max(0, Number(instance.studyHoursThisWeek ?? 0)),
    examStudyHours: expansion.examStudyHours,
    nextExamDay: expansion.nextExamDay,
    daysUntilExam: Math.max(0, expansion.nextExamDay - Number(state.day ?? 1)),
    examReady: Number(state.day ?? 1) >= expansion.nextExamDay,
    passChance,
    examNumber: expansion.examNumber,
    totalScholarship: expansion.totalScholarship,
    lastExamScore: expansion.lastExamScore,
    lastExamPassed: expansion.lastExamPassed,
    lastExamReward: expansion.lastExamReward
  };
}

function takeCollegeExam(instance: AnyInstance): ActionResult {
  const snapshot = collegeSnapshot(instance);
  const expansion = ensureCollege(instance);
  const state = instance.host.getState();

  if (!snapshot.examReady) {
    return {
      error: `A próxima prova será no dia ${snapshot.nextExamDay}.`,
      message: `A próxima prova será no dia ${snapshot.nextExamDay}.`
    };
  }
  if (Number(state.energy ?? 0) < 15) {
    return {
      error: "Você precisa de 15 de energia para fazer a prova.",
      message: "Você precisa de 15 de energia para fazer a prova."
    };
  }
  if (Number(state.hunger ?? 0) < 15 || Number(state.thirst ?? 0) < 15) {
    return {
      error: "Coma e beba água antes de fazer a prova.",
      message: "Coma e beba água antes de fazer a prova."
    };
  }

  state.energy = clamp(Number(state.energy) - 15, 0, 100);
  const passed = Math.random() <= snapshot.passChance;
  const preparation = clamp(expansion.examStudyHours / 40, 0, 1);
  const baseScore = snapshot.grade * 0.58 + preparation * 30;
  const score = passed
    ? clamp(Math.max(60, baseScore + random(4, 20)), 60, 100)
    : clamp(Math.min(59, baseScore + random(-22, 5)), 20, 59);
  const roundedScore = Math.round(score * 10) / 10;

  let reward = 0;
  if (passed) {
    const performanceReward =
      roundedScore >= 90 ? 360 : roundedScore >= 80 ? 260 : roundedScore >= 70 ? 180 : 110;
    reward = Math.round(performanceReward + expansion.examNumber * 35);
    if (typeof instance.addIncome === "function") {
      instance.addIncome(`Bolsa acadêmica · prova ${expansion.examNumber}`, reward);
    } else {
      state.money = Number(state.money ?? 0) + reward;
    }
  }

  instance.collegeGrade = clamp(
    snapshot.grade * 0.72 + roundedScore * 0.28,
    0,
    100
  );
  expansion.lastExamScore = roundedScore;
  expansion.lastExamPassed = passed;
  expansion.lastExamReward = reward;
  expansion.totalScholarship += reward;
  expansion.examNumber += 1;
  expansion.examStudyHours = 0;
  do {
    expansion.nextExamDay += EXAM_INTERVAL_DAYS;
  } while (expansion.nextExamDay <= Number(state.day ?? 1));
  expansion.examReminderDay = 0;

  instance.host.onChange();
  instance.renderHud();

  const message = passed
    ? `Aprovado com nota ${roundedScore.toFixed(1)}. Bolsa recebida: R$ ${reward.toFixed(2)}.`
    : `Nota ${roundedScore.toFixed(1)}. Você não alcançou a média mínima nesta prova.`;
  instance.host.onEvent(message, passed ? "success" : "warning");

  return {
    error: null,
    message,
    score: roundedScore,
    reward,
    passed
  };
}

function renderCollegeAgenda(instance: AnyInstance): string {
  const snapshot = collegeSnapshot(instance);
  return `
    <section class="college-exam-agenda ${snapshot.examReady ? "is-ready" : ""}">
      <div><span>PRÓXIMA PROVA</span><strong>${snapshot.examReady ? "Disponível agora" : `Dia ${snapshot.nextExamDay}`}</strong><p>${examDateLabel(snapshot)} · prova ${snapshot.examNumber}</p></div>
      <div><span>CHANCE DE APROVAÇÃO</span><strong>${Math.round(snapshot.passChance * 100)}%</strong><p>${snapshot.examStudyHours.toFixed(0)}h de preparação no ciclo atual</p></div>
      <div><span>BOLSAS RECEBIDAS</span><strong>R$ ${snapshot.totalScholarship.toFixed(2)}</strong><p>${lastExamLabel(snapshot)}</p></div>
    </section>`;
}

function patchCollegeModals(): void {
  const prototype = CreatorLife3D.prototype as AnyInstance;
  if (prototype[MODAL_PATCH]) return;
  prototype[MODAL_PATCH] = true;
  const originalShowModal = prototype.showModal;

  prototype.showModal = function (
    title: string,
    body: string,
    actions: Array<{
      label: string;
      action: () => void | Promise<void>;
      secondary?: boolean;
    }>
  ): void {
    const snapshot = window.__creatorLifeCollege?.getSnapshot();
    let nextBody = body;
    let nextActions = actions;

    if (snapshot && title === "Seu computador") {
      nextBody = `${body}${renderComputerCollegeCard(snapshot)}`;
    }

    if (snapshot && title === "Estudar para a faculdade") {
      nextBody = renderCollegeStudyPanel(snapshot);
      nextActions = actions.map((action) => {
        const hours = action.label.includes("4 horas")
          ? 4
          : action.label.includes("2 horas")
            ? 2
            : null;
        if (!hours) return action;
        return {
          ...action,
          action: () => runCollegeStudyActivity(this, action.action, hours)
        };
      });

      if (snapshot.examReady) {
        const cancelIndex = nextActions.findIndex((action) => action.secondary);
        nextActions.splice(cancelIndex >= 0 ? cancelIndex : nextActions.length, 0, {
          label: `Fazer prova · ${Math.round(snapshot.passChance * 100)}%`,
          action: () => runCollegeExamActivity(this)
        });
      }
    }

    originalShowModal.call(this, title, nextBody, nextActions);
  };
}

function renderComputerCollegeCard(snapshot: CollegeSnapshot): string {
  return `
    <section class="computer-college-summary ${snapshot.examReady ? "is-ready" : ""}">
      <div><span>FACULDADE</span><strong>Média geral ${snapshot.grade.toFixed(1)}</strong><p>${examDateLabel(snapshot)}</p></div>
      <div><span>PREPARAÇÃO</span><strong>${snapshot.examStudyHours.toFixed(0)}h</strong><p>Chance de aprovação: ${Math.round(snapshot.passChance * 100)}%</p></div>
    </section>`;
}

function renderCollegeStudyPanel(snapshot: CollegeSnapshot): string {
  return `
    <section class="college-study-hero ${snapshot.examReady ? "is-ready" : ""}">
      <div><span>FACULDADE</span><h3>Média geral ${snapshot.grade.toFixed(1)}</h3><p>Estudar mantém a média semanal e aumenta a chance da próxima prova.</p></div>
      <b>${Math.round(snapshot.passChance * 100)}%<small>chance atual</small></b>
    </section>
    <section class="college-study-metrics">
      <article><span>ESTUDO SEMANAL</span><strong>${snapshot.weeklyStudy.toFixed(1)} / 10h</strong><div><i style="width:${Math.min(100, snapshot.weeklyStudy * 10)}%"></i></div></article>
      <article><span>PREPARAÇÃO DA PROVA</span><strong>${snapshot.examStudyHours.toFixed(1)} / 40h</strong><div><i style="width:${Math.min(100, snapshot.examStudyHours * 2.5)}%"></i></div></article>
      <article><span>PRÓXIMA PROVA</span><strong>${snapshot.examReady ? "Disponível" : `Dia ${snapshot.nextExamDay}`}</strong><small>${examDateLabel(snapshot)}</small></article>
      <article><span>BOLSAS ACUMULADAS</span><strong>R$ ${snapshot.totalScholarship.toFixed(2)}</strong><small>${lastExamLabel(snapshot)}</small></article>
    </section>
    <p class="college-study-note">A nota mínima é 60. Notas maiores liberam bolsas mais altas. A chance considera sua média geral e as horas estudadas no ciclo da prova.</p>`;
}

function runCollegeStudyActivity(
  runtime: AnyInstance,
  originalAction: () => void | Promise<void>,
  hours: 2 | 4
): void {
  const task = window.__creatorLifeComputerTask;
  runtime.closeModal();
  if (!task?.runActivity) {
    void originalAction();
    return;
  }

  void task.runActivity({
    title: "Estudando para a faculdade",
    detail: "Revisando conteúdos e resolvendo exercícios",
    progressLabel: `Preparação acadêmica · ${hours} horas`,
    hours,
    durationMs: hours === 4 ? 5200 : 3400,
    eyebrow: "FACULDADE",
    icon: "▣",
    onComplete: originalAction,
    completionTitle: "Sessão acadêmica concluída",
    completionDetail: `${hours} horas foram adicionadas à preparação da próxima prova.`
  });
}

function runCollegeExamActivity(runtime: AnyInstance): void {
  const task = window.__creatorLifeComputerTask;
  const execute = (): void => {
    const result = window.__creatorLifeCollege?.takeExam();
    if (!result) return;
    if (!result.error) runtime.advanceTime(2);
    runtime.renderHud();
    runtime.showToast(result.message, result.error ? "warning" : result.passed ? "success" : "warning");
  };

  runtime.closeModal();
  if (!task?.runActivity) {
    execute();
    return;
  }

  void task.runActivity({
    title: "Realizando prova da faculdade",
    detail: "Respondendo questões e revisando respostas",
    progressLabel: "Avaliação acadêmica · 2 horas",
    hours: 2,
    durationMs: 4400,
    eyebrow: "PROVA DA FACULDADE",
    icon: "✓",
    onComplete: execute,
    completionTitle: "Prova finalizada",
    completionDetail: "A nota e a possível bolsa foram calculadas."
  });
}

function patchDynamicGoals(): void {
  const prototype = ProgressionSystem.prototype as AnyInstance;
  if (prototype[GOALS_PATCH]) return;
  prototype[GOALS_PATCH] = true;

  const originalRestore = prototype.restore;
  const originalAdvance = prototype.advance;
  const originalClaimGoal = prototype.claimGoal;

  prototype.restore = function (saved: AnyInstance): void {
    originalRestore.call(this, saved);
    activeProgression = this;
    this.save.dynamicGoalState = normalizeDynamicGoals(
      this,
      saved?.dynamicGoalState
    );
    updateGoalQuickSummary(this);
  };

  prototype.advance = function (hours: number): void {
    originalAdvance.call(this, hours);
    ensureDynamicGoals(this);
    updateGoalQuickSummary(this);
  };

  prototype.claimGoal = function (id: string): ActionResult {
    if (!id.startsWith("dynamic-goal-")) {
      return originalClaimGoal.call(this, id) as ActionResult;
    }
    return claimDynamicGoal(this, id);
  };
}

function normalizeDynamicGoals(
  instance: AnyInstance,
  saved: Partial<DynamicGoalState> | null | undefined
): DynamicGoalState {
  const staticClaims = Array.isArray(instance.save.claimedGoals)
    ? instance.save.claimedGoals.length
    : 0;
  const state: DynamicGoalState = {
    version: 1,
    level: Math.max(1, Math.floor(finite(saved?.level, staticClaims + 1))),
    totalClaimed: Math.max(0, Math.floor(finite(saved?.totalClaimed, 0))),
    totalRewards: Math.max(0, finite(saved?.totalRewards, 0)),
    goals: Array.isArray(saved?.goals)
      ? saved.goals.filter(isValidDynamicGoal).map((goal) => ({ ...goal }))
      : []
  };

  while (state.goals.length < 4) {
    const slot = state.goals.length;
    state.goals.push(createDynamicGoal(instance, state, slot));
  }
  state.goals = state.goals.slice(0, 4);
  return state;
}

function ensureDynamicGoals(instance: AnyInstance): DynamicGoalState {
  if (!instance.save.dynamicGoalState) {
    instance.save.dynamicGoalState = normalizeDynamicGoals(instance, null);
  }
  const state = instance.save.dynamicGoalState as DynamicGoalState;
  while (state.goals.length < 4) {
    state.goals.push(createDynamicGoal(instance, state, state.goals.length));
  }
  return state;
}

function createDynamicGoal(
  instance: AnyInstance,
  goalState: DynamicGoalState,
  slot: number
): DynamicGoal {
  const tier = Math.max(1, goalState.level + Math.floor(slot / 2));
  let metric = GOAL_TRACKS[(slot + goalState.totalClaimed) % GOAL_TRACKS.length];

  for (let attempt = 0; attempt < GOAL_TRACKS.length; attempt += 1) {
    if (metricAvailable(instance, metric)) break;
    metric = GOAL_TRACKS[(GOAL_TRACKS.indexOf(metric) + 1) % GOAL_TRACKS.length];
  }

  const startValue = metricValue(instance, metric);
  const delta = metricDelta(instance, metric, tier);
  const targetValue = startValue + delta;
  const reward = goalReward(metric, delta, tier);
  const copy = goalCopy(metric, delta, tier);

  return {
    id: `dynamic-goal-${Date.now()}-${slot}-${Math.random().toString(36).slice(2, 7)}`,
    slot,
    metric,
    tier,
    startValue,
    targetValue,
    reward,
    label: copy.label,
    description: copy.description
  };
}

function claimDynamicGoal(instance: AnyInstance, id: string): ActionResult {
  const state = ensureDynamicGoals(instance);
  const index = state.goals.findIndex((goal) => goal.id === id);
  const goal = state.goals[index];
  if (!goal) {
    return { error: "Este objetivo não está mais ativo.", message: "Este objetivo não está mais ativo." };
  }

  const progress = dynamicGoalProgress(instance, goal);
  if (progress < goal.targetValue - goal.startValue) {
    return { error: "Este objetivo ainda não foi concluído.", message: "Este objetivo ainda não foi concluído." };
  }

  instance.host.getState().money += goal.reward;
  state.totalClaimed += 1;
  state.totalRewards += goal.reward;
  state.level += 1;
  state.goals[index] = createDynamicGoal(instance, state, goal.slot);
  instance.host.onChange();
  updateGoalQuickSummary(instance);

  return {
    error: null,
    message: `${goal.label} concluído. +R$ ${goal.reward.toFixed(2)}. Um objetivo maior foi liberado.`
  };
}

function installGoalPanelInterception(): void {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null;
      const goalButton = target?.closest<HTMLElement>(
        '[data-progress-panel="goals"]'
      );
      if (!goalButton || !activeProgression) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      openDynamicGoalsPanel(activeProgression);
    },
    true
  );
}

function openDynamicGoalsPanel(instance: AnyInstance): void {
  const overlay = document.querySelector<HTMLElement>(".progress-side-overlay");
  const title = document.getElementById("progress-side-title");
  const content = document.getElementById("progress-side-content");
  if (!overlay || !title || !content) return;

  title.textContent = "Objetivos e recompensas";
  content.innerHTML = renderDynamicGoals(instance);
  content
    .querySelectorAll<HTMLButtonElement>("[data-claim-dynamic-goal]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const result = instance.claimGoal(
          button.dataset.claimDynamicGoal ?? ""
        ) as ActionResult;
        instance.host.onEvent(
          result.message,
          result.error ? "warning" : "success"
        );
        openDynamicGoalsPanel(instance);
      });
    });

  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");
}

function renderDynamicGoals(instance: AnyInstance): string {
  const state = ensureDynamicGoals(instance);
  const ready = state.goals.filter(
    (goal) => dynamicGoalProgress(instance, goal) >= goal.targetValue - goal.startValue
  ).length;

  return `
    <section class="dynamic-goal-overview">
      <article><span>NÍVEL DO FUNIL</span><strong>${state.level}</strong><p>As próximas metas ficam maiores conforme você resgata recompensas.</p></article>
      <article><span>OBJETIVOS CONCLUÍDOS</span><strong>${state.totalClaimed}</strong><p>Recompensas já resgatadas não retornam à lista.</p></article>
      <article><span>TOTAL RECEBIDO</span><strong>R$ ${state.totalRewards.toFixed(2)}</strong><p>${ready} recompensa${ready === 1 ? "" : "s"} disponível${ready === 1 ? "" : "is"} agora.</p></article>
    </section>
    <div class="dynamic-goal-list">
      ${state.goals.map((goal) => renderDynamicGoalCard(instance, goal)).join("")}
    </div>`;
}

function renderDynamicGoalCard(instance: AnyInstance, goal: DynamicGoal): string {
  const target = goal.targetValue - goal.startValue;
  const progress = dynamicGoalProgress(instance, goal);
  const percentage = Math.min(100, (progress / Math.max(1, target)) * 100);
  const complete = progress >= target;

  return `
    <article class="dynamic-goal-card ${complete ? "is-complete" : ""}">
      <div class="dynamic-goal-card__heading"><div><span>NÍVEL ${goal.tier} · ${goalMetricLabel(goal.metric)}</span><strong>${escapeHtml(goal.label)}</strong></div><b>R$ ${goal.reward}</b></div>
      <p>${escapeHtml(goal.description)}</p>
      <div class="dynamic-goal-progress"><i style="width:${percentage}%"></i></div>
      <div class="dynamic-goal-card__footer"><small>${Math.min(progress, target).toFixed(0)} / ${target.toFixed(0)}</small>${complete ? `<button type="button" data-claim-dynamic-goal="${goal.id}">Resgatar e liberar próxima</button>` : '<span>EM ANDAMENTO</span>'}</div>
    </article>`;
}

function dynamicGoalProgress(instance: AnyInstance, goal: DynamicGoal): number {
  return Math.max(0, metricValue(instance, goal.metric) - goal.startValue);
}

function metricValue(instance: AnyInstance, metric: GoalMetric): number {
  const state = instance.host.getState();
  switch (metric) {
    case "videos":
      return Number(state.videos ?? 0);
    case "subscribers":
      return Number(state.subscribers ?? 0);
    case "freelance":
      return Number(instance.save.freelanceCompleted ?? 0);
    case "investment":
      return Number(instance.save.totalInvested ?? 0);
    case "courses":
      return instance.save.courses.filter((course: AnyInstance) => course.completed).length;
    case "skills":
      return Object.values(instance.save.skills).reduce(
        (sum: number, value) => sum + Number(value ?? 0),
        0
      );
    case "reputation":
      return Math.max(
        ...Object.values(instance.save.reputations).map((value) => Number(value ?? 0))
      );
  }
}

function metricAvailable(instance: AnyInstance, metric: GoalMetric): boolean {
  if (metric === "courses") {
    return metricValue(instance, metric) < instance.save.courses.length;
  }
  if (metric === "skills") return metricValue(instance, metric) < 30;
  if (metric === "reputation") return metricValue(instance, metric) < 100;
  return true;
}

function metricDelta(
  instance: AnyInstance,
  metric: GoalMetric,
  tier: number
): number {
  switch (metric) {
    case "videos":
      return Math.max(3, Math.round(3 * Math.pow(1.32, tier - 1)));
    case "subscribers":
      return Math.max(25, Math.round(25 * Math.pow(1.62, tier - 1)));
    case "freelance":
      return Math.max(2, Math.round(2 * Math.pow(1.22, tier - 1)));
    case "investment":
      return Math.max(250, Math.round(250 * Math.pow(1.42, tier - 1) / 10) * 10);
    case "courses":
      return Math.max(1, Math.min(instance.save.courses.length - metricValue(instance, metric), 1 + Math.floor(tier / 5)));
    case "skills":
      return Math.max(1, Math.min(30 - metricValue(instance, metric), 1 + Math.floor(tier / 6)));
    case "reputation":
      return Math.max(3, Math.min(100 - metricValue(instance, metric), 5 + Math.floor(tier * 1.4)));
  }
}

function goalReward(metric: GoalMetric, delta: number, tier: number): number {
  const raw =
    metric === "videos"
      ? delta * 28
      : metric === "subscribers"
        ? Math.sqrt(delta) * 32
        : metric === "freelance"
          ? delta * 85
          : metric === "investment"
            ? delta * 0.2
            : metric === "courses"
              ? delta * 220
              : metric === "skills"
                ? delta * 240
                : delta * 34;
  return Math.max(80, Math.round((raw + tier * 38) / 10) * 10);
}

function goalCopy(
  metric: GoalMetric,
  delta: number,
  tier: number
): { label: string; description: string } {
  const suffix = tier >= 8 ? "avançado" : tier >= 4 ? "em expansão" : "inicial";
  switch (metric) {
    case "videos":
      return { label: `Catálogo ${suffix}`, description: `Publique ${delta} novos vídeos.` };
    case "subscribers":
      return { label: `Público ${suffix}`, description: `Conquiste ${delta.toLocaleString("pt-BR")} novos inscritos.` };
    case "freelance":
      return { label: `Carreira ${suffix}`, description: `Conclua ${delta} novos trabalhos freelance.` };
    case "investment":
      return { label: `Estrutura ${suffix}`, description: `Invista mais R$ ${delta.toFixed(0)} em equipamentos ou no quarto.` };
    case "courses":
      return {
        label: `Formação ${suffix}`,
        description:
          delta === 1
            ? "Conclua 1 novo curso profissional."
            : `Conclua ${delta} novos cursos profissionais.`
      };
    case "skills":
      return { label: `Domínio ${suffix}`, description: `Ganhe ${delta} novo${delta === 1 ? "" : "s"} nível${delta === 1 ? "" : "is"} somando todas as habilidades.` };
    case "reputation":
      return { label: `Reconhecimento ${suffix}`, description: `Aumente em ${delta} pontos sua maior reputação.` };
  }
}

function goalMetricLabel(metric: GoalMetric): string {
  return {
    videos: "CONTEÚDO",
    subscribers: "AUDIÊNCIA",
    freelance: "CARREIRA",
    investment: "ESTRUTURA",
    courses: "FORMAÇÃO",
    skills: "HABILIDADES",
    reputation: "REPUTAÇÃO"
  }[metric];
}

function isValidDynamicGoal(goal: AnyInstance): goal is DynamicGoal {
  return (
    goal &&
    typeof goal.id === "string" &&
    typeof goal.metric === "string" &&
    Number.isFinite(goal.startValue) &&
    Number.isFinite(goal.targetValue) &&
    Number.isFinite(goal.reward)
  );
}

function installQuickSummaryUpdater(): void {
  window.setInterval(() => {
    if (activeLife) updateCollegeQuickSummary(collegeSnapshot(activeLife));
    if (activeProgression) updateGoalQuickSummary(activeProgression);
  }, 900);
}

function updateCollegeQuickSummary(snapshot: CollegeSnapshot): void {
  const meta = document.querySelector<HTMLElement>(
    '[data-quick-meta="college"]'
  );
  const item = document.querySelector<HTMLElement>(
    '[data-quick-action="college"]'
  );
  if (meta) {
    meta.textContent = `Média ${snapshot.grade.toFixed(1)} · ${examDateLabel(snapshot)}`;
  }
  item?.classList.toggle("is-college-ready", snapshot.examReady);
}

function updateGoalQuickSummary(instance: AnyInstance): void {
  const state = ensureDynamicGoals(instance);
  const ready = state.goals.filter(
    (goal) => dynamicGoalProgress(instance, goal) >= goal.targetValue - goal.startValue
  ).length;
  const text = ready
    ? `${ready} recompensa${ready === 1 ? "" : "s"} para resgatar`
    : `Nível ${state.level} · 4 metas ativas`;
  const hidden = document.getElementById("progress-goal-count");
  const quick = document.querySelector<HTMLElement>('[data-quick-meta="goals"]');
  if (hidden) hidden.textContent = text;
  if (quick) quick.textContent = text;
}

function examDateLabel(snapshot: CollegeSnapshot): string {
  return snapshot.examReady
    ? "prova disponível"
    : snapshot.daysUntilExam === 1
      ? "prova amanhã"
      : `prova em ${snapshot.daysUntilExam} dias`;
}

function lastExamLabel(snapshot: CollegeSnapshot): string {
  if (snapshot.lastExamScore === null) return "Nenhuma prova realizada";
  return `${snapshot.lastExamPassed ? "Aprovado" : "Reprovado"} · nota ${snapshot.lastExamScore.toFixed(1)}${snapshot.lastExamReward > 0 ? ` · +R$ ${snapshot.lastExamReward.toFixed(0)}` : ""}`;
}

function finite(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function random(minimum: number, maximum: number): number {
  return minimum + Math.random() * (maximum - minimum);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
