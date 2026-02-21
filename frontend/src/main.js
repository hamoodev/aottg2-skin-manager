import './style.css';
import './app.css';

import {GetSkins, DeleteSet, CreateSet, UpdateSet, LoginWithDiscord, UploadImage} from '../wailsjs/go/main/App';

const API_BASE = import.meta.env.VITE_API_BASE;
const CDN_BASE = import.meta.env.VITE_CDN_BASE;
const CATEGORIES = ['Human', 'Titan', 'Shifter', 'Skybox'];
const CATEGORY_COLORS = {
    Human: '#4a9eff',
    Titan: '#d4873f',
    Shifter: '#a855f7',
    Skybox: '#38bdf8',
};

const HUMAN_FIELDS = ['Hair', 'Eye', 'Glass', 'Face', 'Skin', 'Costume', 'Logo', 'GearL', 'GearR', 'Gas', 'Hoodie', 'WeaponTrail', 'Horse', 'ThunderspearL', 'ThunderspearR', 'HookL', 'HookLTiling', 'HookR', 'HookRTiling', 'Hat', 'Head', 'Back'];
const TITAN_FIELDS = ['Hairs', 'Bodies', 'Heads', 'Eyes', 'HairModels', 'HeadModels', 'BodyModels', 'RandomizedPairs'];
const SHIFTER_FIELDS = ['Eren', 'Annie', 'Colossal'];
const SKYBOX_FIELDS = ['Front', 'Back', 'Left', 'Right', 'Up', 'Down'];

const FULL_FIELDS = {
    Human: HUMAN_FIELDS,
    Titan: TITAN_FIELDS,
    Shifter: SHIFTER_FIELDS,
    Skybox: SKYBOX_FIELDS,
};

// Editable fields per category (order matters for display)
const EDITABLE_FIELDS = {
    Human: [
        { key: 'Name', label: 'NAME', type: 'text' },
        { key: 'Hair', label: 'HAIR', type: 'url' },
        { key: 'Eye', label: 'EYE', type: 'url' },
        { key: 'Glass', label: 'GLASS', type: 'url' },
        { key: 'Face', label: 'FACE', type: 'url' },
        { key: 'Skin', label: 'SKIN', type: 'url' },
        { key: 'Costume', label: 'COSTUME', type: 'url' },
        { key: 'Logo', label: 'LOGO', type: 'url' },
        { key: 'GearL', label: 'GEAR L', type: 'url' },
        { key: 'GearR', label: 'GEAR R', type: 'url' },
        { key: 'Gas', label: 'GAS', type: 'url' },
        { key: 'Hoodie', label: 'HOODIE', type: 'url' },
        { key: 'WeaponTrail', label: 'WEAPON TRAIL', type: 'url' },
        { key: 'Horse', label: 'HORSE', type: 'url' },
        { key: 'ThunderspearL', label: 'THUNDERSPEAR L', type: 'url' },
        { key: 'ThunderspearR', label: 'THUNDERSPEAR R', type: 'url' },
        { key: 'HookL', label: 'HOOK L', type: 'url' },
        { key: 'HookLTiling', label: 'HOOK L TILING', type: 'number' },
        { key: 'HookR', label: 'HOOK R', type: 'url' },
        { key: 'HookRTiling', label: 'HOOK R TILING', type: 'number' },
        { key: 'Hat', label: 'HAT', type: 'url' },
        { key: 'Head', label: 'HEAD', type: 'url' },
        { key: 'Back', label: 'BACK', type: 'url' },
    ],
    Titan: [
        { key: 'Name', label: 'NAME', type: 'text' },
        { key: 'RandomizedPairs', label: 'RANDOMIZED PAIRS', type: 'bool' },
        { key: 'Hairs', label: 'HAIRS', type: 'array', size: 8 },
        { key: 'HairModels', label: 'HAIR MODELS', type: 'numarray', size: 8 },
        { key: 'Bodies', label: 'BODIES', type: 'array', size: 8 },
        { key: 'BodyModels', label: 'BODY MODELS', type: 'array', size: 8 },
        { key: 'Heads', label: 'HEADS', type: 'array', size: 8 },
        { key: 'HeadModels', label: 'HEAD MODELS', type: 'numarray', size: 8 },
        { key: 'Eyes', label: 'EYES', type: 'array', size: 8 },
    ],
    Shifter: [
        { key: 'Name', label: 'NAME', type: 'text' },
        { key: 'Eren', label: 'EREN', type: 'url' },
        { key: 'Annie', label: 'ANNIE', type: 'url' },
        { key: 'Colossal', label: 'COLOSSAL', type: 'url' },
    ],
    Skybox: [
        { key: 'Name', label: 'NAME', type: 'text' },
        { key: 'Front', label: 'FRONT', type: 'url' },
        { key: 'Back', label: 'BACK', type: 'url' },
        { key: 'Left', label: 'LEFT', type: 'url' },
        { key: 'Right', label: 'RIGHT', type: 'url' },
        { key: 'Up', label: 'UP', type: 'url' },
        { key: 'Down', label: 'DOWN', type: 'url' },
    ],
};

// App state
let skinsData = null;
let activeCategory = 'Human';
let activeView = 'skins';
let marketplaceSearch = '';
let selectedSetId = null;

// Marketplace API state
let authToken = localStorage.getItem('mp_token');
let authUser = null;
let marketplaceSkins = [];
let marketplaceTotal = 0;
let marketplacePage = 1;
let marketplaceTotalPages = 0;
let marketplaceLoading = false;
let searchDebounceTimer = null;

document.querySelector('#app').innerHTML = `
    <div class="noise-overlay"></div>
    <div class="scanlines"></div>
    <div class="layout">
        <div class="top-stripe"></div>
        <nav class="sidebar">
            <div class="sidebar-header">
                <svg class="emblem-svg" viewBox="0 0 60 70" width="44" height="52">
                    <path d="M30 3 L55 18 L55 52 L30 67 L5 52 L5 18 Z"
                          fill="rgba(45,138,110,0.06)" stroke="rgba(45,138,110,0.35)" stroke-width="1.2"/>
                    <path d="M30 10 L48 22 L48 48 L30 60 L12 48 L12 22 Z"
                          fill="rgba(45,138,110,0.04)" stroke="rgba(45,138,110,0.15)" stroke-width="0.8"/>
                    <line x1="22" y1="46" x2="38" y2="24" stroke="rgba(45,138,110,0.45)" stroke-width="2" stroke-linecap="round"/>
                    <line x1="38" y1="46" x2="22" y2="24" stroke="rgba(45,138,110,0.45)" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="30" cy="35" r="3" fill="rgba(45,138,110,0.3)" stroke="rgba(45,138,110,0.5)" stroke-width="0.8"/>
                </svg>
                <h1 class="app-title">SKIN MANAGER <span class="beta-tag">BETA</span></h1>
                <span class="app-subtitle">AOTTG2 EDITION</span>
            </div>
            <div class="sidebar-divider"></div>
            <div class="view-toggle" id="view-toggle">
                <button class="view-toggle-btn active" data-view="skins">MY SKINS</button>
                <button class="view-toggle-btn" data-view="marketplace">MARKET</button>
            </div>
            <div class="sidebar-divider" style="margin-top:12px"></div>
            <span class="section-label">CATEGORIES</span>
            <ul class="category-list" id="category-list"></ul>
            <div class="sidebar-divider" style="margin-top:auto"></div>
            <div class="auth-section" id="auth-section"></div>
            <div class="sidebar-footer">
                <div class="sidebar-divider"></div>
                <span class="footer-quote">DEDICATE YOUR HEARTS</span>
            </div>
        </nav>
        <main class="main-content">
            <div class="content-header" id="content-header">
                <div class="header-info">
                    <span class="header-tag">CATEGORY //</span>
                    <h2 class="category-heading" id="category-heading">HUMAN</h2>
                </div>
                <button class="btn-create" id="btn-create">+ NEW SET</button>
            </div>
            <div class="set-list-wrapper" id="main-area">
                <div class="set-list" id="set-list"></div>
            </div>
            <div class="status-bar" id="status-bar"></div>
            <div class="app-footer">Made with love by Hollow and NinjServ community</div>
        </main>
    </div>
    <div class="modal-overlay" id="modal-overlay">
        <div class="modal" id="modal"></div>
    </div>
`;

// ===== MODAL =====

function showModal(html) {
    document.getElementById('modal').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
}

document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

// ===== API HELPERS =====

async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
    }
    return res.json();
}

async function fetchMarketplaceSkins() {
    marketplaceLoading = true;
    renderMarketplaceCards();
    try {
        const params = new URLSearchParams({ page: String(marketplacePage), limit: '20' });
        if (activeCategory !== 'All') params.set('category', activeCategory);
        if (marketplaceSearch) params.set('search', marketplaceSearch);
        const data = await apiFetch(`/api/skins?${params}`);
        marketplaceSkins = data.skins || [];
        marketplaceTotal = data.total || 0;
        marketplaceTotalPages = data.totalPages || 0;
    } catch (err) {
        setStatus('MARKETPLACE ERROR: ' + err.message);
        marketplaceSkins = [];
        marketplaceTotal = 0;
        marketplaceTotalPages = 0;
    }
    marketplaceLoading = false;
    renderMarketplaceCards();
}

// ===== AUTH =====

async function checkAuth() {
    if (!authToken) { authUser = null; renderAuthSection(); return; }
    try {
        authUser = await apiFetch('/api/auth/me');
    } catch {
        authToken = null;
        authUser = null;
        localStorage.removeItem('mp_token');
    }
    renderAuthSection();
}

async function handleLogin() {
    setStatus('LOGGING IN \u2014 Complete authentication in your browser...');
    try {
        const token = await LoginWithDiscord();
        authToken = token;
        localStorage.setItem('mp_token', token);
        authUser = await apiFetch('/api/auth/me');
        renderAuthSection();
        setStatus(`LOGGED IN \u2014 Welcome, ${authUser.discord_username || 'Soldier'}`);
    } catch (err) {
        setStatus('LOGIN FAILED \u2014 ' + (err.message || err));
    }
}

function handleLogout() {
    authToken = null;
    authUser = null;
    localStorage.removeItem('mp_token');
    renderAuthSection();
    setStatus('LOGGED OUT');
}

function renderAuthSection() {
    const section = document.getElementById('auth-section');
    if (authUser) {
        const name = authUser.discord_username || 'Unknown';
        section.innerHTML = `
            <div class="auth-user">
                <div class="auth-user-info">
                    <span class="auth-icon">\u2726</span>
                    <span class="auth-name">${escapeHtml(name)}</span>
                </div>
                <button class="auth-logout" id="btn-logout">LOGOUT</button>
            </div>`;
        document.getElementById('btn-logout').addEventListener('click', handleLogout);
    } else {
        section.innerHTML = `
            <button class="auth-login" id="btn-login">LOGIN WITH DISCORD</button>`;
        document.getElementById('btn-login').addEventListener('click', handleLogin);
    }
}

// ===== UTILITIES =====

function isFullSet(category, parts) {
    const full = FULL_FIELDS[category];
    if (!full) return false;
    return full.every(f => parts.includes(f));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function extractS3Key(url) {
    if (!url) return null;
    if (CDN_BASE && url.startsWith(CDN_BASE + '/')) {
        return url.slice(CDN_BASE.length + 1);
    }
    return null;
}

function setStatus(msg) {
    const bar = document.getElementById('status-bar');
    bar.textContent = msg;
    bar.classList.add('flash');
    setTimeout(() => bar.classList.remove('flash'), 300);
    setTimeout(() => { if (bar.textContent === msg) bar.textContent = ''; }, 5000);
}

// ===== RENDER: VIEW TOGGLE =====

function renderViewToggle() {
    const toggle = document.getElementById('view-toggle');
    toggle.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === activeView);
    });
}

// ===== RENDER: CATEGORIES =====

function renderCategories() {
    const list = document.getElementById('category-list');

    if (activeView === 'marketplace') {
        const allActive = activeCategory === 'All';
        let html = `
            <li class="category-item${allActive ? ' active' : ''}" data-category="All">
                <div class="category-left">
                    <span class="category-dot" style="background:var(--accent-green);${allActive ? 'box-shadow:0 0 8px var(--accent-green)' : ''}"></span>
                    <span class="category-name">ALL</span>
                </div>
                <span class="category-count">${allActive ? marketplaceTotal : '\u2014'}</span>
            </li>`;

        html += CATEGORIES.map(cat => {
            const isActive = cat === activeCategory;
            const color = CATEGORY_COLORS[cat];
            return `
                <li class="category-item${isActive ? ' active' : ''}" data-category="${cat}">
                    <div class="category-left">
                        <span class="category-dot" style="background:${color};${isActive ? `box-shadow:0 0 8px ${color}` : ''}"></span>
                        <span class="category-name">${cat.toUpperCase()}</span>
                    </div>
                    <span class="category-count">${isActive ? marketplaceTotal : '\u2014'}</span>
                </li>`;
        }).join('');

        list.innerHTML = html;
    } else {
        list.innerHTML = CATEGORIES.map(cat => {
            const count = skinsData && skinsData[cat] && skinsData[cat].Sets
                ? skinsData[cat].Sets.length : 0;
            const isActive = cat === activeCategory;
            const color = CATEGORY_COLORS[cat];
            return `
                <li class="category-item${isActive ? ' active' : ''}" data-category="${cat}">
                    <div class="category-left">
                        <span class="category-dot" style="background:${color};${isActive ? `box-shadow:0 0 8px ${color}` : ''}"></span>
                        <span class="category-name">${cat.toUpperCase()}</span>
                    </div>
                    <span class="category-count">${count}</span>
                </li>`;
        }).join('');
    }

    list.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', () => {
            activeCategory = item.dataset.category;
            selectedSetId = null;
            marketplacePage = 1;
            renderCategories();
            renderMainArea();
        });
    });
}

// ===== RENDER: MAIN AREA ROUTER =====

function renderMainArea() {
    if (activeView === 'marketplace') {
        renderMarketplace();
    } else {
        renderSkins();
    }
}

// ===== RENDER: MY SKINS =====

function renderSkins() {
    const header = document.getElementById('content-header');

    // If a set is selected, show detail view
    if (selectedSetId) {
        const sets = (skinsData && skinsData[activeCategory] && skinsData[activeCategory].Sets) || [];
        const set = sets.find(s => s.UniqueId === selectedSetId);
        if (set) {
            renderSetDetail(header, set);
            return;
        }
        selectedSetId = null;
    }

    header.innerHTML = `
        <div class="header-info">
            <span class="header-tag">CATEGORY //</span>
            <h2 class="category-heading" id="category-heading">${activeCategory.toUpperCase()}</h2>
        </div>
        <button class="btn-create" id="btn-create">+ NEW SET</button>
    `;
    document.getElementById('btn-create').addEventListener('click', handleCreate);

    const area = document.getElementById('main-area');
    area.className = 'set-list-wrapper';

    if (!skinsData || !skinsData[activeCategory]) {
        area.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">\u2B21</div>
                <div class="empty-text">NO DATA FOUND</div>
                <div class="empty-sub">Ensure CustomSkins.json exists in your Aottg2 settings folder</div>
            </div>`;
        return;
    }

    const sets = skinsData[activeCategory].Sets || [];
    if (sets.length === 0) {
        area.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">\u25C7</div>
                <div class="empty-text">NO SETS</div>
                <div class="empty-sub">Click "+ NEW SET" to create your first set</div>
            </div>`;
        return;
    }

    const color = CATEGORY_COLORS[activeCategory];
    area.innerHTML = `<div class="set-list">${sets.map((set, i) => `
        <div class="set-row" data-uid="${set.UniqueId}" style="--delay:${i * 0.03}s; --accent:${color}">
            <div class="set-accent-bar"></div>
            <div class="set-info">
                <span class="set-name">${escapeHtml(set.Name || 'Unnamed')}</span>
                ${set.Preset ? '<span class="set-badge">PRESET</span>' : ''}
            </div>
            <button class="btn-delete" data-id="${set.UniqueId}" data-name="${escapeAttr(set.Name || 'Unnamed')}">
                <span class="delete-x">\u00D7</span> DELETE
            </button>
        </div>
    `).join('')}</div>`;

    area.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDelete(btn.dataset.id, btn.dataset.name);
        });
    });

    area.querySelectorAll('.set-row').forEach(row => {
        row.addEventListener('click', () => {
            selectedSetId = row.dataset.uid;
            renderSkins();
        });
    });
}

// ===== RENDER: SET DETAIL =====

function renderSetDetail(header, set) {
    const fields = EDITABLE_FIELDS[activeCategory] || [];
    const color = CATEGORY_COLORS[activeCategory];

    const publishBtn = authUser
        ? `<button class="btn-publish" id="btn-publish">PUBLISH</button>`
        : '';

    header.innerHTML = `
        <div class="header-info">
            <button class="btn-back" id="btn-back">\u2190 BACK</button>
            <h2 class="category-heading" id="category-heading">${escapeHtml(set.Name || 'Unnamed').toUpperCase()}</h2>
        </div>
        <div class="header-actions">
            ${publishBtn}
            <button class="btn-save" id="btn-save">SAVE</button>
        </div>
    `;

    document.getElementById('btn-back').addEventListener('click', () => {
        selectedSetId = null;
        renderSkins();
    });

    if (document.getElementById('btn-publish')) {
        document.getElementById('btn-publish').addEventListener('click', () => handlePublish(set));
    }

    const area = document.getElementById('main-area');
    area.className = 'set-list-wrapper';

    let html = '<div class="set-detail">';

    for (const field of fields) {
        const val = set[field.key];

        if (field.type === 'url' || field.type === 'text') {
            const strVal = val != null ? String(val) : '';
            const isUrl = field.type === 'url';
            const hasValue = isUrl && strVal !== '';
            const uploadBtn = isUrl ? `<button class="btn-upload" data-field="${field.key}" title="Upload image"${!authUser ? ' disabled' : ''}>\u2191</button>` : '';
            const previewBtn = isUrl ? `<button class="btn-preview${hasValue ? '' : ' hidden'}" data-preview-for="${field.key}" title="Preview image">\u25BC</button>` : '';
            html += `
                <div class="field-block" style="--accent:${color}">
                    <div class="field-row">
                        <label class="field-label">${field.label}</label>
                        <div class="field-input-wrap">
                            <input class="field-input${isUrl ? ' field-url' : ''}" type="text" data-key="${field.key}" data-type="${field.type}" value="${escapeAttr(strVal)}" placeholder="${isUrl ? 'https://i.imgur.com/...' : ''}" spellcheck="false">
                            ${uploadBtn}
                            ${previewBtn}
                            ${hasValue ? `<span class="field-indicator set"></span>` : isUrl ? `<span class="field-indicator empty"></span>` : ''}
                        </div>
                    </div>
                    ${isUrl ? `<div class="field-preview" data-preview="${field.key}"><img></div>` : ''}
                </div>`;
        } else if (field.type === 'number') {
            const numVal = val != null ? val : 1;
            html += `
                <div class="field-row" style="--accent:${color}">
                    <label class="field-label">${field.label}</label>
                    <div class="field-input-wrap">
                        <input class="field-input field-number" type="number" data-key="${field.key}" data-type="number" value="${numVal}" step="0.1">
                    </div>
                </div>`;
        } else if (field.type === 'bool') {
            const boolVal = !!val;
            html += `
                <div class="field-row" style="--accent:${color}">
                    <label class="field-label">${field.label}</label>
                    <div class="field-input-wrap">
                        <button class="field-toggle${boolVal ? ' active' : ''}" data-key="${field.key}" data-type="bool">${boolVal ? 'ON' : 'OFF'}</button>
                    </div>
                </div>`;
        } else if (field.type === 'array' || field.type === 'numarray') {
            const arr = Array.isArray(val) ? val : [];
            html += `
                <div class="field-group" style="--accent:${color}">
                    <label class="field-group-label">${field.label}</label>
                    <div class="field-group-items">`;
            for (let i = 0; i < field.size; i++) {
                const itemVal = arr[i] != null ? String(arr[i]) : '';
                const isNumArr = field.type === 'numarray';
                const hasVal = !isNumArr && itemVal !== '' && itemVal !== '-1';
                const arrUploadBtn = !isNumArr ? `<button class="btn-upload" data-field="${field.key}" data-arr-index="${i}" title="Upload image"${!authUser ? ' disabled' : ''}>\u2191</button>` : '';
                const arrPreviewBtn = !isNumArr ? `<button class="btn-preview${hasVal ? '' : ' hidden'}" data-preview-for="${field.key}-${i}" title="Preview image">\u25BC</button>` : '';
                html += `
                        <div class="field-block sub">
                            <div class="field-row sub">
                                <label class="field-label sub-label">${i + 1}</label>
                                <div class="field-input-wrap">
                                    <input class="field-input${isNumArr ? ' field-number' : ' field-url'}" type="${isNumArr ? 'number' : 'text'}" data-key="${field.key}" data-index="${i}" data-type="${field.type}" value="${escapeAttr(itemVal)}" placeholder="${isNumArr ? '-1' : 'https://i.imgur.com/...'}" spellcheck="false">
                                    ${arrUploadBtn}
                                    ${arrPreviewBtn}
                                    ${!isNumArr && hasVal ? `<span class="field-indicator set"></span>` : !isNumArr ? `<span class="field-indicator empty"></span>` : ''}
                                </div>
                            </div>
                            ${!isNumArr ? `<div class="field-preview" data-preview="${field.key}-${i}"><img></div>` : ''}
                        </div>`;
            }
            html += `
                    </div>
                </div>`;
        }
    }

    html += '</div>';
    area.innerHTML = html;

    // Toggle buttons
    area.querySelectorAll('.field-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const isActive = btn.classList.toggle('active');
            btn.textContent = isActive ? 'ON' : 'OFF';
        });
    });

    // Preview toggle buttons
    area.querySelectorAll('.btn-preview').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.previewFor;
            const previewDiv = area.querySelector(`.field-preview[data-preview="${key}"]`);
            if (!previewDiv) return;
            const isOpen = previewDiv.classList.toggle('open');
            btn.classList.toggle('open', isOpen);
            if (isOpen) {
                const input = btn.closest('.field-input-wrap').querySelector('.field-input');
                const url = input ? input.value.trim() : '';
                const img = previewDiv.querySelector('img');
                if (url) {
                    img.src = url;
                    img.onerror = () => { img.src = ''; previewDiv.classList.add('error'); };
                    previewDiv.classList.remove('error');
                } else {
                    img.src = '';
                }
            }
        });
    });

    // Show/hide preview button when URL input changes
    area.querySelectorAll('.field-input.field-url').forEach(input => {
        input.addEventListener('input', () => {
            const key = input.dataset.key;
            const index = input.dataset.index;
            const previewKey = index !== undefined ? `${key}-${index}` : key;
            const btn = area.querySelector(`.btn-preview[data-preview-for="${previewKey}"]`);
            if (btn) {
                btn.classList.toggle('hidden', input.value.trim() === '');
                // Close preview if URL cleared
                if (input.value.trim() === '') {
                    const previewDiv = area.querySelector(`.field-preview[data-preview="${previewKey}"]`);
                    if (previewDiv) previewDiv.classList.remove('open');
                    btn.classList.remove('open');
                }
            }
            // Update indicator
            const wrap = input.closest('.field-input-wrap');
            const indicator = wrap.querySelector('.field-indicator');
            if (indicator) {
                indicator.className = input.value.trim() ? 'field-indicator set' : 'field-indicator empty';
            }
        });
    });

    // Upload buttons
    area.querySelectorAll('.btn-upload').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!authUser) {
                setStatus('LOGIN REQUIRED \u2014 You must be logged in to upload');
                return;
            }
            const fieldName = btn.dataset.field;
            const arrIndex = btn.dataset.arrIndex;
            try {
                const result = await UploadImage(authToken);
                if (!result) return; // user cancelled
                // Find the corresponding input
                let input;
                if (arrIndex !== undefined) {
                    input = area.querySelector(`.field-input[data-key="${fieldName}"][data-index="${arrIndex}"]`);
                } else {
                    input = area.querySelector(`.field-input[data-key="${fieldName}"]:not([data-index])`);
                }
                if (input) {
                    input.value = result.url || result.key;
                    input.dataset.s3key = result.key;
                    // Update indicator
                    const wrap = input.closest('.field-input-wrap');
                    const indicator = wrap.querySelector('.field-indicator');
                    if (indicator) {
                        indicator.className = 'field-indicator set';
                    }
                }
                const displayName = result.url || result.key;
                setStatus(`UPLOADED \u2014 ${displayName} \u2192 ${fieldName}${arrIndex !== undefined ? '[' + arrIndex + ']' : ''}`);
            } catch (err) {
                setStatus('UPLOAD ERROR: ' + (err.message || err));
            }
        });
    });

    // Save handler
    document.getElementById('btn-save').addEventListener('click', () => handleSave(set));
}

// ===== RENDER: MARKETPLACE =====

function renderMarketplace() {
    const header = document.getElementById('content-header');
    header.innerHTML = `
        <div class="header-info">
            <span class="header-tag">COMMUNITY //</span>
            <h2 class="category-heading">MARKETPLACE</h2>
        </div>
        <input type="text" class="search-input" id="marketplace-search" placeholder="SEARCH..." value="${escapeHtml(marketplaceSearch)}">
    `;

    document.getElementById('marketplace-search').addEventListener('input', (e) => {
        marketplaceSearch = e.target.value;
        marketplacePage = 1;
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => fetchMarketplaceSkins(), 300);
    });

    const area = document.getElementById('main-area');
    area.className = 'set-list-wrapper';
    area.innerHTML = '<div class="card-grid" id="marketplace-grid"></div>';

    fetchMarketplaceSkins();
}

function renderMarketplaceCards() {
    const grid = document.getElementById('marketplace-grid');
    if (!grid) return;

    if (marketplaceLoading) {
        grid.innerHTML = `
            <div class="marketplace-empty">
                <div class="loading-spinner"></div>
                <div class="empty-text">LOADING</div>
            </div>`;
        return;
    }

    if (marketplaceSkins.length === 0) {
        grid.innerHTML = `
            <div class="marketplace-empty">
                <div class="empty-icon">\u25C7</div>
                <div class="empty-text">NO RESULTS</div>
                <div class="empty-sub">Try a different search or category</div>
            </div>`;
        return;
    }

    let html = marketplaceSkins.map((skin, i) => {
        const color = CATEGORY_COLORS[skin.category] || '#888';
        const parts = skin.parts || [];
        const partNames = parts.map(p => p.field_name);
        const full = isFullSet(skin.category, partNames);
        const partsLabel = full
            ? '<span class="card-parts card-parts-full">FULL SET</span>'
            : `<span class="card-parts">${parts.length} PARTS</span>`;

        const authorName = skin.author
            ? (typeof skin.author === 'string' ? skin.author : skin.author.discord_username || 'Unknown')
            : 'Unknown';

        const previewUrl = skin.preview_image_url || '';
        const previewHtml = previewUrl
            ? `<div class="card-preview"><img src="${escapeAttr(previewUrl)}" alt="${escapeAttr(skin.name)}" loading="lazy"></div>`
            : `<div class="card-preview card-preview-empty"><span class="card-preview-placeholder">\u25C7</span></div>`;

        return `
            <div class="marketplace-card" style="--delay:${i * 0.05}s">
                ${previewHtml}
                <div class="card-top">
                    <span class="card-name">${escapeHtml(skin.name)}</span>
                    <span class="card-category" style="color:${color}; border-color:${color}; background:${color}15">${(skin.category || '').toUpperCase()}</span>
                </div>
                <span class="card-author"><span>by</span> ${escapeHtml(authorName)}</span>
                <span class="card-description">${escapeHtml(skin.description || '')}</span>
                <div class="card-meta">
                    <div class="card-meta-left">
                        ${partsLabel}
                        <span class="download-count">\u2193 ${(skin.downloads || 0).toLocaleString()}</span>
                    </div>
                    <button class="btn-import" data-id="${skin.id}">IMPORT</button>
                </div>
            </div>`;
    }).join('');

    // Pagination
    if (marketplaceTotalPages > 1) {
        html += `
            <div class="pagination">
                <button class="pagination-btn" id="page-prev" ${marketplacePage <= 1 ? 'disabled' : ''}>\u2190 PREV</button>
                <span class="pagination-info">PAGE ${marketplacePage} / ${marketplaceTotalPages}</span>
                <button class="pagination-btn" id="page-next" ${marketplacePage >= marketplaceTotalPages ? 'disabled' : ''}>NEXT \u2192</button>
            </div>`;
    }

    grid.innerHTML = html;

    // Import buttons
    grid.querySelectorAll('.btn-import').forEach(btn => {
        btn.addEventListener('click', () => {
            const skin = marketplaceSkins.find(s => s.id === btn.dataset.id);
            if (skin) handleImport(skin);
        });
    });

    // Pagination buttons
    const prevBtn = document.getElementById('page-prev');
    const nextBtn = document.getElementById('page-next');
    if (prevBtn) prevBtn.addEventListener('click', () => { marketplacePage--; fetchMarketplaceSkins(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { marketplacePage++; fetchMarketplaceSkins(); });
}

// ===== HANDLERS =====

function handleImport(skin) {
    const category = skin.category;
    const existingSets = (skinsData && skinsData[category] && skinsData[category].Sets) || [];
    const color = CATEGORY_COLORS[category] || '#888';

    let setsHtml = '';
    if (existingSets.length > 0) {
        setsHtml = existingSets.map(s => `
            <div class="import-set-row" data-uid="${s.UniqueId}">
                <span class="import-set-accent" style="background:${color}"></span>
                <span class="import-set-name">${escapeHtml(s.Name || 'Unnamed')}</span>
                ${s.Preset ? '<span class="set-badge">PRESET</span>' : ''}
            </div>`).join('');
    } else {
        setsHtml = '<div class="import-empty">No existing sets in this category</div>';
    }

    showModal(`
        <div class="modal-header">
            <h3 class="modal-title">IMPORT "${escapeHtml(skin.name).toUpperCase()}"</h3>
            <span class="modal-subtitle">${category.toUpperCase()} \u2022 ${(skin.parts || []).length} PARTS</span>
        </div>
        <div class="modal-body">
            <button class="import-option import-new" id="import-new">
                <span class="import-option-icon">+</span>
                <div class="import-option-text">
                    <span class="import-option-label">CREATE NEW SET</span>
                    <span class="import-option-desc">Import as a new set named "${escapeHtml(skin.name)}"</span>
                </div>
            </button>
            <div class="import-divider">
                <span>OR MERGE INTO EXISTING</span>
            </div>
            <div class="import-set-list" id="import-set-list">
                ${setsHtml}
            </div>
        </div>
        <div class="modal-footer">
            <button class="modal-cancel" id="modal-cancel">CANCEL</button>
        </div>
    `);

    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    document.getElementById('import-new').addEventListener('click', async () => {
        closeModal();
        await doImport(skin, null);
    });

    document.getElementById('import-set-list').querySelectorAll('.import-set-row').forEach(row => {
        row.addEventListener('click', async () => {
            const uid = row.dataset.uid;
            const target = existingSets.find(s => s.UniqueId === uid);
            if (!target) return;
            closeModal();
            await doImport(skin, target);
        });
    });
}

async function doImport(skin, existingSet) {
    try {
        const data = await apiFetch(`/api/skins/${skin.id}/download`);

        const fields = {};
        if (data.parts && Array.isArray(data.parts)) {
            for (const part of data.parts) {
                fields[part.field_name] = part.image_url;
            }
        }

        if (existingSet) {
            await UpdateSet(skin.category, existingSet.UniqueId, fields);
            skinsData = await GetSkins();
            renderCategories();
            setStatus(`IMPORTED \u2014 "${skin.name}" merged into "${existingSet.Name}"`);
        } else {
            const newSet = await CreateSet(skin.category, skin.name);
            await UpdateSet(skin.category, newSet.UniqueId, fields);
            skinsData = await GetSkins();
            renderCategories();
            setStatus(`IMPORTED \u2014 "${skin.name}" added to ${skin.category}`);
        }
    } catch (err) {
        setStatus('IMPORT ERROR: ' + err.message);
    }
}

function handlePublish(set) {
    if (!authUser) {
        setStatus('LOGIN REQUIRED \u2014 You must be logged in to publish');
        return;
    }

    // Collect parts from the editor form
    const editable = EDITABLE_FIELDS[activeCategory] || [];
    const area = document.getElementById('main-area');
    const parts = [];

    for (const field of editable) {
        if (field.type === 'url') {
            const input = area.querySelector(`.field-input[data-key="${field.key}"]:not([data-index])`);
            if (!input) continue;
            const val = input.value.trim();
            if (!val) continue;
            const key = input.dataset.s3key || extractS3Key(val);
            const part = { field_name: field.key };
            if (key) { part.image_key = key; } else { part.image_url = val; }
            parts.push(part);
        } else if (field.type === 'array') {
            for (let i = 0; i < (field.size || 0); i++) {
                const input = area.querySelector(`.field-input[data-key="${field.key}"][data-index="${i}"]`);
                if (!input) continue;
                const val = input.value.trim();
                if (!val) continue;
                const key = input.dataset.s3key || extractS3Key(val);
                const part = { field_name: `${field.key}[${i}]` };
                if (key) { part.image_key = key; } else { part.image_url = val; }
                parts.push(part);
            }
        }
    }

    if (parts.length === 0) {
        setStatus('NOTHING TO PUBLISH \u2014 Set has no texture URLs');
        return;
    }

    showModal(`
        <div class="modal-header">
            <h3 class="modal-title">PUBLISH "${escapeHtml(set.Name || 'Unnamed').toUpperCase()}"</h3>
            <span class="modal-subtitle">${activeCategory.toUpperCase()} \u2022 ${parts.length} PARTS</span>
        </div>
        <div class="modal-body">
            <div class="publish-field">
                <label class="publish-label">PREVIEW IMAGE</label>
                <div class="publish-preview-area" id="publish-preview-area">
                    <div class="publish-preview-empty" id="publish-preview-placeholder">
                        <span class="publish-preview-icon">\u25CB</span>
                        <span class="publish-preview-text">Click to upload a preview screenshot</span>
                    </div>
                    <img class="publish-preview-img" id="publish-preview-img" style="display:none">
                </div>
                <span class="publish-hint">Recommended: in-game screenshot showing your skin</span>
            </div>
            <div class="publish-field">
                <label class="publish-label">DESCRIPTION</label>
                <textarea class="publish-textarea" id="publish-description" placeholder="Describe your skin..." rows="3" spellcheck="false"></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="modal-cancel" id="modal-cancel">CANCEL</button>
            <button class="btn-publish-confirm" id="btn-publish-confirm">PUBLISH</button>
        </div>
    `);

    let previewKey = null;

    document.getElementById('publish-preview-area').addEventListener('click', async () => {
        try {
            const result = await UploadImage(authToken);
            if (!result) return;
            previewKey = result.key;
            const img = document.getElementById('publish-preview-img');
            const placeholder = document.getElementById('publish-preview-placeholder');
            img.src = result.url || result.key;
            img.style.display = 'block';
            placeholder.style.display = 'none';
        } catch (err) {
            setStatus('PREVIEW UPLOAD ERROR: ' + (err.message || err));
        }
    });

    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    document.getElementById('btn-publish-confirm').addEventListener('click', async () => {
        const description = document.getElementById('publish-description').value.trim();
        const confirmBtn = document.getElementById('btn-publish-confirm');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'PUBLISHING...';

        try {
            const body = {
                name: set.Name || 'Unnamed',
                description: description,
                category: activeCategory,
                parts: parts,
            };
            if (previewKey) {
                body.preview_image_key = previewKey;
            }
            await apiFetch('/api/skins', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            closeModal();
            setStatus(`PUBLISHED \u2014 "${set.Name}" is now on the marketplace`);
        } catch (err) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'PUBLISH';
            setStatus('PUBLISH ERROR: ' + err.message);
        }
    });
}

async function handleSave(set) {
    const fields = {};
    const area = document.getElementById('main-area');

    // Collect simple fields
    area.querySelectorAll('.field-input[data-key]').forEach(input => {
        const key = input.dataset.key;
        const type = input.dataset.type;
        const index = input.dataset.index;

        if (index !== undefined) return; // handled separately

        if (type === 'number') {
            fields[key] = parseFloat(input.value) || 0;
        } else {
            fields[key] = input.value;
        }
    });

    // Collect toggle fields
    area.querySelectorAll('.field-toggle[data-key]').forEach(btn => {
        fields[btn.dataset.key] = btn.classList.contains('active');
    });

    // Collect array fields
    const arrayKeys = new Set();
    area.querySelectorAll('.field-input[data-index]').forEach(input => {
        arrayKeys.add(input.dataset.key);
    });
    for (const key of arrayKeys) {
        const inputs = area.querySelectorAll(`.field-input[data-key="${key}"][data-index]`);
        const arr = [];
        inputs.forEach(input => {
            if (input.dataset.type === 'numarray') {
                arr.push(parseFloat(input.value) || -1);
            } else {
                arr.push(input.value);
            }
        });
        fields[key] = arr;
    }

    try {
        await UpdateSet(activeCategory, set.UniqueId, fields);
        skinsData = await GetSkins();
        renderSkins();
        setStatus(`SAVED \u2014 "${fields.Name || set.Name}" updated`);
    } catch (err) {
        setStatus('SAVE ERROR: ' + err);
    }
}

async function handleDelete(uniqueId, name) {
    if (!confirm(`Delete set "${name}"?\n\nThis action cannot be undone.`)) return;
    try {
        await DeleteSet(activeCategory, uniqueId);
        skinsData = await GetSkins();
        renderCategories();
        renderMainArea();
        setStatus(`SET DELETED \u2014 "${name}" removed`);
    } catch (err) {
        setStatus('DELETE ERROR: ' + err);
    }
}

async function handleCreate() {
    const name = prompt('Enter a name for the new set:');
    if (!name) return;
    try {
        await CreateSet(activeCategory, name);
        skinsData = await GetSkins();
        renderCategories();
        renderMainArea();
        setStatus(`SET CREATED \u2014 "${name}" added to ${activeCategory}`);
    } catch (err) {
        setStatus('CREATE ERROR: ' + err);
    }
}

// ===== INIT =====

// View toggle
document.getElementById('view-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.view-toggle-btn');
    if (!btn || btn.dataset.view === activeView) return;
    activeView = btn.dataset.view;
    if (activeView === 'marketplace' && !CATEGORIES.includes(activeCategory) && activeCategory !== 'All') {
        activeCategory = 'All';
    } else if (activeView === 'skins' && !CATEGORIES.includes(activeCategory)) {
        activeCategory = 'Human';
    }
    selectedSetId = null;
    marketplacePage = 1;
    renderViewToggle();
    renderCategories();
    renderMainArea();
});

// Initial create button
document.getElementById('btn-create').addEventListener('click', handleCreate);

// Boot
async function loadSkins() {
    try {
        skinsData = await GetSkins();
        renderCategories();
        renderMainArea();
        setStatus('SYSTEMS ONLINE \u2014 Data loaded successfully');
    } catch (err) {
        setStatus('ERROR: ' + err);
        renderCategories();
        renderMainArea();
    }
}

checkAuth();
loadSkins();
