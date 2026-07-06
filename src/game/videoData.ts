import type {
  EditingBlockOption,
  FormatOption,
  ThemeOption,
  ThumbnailOption
} from "./types";

export const THEMES: ThemeOption[] = [
  {
    id: "games",
    label: "Games",
    description: "Partidas, lançamentos e desafios gamer.",
    trend: 10,
    color: 0x8b5cf6
  },
  {
    id: "technology",
    label: "Tecnologia",
    description: "Produtos, novidades e opiniões técnicas.",
    trend: 8,
    color: 0x38bdf8
  },
  {
    id: "vlog",
    label: "Vlog",
    description: "Rotina, bastidores e histórias pessoais.",
    trend: 6,
    color: 0xf59e0b
  },
  {
    id: "tutorial",
    label: "Tutorial",
    description: "Conteúdo útil e pesquisável por mais tempo.",
    trend: 7,
    color: 0x10b981
  },
  {
    id: "challenge",
    label: "Desafio",
    description: "Ideias chamativas com alto potencial viral.",
    trend: 12,
    color: 0xf43f5e
  }
];

export const FORMATS: FormatOption[] = [
  {
    id: "short",
    label: "Short",
    description: "Rápido, direto e com grande alcance inicial.",
    reachMultiplier: 1.35,
    qualityBonus: -4,
    energyCost: 18,
    creativityCost: 11,
    hours: 2,
    idealThemes: ["games", "vlog", "challenge"],
    idealOrder: ["hook", "highlight", "context", "development", "cta"]
  },
  {
    id: "standard",
    label: "Vídeo comum",
    description: "Equilíbrio entre alcance, qualidade e esforço.",
    reachMultiplier: 1,
    qualityBonus: 3,
    energyCost: 25,
    creativityCost: 15,
    hours: 4,
    idealThemes: ["games", "technology", "vlog"],
    idealOrder: ["hook", "context", "development", "highlight", "cta"]
  },
  {
    id: "review",
    label: "Review",
    description: "Análise estruturada com maior credibilidade.",
    reachMultiplier: 0.9,
    qualityBonus: 8,
    energyCost: 29,
    creativityCost: 17,
    hours: 5,
    idealThemes: ["technology", "games"],
    idealOrder: ["hook", "context", "development", "highlight", "cta"]
  },
  {
    id: "documentary",
    label: "Especial",
    description: "Vídeo longo, trabalhoso e com alto teto de qualidade.",
    reachMultiplier: 0.82,
    qualityBonus: 14,
    energyCost: 36,
    creativityCost: 24,
    hours: 7,
    idealThemes: ["technology", "tutorial", "vlog"],
    idealOrder: ["hook", "context", "development", "highlight", "cta"]
  }
];

export const THUMBNAILS: ThumbnailOption[] = [
  {
    id: "expressive",
    label: "Rosto expressivo",
    description: "Mais cliques, mas pode parecer apelativa.",
    clickBonus: 12,
    credibilityBonus: -3,
    color: 0xf97316
  },
  {
    id: "clean",
    label: "Design limpo",
    description: "Boa credibilidade e comunicação objetiva.",
    clickBonus: 5,
    credibilityBonus: 8,
    color: 0x22c55e
  },
  {
    id: "big-text",
    label: "Texto grande",
    description: "Promessa muito visível para telas pequenas.",
    clickBonus: 9,
    credibilityBonus: 1,
    color: 0xeab308
  },
  {
    id: "scene",
    label: "Cena do vídeo",
    description: "Autêntica, mas depende muito da imagem escolhida.",
    clickBonus: 4,
    credibilityBonus: 5,
    color: 0x3b82f6
  }
];

export const EDITING_BLOCKS: EditingBlockOption[] = [
  {
    id: "hook",
    label: "Gancho inicial",
    shortLabel: "GANCHO",
    description: "Mostra rapidamente por que vale a pena continuar.",
    color: 0xf43f5e
  },
  {
    id: "context",
    label: "Contexto",
    shortLabel: "CONTEXTO",
    description: "Explica o objetivo e prepara o público.",
    color: 0x3b82f6
  },
  {
    id: "development",
    label: "Desenvolvimento",
    shortLabel: "CONTEÚDO",
    description: "Entrega a parte principal do vídeo.",
    color: 0x8b5cf6
  },
  {
    id: "highlight",
    label: "Momento principal",
    shortLabel: "DESTAQUE",
    description: "Concentra a melhor cena ou revelação.",
    color: 0xf59e0b
  },
  {
    id: "cta",
    label: "Encerramento",
    shortLabel: "FINAL",
    description: "Conclui e convida o público a interagir.",
    color: 0x10b981
  }
];

export const TITLE_IDEAS: Record<string, string[]> = {
  games: [
    "Eu tentei vencer usando a pior estratégia",
    "O jogo mudou e ninguém percebeu isso",
    "Vale a pena começar a jogar agora?"
  ],
  technology: [
    "Testei a tecnologia que promete mudar tudo",
    "O detalhe que ninguém conta antes da compra",
    "Isso realmente melhora o seu computador?"
  ],
  vlog: [
    "Um dia inteiro tentando mudar minha rotina",
    "O que acontece por trás dos meus vídeos",
    "Começando do zero com poucos recursos"
  ],
  tutorial: [
    "Como fazer isso do jeito certo",
    "O guia completo para quem está começando",
    "Aprenda em poucos minutos e evite este erro"
  ],
  challenge: [
    "Tentei fazer isso antes do tempo acabar",
    "Passei um dia inteiro seguindo esta regra",
    "Será que eu consigo completar este desafio?"
  ]
};
