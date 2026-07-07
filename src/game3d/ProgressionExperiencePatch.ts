import type {
  EquipmentSlot,
  PlayerState,
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

type AnyProgression = any;

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
const HEALTH_KEY = "creator-life-health-v1";
const SAVE_KEYS = [
  "creator-life-save-v5",
  "creator-life-save-v4",
  "creator-life-save-v3",
  "creator-life-save-v2",
  "creator-life-save-v1",
  HEALTH_KEY
];
const PATCH_FLAG = "__creatorLifeExperiencePatched";

const prototype = ProgressionSystem.prototype as AnyProgression;

if (!prototype[PATCH_FLAG]) {
  prototype[PATCH_FLAG] = true;

  const originalRestore = prototype.restore;
  const originalAdvance = prototype.advance;
  const originalBindHubEvents = prototype.bindHubEvents;

  prototype.restore = function (saved: unknown): void {
    originalRestore.call(this, saved);
    const state = getState(this);
    const persistedHealth = Number(localStorage.getItem(HEALTH_KEY));
    state.health = Number.isFinite(persistedHealth)
      ? clamp(persistedHealth, 0, 100)
      : Number.isFinite(state.health)
        ? clamp(Number(state.health), 0, 100)
        : 100;
    registerBridge(this);
    installHud(this);
    renderHud(this);
  };

  prototype.advance = function (hours: number): void {
    originalAdvance.call(this, hours);
    updateHealth(this, hours);
    renderHud(this);
  };

  prototype.renderHubHtml = function (message = ""): string {
    return renderMarketplace(this, message);
  };

  prototype.bindHubEvents = function (
    root: HTMLElement,
    reopen: (message: string) => void
  ): void {
    originalBindHubEvents.call(this, root, reopen);
    bindMarketplace(root);
  };
}

function getState(instance: AnyProgression): PlayerState & {
  thirst: number;
  health?: number;
} {
  return instance.host.getState();
}

function registerBridge(instance: AnyProgression): void {
  window.__creatorLifeProgressionBridge = {
    renderCoursesHtml: (message = "") => renderCourses(instance, message),
    bindCourseEvents: (root, reopen) =>
      bindCourseEvents(instance, root, reopen),
    renderSkillsHtml: () => renderSkillSummary(instance)
  };
}

function updateHealth(instance: AnyProgression, hours: number): void {
  const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  if (safeHours <= 0) return;
  const state = getState(instance);
  const thirst = Number.isFinite(state.thirst) ? state.thirst : 100;
  let health = Number.isFinite(state.health) ? Number(state.health) : 100;
  let damage = 0;

  if (state.hunger <= 0) damage += 2.4;
  else if (state.hunger < 15) damage += 0.6;
  if (thirst <= 0) damage += 3.5;
  else if (thirst < 15) damage += 0.9;
  if (state.energy <= 0) damage += 0.35;

  if (damage > 0) health -= damage * safeHours;
  else if (state.hunger > 50 && thirst > 50 && state.energy > 20) {
    health += 0.22 * safeHours;
  }

  state.health = clamp(health, 0, 100);
  localStorage.setItem(HEALTH_KEY, String(state.health));
  instance.host.onChange();
  if (state.health <= 0) showDeath(instance);
}

function installHud(instance: AnyProgression): void {
  if (instance.__experienceHudInstalled) return;
  const container = document.getElementById("game-container");
  const resourceCard = container?.querySelector<HTMLElement>(".resource-card");
  if (!container || !resourceCard) return;
  instance.__experienceHudInstalled = true;

  if (!document.getElementById("health-value")) {
    const row = document.createElement("div");
    row.className = "resource-row resource-row--health";
    row.innerHTML = `
      <div class="resource-row__label"><span>Vida</span><strong id="health-value">100/100</strong></div>
      <div class="resource-track"><div id="health-bar" class="resource-fill resource-fill--health"></div></div>`;
    resourceCard.prepend(row);
  }

  const dock = document.createElement("section");
  dock.className = "creator-progress-dock";
  dock.innerHTML = `
    <button type="button" data-progress-panel="status"><span>STATUS</span><strong id="progress-status-level">Nível inicial</strong></button>
    <button type="button" data-progress-panel="opportunities"><span>OPORTUNIDADES</span><strong id="progress-opportunity-count">Nenhuma proposta</strong></button>
    <button type="button" data-progress-panel="goals"><span>OBJETIVOS</span><strong id="progress-goal-count">Metas em andamento</strong></button>`;
  container.append(dock);

  const overlay = document.createElement("div");
  overlay.className = "progress-side-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <aside class="progress-side-panel">
      <header><div><span>PROGRESSÃO</span><h2 id="progress-side-title">Status</h2></div><button type="button" data-close-progress-panel>×</button></header>
      <div id="progress-side-content" class="progress-side-content"></div>
    </aside>`;
  container.append(overlay);

  dock.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      "[data-progress-panel]"
    );
    if (button) openPanel(instance, button.dataset.progressPanel ?? "status");
  });

  overlay.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (event.target === overlay || target?.closest("[data-close-progress-panel]")) {
      overlay.classList.remove("is-visible");
      overlay.setAttribute("aria-hidden", "true");
    }
  });

  container.addEventListener("creator-life-course-study-request", (event) => {
    const detail = (event as CustomEvent).detail as {
      execute?: () => { error: string | null; message?: string };
      complete?: (result: { error: string | null; message?: string }) => void;
    };
    if (!detail?.execute || !detail?.complete) return;
    detail.complete(detail.execute());
  });

  instance.__experienceHudTimer = window.setInterval(
    () => renderHud(instance),
    900
  );
}

function renderHud(instance: AnyProgression): void {
  if (!instance.__experienceHudInstalled) return;
  const state = getState(instance);
  const health = clamp(Number(state.health ?? 100), 0, 100);
  const healthValue = document.getElementById("health-value");
  const healthBar = document.getElementById("health-bar");
  if (healthValue) healthValue.textContent = `${Math.round(health)}/100`;
  if (healthBar) {
    healthBar.style.width = `${health}%`;
    healthBar.dataset.risk =
      health <= 20 ? "critical" : health <= 45 ? "warning" : "safe";
  }

  const average =
    SKILLS.reduce(
      (sum, skill) => sum + Number(instance.save.skills[skill] ?? 0),
      0
    ) / SKILLS.length;
  const offers = availableOffers(instance).length;
  const goals = GOALS.filter(
    (goal) =>
      !instance.save.claimedGoals.includes(goal.id) &&
      goalProgress(instance, goal.id) >= goal.target
  ).length;

  setText("progress-status-level", `Média ${average.toFixed(1)}/5`);
  setText(
    "progress-opportunity-count",
    offers ? `${offers} disponíve${offers === 1 ? "l" : "is"}` : "Nenhuma proposta"
  );
  setText(
    "progress-goal-count",
    goals ? `${goals} para resgatar` : "Metas em andamento"
  );
}

function openPanel(instance: AnyProgression, panel: string): void {
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
    content.innerHTML = renderStatus(instance);
  }

  content.querySelectorAll<HTMLButtonElement>("[data-accept-sponsor]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = instance.acceptSponsor(button.dataset.acceptSponsor ?? "");
      instance.host.onEvent(
        result.error ?? result.message ?? "Contrato atualizado.",
        result.error ? "warning" : "success"
      );
      openPanel(instance, panel);
    });
  });
  content.querySelectorAll<HTMLButtonElement>("[data-claim-goal]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = instance.claimGoal(button.dataset.claimGoal ?? "");
      instance.host.onEvent(
        result.error ?? result.message ?? "Objetivo atualizado.",
        result.error ? "warning" : "success"
      );
      openPanel(instance, panel);
    });
  });

  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");
}

function renderStatus(instance: AnyProgression): string {
  const state = getState(instance);
  const health = clamp(Number(state.health ?? 100), 0, 100);
  const risk =
    health <= 20
      ? "Risco crítico: coma e beba água imediatamente."
      : health <= 45
        ? "Vida baixa: necessidades ignoradas estão causando dano."
        : "Condição estável. Necessidades altas recuperam vida lentamente.";
  return `
    <section class="status-life-card ${health <= 20 ? "is-critical" : ""}">
      <div><span>VIDA</span><strong>${Math.round(health)}/100</strong></div>
      <div class="status-life-track"><i style="width:${health}%"></i></div><p>${risk}</p>
    </section>
    <section class="status-panel-section"><div class="status-panel-heading"><span>HABILIDADES</span><strong>Prática + formação</strong></div><div class="status-skill-list">${SKILLS.map((skill) => renderSkill(instance, skill)).join("")}</div></section>
    <section class="status-panel-section"><div class="status-panel-heading"><span>REPUTAÇÃO</span><strong>Como o mundo enxerga você</strong></div><div class="status-reputation-list">${REPUTATIONS.map((id) => `<article><div><span>${REPUTATION_LABELS[id]}</span><strong>${Number(instance.save.reputations[id]).toFixed(0)}/100</strong></div><div><i style="width:${instance.save.reputations[id]}%"></i></div></article>`).join("")}</div></section>`;
}

function renderSkill(instance: AnyProgression, skill: SkillId): string {
  const level = Number(instance.save.skills[skill] ?? 0);
  const xp = Number(instance.save.skillXp[skill] ?? 0);
  const threshold = 100 * (level + 1);
  const courseCount = instance.save.courses.filter((progress: { completed: boolean; courseId: string }) => {
    const course = COURSES.find((item) => item.id === progress.courseId);
    return progress.completed && course?.skill === skill;
  }).length;
  const cap = Math.min(5, 1 + courseCount);
  return `<article><div><span>${SKILL_LABELS[skill]}</span><strong>N${level} · limite ${cap}</strong></div><div><i style="width:${Math.min(100, (xp / threshold) * 100)}%"></i></div><small>${skillImpact(skill)}</small></article>`;
}

function renderOpportunities(instance: AnyProgression): string {
  const state = getState(instance);
  if (state.subscribers < 300 || instance.save.reputations.audience < 8) {
    return `<div class="progress-empty-state"><strong>Patrocínios bloqueados</strong><p>Alcance 300 inscritos e reputação de público 8.</p><small>${state.subscribers}/300 inscritos · ${Number(instance.save.reputations.audience).toFixed(0)}/8 reputação</small></div>`;
  }
  const offers = availableOffers(instance);
  if (!offers.length) {
    return '<div class="progress-empty-state"><strong>Nenhuma proposta ativa</strong><p>Continue publicando para atrair novas marcas.</p></div>';
  }
  return `<div class="hud-opportunity-list">${offers.map((offer: AnyProgression) => `<article class="hud-opportunity-card ${offer.id === instance.save.activeSponsorId ? "is-active" : ""}"><div><span>${escapeHtml(offer.brand)}</span><strong>R$ ${Number(offer.payment).toFixed(2)}</strong></div><p>${offer.requiredTheme ? `Nicho: ${themeLabel(offer.requiredTheme)}` : "Nicho livre"} · qualidade mínima ${offer.minQuality}</p><small>Prazo: dia ${offer.expiresDay}</small>${offer.id === instance.save.activeSponsorId ? '<b>CONTRATO ATIVO</b>' : `<button type="button" data-accept-sponsor="${offer.id}">Aceitar oportunidade</button>`}</article>`).join("")}</div>`;
}

function renderGoals(instance: AnyProgression): string {
  return `<div class="hud-goal-list">${GOALS.map((goal) => {
    const progress = goalProgress(instance, goal.id);
    const claimed = instance.save.claimedGoals.includes(goal.id);
    const complete = progress >= goal.target;
    return `<article class="hud-goal-card ${complete ? "is-complete" : ""}"><div><span>${goal.label}</span><strong>R$ ${goal.reward}</strong></div><p>${goal.description}</p><div class="hud-goal-progress"><i style="width:${Math.min(100, (progress / goal.target) * 100)}%"></i></div><small>${Math.min(progress, goal.target).toFixed(0)} / ${goal.target}</small>${claimed ? '<b>RECOMPENSA RESGATADA</b>' : complete ? `<button type="button" data-claim-goal="${goal.id}">Resgatar recompensa</button>` : ""}</article>`;
  }).join("")}</div>`;
}

function renderMarketplace(instance: AnyProgression, message: string): string {
  const state = getState(instance);
  return `
    ${message ? `<p class="progression-message marketplace-message">${escapeHtml(message)}</p>` : ""}
    <section class="marketplace-hero"><div><span>CREATOR MARKET</span><h3>Equipamentos e itens para o quarto</h3><p>Produtos novos chegam com condição máxima. Usados custam menos e podem exigir manutenção.</p></div><div class="marketplace-wallet"><span>SEU SALDO</span><strong>R$ ${state.money.toFixed(2)}</strong><small>Condição do PC: ${averageCondition(instance).toFixed(0)}%</small></div></section>
    <nav class="marketplace-tabs"><button type="button" class="is-active" data-market-filter="all">Todos</button><button type="button" data-market-filter="hardware">Hardware</button><button type="button" data-market-filter="environment">Ambiente</button><button type="button" data-market-filter="maintenance">Manutenção</button><label><span>⌕</span><input type="search" id="marketplace-search" placeholder="Buscar produto" /></label></nav>
    <section class="marketplace-section" data-market-category="hardware"><div class="marketplace-section__heading"><div><span>TECNOLOGIA</span><h3>Hardware e equipamentos</h3></div><small>Entrega e instalação imediatas</small></div><div class="marketplace-product-grid">${EQUIPMENT_SLOTS.map((slot) => equipmentCard(instance, slot)).join("")}</div></section>
    <section class="marketplace-section" data-market-category="environment"><div class="marketplace-section__heading"><div><span>CASA E ESTÚDIO</span><h3>Ambiente de trabalho</h3></div><small>As compras aparecem no cenário 3D</small></div><div class="marketplace-product-grid">${ROOM_SLOTS.map((slot) => roomCard(instance, slot)).join("")}</div></section>
    <section class="marketplace-maintenance" data-market-category="maintenance"><div><span>ASSISTÊNCIA TÉCNICA</span><h3>Condição média: ${averageCondition(instance).toFixed(0)}%</h3><p>Desgaste reduz velocidade, estabilidade e qualidade.</p></div><div><button type="button" data-maintenance="clean">Limpeza · R$ 35</button><button type="button" data-maintenance="full">Revisão · R$ 95</button></div></section>`;
}

function equipmentCard(instance: AnyProgression, slot: EquipmentSlot): string {
  const level = Number(instance.save.equipment[slot]);
  const current = EQUIPMENT_TIERS[slot][level];
  const next = EQUIPMENT_TIERS[slot][level + 1];
  const condition = Number(instance.save.equipmentCondition[slot]);
  const search = `${EQUIPMENT_LABELS[slot]} ${current.name} ${next?.name ?? ""}`.toLocaleLowerCase("pt-BR");
  return `<article class="marketplace-product" data-market-search="${escapeHtml(search)}"><div class="marketplace-product__visual"><span>${productIcon(slot)}</span><b>NÍVEL ${level}</b></div><div class="marketplace-product__content"><span>${EQUIPMENT_LABELS[slot]}</span><h4>${current.name}</h4><p>${current.description}</p><div class="marketplace-condition"><span>Condição ${Math.round(condition)}%</span><div><i style="width:${condition}%"></i></div></div>${next ? `<div class="marketplace-next"><small>PRÓXIMO UPGRADE</small><strong>${next.name}</strong><p>${next.description}</p></div><div class="marketplace-buy"><button type="button" data-buy-equipment="${slot}" data-used="false">Novo · R$ ${next.price}</button>${slot === "internet" ? "" : `<button type="button" class="is-secondary" data-buy-equipment="${slot}" data-used="true">Usado · R$ ${Math.round(next.price * 0.68)}</button>`}</div>` : '<b class="marketplace-max">MELHOR MODELO INSTALADO</b>'}</div></article>`;
}

function roomCard(instance: AnyProgression, slot: RoomUpgradeSlot): string {
  const level = Number(instance.save.room[slot]);
  const current = ROOM_TIERS[slot][level];
  const next = ROOM_TIERS[slot][level + 1];
  const search = `${ROOM_LABELS[slot]} ${current.name} ${next?.name ?? ""}`.toLocaleLowerCase("pt-BR");
  return `<article class="marketplace-product marketplace-product--room" data-market-search="${escapeHtml(search)}"><div class="marketplace-product__visual"><span>${roomIcon(slot)}</span><b>NÍVEL ${level}</b></div><div class="marketplace-product__content"><span>${ROOM_LABELS[slot]}</span><h4>${current.name}</h4><p>${current.description}</p>${next ? `<div class="marketplace-next"><small>PRÓXIMA MELHORIA</small><strong>${next.name}</strong><p>${next.description}</p></div><div class="marketplace-buy"><button type="button" data-buy-room="${slot}">Comprar · R$ ${next.price}</button></div>` : '<b class="marketplace-max">AMBIENTE NO NÍVEL MÁXIMO</b>'}</div></article>`;
}

function bindMarketplace(root: HTMLElement): void {
  let filter = "all";
  const apply = (): void => {
    const query = root.querySelector<HTMLInputElement>("#marketplace-search")?.value.trim().toLocaleLowerCase("pt-BR") ?? "";
    root.querySelectorAll<HTMLElement>("[data-market-category]").forEach((section) => {
      section.hidden = filter !== "all" && section.dataset.marketCategory !== filter;
    });
    root.querySelectorAll<HTMLElement>("[data-market-search]").forEach((card) => {
      card.hidden = Boolean(query) && !(card.dataset.marketSearch ?? "").includes(query);
    });
  };
  root.querySelectorAll<HTMLButtonElement>("[data-market-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      filter = button.dataset.marketFilter ?? "all";
      root.querySelectorAll("[data-market-filter]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      apply();
    });
  });
  root.querySelector<HTMLInputElement>("#marketplace-search")?.addEventListener("input", apply);
}

function renderCourses(instance: AnyProgression, message: string): string {
  return `${message ? `<p class="learning-message">${escapeHtml(message)}</p>` : ""}<section class="learning-overview"><div><span>FORMAÇÃO</span><strong>${instance.save.courses.filter((course: AnyProgression) => course.completed).length}/${COURSES.length} cursos</strong><small>Cursos aumentam o limite das habilidades</small></div><div><span>PRÁTICA</span><strong>${instance.save.videosPracticed} vídeos</strong><small>Produzir transforma conhecimento em experiência</small></div></section><section class="course-learning-grid">${COURSES.map((course) => courseCard(instance, course.id)).join("")}</section>`;
}

function courseCard(instance: AnyProgression, courseId: string): string {
  const course = COURSES.find((item) => item.id === courseId);
  const progress = instance.save.courses.find((item: AnyProgression) => item.courseId === courseId);
  if (!course || !progress) return "";
  const percentage = Math.min(100, (progress.hoursCompleted / course.hours) * 100);
  return `<article class="learning-course-card ${progress.completed ? "is-complete" : ""}"><div class="learning-course-card__top"><span>${SKILL_LABELS[course.skill]}</span><b>${progress.completed ? "CONCLUÍDO" : progress.enrolled ? "EM ANDAMENTO" : "DISPONÍVEL"}</b></div><h3>${course.name}</h3><p>${course.description}</p><div class="learning-impact"><span>IMPACTO NA VIDA</span><strong>${courseImpact(course.skill)}</strong><small>Habilidade atual: nível ${instance.save.skills[course.skill]}/5</small></div><div class="learning-milestones"><span class="${percentage >= 25 ? "is-unlocked" : ""}">25% Fundamentos</span><span class="${percentage >= 50 ? "is-unlocked" : ""}">50% Técnica</span><span class="${percentage >= 75 ? "is-unlocked" : ""}">75% Consistência</span><span class="${percentage >= 100 ? "is-unlocked" : ""}">100% Certificação</span></div><div class="learning-progress"><i style="width:${percentage}%"></i></div><small>${progress.hoursCompleted}/${course.hours} horas · matrícula R$ ${course.price}</small><div class="learning-course-actions">${progress.completed ? '<b>HABILIDADE DESBLOQUEADA</b>' : progress.enrolled ? `<button type="button" data-study-course-library="${course.id}" data-hours="2">Estudar 2h</button><button type="button" class="is-secondary" data-study-course-library="${course.id}" data-hours="4">Estudar 4h</button>` : `<button type="button" data-enroll-course-library="${course.id}">Matricular-se</button>`}</div></article>`;
}

function bindCourseEvents(instance: AnyProgression, root: HTMLElement, reopen: (message: string) => void): void {
  root.querySelectorAll<HTMLButtonElement>("[data-enroll-course-library]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = instance.enrollCourse(button.dataset.enrollCourseLibrary ?? "");
      reopen(result.error ?? result.message ?? "Matrícula atualizada.");
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-study-course-library]").forEach((button) => {
    button.addEventListener("click", () => {
      const hours = Number(button.dataset.hours) === 4 ? 4 : 2;
      const result = instance.studyCourse(button.dataset.studyCourseLibrary ?? "", hours);
      reopen(result.error ?? result.message ?? "Sessão concluída.");
    });
  });
}

function renderSkillSummary(instance: AnyProgression): string {
  return `<section class="learning-skill-summary">${SKILLS.map((skill) => renderSkill(instance, skill)).join("")}</section>`;
}

function showDeath(instance: AnyProgression): void {
  if (instance.__deathShown) return;
  instance.__deathShown = true;
  const container = document.getElementById("game-container");
  if (!container) return;
  const overlay = document.createElement("div");
  overlay.className = "character-death-overlay";
  overlay.innerHTML = `<section><span>FIM DA HISTÓRIA</span><h2>O personagem não sobreviveu</h2><p>Fome e sede zeradas por muito tempo retiram vida. Cuide das necessidades antes de trabalhar, estudar ou produzir.</p><button type="button">Começar uma nova história</button></section>`;
  overlay.querySelector("button")?.addEventListener("click", () => {
    SAVE_KEYS.forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  });
  container.append(overlay);
}

function availableOffers(instance: AnyProgression): AnyProgression[] {
  const state = getState(instance);
  return instance.save.sponsorOffers.filter(
    (offer: AnyProgression) => !offer.completed && offer.expiresDay >= state.day
  );
}

function goalProgress(instance: AnyProgression, id: string): number {
  const goal = GOALS.find((item) => item.id === id);
  if (!goal) return 0;
  const state = getState(instance);
  switch (goal.type) {
    case "videos": return state.videos;
    case "subscribers": return state.subscribers;
    case "equipment": return goal.key ? instance.save.equipment[goal.key] : 0;
    case "room":
      return id === "studio-2"
        ? Math.min(instance.save.room.decor, instance.save.room.lighting, instance.save.room.acoustic)
        : goal.key ? instance.save.room[goal.key] : 0;
    case "courses": return instance.save.courses.filter((course: AnyProgression) => course.completed).length;
    case "skills": return Math.max(...SKILLS.map((skill) => instance.save.skills[skill]));
    case "reputation": return goal.key ? instance.save.reputations[goal.key] : 0;
  }
}

function averageCondition(instance: AnyProgression): number {
  const slots = EQUIPMENT_SLOTS.filter((slot) => slot !== "internet");
  return slots.reduce((sum, slot) => sum + Number(instance.save.equipmentCondition[slot]), 0) / slots.length;
}

function skillImpact(skill: SkillId): string {
  return ({
    editing: "Retenção, ritmo e qualidade da montagem.",
    communication: "Presença em câmera e conversão em inscritos.",
    design: "Thumbnail, cliques e identidade visual.",
    scripting: "Planejamento, retenção e séries.",
    technology: "Fluxo técnico, manutenção e freelance.",
    marketing: "Impressões, nicho, distribuição e patrocínios."
  } as Record<SkillId, string>)[skill];
}

function courseImpact(skill: SkillId): string {
  return ({
    editing: "Melhora retenção e reduz tempo de edição.",
    communication: "Aumenta confiança e conversão do público.",
    design: "Eleva CTR de títulos e thumbnails.",
    scripting: "Fortalece tempo assistido e vídeos em série.",
    technology: "Aumenta produtividade, manutenção e renda.",
    marketing: "Eleva alcance, autoridade de nicho e oportunidades."
  } as Record<SkillId, string>)[skill];
}

function productIcon(slot: EquipmentSlot): string {
  return ({ cpu: "CPU", gpu: "GPU", ram: "RAM", storage: "SSD", monitor: "▣", microphone: "●", camera: "◉", internet: "⌁" } as Record<EquipmentSlot, string>)[slot];
}

function roomIcon(slot: RoomUpgradeSlot): string {
  return ({ bed: "▰", chair: "♙", desk: "▱", lighting: "✦", acoustic: "≋", decor: "◇" } as Record<RoomUpgradeSlot, string>)[slot];
}

function themeLabel(theme: string): string {
  return ({ games: "Games", technology: "Tecnologia", vlog: "Vlog", tutorial: "Tutoriais", challenge: "Desafios" } as Record<string, string>)[theme] ?? theme;
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
