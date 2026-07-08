import { LifeSimulation } from "./LifeSimulation";
import { ProgressionSystem } from "./ProgressionSystem";

type AnyInstance = any;

patchExamReminderFrequency();
patchDynamicGoalLimits();

function patchExamReminderFrequency(): void {
  const prototype = LifeSimulation.prototype as AnyInstance;
  if (prototype.__collegeReminderSafeguardPatched) return;
  prototype.__collegeReminderSafeguardPatched = true;

  const originalProcessNewDay = prototype.processNewDay;
  prototype.processNewDay = function (day: number): void {
    const expansion = this.__collegeExpansion;
    const reminderAlreadySent =
      expansion &&
      day > Number(expansion.nextExamDay ?? 0) &&
      Number(expansion.examReminderDay ?? 0) >= Number(expansion.nextExamDay ?? 0);

    if (!reminderAlreadySent) {
      originalProcessNewDay.call(this, day);
      return;
    }

    const originalOnEvent = this.host.onEvent;
    this.host.onEvent = (
      message: string,
      type: "success" | "warning" | "neutral"
    ): void => {
      if (
        message.startsWith("A prova ") &&
        message.includes("da faculdade está disponível")
      ) {
        return;
      }
      originalOnEvent.call(this.host, message, type);
    };

    try {
      originalProcessNewDay.call(this, day);
      expansion.examReminderDay = expansion.nextExamDay;
    } finally {
      this.host.onEvent = originalOnEvent;
    }
  };
}

function patchDynamicGoalLimits(): void {
  const prototype = ProgressionSystem.prototype as AnyInstance;
  if (prototype.__dynamicGoalLimitSafeguardPatched) return;
  prototype.__dynamicGoalLimitSafeguardPatched = true;

  const originalRestore = prototype.restore;
  const originalAdvance = prototype.advance;

  prototype.restore = function (saved: unknown): void {
    originalRestore.call(this, saved);
    normalizeGoalLimits(this);
  };

  prototype.advance = function (hours: number): void {
    originalAdvance.call(this, hours);
    normalizeGoalLimits(this);
  };
}

function normalizeGoalLimits(instance: AnyInstance): void {
  const goalState = instance.save?.dynamicGoalState;
  if (!goalState || !Array.isArray(goalState.goals)) return;

  const state = instance.host.getState();
  const reputations = Object.values(instance.save.reputations ?? {}).map((value) =>
    Number(value ?? 0)
  );
  const reputation = reputations.length ? Math.max(...reputations) : 0;

  goalState.goals.forEach((goal: AnyInstance) => {
    if (goal.metric !== "reputation") return;

    if (Number(goal.startValue ?? 0) >= 100) {
      const videos = Number(state.videos ?? 0);
      const tier = Math.max(1, Number(goal.tier ?? goalState.level ?? 1));
      const delta = Math.max(3, Math.round(3 * Math.pow(1.32, tier - 1)));
      goal.metric = "videos";
      goal.startValue = videos;
      goal.targetValue = videos + delta;
      goal.label = tier >= 8 ? "Catálogo avançado" : "Catálogo em expansão";
      goal.description = `Publique ${delta} novos vídeos.`;
      goal.reward = Math.max(80, Math.round((delta * 28 + tier * 38) / 10) * 10);
      return;
    }

    goal.startValue = Math.min(Number(goal.startValue ?? reputation), reputation);
    goal.targetValue = Math.min(
      100,
      Math.max(goal.startValue + 1, Number(goal.targetValue ?? reputation + 1))
    );
  });
}
