// Kelly Criterion formulas and problem generators.
// Pure functions — no DOM, safe to load standalone for tests.

export function gamblingKelly(p, b) {
  return p - (1 - p) / b;
}

export function investmentKelly(p, g, l) {
  return p / l - (1 - p) / g;
}

const isWholePercent = (f) => {
  const pct = f * 100;
  return Math.abs(pct - Math.round(pct)) < 1e-9;
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const cross = (...arrs) =>
  arrs.reduce((acc, cur) => acc.flatMap((a) => cur.map((c) => [...a, c])), [[]]);

// ---- Easy generators: only emit problems with whole-percent answers ----

const EASY_GAMBLING_PROBLEMS = (() => {
  const ps = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90];
  const bs = [1, 2, 4, 5];
  return cross(ps, bs)
    .map(([p, b]) => ({ p, b, f: gamblingKelly(p, b) }))
    .filter(({ f }) => f > 0 && f <= 1.0 && isWholePercent(f))
    .map(({ p, b, f }) => ({
      mode: 'gambling',
      params: { p, b },
      answer: Math.round(f * 100),
    }));
})();

const EASY_INVESTMENT_PROBLEMS = (() => {
  const ps = [0.50, 0.55, 0.60, 0.65, 0.70];
  const gls = [0.25, 0.50, 1.00];
  return cross(ps, gls, gls)
    .map(([p, g, l]) => ({ p, g, l, f: investmentKelly(p, g, l) }))
    .filter(({ f }) => f > 0 && f <= 2.5 && isWholePercent(f))
    .map(({ p, g, l, f }) => ({
      mode: 'investment',
      params: { p, g, l },
      answer: Math.round(f * 100),
    }));
})();

export function genGamblingEasy() {
  return { ...pick(EASY_GAMBLING_PROBLEMS), tolerance: 0 };
}

export function genInvestmentEasy() {
  return { ...pick(EASY_INVESTMENT_PROBLEMS), tolerance: 0 };
}

// ---- Hard generators: realistic params, ±1pp tolerance ----

export function genGamblingHard() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const p = (51 + Math.floor(Math.random() * 44)) / 100; // 0.51..0.94
    const b = pick([0.5, 1, 1.5, 2, 2.5, 3, 4, 5]);
    const f = gamblingKelly(p, b);
    if (f > 0.01 && f <= 1.5) {
      return {
        mode: 'gambling',
        params: { p, b },
        answer: Math.round(f * 100),
        tolerance: 1,
      };
    }
  }
  return genGamblingEasy(); // fallback (should never hit)
}

export function genInvestmentHard() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const p = (45 + Math.floor(Math.random() * 41)) / 100; // 0.45..0.85
    const step = (lo, hi) => (lo + Math.floor(Math.random() * ((hi - lo) / 0.05 + 1)) * 0.05);
    const g = +step(0.10, 1.00).toFixed(2);
    const l = +step(0.10, 1.00).toFixed(2);
    const f = investmentKelly(p, g, l);
    if (f > 0.01 && f <= 3.0) {
      return {
        mode: 'investment',
        params: { p, g, l },
        answer: Math.round(f * 100),
        tolerance: 1,
      };
    }
  }
  return genInvestmentEasy(); // fallback
}

// ---- Top-level dispatcher ----

export function genProblem(mode, difficulty) {
  const easy = difficulty === 'easy';
  if (mode === 'gambling') return easy ? genGamblingEasy() : genGamblingHard();
  if (mode === 'investment') return easy ? genInvestmentEasy() : genInvestmentHard();
  // mixed
  const m = Math.random() < 0.5 ? 'gambling' : 'investment';
  return easy
    ? (m === 'gambling' ? genGamblingEasy() : genInvestmentEasy())
    : (m === 'gambling' ? genGamblingHard() : genInvestmentHard());
}

// ---- Pretty-printers for the UI ----

export function describe(problem) {
  const { mode, params } = problem;
  if (mode === 'gambling') {
    const { p, b } = params;
    const bStr = Number.isInteger(b) ? `${b}-to-1` : `${b}-to-1`;
    return {
      title: 'Gambling Kelly',
      lines: [
        `Win probability: ${Math.round(p * 100)}%`,
        `Payout: ${bStr}`,
      ],
      formula: 'f* = p − (1−p)/b',
    };
  }
  // investment
  const { p, g, l } = params;
  return {
    title: 'Investment Kelly',
    lines: [
      `P(win): ${Math.round(p * 100)}%`,
      `Win gain: +${Math.round(g * 100)}%`,
      `Loss: −${Math.round(l * 100)}%`,
    ],
    formula: 'f* = p/L − (1−p)/G',
  };
}

// ---- Worked solution formatter ----

const fmt = (x) => Number(x.toFixed(4)).toString();

export function solve(problem) {
  if (problem.mode === 'gambling') {
    const { p, b } = problem.params;
    const q = 1 - p;
    const qOverB = q / b;
    const f = p - qOverB;
    return [
      `f* = p − (1−p)/b`,
      `   = ${fmt(p)} − (1 − ${fmt(p)})/${fmt(b)}`,
      `   = ${fmt(p)} − ${fmt(q)}/${fmt(b)}`,
      `   = ${fmt(p)} − ${fmt(qOverB)}`,
      `   = ${fmt(f)}`,
      `   = ${Math.round(f * 100)}%`,
    ];
  }
  const { p, g, l } = problem.params;
  const q = 1 - p;
  const pOverL = p / l;
  const qOverG = q / g;
  const f = pOverL - qOverG;
  return [
    `f* = p/L − (1−p)/G`,
    `   = ${fmt(p)}/${fmt(l)} − (1 − ${fmt(p)})/${fmt(g)}`,
    `   = ${fmt(p)}/${fmt(l)} − ${fmt(q)}/${fmt(g)}`,
    `   = ${fmt(pOverL)} − ${fmt(qOverG)}`,
    `   = ${fmt(f)}`,
    `   = ${Math.round(f * 100)}%`,
  ];
}

// Exposed for the test page.
export const _internal = {
  EASY_GAMBLING_PROBLEMS,
  EASY_INVESTMENT_PROBLEMS,
  isWholePercent,
};
