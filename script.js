// ═══════════════════════════════════════════════════════════
//  ХОМЯК / ЖАБА vs ТРАМП — космический шутер
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

// ─── Персонажи ─────────────────────────────────────────────
const CHARACTERS = {
    hamster: {
        emoji: '🐹',
        filter: 'hue-rotate(90deg) saturate(1.6) drop-shadow(0 2px 6px rgba(0,0,0,0.6))',
        cooldown: 220,
        shipColor: '#4cd964',
        glowColor: 'rgba(120, 255, 120, 0.45)',
        bullet: 'seed',
    },
    frog: {
        emoji: '🐸',
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))',
        cooldown: 140,
        shipColor: '#3a8f3a',
        glowColor: 'rgba(120, 255, 80, 0.5)',
        bullet: 'tongue',
    },
};

let selectedChar = localStorage.getItem('character') || 'hamster';

// Применяем сохранённый выбор к UI и слушаем клики
function initCharPick() {
    document.querySelectorAll('.char-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.char === selectedChar);
        card.addEventListener('click', () => {
            document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedChar = card.dataset.char;
            localStorage.setItem('character', selectedChar);
        });
    });
}
initCharPick();

// ─── Состояние игры ────────────────────────────────────────
const game = {
    hero: null,
    bullets: [],
    enemies: [],
    enemyBullets: [],
    particles: [],
    stars: [],
    boss: null,
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

// ─── Герой ─────────────────────────────────────────────────
function createHero() {
    const c = CHARACTERS[selectedChar];
    return {
        x: W / 2,
        y: H - 110,
        targetX: W / 2,
        targetY: H - 110,
        size: 56,
        cooldown: 0,
        cooldownMax: c.cooldown,
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
    game.boss = null;
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
    else if (game.score < 2000)  overMsg.textContent = 'Почти спас всех!';
    else                         overMsg.textContent = '🏆 Легенда галактики!';
    overScreen.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// ─── Ввод ──────────────────────────────────────────────────
function pointerMove(clientX, clientY) {
    if (!game.hero) return;
    game.hero.targetX = Math.max(30, Math.min(W - 30, clientX));
    game.hero.targetY = Math.max(110, Math.min(H - 40, clientY));
}

canvas.addEventListener('touchstart', e => { e.preventDefault(); pointerMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
canvas.addEventListener('touchmove',  e => { e.preventDefault(); pointerMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
canvas.addEventListener('mousemove',  e => pointerMove(e.clientX, e.clientY));
canvas.addEventListener('mousedown',  e => pointerMove(e.clientX, e.clientY));

const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup',   e => keys[e.code] = false);

// ─── HUD ───────────────────────────────────────────────────
function updateHUD() {
    scoreEl.textContent = game.score;
    levelEl.textContent = game.level;
    livesEl.textContent = '❤'.repeat(Math.max(0, game.hero?.lives ?? 0)) || '—';
}

// ─── Враги ─────────────────────────────────────────────────
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
        hp, maxHp: hp,
        shootTimer: 1200 + Math.random() * 2000,
        zigzag: Math.random() < 0.4,
        phase: Math.random() * Math.PI * 2,
    });
}

function heroShoot() {
    const h = game.hero;
    game.bullets.push({ x: h.x, y: h.y - h.size * 0.6, vy: -560, size: 10 });
}

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

// ─── БОСС ──────────────────────────────────────────────────
function spawnBoss() {
    const size = 130;
    const hp = 30 + game.level * 8;
    game.boss = {
        x: W / 2,
        y: -size,
        targetY: 150,
        size,
        hp, maxHp: hp,
        phase: 0,
        patternTimer: 1500,
        pattern: 0,
        entering: true,
    };
}

function bossShoot(b) {
    const pattern = b.pattern % 3;
    if (pattern === 0) {
        // Прицельный веер из 3
        const ang0 = Math.atan2(game.hero.y - b.y, game.hero.x - b.x);
        for (let i = -1; i <= 1; i++) {
            const a = ang0 + i * 0.2;
            const sp = 240;
            game.enemyBullets.push({
                x: b.x, y: b.y + b.size * 0.3,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                size: 10,
            });
        }
        b.patternTimer = 700;
    } else if (pattern === 1) {
        // Круговой залп
        const n = 12;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            game.enemyBullets.push({
                x: b.x, y: b.y,
                vx: Math.cos(a) * 170,
                vy: Math.sin(a) * 170,
                size: 8,
            });
        }
        b.patternTimer = 1100;
    } else {
        // Скоростной снайпер
        const a = Math.atan2(game.hero.y - b.y, game.hero.x - b.x);
        game.enemyBullets.push({
            x: b.x, y: b.y + b.size * 0.3,
            vx: Math.cos(a) * 380,
            vy: Math.sin(a) * 380,
            size: 12,
        });
        b.patternTimer = 600;
    }
    b.pattern++;
}

function updateBoss(dt) {
    const b = game.boss;
    if (!b) return;
    b.phase += dt;

    if (b.entering) {
        b.y += 70 * dt;
        if (b.y >= b.targetY) { b.y = b.targetY; b.entering = false; }
    } else {
        b.x = W/2 + Math.sin(b.phase * 0.7) * Math.min(W * 0.35, 220);
        b.patternTimer -= dt * 1000;
        if (b.patternTimer <= 0) bossShoot(b);
    }

    // Столкновение с героем
    const h = game.hero;
    if (h.invul <= 0 && Math.hypot(h.x - b.x, h.y - b.y) < (h.size + b.size) * 0.42) {
        damageHero();
    }
}

// ─── Обновление ────────────────────────────────────────────
function update(dt) {
    for (const s of game.stars) {
        s.y += s.s * dt;
        if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    }

    if (!game.running) return;

    const h = game.hero;

    // Клавиатура (для десктопа)
    if (keys['ArrowLeft']  || keys['KeyA']) h.targetX -= 350 * dt;
    if (keys['ArrowRight'] || keys['KeyD']) h.targetX += 350 * dt;
    if (keys['ArrowUp']    || keys['KeyW']) h.targetY -= 350 * dt;
    if (keys['ArrowDown']  || keys['KeyS']) h.targetY += 350 * dt;
    h.targetX = Math.max(30, Math.min(W - 30, h.targetX));
    h.targetY = Math.max(110, Math.min(H - 40, h.targetY));

    // Плавное движение к цели (2D)
    h.x += (h.targetX - h.x) * Math.min(1, dt * 12);
    h.y += (h.targetY - h.y) * Math.min(1, dt * 12);
    if (h.invul > 0) h.invul -= dt;

    // Авто-стрельба
    h.cooldown -= dt * 1000;
    if (h.cooldown <= 0) { heroShoot(); h.cooldown = h.cooldownMax; }

    // Спавн рядовых (приостанавливаем, пока есть босс)
    if (!game.boss) {
        game.spawnTimer -= dt * 1000;
        if (game.spawnTimer <= 0) {
            spawnEnemy();
            game.spawnTimer = game.spawnInterval;
        }
    }

    // Босс
    updateBoss(dt);

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

        if (h.invul <= 0 && Math.hypot(h.x - e.x, h.y - e.y) < (h.size + e.size) * 0.45) {
            damageHero();
            explode(e.x, e.y, '#ff6644', 20);
            game.enemies.splice(i, 1);
            continue;
        }

        if (e.y > H + e.size) game.enemies.splice(i, 1);
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

    // Попадания пуль героя
    for (let i = game.bullets.length - 1; i >= 0; i--) {
        const b = game.bullets[i];
        let hit = false;

        // Сначала по боссу
        if (game.boss && !game.boss.entering) {
            const B = game.boss;
            if (Math.hypot(b.x - B.x, b.y - B.y) < B.size * 0.42 + b.size) {
                B.hp--;
                game.bullets.splice(i, 1);
                explode(b.x, b.y, '#ffd84d', 3);
                if (B.hp <= 0) {
                    explode(B.x, B.y, '#ff9a1e', 50);
                    explode(B.x, B.y, '#ffd84d', 30);
                    game.score += 2500 * game.level;
                    game.boss = null;
                    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                    updateHUD();
                }
                hit = true;
            }
        }
        if (hit) continue;

        // По рядовым
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
                        if (game.level % 3 === 0 && !game.boss) spawnBoss();
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
    if (h.invul > 0 && Math.floor(h.invul * 12) % 2 === 0) return;

    const c = CHARACTERS[selectedChar];

    // Свечение-щит
    const glow = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.size);
    glow.addColorStop(0, c.glowColor);
    glow.addColorStop(1, 'rgba(120, 255, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(h.x - h.size, h.y - h.size, h.size * 2, h.size * 2);

    // Корпус
    ctx.fillStyle = c.shipColor;
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

    // Пилот-эмодзи
    ctx.save();
    ctx.font = `${h.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.filter = c.filter;
    ctx.fillText(c.emoji, h.x, h.y - h.size * 0.05);
    ctx.restore();
}

function drawBullet(b) {
    const c = CHARACTERS[selectedChar];
    if (c.bullet === 'tongue') {
        // Жабий язык — розовый снаряд
        ctx.fillStyle = '#ff66aa';
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.size * 0.5, b.size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y - b.size * 0.4, b.size * 0.25, 0, Math.PI * 2);
        ctx.fill();
    } else {
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
}

function drawEnemyBullet(b) {
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(b.x - b.size * 0.3, b.y - b.size * 0.3, b.size * 0.35, 0, Math.PI * 2);
    ctx.fill();
}

function drawTrumpFace(x, y, s, withHair = true, withCap = false) {
    // Пиджак
    ctx.fillStyle = '#1a2342';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + s * 0.15);
    ctx.lineTo(x + s * 0.5, y + s * 0.15);
    ctx.lineTo(x + s * 0.45, y + s * 0.65);
    ctx.lineTo(x - s * 0.45, y + s * 0.65);
    ctx.closePath();
    ctx.fill();

    // Галстук
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.09, y + s * 0.15);
    ctx.lineTo(x + s * 0.09, y + s * 0.15);
    ctx.lineTo(x + s * 0.13, y + s * 0.62);
    ctx.lineTo(x, y + s * 0.68);
    ctx.lineTo(x - s * 0.13, y + s * 0.62);
    ctx.closePath();
    ctx.fill();

    // Лицо
    ctx.fillStyle = '#f4a460';
    ctx.beginPath();
    ctx.arc(x, y - s * 0.05, s * 0.36, 0, Math.PI * 2);
    ctx.fill();

    // Волосы
    if (withHair) {
        ctx.fillStyle = '#f4d03f';
        ctx.beginPath();
        ctx.moveTo(x - s * 0.4, y - s * 0.18);
        ctx.quadraticCurveTo(x - s * 0.55, y - s * 0.5, x - s * 0.05, y - s * 0.42);
        ctx.quadraticCurveTo(x + s * 0.35, y - s * 0.55, x + s * 0.45, y - s * 0.2);
        ctx.quadraticCurveTo(x + s * 0.18, y - s * 0.36, x - s * 0.2, y - s * 0.3);
        ctx.closePath();
        ctx.fill();
    }

    // Красная кепка MAGA для босса
    if (withCap) {
        ctx.fillStyle = '#cc0000';
        // козырёк
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y - s * 0.15);
        ctx.lineTo(x + s * 0.5, y - s * 0.15);
        ctx.lineTo(x + s * 0.42, y - s * 0.08);
        ctx.lineTo(x - s * 0.42, y - s * 0.08);
        ctx.closePath();
        ctx.fill();
        // тулья
        ctx.beginPath();
        ctx.moveTo(x - s * 0.38, y - s * 0.15);
        ctx.quadraticCurveTo(x, y - s * 0.55, x + s * 0.38, y - s * 0.15);
        ctx.closePath();
        ctx.fill();
        // надпись MAGA
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${s * 0.12}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MAGA', x, y - s * 0.3);
    }

    // Глаза
    ctx.fillStyle = '#000';
    ctx.fillRect(x - s * 0.19, y - s * 0.09, s * 0.1, s * 0.035);
    ctx.fillRect(x + s * 0.09, y - s * 0.09, s * 0.1, s * 0.035);

    // Рот
    ctx.beginPath();
    ctx.arc(x, y + s * 0.08, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
}

function drawEnemy(e) {
    drawTrumpFace(e.x, e.y, e.size, true, false);
    if (e.maxHp > 1) {
        const w = e.size * 0.8;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x - w/2, e.y - e.size * 0.55, w, 4);
        ctx.fillStyle = '#4cd964';
        ctx.fillRect(e.x - w/2, e.y - e.size * 0.55, w * (e.hp / e.maxHp), 4);
    }
}

function drawBoss(b) {
    // Аура
    const glow = ctx.createRadialGradient(b.x, b.y, b.size * 0.4, b.x, b.y, b.size * 1.4);
    glow.addColorStop(0, 'rgba(255, 60, 60, 0.45)');
    glow.addColorStop(1, 'rgba(255, 60, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(b.x - b.size * 1.4, b.y - b.size * 1.4, b.size * 2.8, b.size * 2.8);

    drawTrumpFace(b.x, b.y, b.size, false, true);

    // HP-полоса сверху экрана
    if (!b.entering) {
        const barW = Math.min(W * 0.7, 420);
        const barH = 12;
        const barX = (W - barW) / 2;
        const barY = 64;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#ff3b3b';
        ctx.fillRect(barX, barY, barW * (b.hp / b.maxHp), barH);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('БОСС: ТРАМП-ИМПЕРАТОР', W/2, barY - 6);
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
    for (const e of game.enemies) drawEnemy(e);
    if (game.boss) drawBoss(game.boss);
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
