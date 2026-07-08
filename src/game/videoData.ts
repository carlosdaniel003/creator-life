import type {
  EditingBlockOption,
  FormatOption,
  ThemeOption,
  ThumbnailOption
} from "./types";

const themeId = (value: string): ThemeOption["id"] =>
  value as ThemeOption["id"];

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
  },
  {
    id: themeId("react"),
    label: "React",
    description: "Reações, análises espontâneas e momentos virais.",
    trend: 11,
    color: 0xec4899
  },
  {
    id: themeId("gossip"),
    label: "Fofocas e cultura pop",
    description: "Polêmicas, notícias, celebridades e acontecimentos da internet.",
    trend: 13,
    color: 0xf97316
  },
  {
    id: themeId("music"),
    label: "Música e Rap",
    description: "Criação de beats, letras, gravações e lançamentos musicais.",
    trend: 9,
    color: 0x14b8a6
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
    idealThemes: [
      "games",
      "vlog",
      "challenge",
      themeId("react"),
      themeId("gossip"),
      themeId("music")
    ],
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
    idealThemes: [
      "games",
      "technology",
      "vlog",
      themeId("react"),
      themeId("gossip"),
      themeId("music")
    ],
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
    idealThemes: [
      "technology",
      "games",
      themeId("react"),
      themeId("music")
    ],
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
    idealThemes: [
      "technology",
      "tutorial",
      "vlog",
      themeId("gossip"),
      themeId("music")
    ],
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
    "Zerei o jogo usando apenas a pior arma",
    "O segredo que mudou completamente minha partida",
    "Tentei vencer sem usar o recurso mais importante",
    "Esse jogo ficou muito mais difícil depois da atualização",
    "A estratégia absurda que realmente funcionou",
    "Vale a pena começar a jogar agora?",
    "Eu testei o modo que quase ninguém consegue completar",
    "O detalhe escondido que muda tudo no jogo",
    "Comecei do zero e cheguei muito mais longe do que esperava",
    "A pior decisão possível acabou salvando minha partida"
  ],
  technology: [
    "Testei a tecnologia que promete mudar tudo",
    "O detalhe que ninguém conta antes da compra",
    "Isso realmente melhora o seu computador?",
    "Comprei barato e descobri onde estava o problema",
    "O upgrade que parece pequeno, mas muda o desempenho",
    "Usei por uma semana e essa é minha opinião sincera",
    "O erro mais comum na hora de montar um computador",
    "Vale a pena economizar justamente nesta peça?",
    "Comparei as duas opções que todo mundo recomenda",
    "A função escondida que quase ninguém está usando"
  ],
  vlog: [
    "Um dia inteiro tentando mudar minha rotina",
    "O que acontece por trás dos meus vídeos",
    "Começando do zero com poucos recursos",
    "Minha semana saiu completamente do controle",
    "Tudo o que deu errado antes deste vídeo ficar pronto",
    "Tentei organizar minha vida em apenas um dia",
    "A parte que ninguém mostra sobre criar conteúdo",
    "Passei o dia trabalhando no meu maior projeto",
    "O momento em que percebi que precisava mudar",
    "Como está sendo construir algo do zero"
  ],
  tutorial: [
    "Como fazer isso do jeito certo",
    "O guia completo para quem está começando",
    "Aprenda em poucos minutos e evite este erro",
    "Do zero ao resultado final passo a passo",
    "O método simples que facilita todo o processo",
    "Como resolver o problema sem perder horas",
    "Tudo o que você precisa saber antes de começar",
    "O passo que quase todo iniciante esquece",
    "Faça assim para conseguir um resultado melhor",
    "Guia prático: aprenda sem complicação"
  ],
  challenge: [
    "Tentei fazer isso antes do tempo acabar",
    "Passei um dia inteiro seguindo esta regra",
    "Será que eu consigo completar este desafio?",
    "Eu só tinha uma tentativa para fazer dar certo",
    "Aceitei o desafio mais difícil que encontrei",
    "Fiquei 24 horas sem usar o que mais precisava",
    "A cada erro o desafio ficava ainda pior",
    "Tentei bater meu próprio recorde em um único dia",
    "Começou fácil e terminou completamente impossível",
    "Eu não podia desistir até conseguir completar"
  ],
  react: [
    "Minha reação ao vídeo que dominou a internet",
    "Eu não esperava esse final",
    "Reagindo aos momentos mais absurdos da semana",
    "Isso ficou muito pior do que eu imaginava",
    "Vi pela primeira vez e precisei pausar",
    "React sincero: isso é genial ou exagerado?",
    "Os detalhes que quase ninguém percebeu",
    "Essa cena mudou completamente minha opinião",
    "Reagindo sem contexto ao vídeo mais comentado",
    "Eu tentei não rir e falhei rápido"
  ],
  gossip: [
    "O que realmente aconteceu nessa polêmica?",
    "Entenda a treta que tomou conta da internet",
    "Todo mundo está falando disso, mas falta um detalhe",
    "A história completa por trás dessa confusão",
    "Essa notícia mudou tudo de uma hora para outra",
    "O pronunciamento deixou mais perguntas que respostas",
    "Os detalhes esquecidos da maior polêmica da semana",
    "Quem está dizendo a verdade nessa história?",
    "Essa fofoca começou pequena e saiu do controle",
    "Resumo completo: do começo ao último pronunciamento"
  ],
  music: [
    "Fiz um rap do zero usando apenas meu quarto",
    "Criei um beat com sons que encontrei em casa",
    "Minha primeira música ficou melhor do que eu esperava",
    "Escrevi um rap em uma hora: esse foi o resultado",
    "Transformei minha rotina em uma letra de rap",
    "Do silêncio ao beat: criando uma música completa",
    "Gravei um refrão até ele finalmente funcionar",
    "Tentei produzir uma música sem equipamento profissional",
    "Como nasceu a letra mais sincera que já escrevi",
    "Fiz uma música sobre começar do zero"
  ]
};
