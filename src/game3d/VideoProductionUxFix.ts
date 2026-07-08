import { TITLE_IDEAS } from "../game/videoData";

const recentTitleByTheme = new Map<string, string>();

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

// O jogo registrava W, A, S, D e F no window e chamava preventDefault mesmo
// quando o foco estava no campo do título. Este listener é registrado antes do
// runtime 3D e impede que as teclas de movimento consumam a digitação.
window.addEventListener("keydown", (event) => {
  if (!isEditableTarget(event.target)) return;
  event.stopImmediatePropagation();
});

window.addEventListener("keyup", (event) => {
  if (!isEditableTarget(event.target)) return;
  event.stopImmediatePropagation();
});

function chooseTitle(themeId: string, currentTitle: string): string {
  const ideas = TITLE_IDEAS[themeId] ?? [];
  if (!ideas.length) return currentTitle;

  const previous = recentTitleByTheme.get(themeId) ?? "";
  const available = ideas.filter(
    (idea) => idea !== currentTitle && idea !== previous
  );
  const source = available.length ? available : ideas;
  const selected = source[Math.floor(Math.random() * source.length)] ?? ideas[0];
  recentTitleByTheme.set(themeId, selected);
  return selected;
}

document.addEventListener(
  "click",
  (event) => {
    const target = event.target as Element | null;
    const button = target?.closest<HTMLButtonElement>("#generate-title");
    if (!button) return;

    const panel = button.closest<HTMLElement>(".production-panel");
    const selectedTheme = panel?.querySelector<HTMLElement>(
      "[data-theme-id].is-selected"
    );
    const input = panel?.querySelector<HTMLInputElement>("#video-title-input");
    if (!selectedTheme || !input) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const themeId = selectedTheme.dataset.themeId ?? "";
    const title = chooseTitle(themeId, input.value.trim());
    input.value = title;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus({ preventScroll: true });
    input.setSelectionRange(title.length, title.length);
  },
  true
);

// Melhora a experiência principalmente em celulares e navegadores com correção
// automática agressiva.
const observer = new MutationObserver(() => {
  const input = document.querySelector<HTMLInputElement>("#video-title-input");
  if (!input || input.dataset.typingReady === "true") return;
  input.dataset.typingReady = "true";
  input.type = "text";
  input.inputMode = "text";
  input.spellcheck = true;
  input.setAttribute("enterkeyhint", "done");
});

observer.observe(document.documentElement, { childList: true, subtree: true });
