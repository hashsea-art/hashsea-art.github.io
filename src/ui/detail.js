// Detail panel rendering and open/close behavior for an individual film.
import { getLoggedWatchHistory, getWatchHistory, watchTimelineLabel } from '../movies.js';
import { makeEl } from '../utils/dom.js';
import { fmtDate, renderStars } from '../utils/format.js';

function getElements() {
  return {
    detailPanel: document.getElementById('detailPanel'),
    detailClose: document.getElementById('detailClose'),
    panelBackdrop: document.getElementById('panelBackdrop'),
    detailYear: document.getElementById('detailYear'),
    detailTitle: document.getElementById('detailTitle'),
    detailTimeline: document.getElementById('detailTimeline'),
    detailScores: document.getElementById('detailScores'),
    detailRatingBlock: document.getElementById('detailRatingBlock'),
    detailStars: document.getElementById('detailStars'),
    detailNotesBlock: document.getElementById('detailNotesBlock'),
    detailNotes: document.getElementById('detailNotes'),
    detailReviewLinks: document.getElementById('detailReviewLinks'),
  };
}

function renderDetailTimeline(movie) {
  const { detailTimeline } = getElements();
  if (!detailTimeline) return;

  const watches = [...getLoggedWatchHistory(movie)].reverse();
  detailTimeline.textContent = '';

  if (!watches.length) {
    detailTimeline.appendChild(makeEl('p', 'detail-muted', 'No watch date recorded.'));
    return;
  }

  const fragment = document.createDocumentFragment();
  watches.forEach((watch, idx) => {
    const item = makeEl('div', 'timeline-item');
    item.appendChild(makeEl('div', 'timeline-dot'));
    item.appendChild(makeEl('span', 'timeline-date', fmtDate(watch.date_watched)));
    item.appendChild(makeEl('span', 'timeline-note', watchTimelineLabel(watches, watch, idx)));
    fragment.appendChild(item);
  });
  detailTimeline.appendChild(fragment);
}

function renderDetailReviewLinks(movie, container) {
  if (!container) return false;
  container.textContent = '';

  const reviewEntries = [...getWatchHistory(movie)]
    .filter((watch) => watch.review_link && String(watch.review_link).trim())
    .reverse();

  if (!reviewEntries.length) return false;

  const fragment = document.createDocumentFragment();
  reviewEntries.forEach((watch, idx) => {
    const link = makeEl(
      'a',
      'detail-review-link',
      reviewEntries.length > 1 ? 'Review ' + (idx + 1) : 'Read review'
    );
    link.href = watch.review_link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (watch.date_watched) {
      link.setAttribute('aria-label', 'Read review from ' + fmtDate(watch.date_watched));
    }
    fragment.appendChild(link);
  });

  container.appendChild(fragment);
  return true;
}

function detailScoresToRender(movie) {
  const history = movie.score_history && movie.score_history.length ? movie.score_history : [];
  if (history.length) return history;

  return [
    ...(movie.previous_score !== null ? [{ score: movie.previous_score, date_watched: '' }] : []),
    ...(movie.score !== null ? [{ score: movie.score, date_watched: movie.date_watched }] : []),
  ];
}

function renderDetailScores(movie) {
  const { detailScores } = getElements();
  if (!detailScores) return;

  const scoresToRender = detailScoresToRender(movie);
  detailScores.textContent = '';

  if (!scoresToRender.length) {
    detailScores.appendChild(makeEl('p', 'detail-muted', 'No scores recorded.'));
    return;
  }

  const fragment = document.createDocumentFragment();
  scoresToRender.forEach((entry, idx) => {
    if (idx > 0) fragment.appendChild(makeEl('div', 'score-arrow', '\u2192'));

    const block = makeEl('div', 'score-block');
    block.appendChild(makeEl('span', 'score-block-label', idx === scoresToRender.length - 1 ? 'Latest' : 'Past'));
    block.appendChild(
      makeEl('span', 'score-big' + (idx === scoresToRender.length - 1 ? ' current' : ''), String(entry.score))
    );
    if (entry.date_watched) {
      block.appendChild(makeEl('span', 'timeline-date', fmtDate(entry.date_watched)));
    } else {
      block.appendChild(makeEl('span', 'timeline-date timeline-date-empty', '\u00a0'));
    }
    fragment.appendChild(block);
  });
  detailScores.appendChild(fragment);
}

export function openDetail(movie) {
  const el = getElements();
  if (!el.detailPanel) return;

  if (el.detailYear) el.detailYear.textContent = movie.year != null ? String(movie.year) : '';
  if (el.detailTitle) el.detailTitle.textContent = movie.movie;

  renderDetailTimeline(movie);
  renderDetailScores(movie);

  if (el.detailRatingBlock && el.detailStars) {
    if (movie.rating !== null) {
      el.detailRatingBlock.hidden = false;
      el.detailStars.innerHTML = renderStars(movie.rating);
    } else {
      el.detailRatingBlock.hidden = true;
    }
  }

  if (el.detailNotesBlock && el.detailNotes && el.detailReviewLinks) {
    const hasNotes = !!(movie.notes && String(movie.notes).trim());
    const hasReviews = renderDetailReviewLinks(movie, el.detailReviewLinks);
    if (hasNotes || hasReviews) {
      el.detailNotesBlock.hidden = false;
      el.detailNotes.hidden = !hasNotes;
      el.detailNotes.textContent = hasNotes ? String(movie.notes).trim() : '';
    } else {
      el.detailNotesBlock.hidden = true;
      el.detailNotes.hidden = true;
      el.detailNotes.textContent = '';
    }
  }

  el.detailPanel.classList.add('open');
  el.detailPanel.setAttribute('aria-hidden', 'false');
  if (el.panelBackdrop) el.panelBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  el.detailClose?.focus();
}

export function closeDetail() {
  const el = getElements();
  if (!el.detailPanel) return;

  el.detailPanel.classList.remove('open');
  el.detailPanel.setAttribute('aria-hidden', 'true');
  if (el.panelBackdrop) el.panelBackdrop.hidden = true;
  document.body.style.overflow = '';
}

export function initDetailPanel() {
  const el = getElements();
  if (!el.detailPanel || !el.detailClose || !el.panelBackdrop) return;

  el.detailClose.addEventListener('click', closeDetail);
  el.panelBackdrop.addEventListener('click', closeDetail);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDetail();
  });
}
