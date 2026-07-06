import Phaser from "phaser";

interface PlayerState {
  day: number;
  hour: number;

  energy: number;
  hunger: number;
  creativity: number;

  money: number;

  subscribers: number;
  totalViews: number;
  videos: number;
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

  private hudText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  public constructor() {
    super({
      key: "GameScene"
    });
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#101827");

    this.drawRoom();
    this.createSidebar();
    this.updateHud();
  }

  private drawRoom(): void {
    const graphics = this.add.graphics();

    // Parede
    graphics.fillStyle(0x223047);
    graphics.fillRect(0, 0, 920, 500);

    // Faixa decorativa
    graphics.fillStyle(0x2b3d59);
    graphics.fillRect(0, 360, 920, 140);

    // Piso
    graphics.fillStyle(0x3a4150);
    graphics.fillRect(0, 500, 920, 220);

    // Linhas do piso
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
    this.add.rectangle(
      200,
      210,
      260,
      180,
      0x77c7e8
    );

    this.add.rectangle(
      200,
      210,
      260,
      180,
      0x000000,
      0
    ).setStrokeStyle(12, 0x182235);

    this.add.rectangle(
      200,
      210,
      8,
      180,
      0x182235
    );

    this.add.rectangle(
      200,
      210,
      260,
      8,
      0x182235
    );

    this.add.circle(
      245,
      165,
      26,
      0xffe58f
    );
  }

  private drawDesk(): void {
    // Tampo
    this.add.rectangle(
      590,
      455,
      330,
      30,
      0x80543c
    );

    // Pés
    this.add.rectangle(
      470,
      565,
      28,
      210,
      0x56392d
    );

    this.add.rectangle(
      710,
      565,
      28,
      210,
      0x56392d
    );

    // Monitor
    this.add.rectangle(
      590,
      345,
      200,
      125,
      0x101723
    ).setStrokeStyle(8, 0x090d14);

    this.add.rectangle(
      590,
      345,
      174,
      97,
      0x1e6d8e
    );

    this.add.text(
      590,
      345,
      "0 inscritos",
      {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold"
      }
    ).setOrigin(0.5);

    // Suporte do monitor
    this.add.rectangle(
      590,
      423,
      18,
      40,
      0x111722
    );

    this.add.rectangle(
      590,
      445,
      80,
      12,
      0x111722
    );

    // Teclado
    this.add.rectangle(
      590,
      478,
      170,
      34,
      0x191f2b
    );

    // Gabinete
    this.add.rectangle(
      755,
      540,
      75,
      170,
      0x171d28
    ).setStrokeStyle(4, 0x090c12);

    this.add.circle(
      755,
      485,
      6,
      0x42e8b4
    );
  }

  private drawBed(): void {
    this.add.rectangle(
      220,
      575,
      310,
      135,
      0x5e75a8
    );

    this.add.rectangle(
      220,
      535,
      310,
      55,
      0x7993c9
    );

    this.add.rectangle(
      125,
      535,
      100,
      38,
      0xd8e1f2
    );

    this.add.rectangle(
      220,
      650,
      330,
      26,
      0x342a2a
    );
  }

  private drawCharacter(): void {
    // Corpo
    this.add.rectangle(
      425,
      520,
      64,
      105,
      0x38bdf8
    ).setStrokeStyle(4, 0x162033);

    // Cabeça
    this.add.circle(
      425,
      430,
      42,
      0xd8a278
    ).setStrokeStyle(4, 0x162033);

    // Cabelo
    this.add.arc(
      425,
      420,
      41,
      180,
      360,
      false,
      0x2f231e
    );

    // Olhos
    this.add.circle(
      411,
      432,
      4,
      0x111111
    );

    this.add.circle(
      439,
      432,
      4,
      0x111111
    );

    // Pernas
    this.add.rectangle(
      408,
      603,
      24,
      72,
      0x202a3c
    );

    this.add.rectangle(
      442,
      603,
      24,
      72,
      0x202a3c
    );

    this.add.text(
      425,
      680,
      "Carlos",
      {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffffff",
        backgroundColor: "#111827",
        padding: {
          x: 12,
          y: 6
        }
      }
    ).setOrigin(0.5);
  }

  private createSidebar(): void {
    this.add.rectangle(
      1100,
      360,
      360,
      720,
      0x111827
    );

    this.add.rectangle(
      1100,
      360,
      358,
      718,
      0x000000,
      0
    ).setStrokeStyle(2, 0x334155);

    this.add.text(
      960,
      28,
      "CREATOR LIFE",
      {
        fontFamily: "Arial",
        fontSize: "26px",
        color: "#42e8b4",
        fontStyle: "bold"
      }
    );

    this.add.text(
      960,
      63,
      "Do quarto para o mundo",
      {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#94a3b8"
      }
    );

    this.hudText = this.add.text(
      960,
      115,
      "",
      {
        fontFamily: "Consolas, monospace",
        fontSize: "17px",
        color: "#e2e8f0",
        lineSpacing: 9
      }
    );

    this.add.rectangle(
      1100,
      325,
      300,
      100,
      0x1c2638
    ).setStrokeStyle(2, 0x334155);

    this.statusText = this.add.text(
      970,
      290,
      "Seu canal ainda não possui vídeos.",
      {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#cbd5e1",
        wordWrap: {
          width: 260
        },
        lineSpacing: 4
      }
    );

    this.createButton(
      1100,
      430,
      300,
      52,
      "Produzir vídeo",
      () => this.produceVideo()
    );

    this.createButton(
      1100,
      495,
      300,
      52,
      "Fazer trabalho freelance",
      () => this.doFreelanceWork()
    );

    this.createButton(
      1100,
      560,
      300,
      52,
      "Comer",
      () => this.eat()
    );

    this.createButton(
      1100,
      625,
      300,
      52,
      "Dormir",
      () => this.sleep()
    );

    this.add.text(
      1100,
      685,
      "META: alcançar 100 inscritos",
      {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#facc15",
        fontStyle: "bold"
      }
    ).setOrigin(0.5);
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    action: () => void
  ): void {
    const background = this.add.rectangle(
      x,
      y,
      width,
      height,
      0x167a59
    )
      .setStrokeStyle(2, 0x42e8b4)
      .setInteractive({
        useHandCursor: true
      });

    this.add.text(
      x,
      y,
      label,
      {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold"
      }
    ).setOrigin(0.5);

    background.on("pointerover", () => {
      background.setFillStyle(0x229b73);
    });

    background.on("pointerout", () => {
      background.setFillStyle(0x167a59);
    });

    background.on("pointerdown", () => {
      action();
    });
  }

  private produceVideo(): void {
    if (this.state.energy < 25) {
      this.setStatus(
        "Você está sem energia suficiente para gravar e editar."
      );

      return;
    }

    if (this.state.hunger < 20) {
      this.setStatus(
        "Você está com muita fome para produzir um vídeo."
      );

      return;
    }

    if (this.state.creativity < 15) {
      this.setStatus(
        "Sua criatividade está baixa. Descanse antes de produzir."
      );

      return;
    }

    const quality = Phaser.Math.Clamp(
      Phaser.Math.Between(35, 80) +
        Math.floor(this.state.creativity * 0.2),
      0,
      100
    );

    const trendMultiplier =
      Phaser.Math.FloatBetween(0.65, 1.65);

    const audienceBase =
      20 +
      this.state.videos * 10 +
      this.state.subscribers * 0.15;

    const views = Math.max(
      5,
      Math.floor(
        (
          audienceBase +
          quality * 2.2
        ) * trendMultiplier
      )
    );

    const subscriberRate =
      Phaser.Math.FloatBetween(0.03, 0.1);

    const newSubscribers = Math.max(
      1,
      Math.floor(views * subscriberRate)
    );

    const revenue =
      this.state.subscribers >= 1000
        ? views * 0.006
        : Phaser.Math.Between(0, 5);

    this.state.energy -= 25;
    this.state.creativity -= 15;

    this.state.videos += 1;
    this.state.totalViews += views;
    this.state.subscribers += newSubscribers;
    this.state.money += revenue;

    this.advanceTime(4);

    const result =
      trendMultiplier > 1.35
        ? "O vídeo entrou nas recomendações."
        : trendMultiplier < 0.8
          ? "O vídeo teve pouco alcance."
          : "O vídeo teve um desempenho normal.";

    this.setStatus(
      `${result}\n` +
      `Qualidade: ${quality}/100\n` +
      `+${views.toLocaleString("pt-BR")} visualizações\n` +
      `+${newSubscribers.toLocaleString("pt-BR")} inscritos`
    );
  }

  private doFreelanceWork(): void {
    if (this.state.energy < 20) {
      this.setStatus(
        "Você está cansado demais para trabalhar."
      );

      return;
    }

    if (this.state.hunger < 15) {
      this.setStatus(
        "Você precisa comer antes de começar outro trabalho."
      );

      return;
    }

    const payment = Phaser.Math.Between(30, 50);

    this.state.money += payment;
    this.state.energy -= 20;
    this.state.creativity -= 8;

    this.advanceTime(4);

    this.setStatus(
      `Você concluiu um trabalho freelance e recebeu R$ ${payment.toFixed(2)}.`
    );
  }

  private eat(): void {
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

    this.setStatus(
      "Você fez uma refeição e recuperou sua fome."
    );
  }

  private sleep(): void {
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

    this.setStatus(
      "Você dormiu e recuperou energia e criatividade."
    );
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
    const formattedHour = String(
      this.state.hour
    ).padStart(2, "0");

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
  }
}