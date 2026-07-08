import { ProgressionSystem } from "./ProgressionSystem";
import "./ProgressionExperiencePatch";
import { WorldTimeSystem } from "./WorldTimeSystem";

const RESET_FLAG = "creator-life-reset-pending-v1";
const HEALTH_KEY = "creator-life-health-v1";
const HEALTH_MIGRATION_KEY = "creator-life-health-null-fix-v1";
const STORAGE_PREFIX = "creator-life-";

declare global {
  interface Window {
    __creatorLifeResetStory?: () => void;
  }
}

function clearStoryStorage(): void {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));

  // O próximo carregamento precisa começar com uma condição válida antes de
  // qualquer sistema tentar restaurar o personagem.
  localStorage.setItem(HEALTH_KEY, "100");
  localStorage.setItem(HEALTH_MIGRATION_KEY, "applied");
}

function requestFullStoryReset(): void {
  sessionStorage.setItem(RESET_FLAG, "1");
  clearStoryStorage();
  window.location.reload();
}

// Quando a página antiga inicia o reload, o autosave de beforeunload não pode
// recriar fome, sede, dinheiro ou progresso da história apagada.
window.addEventListener("beforeunload", (event) => {
  if (sessionStorage.getItem(RESET_FLAG) !== "1") return;
  event.stopImmediatePropagation();
});

// Segunda limpeza no documento novo. Isso protege contra outro listener que
// tenha conseguido escrever no armazenamento durante o encerramento anterior.
if (sessionStorage.getItem(RESET_FLAG) === "1") {
  clearStoryStorage();
  sessionStorage.removeItem(RESET_FLAG);
}

window.__creatorLifeResetStory = requestFullStoryReset;

const worldTimePrototype = WorldTimeSystem.prototype as any;
if (!worldTimePrototype.__fullStoryResetPatched) {
  worldTimePrototype.__fullStoryResetPatched = true;
  worldTimePrototype.startNewStory = requestFullStoryReset;
}

// A versão antiga usava Number(null), que produz zero. A chave ausente deve
// significar personagem novo com 100 de vida, não morte instantânea.
const progressionPrototype = ProgressionSystem.prototype as any;
if (!progressionPrototype.__safeHealthRestorePatched) {
  progressionPrototype.__safeHealthRestorePatched = true;
  const originalRestore = progressionPrototype.restore;

  progressionPrototype.restore = function (saved: unknown): void {
    const rawHealth = localStorage.getItem(HEALTH_KEY);
    const parsedHealth = rawHealth === null ? Number.NaN : Number(rawHealth);
    if (!Number.isFinite(parsedHealth)) {
      localStorage.setItem(HEALTH_KEY, "100");
    }

    originalRestore.call(this, saved);
    const state = this.host.getState();
    if (!Number.isFinite(state.health)) state.health = 100;
  };
}

// O botão exibido após a morte utiliza a mesma limpeza completa usada pelo
// menu de pausa. O capture impede o listener antigo de apenas remover parte do save.
document.addEventListener(
  "click",
  (event) => {
    const target = event.target as Element | null;
    if (!target?.closest(".character-death-overlay button")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    requestFullStoryReset();
  },
  true
);
