import { genProblem, describe, solve } from './kelly.js';
import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { getUser, isOwner, signInWithGoogle, signOut, onAuthChange, OWNER_EMAIL } from './auth.js';

// ---------------- State ----------------

const SETTINGS_KEY = 'kelly.settings.v1';
const HISTORY_KEY = 'kelly.history.v1';

const DEFAULTS = { mode: 'gambling', difficulty: 'easy', duration: 120 };

const state = {
  settings: loadSettings(),
  current: null, // { problem, startedAt }
  score: 0,
  attempts: 0,
  timerId: null,
  endsAt: 0,
  solutionShown: false,
};

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return { ...DEFAULTS, ...(raw || {}) };
  } catch { return { ...DEFAULTS }; }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); }
  catch { /* private mode / quota — skip */ }
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}
function saveHistory(history) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-100))); }
  catch { /* private mode / quota — skip */ }
}

function configKey(s = state.settings) {
  return `${s.mode}/${s.difficulty}/${s.duration}`;
}

// ---------------- DOM helpers ----------------

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showScreen(name) {
  $$('.screen').forEach((s) => {
    s.hidden = s.dataset.screen !== name;
  });
}

// ---------------- Settings UI ----------------

function initSegments() {
  $$('.seg').forEach((seg) => {
    const key = seg.dataset.key;
    seg.querySelectorAll('button').forEach((btn) => {
      const val = btn.dataset.val;
      btn.setAttribute('aria-pressed', String(state.settings[key] == val));
      btn.addEventListener('click', () => {
        const parsed = key === 'duration' ? Number(val) : val;
        state.settings[key] = parsed;
        saveSettings();
        seg.querySelectorAll('button').forEach((b) =>
          b.setAttribute('aria-pressed', String(b.dataset.val == val))
        );
        renderDiffHint();
        renderHistory();
      });
    });
  });
}

function renderDiffHint() {
  const hint = $('#diffHint');
  hint.textContent = state.settings.difficulty === 'easy'
    ? 'Clean whole-percent answers. Exact match required.'
    : 'Realistic parameters. Answers accepted within ±1%.';
}

function renderHistory() {
  const all = loadHistory();
  const key = configKey();
  const matches = all.filter((r) => r.key === key);
  const list = $('#historyList');
  const wrap = $('#history');
  list.innerHTML = '';
  if (matches.length === 0) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  matches.slice(-5).reverse().forEach((r) => {
    const li = document.createElement('li');
    const date = new Date(r.at);
    const stamp = `${date.getMonth() + 1}/${date.getDate()}`;
    li.innerHTML = `<span>${stamp}</span><span>${r.score} <span style="color:var(--fg-dim)">(${Math.round(100 * r.score / Math.max(1, r.attempts))}%)</span></span>`;
    list.appendChild(li);
  });
  const best = Math.max(...matches.map((r) => r.score));
  $('#best').textContent = `Best: ${best}`;
}

// ---------------- Game loop ----------------

function startGame() {
  state.score = 0;
  state.attempts = 0;
  state.endsAt = Date.now() + state.settings.duration * 1000;
  showScreen('game');
  $('#score').textContent = '0';
  $('#answer').value = '';
  $('#feedback').textContent = '';
  nextProblem();
  $('#answer').focus();

  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(tick, 200);
  tick();
}

function tick() {
  const remainingMs = state.endsAt - Date.now();
  if (remainingMs <= 0) {
    finishGame();
    return;
  }
  const sec = Math.ceil(remainingMs / 1000);
  const el = $('#timer');
  el.textContent = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}s`;
  el.classList.toggle('warn', sec <= 10);
}

function nextProblem() {
  state.solutionShown = false;
  $('#solution').hidden = true;
  $('#solution').textContent = '';
  $('#solutionsBtn').textContent = 'Solutions';

  const p = genProblem(state.settings.mode, state.settings.difficulty);
  state.current = p;
  const d = describe(p);
  $('#qTitle').textContent = d.title;
  $('#qLines').innerHTML = d.lines.map((l) => `<div>${l}</div>`).join('');
  $('#answer').value = '';
}

function checkAnswer() {
  if (state.solutionShown) return; // typing ignored after peek
  const raw = $('#answer').value.trim();
  if (raw === '') return;
  const n = Number(raw);
  if (!Number.isFinite(n)) return;
  const { answer, tolerance } = state.current;
  if (Math.abs(n - answer) <= tolerance) {
    state.score++;
    state.attempts++;
    $('#score').textContent = String(state.score);
    flash('good');
    nextProblem();
  }
  // wrong-but-still-typing: do nothing; user keeps typing.
}

function showSolution() {
  if (state.solutionShown || !state.current) return;
  state.solutionShown = true;
  state.attempts++; // counted as an attempt with no correct answer
  flash('bad');
  $('#solution').textContent = solve(state.current).join('\n');
  $('#solution').hidden = false;
  $('#solutionsBtn').textContent = 'Next';
}

function onSolutionsBtn() {
  if (state.solutionShown) {
    nextProblem();
    $('#answer').focus();
  } else {
    showSolution();
  }
}

function flash(kind) {
  const el = $('#answer');
  const cls = kind === 'good' ? 'flash-good' : 'flash-bad';
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 180);
}

function finishGame() {
  clearInterval(state.timerId);
  state.timerId = null;

  const record = {
    key: configKey(),
    score: state.score,
    attempts: state.attempts,
    at: Date.now(),
  };
  const history = loadHistory();
  history.push(record);
  saveHistory(history);

  recordToDb(record).catch((e) => console.warn('DB write failed:', e));

  $('#finalScore').textContent = String(state.score);
  const acc = state.attempts === 0 ? 0 : Math.round(100 * state.score / state.attempts);
  $('#finalAccuracy').textContent = `${acc}%`;

  const matches = history.filter((r) => r.key === record.key);
  const prevBest = Math.max(0, ...matches.slice(0, -1).map((r) => r.score));
  $('#finalBest').textContent =
    state.score > prevBest && state.score > 0
      ? `New best for this config (was ${prevBest})`
      : `Best for this config: ${Math.max(prevBest, state.score)}`;

  showScreen('results');
}

function quitGame() {
  clearInterval(state.timerId);
  state.timerId = null;
  showScreen('settings');
  renderHistory();
}

// ---------------- Database write ----------------
// Only the configured owner gets DB writes. Other visitors play freely with
// localStorage only — their submissions never touch the DB.

async function recordToDb(record) {
  if (!isSupabaseConfigured) return;
  if (!(await isOwner())) return;
  const sb = await getSupabase();
  if (!sb) return;
  const user = await getUser();
  const { error } = await sb.from('games').insert({
    user_id: user.id,
    mode: state.settings.mode,
    difficulty: state.settings.difficulty,
    duration_sec: Number(state.settings.duration),
    score: record.score,
    attempts: record.attempts,
    played_at: new Date(record.at).toISOString(),
  });
  if (error) throw error;
}

// ---------------- Auth bar ----------------

async function renderAuthBar() {
  if (!isSupabaseConfigured) return; // bar stays hidden
  const bar = $('#authBar');
  const status = $('#authStatus');
  const btn = $('#authBtn');
  const dashLink = $('#dashLink');
  bar.hidden = false;

  // Default to signed-out UI so the bar is never left visually empty.
  status.textContent = 'Loading…';
  btn.textContent = 'Sign in';
  btn.onclick = () => signInWithGoogle().catch((e) => console.warn(e));
  dashLink.hidden = true;

  try {
    const user = await getUser();
    if (!user) {
      status.textContent = '';
      return;
    }
    const owner = user.email === OWNER_EMAIL;
    status.textContent = owner ? 'Tracking on' : 'Signed in (not tracked)';
    btn.textContent = 'Sign out';
    btn.onclick = async () => { await signOut(); renderAuthBar(); };
    dashLink.hidden = !owner;
  } catch (e) {
    console.warn('renderAuthBar failed:', e);
    status.textContent = '';
  }
}

// ---------------- Wire-up ----------------

initSegments();
renderDiffHint();
renderHistory();
renderAuthBar();
onAuthChange(() => renderAuthBar());
showScreen('settings');

$('#startBtn').addEventListener('click', startGame);
$('#solutionsBtn').addEventListener('click', onSolutionsBtn);
$('#quitBtn').addEventListener('click', quitGame);
$('#playAgainBtn').addEventListener('click', startGame);
$('#backToSettingsBtn').addEventListener('click', () => { showScreen('settings'); renderHistory(); });

$('#answer').addEventListener('input', checkAnswer);
$('#answer').addEventListener('keydown', (e) => {
  // Enter also triggers a check (in case input event missed something)
  if (e.key === 'Enter') checkAnswer();
});

// ---------------- Service worker ----------------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // Silent: SW failures don't break the app, only offline mode.
    });
  });
}
