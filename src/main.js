// App entrypoint: initializes UI modules, loads data, and coordinates top-level rendering.
import { loadMoviesData } from './data/loader.js';
import { state } from './state.js';
import { initBackToTopLink, initInfoHub } from './ui/chrome.js';
import { initCharts, renderCharts } from './ui/charts.js';
import { initDetailPanel, openDetail } from './ui/detail.js';
import { applyFilter, clearChartFilterType, initFilters, setChartFilter, syncSearchUi } from './ui/filters.js';
import { initHeatmap } from './ui/heatmap.js';
import { applySort, initSort } from './ui/sort.js';
import { renderStats } from './ui/stats.js';
import { initTable, renderTable } from './ui/table.js';

function getElements() {
  return {
    loadAlert: document.getElementById('loadAlert'),
    loadAlertText: document.getElementById('loadAlertText'),
  };
}

function setLoadAlert(message) {
  const el = getElements();
  if (!el.loadAlert || !el.loadAlertText) return;

  if (!message) {
    el.loadAlert.hidden = true;
    el.loadAlertText.textContent = '';
    return;
  }

  el.loadAlert.hidden = false;
  el.loadAlertText.textContent = message;
}

function renderDashboard() {
  renderStats();
  renderCharts();
  state.currentPage = 1;
  renderTable();
}

function updateMovies(movies, alertMessage) {
  setLoadAlert(alertMessage);
  state.allMovies = movies;
  state.scoreChartDrilldown = null;
  state.watchPeriodChartDrilldown = null;
  syncSearchUi();

  const hasCommittedSearch = state.committedSearchTerms.length > 0;
  const hasChartFilter = Object.keys(state.activeChartFilters).length > 0;

  if (hasCommittedSearch || hasChartFilter) {
    renderStats();
    renderCharts();
    state.currentPage = 1;
    applyFilter();
    return;
  }

  state.filtered = [...movies];
  applySort();
  renderDashboard();
}

async function loadData() {
  try {
    const { movies, alertMessage } = await loadMoviesData();
    updateMovies(movies, alertMessage);
  } catch (error) {
    console.error("[Harsh's Film Diary]", error);
    setLoadAlert(
      'The page could not read data/movies.csv. Run the site through a local server such as Live Server, or check that the CSV exists and matches the expected format.'
    );
    state.allMovies = [];
    state.filtered = [];
    state.scoreChartDrilldown = null;
    state.watchPeriodChartDrilldown = null;
    syncSearchUi();
    renderDashboard();
  }
}

async function init() {
  initInfoHub();
  initBackToTopLink();
  initDetailPanel();
  initTable({ openDetail });
  initCharts({ setChartFilter });
  initHeatmap({ setChartFilter, clearChartFilterType });
  initSort({ onChange: renderTable });
  initFilters({ onChange: renderTable, onChartsRebuild: renderCharts });

  await loadData();
}

document.addEventListener('DOMContentLoaded', init);
