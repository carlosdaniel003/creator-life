import type { EditingBlockId } from "../game/types";
import "../editing-ux.css";

export interface EditingBlockPresentation {
  label: string;
  description: string;
  code: string;
  color: number;
}

const NAME_VARIANTS: Record<
  EditingBlockId,
  Array<{ label: string; description: string }>
> = {
  hook: [
    {
      label: "Pulso Zero",
      description: "Trecho curto, energético e com promessa forte."
    },
    {
      label: "Corte Ímã",
      description: "Entrada rápida que tenta capturar atenção imediatamente."
    },
    {
      label: "Faísca 07",
      description: "Cena de alto impacto e pouca explicação."
    },
    {
      label: "Entrada Prisma",
      description: "Começa com contraste, curiosidade e ritmo acelerado."
    }
  ],
  context: [
    {
      label: "Mapa Atlas",
      description: "Organiza referências e reduz a confusão do público."
    },
    {
      label: "Plano Norte",
      description: "Apresenta a situação e orienta o que será acompanhado."
    },
    {
      label: "Camada Azul",
      description: "Conecta informações antes de uma sequência mais intensa."
    },
    {
      label: "Ponto Base",
      description: "Estabelece regras, objetivo e cenário da experiência."
    }
  ],
  development: [
    {
      label: "Núcleo Delta",
      description: "Concentra a maior densidade de informação do projeto."
    },
    {
      label: "Trilha Central",
      description: "Sequência longa que sustenta a ideia principal."
    },
    {
      label: "Bloco Vector",
      description: "Trecho de desenvolvimento com várias ações conectadas."
    },
    {
      label: "Corpo Lunar",
      description: "Parte extensa onde a experiência realmente acontece."
    }
  ],
  highlight: [
    {
      label: "Pico Ômega",
      description: "Momento de maior intensidade visual ou emocional."
    },
    {
      label: "Cena Rubi",
      description: "Revelação, resultado ou cena que merece destaque."
    },
    {
      label: "Virada Neon",
      description: "Altera o ritmo e entrega uma recompensa importante."
    },
    {
      label: "Momento Solar",
      description: "Trecho memorável com forte valor de retenção."
    }
  ],
  cta: [
    {
      label: "Sinal Echo",
      description: "Cria ligação direta com a audiência e propõe uma ação."
    },
    {
      label: "Rastro 21",
      description: "Mantém a conversa ativa e conduz para outro movimento."
    },
    {
      label: "Ponte Violeta",
      description: "Conecta o conteúdo ao próximo passo do espectador."
    },
    {
      label: "Chamada Orbit",
      description: "Trecho de interação que pode funcionar antes ou depois do pico."
    }
  ]
};

const COLORS = [0xef4444, 0xf97316, 0xeab308, 0x8b5cf6, 0x06b6d4];
const CODE_PREFIXES = ["AX", "K", "VX", "R", "Q"];

export function createEditingBlockPresentations(): Record<
  EditingBlockId,
  EditingBlockPresentation
> {
  const blockIds: EditingBlockId[] = [
    "hook",
    "context",
    "development",
    "highlight",
    "cta"
  ];
  const shuffledColors = shuffle(COLORS);
  const shuffledPrefixes = shuffle(CODE_PREFIXES);

  return blockIds.reduce(
    (result, blockId, index) => {
      const variants = NAME_VARIANTS[blockId];
      const variant = variants[Math.floor(Math.random() * variants.length)];
      result[blockId] = {
        label: variant.label,
        description: variant.description,
        code: `${shuffledPrefixes[index]}-${String(
          10 + Math.floor(Math.random() * 89)
        ).padStart(2, "0")}`,
        color: shuffledColors[index]
      };
      return result;
    },
    {} as Record<EditingBlockId, EditingBlockPresentation>
  );
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}
