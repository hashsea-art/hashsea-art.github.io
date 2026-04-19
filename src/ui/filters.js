// Search, chart-filter, and page-size interactions for narrowing the film list.
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, MONTH_LABELS, RATING_STEPS } from '../constants.js';
import { state } from '../state.js';
import { getMovieHeatmapDate, getMovieReleaseYear, monthHeatmapKey } from '../movies.js';
import { makeEl } from '../utils/dom.js';
import { renderMonthHeatmap } from './heatmap.js';
import { applySort } from './sort.js';

let onResultsChange = () => {};
let onRebuildCharts = () => {};
let shouldShowDraftVerification = false;
const SPECIAL_SEARCH_TYPES = new Map([
  ['score', 'score'],
  ['rating', 'rating'],
  ['year', 'release_year'],
]);

function getElements() {
  return {
    searchInput: document.getElementById('searchInput'),
    searchStatus: document.getElementById('searchStatus'),
    searchClear: document.getElementById('searchClear'),
    searchApply: document.getElementById('searchApply'),
    pageSizeSelect: document.getElementById('pageSizeSelect'),
    activeFilters: document.getElementById('activeFilters'),
    activeSearchFilter: document.getElementById('activeSearchFilter'),
    activeSearchFilterLabel: document.getElementById('activeSearchFilterLabel'),
    activeSearchFilterClear: document.getElementById('activeSearchFilterClear'),
    backToChartsButton: document.getElementById('backToChartsButton'),
    activeChartFilters: document.getElementById('activeChartFilters'),
    chartsAnchor: document.getElementById('chartsAnchor'),
    filmsAnchor: document.getElementById('filmsAnchor'),
    filmsSection: document.getElementById('filmsSection'),
    tableWrap: document.getElementById('tableWrap'),
  };
}

function normalizedSearchTerm(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function integerOnly(value) {
  if (!/^-?\d+$/.test(value)) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatChartFilterEntryLabel(filter) {
  if (filter.type === 'score') return 'Score: ' + filter.value;
  if (filter.type === 'rating') return 'Rating: ' + filter.value + ' stars';
  if (filter.type === 'release_year') return 'Year: ' + filter.value;
  if (filter.type === 'watched_month') return 'Watched: ' + watchedMonthFilterLabel(filter);
  return '';
}

function draftChartFilterMessage(filter) {
  const label = formatChartFilterEntryLabel(filter);

  if (filter.type === 'score' && state.activeChartFilters.rating) {
    return 'Press Enter to replace ' + formatChartFilterEntryLabel(state.activeChartFilters.rating) + ' with ' + label + '.';
  }

  if (filter.type === 'rating' && state.activeChartFilters.score) {
    return 'Press Enter to replace ' + formatChartFilterEntryLabel(state.activeChartFilters.score) + ' with ' + label + '.';
  }

  return 'Press Enter to apply ' + label + '.';
}

function parseDraftSearch(value) {
  const normalized = normalizedSearchTerm(value);
  if (!normalized) return { kind: 'empty' };

  const firstColon = normalized.indexOf(':');
  if (firstColon === -1) return { kind: 'text', term: normalized };

  if (normalized.indexOf(':', firstColon + 1) !== -1) {
    return {
      kind: 'invalid',
      message: 'Use only one colon filter at a time. Allowed filters are Score: Year: and Rating:.',
    };
  }

  const prefix = normalized.slice(0, firstColon).trim().toLowerCase();
  const rawValue = normalized.slice(firstColon + 1).trim();
  const filterType = SPECIAL_SEARCH_TYPES.get(prefix);

  if (!filterType) {
    return {
      kind: 'invalid',
      message: 'Only Score: Year: and Rating: can be used with a colon.',
    };
  }

  if (!rawValue) {
    return {
      kind: 'invalid',
      message: 'Add a value after ' + prefix.charAt(0).toUpperCase() + prefix.slice(1) + ':',
    };
  }

  if (filterType === 'score') {
    const score = integerOnly(rawValue);
    if (score === null || score < 1 || score > 100) {
      return {
        kind: 'invalid',
        message: 'Use Score: with a whole number from 1 to 100 only.',
      };
    }

    const filter = { type: 'score', value: score };
    return { kind: 'chart', filter, message: draftChartFilterMessage(filter) };
  }

  if (filterType === 'release_year') {
    const year = integerOnly(rawValue);
    if (year === null || year <= 0) {
      return {
        kind: 'invalid',
        message: 'Use Year: with a whole-number release year only.',
      };
    }

    const filter = { type: 'release_year', value: year };
    return { kind: 'chart', filter, message: draftChartFilterMessage(filter) };
  }

  const rating = Number(rawValue);
  const matchesStep =
    /^-?\d+(\.\d+)?$/.test(rawValue) &&
    Number.isFinite(rating) &&
    RATING_STEPS.some((step) => Math.abs(step - rating) < 1e-6);

  if (!matchesStep) {
    return {
      kind: 'invalid',
      message: 'Use Rating: with a value from 0.5 to 5 in 0.5 steps only.',
    };
  }

  const filter = { type: 'rating', value: rating };
  return { kind: 'chart', filter, message: draftChartFilterMessage(filter) };
}

function commitSearchTerm(term) {
  const normalized = normalizedSearchTerm(term);
  if (!normalized) return;
  if (!state.committedSearchTerms.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
    state.committedSearchTerms.push(normalized);
  }
}

function clearCommittedSearchTerms() {
  state.committedSearchTerms = [];
}

function matchesSearch(movie, raw) {
  const query = raw.trim();
  if (!query) return true;

  const titleHit = movie.movie.toLowerCase().includes(query.toLowerCase());
  const notesHit =
    movie.notes && typeof movie.notes === 'string' && movie.notes.toLowerCase().includes(query.toLowerCase());

  const trimmed = query.trim();
  const asInt = parseInt(trimmed, 10);
  const isIntOnly = trimmed !== '' && String(asInt) === trimmed;
  const yearHit = isIntOnly && movie.year !== null && movie.year === asInt;

  let scoreHit = false;
  if (movie.score !== null) {
    if (isIntOnly) {
      scoreHit = movie.score === asInt;
    } else {
      const numeric = parseFloat(trimmed.replace(/,/g, ''));
      if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed.replace(/,/g, ''))) {
        scoreHit = Math.abs(movie.score - numeric) < 1e-6;
      }
    }
  }

  return titleHit || notesHit || yearHit || scoreHit;
}

function matchesChartFilter(movie) {
  const filters = Object.values(state.activeChartFilters);
  if (!filters.length) return true;

  return filters.every((filter) => {
    if (filter.type === 'score') return movie.score !== null && Math.round(movie.score) === filter.value;
    if (filter.type === 'rating') return movie.rating !== null && Math.abs(movie.rating - filter.value) < 1e-6;
    if (filter.type === 'release_year') return getMovieReleaseYear(movie) === filter.value;
    if (filter.type === 'watched_month') {
      const date = getMovieHeatmapDate(movie);
      if (!date) return false;
      return monthHeatmapKey(date.getFullYear(), date.getMonth()) === filter.value;
    }
    return true;
  });
}

function searchFilterLabel() {
  const parts = state.committedSearchTerms.map((term) => '"' + term + '"');
  return 'Search: ' + parts.join(' + ');
}

export function watchedMonthFilterLabel(filter) {
  return MONTH_LABELS[filter.monthIndex] + ' ' + filter.year;
}

export function chartFilterLabel() {
  const labels = [];
  if (state.activeChartFilters.score) labels.push('score ' + state.activeChartFilters.score.value);
  if (state.activeChartFilters.rating) labels.push(state.activeChartFilters.rating.value + ' stars');
  if (state.activeChartFilters.release_year) labels.push('released in ' + state.activeChartFilters.release_year.value);
  if (state.activeChartFilters.watched_month) {
    labels.push('watched in ' + watchedMonthFilterLabel(state.activeChartFilters.watched_month));
  }
  return labels.join(' + ');
}

export function hasActiveChartFilter() {
  return Object.keys(state.activeChartFilters).length > 0;
}

function hasChartsSectionFilter() {
  return !!(
    state.activeChartFilters.score ||
    state.activeChartFilters.rating ||
    state.activeChartFilters.release_year
  );
}

function chartFilterEntries() {
  const entries = [];
  if (state.activeChartFilters.score) {
    entries.push({ type: 'score', label: formatChartFilterEntryLabel(state.activeChartFilters.score) });
  }
  if (state.activeChartFilters.rating) {
    entries.push({ type: 'rating', label: formatChartFilterEntryLabel(state.activeChartFilters.rating) });
  }
  if (state.activeChartFilters.release_year) {
    entries.push({ type: 'release_year', label: formatChartFilterEntryLabel(state.activeChartFilters.release_year) });
  }
  if (state.activeChartFilters.watched_month) {
    entries.push({
      type: 'watched_month',
      label: formatChartFilterEntryLabel(state.activeChartFilters.watched_month),
    });
  }
  return entries;
}

function renderActiveChartFilters() {
  const { activeChartFilters } = getElements();
  if (!activeChartFilters) return;

  const entries = chartFilterEntries();
  activeChartFilters.textContent = '';
  activeChartFilters.hidden = entries.length === 0;

  entries.forEach((entry) => {
    const pill = makeEl('div', 'active-filter');
    pill.appendChild(makeEl('span', 'active-filter-label', entry.label));

    const clear = makeEl('button', 'active-filter-clear', '\u2715');
    clear.type = 'button';
    clear.setAttribute('aria-label', 'Clear ' + entry.label + ' filter');
    clear.addEventListener('click', () => {
      clearChartFilterType(entry.type);
    });

    pill.appendChild(clear);
    activeChartFilters.appendChild(pill);
  });
}

function renderSearchStatus(draftState, shouldShow) {
  const { searchStatus } = getElements();
  if (!searchStatus) return;

  if (!shouldShow || (draftState.kind !== 'chart' && draftState.kind !== 'invalid')) {
    searchStatus.hidden = true;
    searchStatus.removeAttribute('data-tone');
    searchStatus.textContent = '';
    return;
  }

  searchStatus.hidden = false;
  searchStatus.dataset.tone = draftState.kind === 'invalid' ? 'error' : 'hint';
  searchStatus.textContent = draftState.message;
}

function submitSearchDraft() {
  const { searchInput } = getElements();
  if (!searchInput) return;

  shouldShowDraftVerification = true;
  const draftState = parseDraftSearch(searchInput.value);

  if (draftState.kind === 'empty') {
    shouldShowDraftVerification = false;
    return;
  }

  if (draftState.kind === 'text') {
    commitSearchTerm(draftState.term);
    shouldShowDraftVerification = false;
    searchInput.value = '';
    state.currentPage = 1;
    syncSearchUi();
    applyFilter();
    return;
  }

  if (draftState.kind === 'chart') {
    shouldShowDraftVerification = false;
    searchInput.value = '';
    syncSearchUi();
    setChartFilter(draftState.filter);
    return;
  }

  syncSearchUi();
}

export function syncSearchUi() {
  const el = getElements();
  if (!el.searchInput || !el.searchClear) return;

  const draftState = parseDraftSearch(el.searchInput.value);
  const hasInvalidDraft = shouldShowDraftVerification && draftState.kind === 'invalid';
  const searchInputWrap = el.searchInput.closest('.search-input-wrap');
  const hasDraftValue = el.searchInput.value.trim().length > 0;

  el.searchClear.hidden = !hasDraftValue;
  if (el.searchApply) el.searchApply.hidden = !hasDraftValue;
  el.searchInput.setAttribute('aria-invalid', hasInvalidDraft ? 'true' : 'false');
  searchInputWrap?.classList.toggle('search-input-wrap--has-apply', hasDraftValue);
  searchInputWrap?.classList.toggle('search-input-wrap--invalid', hasInvalidDraft);
  renderSearchStatus(draftState, shouldShowDraftVerification);

  const hasCommittedSearch = state.committedSearchTerms.length > 0;
  const hasSearch = hasCommittedSearch;
  const hasChart = hasActiveChartFilter();
  const hasChartsFilter = hasChartsSectionFilter();

  if (el.activeSearchFilter && el.activeSearchFilterLabel) {
    el.activeSearchFilter.hidden = !hasSearch;
    el.activeSearchFilterLabel.textContent = hasSearch ? searchFilterLabel() : '';
  }

  if (el.backToChartsButton) {
    el.backToChartsButton.hidden = !hasChartsFilter;
  }

  renderActiveChartFilters();

  if (el.activeFilters) {
    el.activeFilters.hidden = !hasSearch && !hasChart;
  }
}

export function applyFilter() {
  state.filtered = state.allMovies.filter((movie) => {
    const committedMatch = state.committedSearchTerms.every((term) => matchesSearch(movie, term));
    return committedMatch && matchesChartFilter(movie);
  });

  applySort();
  renderMonthHeatmap();
  onResultsChange();
}

export function setChartFilter(filter) {
  const nextFilters = { ...state.activeChartFilters };

  if (filter.type === 'score' || filter.type === 'rating') {
    delete nextFilters.score;
    delete nextFilters.rating;
    nextFilters[filter.type] = filter;
  } else {
    nextFilters[filter.type] = filter;
  }

  state.activeChartFilters = nextFilters;
  syncSearchUi();
  state.currentPage = 1;
  applyFilter();

  const { filmsAnchor, filmsSection, tableWrap } = getElements();
  (filmsAnchor || filmsSection || tableWrap)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function clearChartFilterType(type) {
  if (!state.activeChartFilters[type]) return;
  delete state.activeChartFilters[type];
  state.activeChartFilters = { ...state.activeChartFilters };
  syncSearchUi();
  onRebuildCharts();
  state.currentPage = 1;
  applyFilter();
}

export function initFilters({ onChange, onChartsRebuild }) {
  onResultsChange = onChange;
  onRebuildCharts = onChartsRebuild;

  const el = getElements();
  if (!el.searchInput || !el.searchClear || !el.searchApply) return;

  if (el.pageSizeSelect) el.pageSizeSelect.value = String(state.pageSize);

  el.searchInput.addEventListener('input', () => {
    shouldShowDraftVerification = false;
    syncSearchUi();
  });

  el.searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    submitSearchDraft();
  });

  el.searchClear.addEventListener('click', () => {
    shouldShowDraftVerification = false;
    el.searchInput.value = '';
    syncSearchUi();
  });

  el.searchApply.addEventListener('click', () => {
    submitSearchDraft();
  });

  if (el.pageSizeSelect) {
    el.pageSizeSelect.addEventListener('change', () => {
      const next = parseInt(el.pageSizeSelect.value, 10);
      state.pageSize = PAGE_SIZE_OPTIONS.includes(next) ? next : DEFAULT_PAGE_SIZE;
      state.currentPage = 1;
      onResultsChange();
    });
  }

  if (el.activeSearchFilterClear) {
    el.activeSearchFilterClear.addEventListener('click', () => {
      clearCommittedSearchTerms();
      shouldShowDraftVerification = false;
      el.searchInput.value = '';
      syncSearchUi();
      state.currentPage = 1;
      applyFilter();
    });
  }

  if (el.backToChartsButton) {
    el.backToChartsButton.addEventListener('click', () => {
      el.chartsAnchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  syncSearchUi();
}
