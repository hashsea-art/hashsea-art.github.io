// Table sorting state and header interactions.
import { state } from '../state.js';

let onSortChange = () => {};

function getSortHeaders() {
  return Array.from(document.querySelectorAll('th.sortable'));
}

function nextSortDir(dir) {
  return dir === 'asc' ? 'desc' : 'asc';
}

function findSortRuleIndex(col) {
  return state.sortRules.findIndex((rule) => rule.col === col);
}

function setSingleSortRule(col) {
  const idx = findSortRuleIndex(col);
  if (idx === 0) {
    state.sortRules = [{ col, dir: nextSortDir(state.sortRules[0].dir) }];
    return;
  }

  const existing = idx >= 0 ? state.sortRules[idx] : null;
  state.sortRules = [{ col, dir: existing ? existing.dir : 'asc' }];
}

function extendSortRules(col) {
  const idx = findSortRuleIndex(col);
  if (idx === -1) {
    state.sortRules = [...state.sortRules, { col, dir: 'asc' }];
    return;
  }

  const updated = state.sortRules.slice();
  updated[idx] = { col, dir: nextSortDir(updated[idx].dir) };
  state.sortRules = updated;
}

function sortKey(movie, col) {
  const value = movie[col];
  if (col === 'date_watched') {
    const dateValue = movie.first_watched || value;
    if (!dateValue) return null;
    const time = new Date(dateValue).getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (col === 'notes') {
    return value === '' || value == null ? null : String(value).toLowerCase();
  }

  if (col === 'review_link') {
    if (movie.review_link) return '0|' + String(movie.review_link).toLowerCase();
    if (movie.notes) return '1|' + String(movie.notes).toLowerCase();
    return null;
  }

  return value === '' || value === undefined ? null : value;
}

export function applySort() {
  state.filtered.sort((a, b) => {
    for (const rule of state.sortRules) {
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

    return 0;
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
    th.title = 'Click to sort. Shift-click to add another sort.';
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
