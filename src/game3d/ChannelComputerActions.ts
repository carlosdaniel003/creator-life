import type { ChannelGain, PublishedVideo, ThemeId } from "../game/types";
import "../channel-computer-actions.css";
import { BalancedChannelSimulation } from "./BalancedChannelSimulation";
import { CharacterActionController } from "./CharacterActionController";
import type { ComputerActivityOptions } from "./ComputerTaskController";
import { CreatorLife3D } from "./CreatorLife3D";
import { ProgressionSystem } from "./ProgressionSystem";

interface ManagementState {
  version: 1;
  loyalty: number;
  community: number;
  channelReputation: number;
  reachBoostUntil: number;
  conversionBoostUntil: number;
  oldVideoBoostUntil: number;
  designerVideos: number;
  editorVideos: number;
  liveCount: number;
  liveViews: number;
  liveWatchHours: number;
  liveSubscribers: number;
  liveRevenue: number;
  commentsAnswered: number;
  paidPromotionSpent: number;
  reachRemainder: number;
  conversionRemainder: number;
  oldVideoRemainder: number;
}

interface RuntimeLike {
  state: {
    energy: number;
    hunger: number;
    thirst?: number;
    creativity: number;
    money: number;
    subscribers: number;
    totalViews: number;
  };
  showModal: (
    title: string,
    body: string,
    actions: Array<{ label: string; action: () => void; secondary?: boolean }>
  ) => void;
  closeModal: () => void;
  showToast: (
    message: string,
    type: "success" | "warning" | "neutral"
  ) => void;
  advanceTime: (hours: number) => void;
  renderHud: () => void;
}

interface ChannelSimulationLike {
  videos: ManagedVideo[];
  host: {
    getState: () => RuntimeLike["state"];
    onGain: (gain: ChannelGain) => void;
    onChange: () => void;
  };
  channelHours: number;
  nicheAuthority: Record<ThemeId, number>;
  management?: ManagementState;
}

interface ManagedVideo extends PublishedVideo {
  totalComments?: number;
}

interface ActionResult {
  error: string | null;
  message: string;
  completionTitle: string;
  completionDetail: string;
}

interface ReputationBridge {
  add: (audience: number, professional: number) => void;
}

declare global {
  interface Window {
    __creatorLifeChannelManagement?: {
      getState: () => ManagementState;
      getSimulation: () => ChannelSimulationLike | null;
    };
    __creatorLifeReputationBridge?: ReputationBridge;
  }
}

const PATCH_KEY = "__creatorLifeComputerManagementPatched";
let activeSimulation: ChannelSimulationLike | null = null;

patchCharacterFreelanceRouting();
patchProgressionReputation();
patchChannelSimulation();
patchComputerMenu();

function patchCharacterFreelanceRouting(): void {
  const prototype = CharacterActionController.prototype as any;
  if (prototype.__computerFreelanceRoutingPatched) return;
  prototype.__computerFreelanceRoutingPatched = true;

  const originalDecorateAction = prototype.decorateAction;
  prototype.decorateAction = function (action: {
    label: string;
    action: () => void;
  }): () => void {
    if (action.label.toLocaleLowerCase("pt-BR") === "aceitar trabalho") {
      return action.action;
    }
    return originalDecorateAction.call(this, action);
  };
}

function patchProgressionReputation(): void {
  const prototype = ProgressionSystem.prototype as any;
  if (prototype.__channelReputationBridgePatched) return;
  prototype.__channelReputationBridgePatched = true;

  const originalRestore = prototype.restore;
  prototype.restore = function (...args: unknown[]): void {
    originalRestore.apply(this, args);
    const instance = this as any;
    window.__creatorLifeReputationBridge = {
      add: (audience, professional) => {
        instance.save.reputations.audience = clamp(
          Number(instance.save.reputations.audience ?? 0) + audience,
          0,
          100
        );
        instance.save.reputations.professional = clamp(
          Number(instance.save.reputations.professional ?? 0) + professional,
          0,
          100
        );
        instance.host.onChange();
      }
    };
  };
}

function patchChannelSimulation(): void {
  const prototype = BalancedChannelSimulation.prototype as any;
  if (prototype[PATCH_KEY]) return;
  prototype[PATCH_KEY] = true;

  const originalAddVideo = prototype.addVideo;
  const originalAdvance = prototype.advance;
  const originalSerialize = prototype.serialize;
  const originalRestore = prototype.restore;
  const originalRenderLibraryHtml = prototype.renderLibraryHtml;

  prototype.addVideo = function (...args: unknown[]) {
    const simulation = this as ChannelSimulationLike;
    activeSimulation = simulation;
    const video = originalAddVideo.apply(this, args) as ManagedVideo;
    const management = ensureManagement(simulation);

    if (management.designerVideos > 0) {
      video.ctr = clamp(Number(video.ctr ?? 0.05) * 1.18 + 0.004, 0.025, 0.19);
      video.hiddenTitleScore = clamp(video.hiddenTitleScore + 7, 0, 100);
      video.hiddenPlanningScore = clamp(video.hiddenPlanningScore + 2, 0, 100);
      management.designerVideos -= 1;
    }

    if (management.editorVideos > 0) {
      video.retentionRate = clamp(
        Number(video.retentionRate ?? 0.4) * 1.13 + 0.018,
        0.24,
        0.86
      );
      video.hiddenEditingScore = clamp(video.hiddenEditingScore + 8, 0, 100);
      video.hiddenQuality = clamp(video.hiddenQuality + 4, 0, 100);
      management.editorVideos -= 1;
    }

    simulation.host.onChange();
    return video;
  };

  prototype.advance = function (hours: number, silent = false): ChannelGain {
    const simulation = this as ChannelSimulationLike;
    activeSimulation = simulation;
    const gain = originalAdvance.call(this, hours, silent) as ChannelGain;
    const extra = applyManagementPassiveEffects(simulation, hours);

    if (extra.views > 0 || extra.subscribers > 0 || extra.revenue > 0) {
      mergeGain(gain, extra);
      simulation.host.onChange();
      if (!silent) simulation.host.onGain(extra);
    }

    return gain;
  };

  prototype.serialize = function () {
    const simulation = this as ChannelSimulationLike;
    activeSimulation = simulation;
    return {
      ...(originalSerialize.call(this) as Record<string, unknown>),
      management: { ...ensureManagement(simulation) }
    };
  };

  prototype.restore = function (saved: any): ChannelGain {
    const simulation = this as ChannelSimulationLike;
    simulation.management = normalizeManagement(saved?.management);
    activeSimulation = simulation;
    const result = originalRestore.call(this, saved) as ChannelGain;
    ensureManagement(simulation);
    return result;
  };

  prototype.renderLibraryHtml = function (): string {
    const simulation = this as ChannelSimulationLike;
    activeSimulation = simulation;
    return `${originalRenderLibraryHtml.call(this)}${renderManagementInsights(simulation)}`;
  };

  window.__creatorLifeChannelManagement = {
    getState: () =>
      activeSimulation
        ? ensureManagement(activeSimulation)
        : normalizeManagement(null),
    getSimulation: () => activeSimulation
  };
}

function patchComputerMenu(): void {
  const prototype = CreatorLife3D.prototype as any;
  if (prototype.__channelComputerMenuPatched) return;
  prototype.__channelComputerMenuPatched = true;

  const originalShowModal = prototype.showModal;
  prototype.showModal = function (
    title: string,
    body: string,
    actions: Array<{ label: string; action: () => void; secondary?: boolean }>
  ): void {
    const runtime = this as RuntimeLike;
    let nextBody = body;
    let nextActions = actions;

    if (title === "Seu computador") {
      nextBody = `${body}<div class="computer-community-note"><span>COMUNIDADE E CRESCIMENTO</span><strong>Lives, comentários, divulgação e equipe</strong><p>Essas ações melhoram lealdade, conversão, alcance, reputação e recuperação do catálogo.</p></div>`;
      const managementAction = {
        label: "Comunidade e crescimento",
        action: () => {
          runtime.closeModal();
          openManagementMenu(runtime);
        }
      };
      const closeIndex = actions.findIndex((action) => action.secondary);
      nextActions = [...actions];
      nextActions.splice(
        closeIndex >= 0 ? closeIndex : nextActions.length,
        0,
        managementAction
      );
    }

    if (title === "Trabalho freelance") {
      nextBody = body
        .replace(
          "Entrega digital de 4 horas",
          "Trabalho remoto de 4 horas no computador"
        )
        .replace(
          "Exige internet ativa, 20 de energia e alimentação adequada.",
          "O personagem realizará o trabalho sentado no computador, com o relógio avançando durante as quatro horas."
        );
      nextActions = actions.map((action) =>
        action.label === "Aceitar trabalho"
          ? {
              ...action,
              action: () => {
                runtime.closeModal();
                runComputerActivity(runtime, {
                  title: "Executando trabalho freelance",
                  detail: "Desenvolvendo e entregando o projeto do cliente",
                  progressLabel: "Trabalho remoto · 4 horas",
                  hours: 4,
                  durationMs: 5600,
                  eyebrow: "TRABALHO FREELANCE",
                  icon: "◆",
                  onComplete: action.action
                });
              }
            }
          : action
      );
    }

    originalShowModal.call(this, title, nextBody, nextActions);
  };
}

function openManagementMenu(runtime: RuntimeLike, message = ""): void {
  const simulation = activeSimulation;
  if (!simulation) {
    runtime.showToast("O canal ainda está inicializando.", "warning");
    return;
  }
  const management = ensureManagement(simulation);
  const state = runtime.state;
  const latestVideo = simulation.videos[0];

  runtime.showModal(
    "Comunidade e crescimento",
    `${message ? `<p class="computer-action-message">${escapeHtml(message)}</p>` : ""}
    <section class="computer-action-overview">
      <article><span>LEALDADE</span><strong>${Math.round(management.loyalty)}/100</strong><p>Aumenta conversão e retorno do público.</p></article>
      <article><span>COMUNIDADE</span><strong>${Math.round(management.community)}/100</strong><p>Melhora lives, comentários e engajamento.</p></article>
      <article><span>REPUTAÇÃO</span><strong>${Math.round(management.channelReputation)}/100</strong><p>Facilita menções, parcerias e confiança.</p></article>
      <article><span>CONTRATOS</span><strong>${management.designerVideos + management.editorVideos}</strong><p>Vídeos futuros com suporte profissional.</p></article>
    </section>
    <section class="computer-action-status">
      <div><span>Impulso de alcance</span><strong>${remainingHours(management.reachBoostUntil, simulation.channelHours)}</strong></div>
      <div><span>Conversão elevada</span><strong>${remainingHours(management.conversionBoostUntil, simulation.channelHours)}</strong></div>
      <div><span>Recuperação do catálogo</span><strong>${remainingHours(management.oldVideoBoostUntil, simulation.channelHours)}</strong></div>
    </section>
    <section class="computer-action-grid">
      ${renderActionCard("live", "Fazer live", "2 horas", "Receba doações, gere tempo assistido e aproxime a comunidade.", state.subscribers < 25 ? "Recomendado ter 25 inscritos" : "Potencial baseado no público atual")}
      ${renderActionCard("comments", "Responder comentários", "1 hora", "Eleva lealdade, reputação e conversão dos próximos dias.", latestVideo ? "Disponível" : "Publique um vídeo primeiro")}
      ${renderActionCard("organic", "Fazer divulgação", "2 horas", "Divulgue organicamente e recupere vídeos relacionados.", latestVideo ? "Sem custo em dinheiro" : "Publique um vídeo primeiro")}
      ${renderActionCard("paid", "Pagar divulgação", "1 hora", "Compre alcance segmentado para o vídeo mais recente.", `Saldo: R$ ${state.money.toFixed(2)}`)}
      ${renderActionCard("designer", "Contratar designer", "Próximos 3 vídeos", "Melhora títulos, thumbnails e taxa de cliques.", management.designerVideos > 0 ? `${management.designerVideos} vídeos restantes` : "Pacote: R$ 250")}
      ${renderActionCard("editor", "Contratar editor", "Próximos 3 vídeos", "Melhora edição, retenção e qualidade dos vídeos.", management.editorVideos > 0 ? `${management.editorVideos} vídeos restantes` : "Pacote: R$ 450")}
    </section>`,
    [
      {
        label: "Fazer live",
        action: () => startLive(runtime)
      },
      {
        label: "Responder comentários",
        action: () => respondToComments(runtime)
      },
      {
        label: "Fazer divulgação",
        action: () => organicPromotion(runtime)
      },
      {
        label: "Pagar divulgação",
        action: () => openPaidPromotion(runtime)
      },
      {
        label: "Contratar designer",
        action: () => hireDesigner(runtime)
      },
      {
        label: "Contratar editor",
        action: () => hireEditor(runtime)
      },
      {
        label: "Fechar",
        action: () => runtime.closeModal(),
        secondary: true
      }
    ]
  );
}

function startLive(runtime: RuntimeLike): void {
  const error = validateNeeds(runtime, 18, 20);
  if (error) return showActionError(runtime, error);

  runtime.closeModal();
  runComputerActivity(runtime, {
    title: "Transmitindo ao vivo",
    detail: "Conversando com o público e respondendo o chat",
    progressLabel: "Live em andamento · 2 horas",
    hours: 2,
    durationMs: 4800,
    eyebrow: "TRANSMISSÃO AO VIVO",
    icon: "●",
    onComplete: () => {
      const result = performLive(runtime);
      runtime.advanceTime(2);
      runtime.renderHud();
      runtime.showToast(result.message, result.error ? "warning" : "success");
    },
    completionTitle: "Live encerrada",
    completionDetail: "Doações, público e engajamento foram contabilizados."
  });
}

function respondToComments(runtime: RuntimeLike): void {
  const simulation = activeSimulation;
  if (!simulation?.videos.length) {
    return showActionError(runtime, "Publique um vídeo antes de responder comentários.");
  }
  const error = validateNeeds(runtime, 7, 12);
  if (error) return showActionError(runtime, error);

  runtime.closeModal();
  runComputerActivity(runtime, {
    title: "Respondendo comentários",
    detail: "Interagindo com espectadores e fortalecendo a comunidade",
    progressLabel: "Comunidade · 1 hora",
    hours: 1,
    durationMs: 3000,
    eyebrow: "GESTÃO DA COMUNIDADE",
    icon: "●●",
    onComplete: () => {
      const result = performCommentResponses(runtime);
      runtime.advanceTime(1);
      runtime.renderHud();
      runtime.showToast(result.message, "success");
    },
    completionTitle: "Comentários respondidos",
    completionDetail: "A lealdade e a conversão do público aumentaram."
  });
}

function organicPromotion(runtime: RuntimeLike): void {
  const simulation = activeSimulation;
  if (!simulation?.videos.length) {
    return showActionError(runtime, "Publique um vídeo antes de fazer divulgação.");
  }
  const error = validateNeeds(runtime, 10, 15);
  if (error) return showActionError(runtime, error);

  runtime.closeModal();
  runComputerActivity(runtime, {
    title: "Divulgando o canal",
    detail: "Criando publicações e compartilhando vídeos em comunidades",
    progressLabel: "Divulgação orgânica · 2 horas",
    hours: 2,
    durationMs: 4100,
    eyebrow: "DIVULGAÇÃO ORGÂNICA",
    icon: "↗",
    onComplete: () => {
      const result = performOrganicPromotion(runtime);
      runtime.advanceTime(2);
      runtime.renderHud();
      runtime.showToast(result.message, "success");
    },
    completionTitle: "Divulgação concluída",
    completionDetail: "O alcance e a recuperação do catálogo foram ampliados."
  });
}

function openPaidPromotion(runtime: RuntimeLike): void {
  runtime.showModal(
    "Campanha de divulgação",
    `<section class="paid-promotion-grid">
      <article><span>BÁSICA</span><strong>R$ 50</strong><p>Teste pequeno e segmentado para o vídeo mais recente.</p></article>
      <article><span>DIRECIONADA</span><strong>R$ 150</strong><p>Mais impressões e alcance durante três dias.</p></article>
      <article><span>AMPLIADA</span><strong>R$ 400</strong><p>Campanha maior, recuperação do catálogo e reputação profissional.</p></article>
    </section>`,
    [
      { label: "Investir R$ 50", action: () => startPaidPromotion(runtime, 50) },
      { label: "Investir R$ 150", action: () => startPaidPromotion(runtime, 150) },
      { label: "Investir R$ 400", action: () => startPaidPromotion(runtime, 400) },
      {
        label: "Voltar",
        action: () => {
          runtime.closeModal();
          openManagementMenu(runtime);
        },
        secondary: true
      }
    ]
  );
}

function startPaidPromotion(runtime: RuntimeLike, budget: 50 | 150 | 400): void {
  const simulation = activeSimulation;
  if (!simulation?.videos.length) {
    return showActionError(runtime, "Publique um vídeo antes de criar uma campanha.");
  }
  if (runtime.state.money < budget) {
    return showActionError(runtime, `Saldo insuficiente para investir R$ ${budget}.`);
  }

  runtime.closeModal();
  runComputerActivity(runtime, {
    title: "Configurando campanha paga",
    detail: "Selecionando público e distribuindo o vídeo",
    progressLabel: `Campanha de R$ ${budget} · 1 hora`,
    hours: 1,
    durationMs: 3200,
    eyebrow: "DIVULGAÇÃO PAGA",
    icon: "$",
    onComplete: () => {
      const result = performPaidPromotion(runtime, budget);
      runtime.advanceTime(1);
      runtime.renderHud();
      runtime.showToast(result.message, "success");
    },
    completionTitle: "Campanha publicada",
    completionDetail: "Novas impressões e visualizações foram adicionadas ao canal."
  });
}

function hireDesigner(runtime: RuntimeLike): void {
  const simulation = activeSimulation;
  if (!simulation) return;
  const management = ensureManagement(simulation);
  if (management.designerVideos > 0) {
    return showActionError(runtime, "Já existe um pacote de design ativo.");
  }
  if (runtime.state.money < 250) {
    return showActionError(runtime, "Você precisa de R$ 250 para contratar o designer.");
  }

  runtime.closeModal();
  runComputerActivity(runtime, {
    title: "Alinhando identidade visual",
    detail: "Enviando referências e briefing para o designer",
    progressLabel: "Contratação profissional · 1 hora",
    hours: 1,
    durationMs: 2800,
    eyebrow: "CONTRATO DE DESIGN",
    icon: "◇",
    onComplete: () => {
      runtime.state.money -= 250;
      management.designerVideos = 3;
      management.channelReputation = clamp(
        management.channelReputation + 2,
        0,
        100
      );
      window.__creatorLifeReputationBridge?.add(0.5, 2);
      runtime.advanceTime(1);
      runtime.renderHud();
      runtime.showToast(
        "Designer contratado para os próximos 3 vídeos. −R$ 250.",
        "success"
      );
    },
    completionTitle: "Designer contratado",
    completionDetail: "Os próximos três vídeos terão CTR e apresentação melhores."
  });
}

function hireEditor(runtime: RuntimeLike): void {
  const simulation = activeSimulation;
  if (!simulation) return;
  const management = ensureManagement(simulation);
  if (management.editorVideos > 0) {
    return showActionError(runtime, "Já existe um pacote de edição ativo.");
  }
  if (runtime.state.money < 450) {
    return showActionError(runtime, "Você precisa de R$ 450 para contratar o editor.");
  }

  runtime.closeModal();
  runComputerActivity(runtime, {
    title: "Alinhando o fluxo de edição",
    detail: "Organizando arquivos e briefing para o editor",
    progressLabel: "Contratação profissional · 1 hora",
    hours: 1,
    durationMs: 3000,
    eyebrow: "CONTRATO DE EDIÇÃO",
    icon: "✂",
    onComplete: () => {
      runtime.state.money -= 450;
      management.editorVideos = 3;
      management.oldVideoBoostUntil = Math.max(
        management.oldVideoBoostUntil,
        simulation.channelHours + 72
      );
      management.channelReputation = clamp(
        management.channelReputation + 3,
        0,
        100
      );
      window.__creatorLifeReputationBridge?.add(0.5, 3);
      runtime.advanceTime(1);
      runtime.renderHud();
      runtime.showToast(
        "Editor contratado para os próximos 3 vídeos. −R$ 450.",
        "success"
      );
    },
    completionTitle: "Editor contratado",
    completionDetail: "Retenção, qualidade e recuperação do catálogo foram fortalecidas."
  });
}

function performLive(runtime: RuntimeLike): ActionResult {
  const simulation = activeSimulation;
  if (!simulation) return failed("Canal indisponível.");
  const management = ensureManagement(simulation);
  const state = runtime.state;
  const authority = Math.max(
    0,
    ...Object.values(simulation.nicheAuthority ?? {}).map(Number)
  );
  const viewers = Math.max(
    4,
    Math.round(
      4 +
        Math.sqrt(state.subscribers + 1) * (0.9 + management.loyalty / 90) +
        management.community * 0.22 +
        authority * 0.12
    )
  );
  const views = Math.round(viewers * random(1.5, 2.5));
  const subscribers = Math.max(
    0,
    Math.floor(views * (0.012 + management.loyalty * 0.00008))
  );
  const comments = Math.max(2, Math.round(viewers * random(0.35, 0.75)));
  const watchHours = viewers * random(0.65, 1.35);
  const donationIncome = random(4, 12) + viewers * random(0.18, 0.55);
  const adIncome = state.subscribers >= 1000 ? views * 0.003 : 0;
  const income = Math.round((donationIncome + adIncome) * 100) / 100;

  runtime.state.energy = Math.max(0, runtime.state.energy - 18);
  runtime.state.creativity = Math.max(0, runtime.state.creativity - 4);
  runtime.state.money += income;
  runtime.state.totalViews += views;
  runtime.state.subscribers += subscribers;

  management.liveCount += 1;
  management.liveViews += views;
  management.liveWatchHours += watchHours;
  management.liveSubscribers += subscribers;
  management.liveRevenue += income;
  management.loyalty = clamp(management.loyalty + 3.2, 0, 100);
  management.community = clamp(management.community + 4.5, 0, 100);
  management.channelReputation = clamp(
    management.channelReputation + 1.2,
    0,
    100
  );
  management.conversionBoostUntil = Math.max(
    management.conversionBoostUntil,
    simulation.channelHours + 48
  );
  window.__creatorLifeReputationBridge?.add(1.8, 0.4);
  simulation.host.onChange();

  return {
    error: null,
    message: `Live concluída: ${views} views, ${comments} mensagens, +${subscribers} inscritos e R$ ${income.toFixed(2)} em receita.`,
    completionTitle: "Live encerrada",
    completionDetail: "A comunidade ficou mais próxima do canal."
  };
}

function performCommentResponses(runtime: RuntimeLike): ActionResult {
  const simulation = activeSimulation!;
  const management = ensureManagement(simulation);
  const video = simulation.videos[0];
  const answered = Math.max(5, Math.round(random(7, 18) * (1 + management.community / 130)));

  runtime.state.energy = Math.max(0, runtime.state.energy - 7);
  video.totalComments = Number(video.totalComments ?? 0) + Math.round(answered * 0.32);
  management.commentsAnswered += answered;
  management.loyalty = clamp(management.loyalty + 4.2, 0, 100);
  management.community = clamp(management.community + 3.1, 0, 100);
  management.channelReputation = clamp(
    management.channelReputation + 1.1,
    0,
    100
  );
  management.conversionBoostUntil = Math.max(
    management.conversionBoostUntil,
    simulation.channelHours + 48
  );
  window.__creatorLifeReputationBridge?.add(1.4, 0.2);
  simulation.host.onChange();

  return {
    error: null,
    message: `${answered} comentários respondidos. Lealdade e conversão aumentaram por 48 horas.`,
    completionTitle: "Comunidade atendida",
    completionDetail: "O público percebeu a presença do criador."
  };
}

function performOrganicPromotion(runtime: RuntimeLike): ActionResult {
  const simulation = activeSimulation!;
  const management = ensureManagement(simulation);
  const video = simulation.videos[0];
  const impressions = Math.round(
    random(70, 180) * (1 + management.channelReputation / 120)
  );
  const views = Math.max(4, Math.round(impressions * Number(video.ctr ?? 0.05) * 1.15));
  const subscribers = Math.floor(
    views * (0.007 + management.loyalty * 0.00005)
  );

  runtime.state.energy = Math.max(0, runtime.state.energy - 10);
  runtime.state.creativity = Math.max(0, runtime.state.creativity - 6);
  applyDirectVideoGain(simulation, video, impressions, views, subscribers, 0);
  management.reachBoostUntil = Math.max(
    management.reachBoostUntil,
    simulation.channelHours + 48
  );
  management.oldVideoBoostUntil = Math.max(
    management.oldVideoBoostUntil,
    simulation.channelHours + 36
  );
  management.channelReputation = clamp(
    management.channelReputation + 1.4,
    0,
    100
  );
  window.__creatorLifeReputationBridge?.add(0.6, 0.8);

  return {
    error: null,
    message: `Divulgação concluída: +${impressions} impressões e +${views} views.`,
    completionTitle: "Divulgação concluída",
    completionDetail: "O vídeo e o catálogo ganharam novo alcance."
  };
}

function performPaidPromotion(
  runtime: RuntimeLike,
  budget: 50 | 150 | 400
): ActionResult {
  const simulation = activeSimulation!;
  const management = ensureManagement(simulation);
  const video = simulation.videos[0];
  const multiplier = budget === 50 ? 1 : budget === 150 ? 3.4 : 9.5;
  const impressions = Math.round(random(220, 380) * multiplier);
  const paidCtr = clamp(Number(video.ctr ?? 0.05) * 0.78, 0.025, 0.12);
  const views = Math.max(8, Math.round(impressions * paidCtr));
  const subscribers = Math.floor(
    views * (0.003 + management.loyalty * 0.000025)
  );

  runtime.state.money -= budget;
  management.paidPromotionSpent += budget;
  applyDirectVideoGain(simulation, video, impressions, views, subscribers, 0);
  management.reachBoostUntil = Math.max(
    management.reachBoostUntil,
    simulation.channelHours + (budget === 50 ? 36 : budget === 150 ? 72 : 120)
  );
  if (budget === 400) {
    management.oldVideoBoostUntil = Math.max(
      management.oldVideoBoostUntil,
      simulation.channelHours + 72
    );
    management.channelReputation = clamp(
      management.channelReputation + 1.5,
      0,
      100
    );
    window.__creatorLifeReputationBridge?.add(0.2, 1.2);
  }

  return {
    error: null,
    message: `Campanha concluída: +${impressions.toLocaleString("pt-BR")} impressões, +${views} views e +${subscribers} inscritos.`,
    completionTitle: "Campanha ativa",
    completionDetail: "O vídeo mais recente recebeu distribuição paga segmentada."
  };
}

function applyManagementPassiveEffects(
  simulation: ChannelSimulationLike,
  hours: number
): ChannelGain {
  const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const management = ensureManagement(simulation);
  const state = simulation.host.getState();
  const gain = emptyGain();
  if (safeHours <= 0 || simulation.videos.length === 0) return gain;

  const latest = simulation.videos[0];
  const reachActive = simulation.channelHours < management.reachBoostUntil;
  const conversionActive = simulation.channelHours < management.conversionBoostUntil;
  const oldVideoActive = simulation.channelHours < management.oldVideoBoostUntil;

  if (reachActive) {
    management.reachRemainder +=
      safeHours * (1.8 + management.channelReputation * 0.035 + management.community * 0.018);
    const impressions = Math.floor(management.reachRemainder);
    management.reachRemainder -= impressions;
    const views = Math.floor(impressions * Number(latest.ctr ?? 0.05));
    if (impressions > 0) {
      applyDirectVideoGain(simulation, latest, impressions, views, 0, 0, false);
      gain.impressions = impressions;
      gain.clicks = views;
      gain.views += views;
    }
  }

  const eligibleViews = gain.views;
  if (conversionActive || management.loyalty > 8) {
    const conversionRate =
      management.loyalty * 0.000035 +
      management.community * 0.000018 +
      (conversionActive ? 0.0022 : 0);
    management.conversionRemainder += eligibleViews * conversionRate;
    const subscribers = Math.floor(management.conversionRemainder);
    management.conversionRemainder -= subscribers;
    if (subscribers > 0) {
      latest.totalSubscribers += subscribers;
      state.subscribers += subscribers;
      gain.subscribers += subscribers;
    }
  }

  if (oldVideoActive) {
    const oldVideos = simulation.videos.filter((video) => video.ageHours >= 72);
    if (oldVideos.length > 0) {
      const target = oldVideos[Math.floor(simulation.channelHours / 12) % oldVideos.length];
      management.oldVideoRemainder +=
        safeHours *
        (0.35 + target.hiddenQuality / 100 + management.loyalty * 0.006);
      const views = Math.floor(management.oldVideoRemainder);
      management.oldVideoRemainder -= views;
      if (views > 0) {
        const impressions = Math.max(
          views,
          Math.round(views / Math.max(0.025, Number(target.ctr ?? 0.05)))
        );
        applyDirectVideoGain(simulation, target, impressions, views, 0, 0, false);
        gain.impressions = Number(gain.impressions ?? 0) + impressions;
        gain.clicks = Number(gain.clicks ?? 0) + views;
        gain.views += views;
        gain.sourceVideoId = target.id;
        gain.sourceTitle = "Vídeo antigo recuperado";
      }
    }
  }

  management.loyalty = Math.max(0, management.loyalty - safeHours * 0.004);
  management.community = Math.max(0, management.community - safeHours * 0.003);

  if (!gain.sourceVideoId && gain.views > 0) {
    gain.sourceVideoId = latest.id;
    gain.sourceTitle = "Impulso da comunidade";
  }
  return gain;
}

function applyDirectVideoGain(
  simulation: ChannelSimulationLike,
  video: ManagedVideo,
  impressions: number,
  views: number,
  subscribers: number,
  revenue: number,
  notify = true
): void {
  const state = simulation.host.getState();
  const retention = Number(video.retentionRate ?? 0.4);
  const watchHours =
    (views * getFormatMinutes(video.formatId) * retention) / 60;
  const likes = Math.max(0, Math.floor(views * (0.025 + retention * 0.025)));

  video.totalImpressions = Number(video.totalImpressions ?? 0) + impressions;
  video.totalClicks = Number(video.totalClicks ?? 0) + views;
  video.totalViews += views;
  video.totalWatchHours = Number(video.totalWatchHours ?? 0) + watchHours;
  video.totalLikes += likes;
  video.totalSubscribers += subscribers;
  video.totalRevenue += revenue;
  state.totalViews += views;
  state.subscribers += subscribers;
  state.money += revenue;
  simulation.host.onChange();

  if (notify && (views > 0 || subscribers > 0 || revenue > 0)) {
    simulation.host.onGain({
      impressions,
      clicks: views,
      views,
      watchHours,
      internalViews: 0,
      likes,
      subscribers,
      revenue,
      sourceVideoId: video.id,
      sourceTitle: video.title
    });
  }
}

function renderManagementInsights(simulation: ChannelSimulationLike): string {
  const management = ensureManagement(simulation);
  return `
    <section class="channel-management-insights">
      <div class="channel-section-heading"><div><span>GESTÃO DA COMUNIDADE</span><h3>Lealdade, equipe e divulgação</h3></div><small>Ações realizadas no computador afetam conversão, alcance, reputação e recuperação de vídeos antigos.</small></div>
      <div class="channel-management-metrics">
        <article><span>Lealdade</span><strong>${Math.round(management.loyalty)}/100</strong><p>Público recorrente e conversão.</p></article>
        <article><span>Comunidade</span><strong>${Math.round(management.community)}/100</strong><p>Engajamento e desempenho em lives.</p></article>
        <article><span>Reputação</span><strong>${Math.round(management.channelReputation)}/100</strong><p>Confiança, citações e oportunidades.</p></article>
        <article><span>Lives</span><strong>${management.liveCount}</strong><p>${management.liveViews.toLocaleString("pt-BR")} views · R$ ${management.liveRevenue.toFixed(2)}</p></article>
        <article><span>Designer</span><strong>${management.designerVideos} vídeos</strong><p>Contrato restante para thumbnails e títulos.</p></article>
        <article><span>Editor</span><strong>${management.editorVideos} vídeos</strong><p>Contrato restante para edição e retenção.</p></article>
      </div>
    </section>`;
}

function renderActionCard(
  type: string,
  title: string,
  duration: string,
  description: string,
  status: string
): string {
  return `<article class="computer-action-card" data-action="${type}"><div><span>${duration}</span><strong>${title}</strong></div><p>${description}</p><small>${status}</small></article>`;
}

function runComputerActivity(
  runtime: RuntimeLike,
  options: ComputerActivityOptions
): void {
  const task = window.__creatorLifeComputerTask;
  if (!task) {
    Promise.resolve(options.onComplete()).catch(() => {
      runtime.showToast("Não foi possível concluir a atividade.", "warning");
    });
    return;
  }
  if (task.isActive()) {
    runtime.showToast("Conclua a atividade atual primeiro.", "warning");
    return;
  }
  void task.runActivity(options);
}

function validateNeeds(
  runtime: RuntimeLike,
  energyCost: number,
  minimumNeeds: number
): string | null {
  if (runtime.state.energy < energyCost) {
    return `Esta ação exige pelo menos ${energyCost} de energia.`;
  }
  if (
    runtime.state.hunger < minimumNeeds ||
    Number(runtime.state.thirst ?? 100) < minimumNeeds
  ) {
    return "Coma e beba água antes de iniciar esta atividade.";
  }
  return null;
}

function showActionError(runtime: RuntimeLike, message: string): void {
  runtime.showToast(message, "warning");
}

function ensureManagement(
  simulation: ChannelSimulationLike
): ManagementState {
  if (!simulation.management) {
    simulation.management = normalizeManagement(null);
  }
  return simulation.management;
}

function normalizeManagement(saved: Partial<ManagementState> | null): ManagementState {
  return {
    version: 1,
    loyalty: clamp(Number(saved?.loyalty ?? 4), 0, 100),
    community: clamp(Number(saved?.community ?? 3), 0, 100),
    channelReputation: clamp(Number(saved?.channelReputation ?? 2), 0, 100),
    reachBoostUntil: Number(saved?.reachBoostUntil ?? 0),
    conversionBoostUntil: Number(saved?.conversionBoostUntil ?? 0),
    oldVideoBoostUntil: Number(saved?.oldVideoBoostUntil ?? 0),
    designerVideos: Math.max(0, Math.floor(Number(saved?.designerVideos ?? 0))),
    editorVideos: Math.max(0, Math.floor(Number(saved?.editorVideos ?? 0))),
    liveCount: Math.max(0, Math.floor(Number(saved?.liveCount ?? 0))),
    liveViews: Math.max(0, Math.floor(Number(saved?.liveViews ?? 0))),
    liveWatchHours: Math.max(0, Number(saved?.liveWatchHours ?? 0)),
    liveSubscribers: Math.max(0, Math.floor(Number(saved?.liveSubscribers ?? 0))),
    liveRevenue: Math.max(0, Number(saved?.liveRevenue ?? 0)),
    commentsAnswered: Math.max(0, Math.floor(Number(saved?.commentsAnswered ?? 0))),
    paidPromotionSpent: Math.max(0, Number(saved?.paidPromotionSpent ?? 0)),
    reachRemainder: Math.max(0, Number(saved?.reachRemainder ?? 0)),
    conversionRemainder: Math.max(0, Number(saved?.conversionRemainder ?? 0)),
    oldVideoRemainder: Math.max(0, Number(saved?.oldVideoRemainder ?? 0))
  };
}

function remainingHours(until: number, current: number): string {
  const remaining = Math.max(0, until - current);
  return remaining > 0 ? `${Math.ceil(remaining)}h restantes` : "Inativo";
}

function mergeGain(target: ChannelGain, source: ChannelGain): void {
  target.impressions = Number(target.impressions ?? 0) + Number(source.impressions ?? 0);
  target.clicks = Number(target.clicks ?? 0) + Number(source.clicks ?? 0);
  target.views += source.views;
  target.watchHours = Number(target.watchHours ?? 0) + Number(source.watchHours ?? 0);
  target.internalViews = Number(target.internalViews ?? 0) + Number(source.internalViews ?? 0);
  target.likes += source.likes;
  target.subscribers += source.subscribers;
  target.revenue += source.revenue;
  if (source.sourceVideoId) {
    target.sourceVideoId = source.sourceVideoId;
    target.sourceTitle = source.sourceTitle;
  }
}

function emptyGain(): ChannelGain {
  return {
    impressions: 0,
    clicks: 0,
    views: 0,
    watchHours: 0,
    internalViews: 0,
    likes: 0,
    subscribers: 0,
    revenue: 0,
    sourceVideoId: null,
    sourceTitle: "Canal"
  };
}

function getFormatMinutes(formatId: string): number {
  if (formatId === "short") return 0.75;
  if (formatId === "review") return 11;
  if (formatId === "documentary") return 19;
  return 8;
}

function failed(message: string): ActionResult {
  return {
    error: message,
    message,
    completionTitle: "Ação não concluída",
    completionDetail: message
  };
}

function random(minimum: number, maximum: number): number {
  return minimum + Math.random() * (maximum - minimum);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
