// Table sorting state and header interactions.
import { DEFAULT_SORT_RULES } from '../constants.js';
import { state } from '../state.js';

let onSortChange = () => {};

function getSortHeaders() {
  return Array.from(document.querySelectorAll('th.sortable'));
}

function defaultSortRules() {
  return DEFAULT_SORT_RULES.map((rule) => ({ ...rule }));
}

function effectiveSortRules() {
  const rules = state.sortRules.map((rule) => ({ ...rule }));
  const hasReviewSort = rules.some((rule) => rule.col === 'review_link');
  if (!hasReviewSort) return rules;

  const defaultRules = defaultSortRules().filter(
    (defaultRule) => !rules.some((rule) => rule.col === defaultRule.col)
  );
  return [...rules, ...defaultRules];
}

function nextSortDir(dir) {
  if (dir === 'desc') return 'asc';
  if (dir === 'asc') return null;
  return 'desc';
}

function findSortRuleIndex(col) {
  return state.sortRules.findIndex((rule) => rule.col === col);
}

function setSingleSortRule(col) {
  const idx = findSortRuleIndex(col);
  if (idx === 0) {
    const nextDir = nextSortDir(state.sortRules[0].dir);
    state.sortRules = nextDir ? [{ col, dir: nextDir }] : defaultSortRules();
    return;
  }

  const existing = idx >= 0 ? state.sortRules[idx] : null;
  state.sortRules = [{ col, dir: existing ? existing.dir : 'desc' }];
}

function extendSortRules(col) {
  const idx = findSortRuleIndex(col);
  if (idx === -1) {
    state.sortRules = [...state.sortRules, { col, dir: 'desc' }];
    return;
  }

  const nextDir = nextSortDir(state.sortRules[idx].dir);
  if (!nextDir) {
    const updated = state.sortRules.filter((_, ruleIdx) => ruleIdx !== idx);
    state.sortRules = updated.length ? updated : defaultSortRules();
    return;
  }

  const updated = state.sortRules.slice();
  updated[idx] = { col, dir: nextDir };
  state.sortRules = updated;
}

function sortKey(movie, col) {
  const value = movie[col];
  if (col === 'date_watched') {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (col === 'notes') {
    return value === '' || value == null ? null : String(value).toLowerCase();
  }

  if (col === 'review_link') {
    return movie.review_link ? 1 : 0;
  }

  return value === '' || value === undefined ? null : value;
}

export function applySort() {
  const originalOrder = new Map(state.allMovies.map((movie, idx) => [movie, idx]));
  const rules = effectiveSortRules();

  state.filtered.sort((a, b) => {
    for (const rule of rules) {
      const av = sortKey(a, rule.col);
      const bv = sortKey(b, rule.col);
      const aNullish = av === null || av === '';
      const bNullish = bv === null || bv === '';

      if (aNullish && bNullish) continue;
      if (aNullish) return 1;
      if (bNullish) return -1;

      if (typeof av === 'number' && typeof bv === 'number') {
        const diff = rule.dir === 'asc' ? av - bv : bv - av;
        if (diff !== 0) return diff;
        continue;
      }

      const diff =
        rule.dir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      if (diff !== 0) return diff;
    }

    return (originalOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (originalOrder.get(b) ?? Number.MAX_SAFE_INTEGER);
  });
}

export function syncSortUI() {
  getSortHeaders().forEach((th) => {
    th.classList.remove('sort-asc', 'sort-desc');
    const indicator = th.querySelector('.sort-ind');
    if (indicator) delete indicator.dataset.priority;

    const idx = findSortRuleIndex(th.dataset.col);
    if (idx === -1) return;

    th.classList.add(state.sortRules[idx].dir === 'asc' ? 'sort-asc' : 'sort-desc');
    if (indicator && state.sortRules.length > 1) indicator.dataset.priority = String(idx + 1);
  });
}

export function initSort({ onChange }) {
  onSortChange = onChange;

  getSortHeaders().forEach((th) => {
    th.addEventListener('click', (event) => {
      const col = th.dataset.col;
      if (!col) return;

      if (event.shiftKey) {
        extendSortRules(col);
      } else {
        setSingleSortRule(col);
      }

      state.currentPage = 1;
      applySort();
      onSortChange();
      syncSortUI();
    });
  });
}
