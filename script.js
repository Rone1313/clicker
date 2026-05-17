// === Telegram WebApp init ===
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor('secondary_bg_color'); } catch (e) {}
}

// === State ===
const SAVE_KEY = 'clicker_save';

const defaultState = {
    coins: 0,
    tapLevel: 0,        // "Сильный палец": +1 за тап на уровень
    autoLevel: 0,       // "Автокликер": +1 монета/сек на уровень
    boostUses: 0,       // Сколько раз покупали "Бустер x2"
    boostUntil: 0       // timestamp окончания бустера (мс)
};

const BASE_PRICE = {
    tap: 50,
    auto: 200,
    boost: 500
};

const PRICE_MULT = {
    tap: 1.5,
    auto: 1.7,
    boost: 1.0 // постоянная цена
};

let state = loadState();

function loadState() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return { ...defaultState };
        const parsed = JSON.parse(raw);
        return { ...defaultState, ...parsed };
    } catch (e) {
        return { ...defaultState };
    }
}

function saveState() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {}
}

// === Pricing ===
function priceTap() {
    return Math.floor(BASE_PRICE.tap * Math.pow(PRICE_MULT.tap, state.tapLevel));
}
function priceAuto() {
    return Math.floor(BASE_PRICE.auto * Math.pow(PRICE_MULT.auto, state.autoLevel));
}
function priceBoost() {
    return BASE_PRICE.boost;
}

// === Income ===
function perTap() {
    const base = 1 + state.tapLevel;
    const mult = isBoosted() ? 2 : 1;
    return base * mult;
}
function perSec() {
    return state.autoLevel;
}
function isBoosted() {
    return Date.now() < state.boostUntil;
}

// === Render ===
const els = {
    greeting: document.getElementById('greeting'),
    coinValue: document.getElementById('coinValue'),
    perTap: document.getElementById('perTap'),
    perSec: document.getElementById('perSec'),
    boosterStatus: document.getElementById('boosterStatus'),
    tapButton: document.getElementById('tapButton'),
    floatingContainer: document.getElementById('floatingContainer'),

    tapCard: document.getElementById('upgrade-tap'),
    tapLevel: document.getElementById('tap-level'),
    tapPrice: document.getElementById('tap-price'),

    autoCard: document.getElementById('upgrade-auto'),
    autoLevel: document.getElementById('auto-level'),
    autoPrice: document.getElementById('auto-price'),

    boostCard: document.getElementById('upgrade-boost'),
    boostLevel: document.getElementById('boost-level'),
    boostPrice: document.getElementById('boost-price'),
};

function formatNum(n) {
    return Math.floor(n).toLocaleString('ru-RU');
}

function render() {
    els.coinValue.textContent = formatNum(state.coins);
    els.perTap.textContent = `+${perTap()} за тап`;
    els.perSec.textContent = `${perSec()}/сек`;

    if (isBoosted()) {
        const left = Math.ceil((state.boostUntil - Date.now()) / 1000);
        els.boosterStatus.textContent = `⚡ Бустер x2: ${left}с`;
        els.tapButton.classList.add('boosted');
    } else {
        els.boosterStatus.textContent = '';
        els.tapButton.classList.remove('boosted');
    }

    // Upgrade prices/levels
    els.tapLevel.textContent = state.tapLevel;
    els.tapPrice.textContent = formatNum(priceTap());

    els.autoLevel.textContent = state.autoLevel;
    els.autoPrice.textContent = formatNum(priceAuto());

    els.boostLevel.textContent = state.boostUses;
    els.boostPrice.textContent = formatNum(priceBoost());

    toggleCard(els.tapCard, state.coins >= priceTap());
    toggleCard(els.autoCard, state.coins >= priceAuto());
    toggleCard(els.boostCard, state.coins >= priceBoost() && !isBoosted());
}

function toggleCard(card, affordable) {
    if (affordable) {
        card.classList.add('affordable');
        card.classList.remove('locked');
    } else {
        card.classList.remove('affordable');
        card.classList.add('locked');
    }
}

// === Greeting ===
function setGreeting() {
    const user = tg?.initDataUnsafe?.user;
    const name = user?.first_name || user?.username || 'друг';
    els.greeting.textContent = `Привет, ${name}!`;
}

// === Tap ===
function spawnFloat(x, y, amount) {
    const el = document.createElement('div');
    el.className = 'floating-coin';
    el.textContent = `+${amount}`;
    const rect = els.floatingContainer.getBoundingClientRect();
    el.style.left = (x - rect.left - 16) + 'px';
    el.style.top = (y - rect.top - 16) + 'px';
    els.floatingContainer.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

function handleTap(e) {
    const amount = perTap();
    state.coins += amount;

    els.tapButton.classList.add('tapped');
    setTimeout(() => els.tapButton.classList.remove('tapped'), 80);

    // Координаты тапа
    let x, y;
    if (e.touches && e.touches[0]) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches[0]) {
        x = e.changedTouches[0].clientX;
        y = e.changedTouches[0].clientY;
    } else {
        x = e.clientX;
        y = e.clientY;
    }
    spawnFloat(x, y, amount);

    if (tg?.HapticFeedback) {
        try { tg.HapticFeedback.impactOccurred('light'); } catch (err) {}
    }

    render();
    saveState();
}

els.tapButton.addEventListener('click', handleTap);
// Touch для мобильных (мгновенный отклик)
els.tapButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleTap(e);
}, { passive: false });

// === Upgrades ===
function buyTap() {
    const p = priceTap();
    if (state.coins < p) return;
    state.coins -= p;
    state.tapLevel += 1;
    haptic('medium');
    render();
    saveState();
}

function buyAuto() {
    const p = priceAuto();
    if (state.coins < p) return;
    state.coins -= p;
    state.autoLevel += 1;
    haptic('medium');
    render();
    saveState();
}

function buyBoost() {
    if (isBoosted()) return;
    const p = priceBoost();
    if (state.coins < p) return;
    state.coins -= p;
    state.boostUses += 1;
    state.boostUntil = Date.now() + 30_000;
    haptic('heavy');
    render();
    saveState();
}

function haptic(kind) {
    if (tg?.HapticFeedback) {
        try { tg.HapticFeedback.impactOccurred(kind); } catch (e) {}
    }
}

els.tapCard.addEventListener('click', buyTap);
els.autoCard.addEventListener('click', buyAuto);
els.boostCard.addEventListener('click', buyBoost);

// === Auto-clicker tick + booster countdown ===
setInterval(() => {
    if (state.autoLevel > 0) {
        state.coins += state.autoLevel;
        saveState();
    }
    render();
}, 1000);

// === Init ===
setGreeting();
render();
