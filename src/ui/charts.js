// Chart rendering and drilldown behavior for score, rating, and release-period views.
import { CHART_THEME, RATING_STEPS } from '../constants.js';
import { state } from '../state.js';
import {
  decadeStart,
  exactScoreLabels,
  getMovieReleaseYear,
  scoreBinLabels,
  scoreBucketRange,
  scoreToBucket,
} from '../movies.js';
import { formatPct } from '../utils/format.js';

let scoreChart = null;
let ratingChart = null;
let watchPeriodChart = null;
let onSetChartFilter = () => {};

function getElements() {
  return {
    scoreChartTitle: document.getElementById('scoreChartTitle'),
    scoreChartDesc: document.getElementById('scoreChartDesc'),
    scoreChartBack: document.getElementById('scoreChartBack'),
    watchPeriodChartTitle: document.getElementById('watchPeriodChartTitle'),
    watchPeriodChartDesc: document.getElementById('watchPeriodChartDesc'),
    watchPeriodChartBack: document.getElementById('watchPeriodChartBack'),
    scoreCanvas: document.getElementById('scoreChart'),
    ratingCanvas: document.getElementById('ratingChart'),
    watchPeriodCanvas: document.getElementById('watchPeriodChart'),
  };
}

function clickedBarIndex(chart, event, fallbackElements) {
  if (!chart) return null;
  const nearest = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
  if (nearest.length) return nearest[0].index;
  if (fallbackElements && fallbackElements.length) return fallbackElements[0].index;

  const xScale = chart.scales && chart.scales.x;
  const x = event && typeof event.x === 'number' ? event.x : NaN;
  const y = event && typeof event.y === 'number' ? event.y : NaN;
  if (!xScale || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < xScale.left || x > xScale.right) return null;
  if (y < xScale.top || y > xScale.bottom + 24) return null;

  const rawIndex = xScale.getValueForPixel(x);
  if (!Number.isFinite(rawIndex)) return null;

  const index = Math.round(rawIndex);
  return index >= 0 && index < chart.data.labels.length ? index : null;
}

function scoreGradient(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, CHART_THEME.scoreGradTop);
  grad.addColorStop(1, CHART_THEME.scoreGradBot);
  return grad;
}

function watchPeriodGradient(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, CHART_THEME.watchGradTop);
  grad.addColorStop(1, CHART_THEME.watchGradBot);
  return grad;
}

function axisCfg() {
  return {
    grid: { color: CHART_THEME.grid },
    border: { color: CHART_THEME.gridBorder },
    ticks: {
      color: CHART_THEME.tick,
      font: { family: CHART_THEME.fontBody, size: 11 },
    },
  };
}

function chartScales(xTicks) {
  const base = axisCfg();
  return {
    x: {
      ...base,
      grid: { ...base.grid, color: CHART_THEME.grid, offset: true, drawBorder: true },
      ticks: { ...base.ticks, ...xTicks },
    },
    y: {
      ...base,
      beginAtZero: true,
      ticks: { ...base.ticks, precision: 0 },
    },
  };
}

function tooltipCfg() {
  return {
    displayColors: false,
    backgroundColor: CHART_THEME.tooltipBg,
    borderColor: CHART_THEME.gridBorder,
    borderWidth: 1,
    titleColor: CHART_THEME.tooltipTitle,
    bodyColor: CHART_THEME.tooltipBody,
    padding: 10,
    cornerRadius: 6,
    titleFont: { family: CHART_THEME.fontBody, weight: '600' },
    bodyFont: { family: CHART_THEME.fontBody },
    callbacks: {
      label(context) {
        const count = context.parsed.y ?? context.parsed;
        const values = Array.isArray(context.dataset?.data) ? context.dataset.data : [];
        const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);
        const pct = total > 0 ? formatPct((count / total) * 100) : '0';
        return count + ' film' + (count === 1 ? '' : 's') + ' · ' + pct + '%';
      },
    },
  };
}

function getScoreChartState(movies) {
  if (state.scoreChartDrilldown) {
    const labels = exactScoreLabels(state.scoreChartDrilldown);
    const data = labels.map(() => 0);

    movies.forEach((movie) => {
      if (movie.score === null) return;
      const rounded = Math.round(movie.score);
      if (rounded < state.scoreChartDrilldown.start || rounded > state.scoreChartDrilldown.end) return;
      data[rounded - state.scoreChartDrilldown.start]++;
    });

    return {
      labels,
      data,
      title: 'Score Distribution',
      description:
        'Showing ' +
        state.scoreChartDrilldown.start +
        '\u2013' +
        state.scoreChartDrilldown.end +
        '. Click a score to open matching films.',
      showBackButton: true,
    };
  }

  const data = Array(10).fill(0);
  const labels = scoreBinLabels();

  movies.forEach((movie) => {
    if (movie.score === null) return;
    const bucket = scoreToBucket(movie.score);
    if (bucket !== null) data[bucket]++;
  });

  return {
    labels,
    data,
    title: 'Score Distribution',
    description: 'Click a range, then click a score to open matching films.',
    showBackButton: false,
  };
}

function buildScoreChart() {
  const el = getElements();
  const scoredMovies = state.allMovies.filter((movie) => movie.score !== null);
  const chartState = getScoreChartState(scoredMovies);

  if (el.scoreChartTitle) el.scoreChartTitle.textContent = chartState.title;
  if (el.scoreChartDesc) el.scoreChartDesc.textContent = chartState.description;
  if (el.scoreChartBack) el.scoreChartBack.hidden = !chartState.showBackButton;
  if (typeof window.Chart === 'undefined' || !el.scoreCanvas) return;

  if (scoreChart) scoreChart.destroy();
  const ctx = el.scoreCanvas.getContext('2d');
  const grad = scoreGradient(ctx);

  scoreChart = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartState.labels,
      datasets: [
        {
          label: 'Films',
          data: chartState.data,
          backgroundColor: grad,
          borderColor: CHART_THEME.scoreBorder,
          borderWidth: 1,
          borderRadius: 2,
          borderSkipped: false,
          categoryPercentage: 0.92,
          barPercentage: 0.96,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipCfg() },
      onClick(event, elements) {
        const index = clickedBarIndex(scoreChart, event, elements);
        if (index === null) return;

        if (state.scoreChartDrilldown) {
          onSetChartFilter({ type: 'score', value: state.scoreChartDrilldown.start + index });
          return;
        }

        state.scoreChartDrilldown = scoreBucketRange(index);
        buildScoreChart();
      },
      scales: {
        x: {
          ...chartScales({
            maxRotation: 90,
            minRotation: 0,
            autoSkip: false,
          }).x,
        },
        y: chartScales({}).y,
      },
    },
  });
}

function buildRatingChart() {
  const el = getElements();
  const counts = {};
  RATING_STEPS.forEach((rating) => {
    counts[rating] = 0;
  });

  state.allMovies.forEach((movie) => {
    if (movie.rating === null) return;
    const rating = Math.round(movie.rating * 2) / 2;
    if (counts[rating] !== undefined) counts[rating]++;
  });

  const labels = RATING_STEPS.map((rating) => '\u2605'.repeat(Math.floor(rating)) + (rating % 1 ? '\u00bd' : ''));
  if (typeof window.Chart === 'undefined' || !el.ratingCanvas) return;

  if (ratingChart) ratingChart.destroy();
  ratingChart = new window.Chart(el.ratingCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Films',
          data: RATING_STEPS.map((rating) => counts[rating]),
          backgroundColor: CHART_THEME.ratingFill,
          borderColor: CHART_THEME.ratingBorder,
          borderWidth: 1,
          borderRadius: 2,
          borderSkipped: false,
          categoryPercentage: 0.92,
          barPercentage: 0.96,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipCfg() },
      onClick(event, elements) {
        const index = clickedBarIndex(ratingChart, event, elements);
        if (index === null) return;
        onSetChartFilter({ type: 'rating', value: RATING_STEPS[index] });
      },
      scales: chartScales({ autoSkip: false }),
    },
  });
}

function getWatchPeriodChartState(movies) {
  const years = movies.map((movie) => getMovieReleaseYear(movie)).filter((year) => year !== null);
  const collapsedDecadeEnd = 1949;
  const collapsedDecadeLabel = '1940s & earlier';

  if (!years.length) {
    return {
      labels: [],
      data: [],
      values: [],
      title: 'Films by Release Decade',
      description: 'Click a decade, then click a year to open matching films.',
      showBackButton: false,
    };
  }

  if (state.watchPeriodChartDrilldown !== null) {
    const range =
      typeof state.watchPeriodChartDrilldown === 'number'
        ? {
            start: state.watchPeriodChartDrilldown,
            end: state.watchPeriodChartDrilldown + 9,
            title: 'Films Released in the ' + state.watchPeriodChartDrilldown + 's',
          }
        : state.watchPeriodChartDrilldown;
    const yearCounts = new Map();

    movies.forEach((movie) => {
      const year = getMovieReleaseYear(movie);
      if (year === null || year < range.start || year > range.end) return;
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    });

    const values = [...yearCounts.keys()].sort((a, b) => a - b);
    const labels = values.map((year) => String(year));
    const data = values.map((year) => yearCounts.get(year));

    return {
      labels,
      data,
      values,
      title: 'Films by Release Decade',
      description:
        'Showing ' +
        range.title.replace(/^Films Released in the /, '').replace(/^Films Released in /, '') +
        '. Click a year to open matching films.',
      showBackButton: true,
    };
  }

  const startDecade = decadeStart(Math.min(...years));
  const endDecade = decadeStart(Math.max(...years));
  const labels = [];
  const data = [];
  const values = [];
  const hasCollapsedEarlyDecades = years.some((year) => year <= collapsedDecadeEnd);

  if (hasCollapsedEarlyDecades) {
    labels.push(collapsedDecadeLabel);
    data.push(0);
    values.push({
      start: Math.min(...years.filter((year) => year <= collapsedDecadeEnd)),
      end: collapsedDecadeEnd,
      title: 'Films Released in the 1940s and Earlier',
    });
  }

  for (let decade = Math.max(1950, startDecade); decade <= endDecade; decade += 10) {
    labels.push(decade + 's');
    data.push(0);
    values.push(decade);
  }

  movies.forEach((movie) => {
    const year = getMovieReleaseYear(movie);
    if (year === null) return;
    if (year <= collapsedDecadeEnd && hasCollapsedEarlyDecades) {
      data[0]++;
      return;
    }

    const baseIndex = hasCollapsedEarlyDecades ? 1 : 0;
    const index = baseIndex + (decadeStart(year) - Math.max(1950, startDecade)) / 10;
    if (index >= 0 && index < data.length) data[index]++;
  });

  return {
    labels,
    data,
    values,
    title: 'Films by Release Decade',
    description: 'Click a decade, then click a year to open matching films.',
    showBackButton: false,
  };
}

function buildWatchPeriodChart() {
  const el = getElements();
  const datedMovies = state.allMovies.filter((movie) => getMovieReleaseYear(movie) !== null);
  const chartState = getWatchPeriodChartState(datedMovies);

  if (el.watchPeriodChartTitle) el.watchPeriodChartTitle.textContent = chartState.title;
  if (el.watchPeriodChartDesc) el.watchPeriodChartDesc.textContent = chartState.description || '';
  if (el.watchPeriodChartBack) el.watchPeriodChartBack.hidden = !chartState.showBackButton;
  if (typeof window.Chart === 'undefined' || !el.watchPeriodCanvas) return;

  if (watchPeriodChart) watchPeriodChart.destroy();
  const ctx = el.watchPeriodCanvas.getContext('2d');
  const grad = watchPeriodGradient(ctx);

  watchPeriodChart = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartState.labels,
      datasets: [
        {
          label: 'Films',
          data: chartState.data,
          backgroundColor: grad,
          borderColor: CHART_THEME.watchBorder,
          borderWidth: 1,
          borderRadius: 2,
          borderSkipped: false,
          categoryPercentage: 0.92,
          barPercentage: 0.96,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipCfg() },
      onClick(event, elements) {
        const index = clickedBarIndex(watchPeriodChart, event, elements);
        if (index === null || !chartState.data[index]) return;

        if (state.watchPeriodChartDrilldown !== null) {
          onSetChartFilter({ type: 'release_year', value: chartState.values[index] });
          return;
        }

        state.watchPeriodChartDrilldown = chartState.values[index];
        buildWatchPeriodChart();
      },
      scales: chartScales({
        autoSkip: false,
        maxRotation: state.watchPeriodChartDrilldown !== null ? 45 : 0,
        minRotation: 0,
      }),
    },
  });
}

function safeBuild(label, build) {
  try {
    build();
  } catch (error) {
    console.warn("[Harsh's Film Diary] Failed to render " + label + '.', error);
  }
}

export function renderCharts() {
  safeBuild('score chart', buildScoreChart);
  safeBuild('rating chart', buildRatingChart);
  safeBuild('watch period chart', buildWatchPeriodChart);
}

export function initCharts({ setChartFilter }) {
  onSetChartFilter = setChartFilter;
  const el = getElements();

  if (el.scoreChartBack) {
    el.scoreChartBack.hidden = true;
    el.scoreChartBack.addEventListener('click', () => {
      state.scoreChartDrilldown = null;
      buildScoreChart();
    });
  }

  if (el.watchPeriodChartBack) {
    el.watchPeriodChartBack.hidden = true;
    el.watchPeriodChartBack.addEventListener('click', () => {
      state.watchPeriodChartDrilldown = null;
      buildWatchPeriodChart();
    });
  }
}
