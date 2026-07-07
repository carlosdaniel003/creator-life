import type {
  BillEntry,
  BillId,
  FinanceTransaction,
  LifeSimulationSave,
  PlayerState
} from "../game/types";

interface LifeSimulationHost {
  getState: () => PlayerState;
  onChange: () => void;
  onEvent: (
    message: string,
    type: "success" | "warning" | "neutral"
  ) => void;
}

interface BillDefinition {
  id: BillId;
  label: string;
  amount: number;
  dueDay: number;
}

const BILL_DEFINITIONS: BillDefinition[] = [
  { id: "internet", label: "Internet residencial", amount: 95, dueDay: 5 },
  { id: "electricity", label: "Energia elétrica", amount: 110, dueDay: 10 },
  { id: "college", label: "Mensalidade da faculdade", amount: 220, dueDay: 15 },
  { id: "rent", label: "Aluguel", amount: 550, dueDay: 28 }
];

const WEEK_DAYS = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo"
];

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

export class LifeSimulation {
  private readonly host: LifeSimulationHost;
  private readonly hud: HTMLElement;
  private bills: BillEntry[] = [];
  private transactions: FinanceTransaction[] = [];
  private collegeGrade = 68;
  private studyHoursThisWeek = 0;
  private evaluatedWeek = 0;
  private freelanceJobs = 0;
  private totalExpenses = 0;
  private totalFreelanceIncome = 0;
  private lastProcessedDay = 1;

  public constructor(container: HTMLElement, host: LifeSimulationHost) {
    this.host = host;
    this.hud = document.createElement("section");
    this.hud.className = "life-calendar-hud";
    this.hud.setAttribute("aria-label", "Agenda e calendário");
    container.append(this.hud);

    const state = this.host.getState();
    this.lastProcessedDay = state.day;
    this.ensureBillsThroughMonth(this.getMonth(state.day) + 1);
    this.renderHud();
  }

  public advance(hours: number): void {
    const state = this.host.getState();
    state.thirst = this.clamp(state.thirst - hours * 5.5, 0, 100);

    if (state.thirst <= 0) {
      state.energy = this.clamp(state.energy - Math.max(2, hours * 2), 0, 100);
    }

    while (this.lastProcessedDay < state.day) {
      this.lastProcessedDay += 1;
      this.processNewDay(this.lastProcessedDay);
    }

    this.ensureBillsThroughMonth(this.getMonth(state.day) + 1);
    this.updateBillStatuses();
    this.renderHud();
    this.host.onChange();
  }

  public restore(save: Partial<LifeSimulationSave> | null): void {
    const state = this.host.getState();

    if (save) {
      this.bills = Array.isArray(save.bills)
        ? save.bills.map((bill) => ({ ...bill }))
        : [];
      this.transactions = Array.isArray(save.transactions)
        ? save.transactions.map((transaction) => ({ ...transaction })).slice(0, 80)
        : [];
      this.collegeGrade = this.numberOr(save.collegeGrade, 68);
      this.studyHoursThisWeek = this.numberOr(save.studyHoursThisWeek, 0);
      this.evaluatedWeek = this.numberOr(
        save.evaluatedWeek,
        Math.max(0, this.getWeek(state.day) - 1)
      );
      this.freelanceJobs = this.numberOr(save.freelanceJobs, 0);
      this.totalExpenses = this.numberOr(save.totalExpenses, 0);
      this.totalFreelanceIncome = this.numberOr(save.totalFreelanceIncome, 0);
      this.lastProcessedDay = this.numberOr(save.lastProcessedDay, state.day);
    } else {
      this.lastProcessedDay = state.day;
      this.evaluatedWeek = Math.max(0, this.getWeek(state.day) - 1);
    }

    this.ensureBillsThroughMonth(this.getMonth(state.day) + 1);
    this.updateBillStatuses();
    this.renderHud();
  }

  public serialize(): LifeSimulationSave {
    return {
      bills: this.bills.map((bill) => ({ ...bill })),
      transactions: this.transactions.map((transaction) => ({ ...transaction })),
      collegeGrade: this.collegeGrade,
      studyHoursThisWeek: this.studyHoursThisWeek,
      evaluatedWeek: this.evaluatedWeek,
      freelanceJobs: this.freelanceJobs,
      totalExpenses: this.totalExpenses,
      totalFreelanceIncome: this.totalFreelanceIncome,
      lastProcessedDay: this.lastProcessedDay
    };
  }

  public getOnlineBlockReason(): string | null {
    const state = this.host.getState();
    const internet = this.getOldestPendingBill("internet");
    const electricity = this.getOldestPendingBill("electricity");

    if (internet && state.day > internet.dueAbsoluteDay + 2) {
      return "A internet foi suspensa por falta de pagamento. Quite a conta na agenda.";
    }

    if (electricity && state.day > electricity.dueAbsoluteDay + 7) {
      return "A energia foi cortada por atraso. Quite a conta na agenda.";
    }

    return null;
  }

  public getProductionCost(formatId: string): number {
    switch (formatId) {
      case "short":
        return 1.5;
      case "standard":
        return 3;
      case "review":
        return 5;
      case "documentary":
        return 8;
      default:
        return 3;
    }
  }

  public payProductionCost(formatId: string): string | null {
    const blockReason = this.getOnlineBlockReason();
    if (blockReason) return blockReason;

    const cost = this.getProductionCost(formatId);
    if (!this.spend("Energia e dados da produção", cost)) {
      return `Você precisa de R$ ${cost.toFixed(2)} para produzir este vídeo.`;
    }

    return null;
  }

  public buyMeal(): string | null {
    const state = this.host.getState();
    const cost = 14;

    if (!this.spend("Refeição", cost)) {
      return "Você não tem R$ 14,00 para comprar uma refeição.";
    }

    state.hunger = this.clamp(state.hunger + 52, 0, 100);
    state.thirst = this.clamp(state.thirst + 7, 0, 100);
    return null;
  }

  public buyWater(): string | null {
    const state = this.host.getState();
    const cost = 3;

    if (!this.spend("Água", cost)) {
      return "Você não tem R$ 3,00 para comprar água.";
    }

    state.thirst = this.clamp(state.thirst + 44, 0, 100);
    return null;
  }

  public study(hours: 2 | 4): string | null {
    const state = this.host.getState();
    const energyCost = hours === 2 ? 10 : 22;

    if (state.energy < energyCost) {
      return `Você precisa de ${energyCost} de energia para estudar ${hours} horas.`;
    }

    if (state.thirst < 12 || state.hunger < 12) {
      return "Coma e beba água antes de estudar.";
    }

    state.energy = this.clamp(state.energy - energyCost, 0, 100);
    state.creativity = this.clamp(
      state.creativity + (hours === 2 ? 2 : 4),
      0,
      100
    );
    this.studyHoursThisWeek += hours;
    this.collegeGrade = this.clamp(
      this.collegeGrade + (hours === 2 ? 0.35 : 0.8),
      0,
      100
    );
    this.host.onChange();
    this.renderHud();
    return null;
  }

  public completeFreelanceJob(): { error: string | null; income: number } {
    const state = this.host.getState();
    const blockReason = this.getOnlineBlockReason();

    if (blockReason) return { error: blockReason, income: 0 };
    if (state.energy < 20) {
      return { error: "Você precisa de 20 de energia para aceitar o trabalho.", income: 0 };
    }
    if (state.hunger < 18 || state.thirst < 18) {
      return { error: "Coma e beba água antes de trabalhar.", income: 0 };
    }

    state.energy = this.clamp(state.energy - 20, 0, 100);
    state.creativity = this.clamp(state.creativity - 7, 0, 100);

    const reliabilityBonus = Math.floor(this.collegeGrade / 12);
    const income = 46 + reliabilityBonus + Math.floor(Math.random() * 21);
    this.addIncome("Trabalho freelance", income);
    this.freelanceJobs += 1;
    this.totalFreelanceIncome += income;
    this.host.onChange();
    this.renderHud();

    return { error: null, income };
  }

  public payBill(uid: string): string | null {
    const bill = this.bills.find((item) => item.uid === uid);

    if (!bill || bill.status === "paid") {
      return "Esta conta não está disponível para pagamento.";
    }

    const amount = this.getBillAmount(bill);
    if (!this.spend(bill.label, amount)) {
      return `Saldo insuficiente. Esta conta custa R$ ${amount.toFixed(2)}.`;
    }

    bill.status = "paid";
    bill.paidAbsoluteDay = this.host.getState().day;
    this.host.onEvent(`${bill.label} paga: R$ ${amount.toFixed(2)}.`, "success");
    this.host.onChange();
    this.renderHud();
    return null;
  }

  public renderAgendaHtml(): string {
    const state = this.host.getState();
    const date = this.getDateInfo(state.day);
    const currentMonth = this.getMonth(state.day);
    const visibleBills = this.bills
      .filter(
        (bill) =>
          bill.dueMonth >= currentMonth - 1 && bill.dueMonth <= currentMonth + 1
      )
      .sort((a, b) => a.dueAbsoluteDay - b.dueAbsoluteDay);
    const pendingTotal = visibleBills
      .filter((bill) => bill.status !== "paid")
      .reduce((sum, bill) => sum + this.getBillAmount(bill), 0);
    const gradeClass =
      this.collegeGrade >= 75
        ? "is-good"
        : this.collegeGrade >= 60
          ? "is-medium"
          : "is-danger";

    return `
      <section class="agenda-overview">
        <div class="agenda-date-card">
          <span>${date.weekDay}</span>
          <strong>Dia ${date.dayOfMonth} · ${date.monthName}</strong>
          <small>Semana ${date.week} · Mês ${date.month} · Ano ${date.year}</small>
        </div>
        <div class="agenda-balance-card">
          <span>Saldo disponível</span>
          <strong>R$ ${state.money.toFixed(2)}</strong>
          <small>Contas abertas: R$ ${pendingTotal.toFixed(2)}</small>
        </div>
      </section>

      <section class="college-agenda-card ${gradeClass}">
        <div>
          <span>FACULDADE</span>
          <strong>Média ${this.collegeGrade.toFixed(1)}</strong>
          <small>${this.getCollegeStatus()}</small>
        </div>
        <div class="college-progress">
          <span>Estudo semanal</span>
          <strong>${this.studyHoursThisWeek.toFixed(1)} / 10h</strong>
          <div><i style="width:${Math.min(100, this.studyHoursThisWeek * 10)}%"></i></div>
        </div>
      </section>

      <section class="agenda-section">
        <div class="agenda-section__header">
          <div><span>FINANÇAS</span><h3>Contas e vencimentos</h3></div>
          <small>Multa de 2% ao dia, limitada a 30%.</small>
        </div>
        <div class="bill-list">
          ${visibleBills.map((bill) => this.renderBill(bill)).join("")}
        </div>
      </section>

      <section class="agenda-section">
        <div class="agenda-section__header">
          <div><span>MOVIMENTAÇÕES</span><h3>Histórico recente</h3></div>
          <small>Gastos acumulados: R$ ${this.totalExpenses.toFixed(2)}</small>
        </div>
        <div class="transaction-list">
          ${
            this.transactions.length === 0
              ? '<p class="agenda-empty">Nenhuma movimentação registrada.</p>'
              : this.transactions
                  .slice(0, 10)
                  .map(
                    (transaction) => `
                      <div class="transaction-row transaction-row--${transaction.type}">
                        <div><strong>${this.escapeHtml(transaction.label)}</strong><small>Dia ${transaction.day} · ${String(Math.floor(transaction.hour)).padStart(2, "0")}:00</small></div>
                        <span>${transaction.type === "income" ? "+" : "−"} R$ ${transaction.amount.toFixed(2)}</span>
                      </div>
                    `
                  )
                  .join("")
          }
        </div>
      </section>
    `;
  }

  public renderHud(): void {
    const state = this.host.getState();
    const date = this.getDateInfo(state.day);
    const nextBill = this.bills
      .filter((bill) => bill.status !== "paid")
      .sort((a, b) => a.dueAbsoluteDay - b.dueAbsoluteDay)[0];
    const overdue = this.bills.filter(
      (bill) => bill.status === "pending" && state.day > bill.dueAbsoluteDay
    ).length;

    this.hud.innerHTML = `
      <div class="life-calendar-hud__date">
        <span>${date.weekDay}</span>
        <strong>${date.dayOfMonth} ${date.monthName.slice(0, 3)} · Semana ${date.week}</strong>
      </div>
      <div class="life-calendar-hud__next ${overdue > 0 ? "is-overdue" : ""}">
        <span>${overdue > 0 ? `${overdue} conta${overdue === 1 ? "" : "s"} atrasada${overdue === 1 ? "" : "s"}` : "Próximo compromisso"}</span>
        <strong>${nextBill ? `${nextBill.label} · Dia ${nextBill.dueDay}` : "Sem contas abertas"}</strong>
      </div>
      <div class="life-calendar-hud__college">
        <span>Faculdade</span><strong>${this.collegeGrade.toFixed(0)} · ${this.studyHoursThisWeek.toFixed(0)}/10h</strong>
      </div>
    `;
  }

  public getCollegeGrade(): number {
    return this.collegeGrade;
  }

  private processNewDay(day: number): void {
    this.ensureBillsThroughMonth(this.getMonth(day) + 1);
    this.updateBillStatuses();

    const date = this.getDateInfo(day);
    if (date.dayOfWeekIndex === 0 && date.week > this.evaluatedWeek + 1) {
      this.evaluatePreviousWeek(date.week - 1);
    }

    for (const bill of this.bills) {
      if (bill.dueAbsoluteDay === day && bill.status !== "paid") {
        bill.status = "pending";
        this.host.onEvent(
          `${bill.label} venceu hoje: R$ ${bill.baseAmount.toFixed(2)}.`,
          "warning"
        );
      }
    }

    this.applyLatePenalties(day);
  }

  private evaluatePreviousWeek(week: number): void {
    const studied = this.studyHoursThisWeek;
    const delta = studied >= 12 ? 3 : studied >= 8 ? 1 : studied >= 5 ? -2 : -6;
    this.collegeGrade = this.clamp(this.collegeGrade + delta, 0, 100);

    if (week % 4 === 0) {
      const examBonus = studied >= 10 ? 2 : studied >= 6 ? 0 : -4;
      this.collegeGrade = this.clamp(this.collegeGrade + examBonus, 0, 100);
      this.host.onEvent(
        this.collegeGrade >= 60
          ? `Prova concluída. Sua média agora é ${this.collegeGrade.toFixed(1)}.`
          : `Você foi mal na prova. Sua média caiu para ${this.collegeGrade.toFixed(1)}.`,
        this.collegeGrade >= 60 ? "neutral" : "warning"
      );
    } else {
      this.host.onEvent(
        studied >= 8
          ? `Boa rotina de estudos: ${studied.toFixed(1)}h na semana.`
          : `Você estudou apenas ${studied.toFixed(1)}h e sua média foi afetada.`,
        studied >= 8 ? "success" : "warning"
      );
    }

    this.studyHoursThisWeek = 0;
    this.evaluatedWeek = week;
  }

  private applyLatePenalties(day: number): void {
    const state = this.host.getState();
    const rent = this.getOldestPendingBill("rent");
    const college = this.getOldestPendingBill("college");

    if (rent && day > rent.dueAbsoluteDay + 7) {
      state.energy = this.clamp(state.energy - 5, 0, 100);
      state.creativity = this.clamp(state.creativity - 3, 0, 100);
    }

    if (college && day > college.dueAbsoluteDay + 7) {
      this.collegeGrade = this.clamp(this.collegeGrade - 0.8, 0, 100);
    }
  }

  private updateBillStatuses(): void {
    const day = this.host.getState().day;
    this.bills.forEach((bill) => {
      if (bill.status === "scheduled" && day >= bill.dueAbsoluteDay) {
        bill.status = "pending";
      }
    });
  }

  private ensureBillsThroughMonth(targetMonth: number): void {
    for (let month = 1; month <= targetMonth; month += 1) {
      for (const definition of BILL_DEFINITIONS) {
        const uid = `${definition.id}-${month}`;
        if (this.bills.some((bill) => bill.uid === uid)) continue;

        const dueAbsoluteDay = (month - 1) * 30 + definition.dueDay;
        this.bills.push({
          uid,
          id: definition.id,
          label: definition.label,
          baseAmount: definition.amount,
          dueDay: definition.dueDay,
          dueMonth: month,
          dueAbsoluteDay,
          status:
            this.host.getState().day >= dueAbsoluteDay ? "pending" : "scheduled",
          paidAbsoluteDay: null
        });
      }
    }
  }

  private renderBill(bill: BillEntry): string {
    const state = this.host.getState();
    const amount = this.getBillAmount(bill);
    const lateDays = Math.max(0, state.day - bill.dueAbsoluteDay);
    const statusLabel =
      bill.status === "paid"
        ? "Pago"
        : lateDays > 0
          ? `${lateDays} dia${lateDays === 1 ? "" : "s"} em atraso`
          : bill.status === "pending"
            ? "Vence hoje"
            : `Vence em ${bill.dueAbsoluteDay - state.day} dia${bill.dueAbsoluteDay - state.day === 1 ? "" : "s"}`;

    return `
      <article class="bill-card bill-card--${bill.status} ${lateDays > 0 ? "is-late" : ""}">
        <div>
          <span>Mês ${bill.dueMonth} · Dia ${bill.dueDay}</span>
          <strong>${bill.label}</strong>
          <small>${statusLabel}</small>
        </div>
        <div class="bill-card__payment">
          <strong>R$ ${amount.toFixed(2)}</strong>
          ${
            bill.status === "paid"
              ? '<span class="bill-paid-label">PAGO</span>'
              : `<button type="button" data-pay-bill="${bill.uid}">Pagar</button>`
          }
        </div>
      </article>
    `;
  }

  private spend(label: string, amount: number): boolean {
    const state = this.host.getState();
    if (state.money + 0.0001 < amount) return false;

    state.money -= amount;
    this.totalExpenses += amount;
    this.addTransaction("expense", label, amount);
    this.host.onChange();
    this.renderHud();
    return true;
  }

  private addIncome(label: string, amount: number): void {
    this.host.getState().money += amount;
    this.addTransaction("income", label, amount);
  }

  private addTransaction(
    type: FinanceTransaction["type"],
    label: string,
    amount: number
  ): void {
    const state = this.host.getState();
    this.transactions.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      day: state.day,
      hour: state.hour,
      type,
      label,
      amount
    });
    this.transactions = this.transactions.slice(0, 80);
  }

  private getBillAmount(bill: BillEntry): number {
    if (bill.status === "paid") return bill.baseAmount;
    const lateDays = Math.max(0, this.host.getState().day - bill.dueAbsoluteDay);
    const multiplier = 1 + Math.min(0.3, lateDays * 0.02);
    return Math.round(bill.baseAmount * multiplier * 100) / 100;
  }

  private getOldestPendingBill(id: BillId): BillEntry | null {
    return (
      this.bills
        .filter((bill) => bill.id === id && bill.status === "pending")
        .sort((a, b) => a.dueAbsoluteDay - b.dueAbsoluteDay)[0] ?? null
    );
  }

  private getCollegeStatus(): string {
    if (this.collegeGrade >= 85) return "Excelente desempenho acadêmico";
    if (this.collegeGrade >= 70) return "Desempenho estável";
    if (this.collegeGrade >= 60) return "Atenção para não reprovar";
    return "Risco de reprovação";
  }

  private getDateInfo(day: number): {
    dayOfMonth: number;
    month: number;
    monthName: string;
    year: number;
    week: number;
    weekDay: string;
    dayOfWeekIndex: number;
  } {
    const month = this.getMonth(day);
    const year = Math.floor((month - 1) / 12) + 1;
    const monthInYear = (month - 1) % 12;
    const dayOfWeekIndex = (day - 1) % 7;

    return {
      dayOfMonth: ((day - 1) % 30) + 1,
      month,
      monthName: MONTH_NAMES[monthInYear],
      year,
      week: this.getWeek(day),
      weekDay: WEEK_DAYS[dayOfWeekIndex],
      dayOfWeekIndex
    };
  }

  private getMonth(day: number): number {
    return Math.floor((day - 1) / 30) + 1;
  }

  private getWeek(day: number): number {
    return Math.floor((day - 1) / 7) + 1;
  }

  private numberOr(value: unknown, fallback: number): number {
    return Number.isFinite(value) ? Number(value) : fallback;
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
