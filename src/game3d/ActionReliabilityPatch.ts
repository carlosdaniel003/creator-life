import "../action-reliability.css";
import { COURSES } from "./ProgressionData";
import "./ProgressionExperiencePatch";
import { ProgressionSystem } from "./ProgressionSystem";
import { CreatorLife3D } from "./CreatorLife3D";

type ToastType = "success" | "warning" | "neutral";

interface RuntimeState {
  energy: number;
  hunger: number;
  thirst?: number;
  creativity: number;
  money: number;
  subscribers: number;
  totalViews: number;
}

interface Runtime {
  container: HTMLElement;
  state: RuntimeState;
  showModal: (title: string, body: string, actions: ModalAction[]) => void;
  closeModal: () => void;
  showToast: (message: string, type: ToastType) => void;
  advanceTime: (hours: number) => void;
  renderHud: () => void;
  interact?: (id: string, source: string) => void;
}

interface ModalAction {
  label: string;
  action: () => void | Promise<void>;
  secondary?: boolean;
}

interface ActionResult {
  error: string | null;
  message?: string;
}

type ProgressionInstance = any;

let activeRuntime: Runtime | null = null;

patchModalActions();
patchCourseActions();

function patchModalActions(): void {
  const prototype = CreatorLife3D.prototype as any;
  if (prototype.__actionReliabilityPatched) return;
  prototype.__actionReliabilityPatched = true;

  const originalShowModal = prototype.showModal;
  prototype.showModal = function (
    this: Runtime,
    title: string,
    body: string,
    actions: ModalAction[]
  ): void {
    activeRuntime = this;
    const wrapped = actions.map((action) => ({
      ...action,
      action:
        normalizeLabel(action.label) === "fazer live"
          ? () => void runReliableLive(this)
          : () => safeRunAction(this, action)
    }));

    originalShowModal.call(this, title, body, wrapped);
    requestAnimationFrame(() => {
      this.container
        .querySelectorAll<HTMLButtonElement>("#modal-actions button")
        .forEach((button) => {
          button.dataset.actionReady = "true";
          button.removeAttribute("aria-disabled");
        });
    });
  };
}

function safeRunAction(runtime: Runtime, action: ModalAction): void {
  try {
    const result = action.action();
    if (result instanceof Promise) {
      void result.catch((error) => showActionError(runtime, errorMessage(error)));
    }
  } catch (error) {
    showActionError(runtime, errorMessage(error));
  }
}

async function runReliableLive(runtime: Runtime): Promise<void> {
  const manager = (window as any).__creatorLifeChannelManagement;
  const simulation = manager?.getSimulation?.();
  const management = manager?.getState?.();
  if (!simulation || !management) {
    showActionError(runtime, "O canal ainda não terminou de carregar.");
    return;
  }

  if (runtime.state.energy < 18) {
    showActionError(runtime, "A live exige pelo menos 18 de energia.");
    return;
  }
  if (runtime.state.hunger < 20 || Number(runtime.state.thirst ?? 100) < 20) {
    showActionError(runtime, "Coma e beba água antes de iniciar a transmissão.");
    return;
  }

  const task = (window as any).__creatorLifeComputerTask;
  if (task?.isActive?.()) {
    showActionError(runtime, "Conclua a atividade atual antes de iniciar a live.");
    return;
  }

  const completeLive = (): void => {
    const authority = Math.max(
      0,
      ...Object.values(simulation.nicheAuthority ?? {}).map((value) =>
        Number(value)
      )
    );
    const viewers = Math.max(
      4,
      Math.round(
        4 +
          Math.sqrt(runtime.state.subscribers + 1) *
            (0.9 + Number(management.loyalty ?? 0) / 90) +
          Number(management.community ?? 0) * 0.22 +
          authority * 0.12
      )
    );
    const views = Math.round(viewers * random(1.5, 2.5));
    const subscribers = Math.max(
      0,
      Math.floor(
        views * (0.012 + Number(management.loyalty ?? 0) * 0.00008)
      )
    );
    const comments = Math.max(2, Math.round(viewers * random(0.35, 0.75)));
    const watchHours = viewers * random(0.65, 1.35);
    const donations = random(4, 12) + viewers * random(0.18, 0.55);
    const ads = runtime.state.subscribers >= 1000 ? views * 0.003 : 0;
    const income = Math.round((donations + ads) * 100) / 100;

    runtime.state.energy = Math.max(0, runtime.state.energy - 18);
    runtime.state.creativity = Math.max(0, runtime.state.creativity - 4);
    runtime.state.money += income;
    runtime.state.totalViews += views;
    runtime.state.subscribers += subscribers;

    management.liveCount = Number(management.liveCount ?? 0) + 1;
    management.liveViews = Number(management.liveViews ?? 0) + views;
    management.liveWatchHours =
      Number(management.liveWatchHours ?? 0) + watchHours;
    management.liveSubscribers =
      Number(management.liveSubscribers ?? 0) + subscribers;
    management.liveRevenue = Number(management.liveRevenue ?? 0) + income;
    management.loyalty = clamp(Number(management.loyalty ?? 0) + 3.2, 0, 100);
    management.community = clamp(
      Number(management.community ?? 0) + 4.5,
      0,
      100
    );
    management.channelReputation = clamp(
      Number(management.channelReputation ?? 0) + 1.2,
      0,
      100
    );
    management.conversionBoostUntil = Math.max(
      Number(management.conversionBoostUntil ?? 0),
      Number(simulation.channelHours ?? 0) + 48
    );

    (window as any).__creatorLifeReputationBridge?.add?.(1.8, 0.4);
    simulation.host.onChange();
    runtime.advanceTime(2);
    runtime.renderHud();
    runtime.showToast(
      `Live concluída: ${views} views, ${comments} mensagens, +${subscribers} inscritos e R$ ${income.toFixed(2)}.`,
      "success"
    );
  };

  runtime.showToast("Preparando a transmissão ao vivo...", "neutral");
  runtime.closeModal();

  if (!task?.runActivity) {
    completeLive();
    return;
  }

  try {
    const started = Boolean(
      await task.runActivity({
        title: "Transmitindo ao vivo",
        detail: "Conversando com o público e respondendo o chat",
        progressLabel: "Live em andamento · 2 horas",
        hours: 2,
        durationMs: 4800,
        eyebrow: "TRANSMISSÃO AO VIVO",
        icon: "●",
        onComplete: completeLive,
        completionTitle: "Live encerrada",
        completionDetail: "Doações, público e engajamento foram contabilizados."
      })
    );
    if (!started) {
      showActionError(runtime, "A atividade atual impediu o início da live.");
    }
  } catch (error) {
    showActionError(runtime, errorMessage(error));
  }
}

function patchCourseActions(): void {
  const prototype = ProgressionSystem.prototype as any;
  if (prototype.__courseActionReliabilityPatched) return;
  prototype.__courseActionReliabilityPatched = true;

  const originalRestore = prototype.restore;
  prototype.restore = function (
    this: ProgressionInstance,
    ...args: unknown[]
  ): void {
    originalRestore.apply(this, args);
    installCourseBridge(this);
  };
}

function installCourseBridge(instance: ProgressionInstance): void {
  const bridge = (window as any).__creatorLifeProgressionBridge;
  if (!bridge) return;

  bridge.bindCourseEvents = (root: HTMLElement): void => {
    root
      .querySelectorAll<HTMLButtonElement>("[data-enroll-course-library]")
      .forEach((button) => {
        if (button.dataset.actionReady === "true") return;
        button.dataset.actionReady = "true";
        button.addEventListener("click", () => {
          const result = instance.enrollCourse(
            button.dataset.enrollCourseLibrary ?? ""
          ) as ActionResult;
          refreshCoursePanel(
            root,
            result.error ?? result.message ?? "Matrícula atualizada."
          );
        });
      });

    root
      .querySelectorAll<HTMLButtonElement>("[data-study-course-library]")
      .forEach((button) => {
        if (button.dataset.actionReady === "true") return;
        button.dataset.actionReady = "true";
        button.addEventListener("click", () => {
          const hours: 2 | 4 = Number(button.dataset.hours) === 4 ? 4 : 2;
          void runCourseStudy(
            instance,
            root,
            button.dataset.studyCourseLibrary ?? "",
            hours,
            button
          );
        });
      });
  };
}

async function runCourseStudy(
  instance: ProgressionInstance,
  root: HTMLElement,
  courseId: string,
  hours: 2 | 4,
  button: HTMLButtonElement
): Promise<void> {
  const course = COURSES.find((item) => item.id === courseId);
  const progress = instance.save?.courses?.find(
    (item: { courseId: string }) => item.courseId === courseId
  );
  const state = instance.host.getState();

  if (!course || !progress || !progress.enrolled || progress.completed) {
    refreshCoursePanel(root, "Este curso não está disponível para estudo.");
    return;
  }

  const energyCost = hours === 2 ? 9 : 19;
  if (state.energy < energyCost) {
    refreshCoursePanel(
      root,
      `Você precisa de ${energyCost} de energia para esta sessão.`
    );
    return;
  }
  if (state.hunger < 16 || Number(state.thirst ?? 100) < 16) {
    refreshCoursePanel(root, "Coma e beba água antes de estudar o curso.");
    return;
  }

  const runtime = activeRuntime;
  const task = (window as any).__creatorLifeComputerTask;
  button.disabled = true;

  if (!runtime || !task?.runActivity) {
    const direct = instance.studyCourse(courseId, hours) as ActionResult;
    refreshCoursePanel(
      root,
      direct.error ?? direct.message ?? "Sessão concluída."
    );
    button.disabled = false;
    return;
  }

  runtime.closeModal();
  let courseResult: ActionResult = {
    error: null,
    message: "Sessão de curso concluída."
  };

  try {
    const started = Boolean(
      await task.runActivity({
        title: `Estudando ${course.name}`,
        detail: "Assistindo às aulas e praticando o conteúdo",
        progressLabel: `Curso profissional · ${hours} horas`,
        hours,
        durationMs: hours === 4 ? 5200 : 3400,
        eyebrow: "CURSO PROFISSIONAL",
        icon: "✎",
        onComplete: () => {
          courseResult = instance.studyCourse(courseId, hours) as ActionResult;
        },
        completionTitle: "Sessão de curso concluída",
        completionDetail: `${hours} horas de formação foram processadas.`
      })
    );

    if (!started) {
      runtime.showToast("Conclua a atividade atual antes de estudar.", "warning");
      reopenCourses(runtime, "A sessão não pôde ser iniciada.");
      return;
    }

    const message =
      courseResult.error ?? courseResult.message ?? "Sessão concluída.";
    runtime.showToast(message, courseResult.error ? "warning" : "success");
    reopenCourses(runtime, message);
  } catch (error) {
    const message = errorMessage(error);
    runtime.showToast(message, "warning");
    reopenCourses(runtime, message);
  }
}

function refreshCoursePanel(root: HTMLElement, message: string): void {
  const bridge = (window as any).__creatorLifeProgressionBridge;
  const panel = root.querySelector<HTMLElement>(
    '[data-learning-panel="courses"]'
  );
  if (!bridge || !panel) {
    showActionError(activeRuntime, message);
    return;
  }

  panel.innerHTML = `${bridge.renderCoursesHtml(message)}${bridge.renderSkillsHtml()}`;
  root.querySelectorAll<HTMLElement>("[data-learning-panel]").forEach((item) => {
    item.hidden = item.dataset.learningPanel !== "courses";
  });
  root.querySelectorAll<HTMLElement>("[data-learning-tab]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.learningTab === "courses");
  });
  bridge.bindCourseEvents(root, () => undefined);
}

function reopenCourses(runtime: Runtime, message: string): void {
  runtime.interact?.("shelf", "manual");
  requestAnimationFrame(() => {
    const root = runtime.container;
    root
      .querySelector<HTMLButtonElement>('[data-learning-tab="courses"]')
      ?.click();
    const panel = root.querySelector<HTMLElement>(
      '[data-learning-panel="courses"]'
    );
    if (!panel) return;

    let element = panel.querySelector<HTMLElement>(".learning-message");
    if (!element) {
      element = document.createElement("p");
      element.className = "learning-message action-reliability-message";
      panel.prepend(element);
    }
    element.textContent = message;
  });
}

function showActionError(runtime: Runtime | null, message: string): void {
  if (!runtime) return;
  runtime.showToast(message, "warning");
  const body = runtime.container.querySelector<HTMLElement>("#modal-body");
  if (!body) return;

  let element = body.querySelector<HTMLElement>(".action-reliability-message");
  if (!element) {
    element = document.createElement("p");
    element.className = "action-reliability-message";
    body.prepend(element);
  }
  element.textContent = message;
}

function normalizeLabel(label: string): string {
  return label.trim().toLocaleLowerCase("pt-BR");
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "A ação não pôde ser concluída. Tente novamente.";
}

function random(minimum: number, maximum: number): number {
  return minimum + Math.random() * (maximum - minimum);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
