// ═══════════════════════════════════════════════════════════
//  ХОМЯК-АРКАДА  —  меню + 4 игры
// ═══════════════════════════════════════════════════════════

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// ─── Рекорды (личные, в localStorage) ──────────────────────
const Records = (function() {
    function load() {
        try { return JSON.parse(localStorage.getItem('records') || '{}'); }
        catch { return {}; }
    }
    function save(r) { localStorage.setItem('records', JSON.stringify(r)); }
    function update(game, score) {
        const r = load();
        const isBest = !r[game] || score > r[game];
        if (isBest) { r[game] = score; save(r); }
        return isBest;
    }
    function getName() {
        const u = tg?.initDataUnsafe?.user;
        if (u?.first_name) return ((u.first_name || '') + ' ' + (u.last_name || '')).trim();
        return localStorage.getItem('playerName') || 'Хомякнавт';
    }
    return { load, save, update, getName };
})();

// ─── Маршрутизатор экранов ─────────────────────────────────
const screens = {
    hub:     document.getElementById('hubScreen'),
    shooter: document.getElementById('shooterScreen'),
    g2048:   document.getElementById('g2048Screen'),
    snake:   document.getElementById('snakeScreen'),
    runner:  document.getElementById('runnerScreen'),
    durak:   document.getElementById('durakScreen'),
    records: document.getElementById('recordsScreen'),
};

let activeGame = null;        // имя активной игры или null (хаб)
const games = {};             // заполнится модулями ниже

function showScreen(name) {
    if (activeGame && games[activeGame]?.stop) games[activeGame].stop();
    activeGame = null;
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
    if (name !== 'hub') {
        activeGame = name;
        games[name]?.start();
        if (tg?.BackButton) { tg.BackButton.show(); }
    } else {
        if (tg?.BackButton) { tg.BackButton.hide(); }
    }
}

document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => showScreen(card.dataset.game));
});
document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => showScreen('hub'));
});
if (tg?.BackButton) tg.BackButton.onClick(() => showScreen('hub'));

// ═══════════════════════════════════════════════════════════
//  МОДУЛЬ 1 — КОСМИЧЕСКИЙ ШУТЕР
// ═══════════════════════════════════════════════════════════
games.shooter = (function() {
    const canvas = document.getElementById('shooterCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl     = document.getElementById('shScore');
    const levelEl     = document.getElementById('shLevel');
    const livesEl     = document.getElementById('shLives');
    const startScreen = document.getElementById('shStartScreen');
    const overScreen  = document.getElementById('shOverScreen');
    const finalScore  = document.getElementById('shFinal');
    const overMsg     = document.getElementById('shOverMsg');
    const startBtn    = document.getElementById('shStartBtn');
    const restartBtn  = document.getElementById('shRestartBtn');

    let W = 0, H = 0, DPR = 1, rafId = 0, active = false;

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth || window.innerWidth;
        H = canvas.clientHeight || window.innerHeight;
        canvas.width  = W * DPR;
        canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    const CHARACTERS = {
        hamster: { emoji:'🐹', filter:'hue-rotate(90deg) saturate(1.6) drop-shadow(0 2px 6px rgba(0,0,0,0.6))', cooldown:220, shipColor:'#4cd964', glowColor:'rgba(120,255,120,0.45)', bullet:'seed' },
        frog:    { emoji:'🐸', filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.7))', cooldown:140, shipColor:'#3a8f3a', glowColor:'rgba(120,255,80,0.5)', bullet:'tongue' },
    };
    let selectedChar = localStorage.getItem('character') || 'hamster';

    document.querySelectorAll('#shStartScreen .char-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.char === selectedChar);
        card.addEventListener('click', () => {
            document.querySelectorAll('#shStartScreen .char-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedChar = card.dataset.char;
            localStorage.setItem('character', selectedChar);
        });
    });

    const game = { hero:null, bullets:[], enemies:[], enemyBullets:[], particles:[], stars:[], boss:null,
                   score:0, level:1, levelKills:0, spawnTimer:0, spawnInterval:1100, running:false, lastTime:0 };

    function initStars() {
        game.stars.length = 0;
        for (let i = 0; i < 90; i++) game.stars.push({ x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.6+0.3, s:Math.random()*40+15 });
    }
    function createHero() {
        const c = CHARACTERS[selectedChar];
        return { x:W/2, y:H-110, targetX:W/2, targetY:H-110, size:56, cooldown:0, cooldownMax:c.cooldown, lives:3, invul:0 };
    }
    function startGame() {
        game.hero = createHero();
        game.bullets.length=0; game.enemies.length=0; game.enemyBullets.length=0; game.particles.length=0;
        game.boss=null; game.score=0; game.level=1; game.levelKills=0;
        game.spawnTimer=0; game.spawnInterval=1100; game.running=true; game.lastTime=performance.now();
        initStars(); updateHUD();
        startScreen.classList.add('hidden');
        overScreen.classList.add('hidden');
    }
    function gameOver() {
        game.running = false;
        finalScore.textContent = game.score;
        const isBest = Records.update('shooter', game.score);
        overMsg.textContent = isBest
            ? '🏆 НОВЫЙ РЕКОРД!'
            : game.score < 200 ? 'Трамп захватил галактику…'
            : game.score < 800 ? 'Достойное сопротивление!'
            : game.score < 2000 ? 'Почти спас всех!'
            : 'Легенда галактики!';
        overScreen.classList.remove('hidden');
    }
    function updateHUD() {
        scoreEl.textContent = game.score;
        levelEl.textContent = game.level;
        livesEl.textContent = '❤'.repeat(Math.max(0, game.hero?.lives ?? 0)) || '—';
    }

    function pointerMove(x, y) {
        if (!game.hero) return;
        game.hero.targetX = Math.max(30, Math.min(W-30, x));
        game.hero.targetY = Math.max(110, Math.min(H-40, y));
    }
    const onTouch  = e => { e.preventDefault(); pointerMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onMouse  = e => pointerMove(e.clientX, e.clientY);
    const keys = {};
    const onKeyD = e => keys[e.code] = true;
    const onKeyU = e => keys[e.code] = false;
    const onResize = () => resize();

    function spawnEnemy() {
        const size = 50 + Math.random()*18;
        const x = size + Math.random()*(W - size*2);
        const type = Math.random() < 0.55 ? 'trump' : 'putin';
        // Путин чуть быстрее и стреляет чаще
        const speed = (type === 'putin' ? 65 : 50) + Math.random()*30 + game.level*12;
        const hp = 1 + Math.floor(game.level/3) + (type === 'putin' ? 1 : 0);
        game.enemies.push({ x, y:-size, size, type, vx:(Math.random()-0.5)*60, vy:speed, hp, maxHp:hp,
            shootTimer:(type==='putin'?900:1200)+Math.random()*1600,
            zigzag:Math.random()<0.4, phase:Math.random()*Math.PI*2 });
    }
    function heroShoot() {
        const h = game.hero;
        game.bullets.push({ x:h.x, y:h.y-h.size*0.6, vy:-560, size:10 });
    }
    function enemyShoot(e) {
        const dx=game.hero.x-e.x, dy=game.hero.y-e.y, d=Math.hypot(dx,dy)||1, sp=220+game.level*12;
        game.enemyBullets.push({ x:e.x, y:e.y+e.size*0.4, vx:dx/d*sp, vy:dy/d*sp, size:8 });
    }
    function explode(x,y,color='#ffd84d',count=14) {
        for (let i=0;i<count;i++) {
            const a=Math.random()*Math.PI*2, sp=60+Math.random()*220;
            game.particles.push({ x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:0.6+Math.random()*0.4, age:0, color, size:2+Math.random()*3 });
        }
    }
    function spawnBoss() {
        const size = 130, hp = 30 + game.level*8;
        // Боссы чередуются: Трамп → Путин → Трамп → …
        const bossNum = Math.floor(game.level / 3);
        const type = bossNum % 2 === 1 ? 'trump' : 'putin';
        game.boss = { x:W/2, y:-size, targetY:150, size, type, hp, maxHp:hp, phase:0, patternTimer:1500, pattern:0, entering:true };
    }
    function bossShoot(b) {
        const p = b.pattern % 3;
        if (p===0) {
            const a0=Math.atan2(game.hero.y-b.y, game.hero.x-b.x);
            for (let i=-1;i<=1;i++) { const a=a0+i*0.2, sp=240;
                game.enemyBullets.push({ x:b.x, y:b.y+b.size*0.3, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, size:10 }); }
            b.patternTimer = 700;
        } else if (p===1) {
            const n=12; for (let i=0;i<n;i++) { const a=(i/n)*Math.PI*2;
                game.enemyBullets.push({ x:b.x, y:b.y, vx:Math.cos(a)*170, vy:Math.sin(a)*170, size:8 }); }
            b.patternTimer = 1100;
        } else {
            const a=Math.atan2(game.hero.y-b.y, game.hero.x-b.x);
            game.enemyBullets.push({ x:b.x, y:b.y+b.size*0.3, vx:Math.cos(a)*380, vy:Math.sin(a)*380, size:12 });
            b.patternTimer = 600;
        }
        b.pattern++;
    }
    function updateBoss(dt) {
        const b = game.boss; if (!b) return;
        b.phase += dt;
        if (b.entering) { b.y += 70*dt; if (b.y >= b.targetY) { b.y = b.targetY; b.entering = false; } }
        else {
            b.x = W/2 + Math.sin(b.phase*0.7) * Math.min(W*0.35, 220);
            b.patternTimer -= dt*1000;
            if (b.patternTimer <= 0) bossShoot(b);
        }
        const h = game.hero;
        if (h.invul <= 0 && Math.hypot(h.x-b.x, h.y-b.y) < (h.size+b.size)*0.42) damageHero();
    }
    function damageHero() {
        game.hero.lives--; game.hero.invul = 1.4;
        explode(game.hero.x, game.hero.y, '#7ad0ff', 24);
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        updateHUD();
        if (game.hero.lives <= 0) gameOver();
    }

    function update(dt) {
        for (const s of game.stars) { s.y += s.s*dt; if (s.y > H) { s.y = 0; s.x = Math.random()*W; } }
        if (!game.running) return;
        const h = game.hero;
        if (keys['ArrowLeft']||keys['KeyA']) h.targetX -= 350*dt;
        if (keys['ArrowRight']||keys['KeyD']) h.targetX += 350*dt;
        if (keys['ArrowUp']||keys['KeyW']) h.targetY -= 350*dt;
        if (keys['ArrowDown']||keys['KeyS']) h.targetY += 350*dt;
        h.targetX = Math.max(30, Math.min(W-30, h.targetX));
        h.targetY = Math.max(110, Math.min(H-40, h.targetY));
        h.x += (h.targetX - h.x) * Math.min(1, dt*12);
        h.y += (h.targetY - h.y) * Math.min(1, dt*12);
        if (h.invul > 0) h.invul -= dt;
        h.cooldown -= dt*1000;
        if (h.cooldown <= 0) { heroShoot(); h.cooldown = h.cooldownMax; }
        if (!game.boss) {
            game.spawnTimer -= dt*1000;
            if (game.spawnTimer <= 0) { spawnEnemy(); game.spawnTimer = game.spawnInterval; }
        }
        updateBoss(dt);
        for (let i=game.bullets.length-1;i>=0;i--) { const b=game.bullets[i]; b.y += b.vy*dt; if (b.y < -20) game.bullets.splice(i,1); }
        for (let i=game.enemies.length-1;i>=0;i--) {
            const e=game.enemies[i]; e.phase += dt*2;
            const vx = e.zigzag ? Math.sin(e.phase)*90 : e.vx;
            e.x += vx*dt; e.y += e.vy*dt;
            if (e.x < e.size) e.x = e.size; if (e.x > W-e.size) e.x = W-e.size;
            e.shootTimer -= dt*1000;
            if (e.shootTimer <= 0 && e.y > 40 && e.y < H-200) { enemyShoot(e); e.shootTimer = 1400+Math.random()*1600; }
            if (h.invul <= 0 && Math.hypot(h.x-e.x, h.y-e.y) < (h.size+e.size)*0.45) {
                damageHero(); explode(e.x, e.y, '#ff6644', 20); game.enemies.splice(i,1); continue;
            }
            if (e.y > H+e.size) game.enemies.splice(i,1);
        }
        for (let i=game.enemyBullets.length-1;i>=0;i--) {
            const b=game.enemyBullets[i]; b.x += b.vx*dt; b.y += b.vy*dt;
            if (b.y > H+20 || b.y < -20 || b.x < -20 || b.x > W+20) { game.enemyBullets.splice(i,1); continue; }
            if (h.invul <= 0 && Math.hypot(h.x-b.x, h.y-b.y) < h.size*0.45+b.size) { damageHero(); game.enemyBullets.splice(i,1); }
        }
        for (let i=game.bullets.length-1;i>=0;i--) {
            const b=game.bullets[i]; let hit=false;
            if (game.boss && !game.boss.entering) {
                const B=game.boss;
                if (Math.hypot(b.x-B.x, b.y-B.y) < B.size*0.42+b.size) {
                    B.hp--; game.bullets.splice(i,1); explode(b.x,b.y,'#ffd84d',3);
                    if (B.hp <= 0) {
                        explode(B.x,B.y,'#ff9a1e',50); explode(B.x,B.y,'#ffd84d',30);
                        game.score += 2500*game.level; game.boss = null;
                        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                        updateHUD();
                    }
                    hit=true;
                }
            }
            if (hit) continue;
            for (let j=game.enemies.length-1;j>=0;j--) {
                const e=game.enemies[j];
                if (Math.hypot(b.x-e.x, b.y-e.y) < e.size*0.5+b.size) {
                    e.hp--; game.bullets.splice(i,1); explode(b.x,b.y,'#ffd84d',4);
                    if (e.hp <= 0) {
                        explode(e.x,e.y,'#ff9a1e',18); game.enemies.splice(j,1);
                        game.score += 100*game.level; game.levelKills++;
                        if (game.levelKills >= 8 + game.level*2) {
                            game.level++; game.levelKills = 0;
                            game.spawnInterval = Math.max(380, game.spawnInterval - 90);
                            if (game.level % 3 === 0 && !game.boss) spawnBoss();
                        }
                        updateHUD();
                    }
                    break;
                }
            }
        }
        for (let i=game.particles.length-1;i>=0;i--) {
            const p=game.particles[i]; p.age += dt;
            p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.96; p.vy *= 0.96;
            if (p.age >= p.life) game.particles.splice(i,1);
        }
    }

    function drawStars() {
        ctx.fillStyle = '#fff';
        for (const s of game.stars) { ctx.globalAlpha = Math.min(1, s.r/1.6); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); }
        ctx.globalAlpha = 1;
    }
    function drawHero() {
        const h = game.hero; if (!h) return;
        if (h.invul > 0 && Math.floor(h.invul*12) % 2 === 0) return;
        const c = CHARACTERS[selectedChar];
        const g = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.size);
        g.addColorStop(0, c.glowColor); g.addColorStop(1, 'rgba(120,255,120,0)');
        ctx.fillStyle = g; ctx.fillRect(h.x-h.size, h.y-h.size, h.size*2, h.size*2);
        ctx.fillStyle = c.shipColor;
        ctx.beginPath();
        ctx.moveTo(h.x-h.size*0.55, h.y+h.size*0.35);
        ctx.lineTo(h.x+h.size*0.55, h.y+h.size*0.35);
        ctx.lineTo(h.x+h.size*0.35, h.y+h.size*0.55);
        ctx.lineTo(h.x-h.size*0.35, h.y+h.size*0.55);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff9a1e';
        ctx.beginPath();
        ctx.moveTo(h.x-h.size*0.3, h.y+h.size*0.55);
        ctx.lineTo(h.x-h.size*0.15, h.y+h.size*0.85+Math.random()*6);
        ctx.lineTo(h.x, h.y+h.size*0.55);
        ctx.lineTo(h.x+h.size*0.15, h.y+h.size*0.85+Math.random()*6);
        ctx.lineTo(h.x+h.size*0.3, h.y+h.size*0.55);
        ctx.closePath(); ctx.fill();
        ctx.save();
        ctx.font = `${h.size}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.filter = c.filter;
        ctx.fillText(c.emoji, h.x, h.y-h.size*0.05);
        ctx.restore();
    }
    function drawBullet(b) {
        const c = CHARACTERS[selectedChar];
        if (c.bullet === 'tongue') {
            ctx.fillStyle = '#ff66aa';
            ctx.beginPath(); ctx.ellipse(b.x, b.y, b.size*0.5, b.size, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(b.x, b.y-b.size*0.4, b.size*0.25, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = '#ffd84d';
            ctx.beginPath(); ctx.ellipse(b.x, b.y, b.size*0.55, b.size, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#8a5a2b';
            ctx.beginPath(); ctx.ellipse(b.x, b.y, b.size*0.25, b.size*0.55, 0, 0, Math.PI*2); ctx.fill();
        }
    }
    function drawEnemyBullet(b) {
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(b.x-b.size*0.3, b.y-b.size*0.3, b.size*0.35, 0, Math.PI*2); ctx.fill();
    }
    function drawPutinFace(x,y,s,withCap=false) {
        // Тёмно-серый пиджак
        ctx.fillStyle = '#2f2f2f';
        ctx.beginPath(); ctx.moveTo(x-s*0.5, y+s*0.15); ctx.lineTo(x+s*0.5, y+s*0.15); ctx.lineTo(x+s*0.45, y+s*0.65); ctx.lineTo(x-s*0.45, y+s*0.65); ctx.closePath(); ctx.fill();
        // Красный галстук
        ctx.fillStyle = '#cc0000';
        ctx.beginPath(); ctx.moveTo(x-s*0.09, y+s*0.15); ctx.lineTo(x+s*0.09, y+s*0.15); ctx.lineTo(x+s*0.13, y+s*0.62); ctx.lineTo(x, y+s*0.68); ctx.lineTo(x-s*0.13, y+s*0.62); ctx.closePath(); ctx.fill();
        // Бледное лицо
        ctx.fillStyle = '#e8d0b5';
        ctx.beginPath(); ctx.arc(x, y-s*0.05, s*0.36, 0, Math.PI*2); ctx.fill();
        // Лысина — короткие серые волосы по бокам
        ctx.fillStyle = '#a8a4a0';
        ctx.beginPath();
        ctx.moveTo(x-s*0.36, y-s*0.05);
        ctx.quadraticCurveTo(x-s*0.42, y-s*0.28, x-s*0.18, y-s*0.32);
        ctx.lineTo(x-s*0.18, y-s*0.2);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x+s*0.36, y-s*0.05);
        ctx.quadraticCurveTo(x+s*0.42, y-s*0.28, x+s*0.18, y-s*0.32);
        ctx.lineTo(x+s*0.18, y-s*0.2);
        ctx.closePath(); ctx.fill();
        // Корона/шапка для босса
        if (withCap) {
            ctx.fillStyle = '#7a1818';
            ctx.beginPath();
            ctx.moveTo(x-s*0.42, y-s*0.18);
            ctx.lineTo(x-s*0.42, y-s*0.4);
            ctx.lineTo(x-s*0.22, y-s*0.32);
            ctx.lineTo(x,        y-s*0.5);
            ctx.lineTo(x+s*0.22, y-s*0.32);
            ctx.lineTo(x+s*0.42, y-s*0.4);
            ctx.lineTo(x+s*0.42, y-s*0.18);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffd84d';
            ctx.beginPath(); ctx.arc(x-s*0.22, y-s*0.32, s*0.04, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(x,        y-s*0.5,  s*0.05, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(x+s*0.22, y-s*0.32, s*0.04, 0, Math.PI*2); ctx.fill();
        }
        // Холодные узкие глаза
        ctx.fillStyle = '#000';
        ctx.fillRect(x-s*0.19, y-s*0.08, s*0.11, s*0.025);
        ctx.fillRect(x+s*0.08, y-s*0.08, s*0.11, s*0.025);
        // Поджатые губы
        ctx.beginPath();
        ctx.ellipse(x, y+s*0.09, s*0.07, s*0.015, 0, 0, Math.PI*2);
        ctx.fill();
    }

    function drawTrumpFace(x,y,s,withHair=true,withCap=false) {
        ctx.fillStyle = '#1a2342';
        ctx.beginPath(); ctx.moveTo(x-s*0.5, y+s*0.15); ctx.lineTo(x+s*0.5, y+s*0.15); ctx.lineTo(x+s*0.45, y+s*0.65); ctx.lineTo(x-s*0.45, y+s*0.65); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d32f2f';
        ctx.beginPath(); ctx.moveTo(x-s*0.09, y+s*0.15); ctx.lineTo(x+s*0.09, y+s*0.15); ctx.lineTo(x+s*0.13, y+s*0.62); ctx.lineTo(x, y+s*0.68); ctx.lineTo(x-s*0.13, y+s*0.62); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f4a460';
        ctx.beginPath(); ctx.arc(x, y-s*0.05, s*0.36, 0, Math.PI*2); ctx.fill();
        if (withHair) {
            ctx.fillStyle = '#f4d03f';
            ctx.beginPath();
            ctx.moveTo(x-s*0.4, y-s*0.18);
            ctx.quadraticCurveTo(x-s*0.55, y-s*0.5, x-s*0.05, y-s*0.42);
            ctx.quadraticCurveTo(x+s*0.35, y-s*0.55, x+s*0.45, y-s*0.2);
            ctx.quadraticCurveTo(x+s*0.18, y-s*0.36, x-s*0.2, y-s*0.3);
            ctx.closePath(); ctx.fill();
        }
        if (withCap) {
            ctx.fillStyle = '#cc0000';
            ctx.beginPath(); ctx.moveTo(x-s*0.5, y-s*0.15); ctx.lineTo(x+s*0.5, y-s*0.15); ctx.lineTo(x+s*0.42, y-s*0.08); ctx.lineTo(x-s*0.42, y-s*0.08); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(x-s*0.38, y-s*0.15); ctx.quadraticCurveTo(x, y-s*0.55, x+s*0.38, y-s*0.15); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${s*0.12}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('MAGA', x, y-s*0.3);
        }
        ctx.fillStyle = '#000';
        ctx.fillRect(x-s*0.19, y-s*0.09, s*0.1, s*0.035);
        ctx.fillRect(x+s*0.09, y-s*0.09, s*0.1, s*0.035);
        ctx.beginPath(); ctx.arc(x, y+s*0.08, s*0.06, 0, Math.PI*2); ctx.fill();
    }
    function drawEnemy(e) {
        if (e.type === 'putin') drawPutinFace(e.x, e.y, e.size, false);
        else                    drawTrumpFace(e.x, e.y, e.size, true, false);
        if (e.maxHp > 1) {
            const w = e.size*0.8;
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x-w/2, e.y-e.size*0.55, w, 4);
            ctx.fillStyle = '#4cd964'; ctx.fillRect(e.x-w/2, e.y-e.size*0.55, w*(e.hp/e.maxHp), 4);
        }
    }
    function drawBoss(b) {
        const gl = ctx.createRadialGradient(b.x, b.y, b.size*0.4, b.x, b.y, b.size*1.4);
        gl.addColorStop(0, 'rgba(255,60,60,0.45)'); gl.addColorStop(1, 'rgba(255,60,60,0)');
        ctx.fillStyle = gl; ctx.fillRect(b.x-b.size*1.4, b.y-b.size*1.4, b.size*2.8, b.size*2.8);
        if (b.type === 'putin') drawPutinFace(b.x, b.y, b.size, true);
        else                    drawTrumpFace(b.x, b.y, b.size, false, true);
        if (!b.entering) {
            const barW = Math.min(W*0.7, 420), barH = 12;
            const barX = (W-barW)/2, barY = 64;
            ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = '#ff3b3b'; ctx.fillRect(barX, barY, barW*(b.hp/b.maxHp), barH);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, barH);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(b.type === 'putin' ? 'БОСС: ПУТИН-ЦАРЬ' : 'БОСС: ТРАМП-ИМПЕРАТОР', W/2, barY-6);
        }
    }
    function drawParticles() {
        for (const p of game.particles) {
            ctx.globalAlpha = Math.max(0, 1 - p.age/p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
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
    function loop(now) {
        if (!active) return;
        const dt = Math.min(0.05, (now - game.lastTime)/1000) || 0;
        game.lastTime = now;
        update(dt); render();
        rafId = requestAnimationFrame(loop);
    }

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);

    function start() {
        active = true;
        resize(); initStars();
        canvas.addEventListener('touchstart', onTouch, { passive:false });
        canvas.addEventListener('touchmove', onTouch, { passive:false });
        canvas.addEventListener('mousemove', onMouse);
        canvas.addEventListener('mousedown', onMouse);
        window.addEventListener('keydown', onKeyD);
        window.addEventListener('keyup', onKeyU);
        window.addEventListener('resize', onResize);
        startScreen.classList.remove('hidden');
        overScreen.classList.add('hidden');
        game.running = false;
        game.lastTime = performance.now();
        rafId = requestAnimationFrame(loop);
    }
    function stop() {
        active = false;
        cancelAnimationFrame(rafId);
        canvas.removeEventListener('touchstart', onTouch);
        canvas.removeEventListener('touchmove', onTouch);
        canvas.removeEventListener('mousemove', onMouse);
        canvas.removeEventListener('mousedown', onMouse);
        window.removeEventListener('keydown', onKeyD);
        window.removeEventListener('keyup', onKeyU);
        window.removeEventListener('resize', onResize);
        game.running = false;
    }
    return { start, stop };
})();

// ═══════════════════════════════════════════════════════════
//  МОДУЛЬ 2 — 2048
// ═══════════════════════════════════════════════════════════
games.g2048 = (function() {
    const board     = document.getElementById('g2048Board');
    const scoreEl   = document.getElementById('g2048Score');
    const overEl    = document.getElementById('g2048OverScreen');
    const resultEl  = document.getElementById('g2048Result');
    const finalEl   = document.getElementById('g2048Final');
    const restart1  = document.getElementById('g2048Restart');
    const restart2  = document.getElementById('g2048RestartBtn');

    const SIZE = 4;
    let grid, score, won, over;
    const tiles = new Map();   // id -> {el, value}
    let nextId = 1;

    function buildBackground() {
        board.innerHTML = '';
        for (let i = 0; i < SIZE*SIZE; i++) {
            const c = document.createElement('div');
            c.className = 'g2048-cell';
            board.appendChild(c);
        }
    }

    function newGame() {
        grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        score = 0; won = false; over = false;
        tiles.clear();
        board.querySelectorAll('.g2048-tile').forEach(el => el.remove());
        overEl.classList.add('hidden');
        addRandomTile(); addRandomTile();
        renderTiles();
        updateScore();
    }

    function addRandomTile() {
        const empty = [];
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) empty.push([r,c]);
        if (!empty.length) return false;
        const [r,c] = empty[Math.floor(Math.random()*empty.length)];
        const v = Math.random() < 0.9 ? 2 : 4;
        grid[r][c] = { id: nextId++, value: v };
        return true;
    }

    function positionPercent(r, c) {
        // 4 cells, with 8px gap; each cell width = (100% - 24px)/4 + 8 gap... we use grid-aware calc in CSS via percent
        // Use direct grid coordinates with CSS calc tied to gap
        // Cell occupies (100% / 4) of the inner padded area, with gaps. Simpler: use translate by cell.
        const cellEl = board.children[r*SIZE + c];
        return cellEl;
    }

    function renderTiles() {
        const seen = new Set();
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const cell = grid[r][c];
                if (!cell) continue;
                seen.add(cell.id);
                let entry = tiles.get(cell.id);
                if (!entry) {
                    const el = document.createElement('div');
                    el.className = 'g2048-tile';
                    board.appendChild(el);
                    entry = { el, value: cell.value };
                    tiles.set(cell.id, entry);
                }
                entry.value = cell.value;
                entry.el.dataset.v = cell.value;
                entry.el.textContent = cell.value;
                const target = board.children[r*SIZE + c];
                // Position via absolute placement matching target cell
                entry.el.style.left = target.offsetLeft + 'px';
                entry.el.style.top  = target.offsetTop  + 'px';
                entry.el.style.width  = target.offsetWidth  + 'px';
                entry.el.style.height = target.offsetHeight + 'px';
            }
        }
        // Remove tiles not seen
        for (const [id, entry] of tiles) {
            if (!seen.has(id)) { entry.el.remove(); tiles.delete(id); }
        }
    }

    function updateScore() { scoreEl.textContent = score; }

    function slideRow(row) {
        // Slide left: remove nulls, merge equal pairs
        const filtered = row.filter(x => x);
        const result = [];
        let i = 0;
        let gained = 0;
        while (i < filtered.length) {
            if (i+1 < filtered.length && filtered[i].value === filtered[i+1].value) {
                const merged = { id: nextId++, value: filtered[i].value * 2 };
                result.push(merged);
                gained += merged.value;
                if (merged.value === 2048) won = true;
                i += 2;
            } else {
                result.push(filtered[i]);
                i++;
            }
        }
        while (result.length < SIZE) result.push(null);
        const changed = row.some((c, idx) => (c?.id ?? null) !== (result[idx]?.id ?? null));
        return { row: result, gained, changed };
    }

    function move(dir) {
        if (over) return;
        // Normalize to "slide left" then transform back
        let anyChanged = false, totalGained = 0;
        const get = (r, c) => {
            if (dir === 'left')  return grid[r][c];
            if (dir === 'right') return grid[r][SIZE-1-c];
            if (dir === 'up')    return grid[c][r];
            if (dir === 'down')  return grid[SIZE-1-c][r];
        };
        const set = (r, c, v) => {
            if (dir === 'left')  grid[r][c] = v;
            if (dir === 'right') grid[r][SIZE-1-c] = v;
            if (dir === 'up')    grid[c][r] = v;
            if (dir === 'down')  grid[SIZE-1-c][r] = v;
        };
        for (let r = 0; r < SIZE; r++) {
            const row = []; for (let c = 0; c < SIZE; c++) row.push(get(r, c));
            const { row: newRow, gained, changed } = slideRow(row);
            for (let c = 0; c < SIZE; c++) set(r, c, newRow[c]);
            if (changed) anyChanged = true;
            totalGained += gained;
        }
        if (!anyChanged) return;
        score += totalGained;
        addRandomTile();
        renderTiles();
        updateScore();
        if (tg?.HapticFeedback && totalGained > 0) tg.HapticFeedback.impactOccurred('light');
        if (won && !over) {
            Records.update('g2048', score);
            resultEl.textContent = '🏆 ПОБЕДА! 2048!';
            finalEl.textContent = score;
            overEl.classList.remove('hidden');
            over = true;
            return;
        }
        if (!hasMoves()) {
            const isBest = Records.update('g2048', score);
            resultEl.textContent = isBest ? '🏆 НОВЫЙ РЕКОРД!' : '💀 Игра окончена';
            finalEl.textContent = score;
            overEl.classList.remove('hidden');
            over = true;
        }
    }

    function hasMoves() {
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++) {
                if (!grid[r][c]) return true;
                const v = grid[r][c].value;
                if (c+1 < SIZE && grid[r][c+1]?.value === v) return true;
                if (r+1 < SIZE && grid[r+1][c]?.value === v) return true;
            }
        return false;
    }

    // Свайпы
    let touchStartX = 0, touchStartY = 0;
    const onTouchStart = e => {
        const t = e.touches[0]; touchStartX = t.clientX; touchStartY = t.clientY;
    };
    const onTouchEnd = e => {
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
        const adx = Math.abs(dx), ady = Math.abs(dy);
        if (Math.max(adx, ady) < 24) return;
        if (adx > ady) move(dx > 0 ? 'right' : 'left');
        else           move(dy > 0 ? 'down'  : 'up');
    };
    const onKey = e => {
        if (e.code === 'ArrowLeft')  move('left');
        if (e.code === 'ArrowRight') move('right');
        if (e.code === 'ArrowUp')    move('up');
        if (e.code === 'ArrowDown')  move('down');
    };
    const onResize = () => renderTiles();

    restart1.addEventListener('click', newGame);
    restart2.addEventListener('click', newGame);

    function start() {
        buildBackground();
        // Запуск после layout
        requestAnimationFrame(() => { newGame(); });
        board.addEventListener('touchstart', onTouchStart, { passive:true });
        board.addEventListener('touchend',   onTouchEnd,   { passive:true });
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', onResize);
    }
    function stop() {
        board.removeEventListener('touchstart', onTouchStart);
        board.removeEventListener('touchend',   onTouchEnd);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
    }
    return { start, stop };
})();

// ═══════════════════════════════════════════════════════════
//  МОДУЛЬ 3 — ЗМЕЙКА
// ═══════════════════════════════════════════════════════════
games.snake = (function() {
    const canvas    = document.getElementById('snakeCanvas');
    const ctx       = canvas.getContext('2d');
    const scoreEl   = document.getElementById('snakeScore');
    const overEl    = document.getElementById('snakeOverScreen');
    const finalEl   = document.getElementById('snakeFinal');
    const restartBtn= document.getElementById('snakeRestartBtn');

    const GRID = 15;
    // Типы еды и их параметры
    const FOOD_TYPES = {
        seed:  { points: 1, growth: 1, speedup: 1.5 },
        trump: { points: 3, growth: 1, speedup: 3   },
        putin: { points: 5, growth: 2, speedup: 5   },
    };
    let cell, snake, dir, nextDir, food, score, alive, stepTimer, stepInterval, rafId, lastTime;
    let pendingGrowth = 0;
    let active = false;

    function resize() {
        const size = Math.min(canvas.clientWidth, canvas.clientHeight) || canvas.clientWidth;
        const DPR = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = size * DPR;
        canvas.height = size * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        cell = size / GRID;
    }

    function newGame() {
        const mid = Math.floor(GRID/2);
        snake = [ {x:mid-1,y:mid}, {x:mid-2,y:mid}, {x:mid-3,y:mid} ];
        dir = {x:1,y:0}; nextDir = {x:1,y:0};
        score = 0; alive = true; stepTimer = 0;
        stepInterval = 220;     // существенно медленнее старт
        pendingGrowth = 0;
        placeFood();
        scoreEl.textContent = score;
        overEl.classList.add('hidden');
        lastTime = performance.now();
    }

    function pickFoodType() {
        const r = Math.random();
        if (r < 0.6)  return 'seed';
        if (r < 0.9)  return 'trump';
        return 'putin';
    }

    function placeFood() {
        while (true) {
            const x = Math.floor(Math.random()*GRID);
            const y = Math.floor(Math.random()*GRID);
            if (!snake.some(s => s.x===x && s.y===y)) {
                food = { x, y, type: pickFoodType() };
                return;
            }
        }
    }

    function step() {
        if (nextDir.x !== -dir.x || nextDir.y !== -dir.y) dir = nextDir;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) return die();
        if (snake.some(s => s.x===head.x && s.y===head.y)) return die();
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
            const f = FOOD_TYPES[food.type];
            score += f.points;
            pendingGrowth += f.growth - 1;
            stepInterval = Math.max(80, stepInterval - f.speedup);
            scoreEl.textContent = score;
            placeFood();
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        } else if (pendingGrowth > 0) {
            pendingGrowth--;
        } else {
            snake.pop();
        }
    }

    function die() {
        alive = false;
        finalEl.textContent = score;
        Records.update('snake', score);
        overEl.classList.remove('hidden');
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    }

    function render() {
        const size = canvas.clientWidth;
        ctx.clearRect(0, 0, size, size);

        // Сетка едва видимая
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let i = 1; i < GRID; i++) {
            ctx.beginPath(); ctx.moveTo(i*cell, 0); ctx.lineTo(i*cell, size); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i*cell); ctx.lineTo(size, i*cell); ctx.stroke();
        }

        // Еда
        const fx = food.x*cell + cell/2;
        const fy = food.y*cell + cell/2;
        if (food.type === 'seed') {
            ctx.fillStyle = '#ffd84d';
            ctx.beginPath();
            ctx.ellipse(fx, fy, cell*0.32, cell*0.42, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#8a5a2b';
            ctx.beginPath();
            ctx.ellipse(fx, fy, cell*0.14, cell*0.22, 0, 0, Math.PI*2);
            ctx.fill();
        } else if (food.type === 'trump') {
            drawMiniTrump(fx, fy, cell*0.9);
        } else {
            drawMiniPutin(fx, fy, cell*0.9);
        }

        // Хвост
        for (let i = snake.length-1; i > 0; i--) {
            const s = snake[i];
            const t = 1 - i/snake.length;
            ctx.fillStyle = `rgb(${74 + t*40}, ${205 + t*30}, ${100})`;
            roundRect(s.x*cell+1, s.y*cell+1, cell-2, cell-2, cell*0.22);
            ctx.fill();
        }

        // Голова — хомяк
        const h = snake[0];
        ctx.save();
        ctx.font = `${cell*0.95}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.filter = 'hue-rotate(90deg) saturate(1.6)';
        ctx.fillText('🐹', h.x*cell + cell/2, h.y*cell + cell/2);
        ctx.restore();
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x+r, y);
        ctx.arcTo(x+w, y,   x+w, y+h, r);
        ctx.arcTo(x+w, y+h, x,   y+h, r);
        ctx.arcTo(x,   y+h, x,   y,   r);
        ctx.arcTo(x,   y,   x+w, y,   r);
        ctx.closePath();
    }

    function drawMiniTrump(x, y, s) {
        // Лицо
        ctx.fillStyle = '#f4a460';
        ctx.beginPath(); ctx.arc(x, y, s*0.42, 0, Math.PI*2); ctx.fill();
        // Жёлтая шевелюра
        ctx.fillStyle = '#f4d03f';
        ctx.beginPath();
        ctx.moveTo(x - s*0.45, y - s*0.1);
        ctx.quadraticCurveTo(x - s*0.3, y - s*0.55, x + s*0.1, y - s*0.45);
        ctx.quadraticCurveTo(x + s*0.5, y - s*0.5, x + s*0.45, y - s*0.15);
        ctx.quadraticCurveTo(x + s*0.1, y - s*0.3, x - s*0.45, y - s*0.1);
        ctx.closePath(); ctx.fill();
        // Глаза
        ctx.fillStyle = '#000';
        ctx.fillRect(x - s*0.18, y - s*0.05, s*0.1, s*0.04);
        ctx.fillRect(x + s*0.08, y - s*0.05, s*0.1, s*0.04);
        // Рот (буква О)
        ctx.beginPath(); ctx.arc(x, y + s*0.18, s*0.08, 0, Math.PI*2); ctx.fill();
    }

    function drawMiniPutin(x, y, s) {
        // Бледное лицо
        ctx.fillStyle = '#e8d0b5';
        ctx.beginPath(); ctx.arc(x, y, s*0.42, 0, Math.PI*2); ctx.fill();
        // Серые «крылья» волос по бокам (лысина сверху)
        ctx.fillStyle = '#a8a4a0';
        ctx.beginPath();
        ctx.moveTo(x - s*0.42, y);
        ctx.quadraticCurveTo(x - s*0.5, y - s*0.3, x - s*0.2, y - s*0.4);
        ctx.lineTo(x - s*0.2, y - s*0.2);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + s*0.42, y);
        ctx.quadraticCurveTo(x + s*0.5, y - s*0.3, x + s*0.2, y - s*0.4);
        ctx.lineTo(x + s*0.2, y - s*0.2);
        ctx.closePath(); ctx.fill();
        // Узкие холодные глаза
        ctx.fillStyle = '#000';
        ctx.fillRect(x - s*0.18, y - s*0.04, s*0.11, s*0.025);
        ctx.fillRect(x + s*0.07, y - s*0.04, s*0.11, s*0.025);
        // Тонкие губы
        ctx.beginPath();
        ctx.ellipse(x, y + s*0.18, s*0.09, s*0.018, 0, 0, Math.PI*2);
        ctx.fill();
    }

    function loop(now) {
        if (!active) return;
        const dt = (now - lastTime); lastTime = now;
        if (alive) {
            stepTimer += dt;
            while (stepTimer >= stepInterval) { step(); stepTimer -= stepInterval; if (!alive) break; }
        }
        render();
        rafId = requestAnimationFrame(loop);
    }

    // Свайпы
    let sx=0, sy=0;
    const onTouchStart = e => { e.preventDefault(); const t=e.touches[0]; sx=t.clientX; sy=t.clientY; };
    const onTouchMove  = e => { e.preventDefault(); };
    const onTouchEnd   = e => {
        e.preventDefault();
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        const adx = Math.abs(dx), ady = Math.abs(dy);
        if (Math.max(adx, ady) < 20) return;
        if (adx > ady) nextDir = { x: dx > 0 ? 1 : -1, y: 0 };
        else            nextDir = { x: 0, y: dy > 0 ? 1 : -1 };
    };
    const onKey = e => {
        if (e.code === 'ArrowLeft'  || e.code === 'KeyA') nextDir = {x:-1,y:0};
        if (e.code === 'ArrowRight' || e.code === 'KeyD') nextDir = {x:1, y:0};
        if (e.code === 'ArrowUp'    || e.code === 'KeyW') nextDir = {x:0, y:-1};
        if (e.code === 'ArrowDown'  || e.code === 'KeyS') nextDir = {x:0, y:1};
    };
    const onResize = () => { resize(); };

    restartBtn.addEventListener('click', () => newGame());

    function start() {
        active = true;
        requestAnimationFrame(() => { resize(); newGame(); lastTime = performance.now(); rafId = requestAnimationFrame(loop); });
        canvas.addEventListener('touchstart', onTouchStart, { passive:false });
        canvas.addEventListener('touchmove',  onTouchMove,  { passive:false });
        canvas.addEventListener('touchend',   onTouchEnd,   { passive:false });
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', onResize);
    }
    function stop() {
        active = false;
        cancelAnimationFrame(rafId);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove',  onTouchMove);
        canvas.removeEventListener('touchend',   onTouchEnd);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
    }
    return { start, stop };
})();

// ═══════════════════════════════════════════════════════════
//  МОДУЛЬ 4 — РАННЕР
// ═══════════════════════════════════════════════════════════
games.runner = (function() {
    const canvas      = document.getElementById('runnerCanvas');
    const ctx         = canvas.getContext('2d');
    const scoreEl     = document.getElementById('runnerScore');
    const startScreen = document.getElementById('runnerStartScreen');
    const overScreen  = document.getElementById('runnerOverScreen');
    const startBtn    = document.getElementById('runnerStartBtn');
    const restartBtn  = document.getElementById('runnerRestartBtn');
    const finalEl     = document.getElementById('runnerFinal');

    let W=0, H=0, DPR=1, rafId=0, active=false, lastTime=0;
    let hero, obstacles, clouds, groundOffset, distance, speed, alive, started, spawnTimer;

    const GROUND_H = 90;
    const GRAVITY  = 2200;
    const JUMP_V   = -800;

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        canvas.width = W*DPR; canvas.height = H*DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function groundY() { return H - GROUND_H; }
    function newGame() {
        hero = { x: 80, y: groundY()-50, w: 56, h: 56, vy: 0, onGround: true, jumps: 0 };
        obstacles = [];
        clouds = [];
        for (let i = 0; i < 4; i++) clouds.push({ x: Math.random()*W, y: 40+Math.random()*120, s: 30+Math.random()*40, v: 20+Math.random()*30 });
        groundOffset = 0; distance = 0; speed = 360; alive = true; started = true; spawnTimer = 1200;
        overScreen.classList.add('hidden');
        startScreen.classList.add('hidden');
        scoreEl.textContent = 0;
    }
    function jump() {
        if (!started) return startGame();
        if (!alive) return;
        if (hero.jumps < 2) {
            hero.vy = hero.jumps === 0 ? JUMP_V : JUMP_V * 0.85;
            hero.onGround = false;
            hero.jumps++;
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        }
    }
    function startGame() { newGame(); }
    function die() {
        alive = false;
        const dist = Math.floor(distance);
        finalEl.textContent = dist;
        Records.update('runner', dist);
        overScreen.classList.remove('hidden');
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    }

    function spawnObstacle() {
        const tall = Math.random() < 0.3;
        const w = 44, h = tall ? 80 : 56;
        obstacles.push({ x: W + 20, y: groundY() - h, w, h });
    }

    function update(dt) {
        // Облака всегда
        for (const c of clouds) {
            c.x -= c.v * dt;
            if (c.x + c.s*2 < 0) { c.x = W + c.s; c.y = 40+Math.random()*120; }
        }
        if (!started || !alive) return;
        // Земля скроллится
        groundOffset = (groundOffset + speed * dt) % 40;
        distance += speed * dt / 30;
        speed = Math.min(720, speed + 6*dt);
        scoreEl.textContent = Math.floor(distance);

        // Герой
        hero.vy += GRAVITY * dt;
        hero.y  += hero.vy * dt;
        if (hero.y + hero.h >= groundY()) {
            hero.y = groundY() - hero.h;
            hero.vy = 0;
            hero.onGround = true;
            hero.jumps = 0;
        }

        // Препятствия
        spawnTimer -= dt * 1000;
        if (spawnTimer <= 0) {
            spawnObstacle();
            spawnTimer = Math.max(550, 1200 - speed*0.6);
        }
        for (let i = obstacles.length-1; i >= 0; i--) {
            const o = obstacles[i];
            o.x -= speed * dt;
            if (o.x + o.w < 0) { obstacles.splice(i, 1); continue; }
            // Столкновение AABB
            if (hero.x + hero.w*0.85 > o.x + 4 &&
                hero.x + hero.w*0.15 < o.x + o.w - 4 &&
                hero.y + hero.h > o.y + 6) {
                die();
            }
        }
    }

    function drawClouds() {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (const c of clouds) {
            ctx.beginPath();
            ctx.arc(c.x,         c.y, c.s*0.5, 0, Math.PI*2);
            ctx.arc(c.x+c.s*0.4, c.y-c.s*0.15, c.s*0.45, 0, Math.PI*2);
            ctx.arc(c.x+c.s*0.8, c.y, c.s*0.4, 0, Math.PI*2);
            ctx.fill();
        }
    }
    function drawGround() {
        // тёмная полоса
        ctx.fillStyle = '#2d4a1f';
        ctx.fillRect(0, groundY(), W, GROUND_H);
        // Полоска травы
        ctx.fillStyle = '#4a7a2a';
        ctx.fillRect(0, groundY(), W, 8);
        // Штриховка движения
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let x = -groundOffset; x < W; x += 40) ctx.fillRect(x, groundY()+22, 20, 4);
    }
    function drawHero() {
        // Тень
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(hero.x + hero.w/2, groundY()-2, hero.w*0.4, 4, 0, 0, Math.PI*2);
        ctx.fill();
        // Хомяк
        ctx.save();
        ctx.font = `${hero.h}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.filter = 'hue-rotate(90deg) saturate(1.6) drop-shadow(0 2px 4px rgba(0,0,0,0.4))';
        ctx.fillText('🐹', hero.x + hero.w/2, hero.y + hero.h/2);
        ctx.restore();
    }
    function drawObstacles() {
        for (const o of obstacles) {
            // Трамп-препятствие
            const x = o.x + o.w/2;
            const y = o.y + o.h/2;
            // Тулово (синий пиджак)
            ctx.fillStyle = '#1a2342';
            ctx.fillRect(o.x, o.y + o.h*0.4, o.w, o.h*0.6);
            // Галстук
            ctx.fillStyle = '#d32f2f';
            ctx.beginPath();
            ctx.moveTo(x-3, o.y + o.h*0.4);
            ctx.lineTo(x+3, o.y + o.h*0.4);
            ctx.lineTo(x+5, o.y + o.h*0.95);
            ctx.lineTo(x,   o.y + o.h);
            ctx.lineTo(x-5, o.y + o.h*0.95);
            ctx.closePath(); ctx.fill();
            // Лицо
            ctx.fillStyle = '#f4a460';
            ctx.beginPath();
            ctx.arc(x, o.y + o.h*0.25, o.w*0.42, 0, Math.PI*2);
            ctx.fill();
            // Волосы
            ctx.fillStyle = '#f4d03f';
            ctx.beginPath();
            ctx.moveTo(x - o.w*0.45, o.y + o.h*0.15);
            ctx.quadraticCurveTo(x, o.y - o.h*0.05, x + o.w*0.5, o.y + o.h*0.15);
            ctx.quadraticCurveTo(x, o.y + o.h*0.05, x - o.w*0.45, o.y + o.h*0.15);
            ctx.closePath(); ctx.fill();
            // Глаза + рот
            ctx.fillStyle = '#000';
            ctx.fillRect(x - o.w*0.22, o.y + o.h*0.22, o.w*0.12, 3);
            ctx.fillRect(x + o.w*0.1,  o.y + o.h*0.22, o.w*0.12, 3);
            ctx.beginPath(); ctx.arc(x, o.y + o.h*0.36, 4, 0, Math.PI*2); ctx.fill();
        }
    }

    function render() {
        ctx.clearRect(0, 0, W, H);
        drawClouds();
        drawGround();
        drawObstacles();
        if (started) drawHero();
    }

    function loop(now) {
        if (!active) return;
        const dt = Math.min(0.05, (now - lastTime)/1000) || 0;
        lastTime = now;
        update(dt); render();
        rafId = requestAnimationFrame(loop);
    }

    const onTap = e => { e.preventDefault(); jump(); };
    const onKey = e => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); jump(); } };
    const onResize = () => resize();

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);

    function start() {
        active = true;
        resize();
        hero = null; obstacles = []; clouds = [];
        for (let i = 0; i < 4; i++) clouds.push({ x: Math.random()*W, y: 40+Math.random()*120, s: 30+Math.random()*40, v: 20+Math.random()*30 });
        groundOffset = 0; distance = 0; speed = 360; alive = false; started = false;
        startScreen.classList.remove('hidden');
        overScreen.classList.add('hidden');
        canvas.addEventListener('touchstart', onTap, { passive:false });
        canvas.addEventListener('mousedown', onTap);
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', onResize);
        lastTime = performance.now();
        rafId = requestAnimationFrame(loop);
    }
    function stop() {
        active = false;
        cancelAnimationFrame(rafId);
        canvas.removeEventListener('touchstart', onTap);
        canvas.removeEventListener('mousedown', onTap);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
    }
    return { start, stop };
})();

// ═══════════════════════════════════════════════════════════
//  МОДУЛЬ 5 — ДУРАК (2-6 игроков, ты + 1-5 ботов)
// ═══════════════════════════════════════════════════════════
games.durak = (function() {
    const opponentsEl = document.getElementById('durakOpponents');
    const deckPileEl = document.getElementById('durakDeckPile');
    const deckCountEl = document.getElementById('durakDeckCount');
    const trumpSlotEl = document.getElementById('durakTrumpSlot');
    const tableEl     = document.getElementById('durakTable');
    const handEl      = document.getElementById('durakHand');
    const actionsEl   = document.getElementById('durakActions');
    const statusEl    = document.getElementById('durakStatus');
    const configEl    = document.getElementById('durakConfigScreen');
    const overEl      = document.getElementById('durakOverScreen');
    const resultEl    = document.getElementById('durakResult');
    const resultMsgEl = document.getElementById('durakResultMsg');
    const restartBtn  = document.getElementById('durakRestartBtn');
    const startBtn    = document.getElementById('durakStartBtn');
    const playersPick = document.getElementById('durakPlayersPick');
    const botsCountEl = document.getElementById('durakBotsCount');

    const SUITS = ['♠','♥','♦','♣'];
    const RANKS = ['6','7','8','9','10','В','Д','К','Т'];  // классическая колода 36 карт
    const VAL = { '6':6,'7':7,'8':8,'9':9,'10':10,'В':11,'Д':12,'К':13,'Т':14 };
    const RED = new Set(['♥','♦']);
    const BOTS = [
        { name:'Хомяк',  avatar:'🐹' },
        { name:'Жаба',   avatar:'🐸' },
        { name:'Кот',    avatar:'🐱' },
        { name:'Лис',    avatar:'🦊' },
        { name:'Барсук', avatar:'🦡' },
    ];

    let state = null;
    let active = false;
    let timeoutId = null;
    let selectedCount = parseInt(localStorage.getItem('durakPlayers') || '2', 10);
    if (selectedCount < 2 || selectedCount > 6) selectedCount = 2;

    function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random()*(i+1));
            [a[i], a[j]] = [a[j], a[i]];
        }
    }
    function freshDeck() {
        const d = [];
        for (const s of SUITS) for (const r of RANKS) d.push({ suit:s, rank:r });
        return d;
    }
    function canBeat(att, def, trump) {
        if (def.suit === trump && att.suit !== trump) return true;
        if (def.suit === att.suit && VAL[def.rank] > VAL[att.rank]) return true;
        return false;
    }
    function weight(c, trump) { return (c.suit === trump ? 100 : 0) + VAL[c.rank]; }
    function tableRanks() {
        const r = new Set();
        for (const p of state.table) { r.add(p.att.rank); if (p.def) r.add(p.def.rank); }
        return r;
    }
    function nextActiveIdx(fromIdx) {
        const n = state.players.length;
        for (let i = 1; i <= n; i++) {
            const idx = (fromIdx + i) % n;
            if (!state.players[idx].eliminated) return idx;
        }
        return -1;
    }

    function newGame(count) {
        selectedCount = count;
        localStorage.setItem('durakPlayers', String(count));
        const deck = freshDeck();
        shuffle(deck);
        const trumpCard = deck[deck.length - 1];
        const trump = trumpCard.suit;

        const players = [];
        players.push({ id:0, name:'Ты', avatar:'🧑', isHuman:true, hand:[], eliminated:false });
        for (let i = 0; i < count - 1; i++) {
            const b = BOTS[i];
            players.push({ id:i+1, name:b.name, avatar:b.avatar, isHuman:false, hand:[], eliminated:false });
        }
        // Раздаём по 6 карт по кругу
        for (let i = 0; i < 6; i++) {
            for (const p of players) {
                if (deck.length > 0) p.hand.push(deck.shift());
            }
        }
        // Первый атакующий = младший козырь
        let attackerIdx = 0, lowestVal = 999;
        for (let i = 0; i < players.length; i++) {
            const trumps = players[i].hand.filter(c => c.suit === trump);
            if (!trumps.length) continue;
            const m = Math.min(...trumps.map(c => VAL[c.rank]));
            if (m < lowestVal) { lowestVal = m; attackerIdx = i; }
        }
        const defenderIdx = (attackerIdx + 1) % players.length;

        state = {
            players, deck, trump, trumpCard,
            table: [],
            attackerIdx, defenderIdx,
            phase: 'play', turnIdx: attackerIdx,
            passes: new Set(),
            loser: null,
        };
        configEl.classList.add('hidden');
        overEl.classList.add('hidden');
        render();
        if (!players[attackerIdx].isHuman) schedule(aiAct, 700);
    }

    function canPlayAttack(playerIdx) {
        if (playerIdx === state.defenderIdx) return false;
        const p = state.players[playerIdx];
        if (p.eliminated || p.hand.length === 0) return false;
        if (state.table.length === 0) return playerIdx === state.attackerIdx;
        if (state.table.length >= 6) return false;
        const undef = state.table.filter(t => !t.def).length;
        const defLeft = state.players[state.defenderIdx].hand.length;
        if (undef >= defLeft) return false;
        const ranks = tableRanks();
        return p.hand.some(c => ranks.has(c.rank));
    }

    function nextPlayTurn() {
        const n = state.players.length;
        for (let step = 0; step < n; step++) {
            const idx = (state.attackerIdx + step) % n;
            if (idx === state.defenderIdx) continue;
            if (state.players[idx].eliminated) continue;
            if (state.passes.has(idx)) continue;
            if (!canPlayAttack(idx)) { state.passes.add(idx); continue; }
            state.turnIdx = idx;
            render();
            if (!state.players[idx].isHuman) schedule(aiAct, 700);
            return;
        }
        finishRound(false);
    }

    function play(playerIdx, card) {
        if (!canPlayAttack(playerIdx)) return;
        const p = state.players[playerIdx];
        const ci = p.hand.indexOf(card);
        if (ci < 0) return;
        p.hand.splice(ci, 1);
        state.table.push({ att: card, def: null });
        state.passes = new Set();
        state.phase = 'defend';
        state.turnIdx = state.defenderIdx;
        render();
        if (!state.players[state.defenderIdx].isHuman) schedule(aiAct, 700);
    }

    function pass(playerIdx) {
        if (state.phase !== 'play') return;
        if (state.turnIdx !== playerIdx) return;
        state.passes.add(playerIdx);
        nextPlayTurn();
    }

    function defend(playerIdx, card) {
        if (state.phase !== 'defend') return;
        if (playerIdx !== state.defenderIdx) return;
        const target = state.table.find(t => !t.def);
        if (!target) return;
        if (!canBeat(target.att, card, state.trump)) return;
        const hand = state.players[playerIdx].hand;
        const ci = hand.indexOf(card);
        if (ci < 0) return;
        hand.splice(ci, 1);
        target.def = card;
        state.phase = 'play';
        state.passes = new Set();
        nextPlayTurn();
    }

    function take(playerIdx) {
        if (state.phase !== 'defend') return;
        if (playerIdx !== state.defenderIdx) return;
        finishRound(true);
    }

    function finishRound(taken) {
        if (taken) {
            for (const t of state.table) {
                state.players[state.defenderIdx].hand.push(t.att);
                if (t.def) state.players[state.defenderIdx].hand.push(t.def);
            }
        }
        state.table = [];

        // Добор: атакующий первым, защитник последним
        const refillOrder = [];
        const n = state.players.length;
        for (let i = 0; i < n; i++) {
            const idx = (state.attackerIdx + i) % n;
            if (idx === state.defenderIdx) continue;
            if (!state.players[idx].eliminated) refillOrder.push(idx);
        }
        if (!state.players[state.defenderIdx].eliminated) refillOrder.push(state.defenderIdx);
        for (const idx of refillOrder) {
            while (state.players[idx].hand.length < 6 && state.deck.length > 0) {
                state.players[idx].hand.push(state.deck.shift());
            }
        }

        // Выходят те, у кого 0 карт и колода пуста
        if (state.deck.length === 0) {
            for (const p of state.players) {
                if (!p.eliminated && p.hand.length === 0) p.eliminated = true;
            }
        }

        const remaining = state.players.filter(p => !p.eliminated);
        if (remaining.length <= 1) {
            state.loser = remaining.length === 1 ? remaining[0].id : null;
            state.phase = 'over';
            endGame();
            return;
        }

        // Назначаем атакующего и защитника
        if (taken) {
            const newAtt = nextActiveIdx(state.defenderIdx);
            state.attackerIdx = newAtt;
            state.defenderIdx = nextActiveIdx(newAtt);
        } else {
            let na = state.defenderIdx;
            if (state.players[na].eliminated) na = nextActiveIdx(na);
            state.attackerIdx = na;
            state.defenderIdx = nextActiveIdx(na);
        }

        state.phase = 'play';
        state.passes = new Set();
        state.turnIdx = state.attackerIdx;
        render();
        if (!state.players[state.attackerIdx].isHuman) schedule(aiAct, 700);
    }

    function endGame() {
        if (state.loser === 0) {
            resultEl.textContent = '💀 Ты дурак';
            resultMsgEl.textContent = 'Не повезло в этот раз.';
        } else if (state.loser === null) {
            resultEl.textContent = '🤝 Ничья';
            resultMsgEl.textContent = 'Все вышли одновременно.';
        } else {
            const loser = state.players.find(p => p.id === state.loser);
            resultEl.textContent = '🏆 ПОБЕДА!';
            resultMsgEl.textContent = `Дурак — ${loser.avatar} ${loser.name}.`;
            const prev = Records.load().durak || 0;
            Records.update('durak', prev + 1);
        }
        overEl.classList.remove('hidden');
    }

    function aiAct() {
        if (!active || !state || state.phase === 'over') return;
        const idx = state.phase === 'defend' ? state.defenderIdx : state.turnIdx;
        if (idx < 0) return;
        const p = state.players[idx];
        if (p.isHuman) return;
        if (state.phase === 'play') aiPlay(idx);
        else if (state.phase === 'defend') aiDefend(idx);
    }

    function aiPlay(idx) {
        if (!canPlayAttack(idx)) { pass(idx); return; }
        const p = state.players[idx];
        let card;
        if (state.table.length === 0) {
            const sorted = [...p.hand].sort((a,b) => weight(a, state.trump) - weight(b, state.trump));
            card = sorted[0];
        } else {
            const ranks = tableRanks();
            const matching = p.hand.filter(c => ranks.has(c.rank));
            if (!matching.length) { pass(idx); return; }
            matching.sort((a,b) => weight(a, state.trump) - weight(b, state.trump));
            card = matching[0];
        }
        play(idx, card);
    }

    function aiDefend(idx) {
        const target = state.table.find(t => !t.def);
        if (!target) return;
        const p = state.players[idx];
        const cand = p.hand
            .filter(c => canBeat(target.att, c, state.trump))
            .sort((a,b) => weight(a, state.trump) - weight(b, state.trump));
        if (cand.length === 0) { take(idx); return; }
        defend(idx, cand[0]);
    }

    function makeCardEl(card) {
        const div = document.createElement('div');
        div.className = 'card';
        div.dataset.color = RED.has(card.suit) ? 'red' : 'black';
        div.innerHTML = `
            <div class="card-rank">${card.rank}</div>
            <div class="card-suit-small">${card.suit}</div>
            <div class="card-suit-big">${card.suit}</div>`;
        return div;
    }

    function render() {
        const currentTurnIdx = state.phase === 'defend' ? state.defenderIdx : state.turnIdx;
        const myTurn = !state.players[0].eliminated && state.phase !== 'over' && (
            (state.phase === 'play'   && state.turnIdx === 0) ||
            (state.phase === 'defend' && state.defenderIdx === 0)
        );

        // Оппоненты
        opponentsEl.innerHTML = '';
        for (let i = 1; i < state.players.length; i++) {
            const p = state.players[i];
            const block = document.createElement('div');
            block.className = 'opp';
            if (p.eliminated) block.classList.add('eliminated');
            if (!p.eliminated && state.phase !== 'over') {
                if (i === state.attackerIdx) block.classList.add('attacker');
                if (i === state.defenderIdx) block.classList.add('defender');
                if (i === currentTurnIdx)    block.classList.add('turn-now');
            }
            const header = document.createElement('div');
            header.className = 'opp-name';
            header.textContent = `${p.avatar} ${p.name}`;
            const cards = document.createElement('div');
            cards.className = 'opp-cards';
            const visible = Math.min(p.hand.length, 6);
            for (let j = 0; j < visible; j++) {
                const m = document.createElement('div');
                m.className = 'card-mini';
                cards.appendChild(m);
            }
            const cnt = document.createElement('div');
            cnt.className = 'opp-count';
            cnt.textContent = p.eliminated ? '✓ вышел' : `${p.hand.length} карт`;
            block.append(header, cards, cnt);
            opponentsEl.appendChild(block);
        }

        // Колода + козырь
        trumpSlotEl.innerHTML = '';
        if (state.deck.length > 0) {
            trumpSlotEl.appendChild(makeCardEl(state.trumpCard));
            deckPileEl.style.display = '';
            deckCountEl.textContent = state.deck.length;
        } else {
            deckPileEl.style.display = 'none';
            const ind = document.createElement('div');
            ind.className = 'trump-indicator';
            ind.dataset.color = RED.has(state.trump) ? 'red' : 'black';
            ind.textContent = state.trump;
            trumpSlotEl.appendChild(ind);
        }

        // Стол
        const hint = tableEl.querySelector('.table-hint');
        tableEl.innerHTML = '';
        if (state.table.length === 0 && hint) tableEl.appendChild(hint);
        for (const pair of state.table) {
            const wrap = document.createElement('div');
            wrap.className = 'table-pair';
            const att = makeCardEl(pair.att);
            att.classList.add('att');
            wrap.appendChild(att);
            if (pair.def) {
                const def = makeCardEl(pair.def);
                def.classList.add('def');
                wrap.appendChild(def);
            }
            tableEl.appendChild(wrap);
        }

        // Рука игрока
        handEl.innerHTML = '';
        const human = state.players[0];
        const isPlayable = makePlayabilityChecker();
        const sorted = [...human.hand].sort((a, b) => weight(a, state.trump) - weight(b, state.trump));
        for (const c of sorted) {
            const el = makeCardEl(c);
            if (isPlayable(c)) {
                el.classList.add('playable');
                el.addEventListener('click', () => onHumanCardClick(c));
            }
            handEl.appendChild(el);
        }

        // Кнопки действия
        actionsEl.innerHTML = '';
        if (state.phase === 'play' && state.turnIdx === 0 && !human.eliminated) {
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            // Пас только если не главный атакующий с пустым столом
            if (state.table.length === 0) {
                btn.textContent = '— атакуй';
                btn.disabled = true;
            } else {
                btn.textContent = 'Пас';
                btn.addEventListener('click', () => pass(0));
            }
            actionsEl.appendChild(btn);
        }
        if (state.phase === 'defend' && state.defenderIdx === 0 && !human.eliminated) {
            const btn = document.createElement('button');
            btn.className = 'action-btn danger';
            btn.textContent = 'Беру';
            btn.addEventListener('click', () => take(0));
            actionsEl.appendChild(btn);
        }

        // Статус
        let status = '—';
        if (state.phase === 'over') status = '—';
        else if (state.phase === 'play') {
            const t = state.turnIdx;
            if (t === 0) status = state.table.length === 0 ? 'Твой ход' : 'Можешь подкинуть';
            else status = `Ход ${state.players[t].name}…`;
        } else if (state.phase === 'defend') {
            const d = state.defenderIdx;
            if (d === 0) status = 'Защищайся';
            else status = `${state.players[d].name} защищается…`;
        }
        statusEl.textContent = status;

        // Подсветка «твой ход» вокруг зоны игрока
        const playerZone = handEl.parentElement;
        if (playerZone) playerZone.classList.toggle('your-turn', myTurn);
    }

    function makePlayabilityChecker() {
        const human = state.players[0];
        if (human.eliminated) return () => false;
        if (state.phase === 'play' && state.turnIdx === 0) {
            const ranks = tableRanks();
            const undef = state.table.filter(t => !t.def).length;
            const defLeft = state.players[state.defenderIdx].hand.length;
            return (card) => {
                if (state.table.length === 0) return true;
                if (state.table.length >= 6) return false;
                if (undef >= defLeft) return false;
                return ranks.has(card.rank);
            };
        }
        if (state.phase === 'defend' && state.defenderIdx === 0) {
            const target = state.table.find(t => !t.def);
            if (!target) return () => false;
            return (card) => canBeat(target.att, card, state.trump);
        }
        return () => false;
    }

    function onHumanCardClick(card) {
        if (!state || state.phase === 'over') return;
        if (state.phase === 'play' && state.turnIdx === 0) play(0, card);
        else if (state.phase === 'defend' && state.defenderIdx === 0) defend(0, card);
    }

    function schedule(fn, ms) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => { timeoutId = null; fn(); }, ms);
    }

    // Селектор количества игроков
    function refreshPick() {
        playersPick.querySelectorAll('.players-btn').forEach(btn => {
            btn.classList.toggle('selected', parseInt(btn.dataset.n, 10) === selectedCount);
        });
        botsCountEl.textContent = selectedCount - 1;
    }
    playersPick.querySelectorAll('.players-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedCount = parseInt(btn.dataset.n, 10);
            refreshPick();
        });
    });
    startBtn.addEventListener('click', () => newGame(selectedCount));
    restartBtn.addEventListener('click', () => {
        overEl.classList.add('hidden');
        configEl.classList.remove('hidden');
        refreshPick();
    });

    function start() {
        active = true;
        configEl.classList.remove('hidden');
        overEl.classList.add('hidden');
        refreshPick();
    }
    function stop() {
        active = false;
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
    }
    return { start, stop };
})();

// ═══════════════════════════════════════════════════════════
//  МОДУЛЬ 6 — РЕКОРДЫ
// ═══════════════════════════════════════════════════════════
games.records = (function() {
    const nameEl = document.getElementById('recordsName');
    const listEl = document.getElementById('recordsList');
    const GAMES = [
        { id: 'shooter', icon: '🚀', name: 'Космический бой', suffix: 'оч.' },
        { id: 'g2048',   icon: '🔢', name: '2048',           suffix: 'оч.' },
        { id: 'snake',   icon: '🐍', name: 'Змейка',         suffix: 'оч.' },
        { id: 'runner',  icon: '🏃', name: 'Раннер',         suffix: 'м'   },
        { id: 'durak',   icon: '🃏', name: 'Дурак',          suffix: 'побед' },
    ];
    function render() {
        nameEl.textContent = Records.getName();
        const r = Records.load();
        listEl.innerHTML = '';
        for (const g of GAMES) {
            const row = document.createElement('div');
            row.className = 'records-row';
            const score = r[g.id];
            row.innerHTML = `
                <div class="rec-icon">${g.icon}</div>
                <div class="rec-name">${g.name}</div>
                <div class="rec-score">${score ? score + ' ' + g.suffix : '—'}</div>
            `;
            listEl.appendChild(row);
        }
    }
    function start() { render(); }
    function stop() {}
    return { start, stop };
})();

// ─── Старт на хабе ─────────────────────────────────────────
showScreen('hub');
