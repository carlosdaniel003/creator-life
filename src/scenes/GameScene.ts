import Phaser from "phaser";

import {
  EDITING_BLOCKS,
  FORMATS,
  THEMES,
  THUMBNAILS,
  TITLE_IDEAS
} from "../game/videoData";
import type {
  EditingBlockId,
  FormatId,
  PlayerState,
  ThemeId,
  ThumbnailId,
  VideoDraft,
  VideoResult
} from "../game/types";

interface EditingCardView {
  id: EditingBlockId;
  slotIndex: number;
  container: Phaser.GameObjects.Container;
}

export class GameScene extends Phaser.Scene {
  private state: PlayerState = {
    day: 1,
    hour: 8,
    energy: 100,
    hunger: 100,
    creativity: 70,
    money: 80,
    subscribers: 0,
    totalViews: 0,
    videos: 0
  };

  private draft: VideoDraft = this.createEmptyDraft();

  private hudText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private monitorText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;

  private modal: Phaser.GameObjects.Container | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;
  private titleFieldBackground: Phaser.GameObjects.Rectangle | null = null;
  private plannerErrorText: Phaser.GameObjects.Text | null = null;
  private isTitleEditing = false;

  private themeCards = new Map<ThemeId, Phaser.GameObjects.Rectangle>();
  private formatCards = new Map<FormatId, Phaser.GameObjects.Rectangle>();
  private thumbnailCards = new Map<ThumbnailId, Phaser.GameObjects.Rectangle>();

  private editingCards: EditingCardView[] = [];
  private editingScoreText: Phaser.GameObjects.Text | null = null;
  private editingDescriptionText: Phaser.GameObjects.Text | null = null;
  private readonly editingSlotPositions = [200, 420, 640, 860, 1080];

  public constructor() {
    super({ key: "GameScene" });
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#101827");

    this.drawRoom();
    this.createSidebar();
    this.configureKeyboardInput();
    this.updateHud();
  }

  private createEmptyDraft(): VideoDraft {
    return {
      themeId: null,
      formatId: null,
      title: "",
      thumbnailId: null,
      editingOrder: Phaser.Utils.Array.Shuffle(
        EDITING_BLOCKS.map((block) => block.id)
      )
    };
  }

  private configureKeyboardInput(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!this.isTitleEditing || !this.modal) {
        return;
      }

      event.preventDefault();

      if (event.key === "Escape" || event.key === "Enter") {
        this.isTitleEditing = false;
        this.updateTitleField();
        return;
      }

      if (event.key === "Backspace") {
        this.draft.title = this.draft.title.slice(0, -1);
        this.updateTitleField();
        return;
      }

      if (event.key.length === 1 && this.draft.title.length < 58) {
        this.draft.title += event.key;
        this.updateTitleField();
      }
    });
  }

  private drawRoom(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x223047);
    graphics.fillRect(0, 0, 920, 500);

    graphics.fillStyle(0x2b3d59);
    graphics.fillRect(0, 360, 920, 140);

    graphics.fillStyle(0x3a4150);
    graphics.fillRect(0, 500, 920, 220);

    graphics.lineStyle(2, 0x303744, 0.8);

    for (let x = 0; x <= 920; x += 115) {
      graphics.lineBetween(x, 500, x, 720);
    }

    for (let y = 500; y <= 720; y += 55) {
      graphics.lineBetween(0, y, 920, y);
    }

    this.drawWindow();
    this.drawDesk();
    this.drawBed();
    this.drawCharacter();

    this.add
      .text(32, 28, "QUARTO INICIAL", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#8ba4c7",
        fontStyle: "bold"
      })
      .setLetterSpacing(2);

    this.add.text(
      32,
      58,
      "Um espaço pequeno, um computador simples e um grande objetivo.",
      {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#d6e2f2"
      }
    );
  }

  private drawWindow(): void {
    this.add.rectangle(200, 210, 260, 180, 0x77c7e8);

    this.add
      .rectangle(200, 210, 260, 180, 0x000000, 0)
      .setStrokeStyle(12, 0x182235);

    this.add.rectangle(200, 210, 8, 180, 0x182235);
    this.add.rectangle(200, 210, 260, 8, 0x182235);
    this.add.circle(245, 165, 26, 0xffe58f);
  }

  private drawDesk(): void {
    this.add.rectangle(590, 455, 330, 30, 0x80543c);
    this.add.rectangle(470, 565, 28, 210, 0x56392d);
    this.add.rectangle(710, 565, 28, 210, 0x56392d);

    this.add
      .rectangle(590, 345, 200, 125, 0x101723)
      .setStrokeStyle(8, 0x090d14);

    this.add.rectangle(590, 345, 174, 97, 0x1e6d8e);

    this.monitorText = this.add
      .text(590, 345, "0 inscritos", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    this.add.rectangle(590, 423, 18, 40, 0x111722);
    this.add.rectangle(590, 445, 80, 12, 0x111722);
    this.add.rectangle(590, 478, 170, 34, 0x191f2b);

    this.add
      .rectangle(755, 540, 75, 170, 0x171d28)
      .setStrokeStyle(4, 0x090c12);

    this.add.circle(755, 485, 6, 0x42e8b4);
  }

  private drawBed(): void {
    this.add.rectangle(220, 575, 310, 135, 0x5e75a8);
    this.add.rectangle(220, 535, 310, 55, 0x7993c9);
    this.add.rectangle(125, 535, 100, 38, 0xd8e1f2);
    this.add.rectangle(220, 650, 330, 26, 0x342a2a);
  }

  private drawCharacter(): void {
    this.add
      .rectangle(425, 520, 64, 105, 0x38bdf8)
      .setStrokeStyle(4, 0x162033);

    this.add
      .circle(425, 430, 42, 0xd8a278)
      .setStrokeStyle(4, 0x162033);

    this.add.arc(425, 420, 41, 180, 360, false, 0x2f231e);
    this.add.circle(411, 432, 4, 0x111111);
    this.add.circle(439, 432, 4, 0x111111);
    this.add.rectangle(408, 603, 24, 72, 0x202a3c);
    this.add.rectangle(442, 603, 24, 72, 0x202a3c);

    this.add
      .text(425, 680, "Carlos", {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffffff",
        backgroundColor: "#111827",
        padding: { x: 12, y: 6 }
      })
      .setOrigin(0.5);
  }

  private createSidebar(): void {
    this.add.rectangle(1100, 360, 360, 720, 0x111827);

    this.add
      .rectangle(1100, 360, 358, 718, 0x000000, 0)
      .setStrokeStyle(2, 0x334155);

    this.add.text(960, 28, "CREATOR LIFE", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#42e8b4",
      fontStyle: "bold"
    });

    this.add.text(960, 63, "Do quarto para o mundo", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#94a3b8"
    });

    this.hudText = this.add.text(960, 115, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "17px",
      color: "#e2e8f0",
      lineSpacing: 9
    });

    this.add
      .rectangle(1100, 325, 300, 100, 0x1c2638)
      .setStrokeStyle(2, 0x334155);

    this.statusText = this.add.text(
      970,
      290,
      "Seu canal ainda não possui vídeos.",
      {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#cbd5e1",
        wordWrap: { width: 260 },
        lineSpacing: 4
      }
    );

    this.createButton(1100, 430, 300, 52, "Produzir vídeo", () => {
      this.openVideoPlanner();
    });

    this.createButton(1100, 495, 300, 52, "Fazer trabalho freelance", () => {
      this.doFreelanceWork();
    });

    this.createButton(1100, 560, 300, 52, "Comer", () => {
      this.eat();
    });

    this.createButton(1100, 625, 300, 52, "Dormir", () => {
      this.sleep();
    });

    this.goalText = this.add
      .text(1100, 685, "META: alcançar 100 inscritos", {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#facc15",
        fontStyle: "bold"
      })
      .setOrigin(0.5);
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    action: () => void,
    parent?: Phaser.GameObjects.Container,
    fillColor = 0x167a59
  ): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);

    const background = this.add
      .rectangle(0, 0, width, height, fillColor)
      .setStrokeStyle(2, 0x42e8b4)
      .setInteractive({ useHandCursor: true });

    const text = this.add
      .text(0, 0, label, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    button.add([background, text]);

    background.on("pointerover", () => {
      background.setFillStyle(fillColor + 0x111111);
    });

    background.on("pointerout", () => {
      background.setFillStyle(fillColor);
    });

    background.on("pointerdown", action);

    parent?.add(button);

    return button;
  }

  private openVideoPlanner(): void {
    if (this.modal) {
      return;
    }

    if (this.state.energy < 18) {
      this.setStatus("Você está sem energia suficiente para começar uma produção.");
      return;
    }

    if (this.state.hunger < 20) {
      this.setStatus("Você precisa comer antes de começar uma produção.");
      return;
    }

    if (this.state.creativity < 11) {
      this.setStatus("Sua criatividade está baixa. Descanse antes de produzir.");
      return;
    }

    this.draft = this.createEmptyDraft();
    this.renderPlanner();
  }

  private renderPlanner(): void {
    this.closeModal();

    this.themeCards.clear();
    this.formatCards.clear();
    this.thumbnailCards.clear();

    this.modal = this.createModalShell(
      "PLANEJAMENTO DO VÍDEO",
      "Escolha como o próximo vídeo será produzido."
    );

    this.addModalText(90, 105, "1. TEMA", 17, "#42e8b4", true);

    THEMES.forEach((theme, index) => {
      const x = 150 + index * 235;
      const background = this.createChoiceCard(
        x,
        170,
        205,
        100,
        theme.label,
        theme.description,
        theme.color,
        () => {
          this.draft.themeId = theme.id;
          this.updatePlannerSelections();
        }
      );

      this.themeCards.set(theme.id, background);
    });

    this.addModalText(90, 235, "2. FORMATO", 17, "#42e8b4", true);

    FORMATS.forEach((format, index) => {
      const x = 185 + index * 300;
      const background = this.createChoiceCard(
        x,
        300,
        265,
        100,
        format.label,
        `${format.description}\nCusto: ${format.energyCost} energia | ${format.hours}h`,
        0x334155,
        () => {
          this.draft.formatId = format.id;
          this.updatePlannerSelections();
        }
      );

      this.formatCards.set(format.id, background);
    });

    this.addModalText(90, 365, "3. TÍTULO", 17, "#42e8b4", true);

    this.titleFieldBackground = this.add
      .rectangle(450, 420, 720, 54, 0x0f172a)
      .setStrokeStyle(2, 0x475569)
      .setInteractive({ useHandCursor: true });

    this.titleText = this.add
      .text(110, 420, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#f8fafc",
        fixedWidth: 680
      })
      .setOrigin(0, 0.5);

    this.modal.add([this.titleFieldBackground, this.titleText]);

    this.titleFieldBackground.on("pointerdown", () => {
      this.isTitleEditing = true;
      this.updateTitleField();
    });

    this.createButton(
      1035,
      420,
      250,
      54,
      "Gerar ideia de título",
      () => {
        this.generateTitleIdea();
      },
      this.modal,
      0x334155
    );

    this.addModalText(90, 470, "4. THUMBNAIL", 17, "#42e8b4", true);

    THUMBNAILS.forEach((thumbnail, index) => {
      const x = 185 + index * 300;
      const background = this.createChoiceCard(
        x,
        540,
        265,
        105,
        thumbnail.label,
        thumbnail.description,
        thumbnail.color,
        () => {
          this.draft.thumbnailId = thumbnail.id;
          this.updatePlannerSelections();
        },
        true
      );

      this.thumbnailCards.set(thumbnail.id, background);
    });

    this.plannerErrorText = this.add
      .text(640, 606, "", {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#fca5a5",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    this.modal.add(this.plannerErrorText);

    this.createButton(
      225,
      650,
      250,
      48,
      "Cancelar",
      () => {
        this.closeModal();
      },
      this.modal,
      0x4b2530
    );

    this.createButton(
      1055,
      650,
      250,
      48,
      "Ir para edição",
      () => {
        this.openEditor();
      },
      this.modal
    );

    this.updateTitleField();
    this.updatePlannerSelections();
  }

  private createModalShell(
    title: string,
    subtitle: string
  ): Phaser.GameObjects.Container {
    const modal = this.add.container(0, 0).setDepth(1000);

    const overlay = this.add
      .rectangle(640, 360, 1280, 720, 0x020617, 0.9)
      .setInteractive();

    const panel = this.add
      .rectangle(640, 360, 1200, 680, 0x111827)
      .setStrokeStyle(2, 0x334155);

    const headerLine = this.add.rectangle(640, 82, 1120, 2, 0x334155);

    const titleText = this.add.text(80, 35, title, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#42e8b4",
      fontStyle: "bold"
    });

    const subtitleText = this.add.text(80, 66, subtitle, {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#94a3b8"
    });

    modal.add([overlay, panel, headerLine, titleText, subtitleText]);
    return modal;
  }

  private addModalText(
    x: number,
    y: number,
    text: string,
    size: number,
    color: string,
    bold = false
  ): Phaser.GameObjects.Text {
    const label = this.add.text(x, y, text, {
      fontFamily: "Arial",
      fontSize: `${size}px`,
      color,
      fontStyle: bold ? "bold" : "normal"
    });

    this.modal?.add(label);
    return label;
  }

  private createChoiceCard(
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    description: string,
    accentColor: number,
    action: () => void,
    thumbnailPreview = false
  ): Phaser.GameObjects.Rectangle {
    const card = this.add.container(x, y);

    const background = this.add
      .rectangle(0, 0, width, height, 0x1e293b)
      .setStrokeStyle(2, 0x475569)
      .setInteractive({ useHandCursor: true });

    const accent = this.add.rectangle(
      thumbnailPreview ? -width / 2 + 34 : -width / 2 + 5,
      thumbnailPreview ? 0 : -height / 2 + 5,
      thumbnailPreview ? 58 : width - 10,
      thumbnailPreview ? height - 18 : 8,
      accentColor
    );

    const titleX = thumbnailPreview ? -width / 2 + 76 : -width / 2 + 14;

    const titleText = this.add.text(titleX, -height / 2 + 18, title, {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#f8fafc",
      fontStyle: "bold",
      wordWrap: { width: thumbnailPreview ? width - 90 : width - 28 }
    });

    const descriptionText = this.add.text(
      titleX,
      -height / 2 + 45,
      description,
      {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#aebed2",
        lineSpacing: 2,
        wordWrap: { width: thumbnailPreview ? width - 90 : width - 28 }
      }
    );

    card.add([background, accent, titleText, descriptionText]);
    this.modal?.add(card);

    background.on("pointerover", () => {
      background.setFillStyle(0x29364a);
    });

    background.on("pointerout", () => {
      background.setFillStyle(0x1e293b);
    });

    background.on("pointerdown", action);

    return background;
  }

  private updatePlannerSelections(): void {
    this.themeCards.forEach((card, id) => {
      card.setStrokeStyle(
        3,
        id === this.draft.themeId ? 0x42e8b4 : 0x475569
      );
    });

    this.formatCards.forEach((card, id) => {
      card.setStrokeStyle(
        3,
        id === this.draft.formatId ? 0x42e8b4 : 0x475569
      );
    });

    this.thumbnailCards.forEach((card, id) => {
      card.setStrokeStyle(
        3,
        id === this.draft.thumbnailId ? 0x42e8b4 : 0x475569
      );
    });

    this.plannerErrorText?.setText("");
  }

  private updateTitleField(): void {
    if (!this.titleText || !this.titleFieldBackground) {
      return;
    }

    const displayTitle =
      this.draft.title.length > 0
        ? `${this.draft.title}${this.isTitleEditing ? "|" : ""}`
        : this.isTitleEditing
          ? "|"
          : "Clique aqui e digite o título do vídeo";

    this.titleText.setText(displayTitle);
    this.titleText.setColor(
      this.draft.title.length > 0 || this.isTitleEditing
        ? "#f8fafc"
        : "#64748b"
    );
    this.titleFieldBackground.setStrokeStyle(
      2,
      this.isTitleEditing ? 0x42e8b4 : 0x475569
    );
  }

  private generateTitleIdea(): void {
    if (!this.draft.themeId) {
      this.plannerErrorText?.setText(
        "Escolha um tema antes de gerar uma ideia de título."
      );
      return;
    }

    const ideas = TITLE_IDEAS[this.draft.themeId];
    this.draft.title = Phaser.Utils.Array.GetRandom(ideas);
    this.isTitleEditing = false;
    this.updateTitleField();
    this.plannerErrorText?.setText("");
  }

  private openEditor(): void {
    const validationMessage = this.validateDraft();

    if (validationMessage) {
      this.plannerErrorText?.setText(validationMessage);
      return;
    }

    const format = FORMATS.find((item) => item.id === this.draft.formatId);

    if (!format) {
      return;
    }

    if (this.state.energy < format.energyCost) {
      this.plannerErrorText?.setText(
        `Este formato exige ${format.energyCost} de energia.`
      );
      return;
    }

    if (this.state.creativity < format.creativityCost) {
      this.plannerErrorText?.setText(
        `Este formato exige ${format.creativityCost} de criatividade.`
      );
      return;
    }

    this.isTitleEditing = false;
    this.closeModal();
    this.renderEditor();
  }

  private validateDraft(): string | null {
    if (!this.draft.themeId) {
      return "Escolha um tema para o vídeo.";
    }

    if (!this.draft.formatId) {
      return "Escolha um formato para o vídeo.";
    }

    if (this.draft.title.trim().length < 8) {
      return "Digite um título com pelo menos 8 caracteres.";
    }

    if (!this.draft.thumbnailId) {
      return "Escolha um estilo de thumbnail.";
    }

    return null;
  }

  private renderEditor(): void {
    this.modal = this.createModalShell(
      "EDIÇÃO DO VÍDEO",
      "Arraste os blocos e monte uma sequência que mantenha o público assistindo."
    );

    const theme = THEMES.find((item) => item.id === this.draft.themeId);
    const format = FORMATS.find((item) => item.id === this.draft.formatId);
    const thumbnail = THUMBNAILS.find(
      (item) => item.id === this.draft.thumbnailId
    );

    this.addModalText(
      90,
      105,
      `${theme?.label ?? ""}  •  ${format?.label ?? ""}  •  ${thumbnail?.label ?? ""}`,
      16,
      "#cbd5e1",
      true
    );

    const titleText = this.add.text(90, 140, this.draft.title, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold",
      wordWrap: { width: 1080 }
    });

    this.modal.add(titleText);

    this.addModalText(90, 215, "LINHA DO TEMPO", 17, "#42e8b4", true);

    this.editingSlotPositions.forEach((x, index) => {
      const slot = this.add
        .rectangle(x, 380, 194, 134, 0x0f172a, 0.45)
        .setStrokeStyle(2, 0x475569, 0.8);

      const number = this.add
        .text(x, 295, `PARTE ${index + 1}`, {
          fontFamily: "Arial",
          fontSize: "13px",
          color: "#64748b",
          fontStyle: "bold"
        })
        .setOrigin(0.5);

      this.modal?.add([slot, number]);
    });

    this.editingCards = [];

    this.draft.editingOrder.forEach((blockId, index) => {
      this.createEditingCard(blockId, index);
    });

    this.editingDescriptionText = this.add
      .text(640, 500, "Passe o mouse sobre um bloco para ver sua função.", {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#aebed2",
        align: "center",
        wordWrap: { width: 900 }
      })
      .setOrigin(0.5);

    this.editingScoreText = this.add
      .text(640, 555, "", {
        fontFamily: "Arial",
        fontSize: "19px",
        color: "#facc15",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    this.modal.add([this.editingDescriptionText, this.editingScoreText]);

    this.addModalText(
      165,
      595,
      "A ordem ideal muda conforme o formato. Observe o papel de cada trecho.",
      14,
      "#94a3b8"
    );

    this.createButton(
      225,
      650,
      250,
      48,
      "Voltar",
      () => {
        this.renderPlanner();
      },
      this.modal,
      0x334155
    );

    this.createButton(
      1055,
      650,
      250,
      48,
      "Publicar vídeo",
      () => {
        this.publishVideo();
      },
      this.modal
    );

    this.updateEditingPreview();
  }

  private createEditingCard(
    blockId: EditingBlockId,
    slotIndex: number
  ): void {
    const block = EDITING_BLOCKS.find((item) => item.id === blockId);

    if (!block || !this.modal) {
      return;
    }

    const card = this.add.container(this.editingSlotPositions[slotIndex], 380);

    const shadow = this.add.rectangle(5, 6, 180, 120, 0x020617, 0.65);

    const background = this.add
      .rectangle(0, 0, 180, 120, 0x1e293b)
      .setStrokeStyle(3, block.color);

    const colorBar = this.add.rectangle(0, -52, 174, 10, block.color);

    const label = this.add
      .text(0, -12, block.shortLabel, {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center"
      })
      .setOrigin(0.5);

    const dragLabel = this.add
      .text(0, 31, "ARRASTE", {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#94a3b8",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    card.add([shadow, background, colorBar, label, dragLabel]);
    card.setSize(180, 120);
    card.setInteractive(
      new Phaser.Geom.Rectangle(-90, -60, 180, 120),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(card);
    this.modal.add(card);

    const view: EditingCardView = {
      id: blockId,
      slotIndex,
      container: card
    };

    this.editingCards.push(view);

    card.on("pointerover", () => {
      background.setFillStyle(0x29364a);
      this.editingDescriptionText?.setText(
        `${block.label}: ${block.description}`
      );
    });

    card.on("pointerout", () => {
      background.setFillStyle(0x1e293b);
    });

    card.on("dragstart", () => {
      card.setDepth(20);
      this.tweens.add({
        targets: card,
        scale: 1.05,
        duration: 100
      });
    });

    card.on(
      "drag",
      (_pointer: Phaser.Input.Pointer, dragX: number) => {
        card.x = Phaser.Math.Clamp(
          dragX,
          this.editingSlotPositions[0],
          this.editingSlotPositions[4]
        );
        card.y = 380;
      }
    );

    card.on("dragend", () => {
      card.setDepth(0);
      card.setScale(1);
      this.moveEditingCardToNearestSlot(view);
    });
  }

  private moveEditingCardToNearestSlot(
    movedCard: EditingCardView
  ): void {
    let targetIndex = 0;
    let shortestDistance = Number.POSITIVE_INFINITY;

    this.editingSlotPositions.forEach((position, index) => {
      const distance = Math.abs(movedCard.container.x - position);

      if (distance < shortestDistance) {
        shortestDistance = distance;
        targetIndex = index;
      }
    });

    const previousIndex = movedCard.slotIndex;
    const occupyingCard = this.editingCards.find(
      (card) => card.slotIndex === targetIndex && card !== movedCard
    );

    movedCard.slotIndex = targetIndex;

    if (occupyingCard) {
      occupyingCard.slotIndex = previousIndex;
    }

    this.editingCards.forEach((card) => {
      this.tweens.add({
        targets: card.container,
        x: this.editingSlotPositions[card.slotIndex],
        y: 380,
        duration: 180,
        ease: "Sine.easeOut"
      });
    });

    this.draft.editingOrder = [...this.editingCards]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((card) => card.id);

    this.updateEditingPreview();
  }

  private updateEditingPreview(): void {
    const score = this.calculateEditingScore();
    const label =
      score >= 85
        ? "Excelente ritmo"
        : score >= 65
          ? "Boa sequência"
          : score >= 45
            ? "Sequência aceitável"
            : "A ordem pode melhorar";

    this.editingScoreText?.setText(
      `Qualidade da edição: ${score}/100 — ${label}`
    );
  }

  private calculateEditingScore(): number {
    const format = FORMATS.find((item) => item.id === this.draft.formatId);

    if (!format) {
      return 0;
    }

    let score = 20;

    this.draft.editingOrder.forEach((blockId, index) => {
      if (blockId === format.idealOrder[index]) {
        score += 12;
      }
    });

    for (
      let index = 0;
      index < this.draft.editingOrder.length - 1;
      index += 1
    ) {
      const current = this.draft.editingOrder[index];
      const next = this.draft.editingOrder[index + 1];
      const idealCurrentIndex = format.idealOrder.indexOf(current);

      if (format.idealOrder[idealCurrentIndex + 1] === next) {
        score += 5;
      }
    }

    return Phaser.Math.Clamp(score, 0, 100);
  }

  private publishVideo(): void {
    const result = this.calculateVideoResult();
    const format = FORMATS.find((item) => item.id === this.draft.formatId);

    if (!format) {
      return;
    }

    this.state.energy = Phaser.Math.Clamp(
      this.state.energy - format.energyCost,
      0,
      100
    );
    this.state.creativity = Phaser.Math.Clamp(
      this.state.creativity - format.creativityCost,
      0,
      100
    );

    this.state.videos += 1;
    this.state.totalViews += result.views;
    this.state.subscribers += result.subscribers;
    this.state.money += result.revenue;

    this.advanceTime(format.hours);
    this.renderVideoResult(result);
  }

  private calculateVideoResult(): VideoResult {
    const theme = THEMES.find((item) => item.id === this.draft.themeId);
    const format = FORMATS.find((item) => item.id === this.draft.formatId);
    const thumbnail = THUMBNAILS.find(
      (item) => item.id === this.draft.thumbnailId
    );

    if (!theme || !format || !thumbnail) {
      throw new Error("O rascunho do vídeo está incompleto.");
    }

    const titleScore = this.calculateTitleScore(this.draft.title);
    const compatibilityBonus = format.idealThemes.includes(theme.id)
      ? 12
      : 2;
    const planningScore = Phaser.Math.Clamp(
      35 +
        theme.trend +
        compatibilityBonus +
        titleScore * 0.25 +
        thumbnail.clickBonus +
        thumbnail.credibilityBonus,
      0,
      100
    );

    const editingScore = this.calculateEditingScore();
    const quality = Math.round(
      Phaser.Math.Clamp(
        planningScore * 0.42 +
          editingScore * 0.43 +
          this.state.creativity * 0.15 +
          format.qualityBonus,
        0,
        100
      )
    );

    const recommendationMultiplier = Phaser.Math.FloatBetween(0.72, 1.58);
    const audienceBase =
      35 + this.state.videos * 14 + this.state.subscribers * 0.2;
    const views = Math.max(
      8,
      Math.floor(
        (audienceBase + quality * 3.1 + planningScore * 1.25) *
          recommendationMultiplier *
          format.reachMultiplier
      )
    );

    const subscriberRate = Phaser.Math.Clamp(
      0.022 + quality / 1800,
      0.025,
      0.085
    );
    const subscribers = Math.max(1, Math.floor(views * subscriberRate));
    const revenue = this.state.subscribers >= 1000 ? views * 0.006 : 0;

    const performanceLabel =
      recommendationMultiplier >= 1.38
        ? "O algoritmo recomendou o vídeo para um público maior."
        : recommendationMultiplier <= 0.85
          ? "O vídeo teve distribuição inicial limitada."
          : "O vídeo alcançou o público esperado para o canal.";

    return {
      quality,
      planningScore: Math.round(planningScore),
      editingScore,
      titleScore,
      views,
      subscribers,
      revenue,
      performanceLabel
    };
  }

  private calculateTitleScore(title: string): number {
    const normalizedTitle = title.trim();
    let score = 35;

    if (normalizedTitle.length >= 22 && normalizedTitle.length <= 52) {
      score += 25;
    } else if (normalizedTitle.length >= 12) {
      score += 12;
    }

    if (normalizedTitle.includes("?")) {
      score += 8;
    }

    if (/\d/.test(normalizedTitle)) {
      score += 7;
    }

    const strongWords = [
      "como",
      "testei",
      "melhor",
      "pior",
      "guia",
      "segredo",
      "mudou",
      "zero"
    ];
    const lowerTitle = normalizedTitle.toLocaleLowerCase("pt-BR");

    score +=
      strongWords.filter((word) => lowerTitle.includes(word)).length * 5;

    if (
      normalizedTitle === normalizedTitle.toUpperCase() &&
      normalizedTitle.length > 12
    ) {
      score -= 12;
    }

    return Phaser.Math.Clamp(score, 0, 100);
  }

  private renderVideoResult(result: VideoResult): void {
    this.closeModal();
    this.modal = this.createModalShell(
      "VÍDEO PUBLICADO",
      result.performanceLabel
    );

    const qualityColor =
      result.quality >= 80
        ? "#42e8b4"
        : result.quality >= 60
          ? "#facc15"
          : "#fb7185";

    const qualityCircle = this.add
      .circle(280, 310, 125, 0x0f172a)
      .setStrokeStyle(
        10,
        Phaser.Display.Color.HexStringToColor(qualityColor).color
      );

    const qualityNumber = this.add
      .text(280, 280, `${result.quality}`, {
        fontFamily: "Arial",
        fontSize: "64px",
        color: qualityColor,
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    const qualityLabel = this.add
      .text(280, 350, "QUALIDADE FINAL", {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#94a3b8",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    this.modal.add([qualityCircle, qualityNumber, qualityLabel]);

    this.createResultCard(
      540,
      205,
      "Planejamento",
      `${result.planningScore}/100`
    );
    this.createResultCard(850, 205, "Edição", `${result.editingScore}/100`);
    this.createResultCard(
      540,
      330,
      "Visualizações",
      `+${result.views.toLocaleString("pt-BR")}`
    );
    this.createResultCard(
      850,
      330,
      "Inscritos",
      `+${result.subscribers.toLocaleString("pt-BR")}`
    );
    this.createResultCard(
      695,
      455,
      "Receita",
      result.revenue > 0
        ? `R$ ${result.revenue.toFixed(2)}`
        : "Canal não monetizado",
      620
    );

    this.addModalText(
      180,
      545,
      "Título publicado:",
      14,
      "#64748b",
      true
    );

    const publishedTitle = this.add.text(180, 570, this.draft.title, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f8fafc",
      fontStyle: "bold",
      wordWrap: { width: 900 }
    });

    this.modal.add(publishedTitle);

    this.createButton(
      640,
      650,
      320,
      48,
      "Voltar para o quarto",
      () => {
        this.setStatus(
          `Vídeo publicado com qualidade ${result.quality}/100.\n` +
            `+${result.views.toLocaleString("pt-BR")} visualizações\n` +
            `+${result.subscribers.toLocaleString("pt-BR")} inscritos`
        );
        this.closeModal();
      },
      this.modal
    );
  }

  private createResultCard(
    x: number,
    y: number,
    label: string,
    value: string,
    width = 280
  ): void {
    const background = this.add
      .rectangle(x, y, width, 95, 0x1e293b)
      .setStrokeStyle(2, 0x334155);

    const labelText = this.add
      .text(x, y - 20, label.toUpperCase(), {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#94a3b8",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    const valueText = this.add
      .text(x, y + 15, value, {
        fontFamily: "Arial",
        fontSize: "23px",
        color: "#ffffff",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    this.modal?.add([background, labelText, valueText]);
  }

  private closeModal(): void {
    this.isTitleEditing = false;
    this.modal?.destroy(true);
    this.modal = null;
    this.titleText = null;
    this.titleFieldBackground = null;
    this.plannerErrorText = null;
    this.editingScoreText = null;
    this.editingDescriptionText = null;
    this.editingCards = [];
  }

  private doFreelanceWork(): void {
    if (this.modal) {
      return;
    }

    if (this.state.energy < 20) {
      this.setStatus("Você está cansado demais para trabalhar.");
      return;
    }

    if (this.state.hunger < 15) {
      this.setStatus("Você precisa comer antes de começar outro trabalho.");
      return;
    }

    const payment = Phaser.Math.Between(30, 50);

    this.state.money += payment;
    this.state.energy -= 20;
    this.state.creativity = Phaser.Math.Clamp(
      this.state.creativity - 8,
      0,
      100
    );

    this.advanceTime(4);
    this.setStatus(
      `Você concluiu um trabalho freelance e recebeu R$ ${payment.toFixed(2)}.`
    );
  }

  private eat(): void {
    if (this.modal) {
      return;
    }

    const foodCost = 10;

    if (this.state.money < foodCost) {
      this.setStatus(
        "Você não possui dinheiro suficiente para comprar comida."
      );
      return;
    }

    this.state.money -= foodCost;
    this.state.hunger = Phaser.Math.Clamp(
      this.state.hunger + 45,
      0,
      100
    );

    this.advanceTime(1);
    this.setStatus("Você fez uma refeição e recuperou sua fome.");
  }

  private sleep(): void {
    if (this.modal) {
      return;
    }

    this.advanceTime(7);

    this.state.energy = Phaser.Math.Clamp(
      this.state.energy + 60,
      0,
      100
    );
    this.state.creativity = Phaser.Math.Clamp(
      this.state.creativity + 20,
      0,
      100
    );

    this.setStatus("Você dormiu e recuperou energia e criatividade.");
  }

  private advanceTime(hours: number): void {
    this.state.hour += hours;
    this.state.hunger = Phaser.Math.Clamp(
      this.state.hunger - hours * 4,
      0,
      100
    );

    while (this.state.hour >= 24) {
      this.state.hour -= 24;
      this.state.day += 1;
      this.state.creativity = Phaser.Math.Clamp(
        this.state.creativity + 8,
        0,
        100
      );
    }

    if (this.state.hunger === 0) {
      this.state.energy = Phaser.Math.Clamp(
        this.state.energy - 15,
        0,
        100
      );
    }

    this.updateHud();
  }

  private setStatus(message: string): void {
    this.statusText.setText(message);
    this.updateHud();
  }

  private updateHud(): void {
    const formattedHour = String(this.state.hour).padStart(2, "0");

    this.hudText.setText([
      `Dia:           ${this.state.day}`,
      `Horário:       ${formattedHour}:00`,
      "",
      `Energia:       ${this.state.energy}/100`,
      `Fome:          ${this.state.hunger}/100`,
      `Criatividade:  ${this.state.creativity}/100`,
      "",
      `Dinheiro:      R$ ${this.state.money.toFixed(2)}`,
      `Vídeos:        ${this.state.videos}`,
      `Visualizações: ${this.state.totalViews.toLocaleString("pt-BR")}`,
      `Inscritos:     ${this.state.subscribers.toLocaleString("pt-BR")}`
    ]);

    this.monitorText.setText(
      `${this.state.subscribers.toLocaleString("pt-BR")} inscritos`
    );

    if (this.state.subscribers >= 1000) {
      this.goalText.setText("CANAL MONETIZADO");
      this.goalText.setColor("#42e8b4");
    } else if (this.state.subscribers >= 100) {
      this.goalText.setText("NOVA META: alcançar 1.000 inscritos");
    }
  }
}
