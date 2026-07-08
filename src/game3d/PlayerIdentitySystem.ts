import "../player-identity.css";
import { BalancedChannelSimulation } from "./BalancedChannelSimulation";
import { ComputerTaskController } from "./ComputerTaskController";
import { CreatorLife3D } from "./CreatorLife3D";
import { LifeSimulation } from "./LifeSimulation";
import { ProgressionSystem } from "./ProgressionSystem";

export interface PlayerIdentity {
  characterName: string;
  channelName: string;
  createdAt: number;
}

interface IdentityBridge {
  ready: Promise<PlayerIdentity>;
  getProfile: () => PlayerIdentity | null;
  getCharacterName: () => string;
  getChannelName: () => string;
  personalizeText: (value: string) => string;
  personalizeHtml: (value: string) => string;
}

declare global {
  interface Window {
    __creatorLifeIdentity?: IdentityBridge;
  }
}

const PROFILE_KEY = "creator-life-profile-v1";
const PATCH_FLAG = "__creatorLifeIdentityPatched";
const OBSERVER_FLAG = "creatorLifeIdentityObserverInstalled";

let currentProfile = readProfile();
let resolveIdentity: (profile: PlayerIdentity) => void = () => undefined;

export const identityReady = new Promise<PlayerIdentity>((resolve) => {
  resolveIdentity = resolve;
});

window.__creatorLifeIdentity = {
  ready: identityReady,
  getProfile: () => currentProfile,
  getCharacterName: () => currentProfile?.characterName ?? "Criador",
  getChannelName: () => currentProfile?.channelName ?? "Meu Canal",
  personalizeText,
  personalizeHtml
};

patchGameInterface();
patchGeneratedContent();
installIdentityObserver();
startIdentityFlow();

function startIdentityFlow(): void {
  if (currentProfile) {
    applyDocumentIdentity();
    resolveIdentity(currentProfile);
    return;
  }

  const begin = (): void => {
    const container = document.getElementById("game-container");
    if (!container) {
      requestAnimationFrame(begin);
      return;
    }
    renderWelcome(container);
  };
  begin();
}

function renderWelcome(container: HTMLElement): void {
  container.replaceChildren();
  const overlay = document.createElement("main");
  overlay.className = "identity-onboarding";
  overlay.setAttribute("aria-label", "Início do Creator Life");
  overlay.innerHTML = `
    <div class="identity-onboarding__ambient identity-onboarding__ambient--one"></div>
    <div class="identity-onboarding__ambient identity-onboarding__ambient--two"></div>
    <section class="identity-welcome-card">
      <div class="identity-welcome-card__mark" aria-hidden="true"><span>CL</span></div>
      <div class="identity-welcome-card__copy">
        <span class="identity-eyebrow">SIMULADOR DE VIDA E CONTEÚDO</span>
        <h1>CREATOR <b>LIFE</b></h1>
        <p>Comece do zero, desenvolva suas habilidades e transforme um quarto simples em uma carreira como criador.</p>
      </div>
      <button type="button" class="identity-primary-button" data-start-identity>
        <span>START</span><b aria-hidden="true">→</b>
      </button>
      <small>Seu progresso será salvo automaticamente neste dispositivo.</small>
    </section>`;
  container.append(overlay);

  overlay
    .querySelector<HTMLButtonElement>("[data-start-identity]")
    ?.addEventListener("click", () => renderIdentityForm(overlay));
}

function renderIdentityForm(overlay: HTMLElement): void {
  overlay.innerHTML = `
    <div class="identity-onboarding__ambient identity-onboarding__ambient--one"></div>
    <div class="identity-onboarding__ambient identity-onboarding__ambient--two"></div>
    <section class="identity-form-card">
      <header>
        <button type="button" class="identity-back-button" data-back-identity aria-label="Voltar">←</button>
        <div><span class="identity-eyebrow">NOVA HISTÓRIA</span><h1>Crie sua identidade</h1><p>Esses nomes aparecerão em toda a sua jornada.</p></div>
      </header>
      <form class="identity-form" novalidate>
        <label>
          <span>Nome do personagem</span>
          <small>Como o jogo chamará você</small>
          <input type="text" name="characterName" maxlength="24" minlength="2" autocomplete="name" placeholder="Ex.: Carlos" required />
        </label>
        <label>
          <span>Nome do canal</span>
          <small>Sua marca como criador de conteúdo</small>
          <input type="text" name="channelName" maxlength="32" minlength="2" autocomplete="off" placeholder="Ex.: Mente Criativa" required />
        </label>
        <div class="identity-preview" aria-live="polite">
          <span>PRÉVIA DO PERFIL</span>
          <div><b data-preview-avatar>C</b><p><strong data-preview-character>Seu personagem</strong><small data-preview-channel>Seu canal</small></p></div>
        </div>
        <p class="identity-form__error" data-identity-error role="alert"></p>
        <button type="submit" class="identity-primary-button"><span>COMEÇAR HISTÓRIA</span><b aria-hidden="true">→</b></button>
      </form>
    </section>`;

  const form = overlay.querySelector<HTMLFormElement>(".identity-form");
  const characterInput = form?.elements.namedItem("characterName") as HTMLInputElement | null;
  const channelInput = form?.elements.namedItem("channelName") as HTMLInputElement | null;
  const error = overlay.querySelector<HTMLElement>("[data-identity-error]");

  const updatePreview = (): void => {
    const characterName = cleanName(characterInput?.value ?? "", 24);
    const channelName = cleanName(channelInput?.value ?? "", 32);
    setText(overlay, "[data-preview-character]", characterName || "Seu personagem");
    setText(overlay, "[data-preview-channel]", channelName || "Seu canal");
    setText(
      overlay,
      "[data-preview-avatar]",
      (characterName.charAt(0) || "C").toLocaleUpperCase("pt-BR")
    );
  };

  characterInput?.addEventListener("input", updatePreview);
  channelInput?.addEventListener("input", updatePreview);
  overlay
    .querySelector<HTMLButtonElement>("[data-back-identity]")
    ?.addEventListener("click", () => renderWelcome(document.getElementById("game-container")!));

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const characterName = cleanName(characterInput?.value ?? "", 24);
    const channelName = cleanName(channelInput?.value ?? "", 32);
    const validation = validateNames(characterName, channelName);

    if (validation) {
      if (error) error.textContent = validation;
      return;
    }

    const profile: PlayerIdentity = {
      characterName,
      channelName,
      createdAt: Date.now()
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    currentProfile = profile;
    applyDocumentIdentity();
    overlay.classList.add("is-finishing");
    window.setTimeout(() => {
      overlay.remove();
      resolveIdentity(profile);
      document.dispatchEvent(
        new CustomEvent("creator-life-identity-ready", { detail: { ...profile } })
      );
    }, 280);
  });

  requestAnimationFrame(() => characterInput?.focus());
}

function patchGameInterface(): void {
  const prototype = CreatorLife3D.prototype as any;
  if (prototype[PATCH_FLAG]) return;
  prototype[PATCH_FLAG] = true;

  const originalInjectInterface = prototype.injectInterface;
  const originalRenderHud = prototype.renderHud;
  const originalShowModal = prototype.showModal;
  const originalShowToast = prototype.showToast;

  prototype.injectInterface = function (): void {
    originalInjectInterface.call(this);
    applyIdentityToGameContainer(this.container as HTMLElement);
  };

  prototype.renderHud = function (): void {
    originalRenderHud.call(this);
    applyIdentityToGameContainer(this.container as HTMLElement);
  };

  prototype.showModal = function (
    title: string,
    body: string,
    actions: Array<{ label: string; action: () => void | Promise<void>; secondary?: boolean }>
  ): void {
    originalShowModal.call(this, title, body, actions);
    const container = this.container as HTMLElement;
    const modalTitle = container.querySelector<HTMLElement>("#modal-title");
    const modalBody = container.querySelector<HTMLElement>("#modal-body");
    const modalActions = container.querySelector<HTMLElement>("#modal-actions");
    if (modalTitle) modalTitle.textContent = personalizeModalTitle(modalTitle.textContent ?? title);
    if (modalBody) personalizeElementTree(modalBody);
    if (modalActions) personalizeElementTree(modalActions);
  };

  prototype.showToast = function (message: string, type: string): void {
    originalShowToast.call(this, personalizeText(message), type);
  };
}

function patchGeneratedContent(): void {
  patchHtmlRenderer(BalancedChannelSimulation.prototype as any, "renderLibraryHtml");
  patchHtmlRenderer(LifeSimulation.prototype as any, "renderAgendaHtml");
  patchHtmlRenderer(ProgressionSystem.prototype as any, "renderHubHtml");

  const taskPrototype = ComputerTaskController.prototype as any;
  if (!taskPrototype.__identityMessagesPatched) {
    taskPrototype.__identityMessagesPatched = true;
    const originalShowMessage = taskPrototype.showMessage;
    taskPrototype.showMessage = function (
      title: string,
      detail: string,
      type: string
    ): void {
      originalShowMessage.call(
        this,
        personalizeText(title),
        personalizeText(detail),
        type
      );
    };
  }
}

function patchHtmlRenderer(prototype: any, method: string): void {
  const flag = `__identity_${method}`;
  if (prototype[flag] || typeof prototype[method] !== "function") return;
  prototype[flag] = true;
  const original = prototype[method];
  prototype[method] = function (...args: unknown[]): string {
    return personalizeHtml(String(original.apply(this, args)));
  };
}

function installIdentityObserver(): void {
  const root = document.documentElement as HTMLElement & Record<string, unknown>;
  if (root[OBSERVER_FLAG]) return;
  root[OBSERVER_FLAG] = true;

  const observer = new MutationObserver((records) => {
    if (!currentProfile) return;
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) personalizeElementTree(node);
        else if (node.nodeType === Node.TEXT_NODE) personalizeTextNode(node as Text);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function applyDocumentIdentity(): void {
  if (!currentProfile) return;
  document.title = `${currentProfile.channelName} · Creator Life`;
  document.documentElement.dataset.characterName = currentProfile.characterName;
  document.documentElement.dataset.channelName = currentProfile.channelName;
  const container = document.getElementById("game-container");
  if (container) applyIdentityToGameContainer(container);
}

function applyIdentityToGameContainer(container: HTMLElement): void {
  if (!currentProfile) return;
  const brand = container.querySelector<HTMLElement>(".brand-card");
  if (brand) {
    const title = brand.querySelector<HTMLElement>("strong");
    const subtitle = brand.querySelector<HTMLElement>("small");
    if (title) title.textContent = currentProfile.characterName;
    if (subtitle) subtitle.textContent = currentProfile.channelName;
    brand.setAttribute(
      "aria-label",
      `${currentProfile.characterName}, criador do canal ${currentProfile.channelName}`
    );
  }

  const channelCard = container.querySelector<HTMLElement>(".channel-card");
  if (channelCard) {
    channelCard.dataset.channelName = currentProfile.channelName;
    channelCard.setAttribute("aria-label", `Estatísticas de ${currentProfile.channelName}`);
  }

  const canvas = container.querySelector<HTMLElement>("#game-canvas");
  canvas?.setAttribute(
    "aria-label",
    `Quarto 3D isométrico de ${currentProfile.characterName}, criador de ${currentProfile.channelName}`
  );
  personalizeElementTree(container);
}

function personalizeElementTree(root: HTMLElement): void {
  if (!currentProfile || root.closest(".identity-onboarding")) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  nodes.forEach(personalizeTextNode);

  if (root.matches("#modal-title, #progress-side-title")) {
    root.textContent = personalizeModalTitle(root.textContent ?? "");
  }
  root
    .querySelectorAll<HTMLElement>("#modal-title, #progress-side-title")
    .forEach((element) => {
      element.textContent = personalizeModalTitle(element.textContent ?? "");
    });
}

function personalizeTextNode(node: Text): void {
  const parent = node.parentElement;
  if (!parent || parent.closest(".identity-onboarding, input, textarea, script, style")) {
    return;
  }
  const original = node.nodeValue ?? "";
  const personalized = personalizeText(original);
  if (personalized !== original) node.nodeValue = personalized;
}

function personalizeModalTitle(value: string): string {
  const profile = currentProfile;
  if (!profile) return value;
  const normalized = value.trim();
  const exact: Record<string, string> = {
    "Seu computador": `Computador de ${profile.characterName}`,
    "Estação de produção": `Computador de ${profile.characterName}`,
    "Biblioteca do canal": `${profile.channelName} · Vídeos`,
    "Nosso canal e insights": `${profile.channelName} · Insights`,
    "Canal e insights": `${profile.channelName} · Insights`,
    "Evolução do criador": `Evolução de ${profile.characterName}`,
    "Status do personagem": `Status de ${profile.characterName}`,
    "Estudar para a faculdade": `Faculdade de ${profile.characterName}`
  };
  return exact[normalized] ?? personalizeText(value);
}

function personalizeText(value: string): string {
  const profile = currentProfile;
  if (!profile || !value) return value;

  const replacements: Array<[RegExp, string]> = [
    [/O personagem não sobreviveu/g, `${profile.characterName} não sobreviveu`],
    [/O personagem completou/g, `${profile.characterName} completou`],
    [/Status do personagem/g, `Status de ${profile.characterName}`],
    [/Evolução do criador/g, `Evolução de ${profile.characterName}`],
    [/Seu computador/g, `Computador de ${profile.characterName}`],
    [/Estação de produção/g, `Computador de ${profile.characterName}`],
    [/Quarto inicial/g, profile.characterName],
    [/Nosso canal e insights/g, `${profile.channelName} · Insights`],
    [/Biblioteca do canal/g, `${profile.channelName} · Vídeos`],
    [/Ver nosso canal e insights/g, `Abrir ${profile.channelName}`],
    [/Ver vídeos publicados/g, `Ver vídeos de ${profile.channelName}`],
    [/Canal monetizado/g, `${profile.channelName} monetizado`],
    [/Construa seu canal do zero/g, `Construa ${profile.channelName} do zero`],
    [/desenvolver o canal/g, `desenvolver ${profile.channelName}`],
    [/Gerencie canal,/g, `Gerencie ${profile.channelName},`],
    [/Gerencie seu canal/g, `Gerencie ${profile.channelName}`],
    [/seu canal/g, profile.channelName],
    [/Seu canal/g, profile.channelName],
    [/nosso canal/g, profile.channelName],
    [/Nosso canal/g, profile.channelName],
    [/catálogo do canal/g, `catálogo de ${profile.channelName}`],
    [/Biblioteca do Canal/g, `${profile.channelName} · Vídeos`]
  ];

  return replacements.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    value
  );
}

function personalizeHtml(value: string): string {
  const profile = currentProfile;
  if (!profile) return value;
  const character = escapeHtml(profile.characterName);
  const channel = escapeHtml(profile.channelName);
  return value
    .replace(/O personagem não sobreviveu/g, `${character} não sobreviveu`)
    .replace(/O personagem completou/g, `${character} completou`)
    .replace(/Status do personagem/g, `Status de ${character}`)
    .replace(/Evolução do criador/g, `Evolução de ${character}`)
    .replace(/Seu computador/g, `Computador de ${character}`)
    .replace(/Estação de produção/g, `Computador de ${character}`)
    .replace(/Quarto inicial/g, character)
    .replace(/Nosso canal e insights/g, `${channel} · Insights`)
    .replace(/Biblioteca do canal/g, `${channel} · Vídeos`)
    .replace(/Ver nosso canal e insights/g, `Abrir ${channel}`)
    .replace(/Ver vídeos publicados/g, `Ver vídeos de ${channel}`)
    .replace(/Canal monetizado/g, `${channel} monetizado`)
    .replace(/Construa seu canal do zero/g, `Construa ${channel} do zero`)
    .replace(/desenvolver o canal/g, `desenvolver ${channel}`)
    .replace(/Gerencie seu canal/g, `Gerencie ${channel}`)
    .replace(/seu canal/g, channel)
    .replace(/Seu canal/g, channel)
    .replace(/nosso canal/g, channel)
    .replace(/Nosso canal/g, channel)
    .replace(/catálogo do canal/g, `catálogo de ${channel}`);
}

function readProfile(): PlayerIdentity | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlayerIdentity>;
    const characterName = cleanName(String(parsed.characterName ?? ""), 24);
    const channelName = cleanName(String(parsed.channelName ?? ""), 32);
    if (validateNames(characterName, channelName)) return null;
    return {
      characterName,
      channelName,
      createdAt: Number.isFinite(parsed.createdAt) ? Number(parsed.createdAt) : Date.now()
    };
  } catch {
    return null;
  }
}

function validateNames(characterName: string, channelName: string): string | null {
  if (characterName.length < 2) {
    return "O nome do personagem precisa ter pelo menos 2 caracteres.";
  }
  if (channelName.length < 2) {
    return "O nome do canal precisa ter pelo menos 2 caracteres.";
  }
  if (characterName.length > 24 || channelName.length > 32) {
    return "Um dos nomes ultrapassou o limite permitido.";
  }
  if (!/[\p{L}\p{N}]/u.test(characterName)) {
    return "Digite um nome válido para o personagem.";
  }
  if (!/[\p{L}\p{N}]/u.test(channelName)) {
    return "Digite um nome válido para o canal.";
  }
  return null;
}

function cleanName(value: string, maximum: number): string {
  return value
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function setText(root: ParentNode, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
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
