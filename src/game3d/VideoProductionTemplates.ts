import { EDITING_BLOCKS, FORMATS, THEMES, THUMBNAILS } from "../game/videoData";
import type {
  EditingBlockId,
  FormatOption,
  PlayerState,
  VideoDraft
} from "../game/types";
import type { EditingBlockPresentation } from "./EditingChallenge";
import {
  getConnector,
  getMatchedConnectorCount,
  getProductionStages,
  getTotalProductionHours,
  isConnectorMatched,
  type ProductionStage
} from "./VideoProductionModel";

export function renderPlannerView(
  draft: VideoDraft,
  state: PlayerState,
  errorMessage: string
): string {
  const selectedFormat = FORMATS.find((item) => item.id === draft.formatId);

  return `
    ${renderHeader(1, "Planejamento do vídeo", "A tendência e o desempenho real só aparecem depois da publicação.")}
    <div class="production-scroll">
      <section class="production-section">
        <div class="production-section__heading">
          <div><span>ETAPA 1</span><h3>Escolha o tema</h3></div>
          <small>Não existe indicação de qual assunto está com a melhor tendência.</small>
        </div>
        <div class="choice-grid choice-grid--themes">
          ${THEMES.map(
            (theme) => `
              <button type="button" class="production-choice ${draft.themeId === theme.id ? "is-selected" : ""}"
                data-theme-id="${theme.id}" style="--choice-accent:${toHex(theme.color)}">
                <span class="production-choice__accent"></span>
                <strong>${theme.label}</strong>
                <p>${theme.description}</p>
                <small>Potencial desconhecido</small>
              </button>`
          ).join("")}
        </div>
      </section>

      <section class="production-section">
        <div class="production-section__heading">
          <div><span>ETAPA 2</span><h3>Escolha o formato</h3></div>
          <small>O formato altera duração, esforço e o quebra-cabeça da edição.</small>
        </div>
        <div class="choice-grid choice-grid--formats">
          ${FORMATS.map(
            (format) => `
              <button type="button" class="production-choice production-choice--format ${draft.formatId === format.id ? "is-selected" : ""}"
                data-format-id="${format.id}">
                <div class="format-card__top"><strong>${format.label}</strong></div>
                <p>${format.description}</p>
                <div class="format-costs">
                  <span>${format.energyCost} energia</span>
                  <span>${format.creativityCost} criatividade</span>
                  <span>${getTotalProductionHours(format)}h estimadas</span>
                </div>
              </button>`
          ).join("")}
        </div>
      </section>

      <section class="production-section production-section--split">
        <div class="production-column">
          <div class="production-section__heading"><div><span>ETAPA 3</span><h3>Crie o título</h3></div></div>
          <label class="title-field">
            <span>Título do vídeo</span>
            <input id="video-title-input" maxlength="58" autocomplete="off"
              placeholder="Digite um título que represente sua ideia" value="${escapeHtml(draft.title)}" />
            <small id="title-counter">${draft.title.length}/58 caracteres</small>
          </label>
          <button type="button" id="generate-title" class="production-link-button">Gerar uma ideia baseada no tema</button>
        </div>

        <div class="production-column">
          <div class="production-section__heading"><div><span>ETAPA 4</span><h3>Escolha a thumbnail</h3></div></div>
          <div class="thumbnail-grid">
            ${THUMBNAILS.map(
              (thumbnail) => `
                <button type="button" class="thumbnail-choice ${draft.thumbnailId === thumbnail.id ? "is-selected" : ""}"
                  data-thumbnail-id="${thumbnail.id}" style="--thumbnail-accent:${toHex(thumbnail.color)}">
                  ${renderThumbnailPreview(thumbnail.id, thumbnail.label)}
                  <div><strong>${thumbnail.label}</strong><small>${thumbnail.description}</small></div>
                </button>`
            ).join("")}
          </div>
        </div>
      </section>
    </div>

    <footer class="production-footer">
      <div class="production-budget">
        <span>Recursos atuais</span>
        <strong>${state.energy} energia · ${state.creativity} criatividade</strong>
        <small>${selectedFormat ? `Processo completo estimado em ${getTotalProductionHours(selectedFormat)} horas.` : "Selecione um formato para estimar o tempo."}</small>
      </div>
      <div class="production-footer__actions">
        <span class="production-error">${errorMessage}</span>
        <button type="button" class="production-button production-button--secondary" id="cancel-production">Cancelar</button>
        <button type="button" class="production-button" id="continue-production">Ir para edição</button>
      </div>
    </footer>`;
}

export function renderEditorView(
  draft: VideoDraft,
  format: FormatOption,
  presentations: Record<EditingBlockId, EditingBlockPresentation>,
  selectedBlockId: EditingBlockId | null
): string {
  const theme = THEMES.find((item) => item.id === draft.themeId);
  const thumbnail = THUMBNAILS.find((item) => item.id === draft.thumbnailId);
  const matchedConnections = getMatchedConnectorCount(draft, format);
  const selectedPresentation = selectedBlockId
    ? presentations[selectedBlockId]
    : null;

  return `
    ${renderHeader(2, "Mesa de edição", "A ordem correta muda entre produções. Use os encaixes, não o nome das peças.")}
    <div class="production-scroll editor-layout">
      <section class="video-summary-card">
        <div class="video-summary-card__thumbnail" style="--thumbnail-accent:${toHex(thumbnail?.color ?? 0x38bdf8)}">
          ${renderThumbnailPreview(thumbnail?.id ?? "scene", thumbnail?.label ?? "Thumbnail")}
        </div>
        <div>
          <span>${theme?.label ?? "Tema"} · ${format.label}</span>
          <h3>${escapeHtml(draft.title)}</h3>
          <div class="video-summary-meta">
            <span>${format.energyCost} energia</span><span>${format.creativityCost} criatividade</span>
            <span>${getTotalProductionHours(format)}h estimadas</span>
          </div>
        </div>
      </section>

      <section class="editing-workspace editing-workspace--mystery">
        <div class="editing-workspace__header">
          <div><span>LINHA DO TEMPO</span><h3>Monte uma sequência de transições coerentes</h3></div>
          <div class="editing-mystery-status ${matchedConnections === 4 ? "is-complete" : ""}">
            <span>CONEXÕES ESTÁVEIS</span>
            <strong>${matchedConnections}/4</strong>
            <small>${matchedConnections === 4 ? "Todas as bordas encaixaram." : "A qualidade final continua oculta."}</small>
          </div>
        </div>
        <div class="timeline-ruler">${draft.editingOrder.map((_, index) => `<span>Faixa ${index + 1}</span>`).join("")}</div>
        <div class="editing-timeline editing-timeline--puzzle">
          ${draft.editingOrder
            .map((blockId, index) =>
              renderPuzzleBlock(
                draft,
                format,
                blockId,
                index,
                presentations,
                selectedBlockId
              )
            )
            .join("")}
        </div>
        <div class="editing-hint editing-hint--puzzle ${selectedBlockId ? "is-selecting" : ""}">
          <strong>${
            selectedPresentation
              ? `${selectedPresentation.code} selecionado`
              : "Arraste uma peça sobre outra para trocar as posições."
          }</strong>
          <span>${
            selectedBlockId
              ? "Clique em TROCAR em uma segunda peça para concluir a troca."
              : "Também é possível usar TROCAR ou as setas sem perder a rolagem."
          }</span>
        </div>
      </section>
    </div>
    <footer class="production-footer">
      <div class="production-budget"><span>PRÓXIMA ETAPA</span><strong>Planejamento, gravação, renderização e upload ainda consumirão tempo.</strong><small>O personagem ficará ocupado durante o processo.</small></div>
      <div class="production-footer__actions">
        <button type="button" class="production-button production-button--secondary" id="back-to-planner">Voltar</button>
        <button type="button" class="production-button" id="start-production">Começar produção</button>
      </div>
    </footer>`;
}

export function renderStageView(
  stage: ProductionStage,
  index: number,
  stages: ProductionStage[]
): string {
  return `
    ${renderHeader(2, "Produção em andamento", "O desempenho continua imprevisível enquanto o trabalho técnico é concluído.", true)}
    <div class="production-scroll processing-layout">
      <section class="processing-card">
        <div class="processing-visual processing-visual--${stage.id}"><div class="processing-orbit"></div><div class="processing-icon">${stageIcon(stage.id)}</div></div>
        <div class="processing-content">
          <span>PROCESSO ${index + 1} DE ${stages.length}</span><h3>${stage.label}</h3><p>${stage.description}</p>
          <div class="processing-progress"><div id="stage-progress-bar"></div></div>
          <div class="processing-progress__meta"><strong id="stage-progress-value">0%</strong><span>${stage.hours} hora${stage.hours === 1 ? "" : "s"} no jogo</span></div>
        </div>
      </section>
      <section class="processing-steps">
        ${stages.map((item, stepIndex) => `<div class="${stepIndex < index ? "is-complete" : stepIndex === index ? "is-current" : ""}"><span>${stepIndex < index ? "✓" : stepIndex + 1}</span><strong>${item.label}</strong></div>`).join("")}
      </section>
    </div>
    <footer class="production-footer processing-footer">
      <div class="production-budget"><span>AGUARDE</span><strong>O personagem está ocupado.</strong><small>O upload é uma etapa separada e também consome tempo.</small></div>
      <div class="upload-activity"><i></i><span id="processing-status">${stage.id === "upload" ? "Enviando dados..." : "Trabalhando..."}</span></div>
    </footer>`;
}

export function renderPublishedView(
  draft: VideoDraft,
  format: FormatOption
): string {
  return `
    ${renderHeader(3, "Upload concluído", "Ainda não há dados suficientes para saber como o vídeo vai se comportar.")}
    <div class="production-scroll published-layout">
      <section class="published-hero">
        <div class="published-pulse"><span>✓</span></div>
        <div><span>VÍDEO PUBLICADO</span><h3>${escapeHtml(draft.title)}</h3><p>Views, likes e inscritos aparecerão gradualmente enquanto a plataforma encontra público.</p></div>
      </section>
      <section class="early-analytics">
        <article><span>Visualizações</span><strong>0</strong><small>Aguardando impressões</small></article>
        <article><span>Likes</span><strong>0</strong><small>Nenhuma reação registrada</small></article>
        <article><span>Inscritos</span><strong>0</strong><small>A conversão ainda não começou</small></article>
      </section>
      <section class="published-explanation">
        <strong>O vídeo continuará ativo no catálogo.</strong>
        <p>Ele poderá receber novos acessos nas próximas horas, meses ou anos. Conteúdos pesquisáveis podem manter uma cauda longa.</p>
        <div class="published-time-summary"><span>Tempo total de produção</span><strong>${getTotalProductionHours(format)} horas</strong></div>
      </section>
    </div>
    <footer class="production-footer production-footer--result">
      <div class="production-budget"><span>ACOMPANHAMENTO</span><strong>Observe as animações do canal e consulte o catálogo no computador.</strong><small>Não há garantia de viralização.</small></div>
      <button type="button" class="production-button" id="finish-production">Voltar ao quarto</button>
    </footer>`;
}

function renderPuzzleBlock(
  draft: VideoDraft,
  format: FormatOption,
  blockId: VideoDraft["editingOrder"][number],
  index: number,
  presentations: Record<EditingBlockId, EditingBlockPresentation>,
  selectedBlockId: EditingBlockId | null
): string {
  const block = EDITING_BLOCKS.find((item) => item.id === blockId);
  if (!block) return "";

  const presentation = presentations[blockId] ?? {
    label: block.shortLabel,
    description: block.description,
    code: `CLIP-${index + 1}`,
    color: block.color
  };
  const left = getConnector(draft, format, blockId, "left");
  const right = getConnector(draft, format, blockId, "right");
  const selected = selectedBlockId === blockId;

  return `
    <article class="editing-block puzzle-piece ${selected ? "is-selected-for-swap" : ""}" draggable="true" data-block-id="${block.id}" style="--block-color:${toHex(presentation.color)}">
      ${left ? connectorHtml("left", left.shape, left.color, isConnectorMatched(draft, format, index, "left")) : '<span class="puzzle-edge puzzle-edge--flat puzzle-edge--left"></span>'}
      ${right ? connectorHtml("right", right.shape, right.color, isConnectorMatched(draft, format, index, "right")) : '<span class="puzzle-edge puzzle-edge--flat puzzle-edge--right"></span>'}
      <div class="editing-block__identity"><span class="editing-block__code">${presentation.code}</span><span class="editing-block__number">${index + 1}</span></div>
      <span class="editing-block__color"></span>
      <strong>${presentation.label}</strong><p>${presentation.description}</p>
      <div class="editing-block__controls">
        <button type="button" data-move="-1" aria-label="Mover ${presentation.label} para a esquerda">←</button>
        <button type="button" class="editing-block__swap" data-select-block="${block.id}">${selected ? "CANCELAR" : "TROCAR"}</button>
        <button type="button" data-move="1" aria-label="Mover ${presentation.label} para a direita">→</button>
      </div>
    </article>`;
}

function connectorHtml(
  side: "left" | "right",
  shape: string,
  color: string,
  matched: boolean
): string {
  return `<span class="puzzle-connector puzzle-connector--${side} puzzle-connector--${shape} ${matched ? "is-matched" : ""}" style="--connector-color:${color}"></span>`;
}

function renderHeader(
  step: number,
  title: string,
  subtitle: string,
  locked = false
): string {
  return `<header class="production-header"><div><span class="production-header__eyebrow">ESTAÇÃO DE PRODUÇÃO</span><h2>${title}</h2><p>${subtitle}</p></div><div class="production-progress">${[1, 2, 3].map((item) => `<span class="${item <= step ? "is-active" : ""}">${item}</span>`).join("<i></i>")}</div><button type="button" class="production-close" ${locked ? "disabled" : ""}>×</button></header>`;
}

function renderThumbnailPreview(id: string, label: string): string {
  const content = id === "expressive"
    ? '<span class="thumb-face">!</span><b>VOCÊ PRECISA VER</b>'
    : id === "clean"
      ? '<span class="thumb-clean-shape"></span><b>GUIA COMPLETO</b>'
      : id === "big-text"
        ? '<b class="thumb-big-text">MUDOU TUDO</b>'
        : '<span class="thumb-scene-shape"></span><b>O QUE ACONTECEU?</b>';
  return `<div class="thumbnail-preview thumbnail-preview--${id}" aria-label="Prévia ${label}">${content}</div>`;
}

function stageIcon(stage: ProductionStage["id"]): string {
  return stage === "planning" ? "✎" : stage === "recording" ? "●" : stage === "editing" ? "▰" : "↑";
}

function toHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
