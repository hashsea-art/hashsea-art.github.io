// Stats card rendering for the dashboard summary section.
import { state } from '../state.js';
import { getWatchEntries, getWatchHistory } from '../movies.js';
import { openInfoPanel } from './chrome.js';

function getElements() {
  return {
    statCards: Array.from(document.querySelectorAll('.stat-card--interactive')),
    statTotal: document.getElementById('statTotal'),
    statRated: document.getElementById('statRated'),
    statScored: document.getElementById('statScored'),
    statAvg: document.getElementById('statAvg'),
    statReviewed: document.getElementById('statReviewed'),
    chartsAnchor: document.getElementById('chartsAnchor'),
    filmsAnchor: document.getElementById('filmsAnchor'),
    filmsSection: document.getElementById('filmsSection'),
    tableWrap: document.getElementById('tableWrap'),
    watchPeriodChartTitle: document.getElementById('watchPeriodChartTitle'),
  };
}

function openExternalStatUrl(url) {
  if (!url) return;
  const nextWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (nextWindow) nextWindow.opener = null;
}

function getScrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function scrollToFilmsTable() {
  const { filmsAnchor, filmsSection, tableWrap } = getElements();
  (filmsAnchor || filmsSection || tableWrap)?.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
}

function scrollToElementWithOffset(target, offset = 0) {
  if (!target) return;
  const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset);
  window.scrollTo({ top, behavior: getScrollBehavior() });
}

function scrollToChartsSection() {
  const { chartsAnchor } = getElements();
  chartsAnchor?.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
}

function scrollToWatchPeriodChart() {
  const { watchPeriodChartTitle, chartsAnchor } = getElements();
  const target = watchPeriodChartTitle?.closest('.chart-card') || watchPeriodChartTitle || chartsAnchor;
  scrollToElementWithOffset(target, 44);
}

function runStatCardAction(card) {
  const action = card.dataset.statAction;
  if (!action) return;

  if (action === 'external') {
    openExternalStatUrl(card.dataset.statUrl || '');
    return;
  }

  if (action === 'jump-films') {
    scrollToFilmsTable();
    return;
  }

  if (action === 'jump-charts') {
    scrollToChartsSection();
    return;
  }

  if (action === 'jump-watch-period-chart') {
    scrollToWatchPeriodChart();
    return;
  }

  if (action === 'open-panel') {
    const panelId = card.dataset.statPanel || '';
    const opened = openInfoPanel(panelId, { focusTab: true, preserveOnCurrentEvent: true });
    if (opened) {
      document.querySelector('.info-hub')?.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest' });
    }
    return;
  }

  console.warn("[cinelog] Unknown stat card action: '" + action + "'");
}

export function initStats() {
  const { statCards } = getElements();
  if (!statCards.length) return;

  statCards.forEach((card) => {
    card.addEventListener('click', () => runStatCardAction(card));
    card.addEventListener('keydown', (event) => {
      const isLinkCard = card.getAttribute('role') === 'link';
      const isActivationKey = event.key === 'Enter' || (!isLinkCard && event.key === ' ');
      if (!isActivationKey) return;
      event.preventDefault();
      runStatCardAction(card);
    });
  });
}

export function renderStats() {
  const el = getElements();
  if (!el.statTotal) return;

  if (!state.allMovies.length) {
    el.statTotal.textContent = '0';
    el.statRated.textContent = '0';
    el.statScored.textContent = '0';
    el.statAvg.textContent = '0';
    el.statReviewed.textContent = '0';
    return;
  }

  const watches = getWatchEntries(state.allMovies);
  const total = state.allMovies.length;
  const rated = state.allMovies.filter((movie) => movie.rating !== null).length;
  const scored = state.allMovies.filter((movie) => movie.score !== null).length;
  const reviewed = state.allMovies.filter((movie) =>
    getWatchHistory(movie).some((watch) => !!watch.review_link)
  ).length;
  const scores = watches.map((movie) => movie.score).filter((score) => score !== null);
  const avg = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : '0';

  el.statTotal.textContent = String(total);
  el.statRated.textContent = String(rated);
  el.statScored.textContent = String(scored);
  el.statAvg.textContent = avg;
  el.statReviewed.textContent = String(reviewed);
}
