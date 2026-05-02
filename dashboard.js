import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { getUser, isOwner, signInWithGoogle, signOut, onAuthChange, OWNER_EMAIL } from './auth.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
  range: 'week',
  mode: 'all',
  rows: [],
  scoreChart: null,
  accuracyChart: null,
};

// ---------------- Gate ----------------

function showGate(msg, opts = {}) {
  $('#gate').hidden = false;
  $('#dashContent').hidden = true;
  $('#gateMsg').textContent = msg;
  $('#gateSignIn').hidden = !opts.signIn;
  $('#gateSignOut').hidden = !opts.signOut;
}

function showContent() {
  $('#gate').hidden = true;
  $('#dashContent').hidden = false;
}

async function gateCheck() {
  if (!isSupabaseConfigured) {
    showGate('Supabase is not configured. Edit config.js with your project URL, anon key, and owner email — see README.');
    return false;
  }
  const user = await getUser();
  if (!user) {
    showGate('Sign in to view your dashboard.', { signIn: true });
    $('#gateSignIn').onclick = () => signInWithGoogle().catch((e) => {
      console.warn(e);
      $('#gateMsg').textContent = `Sign-in failed: ${e?.message || e}`;
    });
    return false;
  }
  if (user.email !== OWNER_EMAIL) {
    showGate(`This dashboard is private. You are signed in as ${user.email}.`, { signOut: true });
    $('#gateSignOut').onclick = async () => { await signOut(); gateCheck(); };
    return false;
  }
  showContent();
  return true;
}

// ---------------- Data ----------------

function rangeSinceIso(range) {
  if (range === 'all') return null;
  const ms = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  }[range];
  return new Date(Date.now() - ms).toISOString();
}

async function loadRows() {
  const sb = await getSupabase();
  if (!sb) return [];
  let q = sb.from('games').select('*').order('played_at', { ascending: true });
  const since = rangeSinceIso(state.range);
  if (since) q = q.gte('played_at', since);
  if (state.mode !== 'all') q = q.eq('mode', state.mode);
  const { data, error } = await q;
  if (error) {
    console.warn('Failed to load games:', error.message);
    return [];
  }
  return data || [];
}

// ---------------- Render ----------------

function fmtPct(n) { return `${Math.round(n)}%`; }
function fmtDate(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
}

function renderStats(rows) {
  const grid = $('#statsGrid');
  if (rows.length === 0) {
    grid.innerHTML = `<div class="stat-card"><div class="stat-label">Sessions</div><div class="stat-value">0</div></div>`;
    return;
  }
  const sessions = rows.length;
  const totalQs = rows.reduce((s, r) => s + r.attempts, 0);
  const totalCorrect = rows.reduce((s, r) => s + r.score, 0);
  const best = Math.max(...rows.map((r) => r.score));
  const meanScore = totalCorrect / sessions;
  const meanAcc = totalQs > 0 ? (100 * totalCorrect / totalQs) : 0;
  grid.innerHTML = `
    <div class="stat-card"><div class="stat-label">Sessions</div><div class="stat-value">${sessions}</div></div>
    <div class="stat-card"><div class="stat-label">Best score</div><div class="stat-value">${best}</div></div>
    <div class="stat-card"><div class="stat-label">Mean score</div><div class="stat-value">${meanScore.toFixed(1)}</div></div>
    <div class="stat-card"><div class="stat-label">Mean accuracy</div><div class="stat-value">${fmtPct(meanAcc)}</div></div>
    <div class="stat-card"><div class="stat-label">Questions</div><div class="stat-value">${totalQs}</div></div>
    <div class="stat-card"><div class="stat-label">Correct</div><div class="stat-value">${totalCorrect}</div></div>
  `;
}

function renderRecent(rows) {
  const list = $('#recentList');
  const empty = $('#recentEmpty');
  list.innerHTML = '';
  if (rows.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  // Newest first.
  const recent = [...rows].slice(-15).reverse();
  for (const r of recent) {
    const acc = r.attempts > 0 ? Math.round(100 * r.score / r.attempts) : 0;
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="r-date">${fmtDate(r.played_at)}</span>
      <span class="r-cfg">${r.mode}/${r.difficulty}/${r.duration_sec}s</span>
      <span class="r-score">${r.score} <span class="r-dim">(${acc}%)</span></span>
    `;
    list.appendChild(li);
  }
}

const COLORS = {
  line: '#58a6ff',
  fill: 'rgba(88,166,255,0.15)',
  grid: 'rgba(255,255,255,0.06)',
  text: '#8b949e',
  good: '#3fb950',
  goodFill: 'rgba(63,185,80,0.15)',
};

function ensureChartLib() {
  // Chart.js + date-fns adapter are loaded as UMD globals from dashboard.html.
  if (typeof window.Chart === 'undefined') {
    throw new Error('Chart.js failed to load (offline?)');
  }
  return window.Chart;
}

function buildLineConfig({ points, label, color, fill, yMax }) {
  return {
    type: 'line',
    data: {
      datasets: [{
        label,
        data: points, // [{x: Date, y: number}]
        borderColor: color,
        backgroundColor: fill,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
        tension: 0.25,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'nearest', intersect: false },
      },
      scales: {
        x: {
          type: 'time',
          time: { tooltipFormat: 'PP p' },
          grid: { color: COLORS.grid },
          ticks: { color: COLORS.text, maxTicksLimit: 6 },
        },
        y: {
          beginAtZero: true,
          ...(yMax !== undefined ? { suggestedMax: yMax } : {}),
          grid: { color: COLORS.grid },
          ticks: { color: COLORS.text },
        },
      },
    },
  };
}

async function renderCharts(rows) {
  const Chart = ensureChartLib();

  const scorePts = rows.map((r) => ({ x: new Date(r.played_at), y: r.score }));
  const accPts = rows.map((r) => ({
    x: new Date(r.played_at),
    y: r.attempts > 0 ? Math.round(100 * r.score / r.attempts) : 0,
  }));

  if (state.scoreChart) state.scoreChart.destroy();
  if (state.accuracyChart) state.accuracyChart.destroy();

  state.scoreChart = new Chart(
    $('#scoreChart').getContext('2d'),
    buildLineConfig({ points: scorePts, label: 'Score', color: COLORS.line, fill: COLORS.fill }),
  );

  state.accuracyChart = new Chart(
    $('#accuracyChart').getContext('2d'),
    buildLineConfig({ points: accPts, label: 'Accuracy', color: COLORS.good, fill: COLORS.goodFill, yMax: 100 }),
  );
}

async function refresh() {
  state.rows = await loadRows();
  renderStats(state.rows);
  renderRecent(state.rows);
  await renderCharts(state.rows);
}

// ---------------- Segmented controls ----------------

function initSeg(id, key, onChange) {
  const seg = document.getElementById(id);
  const setPressed = (val) => {
    seg.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.val === val)));
  };
  setPressed(state[key]);
  seg.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state[key] = btn.dataset.val;
      setPressed(btn.dataset.val);
      onChange();
    });
  });
}

// ---------------- Boot ----------------

// Wire segs once on load — they're inside #dashContent which stays hidden until
// the gate passes, so it's safe to attach listeners eagerly.
initSeg('rangeSeg', 'range', refresh);
initSeg('modeSeg', 'mode', refresh);

async function boot() {
  const ok = await gateCheck();
  if (ok) await refresh();
}

boot();

// React to sign-in / sign-out without page reload (e.g., after OAuth redirect).
onAuthChange(async () => {
  const ok = await gateCheck();
  if (ok) await refresh();
});
