import type {
  EquipmentSlot,
  ReputationId,
  RoomUpgradeSlot,
  SkillId,
  ThemeId
} from "../game/types";

export interface UpgradeTier {
  level: number;
  name: string;
  price: number;
  description: string;
  requiredDesk?: number;
}

export interface CourseDefinition {
  id: string;
  name: string;
  price: number;
  hours: number;
  skill: SkillId;
  skillLevels: number;
  prerequisiteCourseId?: string;
  minAcademicReputation?: number;
  description: string;
}

export interface GoalDefinition {
  id: string;
  label: string;
  description: string;
  reward: number;
  type:
    | "videos"
    | "subscribers"
    | "equipment"
    | "room"
    | "courses"
    | "skills"
    | "reputation";
  target: number;
  key?: EquipmentSlot | RoomUpgradeSlot | SkillId | ReputationId;
}

export const EQUIPMENT_LABELS: Record<EquipmentSlot, string> = {
  cpu: "Processador",
  gpu: "Placa de vídeo",
  ram: "Memória RAM",
  storage: "Armazenamento",
  monitor: "Monitor",
  microphone: "Microfone",
  camera: "Câmera",
  internet: "Plano de internet"
};

export const ROOM_LABELS: Record<RoomUpgradeSlot, string> = {
  bed: "Cama",
  chair: "Cadeira",
  desk: "Mesa",
  lighting: "Iluminação",
  acoustic: "Tratamento acústico",
  decor: "Decoração"
};

export const SKILL_LABELS: Record<SkillId, string> = {
  editing: "Edição",
  communication: "Comunicação",
  design: "Design",
  scripting: "Roteiro",
  technology: "Tecnologia",
  marketing: "Marketing"
};

export const REPUTATION_LABELS: Record<ReputationId, string> = {
  audience: "Público",
  professional: "Profissional",
  academic: "Acadêmica"
};

export const EQUIPMENT_TIERS: Record<EquipmentSlot, UpgradeTier[]> = {
  cpu: [
    { level: 0, name: "Dual-core antigo", price: 0, description: "Renderização lenta e pouca margem para projetos longos." },
    { level: 1, name: "4 núcleos usado", price: 340, description: "Reduz o tempo de renderização e melhora freelances simples." },
    { level: 2, name: "6 núcleos intermediário", price: 820, description: "Boa produtividade para vídeos comuns e reviews." },
    { level: 3, name: "8 núcleos profissional", price: 1680, description: "Projetos longos, edição pesada e freelances premium." }
  ],
  gpu: [
    { level: 0, name: "Vídeo integrado", price: 0, description: "Limita efeitos, resolução e consistência visual." },
    { level: 1, name: "GPU usada básica", price: 520, description: "Libera correção de cor e efeitos simples.", requiredDesk: 1 },
    { level: 2, name: "GPU intermediária", price: 1180, description: "Eleva o teto visual e acelera renderização.", requiredDesk: 1 },
    { level: 3, name: "GPU profissional", price: 2450, description: "Efeitos avançados, alta resolução e render rápido.", requiredDesk: 2 }
  ],
  ram: [
    { level: 0, name: "4 GB", price: 0, description: "Multitarefa limitada e risco de lentidão." },
    { level: 1, name: "8 GB", price: 180, description: "Projetos comuns sem travamentos frequentes." },
    { level: 2, name: "16 GB", price: 390, description: "Boa multitarefa e vídeos mais longos." },
    { level: 3, name: "32 GB", price: 780, description: "Projetos especiais e várias ferramentas abertas." }
  ],
  storage: [
    { level: 0, name: "HD 250 GB", price: 0, description: "Pouco espaço e carregamentos demorados." },
    { level: 1, name: "SSD 480 GB", price: 260, description: "Projetos abrem e salvam mais rápido." },
    { level: 2, name: "SSD 1 TB", price: 540, description: "Biblioteca maior e fluxo de edição mais rápido." },
    { level: 3, name: "NVMe 2 TB", price: 1050, description: "Arquivos pesados e catálogo de mídia profissional." }
  ],
  monitor: [
    { level: 0, name: "Monitor antigo", price: 0, description: "Baixa precisão de cor e pouco espaço de trabalho." },
    { level: 1, name: "Full HD", price: 460, description: "Melhora decisões de edição e thumbnail." },
    { level: 2, name: "Monitor de cores", price: 980, description: "Maior consistência visual e design." },
    { level: 3, name: "Segundo monitor", price: 1480, description: "Planejamento e multitarefa muito mais rápidos.", requiredDesk: 2 }
  ],
  microphone: [
    { level: 0, name: "Microfone interno", price: 0, description: "Áudio limitado e ruído frequente." },
    { level: 1, name: "USB básico", price: 240, description: "Áudio limpo para vídeos comuns." },
    { level: 2, name: "Condensador intermediário", price: 690, description: "Boa presença de voz e credibilidade." },
    { level: 3, name: "Kit profissional", price: 1450, description: "Áudio consistente para produções premium.", requiredDesk: 2 }
  ],
  camera: [
    { level: 0, name: "Webcam simples", price: 0, description: "Imagem limitada para vlogs e reviews." },
    { level: 1, name: "Webcam Full HD", price: 330, description: "Melhora vídeos com rosto e chamadas freelance." },
    { level: 2, name: "Câmera de criador", price: 1250, description: "Boa imagem, foco e credibilidade." },
    { level: 3, name: "Câmera profissional", price: 2850, description: "Alta qualidade para vlogs, reviews e publicidade." }
  ],
  internet: [
    { level: 0, name: "Plano básico", price: 0, description: "Upload lento. Mensalidade base da agenda." },
    { level: 1, name: "Plano intermediário", price: 180, description: "Upload 25% mais rápido. +R$ 45 por mês." },
    { level: 2, name: "Fibra rápida", price: 420, description: "Upload 50% mais rápido. +R$ 105 por mês." },
    { level: 3, name: "Plano profissional", price: 850, description: "Upload 70% mais rápido. +R$ 220 por mês." }
  ]
};

export const ROOM_TIERS: Record<RoomUpgradeSlot, UpgradeTier[]> = {
  bed: [
    { level: 0, name: "Cama simples", price: 0, description: "Recuperação básica de energia." },
    { level: 1, name: "Colchão confortável", price: 390, description: "Melhora a recuperação ao dormir." },
    { level: 2, name: "Cama premium", price: 980, description: "Recuperação alta e mais criatividade ao acordar." },
    { level: 3, name: "Cama ergonômica", price: 1850, description: "Sono eficiente para rotinas intensas." }
  ],
  chair: [
    { level: 0, name: "Cadeira comum", price: 0, description: "Sessões longas consomem muita energia." },
    { level: 1, name: "Cadeira de escritório", price: 320, description: "Reduz desgaste em estudo e trabalho." },
    { level: 2, name: "Cadeira ergonômica", price: 850, description: "Produção longa com menor gasto de energia." },
    { level: 3, name: "Cadeira profissional", price: 1650, description: "Máxima eficiência em computador." }
  ],
  desk: [
    { level: 0, name: "Mesa pequena", price: 0, description: "Espaço apenas para o equipamento básico." },
    { level: 1, name: "Mesa ampla", price: 430, description: "Suporta GPU, microfone e organização melhor." },
    { level: 2, name: "Mesa de estúdio", price: 1050, description: "Libera segundo monitor e kit profissional." },
    { level: 3, name: "Estação modular", price: 2100, description: "Espaço completo para produção avançada." }
  ],
  lighting: [
    { level: 0, name: "Lâmpada do quarto", price: 0, description: "Iluminação irregular para câmera." },
    { level: 1, name: "Ring light", price: 190, description: "Melhora rosto, vlogs e thumbnails." },
    { level: 2, name: "Par de softboxes", price: 620, description: "Imagem consistente em qualquer horário." },
    { level: 3, name: "Kit de estúdio", price: 1320, description: "Controle profissional de luz e cenário." }
  ],
  acoustic: [
    { level: 0, name: "Parede vazia", price: 0, description: "Eco e ruído do ambiente." },
    { level: 1, name: "Tapete e cortina", price: 250, description: "Reduz parte do eco." },
    { level: 2, name: "Painéis acústicos", price: 720, description: "Áudio mais limpo e gravações consistentes." },
    { level: 3, name: "Tratamento completo", price: 1600, description: "Ambiente preparado para voz profissional." }
  ],
  decor: [
    { level: 0, name: "Quarto básico", price: 0, description: "Pouco conforto e cenário simples." },
    { level: 1, name: "Plantas e quadros", price: 240, description: "Aumenta conforto e melhora o fundo dos vídeos." },
    { level: 2, name: "Prateleira temática", price: 680, description: "Cenário reconhecível e mais criatividade." },
    { level: 3, name: "Estúdio personalizado", price: 1450, description: "Identidade visual forte para o canal." }
  ]
};

export const COURSES: CourseDefinition[] = [
  { id: "editing-basic", name: "Edição básica", price: 120, hours: 8, skill: "editing", skillLevels: 1, description: "Cortes, ritmo, áudio e organização da timeline." },
  { id: "design-thumb", name: "Thumbnail eficiente", price: 180, hours: 10, skill: "design", skillLevels: 1, description: "Composição, contraste, tipografia e leitura rápida." },
  { id: "communication-video", name: "Comunicação em vídeo", price: 250, hours: 14, skill: "communication", skillLevels: 1, description: "Presença, clareza, ritmo de fala e conexão com o público." },
  { id: "scripting-basic", name: "Roteiro para retenção", price: 310, hours: 16, skill: "scripting", skillLevels: 1, description: "Ganchos, estrutura, promessa e progressão narrativa." },
  { id: "technology-creator", name: "Tecnologia para criadores", price: 360, hours: 18, skill: "technology", skillLevels: 1, description: "Hardware, manutenção e fluxo técnico de produção." },
  { id: "marketing-basic", name: "Marketing digital", price: 520, hours: 24, skill: "marketing", skillLevels: 1, description: "Posicionamento, público, distribuição e análise de catálogo.", minAcademicReputation: 15 },
  { id: "editing-advanced", name: "Edição avançada", price: 680, hours: 28, skill: "editing", skillLevels: 1, prerequisiteCourseId: "editing-basic", description: "Narrativa visual, efeitos e acabamento profissional." },
  { id: "brand-advanced", name: "Marca e patrocínios", price: 850, hours: 32, skill: "marketing", skillLevels: 1, prerequisiteCourseId: "marketing-basic", description: "Negociação, proposta comercial e proteção de credibilidade." }
];

export const GOALS: GoalDefinition[] = [
  { id: "videos-10", label: "Primeiro catálogo", description: "Publique 10 vídeos.", reward: 120, type: "videos", target: 10 },
  { id: "videos-30", label: "Canal consistente", description: "Publique 30 vídeos.", reward: 350, type: "videos", target: 30 },
  { id: "subs-100", label: "Primeiros seguidores", description: "Alcance 100 inscritos.", reward: 160, type: "subscribers", target: 100 },
  { id: "subs-1000", label: "Monetização", description: "Alcance 1.000 inscritos.", reward: 650, type: "subscribers", target: 1000 },
  { id: "cpu-2", label: "Máquina intermediária", description: "Instale um processador nível 2.", reward: 180, type: "equipment", key: "cpu", target: 2 },
  { id: "studio-2", label: "Pequeno estúdio", description: "Eleve decoração, iluminação e acústica ao nível 2.", reward: 300, type: "room", key: "decor", target: 2 },
  { id: "courses-3", label: "Aprendizado contínuo", description: "Conclua 3 cursos.", reward: 240, type: "courses", target: 3 },
  { id: "skill-3", label: "Especialista", description: "Alcance nível 3 em qualquer habilidade.", reward: 320, type: "skills", target: 3 },
  { id: "professional-30", label: "Profissional confiável", description: "Alcance reputação profissional 30.", reward: 260, type: "reputation", key: "professional", target: 30 }
];

export const SPONSOR_BRANDS: Array<{
  brand: string;
  theme: ThemeId | null;
  basePayment: number;
}> = [
  { brand: "ByteBox", theme: "technology", basePayment: 180 },
  { brand: "GameCore", theme: "games", basePayment: 160 },
  { brand: "StudyFlow", theme: "tutorial", basePayment: 210 },
  { brand: "DailyUp", theme: "vlog", basePayment: 150 },
  { brand: "NextChallenge", theme: "challenge", basePayment: 170 },
  { brand: "Creator Market", theme: null, basePayment: 190 }
];
