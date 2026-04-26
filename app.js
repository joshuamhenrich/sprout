'use strict';

/* ============================================================
   Sprout — kid-first budgeting prototype
   Vanilla JS + localStorage. No build step.
   ============================================================ */

// ---------- Storage ----------
const STORAGE_KEY = 'sprout_v1';

function seedState() {
  return {
    user: { name: 'Alex', avatar: 'A' },
    splits: { save: 0.5, spend: 0.4, give: 0.1 },
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
    if (raw) return JSON.parse(raw);
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

// ---------- Helpers ----------
const JAR_META = {
  save:  { name: 'Save',  emoji: '🌱', color: 'save'  },
  spend: { name: 'Spend', emoji: '🛍️', color: 'spend' },
  give:  { name: 'Give',  emoji: '💛', color: 'give'  }
};

function uid() { return 'x' + Math.random().toString(36).slice(2, 9); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmt(n) { return '$' + (Math.round(Math.abs(n) * 100) / 100).toFixed(2); }
function round2(n) { return Math.round(n * 100) / 100; }
function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// ---------- Computed ----------
function jarBalance(jar) {
  return state.transactions
    .filter(t => t.jar === jar)
    .reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
}
function totalBalance() {
  return jarBalance('save') + jarBalance('spend') + jarBalance('give');
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
  const meta = opts.showJar ? ` · in ${JAR_META[g.jar].name}` : '';
  return `
    <div class="goal-card" style="margin: 0 0 10px;" onclick="openGoalDetail('${g.id}')">
      <div class="goal-row">
        <div class="goal-thumb">${escape(g.emoji)}</div>
        <div class="goal-info">
          <div class="goal-name">${escape(g.name)}</div>
          <div class="goal-progress-text">${fmt(progress)} of ${fmt(g.target)}${meta}</div>
        </div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct.toFixed(1)}%"></div></div>
    </div>
  `;
}

// ---------- Render: Home ----------
function renderHome() {
  const total = totalBalance();
  const recentIn = thisWeekIncome();
  const upcoming = upcomingSchedule(3);
  const activeGoal = state.goals[0];

  document.getElementById('home').innerHTML = `
    <div class="status-bar"><span>9:41</span><span>•••</span></div>
    <div class="top-bar">
      <div class="greeting">Hey, ${escape(state.user.name)}</div>
      <div class="avatar">${escape(state.user.avatar)}</div>
    </div>
    <div class="balance-card">
      <div class="balance-label">Total balance</div>
      <div class="balance-amount">${fmt(total)}</div>
      ${recentIn > 0 ? `<div class="balance-meta"><span class="pill-positive">+${fmt(recentIn)} this week</span></div>` : ''}
    </div>
    <div class="section-h"><h3>My Jars</h3></div>
    <div class="jars">
      ${['save','spend','give'].map(j => `
        <div class="jar ${j}" onclick="selectJar('${j}'); navigate('jars');">
          <div class="jar-icon">${JAR_META[j].emoji}</div>
          <div class="jar-name">${JAR_META[j].name}</div>
          <div class="jar-amount">${fmt(jarBalance(j))}</div>
        </div>
      `).join('')}
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
    <div class="status-bar"><span>9:41</span><span>•••</span></div>
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
  const meta = JAR_META[j];
  const goalsInJar = state.goals.filter(g => g.jar === j);
  const recent = recentForJar(j);
  document.getElementById('jars').innerHTML = `
    <div class="status-bar"><span>9:41</span><span>•••</span></div>
    <div class="screen-header">
      <div class="back-btn" onclick="navigate('home')">‹</div>
      <div class="screen-title">Jars</div>
    </div>
    <div class="jar-tabs">
      ${['save','spend','give'].map(jj => `
        <div class="jar-tab ${jj === j ? 'active' : ''}" onclick="selectJar('${jj}')">
          ${JAR_META[jj].emoji} ${JAR_META[jj].name}
        </div>
      `).join('')}
    </div>
    <div class="jar-balance-card">
      <div class="jar-emoji-big">${meta.emoji}</div>
      <div class="jar-balance-label">In your ${meta.name.toLowerCase()} jar</div>
      <div class="jar-balance-amount jar-${j}">${fmt(jarBalance(j))}</div>
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
  `;
}

// ---------- Render: Goals ----------
function renderGoals() {
  document.getElementById('goals').innerHTML = `
    <div class="status-bar"><span>9:41</span><span>•••</span></div>
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
    <div class="status-bar"><span>9:41</span><span>•••</span></div>
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
  `;
}

function render() {
  renderHome();
  renderSchedule();
  renderJars();
  renderGoals();
  renderGoalDetail();
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
        ${['save','spend','give'].map(jj => `
          <label class="jar-pick">
            <input type="radio" name="jar" value="${jj}" ${defaultJar === jj ? 'checked' : ''}>
            <div class="jar-pick-content">
              <div class="jar-pick-emoji">${JAR_META[jj].emoji}</div>
              <div class="jar-pick-name">${JAR_META[jj].name}</div>
              <div class="jar-pick-meta">${fmt(jarBalance(jj))}</div>
            </div>
          </label>
        `).join('')}
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
  addGoal({ name, target, emoji: f.emoji.value, jar: 'save' });
  closeModal();
}

function openAddToGoalModal(goalId) {
  const g = state.goals.find(x => x.id === goalId);
  if (!g) return;
  const jarBal = jarBalance(g.jar);
  openModal(`
    <div class="modal-handle"></div>
    <h3>Add to ${escape(g.name)}</h3>
    <p class="modal-sub">From your ${JAR_META[g.jar].name} jar — ${fmt(jarBal)} available</p>
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

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (confirm('Reset all data to demo? Goals, transactions, and schedule items you added will be erased.')) {
      localStorage.removeItem(STORAGE_KEY);
      state = seedState();
      saveState();
      currentJar = 'save';
      currentGoalId = null;
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
window.submitLogMoney = submitLogMoney;
window.submitAddGoal = submitAddGoal;
window.submitAddToGoal = submitAddToGoal;
window.submitAddSchedule = submitAddSchedule;
window.closeModal = closeModal;
