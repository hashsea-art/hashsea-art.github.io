// Film table rendering, pagination, and row-level interactions.
import { state } from '../state.js';
import { getLoggedWatchHistory, getWatchHistory, watchTimelineLabel } from '../movies.js';
import { makeEl } from '../utils/dom.js';
import { fmtDate, fmtNotesCell, fmtScore, scoreToneClass } from '../utils/format.js';
import { chartFilterLabel } from './filters.js';
import { renderMonthHeatmap } from './heatmap.js';
import { syncSortUI } from './sort.js';

let onOpenDetail = () => {};

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
  const deltaText = (delta > 0 ? '+' : '') + delta.toFixed(1);
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
  title.title = movie.movie;
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
  notesCell.title = movie.notes || (movie.review_link ? 'Open Letterboxd review' : '');
  tr.appendChild(notesCell);

  return tr;
}

function attachRowHandlers(tbody, resolveMovie) {
  tbody.querySelectorAll('tr').forEach((tr) => {
    const open = () => onOpenDetail(resolveMovie(+tr.dataset.idx));
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') open();
    });
  });
}

function filteredDiaryEntryCount() {
  return state.filtered.reduce((count, movie) => count + getLoggedWatchHistory(movie).length, 0);
}

function tableCountParts(total) {
  const diaryEntries = filteredDiaryEntryCount();
  const filmWord = 'film' + (total !== 1 ? 's' : '');
  const activeChartLabel = chartFilterLabel();
  const baseLabel = activeChartLabel ? total + ' ' + filmWord + ' matching ' + activeChartLabel : total + ' ' + filmWord;

  return {
    main: total > 0 ? baseLabel : activeChartLabel ? '0 films matching ' + activeChartLabel : '0 films',
    meta: diaryEntries + ' diary entr' + (diaryEntries === 1 ? 'y' : 'ies'),
  };
}

function renderTableCount(total) {
  const { searchCount } = getElements();
  if (!searchCount) return;

  const parts = tableCountParts(total);
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

  let html = mkBtn('\u2039', state.currentPage - 1, state.currentPage === 1, false);
  const near = new Set(
    [1, pages, state.currentPage - 1, state.currentPage, state.currentPage + 1].filter(
      (page) => page >= 1 && page <= pages
    )
  );
  let prev = 0;
  [...near]
    .sort((a, b) => a - b)
    .forEach((page) => {
      if (page - prev > 1) html += '<button type="button" class="pg-btn" disabled>\u2026</button>';
      html += mkBtn(String(page), page, false, page === state.currentPage);
      prev = page;
    });
  html += mkBtn('\u203a', state.currentPage + 1, state.currentPage === pages, false);
  pagination.innerHTML = html;

  pagination.querySelectorAll('.pg-btn[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled || button.classList.contains('active')) return;
      state.currentPage = Number(button.dataset.page);
      renderTable();
      tableWrap?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

export function renderTable() {
  const el = getElements();
  if (!el.tableBody || !el.tableEmpty || !el.filmsTable) return;

  const total = state.filtered.length;
  const start = (state.currentPage - 1) * state.pageSize;
  const page = state.filtered.slice(start, start + state.pageSize);

  renderTableCount(total);
  renderMonthHeatmap();

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

  attachRowHandlers(el.tableBody, (idx) => state.filtered[idx]);
  syncSortUI();
  renderPagination(total);
}

export function initTable({ openDetail }) {
  onOpenDetail = openDetail;
}
