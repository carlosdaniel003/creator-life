import type {
  EquipmentSlot,
  FormatOption,
  PlayerState,
  ProgressionModifiers,
  ProgressionSave,
  ReputationId,
  RoomUpgradeSlot,
  SkillId,
  SponsorOffer,
  VideoDraft,
  VideoResult
} from "../game/types";
import {
  COURSES,
  EQUIPMENT_LABELS,
  EQUIPMENT_TIERS,
  GOALS,
  REPUTATION_LABELS,
  ROOM_LABELS,
  ROOM_TIERS,
  SKILL_LABELS,
  SPONSOR_BRANDS
} from "./ProgressionData";

interface ProgressionHost {
  getState: () => PlayerState & { thirst: number };
  getAcademicGrade: () => number;
  advanceTime: (hours: number) => void;
  onChange: () => void;
  onEvent: (
    message: string,
    type: "success" | "warning" | "neutral"
  ) => void;
  applyVisuals: (save: ProgressionSave) => void;
}

interface ActionResult {
  error: string | null;
  message?: string;
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

export class ProgressionSystem {
  private readonly host: ProgressionHost;
  private save: ProgressionSave;

  public constructor(host: ProgressionHost) {
    this.host = host;
    this.save = this.createDefaultSave();
  }

  public restore(save: Partial<ProgressionSave> | null): void {
    const defaults = this.createDefaultSave();
    this.save = {
      ...defaults,
      ...save,
      equipment: { ...defaults.equipment, ...(save?.equipment ?? {}) },
      room: { ...defaults.room, ...(save?.room ?? {}) },
      equipmentCondition: {
        ...defaults.equipmentCondition,
        ...(save?.equipmentCondition ?? {})
      },
      skills: { ...defaults.skills, ...(save?.skills ?? {}) },
      skillXp: { ...defaults.skillXp, ...(save?.skillXp ?? {}) },
      reputations: { ...defaults.reputations, ...(save?.reputations ?? {}) },
      courses: Array.isArray(save?.courses)
        ? COURSES.map((course) => {
            const existing = save.courses?.find(
              (progress) => progress.courseId === course.id
            );
            return existing
              ? { ...existing }
              : {
                  courseId: course.id,
                  enrolled: false,
                  completed: false,
                  hoursCompleted: 0
                };
          })
        : defaults.courses,
      sponsorOffers: Array.isArray(save?.sponsorOffers)
        ? save.sponsorOffers.map((offer) => ({ ...offer }))
        : [],
      claimedGoals: Array.isArray(save?.claimedGoals)
        ? [...save.claimedGoals]
        : []
    };

    EQUIPMENT_SLOTS.forEach((slot) => {
      this.save.equipment[slot] = this.clamp(
        Math.floor(this.save.equipment[slot] ?? 0),
        0,
        3
      );
      this.save.equipmentCondition[slot] = this.clamp(
        this.save.equipmentCondition[slot] ?? 100,
        25,
        100
      );
    });
    ROOM_SLOTS.forEach((slot) => {
      this.save.room[slot] = this.clamp(
        Math.floor(this.save.room[slot] ?? 0),
        0,
        3
      );
    });
    SKILLS.forEach((skill) => {
      this.save.skills[skill] = this.clamp(
        Math.floor(this.save.skills[skill] ?? 0),
        0,
        5
      );
      this.save.skillXp[skill] = Math.max(0, this.save.skillXp[skill] ?? 0);
    });
    REPUTATIONS.forEach((reputation) => {
      this.save.reputations[reputation] = this.clamp(
        this.save.reputations[reputation] ?? 0,
        0,
        100
      );
    });

    this.syncAcademicReputation();
    this.refreshSponsorOffers();
    this.host.applyVisuals(this.save);
  }

  public serialize(): ProgressionSave {
    return {
      ...this.save,
      equipment: { ...this.save.equipment },
      room: { ...this.save.room },
      equipmentCondition: { ...this.save.equipmentCondition },
      courses: this.save.courses.map((course) => ({ ...course })),
      skills: { ...this.save.skills },
      skillXp: { ...this.save.skillXp },
      reputations: { ...this.save.reputations },
      sponsorOffers: this.save.sponsorOffers.map((offer) => ({ ...offer })),
      claimedGoals: [...this.save.claimedGoals]
    };
  }

  public advance(hours: number): void {
    const state = this.host.getState();
    const currentDay = state.day;

    while (this.save.lastProcessedDay < currentDay) {
      this.save.lastProcessedDay += 1;
      this.processDay(this.save.lastProcessedDay);
    }

    const currentMonth = Math.floor((currentDay - 1) / 30) + 1;
    while (this.save.lastSubscriptionMonth < currentMonth) {
      this.save.lastSubscriptionMonth += 1;
      this.processMonthlyEquipmentCosts();
    }

    if (hours > 0) {
      const activeLevel = EQUIPMENT_SLOTS.reduce(
        (sum, slot) => sum + this.save.equipment[slot],
        0
      );
      const wear = hours * (0.012 + activeLevel * 0.0011);
      EQUIPMENT_SLOTS.forEach((slot) => {
        if (slot !== "internet") {
          this.save.equipmentCondition[slot] = this.clamp(
            this.save.equipmentCondition[slot] - wear,
            25,
            100
          );
        }
      });
    }

    this.syncAcademicReputation();
    this.refreshSponsorOffers();
    this.host.onChange();
  }

  public getModifiers(): ProgressionModifiers {
    const equipment = this.save.equipment;
    const room = this.save.room;
    const skills = this.save.skills;
    const condition = this.getAverageCondition() / 100;
    const skillAverage =
      SKILLS.reduce((sum, skill) => sum + skills[skill], 0) / SKILLS.length;

    return {
      qualityCeiling: this.clamp(
        54 +
          equipment.gpu * 4 +
          equipment.camera * 4 +
          equipment.microphone * 3 +
          room.lighting * 3 +
          room.acoustic * 2 +
          room.decor * 1.5 +
          skills.editing * 2.5 +
          skills.communication * 1.5 +
          skills.scripting * 2,
        55,
        97
      ),
      qualityConsistency: this.clamp(
        0.34 +
          skillAverage * 0.075 +
          equipment.monitor * 0.045 +
          room.chair * 0.025 +
          condition * 0.22,
        0.35,
        0.95
      ),
      planningBonus:
        skills.scripting * 3 +
        skills.marketing * 2 +
        equipment.monitor * 1.5 +
        room.decor,
      editingBonus:
        skills.editing * 4 +
        equipment.cpu * 2.2 +
        equipment.gpu * 2.3 +
        equipment.ram * 1.4 +
        condition * 2,
      titleBonus: skills.marketing * 3 + skills.design * 1.5,
      audioVisualBonus:
        equipment.camera * 2.4 +
        equipment.microphone * 2.5 +
        room.lighting * 2.1 +
        room.acoustic * 1.6,
      stageTimeMultipliers: {
        planning: this.clamp(
          1 -
            equipment.monitor * 0.07 -
            equipment.storage * 0.035 -
            skills.scripting * 0.035,
          0.55,
          1
        ),
        recording: this.clamp(
          1 -
            equipment.camera * 0.035 -
            room.lighting * 0.04 -
            skills.communication * 0.035,
          0.58,
          1
        ),
        editing: this.clamp(
          1 -
            equipment.cpu * 0.075 -
            equipment.gpu * 0.065 -
            equipment.ram * 0.04 -
            equipment.storage * 0.04 -
            skills.editing * 0.035,
          0.42,
          1
        ),
        upload: this.clamp(1 - equipment.internet * 0.18, 0.3, 1)
      },
      energyCostMultiplier: this.clamp(
        1 - room.chair * 0.075 - room.desk * 0.025,
        0.68,
        1
      ),
      freelanceIncomeMultiplier:
        1 +
        equipment.cpu * 0.04 +
        equipment.monitor * 0.045 +
        skills.technology * 0.07 +
        skills.communication * 0.045 +
        this.save.reputations.professional / 230,
      bedRecoveryMultiplier: 1 + room.bed * 0.18,
      creativityRecoveryMultiplier:
        1 + room.decor * 0.1 + room.bed * 0.04,
      monthlyPowerCost:
        equipment.cpu * 9 + equipment.gpu * 14 + room.lighting * 6,
      monthlyInternetSurcharge: [0, 45, 105, 220][equipment.internet] ?? 0
    };
  }

  public purchaseEquipment(
    slot: EquipmentSlot,
    used: boolean
  ): ActionResult {
    const currentLevel = this.save.equipment[slot];
    const nextTier = EQUIPMENT_TIERS[slot][currentLevel + 1];

    if (!nextTier) return { error: "Este equipamento já está no nível máximo." };
    if (nextTier.requiredDesk && this.save.room.desk < nextTier.requiredDesk) {
      return {
        error: `Você precisa de uma mesa nível ${nextTier.requiredDesk} para instalar este item.`
      };
    }
    if (slot === "internet" && used) {
      return { error: "Planos de internet não podem ser comprados usados." };
    }

    const price = used ? Math.round(nextTier.price * 0.68) : nextTier.price;
    if (!this.spend(price)) {
      return { error: `Saldo insuficiente. A compra custa R$ ${price.toFixed(2)}.` };
    }

    this.save.equipment[slot] = nextTier.level;
    this.save.equipmentCondition[slot] =
      slot === "internet"
        ? 100
        : used
          ? 58 + Math.floor(Math.random() * 31)
          : 100;
    this.save.totalInvested += price;
    this.addSkillXp("technology", used ? 10 : 5);
    this.host.applyVisuals(this.save);
    this.host.onChange();

    return {
      error: null,
      message: `${nextTier.name} instalado${used ? " com estado de conservação variável" : ""}.`
    };
  }

  public purchaseRoom(slot: RoomUpgradeSlot): ActionResult {
    const currentLevel = this.save.room[slot];
    const nextTier = ROOM_TIERS[slot][currentLevel + 1];

    if (!nextTier) return { error: "Este item do quarto já está no nível máximo." };
    if (!this.spend(nextTier.price)) {
      return {
        error: `Saldo insuficiente. A melhoria custa R$ ${nextTier.price.toFixed(2)}.`
      };
    }

    this.save.room[slot] = nextTier.level;
    this.save.totalInvested += nextTier.price;
    this.host.applyVisuals(this.save);
    this.host.onChange();
    return { error: null, message: `${nextTier.name} adicionado ao quarto.` };
  }

  public enrollCourse(courseId: string): ActionResult {
    const course = COURSES.find((item) => item.id === courseId);
    const progress = this.save.courses.find((item) => item.courseId === courseId);

    if (!course || !progress) return { error: "Curso não encontrado." };
    if (progress.completed) return { error: "Este curso já foi concluído." };
    if (progress.enrolled) return { error: "Você já está matriculado neste curso." };
    if (
      course.prerequisiteCourseId &&
      !this.save.courses.find(
        (item) => item.courseId === course.prerequisiteCourseId
      )?.completed
    ) {
      return { error: "Conclua o curso anterior para liberar esta formação." };
    }
    if (
      course.minAcademicReputation &&
      this.save.reputations.academic < course.minAcademicReputation
    ) {
      return {
        error: `Este curso exige reputação acadêmica ${course.minAcademicReputation}.`
      };
    }
    if (!this.spend(course.price)) {
      return { error: `Saldo insuficiente. A matrícula custa R$ ${course.price.toFixed(2)}.` };
    }

    progress.enrolled = true;
    this.save.totalInvested += course.price;
    this.host.onChange();
    return { error: null, message: `Matrícula confirmada em ${course.name}.` };
  }

  public studyCourse(courseId: string, hours: 2 | 4): ActionResult {
    const course = COURSES.find((item) => item.id === courseId);
    const progress = this.save.courses.find((item) => item.courseId === courseId);
    const state = this.host.getState();

    if (!course || !progress || !progress.enrolled || progress.completed) {
      return { error: "Este curso não está disponível para estudo." };
    }

    const energyCost = hours === 2 ? 9 : 19;
    if (state.energy < energyCost) {
      return { error: `Você precisa de ${energyCost} de energia.` };
    }
    if (state.hunger < 16 || state.thirst < 16) {
      return { error: "Coma e beba água antes de estudar o curso." };
    }

    state.energy = this.clamp(state.energy - energyCost, 0, 100);
    state.creativity = this.clamp(state.creativity + hours * 0.5, 0, 100);
    progress.hoursCompleted = Math.min(
      course.hours,
      progress.hoursCompleted + hours
    );
    this.addSkillXp(course.skill, hours * 7);
    this.host.advanceTime(hours);

    if (progress.hoursCompleted >= course.hours) {
      progress.completed = true;
      this.save.skills[course.skill] = this.clamp(
        this.save.skills[course.skill] + course.skillLevels,
        0,
        5
      );
      this.save.reputations.academic = this.clamp(
        this.save.reputations.academic + 3,
        0,
        100
      );
      this.host.onChange();
      return { error: null, message: `${course.name} concluído. ${SKILL_LABELS[course.skill]} aumentou.` };
    }

    this.host.onChange();
    return {
      error: null,
      message: `${hours}h concluídas. Progresso: ${progress.hoursCompleted}/${course.hours}h.`
    };
  }

  public performMaintenance(full: boolean): ActionResult {
    const cost = full ? 95 : 35;
    if (!this.spend(cost)) {
      return { error: `Você precisa de R$ ${cost.toFixed(2)} para a manutenção.` };
    }

    EQUIPMENT_SLOTS.forEach((slot) => {
      if (slot !== "internet") {
        this.save.equipmentCondition[slot] = this.clamp(
          this.save.equipmentCondition[slot] + (full ? 100 : 28),
          25,
          100
        );
      }
    });
    this.save.lastMaintenanceDay = this.host.getState().day;
    this.addSkillXp("technology", full ? 16 : 8);
    this.host.onChange();
    return {
      error: null,
      message: full
        ? "Revisão completa concluída. Todos os componentes foram restaurados."
        : "Limpeza concluída. A condição dos equipamentos melhorou."
    };
  }

  public recordVideoPublished(
    result: VideoResult,
    format: FormatOption,
    draft: VideoDraft
  ): string | null {
    this.save.videosPracticed += 1;
    this.addSkillXp("editing", 6 + result.hiddenValueFallback?.editing ?? 0);
    this.addSkillXp("design", 5 + result.titleScore / 30);
    this.addSkillXp("scripting", 5 + result.planningScore / 28);
    this.addSkillXp("marketing", 3 + result.titleScore / 35);
    this.addSkillXp(
      "communication",
      draft.themeId === "vlog" || draft.themeId === "tutorial" ? 9 : 4
    );
    this.addSkillXp(
      "technology",
      format.id === "review" || draft.themeId === "technology" ? 8 : 3
    );
    this.save.reputations.audience = this.clamp(
      this.save.reputations.audience + Math.max(0.15, (result.quality - 45) / 55),
      0,
      100
    );

    const activeSponsor = this.save.sponsorOffers.find(
      (offer) => offer.id === this.save.activeSponsorId
    );
    let sponsorMessage: string | null = null;

    if (activeSponsor && !activeSponsor.completed) {
      const themeMatches =
        activeSponsor.requiredTheme === null ||
        activeSponsor.requiredTheme === draft.themeId;
      const qualityMatches = result.quality >= activeSponsor.minQuality;

      if (themeMatches && qualityMatches) {
        activeSponsor.completed = true;
        this.earn(activeSponsor.payment);
        this.save.reputations.professional = this.clamp(
          this.save.reputations.professional + 4,
          0,
          100
        );
        sponsorMessage = `Patrocínio da ${activeSponsor.brand} concluído: +R$ ${activeSponsor.payment.toFixed(2)}.`;
      } else {
        this.save.reputations.professional = this.clamp(
          this.save.reputations.professional - 3,
          0,
          100
        );
        sponsorMessage = `A entrega para ${activeSponsor.brand} não cumpriu os requisitos. Sua reputação profissional caiu.`;
      }
      this.save.activeSponsorId = null;
    }

    this.refreshSponsorOffers();
    this.host.onChange();
    return sponsorMessage;
  }

  public recordFreelance(baseIncome: number): number {
    const multiplier = this.getModifiers().freelanceIncomeMultiplier;
    const bonus = Math.max(0, Math.round(baseIncome * (multiplier - 1)));
    if (bonus > 0) this.earn(bonus);

    this.save.freelanceCompleted += 1;
    this.addSkillXp("technology", 9);
    this.addSkillXp("communication", 5);
    this.save.reputations.professional = this.clamp(
      this.save.reputations.professional + 1.2,
      0,
      100
    );
    this.host.onChange();
    return bonus;
  }

  public acceptSponsor(id: string): ActionResult {
    if (this.save.activeSponsorId) {
      return { error: "Conclua o patrocínio atual antes de aceitar outro." };
    }

    const offer = this.save.sponsorOffers.find(
      (item) => item.id === id && !item.completed
    );
    if (!offer) return { error: "Esta proposta não está mais disponível." };
    if (offer.expiresDay < this.host.getState().day) {
      return { error: "Esta proposta expirou." };
    }

    offer.accepted = true;
    this.save.activeSponsorId = offer.id;
    this.host.onChange();
    return {
      error: null,
      message: `Contrato aceito com ${offer.brand}. O próximo vídeo deve cumprir os requisitos.`
    };
  }

  public claimGoal(id: string): ActionResult {
    const goal = GOALS.find((item) => item.id === id);
    if (!goal) return { error: "Meta não encontrada." };
    if (this.save.claimedGoals.includes(id)) {
      return { error: "A recompensa desta meta já foi resgatada." };
    }
    if (this.getGoalProgress(goal.id) < goal.target) {
      return { error: "Esta meta ainda não foi concluída." };
    }

    this.save.claimedGoals.push(id);
    this.earn(goal.reward);
    this.host.onChange();
    return {
      error: null,
      message: `${goal.label} concluída. Recompensa: R$ ${goal.reward.toFixed(2)}.`
    };
  }

  public renderHubHtml(message = ""): string {
    const modifiers = this.getModifiers();
    const state = this.host.getState();
    const completedCourses = this.save.courses.filter(
      (course) => course.completed
    ).length;

    return `
      ${message ? `<p class="progression-message">${this.escapeHtml(message)}</p>` : ""}
      <section class="progression-overview">
        <article><span>INVESTIMENTO TOTAL</span><strong>R$ ${this.save.totalInvested.toFixed(2)}</strong><small>Saldo: R$ ${state.money.toFixed(2)}</small></article>
        <article><span>TETO DE QUALIDADE</span><strong>${Math.round(modifiers.qualityCeiling)}/100</strong><small>Potencial, não garantia</small></article>
        <article><span>CONSISTÊNCIA</span><strong>${Math.round(modifiers.qualityConsistency * 100)}%</strong><small>Equipamento + habilidade</small></article>
        <article><span>CONDIÇÃO DO PC</span><strong>${Math.round(this.getAverageCondition())}%</strong><small>Manutenção no dia ${this.save.lastMaintenanceDay}</small></article>
      </section>

      <section class="progression-section">
        <div class="progression-section__header"><div><span>HARDWARE</span><h3>Computador e equipamentos</h3></div><small>Itens usados custam 68%, mas chegam desgastados.</small></div>
        <div class="upgrade-grid">
          ${EQUIPMENT_SLOTS.map((slot) => this.renderEquipmentCard(slot)).join("")}
        </div>
      </section>

      <section class="progression-section">
        <div class="progression-section__header"><div><span>AMBIENTE</span><h3>Quarto e estúdio</h3></div><small>Cada compra aparece no cenário 3D.</small></div>
        <div class="upgrade-grid">
          ${ROOM_SLOTS.map((slot) => this.renderRoomCard(slot)).join("")}
        </div>
      </section>

      <section class="progression-section progression-maintenance">
        <div><span>MANUTENÇÃO</span><h3>Condição média: ${Math.round(this.getAverageCondition())}%</h3><p>Peças desgastadas reduzem velocidade, qualidade e confiabilidade.</p></div>
        <div><button type="button" data-maintenance="clean">Limpeza · R$ 35</button><button type="button" data-maintenance="full">Revisão completa · R$ 95</button></div>
      </section>

      <section class="progression-section">
        <div class="progression-section__header"><div><span>PERSONAGEM</span><h3>Habilidades e prática</h3></div><small>${completedCourses} cursos concluídos</small></div>
        <div class="skill-grid">
          ${SKILLS.map((skill) => this.renderSkill(skill)).join("")}
        </div>
        <div class="reputation-grid">
          ${REPUTATIONS.map((reputation) => `<article><span>${REPUTATION_LABELS[reputation]}</span><strong>${this.save.reputations[reputation].toFixed(0)}/100</strong><div><i style="width:${this.save.reputations[reputation]}%"></i></div></article>`).join("")}
        </div>
      </section>

      <section class="progression-section">
        <div class="progression-section__header"><div><span>FORMAÇÃO</span><h3>Cursos profissionais</h3></div><small>Dinheiro compra acesso; horas e prática consolidam a habilidade.</small></div>
        <div class="course-list">
          ${COURSES.map((course) => this.renderCourse(course.id)).join("")}
        </div>
      </section>

      <section class="progression-section">
        <div class="progression-section__header"><div><span>OPORTUNIDADES</span><h3>Patrocínios</h3></div><small>Exigem reputação, público e entrega compatível.</small></div>
        <div class="sponsor-list">${this.renderSponsors()}</div>
      </section>

      <section class="progression-section">
        <div class="progression-section__header"><div><span>OBJETIVOS</span><h3>Metas de médio prazo</h3></div><small>Recompensas ajudam a financiar a próxima etapa.</small></div>
        <div class="goal-list">
          ${GOALS.map((goal) => this.renderGoal(goal.id)).join("")}
        </div>
      </section>
    `;
  }

  public bindHubEvents(root: HTMLElement, reopen: (message: string) => void): void {
    root.querySelectorAll<HTMLButtonElement>("[data-buy-equipment]").forEach((button) => {
      button.addEventListener("click", () => {
        const slot = button.dataset.buyEquipment as EquipmentSlot;
        const result = this.purchaseEquipment(
          slot,
          button.dataset.used === "true"
        );
        reopen(result.error ?? result.message ?? "Compra concluída.");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-buy-room]").forEach((button) => {
      button.addEventListener("click", () => {
        const result = this.purchaseRoom(
          button.dataset.buyRoom as RoomUpgradeSlot
        );
        reopen(result.error ?? result.message ?? "Melhoria concluída.");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-enroll-course]").forEach((button) => {
      button.addEventListener("click", () => {
        const result = this.enrollCourse(button.dataset.enrollCourse ?? "");
        reopen(result.error ?? result.message ?? "Matrícula concluída.");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-study-course]").forEach((button) => {
      button.addEventListener("click", () => {
        const result = this.studyCourse(
          button.dataset.studyCourse ?? "",
          Number(button.dataset.hours) === 4 ? 4 : 2
        );
        reopen(result.error ?? result.message ?? "Sessão concluída.");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-maintenance]").forEach((button) => {
      button.addEventListener("click", () => {
        const result = this.performMaintenance(
          button.dataset.maintenance === "full"
        );
        reopen(result.error ?? result.message ?? "Manutenção concluída.");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-accept-sponsor]").forEach((button) => {
      button.addEventListener("click", () => {
        const result = this.acceptSponsor(
          button.dataset.acceptSponsor ?? ""
        );
        reopen(result.error ?? result.message ?? "Contrato aceito.");
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-claim-goal]").forEach((button) => {
      button.addEventListener("click", () => {
        const result = this.claimGoal(button.dataset.claimGoal ?? "");
        reopen(result.error ?? result.message ?? "Recompensa resgatada.");
      });
    });
  }

  private processDay(day: number): void {
    const daysSinceMaintenance = day - this.save.lastMaintenanceDay;
    if (daysSinceMaintenance === 30) {
      this.host.onEvent(
        "O computador está há um mês sem manutenção. Limpeza recomendada.",
        "warning"
      );
    }

    const active = this.save.sponsorOffers.find(
      (offer) => offer.id === this.save.activeSponsorId
    );
    if (active && day > active.expiresDay && !active.completed) {
      this.save.activeSponsorId = null;
      this.save.reputations.professional = this.clamp(
        this.save.reputations.professional - 5,
        0,
        100
      );
      this.host.onEvent(
        `O prazo do contrato com ${active.brand} expirou. Sua reputação profissional caiu.`,
        "warning"
      );
    }
  }

  private processMonthlyEquipmentCosts(): void {
    const modifiers = this.getModifiers();
    const total =
      modifiers.monthlyPowerCost + modifiers.monthlyInternetSurcharge;
    if (total <= 0) return;

    if (this.spend(total)) {
      this.host.onEvent(
        `Custos extras dos equipamentos: R$ ${total.toFixed(2)}.`,
        "neutral"
      );
      return;
    }

    if (this.save.equipment.internet > 0) {
      this.save.equipment.internet -= 1;
      this.host.onEvent(
        "Saldo insuficiente para o plano e consumo dos upgrades. A internet foi rebaixada.",
        "warning"
      );
    } else {
      EQUIPMENT_SLOTS.forEach((slot) => {
        if (slot !== "internet") {
          this.save.equipmentCondition[slot] = this.clamp(
            this.save.equipmentCondition[slot] - 8,
            25,
            100
          );
        }
      });
      this.host.onEvent(
        "Os custos extras não foram pagos. A condição dos equipamentos foi afetada.",
        "warning"
      );
    }
  }

  private refreshSponsorOffers(): void {
    const state = this.host.getState();
    const eligible =
      state.subscribers >= 300 && this.save.reputations.audience >= 8;
    if (!eligible) return;

    this.save.sponsorOffers = this.save.sponsorOffers.filter(
      (offer) => offer.completed || offer.expiresDay >= state.day
    );
    const available = this.save.sponsorOffers.filter(
      (offer) => !offer.completed && offer.expiresDay >= state.day
    );
    if (available.length >= 3) return;

    const missing = 3 - available.length;
    const shuffled = [...SPONSOR_BRANDS].sort(() => Math.random() - 0.5);
    for (let index = 0; index < missing; index += 1) {
      const brand = shuffled[index % shuffled.length];
      const payment = Math.round(
        brand.basePayment *
          (1 + state.subscribers / 5000) *
          (1 + this.save.skills.marketing * 0.08)
      );
      this.save.sponsorOffers.push({
        id: `${brand.brand}-${state.day}-${Math.random().toString(36).slice(2, 6)}`,
        brand: brand.brand,
        requiredTheme: brand.theme,
        payment,
        minQuality: 58 + Math.min(18, Math.floor(state.subscribers / 1000) * 3),
        expiresDay: state.day + 7,
        accepted: false,
        completed: false
      });
    }
  }

  private addSkillXp(skill: SkillId, amount: number): void {
    this.save.skillXp[skill] += amount;
    const completedCourses = this.save.courses.filter(
      (course) =>
        course.completed &&
        COURSES.find((definition) => definition.id === course.courseId)?.skill ===
          skill
    ).length;
    const cap = this.clamp(1 + completedCourses, 1, 5);

    while (
      this.save.skills[skill] < cap &&
      this.save.skillXp[skill] >= 100 * (this.save.skills[skill] + 1)
    ) {
      this.save.skillXp[skill] -= 100 * (this.save.skills[skill] + 1);
      this.save.skills[skill] += 1;
      this.host.onEvent(
        `${SKILL_LABELS[skill]} evoluiu para o nível ${this.save.skills[skill]}.`,
        "success"
      );
    }
  }

  private syncAcademicReputation(): void {
    this.save.reputations.academic = this.clamp(
      (this.host.getAcademicGrade() - 50) * 1.45 +
        this.save.courses.filter((course) => course.completed).length * 2,
      0,
      100
    );
  }

  private renderEquipmentCard(slot: EquipmentSlot): string {
    const level = this.save.equipment[slot];
    const current = EQUIPMENT_TIERS[slot][level];
    const next = EQUIPMENT_TIERS[slot][level + 1];
    const condition = this.save.equipmentCondition[slot];

    return `
      <article class="upgrade-card">
        <div class="upgrade-card__heading"><div><span>${EQUIPMENT_LABELS[slot]}</span><strong>${current.name}</strong></div><b>N${level}</b></div>
        <p>${current.description}</p>
        <div class="upgrade-condition"><span>Condição</span><div><i style="width:${condition}%"></i></div><strong>${Math.round(condition)}%</strong></div>
        ${
          next
            ? `<div class="upgrade-next"><span>PRÓXIMO</span><strong>${next.name}</strong><small>${next.description}</small></div>
              <div class="upgrade-actions">
                <button type="button" data-buy-equipment="${slot}" data-used="false">Nova · R$ ${next.price}</button>
                ${slot === "internet" ? "" : `<button type="button" class="is-secondary" data-buy-equipment="${slot}" data-used="true">Usada · R$ ${Math.round(next.price * 0.68)}</button>`}
              </div>`
            : '<span class="upgrade-max">NÍVEL MÁXIMO</span>'
        }
      </article>
    `;
  }

  private renderRoomCard(slot: RoomUpgradeSlot): string {
    const level = this.save.room[slot];
    const current = ROOM_TIERS[slot][level];
    const next = ROOM_TIERS[slot][level + 1];

    return `
      <article class="upgrade-card upgrade-card--room">
        <div class="upgrade-card__heading"><div><span>${ROOM_LABELS[slot]}</span><strong>${current.name}</strong></div><b>N${level}</b></div>
        <p>${current.description}</p>
        ${
          next
            ? `<div class="upgrade-next"><span>PRÓXIMO</span><strong>${next.name}</strong><small>${next.description}</small></div><button type="button" data-buy-room="${slot}">Comprar · R$ ${next.price}</button>`
            : '<span class="upgrade-max">NÍVEL MÁXIMO</span>'
        }
      </article>
    `;
  }

  private renderSkill(skill: SkillId): string {
    const level = this.save.skills[skill];
    const xp = this.save.skillXp[skill];
    const threshold = 100 * (level + 1);
    const completedCourses = this.save.courses.filter(
      (course) =>
        course.completed &&
        COURSES.find((definition) => definition.id === course.courseId)?.skill ===
          skill
    ).length;
    const cap = this.clamp(1 + completedCourses, 1, 5);

    return `<article><div><span>${SKILL_LABELS[skill]}</span><strong>Nível ${level}</strong></div><small>Limite atual: ${cap}</small><div class="skill-progress"><i style="width:${Math.min(100, (xp / threshold) * 100)}%"></i></div></article>`;
  }

  private renderCourse(courseId: string): string {
    const course = COURSES.find((item) => item.id === courseId);
    const progress = this.save.courses.find((item) => item.courseId === courseId);
    if (!course || !progress) return "";

    const percentage = Math.round((progress.hoursCompleted / course.hours) * 100);
    return `
      <article class="course-card ${progress.completed ? "is-complete" : ""}">
        <div><span>${SKILL_LABELS[course.skill]}</span><strong>${course.name}</strong><p>${course.description}</p><small>${course.hours}h · R$ ${course.price}</small></div>
        <div class="course-card__action">
          ${
            progress.completed
              ? '<b>CONCLUÍDO</b>'
              : progress.enrolled
                ? `<div class="course-progress"><i style="width:${percentage}%"></i></div><span>${progress.hoursCompleted}/${course.hours}h</span><button type="button" data-study-course="${course.id}" data-hours="2">Estudar 2h</button><button type="button" class="is-secondary" data-study-course="${course.id}" data-hours="4">Estudar 4h</button>`
                : `<button type="button" data-enroll-course="${course.id}">Matricular</button>`
          }
        </div>
      </article>
    `;
  }

  private renderSponsors(): string {
    const state = this.host.getState();
    if (state.subscribers < 300 || this.save.reputations.audience < 8) {
      return '<p class="progression-empty">Patrocínios começam a aparecer após 300 inscritos e alguma reputação com o público.</p>';
    }

    const offers = this.save.sponsorOffers.filter(
      (offer) => !offer.completed && offer.expiresDay >= state.day
    );
    return offers
      .map(
        (offer) => `
          <article class="sponsor-card ${offer.id === this.save.activeSponsorId ? "is-active" : ""}">
            <div><span>${offer.brand}</span><strong>R$ ${offer.payment.toFixed(2)}</strong><p>${offer.requiredTheme ? `Exige vídeo de ${offer.requiredTheme}` : "Tema livre"} · qualidade oculta mínima ${offer.minQuality}</p><small>Prazo: dia ${offer.expiresDay}</small></div>
            ${offer.id === this.save.activeSponsorId ? '<b>CONTRATO ATIVO</b>' : `<button type="button" data-accept-sponsor="${offer.id}">Aceitar</button>`}
          </article>`
      )
      .join("");
  }

  private renderGoal(id: string): string {
    const goal = GOALS.find((item) => item.id === id);
    if (!goal) return "";
    const progress = this.getGoalProgress(id);
    const claimed = this.save.claimedGoals.includes(id);
    const complete = progress >= goal.target;

    return `<article class="goal-card ${complete ? "is-complete" : ""}"><div><span>${goal.label}</span><strong>${goal.description}</strong><small>${Math.min(progress, goal.target).toFixed(0)} / ${goal.target} · Recompensa R$ ${goal.reward}</small></div>${claimed ? '<b>RESGATADA</b>' : complete ? `<button type="button" data-claim-goal="${goal.id}">Resgatar</button>` : '<i></i>'}</article>`;
  }

  private getGoalProgress(id: string): number {
    const goal = GOALS.find((item) => item.id === id);
    if (!goal) return 0;
    const state = this.host.getState();

    switch (goal.type) {
      case "videos":
        return state.videos;
      case "subscribers":
        return state.subscribers;
      case "equipment":
        return goal.key ? this.save.equipment[goal.key as EquipmentSlot] : 0;
      case "room":
        if (id === "studio-2") {
          return Math.min(
            this.save.room.decor,
            this.save.room.lighting,
            this.save.room.acoustic
          );
        }
        return goal.key ? this.save.room[goal.key as RoomUpgradeSlot] : 0;
      case "courses":
        return this.save.courses.filter((course) => course.completed).length;
      case "skills":
        return Math.max(...SKILLS.map((skill) => this.save.skills[skill]));
      case "reputation":
        return goal.key
          ? this.save.reputations[goal.key as ReputationId]
          : 0;
    }
  }

  private createDefaultSave(): ProgressionSave {
    const state = this.host.getState();
    return {
      equipment: {
        cpu: 0,
        gpu: 0,
        ram: 0,
        storage: 0,
        monitor: 0,
        microphone: 0,
        camera: 0,
        internet: 0
      },
      room: {
        bed: 0,
        chair: 0,
        desk: 0,
        lighting: 0,
        acoustic: 0,
        decor: 0
      },
      equipmentCondition: {
        cpu: 100,
        gpu: 100,
        ram: 100,
        storage: 100,
        monitor: 100,
        microphone: 100,
        camera: 100,
        internet: 100
      },
      courses: COURSES.map((course) => ({
        courseId: course.id,
        enrolled: false,
        completed: false,
        hoursCompleted: 0
      })),
      skills: {
        editing: 0,
        communication: 0,
        design: 0,
        scripting: 0,
        technology: 0,
        marketing: 0
      },
      skillXp: {
        editing: 0,
        communication: 0,
        design: 0,
        scripting: 0,
        technology: 0,
        marketing: 0
      },
      reputations: {
        audience: 0,
        professional: 0,
        academic: 0
      },
      lastMaintenanceDay: state.day,
      lastProcessedDay: state.day,
      lastSubscriptionMonth: Math.floor((state.day - 1) / 30) + 1,
      totalInvested: 0,
      videosPracticed: 0,
      freelanceCompleted: 0,
      sponsorOffers: [],
      activeSponsorId: null,
      claimedGoals: []
    };
  }

  private getAverageCondition(): number {
    const slots = EQUIPMENT_SLOTS.filter((slot) => slot !== "internet");
    return (
      slots.reduce(
        (sum, slot) => sum + this.save.equipmentCondition[slot],
        0
      ) / slots.length
    );
  }

  private spend(amount: number): boolean {
    const state = this.host.getState();
    if (state.money + 0.0001 < amount) return false;
    state.money -= amount;
    return true;
  }

  private earn(amount: number): void {
    this.host.getState().money += amount;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
