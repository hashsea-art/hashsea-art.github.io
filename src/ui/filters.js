// Search, chart-filter, and page-size interactions for narrowing the film list.
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, MONTH_LABELS } from '../constants.js';
import { state } from '../state.js';
import { getMovieHeatmapDate, getMovieReleaseYear, monthHeatmapKey } from '../movies.js';
import { makeEl } from '../utils/dom.js';
import { applySort } from './sort.js';

let onResultsChange = () => {};
let onRebuildCharts = () => {};

function getElements() {
  return {
    searchInput: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
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
  const { searchInput } = getElements();
  const draft = searchInput ? searchInput.value.trim() : '';
  const parts = state.committedSearchTerms.map((term) => '"' + term + '"');
  if (draft) parts.push('typing "' + draft + '"');
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
    entries.push({ type: 'score', label: 'Score: ' + state.activeChartFilters.score.value });
  }
  if (state.activeChartFilters.rating) {
    entries.push({ type: 'rating', label: 'Rating: ' + state.activeChartFilters.rating.value + ' stars' });
  }
  if (state.activeChartFilters.release_year) {
    entries.push({ type: 'release_year', label: 'Year: ' + state.activeChartFilters.release_year.value });
  }
  if (state.activeChartFilters.watched_month) {
    entries.push({
      type: 'watched_month',
      label: 'Watched: ' + watchedMonthFilterLabel(state.activeChartFilters.watched_month),
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

export function syncSearchUi() {
  const el = getElements();
  if (!el.searchInput || !el.searchClear) return;

  el.searchClear.hidden = el.searchInput.value.trim().length === 0;

  const hasDraftSearch = el.searchInput.value.trim().length > 0;
  const hasCommittedSearch = state.committedSearchTerms.length > 0;
  const hasSearch = hasDraftSearch || hasCommittedSearch;
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
  const { searchInput } = getElements();
  const draft = searchInput ? searchInput.value.trim() : '';

  state.filtered = state.allMovies.filter((movie) => {
    const committedMatch = state.committedSearchTerms.every((term) => matchesSearch(movie, term));
    const draftMatch = draft ? matchesSearch(movie, draft) : true;
    return committedMatch && draftMatch && matchesChartFilter(movie);
  });

  applySort();
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
  if (!el.searchInput || !el.searchClear) return;

  if (el.pageSizeSelect) el.pageSizeSelect.value = String(state.pageSize);

  el.searchInput.addEventListener('input', () => {
    state.currentPage = 1;
    syncSearchUi();
    applyFilter();
  });

  el.searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    const term = normalizedSearchTerm(el.searchInput.value);
    if (!term) return;

    event.preventDefault();
    commitSearchTerm(term);
    el.searchInput.value = '';
    state.currentPage = 1;
    syncSearchUi();
    applyFilter();
  });

  el.searchClear.addEventListener('click', () => {
    el.searchInput.value = '';
    syncSearchUi();
    state.currentPage = 1;
    applyFilter();
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
