'use strict';

/* ============================================================
   Sprout — kid-first budgeting prototype
   Vanilla JS + localStorage. No build step.
   ============================================================ */

// ---------- Storage ----------
const STORAGE_KEY = 'sprout_v1';

function seedState() {
  return {
    user: { name: 'Alex', avatar: 'A', avatarEmoji: null },
    theme: 'light',
    splits: { save: 0.5, spend: 0.4, give: 0.1 },
    customJars: [],
    transactions: [
      { id: 't1', type: 'in', jar: 'save',  amount: 20, note: 'Birthday from Grandma',  date: '2026-04-12', goalId: 'g1' },
      { id: 't2', type: 'in', jar: 'save',  amount: 5,  note: 'Allowance auto-split',   date: '2026-04-19', goalId: null },
      { id: 't3', type: 'in', jar: 'spend', amount: 4,  note: 'Allowance auto-split',   date: '2026-04-19', goalId: null },
      { id: 't4', type: 'in', jar: 'give',  amount: 1,  note: 'Allowance auto-split',   date: '2026-04-19', goalId: null },
      { id: 't5', type: 'in', jar: 'save',  amount: 7,  note: 'Topped up Switch goal',  date: '2026-04-20', goalId: 'g1' },
      { id: 't6', type: 'in', jar: 'spend', amount: 8,  note: 'Allowance',              date: '2026-04-12', goalId: null }
    ],
    goals: [
      { id: 'g1', name: 'Nintendo Switch OLED', emoji: '🎮', target: 349, jar: 'save', createdDate: '2026-03-01' }
    ],
    scheduleItems: [
      { id: 's1', type: 'income',       title: 'Allowance',                 amount: 10,   recurrence: 'weekly',  nextDate: '2026-04-26', conditional: false, icon: '💵' },
      { id: 's2', type: 'subscription', title: 'Roblox Premium',            amount: 4.99, recurrence: 'monthly', nextDate: '2026-04-28', conditional: false, icon: '🎮' },
      { id: 's3', type: 'subscription', title: 'Spotify (family slot)',     amount: 2.99, recurrence: 'monthly', nextDate: '2026-05-04', conditional: false, icon: '🎵' },
      { id: 's4', type: 'gig',          title: "Mow Mr. Henderson's lawn",  amount: 15,   recurrence: 'weekly',  nextDate: '2026-05-03', conditional: true,  icon: '🌿' }
    ]
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // Migrate old state that may be missing new fields
      if (!s.theme) s.theme = 'light';
      if (!s.customJars) s.customJars = [];
      if (!s.user.avatarEmoji) s.user.avatarEmoji = null;
      return s;
    }
  } catch (e) { /* fall through */ }
  return seedState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

let state = loadState();
let currentScreen = 'home';
let currentJar = 'save';
let currentGoalId = null;

// ---------- Jar helpers ----------
const FIXED_JAR_META = {
  save:  { id: 'save',  name: 'Save',  emoji: '🌱', color: '#4CAF7C', isFixed: true },
  spend: { id: 'spend', name: 'Spend', emoji: '🛍️', color: '#FF7B54', isFixed: true },
  give:  { id: 'give',  name: 'Give',  emoji: '💛', color: '#9B6DD7', isFixed: true }
};

const JAR_COLOR_PALETTE = [
  '#3B82F6', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1', '#EF4444'
];

const AVATAR_EMOJIS = ['🧒','👦','👧','🌟','🦸','🐱','🦊','🐸','🎈','🚀','🌈','🎯'];

function getJarMeta(jarId) {
  if (FIXED_JAR_META[jarId]) return FIXED_JAR_META[jarId];
  const custom = (state.customJars || []).find(j => j.id === jarId);
  return custom || { id: jarId, name: jarId, emoji: '🫙', color: '#6B7280', isFixed: false };
}

function getAllJarIds() {
  return ['save', 'spend', 'give', ...(state.customJars || []).map(j => j.id)];
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------- Other helpers ----------
function uid() { return 'x' + Math.random().toString(36).slice(2, 9); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmt(n) { return '$' + (Math.round(Math.abs(n) * 100) / 100).toFixed(2); }
function round2(n) { return Math.round(n * 100) / 100; }
function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// ---------- Theme ----------
function applyTheme() {
  const theme = state.theme || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode';
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  saveState();
  applyTheme();
  render();
}

// ---------- Computed ----------
function jarBalance(jar) {
  return state.transactions
    .filter(t => t.jar === jar)
    .reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
}
function totalBalance() {
  return getAllJarIds().reduce((sum, j) => sum + jarBalance(j), 0);
}
function goalProgress(goalId) {
  return state.transactions
    .filter(t => t.goalId === goalId)
    .reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
}
function recentForJar(jar, limit = 6) {
  return state.transactions
    .filter(t => t.jar === jar)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
function recentForGoal(goalId, limit = 10) {
  return state.transactions
    .filter(t => t.goalId === goalId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
function upcomingSchedule(limit = null) {
  const items = [...state.scheduleItems].sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  return limit ? items.slice(0, limit) : items;
}
function thisWeekIncome() {
  const wkAgo = new Date();
  wkAgo.setDate(wkAgo.getDate() - 7);
  const cutoff = wkAgo.toISOString().slice(0, 10);
  return state.transactions
    .filter(t => t.type === 'in' && t.date >= cutoff)
    .reduce((s, t) => s + t.amount, 0);
}

// ---------- Mutations ----------
function addIncome({ amount, note, jar }) {
  const date = todayISO();
  if (jar === 'auto') {
    const saveAmt  = round2(amount * state.splits.save);
    const spendAmt = round2(amount * state.splits.spend);
    const giveAmt  = round2(amount - saveAmt - spendAmt);
    state.transactions.push(
      { id: uid(), type: 'in', jar: 'save',  amount: saveAmt,  note: note || 'Income', date, goalId: null },
      { id: uid(), type: 'in', jar: 'spend', amount: spendAmt, note: note || 'Income', date, goalId: null },
      { id: uid(), type: 'in', jar: 'give',  amount: giveAmt,  note: note || 'Income', date, goalId: null }
    );
  } else {
    state.transactions.push({
      id: uid(), type: 'in', jar, amount, note: note || 'Money in', date, goalId: null
    });
  }
  saveState();
  render();
}
function addExpense({ amount, note, jar }) {
  state.transactions.push({
    id: uid(), type: 'out', jar, amount, note: note || 'Spent', date: todayISO(), goalId: null
  });
  saveState();
  render();
}
function addGoalContribution({ amount, goalId }) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;
  state.transactions.push({
    id: uid(), type: 'in', jar: goal.jar, amount,
    note: `Added to ${goal.name}`, date: todayISO(), goalId
  });
  saveState();
  render();
}
function addGoal({ name, target, emoji, jar }) {
  state.goals.push({
    id: uid(), name, target, emoji: emoji || '🎯',
    jar: jar || 'save', createdDate: todayISO()
  });
  saveState();
  render();
}
function addScheduleItem({ type, title, amount, recurrence, nextDate, conditional, icon }) {
  const iconDefault = type === 'subscription' ? '🔄' : type === 'gig' ? '🌿' : '💵';
  state.scheduleItems.push({
    id: uid(), type, title, amount, recurrence, nextDate,
    conditional: !!conditional, icon: icon || iconDefault
  });
  saveState();
  render();
}
function addCustomJar({ name, emoji, color }) {
  state.customJars.push({ id: uid(), name, emoji: emoji || '🫙', color, isFixed: false });
  saveState();
  render();
}
function deleteCustomJar(jarId) {
  state.customJars = state.customJars.filter(j => j.id !== jarId);
  if (currentJar === jarId) currentJar = 'save';
  saveState();
  render();
}
function updateUser({ name, avatarEmoji }) {
  state.user.name = name;
  state.user.avatarEmoji = avatarEmoji || null;
  state.user.avatar = avatarEmoji ? avatarEmoji : (name[0] || 'A').toUpperCase();
  saveState();
  render();
}
function updateSplits({ save, spend, give }) {
  state.splits = { save, spend, give };
  saveState();
  render();
}

// ---------- Date formatting ----------
function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const dDate = new Date(d); dDate.setHours(0,0,0,0);
  const diff = Math.round((dDate - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function dayLabel(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const dDate = new Date(d); dDate.setHours(0,0,0,0);
  const diff = Math.round((dDate - today) / 86400000);
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (diff === 0) return `<span class="today">Today · ${dayName}</span>`;
  return dayName;
}

// ---------- Component HTML ----------
function scheduleItemHtml(s) {
  const isOut = s.type === 'subscription';
  const iconCls = s.conditional ? 'maybe' : (isOut ? 'out' : 'in');
  const amtCls  = s.conditional ? 'amount-maybe' : (isOut ? 'amount-out' : 'amount-in');
  const sign    = s.conditional ? '~' : (isOut ? '−' : '+');
  return `
    <div class="schedule-item" ${s.conditional ? 'style="opacity:0.7;"' : ''}>
      <div class="schedule-icon ${iconCls}">${escape(s.icon)}</div>
      <div class="schedule-info">
        <div class="schedule-title">${escape(s.title)}</div>
        <div class="schedule-meta">${formatDate(s.nextDate)} · ${escape(s.recurrence)}${s.conditional ? ' · maybe' : ''}</div>
      </div>
      <div class="schedule-amount ${amtCls}">${sign}${fmt(s.amount)}</div>
    </div>
  `;
}

function activityHtml(t) {
  const isIn = t.type === 'in';
  return `
    <div class="schedule-item">
      <div class="schedule-icon ${isIn ? 'in' : 'out'}">${isIn ? '+' : '−'}</div>
      <div class="schedule-info">
        <div class="schedule-title">${escape(t.note || (isIn ? 'Money in' : 'Spent'))}</div>
        <div class="schedule-meta">${formatDate(t.date)}${t.goalId ? ' · goal' : ''}</div>
      </div>
      <div class="schedule-amount ${isIn ? 'amount-in' : 'amount-out'}">${isIn ? '+' : '−'}${fmt(t.amount)}</div>
    </div>
  `;
}

function goalCardHtml(g, opts = {}) {
  const progress = goalProgress(g.id);
  const pct = Math.min(100, (progress / g.target) * 100);
  const meta = getJarMeta(g.jar);
  const metaText = opts.showJar ? ` · in ${meta.name}` : '';
  return `
    <div class="goal-card" style="margin: 0 0 10px;" onclick="openGoalDetail('${g.id}')">
      <div class="goal-row">
        <div class="goal-thumb">${escape(g.emoji)}</div>
        <div class="goal-info">
          <div class="goal-name">${escape(g.name)}</div>
          <div class="goal-progress-text">${fmt(progress)} of ${fmt(g.target)}${metaText}</div>
        </div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct.toFixed(1)}%"></div></div>
    </div>
  `;
}

function statusBarHtml() {
  return `<div class="status-bar"><span>9:41</span><span class="status-dots" onclick="openQuickSettings()">•••</span></div>`;
}

function avatarHtml(size) {
  const { avatarEmoji, avatar } = state.user;
  if (size === 'small') {
    return `<div class="avatar${avatarEmoji ? ' avatar-emoji' : ''}" onclick="navigate('profile')">${escape(avatarEmoji || avatar)}</div>`;
  }
  return `
    <div class="profile-avatar${avatarEmoji ? ' avatar-emoji' : ''}" onclick="openAvatarModal()">
      ${escape(avatarEmoji || avatar)}
      <div class="profile-avatar-edit">✏️</div>
    </div>
  `;
}

// ---------- Render: Home ----------
function renderHome() {
  const total = totalBalance();
  const recentIn = thisWeekIncome();
  const upcoming = upcomingSchedule(3);
  const activeGoal = state.goals[0];
  const allJarIds = getAllJarIds();
  const cols = allJarIds.length <= 3 ? allJarIds.length : 3;

  document.getElementById('home').innerHTML = `
    ${statusBarHtml()}
    <div class="top-bar">
      <div class="greeting">Hey, ${escape(state.user.name)} 👋</div>
      ${avatarHtml('small')}
    </div>
    <div class="balance-card">
      <div class="balance-label">Total balance</div>
      <div class="balance-amount">${fmt(total)}</div>
      ${recentIn > 0 ? `<div class="balance-meta"><span class="pill-positive">+${fmt(recentIn)} this week</span></div>` : ''}
    </div>
    <div class="section-h"><h3>My Jars</h3><span class="link" onclick="navigate('jars')">Manage</span></div>
    <div class="jars" style="grid-template-columns: repeat(${cols}, 1fr);">
      ${allJarIds.map(j => {
        const meta = getJarMeta(j);
        const isFixed = ['save','spend','give'].includes(j);
        const iconStyle = isFixed ? '' : `style="background:${hexToRgba(meta.color, 0.15)}"`;
        const amtStyle = isFixed ? '' : `style="color:${meta.color}"`;
        return `
          <div class="jar ${isFixed ? j : ''}" onclick="selectJar('${j}'); navigate('jars');">
            <div class="jar-icon" ${iconStyle}>${meta.emoji}</div>
            <div class="jar-name">${escape(meta.name)}</div>
            <div class="jar-amount" ${amtStyle}>${fmt(jarBalance(j))}</div>
          </div>
        `;
      }).join('')}
    </div>
    ${activeGoal ? `
      <div class="section-h"><h3>Active goal</h3><span class="link" onclick="navigate('goals')">See all</span></div>
      <div style="padding: 0 20px 12px;">${goalCardHtml(activeGoal)}</div>
    ` : `
      <div class="section-h"><h3>Goals</h3></div>
      <div class="empty">No goals yet. Tap + to add one.</div>
    `}
    <div class="section-h"><h3>Coming up</h3><span class="link" onclick="navigate('schedule')">See all</span></div>
    <div class="schedule-list">
      ${upcoming.length ? upcoming.map(scheduleItemHtml).join('') : '<div class="empty">Nothing scheduled.</div>'}
    </div>
    <div class="fab" onclick="openLogMoneyModal()">+</div>
  `;
}

// ---------- Render: Schedule ----------
function renderSchedule() {
  const items = upcomingSchedule();
  const groups = {};
  items.forEach(it => {
    if (!groups[it.nextDate]) groups[it.nextDate] = [];
    groups[it.nextDate].push(it);
  });
  document.getElementById('schedule').innerHTML = `
    ${statusBarHtml()}
    <div class="screen-header">
      <div class="back-btn" onclick="navigate('home')">‹</div>
      <div class="screen-title">Schedule</div>
    </div>
    <div class="hint-banner">Solid items are confirmed. Faded ones are "maybe" income.</div>
    <div class="timeline">
      ${Object.keys(groups).length ? Object.keys(groups).sort().map(date => `
        <div class="day-group">
          <div class="day-label">${dayLabel(date)}</div>
          <div class="schedule-list">${groups[date].map(scheduleItemHtml).join('')}</div>
        </div>
      `).join('') : '<div class="empty">Nothing scheduled yet. Tap + to add.</div>'}
    </div>
    <div class="fab" onclick="openAddScheduleModal()">+</div>
  `;
}

// ---------- Render: Jars ----------
function selectJar(jar) {
  currentJar = jar;
  renderJars();
}
function renderJars() {
  const j = currentJar;
  const meta = getJarMeta(j);
  const isFixed = ['save','spend','give'].includes(j);
  const goalsInJar = state.goals.filter(g => g.jar === j);
  const recent = recentForJar(j);
  const allJarIds = getAllJarIds();
  const amtColorClass = isFixed ? `jar-${j}` : '';
  const amtInlineStyle = isFixed ? '' : `style="color:${meta.color}"`;

  document.getElementById('jars').innerHTML = `
    ${statusBarHtml()}
    <div class="screen-header">
      <div class="back-btn" onclick="navigate('home')">‹</div>
      <div class="screen-title">Jars</div>
    </div>
    <div class="jar-tabs">
      ${allJarIds.map(jj => `
        <div class="jar-tab ${jj === j ? 'active' : ''}" onclick="selectJar('${jj}')">
          ${getJarMeta(jj).emoji} ${escape(getJarMeta(jj).name)}
        </div>
      `).join('')}
    </div>
    <div class="jar-balance-card">
      <div class="jar-emoji-big">${meta.emoji}</div>
      <div class="jar-balance-label">In your ${escape(meta.name.toLowerCase())} jar</div>
      <div class="jar-balance-amount ${amtColorClass}" ${amtInlineStyle}>${fmt(jarBalance(j))}</div>
    </div>
    <div class="quick-actions">
      <div class="quick-btn" onclick="openLogMoneyModal('in', '${j}')"><span class="quick-btn-icon">📥</span>Add money</div>
      <div class="quick-btn" onclick="openLogMoneyModal('out', '${j}')"><span class="quick-btn-icon">📤</span>Spent money</div>
    </div>
    ${goalsInJar.length ? `
      <div class="section-h"><h3>Goals in this jar</h3></div>
      <div style="padding: 0 20px 18px;">
        ${goalsInJar.map(g => goalCardHtml(g)).join('')}
      </div>
    ` : ''}
    <div class="section-h"><h3>Recent activity</h3></div>
    <div class="schedule-list" style="padding-bottom: 20px;">
      ${recent.length ? recent.map(activityHtml).join('') : '<div class="empty">No activity yet.</div>'}
    </div>
    <div class="fab" onclick="openAddJarModal()">+</div>
  `;
}

// ---------- Render: Goals ----------
function renderGoals() {
  document.getElementById('goals').innerHTML = `
    ${statusBarHtml()}
    <div class="screen-header">
      <div class="back-btn" onclick="navigate('home')">‹</div>
      <div class="screen-title">Goals</div>
    </div>
    <div style="padding: 0 20px;">
      ${state.goals.length
        ? state.goals.map(g => goalCardHtml(g, { showJar: true })).join('')
        : '<div class="empty">No goals yet. Tap + to add one.</div>'}
    </div>
    <div class="fab" onclick="openAddGoalModal()">+</div>
  `;
}

// ---------- Render: Goal Detail ----------
function openGoalDetail(goalId) {
  currentGoalId = goalId;
  renderGoalDetail();
  navigate('goal-detail');
}
function renderGoalDetail() {
  const el = document.getElementById('goal-detail');
  if (!currentGoalId) { el.innerHTML = ''; return; }
  const g = state.goals.find(x => x.id === currentGoalId);
  if (!g) { el.innerHTML = ''; return; }

  const progress = goalProgress(g.id);
  const pct = Math.min(100, (progress / g.target) * 100);
  const C = 2 * Math.PI * 96;
  const offset = C * (1 - pct / 100);
  const recent = recentForGoal(g.id);

  el.innerHTML = `
    ${statusBarHtml()}
    <div class="screen-header">
      <div class="back-btn" onclick="navigate('goals')">‹</div>
      <div class="screen-title">Goal</div>
    </div>
    <div class="goal-detail-hero">
      <div class="progress-ring-wrapper">
        <svg class="progress-ring" width="220" height="220">
          <circle class="progress-ring-bg" cx="110" cy="110" r="96"></circle>
          <circle class="progress-ring-fg" cx="110" cy="110" r="96"
            stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"></circle>
        </svg>
        <div class="ring-content">
          <div class="ring-emoji">${escape(g.emoji)}</div>
          <div class="ring-percent">${pct.toFixed(0)}% THERE</div>
        </div>
      </div>
      <div class="goal-detail-name">${escape(g.name)}</div>
      <div class="goal-detail-amount"><strong>${fmt(progress)}</strong> of <strong>${fmt(g.target)}</strong></div>
    </div>
    <button class="add-btn" onclick="openAddToGoalModal('${g.id}')">Add to this goal</button>
    <div class="section-h"><h3>Contributions</h3></div>
    <div class="schedule-list" style="padding-bottom: 20px;">
      ${recent.length ? recent.map(activityHtml).join('') : '<div class="empty">No contributions yet.</div>'}
    </div>
  `;
}

// ---------- Render: Profile ----------
function renderProfile() {
  const { name, avatarEmoji } = state.user;
  const isDark = state.theme === 'dark';
  const savePct = Math.round(state.splits.save * 100);
  const spendPct = Math.round(state.splits.spend * 100);
  const givePct = Math.round(state.splits.give * 100);
  const customJars = state.customJars || [];

  document.getElementById('profile').innerHTML = `
    ${statusBarHtml()}
    <div class="screen-header">
      <div class="back-btn" onclick="navigate('home')">‹</div>
      <div class="screen-title">Profile</div>
    </div>

    <div class="profile-hero">
      ${avatarHtml('large')}
      <div class="profile-name">${escape(name)}</div>
      <div class="profile-name-sub">Tap your avatar to change it</div>
    </div>

    <div class="profile-section">
      <div class="profile-row" onclick="openEditNameModal()">
        <div class="profile-row-icon" style="background:rgba(255,123,84,0.12)">✏️</div>
        <div class="profile-row-label">Display name</div>
        <div class="profile-row-value">${escape(name)}</div>
        <div class="profile-row-arrow">›</div>
      </div>
      <div class="profile-row" style="cursor:default;">
        <div class="profile-row-icon" style="background:rgba(155,109,215,0.12)">${isDark ? '🌙' : '☀️'}</div>
        <div class="profile-row-label">Dark mode</div>
        <div class="theme-toggle-track ${isDark ? 'on' : ''}" onclick="toggleTheme()">
          <div class="theme-toggle-thumb"></div>
        </div>
      </div>
    </div>

    <div class="section-h"><h3>Jar splits (auto-split)</h3></div>
    <form onsubmit="submitSplits(event)">
      <div class="splits-grid">
        <div class="split-item">
          <div class="split-emoji">🌱</div>
          <div class="split-name">Save</div>
          <input class="split-input" type="number" name="save" min="0" max="100" value="${savePct}" oninput="updateSplitHint()">
          <div class="split-suffix">%</div>
        </div>
        <div class="split-item">
          <div class="split-emoji">🛍️</div>
          <div class="split-name">Spend</div>
          <input class="split-input" type="number" name="spend" min="0" max="100" value="${spendPct}" oninput="updateSplitHint()">
          <div class="split-suffix">%</div>
        </div>
        <div class="split-item">
          <div class="split-emoji">💛</div>
          <div class="split-name">Give</div>
          <input class="split-input" type="number" name="give" min="0" max="100" value="${givePct}" oninput="updateSplitHint()">
          <div class="split-suffix">%</div>
        </div>
      </div>
      <div class="splits-hint ok" id="splits-hint">Save + Spend + Give = 100%</div>
      <div style="padding: 8px 20px 18px;">
        <button type="submit" class="btn-primary" style="width:100%; padding:14px; font-size:14px;">Save splits</button>
      </div>
    </form>

    <div class="section-h"><h3>Custom jars</h3></div>
    ${customJars.length ? `
      <div style="background:var(--surface); margin: 0 20px; border-radius:20px; overflow:hidden; box-shadow:var(--shadow);">
        ${customJars.map(cj => `
          <div class="custom-jar-item">
            <div class="custom-jar-dot" style="background:${hexToRgba(cj.color, 0.15)}">${cj.emoji}</div>
            <div class="custom-jar-name">${escape(cj.name)}</div>
            <div class="custom-jar-balance">${fmt(jarBalance(cj.id))}</div>
            <button class="delete-btn" onclick="confirmDeleteJar('${cj.id}')">🗑️</button>
          </div>
        `).join('')}
      </div>
      <div style="padding: 12px 20px 0;">
        <button class="quick-btn" style="width:100%;" onclick="openAddJarModal()"><span class="quick-btn-icon">➕</span>Add another jar</button>
      </div>
    ` : `
      <div style="padding: 0 20px 8px;">
        <button class="quick-btn" style="width:100%;" onclick="openAddJarModal()"><span class="quick-btn-icon">➕</span>Add a custom jar</button>
      </div>
      <div class="empty" style="padding-top: 4px;">Custom jars are for anything outside Save, Spend, or Give — like a travel fund or pet savings.</div>
    `}
  `;
}

// ---------- Render: Nav ----------
function renderNav() {
  document.getElementById('nav-bar').innerHTML = `
    <div class="nav-item ${currentScreen === 'home' ? 'active' : ''}" onclick="navigate('home')">
      <div class="nav-icon">🏠</div><div>Home</div>
    </div>
    <div class="nav-item ${currentScreen === 'schedule' ? 'active' : ''}" onclick="navigate('schedule')">
      <div class="nav-icon">📅</div><div>Schedule</div>
    </div>
    <div class="nav-item ${currentScreen === 'jars' ? 'active' : ''}" onclick="navigate('jars')">
      <div class="nav-icon">🫙</div><div>Jars</div>
    </div>
    <div class="nav-item ${currentScreen === 'goals' || currentScreen === 'goal-detail' ? 'active' : ''}" onclick="navigate('goals')">
      <div class="nav-icon">🎯</div><div>Goals</div>
    </div>
    <div class="nav-item ${currentScreen === 'profile' ? 'active' : ''}" onclick="navigate('profile')">
      <div class="nav-icon">👤</div><div>Profile</div>
    </div>
  `;
}

function render() {
  renderHome();
  renderSchedule();
  renderJars();
  renderGoals();
  renderGoalDetail();
  renderProfile();
  renderNav();
}

function navigate(screen) {
  currentScreen = screen;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screen).classList.add('active');
  document.querySelector('.screen-container').scrollTop = 0;
  renderNav();
}

// ---------- Modals ----------
function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal').classList.add('active');
}
function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

function openLogMoneyModal(type, jar) {
  if (!type) {
    openModal(`
      <div class="modal-handle"></div>
      <h3>What's happening?</h3>
      <div class="modal-options">
        <div class="modal-opt" onclick="openLogMoneyModal('in')"><div class="modal-opt-icon">💵</div>Got money</div>
        <div class="modal-opt" onclick="openLogMoneyModal('out')"><div class="modal-opt-icon">🛍️</div>Spent money</div>
        <div class="modal-opt" onclick="openAddGoalModal()"><div class="modal-opt-icon">🎯</div>New goal</div>
        <div class="modal-opt" onclick="openAddScheduleModal()"><div class="modal-opt-icon">📅</div>Schedule item</div>
      </div>
      <button class="modal-close" onclick="closeModal()">Cancel</button>
    `);
    return;
  }
  const isIn = type === 'in';
  const defaultJar = jar || (isIn ? 'auto' : 'spend');
  const allJarIds = getAllJarIds();
  openModal(`
    <div class="modal-handle"></div>
    <h3>${isIn ? 'Got money' : 'Spent money'}</h3>
    <p class="modal-sub">${isIn ? 'Allowance, gift, gig payout, anything coming in.' : 'Logging something you bought.'}</p>
    <form onsubmit="submitLogMoney(event, '${type}')">
      <label class="form-label">Amount</label>
      <div class="amount-input-wrapper">
        <span class="amount-prefix">$</span>
        <input class="form-input amount-input" type="number" step="0.01" min="0.01" name="amount" required autofocus placeholder="0.00">
      </div>
      <label class="form-label">Note (optional)</label>
      <input class="form-input" type="text" name="note" placeholder="${isIn ? 'Allowance, birthday, walked dog...' : 'What did you buy?'}">
      <label class="form-label">${isIn ? 'Where does it go?' : 'Which jar?'}</label>
      <div class="jar-picker">
        ${isIn ? `
          <label class="jar-pick">
            <input type="radio" name="jar" value="auto" ${defaultJar === 'auto' ? 'checked' : ''}>
            <div class="jar-pick-content">
              <div class="jar-pick-emoji">✨</div>
              <div class="jar-pick-name">Auto-split</div>
              <div class="jar-pick-meta">${Math.round(state.splits.save*100)}/${Math.round(state.splits.spend*100)}/${Math.round(state.splits.give*100)}</div>
            </div>
          </label>
        ` : ''}
        ${allJarIds.map(jj => {
          const meta = getJarMeta(jj);
          return `
            <label class="jar-pick">
              <input type="radio" name="jar" value="${jj}" ${defaultJar === jj ? 'checked' : ''}>
              <div class="jar-pick-content">
                <div class="jar-pick-emoji">${meta.emoji}</div>
                <div class="jar-pick-name">${escape(meta.name)}</div>
                <div class="jar-pick-meta">${fmt(jarBalance(jj))}</div>
              </div>
            </label>
          `;
        }).join('')}
      </div>
      <div class="form-actions">
        <button type="button" class="modal-close" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save</button>
      </div>
    </form>
  `);
}

function submitLogMoney(e, type) {
  e.preventDefault();
  const f = e.target;
  const amount = parseFloat(f.amount.value);
  const note = f.note.value.trim();
  const jar = f.jar.value;
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (type === 'in') addIncome({ amount, note, jar });
  else addExpense({ amount, note, jar });
  closeModal();
}

function openAddGoalModal() {
  const emojis = ['🎮','🎧','📱','🎸','🚲','👟','🎫','📚','🎨','🛹','🎁','🎯'];
  const allJarIds = getAllJarIds();
  openModal(`
    <div class="modal-handle"></div>
    <h3>New goal</h3>
    <p class="modal-sub">What are you saving up for?</p>
    <form onsubmit="submitAddGoal(event)">
      <label class="form-label">Name</label>
      <input class="form-input" type="text" name="name" required autofocus placeholder="Nintendo Switch, concert ticket...">
      <label class="form-label">Target amount</label>
      <div class="amount-input-wrapper">
        <span class="amount-prefix">$</span>
        <input class="form-input amount-input" type="number" step="1" min="1" name="target" required placeholder="100">
      </div>
      <label class="form-label">Which jar?</label>
      <div class="jar-picker">
        ${allJarIds.map((jj, i) => {
          const meta = getJarMeta(jj);
          return `
            <label class="jar-pick">
              <input type="radio" name="jar" value="${jj}" ${i === 0 ? 'checked' : ''}>
              <div class="jar-pick-content">
                <div class="jar-pick-emoji">${meta.emoji}</div>
                <div class="jar-pick-name">${escape(meta.name)}</div>
              </div>
            </label>
          `;
        }).join('')}
      </div>
      <label class="form-label">Pick an icon</label>
      <div class="emoji-picker">
        ${emojis.map((em, i) => `
          <label class="emoji-pick">
            <input type="radio" name="emoji" value="${em}" ${i === 0 ? 'checked' : ''}>
            <span>${em}</span>
          </label>
        `).join('')}
      </div>
      <div class="form-actions">
        <button type="button" class="modal-close" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Create goal</button>
      </div>
    </form>
  `);
}

function submitAddGoal(e) {
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  const target = parseFloat(f.target.value);
  if (!name || !Number.isFinite(target) || target <= 0) return;
  addGoal({ name, target, emoji: f.emoji.value, jar: f.jar.value });
  closeModal();
}

function openAddToGoalModal(goalId) {
  const g = state.goals.find(x => x.id === goalId);
  if (!g) return;
  const jarBal = jarBalance(g.jar);
  const meta = getJarMeta(g.jar);
  openModal(`
    <div class="modal-handle"></div>
    <h3>Add to ${escape(g.name)}</h3>
    <p class="modal-sub">From your ${escape(meta.name)} jar — ${fmt(jarBal)} available</p>
    <form onsubmit="submitAddToGoal(event, '${goalId}')">
      <label class="form-label">Amount</label>
      <div class="amount-input-wrapper">
        <span class="amount-prefix">$</span>
        <input class="form-input amount-input" type="number" step="0.01" min="0.01" name="amount" required autofocus placeholder="0.00">
      </div>
      <div class="form-actions">
        <button type="button" class="modal-close" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Add to goal</button>
      </div>
    </form>
  `);
}

function submitAddToGoal(e, goalId) {
  e.preventDefault();
  const f = e.target;
  const amount = parseFloat(f.amount.value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  addGoalContribution({ amount, goalId });
  closeModal();
}

function openAddScheduleModal() {
  openModal(`
    <div class="modal-handle"></div>
    <h3>New schedule item</h3>
    <p class="modal-sub">Plan upcoming income, subscriptions, or "maybe" gigs.</p>
    <form onsubmit="submitAddSchedule(event)">
      <label class="form-label">Type</label>
      <div class="type-picker">
        <label class="type-pick"><input type="radio" name="type" value="income" checked><span>💵 Income</span></label>
        <label class="type-pick"><input type="radio" name="type" value="subscription"><span>🔄 Sub</span></label>
        <label class="type-pick"><input type="radio" name="type" value="gig"><span>🌿 Gig</span></label>
      </div>
      <label class="form-label">Title</label>
      <input class="form-input" type="text" name="title" required placeholder="Allowance, Roblox, walking dogs...">
      <label class="form-label">Amount</label>
      <div class="amount-input-wrapper">
        <span class="amount-prefix">$</span>
        <input class="form-input amount-input" type="number" step="0.01" min="0" name="amount" required placeholder="0.00">
      </div>
      <label class="form-label">How often?</label>
      <div class="type-picker">
        <label class="type-pick"><input type="radio" name="recurrence" value="weekly" checked><span>Weekly</span></label>
        <label class="type-pick"><input type="radio" name="recurrence" value="monthly"><span>Monthly</span></label>
        <label class="type-pick"><input type="radio" name="recurrence" value="once"><span>Once</span></label>
      </div>
      <label class="form-label">Next date</label>
      <input class="form-input" type="date" name="nextDate" required value="${todayISO()}">
      <div class="form-actions">
        <button type="button" class="modal-close" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Add to schedule</button>
      </div>
    </form>
  `);
}

function submitAddSchedule(e) {
  e.preventDefault();
  const f = e.target;
  const type = f.type.value;
  const title = f.title.value.trim();
  const amount = parseFloat(f.amount.value);
  if (!title || !Number.isFinite(amount) || amount < 0) return;
  addScheduleItem({
    type,
    title,
    amount,
    recurrence: f.recurrence.value,
    nextDate: f.nextDate.value,
    conditional: type === 'gig'
  });
  closeModal();
}

function openAddJarModal() {
  const jarEmojis = ['🫙','💰','✈️','🎓','🏠','🎵','💊','⚽','🎂','🐕','🚗','💎'];
  openModal(`
    <div class="modal-handle"></div>
    <h3>New jar</h3>
    <p class="modal-sub">Create a custom jar for anything that doesn't fit the defaults.</p>
    <form onsubmit="submitAddJar(event)">
      <label class="form-label">Name</label>
      <input class="form-input" type="text" name="name" required autofocus placeholder="Travel fund, pet savings...">
      <label class="form-label">Pick an icon</label>
      <div class="emoji-picker">
        ${jarEmojis.map((em, i) => `
          <label class="emoji-pick">
            <input type="radio" name="emoji" value="${em}" ${i === 0 ? 'checked' : ''}>
            <span>${em}</span>
          </label>
        `).join('')}
      </div>
      <label class="form-label">Pick a color</label>
      <div class="color-picker">
        ${JAR_COLOR_PALETTE.map((c, i) => `
          <label class="color-pick">
            <input type="radio" name="color" value="${c}" ${i === 0 ? 'checked' : ''}>
            <span style="background:${c}"></span>
          </label>
        `).join('')}
      </div>
      <div class="form-actions">
        <button type="button" class="modal-close" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Create jar</button>
      </div>
    </form>
  `);
}

function submitAddJar(e) {
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  if (!name) return;
  addCustomJar({ name, emoji: f.emoji.value, color: f.color.value });
  closeModal();
}

function confirmDeleteJar(jarId) {
  const meta = getJarMeta(jarId);
  const bal = jarBalance(jarId);
  if (confirm(`Delete the "${meta.name}" jar? It has ${fmt(bal)} in it. Transactions stay in your history.`)) {
    deleteCustomJar(jarId);
  }
}

function openAvatarModal() {
  openModal(`
    <div class="modal-handle"></div>
    <h3>Choose your avatar</h3>
    <p class="modal-sub">Pick an emoji that represents you!</p>
    <div class="emoji-picker" style="grid-template-columns: repeat(6,1fr); gap: 10px; padding: 8px 0;">
      ${AVATAR_EMOJIS.map(em => `
        <label class="emoji-pick" onclick="setAvatar('${em}')">
          <span style="font-size:32px; padding:10px 4px;">${em}</span>
        </label>
      `).join('')}
      <label class="emoji-pick" onclick="setAvatar(null)">
        <span style="font-size:18px; padding:10px 4px; font-weight:800;">${escape((state.user.name[0] || 'A').toUpperCase())}</span>
      </label>
    </div>
    <button class="modal-close" onclick="closeModal()">Cancel</button>
  `);
}

function setAvatar(emoji) {
  updateUser({ name: state.user.name, avatarEmoji: emoji });
  closeModal();
}

function openEditNameModal() {
  openModal(`
    <div class="modal-handle"></div>
    <h3>Change your name</h3>
    <form onsubmit="submitEditName(event)">
      <label class="form-label">Display name</label>
      <input class="form-input" type="text" name="name" required autofocus value="${escape(state.user.name)}" maxlength="20">
      <div class="form-actions">
        <button type="button" class="modal-close" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save</button>
      </div>
    </form>
  `);
}

function submitEditName(e) {
  e.preventDefault();
  const name = e.target.name.value.trim();
  if (!name) return;
  updateUser({ name, avatarEmoji: state.user.avatarEmoji });
  closeModal();
}

function updateSplitHint() {
  const form = document.querySelector('#profile form');
  if (!form) return;
  const save = parseInt(form.save?.value || 0, 10);
  const spend = parseInt(form.spend?.value || 0, 10);
  const give = parseInt(form.give?.value || 0, 10);
  const sum = save + spend + give;
  const hint = document.getElementById('splits-hint');
  if (!hint) return;
  if (sum === 100) {
    hint.textContent = '✓ Adds up to 100% — nice!';
    hint.className = 'splits-hint ok';
  } else {
    hint.textContent = `Currently ${sum}% — needs to equal 100%`;
    hint.className = 'splits-hint error';
  }
}

function submitSplits(e) {
  e.preventDefault();
  const f = e.target;
  const save = parseInt(f.save.value, 10);
  const spend = parseInt(f.spend.value, 10);
  const give = parseInt(f.give.value, 10);
  if (save + spend + give !== 100) {
    updateSplitHint();
    return;
  }
  updateSplits({ save: save / 100, spend: spend / 100, give: give / 100 });
}

function openQuickSettings() {
  const isDark = state.theme === 'dark';
  const savePct  = Math.round(state.splits.save  * 100);
  const spendPct = Math.round(state.splits.spend * 100);
  const givePct  = Math.round(state.splits.give  * 100);
  const { name, avatarEmoji, avatar } = state.user;

  openModal(`
    <div class="modal-handle"></div>
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px;">
      <div class="avatar${avatarEmoji ? ' avatar-emoji' : ''}" style="width:44px;height:44px;font-size:${avatarEmoji ? '24px' : '17px'};flex-shrink:0;">${escape(avatarEmoji || avatar)}</div>
      <div>
        <div style="font-size:17px;font-weight:800;">${escape(name)}</div>
        <div style="font-size:12px;color:var(--text-soft);">Auto-split ${savePct}/${spendPct}/${givePct}</div>
      </div>
    </div>

    <div style="background:var(--bg);border-radius:16px;overflow:hidden;margin-bottom:12px;">
      <div style="display:flex;align-items:center;padding:14px 16px;gap:12px;border-bottom:1px solid var(--border);">
        <div style="width:34px;height:34px;border-radius:10px;background:rgba(155,109,215,0.12);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">${isDark ? '🌙' : '☀️'}</div>
        <div style="flex:1;font-size:14px;font-weight:700;">Dark mode</div>
        <div class="theme-toggle-track ${isDark ? 'on' : ''}" onclick="toggleTheme()">
          <div class="theme-toggle-thumb"></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;padding:14px 16px;gap:12px;cursor:pointer;" onclick="closeModal(); navigate('profile');">
        <div style="width:34px;height:34px;border-radius:10px;background:rgba(255,123,84,0.12);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">👤</div>
        <div style="flex:1;font-size:14px;font-weight:700;">Edit profile</div>
        <div style="font-size:16px;color:var(--text-muted);">›</div>
      </div>
    </div>

    <div style="background:var(--bg);border-radius:16px;overflow:hidden;margin-bottom:12px;">
      <div style="display:flex;align-items:center;padding:14px 16px;gap:12px;cursor:pointer;" onclick="closeModal(); openLogMoneyModal();">
        <div style="width:34px;height:34px;border-radius:10px;background:rgba(76,175,124,0.12);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">💵</div>
        <div style="flex:1;font-size:14px;font-weight:700;">Log money</div>
        <div style="font-size:16px;color:var(--text-muted);">›</div>
      </div>
      <div style="display:flex;align-items:center;padding:14px 16px;gap:12px;border-top:1px solid var(--border);cursor:pointer;" onclick="closeModal(); openAddJarModal();">
        <div style="width:34px;height:34px;border-radius:10px;background:rgba(59,130,246,0.12);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">🫙</div>
        <div style="flex:1;font-size:14px;font-weight:700;">Add jar</div>
        <div style="font-size:16px;color:var(--text-muted);">›</div>
      </div>
    </div>

    <button class="modal-close" onclick="closeModal()">Close</button>
  `);
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();

  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (confirm('Reset all data to demo? Goals, transactions, and schedule items you added will be erased.')) {
      localStorage.removeItem(STORAGE_KEY);
      state = seedState();
      saveState();
      currentJar = 'save';
      currentGoalId = null;
      applyTheme();
      navigate('home');
      render();
    }
  });

  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });

  render();
  navigate('home');
});

// Expose for inline handlers
window.navigate = navigate;
window.selectJar = selectJar;
window.openGoalDetail = openGoalDetail;
window.openLogMoneyModal = openLogMoneyModal;
window.openAddGoalModal = openAddGoalModal;
window.openAddToGoalModal = openAddToGoalModal;
window.openAddScheduleModal = openAddScheduleModal;
window.openAddJarModal = openAddJarModal;
window.openAvatarModal = openAvatarModal;
window.openEditNameModal = openEditNameModal;
window.submitLogMoney = submitLogMoney;
window.submitAddGoal = submitAddGoal;
window.submitAddToGoal = submitAddToGoal;
window.submitAddSchedule = submitAddSchedule;
window.submitAddJar = submitAddJar;
window.submitEditName = submitEditName;
window.submitSplits = submitSplits;
window.closeModal = closeModal;
window.toggleTheme = toggleTheme;
window.setAvatar = setAvatar;
window.confirmDeleteJar = confirmDeleteJar;
window.updateSplitHint = updateSplitHint;
window.openQuickSettings = openQuickSettings;
