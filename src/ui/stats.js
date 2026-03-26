// Stats card rendering for the dashboard summary section.
import { state } from '../state.js';
import { getWatchEntries, getWatchHistory } from '../movies.js';

function getElements() {
  return {
    statTotal: document.getElementById('statTotal'),
    statRated: document.getElementById('statRated'),
    statScored: document.getElementById('statScored'),
    statAvg: document.getElementById('statAvg'),
    statReviewed: document.getElementById('statReviewed'),
  };
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
