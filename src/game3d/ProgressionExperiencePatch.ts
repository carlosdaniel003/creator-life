import type {
  EquipmentSlot,
  PlayerState,
  ProgressionSave,
  ReputationId,
  RoomUpgradeSlot,
  SkillId
} from "../game/types";
import "../progression-experience.css";
import {
  COURSES,
  EQUIPMENT_LABELS,
  EQUIPMENT_TIERS,
  GOALS,
  REPUTATION_LABELS,
  ROOM_LABELS,
  ROOM_TIERS,
  SKILL_LABELS
} from "./ProgressionData";
import { ProgressionSystem } from "./ProgressionSystem";

interface ActionResult {
  error: string | null;
  message?: string;
}

interface ProgressionBridge {
  renderCoursesHtml: (message?: string) => string;
  bindCourseEvents: (
    root: HTMLElement,
    reopen: (message: string) => void
  ) => void;
  renderSkillsHtml: () => string;
}

declare global {
  interface Window {
    __creatorLifeProgressionBridge?: ProgressionBridge;
  }
}

const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "cpu",
  "gpu",
  "ram",
  "storage",
  "monitor",
  "microphone",
  "camera",
  "internet"
];
const ROOM_SLOTS: RoomUpgradeSlot[] = [
  "bed",
  "chair",
  "desk",
  "lighting",
  "acoustic",
  "decor"
];
const SKILLS: SkillId[] = [
  "editing",
  "communication",
  "design",
  "scripting",
  "technology",
  "marketing"
];
const REPUTATIONS: ReputationId[] = ["audience", "professional", "academic"];
const SAVE_KEYS = [
  "creator-life-save-v5",
  "creator-life-save-v4",
  "creator-life-save-v3",
  "creator-life-save-v2",
  "creator-life-save-v1"
];
const PATCH_FLAG = Symbol.for("creator-life-progression-experience-patched");

type PatchedProgression = ProgressionSystem & {
  save: ProgressionSave;
  host: {
    getState: () => PlayerState & { thirst: number; health?: number };
    onChange: () => void;
    onEvent: (
      message: string,
      type: "success" | "warning" | "neutral"
    ) => void;
  };
  __experienceHudInstalled?: boolean;
  __experienceHudTimer?: number;
  __deathShown?: boolean;
};

const prototype = ProgressionSystem.prototype as ProgressionSystem["prototype"] & {
  [PATCH_FLAG]?: boolean;
};

if (!prototype[PATCH_FLAG]) {
  prototype[PATCH_FLAG] = true;

  const originalRestore = ProgressionSystem.prototype.restore;
  const originalAdvance = ProgressionSystem.prototype.advance;
  const originalRenderHubHtml = ProgressionSystem.prototype.renderHubHtml;
  const originalBindHubEvents = ProgressionSystem.prototype.bindHubEvents;

  ProgressionSystem.prototype.restore = function patchedRestore(
    this: ProgressionSystem,
    saved
  ): void {
    originalRestore.call(this, saved);
    const instance = this as PatchedProgression;
    const state = instance.host.getState();
    state.health = Number.isFinite(state.health)
      ? Math.max(0, Math.min(100, Number(state.health)))
      : 100;
    installExperienceHud(instance);
    registerBridge(instance);
    renderExperienceHud(instance);
  };

  ProgressionSystem.prototype.advance = function patchedAdvance(
    this: ProgressionSystem,
    hours: number
  ): void {
    originalAdvance.call(this, hours);
    const instance = this as PatchedProgression;
    applyHealthSimulation(instance, hours);
    renderExperienceHud(instance);
  };

  ProgressionSystem.prototype.renderHubHtml = function patchedStore(
    this: ProgressionSystem,
    message = ""
  ): string {
    return renderMarketplace(this as PatchedProgression, message);
  };

  ProgressionSystem.prototype.bindHubEvents = function patchedStoreEvents(
    this: ProgressionSystem,
    root: HTMLElement,
    reopen: (message: string) => void
  ): void {
    originalBindHubEvents.call(this, root, reopen);
    bindMarketplaceControls(root);
  };

  void originalRenderHubHtml;
}

function registerBridge(instance: PatchedProgression): void {
  window.__creatorLifeProgressionBridge = {
    renderCoursesHtml: (message = "") => renderCoursesHtml(instance, message),
    bindCourseEvents: (root, reopen) =>
      bindCourseEvents(instance, root, reopen),
    renderSkillsHtml: () => renderSkillsHtml(instance)
  };
}

function applyHealthSimulation(
  instance: PatchedProgression,
  hours: number
): void {
  const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  if (safeHours <= 0) return;

  const state = instance.host.getState();
  let health = Number.isFinite(state.health) ? Number(state.health) : 100;
  const thirst = Number.isFinite(state.thirst) ? state.thirst : 100;
  let damagePerHour = 0;

  if (state.hunger <= 0) damagePerHour += 2.4;
  else if (state.hunger < 15) damagePerHour += 0.6;

  if (thirst <= 0) damagePerHour += 3.5;
  else if (thirst < 15) damagePerHour += 0.9;

  if (state.energy <= 0) damagePerHour += 0.35;

  if (damagePerHour > 0) {
    health -= damagePerHour * safeHours;
  } else if (state.hunger > 50 && thirst > 50 && state.energy > 20) {
    health += 0.22 * safeHours;
  }

  state.health = Math.max(0, Math.min(100, health));
  instance.host.onChange();

  if (state.health <= 0) showDeathScreen(instance);
}

function installExperienceHud(instance: PatchedProgression): void {
  if (instance.__experienceHudInstalled) return;
  const container = document.getElementById("game-container");
  const resourceCard = container?.querySelector<HTMLElement>(".resource-card");
  if (!container || !resourceCard) return;

  instance.__experienceHudInstalled = true;

  if (!document.getElementById("health-value")) {
    const healthRow = document.createElement("div");
    healthRow.className = "resource-row resource-row--health";
    healthRow.innerHTML = `
      <div class="resource-row__label"><span>Vida</span><strong id="health-value">100/100</strong></div>
      <div class="resource-track"><div id="health-bar" class="resource-fill resource-fill--health"></div></div>
    `;
    resourceCard.prepend(healthRow);
  }

  const dock = document.createElement("section");
  dock.className = "creator-progress-dock";
  dock.setAttribute("aria-label", "Progressão e oportunidades");
  dock.innerHTML = `
    <button type="button" data-progress-panel="status"><span>STATUS</span><strong id="progress-status-level">Nível inicial</strong></button>
    <button type="button" data-progress-panel="opportunities"><span>OPORTUNIDADES</span><strong id="progress-opportunity-count">0 disponíveis</strong></button>
    <button type="button" data-progress-panel="goals"><span>OBJETIVOS</span><strong id="progress-goal-count">0 concluídos</strong></button>
  `;
  container.append(dock);

  const overlay = document.createElement("div");
  overlay.className = "progress-side-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <aside class="progress-side-panel" aria-live="polite">
      <header><div><span>PROGRESSÃO</span><h2 id="progress-side-title">Status</h2></div><button type="button" data-close-progress-panel>×</button></header>
      <div id="progress-side-content" class="progress-side-content"></div>
    </aside>
  `;
  container.append(overlay);

  dock.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      "[data-progress-panel]"
    );
    if (!button) return;
    openProgressPanel(instance, button.dataset.progressPanel ?? "status");
  });

  overlay.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (event.target === overlay || target?.closest("[data-close-progress-panel]")) {
      overlay.classList.remove("is-visible");
      overlay.setAttribute("aria-hidden", "true");
    }
  });

  instance.__experienceHudTimer = window.setInterval(
    () => renderExperienceHud(instance),
    900
  );
}

function renderExperienceHud(instance: PatchedProgression): void {
  if (!instance.__experienceHudInstalled) return;
  const state = instance.host.getState();
  const health = Math.max(0, Math.min(100, Number(state.health ?? 100)));
  const healthValue = document.getElementById("health-value");
  const healthBar = document.getElementById("health-bar");
  if (healthValue) healthValue.textContent = `${Math.round(health)}/100`;
  if (healthBar) {
    healthBar.style.width = `${health}%`;
    healthBar.dataset.risk = health <= 20 ? "critical" : health <= 45 ? "warning" : "safe";
  }

  const skillAverage =
    SKILLS.reduce((sum, skill) => sum + instance.save.skills[skill], 0) /
    SKILLS.length;
  const availableOffers = getAvailableOffers(instance).length;
  const completedGoals = GOALS.filter(
    (goal) =>
      !instance.save.claimedGoals.includes(goal.id) &&
      getGoalProgress(instance, goal.id) >= goal.target
  ).length;

  setText("progress-status-level", `Média ${skillAverage.toFixed(1)}/5`);
  setText(
    "progress-opportunity-count",
    availableOffers > 0
      ? `${availableOffers} disponíve${availableOffers === 1 ? "l" : "is"}`
      : "Nenhuma proposta"
  );
  setText(
    "progress-goal-count",
    completedGoals > 0
      ? `${completedGoals} para resgatar`
      : "Metas em andamento"
  );
}

function openProgressPanel(
  instance: PatchedProgression,
  panel: string
): void {
  const overlay = document.querySelector<HTMLElement>(".progress-side-overlay");
  const title = document.getElementById("progress-side-title");
  const content = document.getElementById("progress-side-content");
  if (!overlay || !title || !content) return;

  if (panel === "opportunities") {
    title.textContent = "Oportunidades";
    content.innerHTML = renderOpportunities(instance);
  } else if (panel === "goals") {
    title.textContent = "Objetivos e recompensas";
    content.innerHTML = renderGoals(instance);
  } else {
    title.textContent = "Status do personagem";
    content.innerHTML = renderStatusPanel(instance);
  }

  bindSidePanelEvents(instance, content, panel);
  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");
}

function bindSidePanelEvents(
  instance: PatchedProgression,
  content: HTMLElement,
  panel: string
): void {
  content
    .querySelectorAll<HTMLButtonElement>("[data-accept-sponsor]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const result = instance.acceptSponsor(button.dataset.acceptSponsor ?? "");
        instance.host.onEvent(
          result.error ?? result.message ?? "Contrato atualizado.",
          result.error ? "warning" : "success"
        );
        openProgressPanel(instance, panel);
      });
    });

  content
    .querySelectorAll<HTMLButtonElement>("[data-claim-goal]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const result = instance.claimGoal(button.dataset.claimGoal ?? "");
        instance.host.onEvent(
          result.error ?? result.message ?? "Objetivo atualizado.",
          result.error ? "warning" : "success"
        );
        openProgressPanel(instance, panel);
      });
    });
}

function renderStatusPanel(instance: PatchedProgression): string {
  const state = instance.host.getState();
  const health = Number(state.health ?? 100);
  const risk =
    health <= 20
      ? "Risco crítico: coma, beba água e descanse imediatamente."
      : health <= 45
        ? "Vida baixa: necessidades ignoradas estão causando dano."
        : "Condição estável. Vida se recupera lentamente com necessidades altas.";

  return `
    <section class="status-life-card ${health <= 20 ? "is-critical" : ""}">
      <div><span>VIDA</span><strong>${Math.round(health)}/100</strong></div>
      <div class="status-life-track"><i style="width:${health}%"></i></div>
      <p>${risk}</p>
    </section>
    <section class="status-panel-section">
      <div class="status-panel-heading"><span>HABILIDADES</span><strong>Prática + formação</strong></div>
      <div class="status-skill-list">${SKILLS.map((skill) => renderHudSkill(instance, skill)).join("")}</div>
    </section>
    <section class="status-panel-section">
      <div class="status-panel-heading"><span>REPUTAÇÃO</span><strong>Como o mundo enxerga você</strong></div>
      <div class="status-reputation-list">${REPUTATIONS.map(
        (reputation) => `
          <article><div><span>${REPUTATION_LABELS[reputation]}</span><strong>${instance.save.reputations[reputation].toFixed(0)}/100</strong></div><div><i style="width:${instance.save.reputations[reputation]}%"></i></div></article>`
      ).join("")}</div>
    </section>
  `;
}

function renderHudSkill(instance: PatchedProgression, skill: SkillId): string {
  const level = instance.save.skills[skill];
  const xp = instance.save.skillXp[skill];
  const threshold = 100 * (level + 1);
  const completedCourses = instance.save.courses.filter((course) => {
    const definition = COURSES.find((item) => item.id === course.courseId);
    return course.completed && definition?.skill === skill;
  }).length;
  const cap = Math.min(5, 1 + completedCourses);
  return `
    <article>
      <div><span>${SKILL_LABELS[skill]}</span><strong>N${level} · limite ${cap}</strong></div>
      <div><i style="width:${Math.min(100, (xp / threshold) * 100)}%"></i></div>
      <small>${getSkillImpact(skill)}</small>
    </article>
  `;
}

function renderOpportunities(instance: PatchedProgression): string {
  const state = instance.host.getState();
  const offers = getAvailableOffers(instance);
  if (state.subscribers < 300 || instance.save.reputations.audience < 8) {
    return `
      <div class="progress-empty-state"><strong>Patrocínios ainda bloqueados</strong><p>Alcance 300 inscritos e reputação de público 8 para começar a receber propostas.</p><small>Atual: ${state.subscribers}/300 inscritos · ${instance.save.reputations.audience.toFixed(0)}/8 reputação</small></div>
    `;
  }
  if (offers.length === 0) {
    return '<div class="progress-empty-state"><strong>Nenhuma proposta ativa</strong><p>Continue publicando. Novas marcas verificam o canal diariamente.</p></div>';
  }
  return `<div class="hud-opportunity-list">${offers
    .map(
      (offer) => `
      <article class="hud-opportunity-card ${offer.id === instance.save.activeSponsorId ? "is-active" : ""}">
        <div><span>${escapeHtml(offer.brand)}</span><strong>R$ ${offer.payment.toFixed(2)}</strong></div>
        <p>${offer.requiredTheme ? `Nicho exigido: ${translateTheme(offer.requiredTheme)}` : "Nicho livre"} · qualidade mínima ${offer.minQuality}</p>
        <small>Prazo: dia ${offer.expiresDay}</small>
        ${offer.id === instance.save.activeSponsorId ? '<b>CONTRATO ATIVO</b>' : `<button type="button" data-accept-sponsor="${offer.id}">Aceitar oportunidade</button>`}
      </article>`
    )
    .join("")}</div>`;
}

function renderGoals(instance: PatchedProgression): string {
  return `<div class="hud-goal-list">${GOALS.map((goal) => {
    const progress = getGoalProgress(instance, goal.id);
    const claimed = instance.save.claimedGoals.includes(goal.id);
    const complete = progress >= goal.target;
    const percentage = Math.min(100, (progress / goal.target) * 100);
    return `
      <article class="hud-goal-card ${complete ? "is-complete" : ""}">
        <div><span>${goal.label}</span><strong>R$ ${goal.reward}</strong></div>
        <p>${goal.description}</p>
        <div class="hud-goal-progress"><i style="width:${percentage}%"></i></div>
        <small>${Math.min(progress, goal.target).toFixed(0)} / ${goal.target}</small>
        ${claimed ? '<b>RECOMPENSA RESGATADA</b>' : complete ? `<button type="button" data-claim-goal="${goal.id}">Resgatar recompensa</button>` : ""}
      </article>`;
  }).join("")}</div>`;
}

function renderMarketplace(
  instance: PatchedProgression,
  message: string
): string {
  const state = instance.host.getState();
  const averageCondition = getAverageCondition(instance);
  return `
    ${message ? `<p class="progression-message marketplace-message">${escapeHtml(message)}</p>` : ""}
    <section class="marketplace-hero">
      <div><span>CREATOR MARKET</span><h3>Equipamentos e itens para o quarto</h3><p>Compre online. Produtos novos têm condição máxima; usados custam menos e podem exigir manutenção.</p></div>
      <div class="marketplace-wallet"><span>SEU SALDO</span><strong>R$ ${state.money.toFixed(2)}</strong><small>Condição média do PC: ${averageCondition.toFixed(0)}%</small></div>
    </section>
    <nav class="marketplace-tabs" aria-label="Categorias da loja">
      <button type="button" class="is-active" data-market-filter="all">Todos</button>
      <button type="button" data-market-filter="hardware">Hardware</button>
      <button type="button" data-market-filter="environment">Ambiente</button>
      <button type="button" data-market-filter="maintenance">Manutenção</button>
      <label><span>⌕</span><input type="search" id="marketplace-search" placeholder="Buscar produto" /></label>
    </nav>
    <section class="marketplace-section" data-market-category="hardware">
      <div class="marketplace-section__heading"><div><span>TECNOLOGIA</span><h3>Hardware e equipamentos</h3></div><small>Entrega e instalação imediatas</small></div>
      <div class="marketplace-product-grid">${EQUIPMENT_SLOTS.map((slot) => renderEquipmentProduct(instance, slot)).join("")}</div>
    </section>
    <section class="marketplace-section" data-market-category="environment">
      <div class="marketplace-section__heading"><div><span>CASA E ESTÚDIO</span><h3>Ambiente de trabalho</h3></div><small>As compras aparecem no quarto 3D</small></div>
      <div class="marketplace-product-grid">${ROOM_SLOTS.map((slot) => renderRoomProduct(instance, slot)).join("")}</div>
    </section>
    <section class="marketplace-maintenance" data-market-category="maintenance">
      <div><span>ASSISTÊNCIA TÉCNICA</span><h3>Condição média: ${averageCondition.toFixed(0)}%</h3><p>Desgaste reduz velocidade, estabilidade e teto técnico. Faça manutenção antes de produções importantes.</p></div>
      <div><button type="button" data-maintenance="clean">Limpeza preventiva · R$ 35</button><button type="button" data-maintenance="full">Revisão completa · R$ 95</button></div>
    </section>
  `;
}

function renderEquipmentProduct(
  instance: PatchedProgression,
  slot: EquipmentSlot
): string {
  const level = instance.save.equipment[slot];
  const current = EQUIPMENT_TIERS[slot][level];
  const next = EQUIPMENT_TIERS[slot][level + 1];
  const condition = instance.save.equipmentCondition[slot];
  const search = `${EQUIPMENT_LABELS[slot]} ${current.name} ${next?.name ?? ""}`.toLocaleLowerCase("pt-BR");
  return `
    <article class="marketplace-product" data-market-search="${escapeHtml(search)}">
      <div class="marketplace-product__visual"><span>${productIcon(slot)}</span><b>NÍVEL ${level}</b></div>
      <div class="marketplace-product__content">
        <span>${EQUIPMENT_LABELS[slot]}</span><h4>${current.name}</h4><p>${current.description}</p>
        <div class="marketplace-condition"><span>Condição ${Math.round(condition)}%</span><div><i style="width:${condition}%"></i></div></div>
        ${next ? `<div class="marketplace-next"><small>PRÓXIMO UPGRADE</small><strong>${next.name}</strong><p>${next.description}</p></div><div class="marketplace-buy"><button type="button" data-buy-equipment="${slot}" data-used="false">Novo · R$ ${next.price}</button>${slot === "internet" ? "" : `<button type="button" class="is-secondary" data-buy-equipment="${slot}" data-used="true">Usado · R$ ${Math.round(next.price * 0.68)}</button>`}</div>` : '<b class="marketplace-max">MELHOR MODELO INSTALADO</b>'}
      </div>
    </article>`;
}

function renderRoomProduct(
  instance: PatchedProgression,
  slot: RoomUpgradeSlot
): string {
  const level = instance.save.room[slot];
  const current = ROOM_TIERS[slot][level];
  const next = ROOM_TIERS[slot][level + 1];
  const search = `${ROOM_LABELS[slot]} ${current.name} ${next?.name ?? ""}`.toLocaleLowerCase("pt-BR");
  return `
    <article class="marketplace-product marketplace-product--room" data-market-search="${escapeHtml(search)}">
      <div class="marketplace-product__visual"><span>${roomIcon(slot)}</span><b>NÍVEL ${level}</b></div>
      <div class="marketplace-product__content"><span>${ROOM_LABELS[slot]}</span><h4>${current.name}</h4><p>${current.description}</p>
      ${next ? `<div class="marketplace-next"><small>PRÓXIMA MELHORIA</small><strong>${next.name}</strong><p>${next.description}</p></div><div class="marketplace-buy"><button type="button" data-buy-room="${slot}">Comprar · R$ ${next.price}</button></div>` : '<b class="marketplace-max">AMBIENTE NO NÍVEL MÁXIMO</b>'}</div>
    </article>`;
}

function bindMarketplaceControls(root: HTMLElement): void {
  const sections = [...root.querySelectorAll<HTMLElement>("[data-market-category]")];
  const products = [...root.querySelectorAll<HTMLElement>("[data-market-search]")];
  let activeFilter = "all";

  const apply = (): void => {
    const query =
      root
        .querySelector<HTMLInputElement>("#marketplace-search")
        ?.value.trim()
        .toLocaleLowerCase("pt-BR") ?? "";
    sections.forEach((section) => {
      const category = section.dataset.marketCategory ?? "";
      section.hidden = activeFilter !== "all" && category !== activeFilter;
    });
    products.forEach((product) => {
      product.hidden = Boolean(query) && !(product.dataset.marketSearch ?? "").includes(query);
    });
  };

  root.querySelectorAll<HTMLButtonElement>("[data-market-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.marketFilter ?? "all";
      root.querySelectorAll("[data-market-filter]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      apply();
    });
  });
  root
    .querySelector<HTMLInputElement>("#marketplace-search")
    ?.addEventListener("input", apply);
}

function renderCoursesHtml(
  instance: PatchedProgression,
  message: string
): string {
  return `
    ${message ? `<p class="learning-message">${escapeHtml(message)}</p>` : ""}
    <section class="learning-overview">
      <div><span>FORMAÇÃO</span><strong>${instance.save.courses.filter((course) => course.completed).length}/${COURSES.length} cursos</strong><small>Cursos aumentam o limite das habilidades</small></div>
      <div><span>PRÁTICA</span><strong>${instance.save.videosPracticed} vídeos</strong><small>Produzir transforma conhecimento em experiência</small></div>
    </section>
    <section class="course-learning-grid">${COURSES.map((course) => renderLearningCourse(instance, course.id)).join("")}</section>
  `;
}

function renderLearningCourse(
  instance: PatchedProgression,
  courseId: string
): string {
  const course = COURSES.find((item) => item.id === courseId);
  const progress = instance.save.courses.find((item) => item.courseId === courseId);
  if (!course || !progress) return "";
  const percentage = Math.min(100, (progress.hoursCompleted / course.hours) * 100);
  const level = instance.save.skills[course.skill];
  const unlock = getCourseUnlock(course.skill);
  return `
    <article class="learning-course-card ${progress.completed ? "is-complete" : ""}">
      <div class="learning-course-card__top"><span>${SKILL_LABELS[course.skill]}</span><b>${progress.completed ? "CONCLUÍDO" : progress.enrolled ? "EM ANDAMENTO" : "DISPONÍVEL"}</b></div>
      <h3>${course.name}</h3><p>${course.description}</p>
      <div class="learning-impact"><span>IMPACTO NA VIDA</span><strong>${unlock}</strong><small>Habilidade atual: nível ${level}/5</small></div>
      <div class="learning-milestones"><span class="${percentage >= 25 ? "is-unlocked" : ""}">25% Fundamentos</span><span class="${percentage >= 50 ? "is-unlocked" : ""}">50% Técnica</span><span class="${percentage >= 75 ? "is-unlocked" : ""}">75% Consistência</span><span class="${percentage >= 100 ? "is-unlocked" : ""}">100% Certificação</span></div>
      <div class="learning-progress"><i style="width:${percentage}%"></i></div><small>${progress.hoursCompleted}/${course.hours} horas · matrícula R$ ${course.price}</small>
      <div class="learning-course-actions">${progress.completed ? '<b>HABILIDADE DESBLOQUEADA</b>' : progress.enrolled ? `<button type="button" data-study-course-library="${course.id}" data-hours="2">Estudar 2h</button><button type="button" class="is-secondary" data-study-course-library="${course.id}" data-hours="4">Estudar 4h</button>` : `<button type="button" data-enroll-course-library="${course.id}">Matricular-se</button>`}</div>
    </article>`;
}

function bindCourseEvents(
  instance: PatchedProgression,
  root: HTMLElement,
  reopen: (message: string) => void
): void {
  root
    .querySelectorAll<HTMLButtonElement>("[data-enroll-course-library]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const result = instance.enrollCourse(
          button.dataset.enrollCourseLibrary ?? ""
        );
        reopen(result.error ?? result.message ?? "Matrícula atualizada.");
      });
    });

  root
    .querySelectorAll<HTMLButtonElement>("[data-study-course-library]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const courseId = button.dataset.studyCourseLibrary ?? "";
        const hours = Number(button.dataset.hours) === 4 ? 4 : 2;
        const event = new CustomEvent("creator-life-course-study-request", {
          detail: {
            hours,
            execute: () => instance.studyCourse(courseId, hours),
            complete: (result: ActionResult) =>
              reopen(result.error ?? result.message ?? "Sessão concluída.")
          }
        });
        document.getElementById("game-container")?.dispatchEvent(event);
      });
    });
}

function renderSkillsHtml(instance: PatchedProgression): string {
  return `<section class="learning-skill-summary">${SKILLS.map((skill) => renderHudSkill(instance, skill)).join("")}</section>`;
}

function showDeathScreen(instance: PatchedProgression): void {
  if (instance.__deathShown) return;
  instance.__deathShown = true;
  const container = document.getElementById("game-container");
  if (!container) return;
  const overlay = document.createElement("div");
  overlay.className = "character-death-overlay";
  overlay.innerHTML = `
    <section><span>FIM DA HISTÓRIA</span><h2>O personagem não sobreviveu</h2><p>Fome e sede zeradas por muito tempo retiram vida. Cuide das necessidades antes de trabalhar, estudar ou produzir.</p><button type="button">Começar uma nova história</button></section>
  `;
  overlay.querySelector("button")?.addEventListener("click", () => {
    SAVE_KEYS.forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  });
  container.append(overlay);
}

function getAvailableOffers(instance: PatchedProgression) {
  const state = instance.host.getState();
  return instance.save.sponsorOffers.filter(
    (offer) => !offer.completed && offer.expiresDay >= state.day
  );
}

function getGoalProgress(instance: PatchedProgression, id: string): number {
  const goal = GOALS.find((item) => item.id === id);
  if (!goal) return 0;
  const state = instance.host.getState();
  switch (goal.type) {
    case "videos":
      return state.videos;
    case "subscribers":
      return state.subscribers;
    case "equipment":
      return goal.key
        ? instance.save.equipment[goal.key as EquipmentSlot]
        : 0;
    case "room":
      if (id === "studio-2") {
        return Math.min(
          instance.save.room.decor,
          instance.save.room.lighting,
          instance.save.room.acoustic
        );
      }
      return goal.key
        ? instance.save.room[goal.key as RoomUpgradeSlot]
        : 0;
    case "courses":
      return instance.save.courses.filter((course) => course.completed).length;
    case "skills":
      return Math.max(...SKILLS.map((skill) => instance.save.skills[skill]));
    case "reputation":
      return goal.key
        ? instance.save.reputations[goal.key as ReputationId]
        : 0;
  }
}

function getAverageCondition(instance: PatchedProgression): number {
  const slots = EQUIPMENT_SLOTS.filter((slot) => slot !== "internet");
  return (
    slots.reduce(
      (sum, slot) => sum + instance.save.equipmentCondition[slot],
      0
    ) / slots.length
  );
}

function getSkillImpact(skill: SkillId): string {
  switch (skill) {
    case "editing":
      return "Retenção, ritmo e qualidade da montagem.";
    case "communication":
      return "Presença em câmera e conversão em inscritos.";
    case "design":
      return "Thumbnail, cliques e identidade visual.";
    case "scripting":
      return "Planejamento, retenção e séries.";
    case "technology":
      return "Fluxo técnico, manutenção e freelance.";
    case "marketing":
      return "Impressões, nicho, distribuição e patrocínios.";
  }
}

function getCourseUnlock(skill: SkillId): string {
  switch (skill) {
    case "editing":
      return "Melhora retenção e reduz tempo de edição.";
    case "communication":
      return "Aumenta confiança e conversão do público.";
    case "design":
      return "Eleva CTR de títulos e thumbnails.";
    case "scripting":
      return "Fortalece tempo assistido e vídeos em série.";
    case "technology":
      return "Aumenta produtividade, manutenção e renda.";
    case "marketing":
      return "Eleva alcance, autoridade de nicho e oportunidades.";
  }
}

function translateTheme(theme: string): string {
  return (
    {
      games: "Games",
      technology: "Tecnologia",
      vlog: "Vlog",
      tutorial: "Tutoriais",
      challenge: "Desafios"
    }[theme] ?? theme
  );
}

function productIcon(slot: EquipmentSlot): string {
  return (
    {
      cpu: "CPU",
      gpu: "GPU",
      ram: "RAM",
      storage: "SSD",
      monitor: "▣",
      microphone: "●",
      camera: "◉",
      internet: "⌁"
    }[slot] ?? "◆"
  );
}

function roomIcon(slot: RoomUpgradeSlot): string {
  return (
    {
      bed: "▰",
      chair: "♙",
      desk: "▱",
      lighting: "✦",
      acoustic: "≋",
      decor: "◇"
    }[slot] ?? "◇"
  );
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
