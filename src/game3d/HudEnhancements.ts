import "../hud-modern.css";

type IconName =
  | "play"
  | "calendar"
  | "wallet"
  | "clock"
  | "heart"
  | "energy"
  | "food"
  | "spark"
  | "water"
  | "users"
  | "views"
  | "weather"
  | "age"
  | "world"
  | "status"
  | "opportunity"
  | "target"
  | "pause"
  | "college"
  | "bill"
  | "chart";

const ICONS: Record<IconName, string> = {
  play: '<path d="M8.5 6.7 18 12l-9.5 5.3V6.7Z"/><rect x="3" y="4" width="18" height="16" rx="5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  wallet: '<path d="M4 7.5h15a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  heart: '<path d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.8l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 22l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/>',
  energy: '<path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>',
  food: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 1.5 4 4 4 7h-4"/>',
  spark: '<path d="M9 18h6M10 22h4"/><path d="M8.4 14.5A7 7 0 1 1 15.6 14.5C14.6 15.3 14 16.2 14 17h-4c0-.8-.6-1.7-1.6-2.5Z"/><path d="M12 2v2M4.9 4.9l1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  water: '<path d="M12 2s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12Z"/><path d="M9 16c.8 1.2 1.8 1.8 3 1.8"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  views: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  weather: '<circle cx="9" cy="9" r="4"/><path d="M9 2v2M9 14v2M2 9h2M14 9h2M4 4l1.4 1.4M12.6 12.6 14 14"/><path d="M14 18H8a3 3 0 1 1 .5-6 5 5 0 0 1 9.5 2 2.5 2.5 0 0 1-.5 5H14"/>',
  age: '<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',
  world: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  status: '<path d="M4 5h16M4 12h10M4 19h7"/><circle cx="18" cy="12" r="2"/><circle cx="15" cy="19" r="2"/>',
  opportunity: '<path d="M9 18h6M10 22h4"/><path d="M8.5 14.5A7 7 0 1 1 15.5 14.5C14.5 15.3 14 16.2 14 17h-4c0-.8-.5-1.7-1.5-2.5Z"/><path d="m12 7 1.2 2.4L16 10l-2 2 .5 2.8-2.5-1.3-2.5 1.3L10 12l-2-2 2.8-.6L12 7Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="m16 8 5-5M17 3h4v4"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  college: '<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
  bill: '<path d="M6 2h10l3 3v17l-3-2-2 2-2-2-2 2-2-2-2 2V2Z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/>'
};

function icon(name: IconName, className = ""): string {
  return `<svg class="ui-svg-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

function enhanceBrand(container: HTMLElement): void {
  const brand = container.querySelector<HTMLElement>(".brand-card");
  if (!brand || brand.dataset.enhanced === "true") return;

  const eyebrow = brand.querySelector<HTMLElement>(".brand-card__eyebrow")?.textContent ?? "CREATOR LIFE";
  const title = brand.querySelector<HTMLElement>("strong")?.textContent ?? "Quarto inicial";
  const subtitle = brand.querySelector<HTMLElement>("small")?.textContent ?? "Construa seu canal do zero";

  brand.innerHTML = `
    <span class="brand-card__mark">${icon("play")}</span>
    <div class="brand-card__copy">
      <span class="brand-card__eyebrow">${eyebrow}</span>
      <strong>${title}</strong>
      <small>${subtitle}</small>
    </div>
    <span class="brand-card__stage">INÍCIO</span>
  `;
  brand.dataset.enhanced = "true";
}

function enhanceTimeCard(container: HTMLElement): void {
  const card = container.querySelector<HTMLElement>(".time-card");
  if (!card) return;
  const items = [...card.children] as HTMLElement[];
  const icons: IconName[] = ["clock", "wallet"];
  items.forEach((item, index) => {
    if (item.querySelector(".hud-metric-icon")) return;
    item.insertAdjacentHTML(
      "afterbegin",
      `<span class="hud-metric-icon">${icon(icons[index] ?? "clock")}</span>`
    );
  });
}

function enhanceResources(container: HTMLElement): void {
  const card = container.querySelector<HTMLElement>(".resource-card");
  if (!card) return;

  if (!card.querySelector(".hud-card-heading")) {
    card.insertAdjacentHTML(
      "afterbegin",
      `<header class="hud-card-heading"><span class="hud-card-heading__icon">${icon("heart")}</span><div><span>PERSONAGEM</span><strong>Condição atual</strong></div></header>`
    );
  }

  const resourceMap: Array<[string, IconName, string]> = [
    ["health-bar", "heart", "health"],
    ["energy-bar", "energy", "energy"],
    ["hunger-bar", "food", "hunger"],
    ["creativity-bar", "spark", "creativity"],
    ["thirst-bar", "water", "thirst"]
  ];

  resourceMap.forEach(([barId, iconName, resourceName]) => {
    const bar = document.getElementById(barId);
    const row = bar?.closest<HTMLElement>(".resource-row");
    const label = row?.querySelector<HTMLElement>(".resource-row__label");
    if (!bar || !row || !label) return;

    row.dataset.resource = resourceName;
    if (!label.querySelector(".resource-row__icon")) {
      label.insertAdjacentHTML(
        "afterbegin",
        `<span class="resource-row__icon">${icon(iconName)}</span>`
      );
    }

    const value = Number.parseFloat(
      row.querySelector<HTMLElement>("strong")?.textContent ?? "100"
    );
    row.dataset.state = value <= 15 ? "critical" : value <= 35 ? "warning" : "normal";
  });
}

function enhanceChannel(container: HTMLElement): void {
  const card = container.querySelector<HTMLElement>(".channel-card");
  if (!card) return;

  if (!card.querySelector(".hud-card-heading")) {
    card.insertAdjacentHTML(
      "afterbegin",
      `<header class="hud-card-heading hud-card-heading--channel"><span class="hud-card-heading__icon">${icon("chart")}</span><div><span>CANAL</span><strong>Desempenho geral</strong></div><svg class="channel-sparkline" viewBox="0 0 84 24" aria-hidden="true"><path d="M2 20 14 16 25 18 38 9 50 12 63 5 82 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 20 14 16 25 18 38 9 50 12 63 5 82 7V24H2Z" fill="currentColor" opacity=".08"/></svg></header>`
    );
  }

  const items = [...card.querySelectorAll<HTMLElement>(":scope > div")];
  const icons: IconName[] = ["users", "views"];
  items.forEach((item, index) => {
    if (item.querySelector(".hud-metric-icon")) return;
    item.insertAdjacentHTML(
      "afterbegin",
      `<span class="hud-metric-icon">${icon(icons[index] ?? "views")}</span>`
    );
  });
}

function enhanceCalendar(container: HTMLElement): void {
  const card = container.querySelector<HTMLElement>(".life-calendar-hud");
  if (!card) return;
  const definitions: Array<[string, IconName]> = [
    [".life-calendar-hud__date", "calendar"],
    [".life-calendar-hud__next", "bill"],
    [".life-calendar-hud__college", "college"]
  ];

  definitions.forEach(([selector, iconName]) => {
    const row = card.querySelector<HTMLElement>(selector);
    if (!row || row.querySelector(".calendar-row__icon")) return;
    row.insertAdjacentHTML(
      "afterbegin",
      `<span class="calendar-row__icon">${icon(iconName)}</span>`
    );
    const label = row.querySelector<HTMLElement>(":scope > span:not(.calendar-row__icon)");
    const value = row.querySelector<HTMLElement>("strong");
    if (label && value && !row.querySelector(".calendar-row__copy")) {
      const copy = document.createElement("div");
      copy.className = "calendar-row__copy";
      copy.append(label, value);
      row.append(copy);
    }
  });
}

function enhanceWorldStatus(container: HTMLElement): void {
  const card = container.querySelector<HTMLElement>(".world-status-hud");
  if (!card) return;
  const icons: IconName[] = ["weather", "age", "world"];
  [...card.children].forEach((child, index) => {
    const item = child as HTMLElement;
    if (item.querySelector(".world-status__icon")) return;
    item.insertAdjacentHTML(
      "afterbegin",
      `<span class="world-status__icon">${icon(icons[index] ?? "world")}</span>`
    );
    const labels = [...item.children].filter(
      (element) => !(element as HTMLElement).classList.contains("world-status__icon")
    );
    if (labels.length > 0 && !item.querySelector(".world-status__copy")) {
      const copy = document.createElement("div");
      copy.className = "world-status__copy";
      labels.forEach((element) => copy.append(element));
      item.append(copy);
    }
  });
}

function enhanceProgressDock(container: HTMLElement): void {
  const icons: Record<string, IconName> = {
    status: "status",
    opportunities: "opportunity",
    goals: "target"
  };
  container
    .querySelectorAll<HTMLButtonElement>(".creator-progress-dock [data-progress-panel]")
    .forEach((button) => {
      if (button.querySelector(".progress-dock__icon")) return;
      const name = button.dataset.progressPanel ?? "status";
      button.insertAdjacentHTML(
        "afterbegin",
        `<span class="progress-dock__icon">${icon(icons[name] ?? "status")}</span>`
      );
      const label = button.querySelector<HTMLElement>(":scope > span:not(.progress-dock__icon)");
      const value = button.querySelector<HTMLElement>("strong");
      if (label && value && !button.querySelector(".progress-dock__copy")) {
        const copy = document.createElement("span");
        copy.className = "progress-dock__copy";
        copy.append(label, value);
        button.append(copy);
      }
      button.insertAdjacentHTML(
        "beforeend",
        '<span class="progress-dock__arrow" aria-hidden="true">›</span>'
      );
    });
}

function enhancePause(container: HTMLElement): void {
  const button = container.querySelector<HTMLButtonElement>(".game-pause-button");
  const iconHolder = button?.querySelector<HTMLElement>(":scope > span");
  if (!button || !iconHolder || iconHolder.dataset.enhanced === "true") return;
  iconHolder.innerHTML = icon("pause");
  iconHolder.dataset.enhanced = "true";
}

function enhanceControls(container: HTMLElement): void {
  const controls = container.querySelector<HTMLElement>(".controls-card");
  if (!controls || controls.dataset.enhanced === "true") return;
  controls.dataset.enhanced = "true";
  controls.insertAdjacentHTML(
    "afterbegin",
    `<span class="controls-card__icon">${icon("status")}</span>`
  );
}

function enhance(container: HTMLElement): void {
  enhanceBrand(container);
  enhanceTimeCard(container);
  enhanceResources(container);
  enhanceChannel(container);
  enhanceCalendar(container);
  enhanceWorldStatus(container);
  enhanceProgressDock(container);
  enhancePause(container);
  enhanceControls(container);
}

function install(): void {
  const container = document.getElementById("game-container");
  if (!container) {
    requestAnimationFrame(install);
    return;
  }
  if (container.dataset.hudEnhancements === "true") return;
  container.dataset.hudEnhancements = "true";

  let scheduled = false;
  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance(container);
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(container, {
    childList: true,
    subtree: true,
    characterData: true
  });

  schedule();
}

install();
