// Film table rendering, pagination, and row-level interactions.
import { state } from '../state.js';
import { getLoggedWatchHistory, getMovieHeatmapDate, getWatchHistory, monthHeatmapKey, watchTimelineLabel } from '../movies.js';
import { makeEl } from '../utils/dom.js';
import { fmtDate, fmtNotesCell, fmtScore, formatTenths, scoreToneClass } from '../utils/format.js';
import { chartFilterLabel } from './filters.js';
import { syncSortUI } from './sort.js';

let onOpenDetail = () => {};
let _currentRows = [];

function getElements() {
  return {
    searchCount: document.getElementById('searchCount'),
    tableBody: document.getElementById('tableBody'),
    tableEmpty: document.getElementById('tableEmpty'),
    tableEmptyMsg: document.getElementById('tableEmptyMsg'),
    filmsTable: document.getElementById('filmsTable'),
    pagination: document.getElementById('pagination'),
    tableWrap: document.getElementById('tableWrap'),
  };
}

function createRewatchIndicatorElement() {
  const badge = makeEl('span', 'rewatch-indicator', '\u21bb');
  badge.setAttribute('aria-label', 'Rewatch');
  badge.title = 'Rewatch';
  return badge;
}

function createRatingCellContent(rating) {
  if (rating === null) return document.createTextNode('\u2014');
  const wrap = makeEl('span', 'rating-cell-inner');
  wrap.appendChild(document.createTextNode(String(rating) + ' '));
  const star = makeEl('span', 'rating-star', '\u2605');
  star.setAttribute('aria-hidden', 'true');
  wrap.appendChild(star);
  return wrap;
}

function createDeltaContent(score, previousScore) {
  const wrap = makeEl('span', 'delta-wrap');
  if (previousScore === null) {
    wrap.textContent = '\u2014';
    return wrap;
  }

  if (score === null || Math.abs(score - previousScore) < 0.05) {
    wrap.textContent = String(previousScore);
    return wrap;
  }

  wrap.appendChild(document.createTextNode(String(previousScore) + ' '));
  const delta = score - previousScore;
  const deltaText = (delta > 0 ? '+' : '') + formatTenths(delta);
  wrap.appendChild(makeEl('span', delta > 0 ? 'delta-pos' : 'delta-neg', deltaText));
  return wrap;
}

function createScoreContent(score) {
  return makeEl('span', 'score-bubble ' + scoreToneClass(score), fmtScore(score));
}

function createNotesCellContent(notes, reviewLink) {
  const noteText = fmtNotesCell(notes);
  if (!reviewLink) return document.createTextNode(noteText);

  const wrap = makeEl('div', 'notes-cell-content');
  if (noteText !== '\u2014') {
    wrap.appendChild(makeEl('span', 'notes-preview', noteText));
  }

  const link = makeEl('a', 'notes-review-link', 'LB Review');
  link.href = reviewLink;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.addEventListener('click', (event) => event.stopPropagation());
  link.addEventListener('keydown', (event) => event.stopPropagation());
  wrap.appendChild(link);

  return wrap;
}

function entryPreviewScore(chronological, entry) {
  if (entry.score !== null && entry.score !== undefined) return entry.score;

  const originalIndex = chronological.indexOf(entry);
  if (originalIndex === -1 || originalIndex >= chronological.length - 1) return null;

  const nextEntry = chronological[originalIndex + 1];
  if (
    nextEntry &&
    nextEntry.previous_score !== null &&
    nextEntry.previous_score !== undefined &&
    nextEntry.previous_score !== ''
  ) {
    return nextEntry.previous_score;
  }

  return null;
}

function buildEntryPreviewMeta(chronological, reversed, entry, idx) {
  let meta = watchTimelineLabel(reversed, entry, idx);

  if (entry.rating !== null) meta += ' \u00b7 ' + String(entry.rating) + ' \u2605';

  const score = entryPreviewScore(chronological, entry);
  if (score !== null) meta += ' \u00b7 ' + String(score);

  return meta;
}

function createDiaryPreviewElement(movie) {
  const history = getWatchHistory(movie);
  if (history.length <= 1) return null;

  const chronological = history.slice();
  const reversed = chronological.slice().reverse();
  const fragment = document.createDocumentFragment();
  const trigger = makeEl('span', 'entry-preview-trigger', '+' + history.length);
  trigger.setAttribute('aria-hidden', 'true');
  fragment.appendChild(trigger);

  const popover = makeEl('div', 'entry-preview-popover');
  popover.setAttribute('role', 'presentation');
  popover.appendChild(makeEl('div', 'entry-preview-title', 'Diary entries'));

  const list = makeEl('ul', 'entry-preview-list');
  reversed.forEach((entry, idx) => {
    const item = makeEl('li', 'entry-preview-item');
    item.appendChild(makeEl('span', 'entry-preview-date', fmtDate(entry.date_watched)));
    item.appendChild(makeEl('span', 'entry-preview-meta', buildEntryPreviewMeta(chronological, reversed, entry, idx)));
    list.appendChild(item);
  });
  popover.appendChild(list);
  fragment.appendChild(popover);
  return fragment;
}

function createTableRowElement(movie, idx) {
  const tr = makeEl('tr');
  tr.dataset.idx = String(idx);
  tr.tabIndex = 0;
  tr.setAttribute('role', 'button');

  const titleCell = makeEl('td', 'film-title-cell');
  const titleWrap = makeEl('div', 'film-title-wrap');
  const title = makeEl('span', 'film-title', movie.movie);
  titleWrap.appendChild(title);

  const preview = createDiaryPreviewElement(movie);
  if (preview) titleWrap.appendChild(preview);

  titleCell.appendChild(titleWrap);
  tr.appendChild(titleCell);

  const rewatchCell = makeEl('td', 'rewatch-cell');
  if (movie.has_rewatch) rewatchCell.appendChild(createRewatchIndicatorElement());
  tr.appendChild(rewatchCell);

  tr.appendChild(makeEl('td', 'year-cell', movie.year != null ? String(movie.year) : '\u2014'));
  tr.appendChild(makeEl('td', 'date-cell', fmtDate(movie.date_watched)));

  const ratingCell = makeEl('td', 'rating-cell');
  ratingCell.appendChild(createRatingCellContent(movie.rating));
  tr.appendChild(ratingCell);

  const deltaCell = makeEl('td');
  deltaCell.appendChild(createDeltaContent(movie.score, movie.previous_score));
  tr.appendChild(deltaCell);

  const scoreCell = makeEl('td');
  scoreCell.appendChild(createScoreContent(movie.score));
  tr.appendChild(scoreCell);

  const notesCell = makeEl('td', 'notes-cell');
  notesCell.appendChild(createNotesCellContent(movie.notes, movie.review_link));
  tr.appendChild(notesCell);

  return tr;
}

function attachRowHandlers(tbody, resolveMovie) {
  tbody.addEventListener('click', (event) => {
    const tr = event.target.closest('tr');
    if (!tr) return;
    const movie = resolveMovie(+tr.dataset.idx);
    if (movie) onOpenDetail(movie);
  });
  tbody.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const tr = event.target.closest('tr');
    if (!tr) return;
    const movie = resolveMovie(+tr.dataset.idx);
    if (movie) onOpenDetail(movie);
  });
}

function isFilterActive() {
  return state.committedSearchTerms.length > 0 || Object.keys(state.activeChartFilters).length > 0;
}

function collapseToLatestPerFilm(movies) {
  const latestMap = new Map();
  for (const movie of movies) {
    const key = movie.watch_history;
    const existing = latestMap.get(key);
    if (!existing || (movie.date_watched || '') > (existing.date_watched || '')) {
      latestMap.set(key, movie);
    }
  }
  const seen = new Set();
  const result = [];
  for (const movie of movies) {
    const key = movie.watch_history;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(latestMap.get(key));
    }
  }
  return result;
}

function uniqueFilteredFilms() {
  const seen = new Set();
  return state.filtered.filter((m) => {
    if (seen.has(m.watch_history)) return false;
    seen.add(m.watch_history);
    return true;
  });
}

function tableCountParts() {
  const unique = uniqueFilteredFilms();
  const filmCount = unique.length;
  const monthFilter = state.activeChartFilters.watched_month;
  const diaryEntries = unique.reduce((count, movie) => {
    const watches = getLoggedWatchHistory(movie);
    if (!monthFilter) return count + watches.length;
    return count + watches.filter((w) => {
      const d = getMovieHeatmapDate(w);
      return d && monthHeatmapKey(d.getFullYear(), d.getMonth()) === monthFilter.value;
    }).length;
  }, 0);
  const filmWord = 'film' + (filmCount !== 1 ? 's' : '');
  const activeChartLabel = chartFilterLabel();
  const main = filmCount + ' ' + filmWord + (activeChartLabel ? ' matching ' + activeChartLabel : '');

  return {
    main,
    meta: diaryEntries + ' diary entr' + (diaryEntries === 1 ? 'y' : 'ies'),
  };
}

function renderTableCount() {
  const { searchCount } = getElements();
  if (!searchCount) return;

  const parts = tableCountParts();
  searchCount.textContent = '';
  const main = makeEl('span', 'search-count-main', parts.main);
  const sep = makeEl('span', 'search-count-sep', '\u00b7');
  sep.setAttribute('aria-hidden', 'true');
  const meta = makeEl('span', 'search-count-meta', parts.meta);
  searchCount.appendChild(main);
  searchCount.appendChild(sep);
  searchCount.appendChild(meta);
}

function renderEmptyTableState() {
  const el = getElements();
  if (!el.tableBody || !el.tableEmpty || !el.filmsTable || !el.pagination || !el.tableEmptyMsg) return;

  el.tableBody.textContent = '';
  el.tableEmpty.hidden = false;
  el.filmsTable.hidden = true;
  el.pagination.textContent = '';

  if (state.allMovies.length === 0) {
    el.tableEmpty.classList.remove('table-empty--silent');
    el.tableEmptyMsg.textContent = '';
    return;
  }

  el.tableEmpty.classList.add('table-empty--silent');
  el.tableEmptyMsg.textContent = '';
}

function renderPagination(total) {
  const { pagination, tableWrap } = getElements();
  if (!pagination) return;

  const pages = Math.ceil(total / state.pageSize);
  if (pages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  const mkBtn = (label, page, disabled, active) =>
    '<button type="button" class="pg-btn' +
    (active ? ' active' : '') +
    (disabled ? ' disabled' : '') +
    '" ' +
    (disabled ? 'disabled' : '') +
    ' data-page="' +
    page +
    '">' +
    label +
    '</button>';

  const goToPage = (page) => {
    const nextPage = Math.max(1, Math.min(pages, page));
    if (!Number.isFinite(nextPage) || nextPage === state.currentPage) return;
    state.currentPage = nextPage;
    renderTable();
    tableWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  let pageButtons = mkBtn('\u2039', state.currentPage - 1, state.currentPage === 1, false);
  const near = new Set(
    [1, pages, state.currentPage - 1, state.currentPage, state.currentPage + 1].filter(
      (page) => page >= 1 && page <= pages
    )
  );
  let prev = 0;
  [...near]
    .sort((a, b) => a - b)
    .forEach((page) => {
      if (page - prev > 1) pageButtons += '<button type="button" class="pg-btn" disabled>\u2026</button>';
      pageButtons += mkBtn(String(page), page, false, page === state.currentPage);
      prev = page;
    });
  pageButtons += mkBtn('\u203a', state.currentPage + 1, state.currentPage === pages, false);
  let html = '<div class="pagination-pages">' + pageButtons + '</div>';
  html +=
    '<form class="pg-jump" aria-label="Go to page">' +
    '<label class="pg-jump-label" for="pageJumpInput">Page</label>' +
    '<input id="pageJumpInput" class="pg-jump-input" type="number" min="1" max="' +
    pages +
    '" value="' +
    state.currentPage +
    '" inputmode="numeric" />' +
    '<button type="submit" class="pg-jump-btn">Go</button>' +
    '</form>';
  pagination.innerHTML = html;

  pagination.querySelectorAll('.pg-btn[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled || button.classList.contains('active')) return;
      goToPage(Number(button.dataset.page));
    });
  });

  const jumpForm = pagination.querySelector('.pg-jump');
  const jumpInput = pagination.querySelector('.pg-jump-input');
  jumpForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!(jumpInput instanceof HTMLInputElement)) return;

    const rawPage = parseInt(jumpInput.value, 10);
    if (!Number.isFinite(rawPage)) {
      jumpInput.value = String(state.currentPage);
      return;
    }

    goToPage(rawPage);
  });
}

export function renderTable() {
  const el = getElements();
  if (!el.tableBody || !el.tableEmpty || !el.filmsTable) return;

  _currentRows = isFilterActive() ? collapseToLatestPerFilm(state.filtered) : state.filtered;
  const rows = _currentRows;
  const total = rows.length;
  const start = (state.currentPage - 1) * state.pageSize;
  const page = rows.slice(start, start + state.pageSize);

  renderTableCount();

  if (!total) {
    renderEmptyTableState();
    return;
  }

  el.tableEmpty.classList.remove('table-empty--silent');
  el.tableEmpty.hidden = true;
  el.filmsTable.hidden = false;
  el.tableBody.textContent = '';

  const fragment = document.createDocumentFragment();
  page.forEach((movie, idx) => {
    fragment.appendChild(createTableRowElement(movie, start + idx));
  });
  el.tableBody.appendChild(fragment);

  syncSortUI();
  renderPagination(total);
}

function initScrollHint() {
  const wrap = document.getElementById('tableWrap');
  if (!wrap) return;
  const outer = wrap.parentElement;
  if (!outer) return;

  const update = () => {
    const atEnd = wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 8;
    const hasScrolled = wrap.scrollLeft > 8;
    outer.classList.toggle('scroll-end', atEnd);
    outer.classList.toggle('scroll-started', !atEnd && hasScrolled);
  };

  wrap.addEventListener('scroll', update, { passive: true });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(update).observe(wrap);
  }
}

export function initTable({ openDetail }) {
  onOpenDetail = openDetail;
  const { tableBody } = getElements();
  if (tableBody) attachRowHandlers(tableBody, (idx) => _currentRows[idx]);
  initScrollHint();
}
