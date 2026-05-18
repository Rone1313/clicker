// ═══════════════════════════════════════════════════════════
//  ХОМЯК vs ТРАМП — космический шутер
// ═══════════════════════════════════════════════════════════

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl     = document.getElementById('score');
const levelEl     = document.getElementById('level');
const livesEl     = document.getElementById('lives');
const startScreen = document.getElementById('startScreen');
const overScreen  = document.getElementById('gameOverScreen');
const finalScore  = document.getElementById('finalScore');
const overMsg     = document.getElementById('gameOverMsg');
const startBtn    = document.getElementById('startBtn');
const restartBtn  = document.getElementById('restartBtn');

let W = 0, H = 0, DPR = 1;
function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ─── Состояние игры ────────────────────────────────────────
const game = {
    hero: null,
    bullets: [],
    enemies: [],
    enemyBullets: [],
    particles: [],
    stars: [],
    score: 0,
    level: 1,
    levelKills: 0,
    spawnTimer: 0,
    spawnInterval: 1100,
    running: false,
    lastTime: 0,
};

// ─── Звёздный фон ──────────────────────────────────────────
function initStars() {
    game.stars = [];
    for (let i = 0; i < 90; i++) {
        game.stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.6 + 0.3,
            s: Math.random() * 40 + 15,
        });
    }
}

// ─── Герой-хомяк ───────────────────────────────────────────
function createHero() {
    return {
        x: W / 2,
        y: H - 110,
        targetX: W / 2,
        size: 56,
        cooldown: 0,
        cooldownMax: 220,
        lives: 3,
        invul: 0,
    };
}

// ─── Старт / рестарт ───────────────────────────────────────
function startGame() {
    game.hero = createHero();
    game.bullets.length = 0;
    game.enemies.length = 0;
    game.enemyBullets.length = 0;
    game.particles.length = 0;
    game.score = 0;
    game.level = 1;
    game.levelKills = 0;
    game.spawnTimer = 0;
    game.spawnInterval = 1100;
    game.running = true;
    game.lastTime = performance.now();
    initStars();
    updateHUD();
    startScreen.classList.add('hidden');
    overScreen.classList.add('hidden');
}

function gameOver() {
    game.running = false;
    finalScore.textContent = game.score;
    if (game.score < 200)        overMsg.textContent = 'Трамп захватил галактику…';
    else if (game.score < 800)   overMsg.textContent = 'Достойное сопротивление!';
    else if (game.score < 2000)  overMsg.textContent = 'Хомяк-герой! Почти спас всех.';
    else                         overMsg.textContent = '🏆 Легенда галактики!';
    overScreen.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// ─── Ввод: касание / мышь ──────────────────────────────────
function pointerMove(clientX) {
    if (!game.hero) return;
    game.hero.targetX = Math.max(30, Math.min(W - 30, clientX));
}

canvas.addEventListener('touchstart', e => { e.preventDefault(); pointerMove(e.touches[0].clientX); }, { passive: false });
canvas.addEventListener('touchmove',  e => { e.preventDefault(); pointerMove(e.touches[0].clientX); }, { passive: false });
canvas.addEventListener('mousemove',  e => pointerMove(e.clientX));
canvas.addEventListener('mousedown',  e => pointerMove(e.clientX));

// Клавиатура (для десктопа)
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup',   e => keys[e.code] = false);

// ─── HUD ───────────────────────────────────────────────────
function updateHUD() {
    scoreEl.textContent = game.score;
    levelEl.textContent = game.level;
    livesEl.textContent = '❤'.repeat(Math.max(0, game.hero?.lives ?? 0)) || '—';
}

// ─── Спавн врагов ──────────────────────────────────────────
function spawnEnemy() {
    const size = 50 + Math.random() * 18;
    const x = size + Math.random() * (W - size * 2);
    const speed = 50 + Math.random() * 30 + game.level * 12;
    const hp = 1 + Math.floor(game.level / 3);
    game.enemies.push({
        x, y: -size,
        size,
        vx: (Math.random() - 0.5) * 60,
        vy: speed,
        hp,
        maxHp: hp,
        shootTimer: 1200 + Math.random() * 2000,
        zigzag: Math.random() < 0.4,
        phase: Math.random() * Math.PI * 2,
    });
}

// ─── Стрельба героя ────────────────────────────────────────
function heroShoot() {
    const h = game.hero;
    game.bullets.push({ x: h.x, y: h.y - h.size * 0.6, vy: -560, size: 10 });
}

// ─── Стрельба Трампа ───────────────────────────────────────
function enemyShoot(e) {
    const dx = (game.hero.x - e.x);
    const dy = (game.hero.y - e.y);
    const d  = Math.hypot(dx, dy) || 1;
    const speed = 220 + game.level * 12;
    game.enemyBullets.push({
        x: e.x, y: e.y + e.size * 0.4,
        vx: dx / d * speed,
        vy: dy / d * speed,
        size: 8,
    });
}

// ─── Партиклы (взрыв) ──────────────────────────────────────
function explode(x, y, color = '#ffd84d', count = 14) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 220;
        game.particles.push({
            x, y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 0.6 + Math.random() * 0.4,
            age: 0,
            color,
            size: 2 + Math.random() * 3,
        });
    }
}

// ─── Обновление ────────────────────────────────────────────
function update(dt) {
    // Звёзды
    for (const s of game.stars) {
        s.y += s.s * dt;
        if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    }

    if (!game.running) return;

    const h = game.hero;

    // Клавиатура
    if (keys['ArrowLeft']  || keys['KeyA']) h.targetX -= 350 * dt;
    if (keys['ArrowRight'] || keys['KeyD']) h.targetX += 350 * dt;
    h.targetX = Math.max(30, Math.min(W - 30, h.targetX));

    // Плавное движение к цели
    h.x += (h.targetX - h.x) * Math.min(1, dt * 12);
    if (h.invul > 0) h.invul -= dt;

    // Авто-стрельба
    h.cooldown -= dt * 1000;
    if (h.cooldown <= 0) {
        heroShoot();
        h.cooldown = h.cooldownMax;
    }

    // Спавн врагов
    game.spawnTimer -= dt * 1000;
    if (game.spawnTimer <= 0) {
        spawnEnemy();
        game.spawnTimer = game.spawnInterval;
    }

    // Пули героя
    for (let i = game.bullets.length - 1; i >= 0; i--) {
        const b = game.bullets[i];
        b.y += b.vy * dt;
        if (b.y < -20) game.bullets.splice(i, 1);
    }

    // Враги
    for (let i = game.enemies.length - 1; i >= 0; i--) {
        const e = game.enemies[i];
        e.phase += dt * 2;
        const vx = e.zigzag ? Math.sin(e.phase) * 90 : e.vx;
        e.x += vx * dt;
        e.y += e.vy * dt;
        if (e.x < e.size) e.x = e.size;
        if (e.x > W - e.size) e.x = W - e.size;

        e.shootTimer -= dt * 1000;
        if (e.shootTimer <= 0 && e.y > 40 && e.y < H - 200) {
            enemyShoot(e);
            e.shootTimer = 1400 + Math.random() * 1600;
        }

        // Столкновение с героем
        if (h.invul <= 0 && Math.hypot(h.x - e.x, h.y - e.y) < (h.size + e.size) * 0.45) {
            damageHero();
            explode(e.x, e.y, '#ff6644', 20);
            game.enemies.splice(i, 1);
            continue;
        }

        if (e.y > H + e.size) {
            game.enemies.splice(i, 1);
        }
    }

    // Пули врагов
    for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
        const b = game.enemyBullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y > H + 20 || b.y < -20 || b.x < -20 || b.x > W + 20) {
            game.enemyBullets.splice(i, 1);
            continue;
        }
        if (h.invul <= 0 && Math.hypot(h.x - b.x, h.y - b.y) < h.size * 0.45 + b.size) {
            damageHero();
            game.enemyBullets.splice(i, 1);
        }
    }

    // Столкновения пуль героя с врагами
    for (let i = game.bullets.length - 1; i >= 0; i--) {
        const b = game.bullets[i];
        for (let j = game.enemies.length - 1; j >= 0; j--) {
            const e = game.enemies[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < e.size * 0.5 + b.size) {
                e.hp--;
                game.bullets.splice(i, 1);
                explode(b.x, b.y, '#ffd84d', 4);
                if (e.hp <= 0) {
                    explode(e.x, e.y, '#ff9a1e', 18);
                    game.enemies.splice(j, 1);
                    game.score += 100 * game.level;
                    game.levelKills++;
                    if (game.levelKills >= 8 + game.level * 2) {
                        game.level++;
                        game.levelKills = 0;
                        game.spawnInterval = Math.max(380, game.spawnInterval - 90);
                    }
                    updateHUD();
                }
                break;
            }
        }
    }

    // Партиклы
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
        if (p.age >= p.life) game.particles.splice(i, 1);
    }
}

function damageHero() {
    game.hero.lives--;
    game.hero.invul = 1.4;
    explode(game.hero.x, game.hero.y, '#7ad0ff', 24);
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    updateHUD();
    if (game.hero.lives <= 0) gameOver();
}

// ─── Отрисовка ─────────────────────────────────────────────
function drawStars() {
    ctx.fillStyle = '#fff';
    for (const s of game.stars) {
        ctx.globalAlpha = Math.min(1, s.r / 1.6);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawHero() {
    const h = game.hero;
    if (!h) return;

    // Мигание при неуязвимости
    if (h.invul > 0 && Math.floor(h.invul * 12) % 2 === 0) return;

    // Зелёное свечение-щит
    const glow = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.size);
    glow.addColorStop(0, 'rgba(120, 255, 120, 0.45)');
    glow.addColorStop(1, 'rgba(120, 255, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(h.x - h.size, h.y - h.size, h.size * 2, h.size * 2);

    // Корпус корабля
    ctx.fillStyle = '#4cd964';
    ctx.beginPath();
    ctx.moveTo(h.x - h.size * 0.55, h.y + h.size * 0.35);
    ctx.lineTo(h.x + h.size * 0.55, h.y + h.size * 0.35);
    ctx.lineTo(h.x + h.size * 0.35, h.y + h.size * 0.55);
    ctx.lineTo(h.x - h.size * 0.35, h.y + h.size * 0.55);
    ctx.closePath();
    ctx.fill();

    // Огни двигателей
    ctx.fillStyle = '#ff9a1e';
    ctx.beginPath();
    ctx.moveTo(h.x - h.size * 0.3, h.y + h.size * 0.55);
    ctx.lineTo(h.x - h.size * 0.15, h.y + h.size * 0.85 + Math.random() * 6);
    ctx.lineTo(h.x, h.y + h.size * 0.55);
    ctx.lineTo(h.x + h.size * 0.15, h.y + h.size * 0.85 + Math.random() * 6);
    ctx.lineTo(h.x + h.size * 0.3, h.y + h.size * 0.55);
    ctx.closePath();
    ctx.fill();

    // Хомяк-пилот (зелёный через CSS-фильтр)
    ctx.save();
    ctx.font = `${h.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.filter = 'hue-rotate(90deg) saturate(1.6) drop-shadow(0 2px 6px rgba(0,0,0,0.6))';
    ctx.fillText('🐹', h.x, h.y - h.size * 0.05);
    ctx.restore();
}

function drawBullet(b) {
    // Семечка
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.size * 0.55, b.size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.size * 0.25, b.size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawEnemyBullet(b) {
    // Красный «твит»
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(b.x - b.size * 0.3, b.y - b.size * 0.3, b.size * 0.35, 0, Math.PI * 2);
    ctx.fill();
}

function drawTrump(e) {
    const x = e.x, y = e.y, s = e.size;

    // Тёмно-синий пиджак
    ctx.fillStyle = '#1a2342';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + s * 0.15);
    ctx.lineTo(x + s * 0.5, y + s * 0.15);
    ctx.lineTo(x + s * 0.45, y + s * 0.65);
    ctx.lineTo(x - s * 0.45, y + s * 0.65);
    ctx.closePath();
    ctx.fill();

    // Красный галстук
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.09, y + s * 0.15);
    ctx.lineTo(x + s * 0.09, y + s * 0.15);
    ctx.lineTo(x + s * 0.13, y + s * 0.62);
    ctx.lineTo(x, y + s * 0.68);
    ctx.lineTo(x - s * 0.13, y + s * 0.62);
    ctx.closePath();
    ctx.fill();

    // Лицо (оранжевый загар)
    ctx.fillStyle = '#f4a460';
    ctx.beginPath();
    ctx.arc(x, y - s * 0.05, s * 0.36, 0, Math.PI * 2);
    ctx.fill();

    // Волосы (жёлтая «причёска»)
    ctx.fillStyle = '#f4d03f';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y - s * 0.18);
    ctx.quadraticCurveTo(x - s * 0.55, y - s * 0.5, x - s * 0.05, y - s * 0.42);
    ctx.quadraticCurveTo(x + s * 0.35, y - s * 0.55, x + s * 0.45, y - s * 0.2);
    ctx.quadraticCurveTo(x + s * 0.18, y - s * 0.36, x - s * 0.2, y - s * 0.3);
    ctx.closePath();
    ctx.fill();

    // Глаза
    ctx.fillStyle = '#000';
    ctx.fillRect(x - s * 0.19, y - s * 0.09, s * 0.1, s * 0.035);
    ctx.fillRect(x + s * 0.09, y - s * 0.09, s * 0.1, s * 0.035);

    // Рот
    ctx.beginPath();
    ctx.arc(x, y + s * 0.08, s * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // HP-бар для крепких Трампов
    if (e.maxHp > 1) {
        const w = s * 0.8;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x - w/2, y - s * 0.55, w, 4);
        ctx.fillStyle = '#4cd964';
        ctx.fillRect(x - w/2, y - s * 0.55, w * (e.hp / e.maxHp), 4);
    }
}

function drawParticles() {
    for (const p of game.particles) {
        const a = 1 - p.age / p.life;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function render() {
    ctx.clearRect(0, 0, W, H);
    drawStars();
    for (const e of game.enemies) drawTrump(e);
    for (const b of game.enemyBullets) drawEnemyBullet(b);
    for (const b of game.bullets) drawBullet(b);
    drawParticles();
    if (game.running) drawHero();
}

// ─── Главный цикл ──────────────────────────────────────────
function loop(now) {
    const dt = Math.min(0.05, (now - game.lastTime) / 1000) || 0;
    game.lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
}

initStars();
render();
requestAnimationFrame(loop);
