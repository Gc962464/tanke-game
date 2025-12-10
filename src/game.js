const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const statusEl = document.getElementById("status");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYER_SPEED = 2.6;
const BULLET_SPEED = 6;
const ENEMY_SPEED = 1.8;
const ENEMY_COUNT = 5;
const PLAYER_MAX_LIVES = 3;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

class Input {
  constructor() {
    this.keys = new Set();
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
  }

  pressed(code) {
    return this.keys.has(code);
  }
}

class Bullet {
  constructor(x, y, dir, owner) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.owner = owner;
    this.size = 6;
    this.speed = BULLET_SPEED;
    this.active = true;
  }

  update() {
    this.x += Math.cos(this.dir) * this.speed;
    this.y += Math.sin(this.dir) * this.speed;
    if (this.x < -10 || this.x > WIDTH + 10 || this.y < -10 || this.y > HEIGHT + 10) {
      this.active = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.owner === "player" ? "#5ec8ff" : "#ffb347";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Tank {
  constructor(x, y, color, isPlayer = false) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.size = 36;
    this.color = color;
    this.isPlayer = isPlayer;
    this.cooldown = 0;
    this.speed = isPlayer ? PLAYER_SPEED : ENEMY_SPEED;
    this.targetDirTimer = 0;
  }

  update(dt, input) {
    if (this.isPlayer) {
      this.handlePlayerInput(input);
    } else {
      this.handleAI(dt);
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.x = clamp(this.x, this.size / 2, WIDTH - this.size / 2);
    this.y = clamp(this.y, this.size / 2, HEIGHT - this.size / 2);
  }

  handlePlayerInput(input) {
    let dx = 0;
    let dy = 0;
    if (input.pressed("ArrowUp")) dy -= 1;
    if (input.pressed("ArrowDown")) dy += 1;
    if (input.pressed("ArrowLeft")) dx -= 1;
    if (input.pressed("ArrowRight")) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      this.x += dx * this.speed;
      this.y += dy * this.speed;
      this.angle = Math.atan2(dy, dx);
    }
  }

  handleAI(dt) {
    this.targetDirTimer -= dt;
    if (this.targetDirTimer <= 0) {
      this.targetDirTimer = 120 + Math.random() * 120;
      const dx = Math.random() * 2 - 1;
      const dy = Math.random() * 2 - 1;
      this.angle = Math.atan2(dy, dx);
    }
    this.x += Math.cos(this.angle) * this.speed * 0.8;
    this.y += Math.sin(this.angle) * this.speed * 0.8;
    if (Math.random() < 0.01) {
      this.angle += Math.PI / 2;
    }
  }

  tryShoot(bullets, owner) {
    if (this.cooldown > 0) return;
    const bx = this.x + Math.cos(this.angle) * this.size * 0.7;
    const by = this.y + Math.sin(this.angle) * this.size * 0.7;
    bullets.push(new Bullet(bx, by, this.angle, owner));
    this.cooldown = 40;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.fillStyle = "#0c1320";
    ctx.fillRect(-this.size / 4, -this.size / 4, this.size / 2, this.size / 2);
    ctx.fillStyle = "#e9f0f7";
    ctx.fillRect(this.size / 2, -4, this.size / 2, 8);
    ctx.restore();
  }
}

class Game {
  constructor() {
    this.input = new Input();
    this.player = new Tank(WIDTH / 2, HEIGHT - 80, "#5ec8ff", true);
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.score = 0;
    this.lives = PLAYER_MAX_LIVES;
    this.running = false;
    this.lastTime = 0;
    this.spawnEnemies();
    this.bindUI();
    this.syncHUD();
    // 自动开始，避免用户忘记点击开始
    setTimeout(() => this.start(), 200);
    requestAnimationFrame((t) => this.loop(t));
  }

  bindUI() {
    canvas.tabIndex = 0;
    canvas.addEventListener("click", () => {
      canvas.focus();
      this.start();
    });
    startBtn.addEventListener("click", () => this.start());
    pauseBtn.addEventListener("click", () => this.togglePause());
    resetBtn.addEventListener("click", () => this.reset());
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        this.player.tryShoot(this.bullets, "player");
      }
      if (e.code === "KeyR") {
        this.reset();
      }
    });
  }

  spawnEnemies() {
    this.enemies = [];
    for (let i = 0; i < ENEMY_COUNT; i++) {
      const x = 60 + Math.random() * (WIDTH - 120);
      const y = 60 + Math.random() * (HEIGHT / 2 - 60);
      const enemy = new Tank(x, y, "#ffb347", false);
      enemy.angle = Math.random() * Math.PI * 2;
      this.enemies.push(enemy);
    }
  }

  start() {
    this.running = true;
    statusEl.textContent = "状态: 战斗中";
  }

  togglePause() {
    this.running = !this.running;
    statusEl.textContent = this.running ? "状态: 战斗中" : "状态: 已暂停";
  }

  reset() {
    this.player = new Tank(WIDTH / 2, HEIGHT - 80, "#5ec8ff", true);
    this.bullets = [];
    this.particles = [];
    this.score = 0;
    this.lives = PLAYER_MAX_LIVES;
    this.spawnEnemies();
    this.running = false;
    statusEl.textContent = "状态: 待机";
    this.syncHUD();
  }

  syncHUD() {
    scoreEl.textContent = `得分: ${this.score}`;
    livesEl.textContent = `生命: ${this.lives}`;
  }

  addParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() * 2 - 1) * 2,
        vy: (Math.random() * 2 - 1) * 2,
        life: 30 + Math.random() * 20,
        color
      });
    }
  }

  updateParticles() {
    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
    });
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  loop(timestamp) {
    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;
    if (this.running) {
      this.update(dt);
    }
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.player.update(dt, this.input);

    this.enemies.forEach((e) => {
      e.update(dt, this.input);
      if (Math.random() < 0.01) {
        e.tryShoot(this.bullets, "enemy");
      }
    });

    this.bullets.forEach((b) => b.update());
    this.handleCollisions();
    this.bullets = this.bullets.filter((b) => b.active);

    if (this.enemies.length === 0) {
      this.spawnEnemies();
    }
  }

  handleCollisions() {
    // player vs enemy tanks (撞击爆炸)
    let collided = false;
    this.enemies.forEach((e) => {
      const d = Math.hypot(this.player.x - e.x, this.player.y - e.y);
      if (d < (this.player.size + e.size) / 2) {
        collided = true;
        this.addParticles(e.x, e.y, e.color);
        this.addParticles(this.player.x, this.player.y, this.player.color);
        this.score += 100;
        e.x = -9999; // mark for removal
      }
    });
    if (collided) {
      this.enemies = this.enemies.filter((e) => e.x > 0);
      this.lives -= 1;
      if (this.lives <= 0) {
        this.gameOver();
      } else {
        this.player.x = WIDTH / 2;
        this.player.y = HEIGHT - 80;
        statusEl.textContent = "状态: 撞击受伤";
      }
    }

    // player bullets vs enemies
    this.bullets.forEach((b) => {
      if (!b.active) return;
      if (b.owner === "player") {
        this.enemies.forEach((e) => {
          if (!b.active) return;
          const d = Math.hypot(b.x - e.x, b.y - e.y);
          if (d < e.size / 2) {
            b.active = false;
            this.score += 100;
            this.addParticles(e.x, e.y, e.color);
            e.x = -9999; // move offscreen for filter
          }
        });
        this.enemies = this.enemies.filter((e) => e.x > 0);
      } else if (b.owner === "enemy") {
        const d = Math.hypot(b.x - this.player.x, b.y - this.player.y);
        if (d < this.player.size / 2) {
          b.active = false;
          this.addParticles(this.player.x, this.player.y, this.player.color);
          this.lives -= 1;
          if (this.lives <= 0) {
            this.gameOver();
          } else {
            this.player.x = WIDTH / 2;
            this.player.y = HEIGHT - 80;
          }
        }
      }
    });
    this.syncHUD();
  }

  gameOver() {
    this.running = false;
    statusEl.textContent = "状态: 失败，点击开始重试";
  }

  drawBackground() {
    ctx.fillStyle = "#0c1320";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "#132033";
    for (let x = 0; x < WIDTH; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < HEIGHT; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }
  }

  drawParticles() {
    this.particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 50);
      ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;
  }

  draw() {
    this.drawBackground();
    this.player.draw(ctx);
    this.enemies.forEach((e) => e.draw(ctx));
    this.bullets.forEach((b) => b.draw(ctx));
    this.updateParticles();
    this.drawParticles();

    if (!this.running) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#e9f0f7";
      ctx.textAlign = "center";
      ctx.font = "28px Arial";
      ctx.fillText("点击开始进入战斗", WIDTH / 2, HEIGHT / 2);
    }
  }
}

new Game();

