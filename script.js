'use strict';

/**
 * Primary source of truth for hosted use.
 * A bundled JS fallback is also loaded so opening index.html via file:// still works in browsers that block local fetch.
 */
const CSV_PATH = './data/movies.csv';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100];
const RATING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

/** Matches diary theme in style.css (Chart.js cannot read CSS variables reliably). */
const CHART_THEME = {
  tick: '#91a9bc',
  grid: 'rgba(255, 255, 255, 0.045)',
  gridBorder: 'rgba(255, 255, 255, 0.1)',
  tooltipBg: '#151d26',
  tooltipTitle: '#eef8ff',
  tooltipBody: '#c9d9e6',
  fontBody: "'Manrope', Arial, sans-serif",
  fontMono: "'Space Mono', monospace",
  scoreGradTop: 'rgba(121, 198, 255, 1)',
  scoreGradBot: 'rgba(121, 198, 255, 0.48)',
  scoreBorder: 'rgba(121, 198, 255, 1)',
  ratingFill: 'rgba(0, 193, 106, 0.96)',
  ratingBorder: 'rgba(76, 255, 165, 1)',
  watchGradTop: 'rgba(255, 182, 92, 0.98)',
  watchGradBot: 'rgba(255, 182, 92, 0.4)',
  watchBorder: 'rgba(255, 196, 128, 1)',
};

/** Shown when CSV is missing, empty, or cannot be fetched (e.g. file://). Matches normalised row shape. */
const SAMPLE_MOVIES = [
  {
    movie: 'Past Lives',
    year: 2023,
    rating: 5,
    score: 95,
    date_watched: '2023-07-22',
    previous_score: null,
    notes: 'In-yun; maybe my favorite romance in years.',
  },
  {
    movie: 'Dune: Part Two',
    year: 2024,
    rating: 5,
    score: 96,
    date_watched: '2024-03-15',
    previous_score: 91,
    notes: 'Sequel tops the first; worm ride worth the wait.',
  },
  {
    movie: 'Oppenheimer',
    year: 2023,
    rating: 4.5,
    score: 93,
    date_watched: '2023-07-30',
    previous_score: null,
    notes: 'Loud theatre; Trinity sequence unforgettable.',
  },
  {
    movie: 'T\u00E1r',
    year: 2022,
    rating: 4.5,
    score: 92,
    date_watched: '2022-12-10',
    previous_score: null,
    notes: 'Blanchett carries; morally queasy in a good way.',
  },
  {
    movie: 'Drive My Car',
    year: 2021,
    rating: 5,
    score: 93,
    date_watched: '2022-03-06',
    previous_score: null,
    notes: 'Long but earned; best of that year for me.',
  },
  {
    movie: 'Parasite',
    year: 2019,
    rating: 5,
    score: 96,
    date_watched: '2019-10-12',
    previous_score: null,
    notes: 'First Palme winner I saw in a theatre.',
  },
  {
    movie: 'The Lighthouse',
    year: 2019,
    rating: 4.5,
    score: 88,
    date_watched: '2019-11-03',
    previous_score: null,
    notes: 'Black and white madness; Eggers at his best.',
  },
  {
    movie: 'Everything Everywhere All at Once',
    year: 2022,
    rating: 4.5,
    score: 89,
    date_watched: '2022-05-21',
    previous_score: null,
    notes: 'Chaotic good; cried in the laundromat scene.',
  },
  {
    movie: 'Aftersun',
    year: 2022,
    rating: 4.5,
    score: 91,
    date_watched: '2023-01-15',
    previous_score: null,
    notes: 'Quiet gut-punch; pool scene still haunts.',
  },
  {
    movie: 'The Zone of Interest',
    year: 2023,
    rating: 4,
    score: 90,
    date_watched: '2024-03-09',
    previous_score: null,
    notes: "Sound design only; couldn't look away.",
  },
  {
    movie: 'Nocturama',
    year: 2016,
    rating: 3.5,
    score: 72,
    date_watched: '2019-09-08',
    previous_score: null,
    notes: 'September 2019 start of this log; eerie Paris.',
  },
  {
    movie: 'Short film pick',
    year: 2022,
    rating: 2.5,
    score: 38,
    date_watched: '2022-08-14',
    previous_score: null,
    notes: 'Experimental; not for everyone.',
  },
  {
    movie: 'Rating only (no score yet)',
    year: 2017,
    rating: 3.5,
    score: null,
    date_watched: '2023-06-01',
    previous_score: null,
    notes: 'Stars on Letterboxd; numeric score TBD.',
  },
  {
    movie: 'Score only (no stars)',
    year: 2015,
    rating: null,
    score: 78,
    date_watched: '2024-09-14',
    previous_score: null,
    notes: 'Numeric score from an old list.',
  },
];

/** Maps logical fields to possible header names (after normalising headers). */
const COL_ALIASES = {
  movie: ['movie', 'film', 'title', 'name', 'movie_title'],
  year: ['year', 'release_year', 'yr', 'release'],
  rating: ['rating', 'stars', 'star_rating', 'letterboxd_rating'],
  rewatch: ['rewatch', 're_watch', 'rewatched'],
  score: ['score', 'my_score', 'points', 'grade', 'numeric_score'],
  date_watched: ['date_watched', 'watched', 'watch_date', 'date', 'viewed_on'],
  previous_score: ['previous_score', 'prev_score', 'old_score', 'previous', 'last_score'],
  notes: ['notes', 'note', 'comment', 'memo'],
  review_link: ['review_link', 'review_url', 'review_uri', 'letterboxd_uri', 'uri'],
};

let allMovies = [];
let filtered = [];
let currentPage = 1;
let pageSize = DEFAULT_PAGE_SIZE;
let committedSearchTerms = [];
/** Default: most recently watched first */
const DEFAULT_SORT_RULES = [{ col: 'date_watched', dir: 'desc' }];
let sortRules = DEFAULT_SORT_RULES.map((rule) => ({ ...rule }));
let scoreChart = null;
let ratingChart = null;
let watchPeriodChart = null;
let scoreChartDrilldown = null;
let watchPeriodChartDrilldown = null;
let activeChartFilter = null;

const $ = (id) => document.getElementById(id);
const el = {
  loadAlert: $('loadAlert'),
  loadAlertText: $('loadAlertText'),
  statTotal: $('statTotal'),
  statRated: $('statRated'),
  statScored: $('statScored'),
  statAvg: $('statAvg'),
  statReviewed: $('statReviewed'),
  searchInput: $('searchInput'),
  searchClear: $('searchClear'),
  pageSizeSelect: $('pageSizeSelect'),
  searchCount: $('searchCount'),
  activeFilters: $('activeFilters'),
  activeSearchFilter: $('activeSearchFilter'),
  activeSearchFilterLabel: $('activeSearchFilterLabel'),
  activeSearchFilterClear: $('activeSearchFilterClear'),
  activeChartFilter: $('activeChartFilter'),
  activeChartFilterLabel: $('activeChartFilterLabel'),
  activeChartFilterClear: $('activeChartFilterClear'),
  scoreChartTitle: $('scoreChartTitle'),
  scoreChartDesc: $('scoreChartDesc'),
  scoreChartBack: $('scoreChartBack'),
  watchPeriodChartTitle: $('watchPeriodChartTitle'),
  watchPeriodChartDesc: $('watchPeriodChartDesc'),
  watchPeriodChartBack: $('watchPeriodChartBack'),
  tableBody: $('tableBody'),
  tableEmpty: $('tableEmpty'),
  tableEmptyMsg: $('tableEmptyMsg'),
  filmsTable: $('filmsTable'),
  pagination: $('pagination'),
  detailPanel: $('detailPanel'),
  detailClose: $('detailClose'),
  panelBackdrop: $('panelBackdrop'),
};

document.addEventListener('DOMContentLoaded', () => {
  if (el.pageSizeSelect) el.pageSizeSelect.value = String(pageSize);
  syncSearchClear();
  if (el.scoreChartBack) el.scoreChartBack.hidden = true;
  if (el.watchPeriodChartBack) el.watchPeriodChartBack.hidden = true;
  loadData();
});

function applySampleMovies() {
  allMovies = SAMPLE_MOVIES.map((m) => ({ ...m }));
  filtered = [...allMovies];
  applySort();
}

function useSampleMovies(message) {
  setLoadAlert(message);
  el.tableEmptyMsg.textContent = '';
  applySampleMovies();
  renderDashboard();
}

function updateMovies(data) {
  setLoadAlert('');
  allMovies = data;
  filtered = [...allMovies];
  applySort();
  renderDashboard();
}

function setLoadAlert(message) {
  if (!el.loadAlert || !el.loadAlertText) return;
  if (!message) {
    el.loadAlert.hidden = true;
    el.loadAlertText.textContent = '';
    return;
  }
  el.loadAlert.hidden = false;
  el.loadAlertText.textContent = message;
}

async function loadData() {
  try {
    if (location.protocol === 'file:' && Array.isArray(window.__MOVIES_DATA__) && window.__MOVIES_DATA__.length) {
      const bundledData = normaliseRows(window.__MOVIES_DATA__);
      if (bundledData.length) {
        updateMovies(bundledData);
        return;
      }
    }

    const res = await fetch(CSV_PATH, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const rows = parseCSV(await res.text());
    if (!rows.length) {
      useSampleMovies('The CSV was found, but it was empty. The page is showing built-in sample entries instead.');
      return;
    }

    const data = normaliseRows(rows);
    if (!data.length) {
      useSampleMovies('The CSV loaded, but its columns did not match the expected movie format. The page is showing sample entries instead.');
      return;
    }

    updateMovies(data);
  } catch (err) {
    console.warn("[Harsh's Film Diary]", err);
    if (Array.isArray(window.__MOVIES_DATA__) && window.__MOVIES_DATA__.length) {
      const bundledData = normaliseRows(window.__MOVIES_DATA__);
      if (bundledData.length) {
        setLoadAlert('');
        updateMovies(bundledData);
        return;
      }
    }
    useSampleMovies('The page could not read data/movies.csv. This usually happens when index.html is opened directly with file:// instead of through a local server like Live Server.');
  }
}

/**
 * RFC-style CSV parser: commas and newlines inside double quotes, escaped quotes as "".
 */
function parseCSV(text) {
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field.trim());
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field.trim());
      field = '';
      if (row.some((value) => value !== '')) records.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  row.push(field.trim());
  if (row.some((value) => value !== '')) records.push(row);

  if (!records.length) return [];
  const headers = records[0].map(normalizeHeader);
  const rows = [];
  for (let i = 1; i < records.length; i++) {
    const vals = records[i];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] ?? '';
    });
    rows.push(obj);
  }
  return rows;
}

function normalizeHeader(h) {
  return String(h)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function buildColMap(row) {
  const keys = Object.keys(row);
  const map = {};
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    map[field] = keys.find((k) => aliases.includes(k)) || null;
  }
  return map;
}

function normaliseRows(rows) {
  if (!rows.length) return [];
  const cm = buildColMap(rows[0]);
  if (!cm.movie) return [];

  const parsed = rows
    .map((row, idx) => ({
      movie: str(row, cm.movie),
      year: parseYear(str(row, cm.year)),
      rating: parseRating(str(row, cm.rating)),
      rewatch: parseRewatch(str(row, cm.rewatch)),
      score: parseScore(str(row, cm.score)),
      date_watched: str(row, cm.date_watched),
      previous_score: parseScore(str(row, cm.previous_score)),
      notes: cm.notes ? str(row, cm.notes) : '',
      review_link: cm.review_link ? safeExternalUrl(str(row, cm.review_link)) : '',
      _idx: idx,
    }))
    .filter((m) => isUsableMovieTitle(m.movie));

  const grouped = new Map();
  parsed.forEach((entry) => {
    const key = normalizeMovieKey(entry.movie, entry.year);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  });

  return Array.from(grouped.values()).map(buildMovieFromEntries);
}

function str(row, key) {
  return !key || row[key] == null ? '' : repairMojibake(String(row[key]).trim());
}

function safeExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch (_) {
    return '';
  }
}

function isUsableMovieTitle(value) {
  const title = String(value || '').trim();
  if (!title) return false;
  if (/^[0-9]+\.[0-9]+$/.test(title)) return false;
  return true;
}

function repairMojibake(value) {
  if (!value || !/(?:Ã.|Â.|â.|Ä.|Å.)/.test(value)) return value;

  try {
    const bytes = Uint8Array.from(Array.from(value, (ch) => ch.charCodeAt(0) & 0xff));
    const repaired = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
    return repaired || value;
  } catch (_) {
    return value;
  }
}

function parseScore(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseYear(v) {
  if (v === '' || v == null) return null;
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function parseRating(v) {
  if (!v) return null;
  const raw = String(v).trim();
  const symbolStars = (raw.match(/[\u2605\u272D]/g) || []).length;
  const hasHalfSymbol = raw.includes('\u00BD');
  if (symbolStars || hasHalfSymbol) {
    return Math.min(5, Math.max(0, symbolStars + (hasHalfSymbol ? 0.5 : 0)));
  }

  const normalized = raw
    .replace(/(\d)\u00BD/g, '$1.5')
    .replace(/^\u00BD$/, '0.5')
    .replace(/,/g, '.')
    .replace(/[\u2605\u2606\u272D]/g, '')
    .trim();
  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(0, n));
}

function parseRewatch(v) {
  if (!v) return false;
  return ['yes', 'true', '1', 'rewatch'].includes(String(v).trim().toLowerCase());
}

function canonicalizeMovieTitle(title) {
  return String(title)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMovieKey(movie, year) {
  return canonicalizeMovieTitle(movie) + '::' + (year ?? '');
}

function watchTimeValue(date, fallbackIdx) {
  if (!date) return Number.MAX_SAFE_INTEGER - 100000 + fallbackIdx;
  const t = new Date(date).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER - 100000 + fallbackIdx;
}

function buildMovieFromEntries(entries) {
  const ordered = [...entries].sort(
    (a, b) => watchTimeValue(a.date_watched, a._idx) - watchTimeValue(b.date_watched, b._idx)
  );
  const watches = ordered.map((entry) => ({
    movie: entry.movie,
    year: entry.year,
    date_watched: entry.date_watched,
    rating: entry.rating,
    rewatch: !!entry.rewatch,
    score: entry.score,
    previous_score: entry.previous_score,
    notes: entry.notes,
    review_link: entry.review_link,
  }));

  const latest = watches[watches.length - 1];
  const first = watches[0];
  const latestReviewedWatch = [...watches].reverse().find(
    (watch) => watch.review_link && String(watch.review_link).trim()
  );
  const rewatch_count = watches.filter((watch) => watch.rewatch).length;
  const score_history = watches
    .filter((watch) => watch.score !== null)
    .map((watch) => ({ score: watch.score, date_watched: watch.date_watched }));

  if (
    score_history.length <= 1 &&
    latest.previous_score !== null &&
    latest.previous_score !== latest.score
  ) {
    score_history.unshift({ score: latest.previous_score, date_watched: '' });
  }

  return {
    movie: latest.movie,
    year: latest.year,
    rating: latest.rating,
    score: latest.score,
    date_watched: latest.date_watched,
    first_watched: first.date_watched,
    has_rewatch: rewatch_count > 0,
    rewatch_count,
    previous_score:
      score_history.length >= 2
        ? score_history[score_history.length - 2].score
        : latest.previous_score,
    notes: latest.notes,
    review_link: latestReviewedWatch ? latestReviewedWatch.review_link : latest.review_link,
    watch_history: watches,
    score_history,
  };
}

function getWatchHistory(movie) {
  return movie.watch_history && movie.watch_history.length ? movie.watch_history : [movie];
}

function hasLoggedDate(value) {
  return !!(value && String(value).trim());
}

function getLoggedWatchHistory(movie) {
  return getWatchHistory(movie).filter((watch) => hasLoggedDate(watch.date_watched));
}

function isLoggedMovie(movie) {
  return getLoggedWatchHistory(movie).length > 0;
}

function getMovieReleaseYear(movie) {
  if (movie.year == null || movie.year === '') return null;
  const year = parseInt(String(movie.year), 10);
  return Number.isFinite(year) ? year : null;
}

function getWatchEntries() {
  return allMovies.flatMap((movie) =>
    getWatchHistory(movie).map((watch) => ({
      rating: watch.rating ?? null,
      score: watch.score ?? null,
      date_watched: watch.date_watched ?? '',
    }))
  );
}

/** 10 bins: 1-10, 11-20, ... , 91-100 */
function scoreToBucket(s) {
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  if (n <= 10) return 0;
  return Math.min(9, Math.floor((n - 1) / 10));
}

function scoreBinLabels() {
  const labels = [];
  for (let i = 0; i < 10; i++) {
    const start = i * 10 + 1;
    const end = (i + 1) * 10;
    labels.push(start + '\u2013' + end);
  }
  return labels;
}

function scoreBucketRange(index) {
  const start = index * 10 + 1;
  const end = (index + 1) * 10;
  return { start, end };
}

function exactScoreLabels(range) {
  const labels = [];
  for (let score = range.start; score <= range.end; score++) labels.push(String(score));
  return labels;
}

function decadeStart(year) {
  return Math.floor(year / 10) * 10;
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

function renderDashboard() {
  renderStats();
  buildScoreChart();
  buildRatingChart();
  buildWatchPeriodChart();
  currentPage = 1;
  renderTable();
}

function renderStats() {
  if (!allMovies.length) {
    el.statTotal.textContent = '0';
    el.statRated.textContent = '0';
    el.statScored.textContent = '0';
    el.statAvg.textContent = '0';
    el.statReviewed.textContent = '0';
    return;
  }

  const watches = getWatchEntries();
  const total = allMovies.length;
  const rated = allMovies.filter((m) => m.rating !== null).length;
  const scored = allMovies.filter((m) => m.score !== null).length;
  const reviewed = allMovies.filter((m) => getWatchHistory(m).some((watch) => !!watch.review_link)).length;
  const scores = watches.map((m) => m.score).filter((s) => s !== null);
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0';
  el.statTotal.textContent = total;
  el.statRated.textContent = rated;
  el.statScored.textContent = scored;
  el.statAvg.textContent = avg;
  el.statReviewed.textContent = reviewed;
}

function getScoreChartState(movies) {
  if (scoreChartDrilldown) {
    const labels = exactScoreLabels(scoreChartDrilldown);
    const data = labels.map(() => 0);

    movies.forEach((m) => {
      if (m.score === null) return;
      const rounded = Math.round(m.score);
      if (rounded < scoreChartDrilldown.start || rounded > scoreChartDrilldown.end) return;
      data[rounded - scoreChartDrilldown.start]++;
    });

    return {
      labels,
      data,
      title: 'Score Distribution: ' + scoreChartDrilldown.start + '-' + scoreChartDrilldown.end,
      description: 'Exact score counts inside the selected range.',
      showBackButton: true,
    };
  }

  const data = Array(10).fill(0);
  const labels = scoreBinLabels();

  movies.forEach((m) => {
    if (m.score === null) return;
    const bucket = scoreToBucket(m.score);
    if (bucket !== null) data[bucket]++;
  });

  return {
    labels,
    data,
    title: 'Score Distribution',
    description: 'Counts in bins of 10 from 1\u2013100. Click a bar to drill down.',
    showBackButton: false,
  };
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

function buildScoreChart() {
  const scoredMovies = allMovies.filter((movie) => movie.score !== null);
  const state = getScoreChartState(scoredMovies);

  el.scoreChartTitle.textContent = state.title;
  el.scoreChartDesc.textContent = state.description;
  el.scoreChartBack.hidden = !state.showBackButton;

  if (typeof Chart === 'undefined') return;

  if (scoreChart) scoreChart.destroy();
  const ctx = $('scoreChart').getContext('2d');
  const grad = scoreGradient(ctx);

  scoreChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: state.labels,
      datasets: [
        {
          label: 'Films',
          data: state.data,
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
        if (scoreChartDrilldown) {
          setChartFilter({ type: 'score', value: scoreChartDrilldown.start + index });
          return;
        }
        scoreChartDrilldown = scoreBucketRange(index);
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
  const counts = {};
  RATING_STEPS.forEach((r) => {
    counts[r] = 0;
  });

  allMovies.forEach((m) => {
    if (m.rating === null) return;
    const r = Math.round(m.rating * 2) / 2;
    if (counts[r] !== undefined) counts[r]++;
  });

  const labels = RATING_STEPS.map((r) => '\u2605'.repeat(Math.floor(r)) + (r % 1 ? '\u00bd' : ''));

  if (typeof Chart === 'undefined') return;

  if (ratingChart) ratingChart.destroy();
  ratingChart = new Chart($('ratingChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Films',
          data: RATING_STEPS.map((r) => counts[r]),
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
        setChartFilter({ type: 'rating', value: RATING_STEPS[index] });
      },
      scales: chartScales({ autoSkip: false }),
    },
  });
}

function getWatchPeriodChartState(movies) {
  const years = movies
    .map((movie) => getMovieReleaseYear(movie))
    .filter((year) => year !== null);
  const collapsedDecadeEnd = 1949;
  const collapsedDecadeLabel = '1940s & earlier';

  if (!years.length) {
    return {
      labels: [],
      data: [],
      values: [],
      title: 'Films by Release Decade',
      description: 'No release years available.',
      showBackButton: false,
    };
  }

  if (watchPeriodChartDrilldown !== null) {
    const range =
      typeof watchPeriodChartDrilldown === 'number'
        ? {
            start: watchPeriodChartDrilldown,
            end: watchPeriodChartDrilldown + 9,
            title: 'Films Released in the ' + watchPeriodChartDrilldown + 's',
          }
        : watchPeriodChartDrilldown;
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
      title: range.title,
      description: 'Films by release year. Click a year to filter the film list.',
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
    description: 'Films by release decade. Click a bar to drill down.',
    showBackButton: false,
  };
}

function buildWatchPeriodChart() {
  const datedMovies = allMovies.filter((movie) => getMovieReleaseYear(movie) !== null);
  const state = getWatchPeriodChartState(datedMovies);

  if (el.watchPeriodChartTitle) el.watchPeriodChartTitle.textContent = state.title;
  if (el.watchPeriodChartDesc) el.watchPeriodChartDesc.textContent = state.description;
  if (el.watchPeriodChartBack) el.watchPeriodChartBack.hidden = !state.showBackButton;

  if (typeof Chart === 'undefined') return;

  if (watchPeriodChart) watchPeriodChart.destroy();
  const canvas = $('watchPeriodChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const grad = watchPeriodGradient(ctx);

  watchPeriodChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: state.labels,
      datasets: [
        {
          label: 'Films',
          data: state.data,
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
        if (index === null || !state.data[index]) return;
        if (watchPeriodChartDrilldown !== null) {
          setChartFilter({ type: 'release_year', value: state.values[index] });
          return;
        }
        watchPeriodChartDrilldown = state.values[index];
        buildWatchPeriodChart();
      },
      scales: chartScales({
        autoSkip: false,
        maxRotation: watchPeriodChartDrilldown !== null ? 45 : 0,
        minRotation: 0,
      }),
    },
  });
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

function formatPct(value) {
  const fixed = value.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

el.scoreChartBack.addEventListener('click', () => {
  scoreChartDrilldown = null;
  buildScoreChart();
});

if (el.watchPeriodChartBack) {
  el.watchPeriodChartBack.addEventListener('click', () => {
    watchPeriodChartDrilldown = null;
    buildWatchPeriodChart();
  });
}

function rebuildCharts() {
  buildScoreChart();
  buildRatingChart();
  buildWatchPeriodChart();
}

function clearChartFilter() {
  activeChartFilter = null;
  scoreChartDrilldown = null;
  watchPeriodChartDrilldown = null;
}

el.searchInput.addEventListener('input', () => {
  currentPage = 1;
  syncSearchClear();
  applyFilter();
});

el.searchInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;

  const term = normalizedSearchTerm(el.searchInput.value);
  if (!term) return;

  e.preventDefault();
  commitSearchTerm(term);
  el.searchInput.value = '';
  currentPage = 1;
  syncSearchClear();
  applyFilter();
});

el.searchClear.addEventListener('click', () => {
  el.searchInput.value = '';
  syncSearchClear();
  currentPage = 1;
  applyFilter();
});

if (el.pageSizeSelect) {
  el.pageSizeSelect.addEventListener('change', () => {
    const next = parseInt(el.pageSizeSelect.value, 10);
    pageSize = PAGE_SIZE_OPTIONS.includes(next) ? next : DEFAULT_PAGE_SIZE;
    currentPage = 1;
    renderTable();
  });
}

function normalizedSearchTerm(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function commitSearchTerm(term) {
  const normalized = normalizedSearchTerm(term);
  if (!normalized) return;
  if (!committedSearchTerms.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
    committedSearchTerms.push(normalized);
  }
}

function clearCommittedSearchTerms() {
  committedSearchTerms = [];
}

function syncSearchClear() {
  el.searchClear.hidden = el.searchInput.value.trim().length === 0;

  const hasDraftSearch = el.searchInput.value.trim().length > 0;
  const hasCommittedSearch = committedSearchTerms.length > 0;
  const hasSearch = hasDraftSearch || hasCommittedSearch;
  const hasChart = !!activeChartFilter;

  if (el.activeSearchFilter && el.activeSearchFilterLabel) {
    el.activeSearchFilter.hidden = !hasSearch;
    el.activeSearchFilterLabel.textContent = hasSearch ? searchFilterLabel() : '';
  }

  if (el.activeChartFilter && el.activeChartFilterLabel) {
    el.activeChartFilter.hidden = !hasChart;
    el.activeChartFilterLabel.textContent = hasChart
      ? 'Filtered by ' + chartFilterLabel()
      : '';
  }

  if (el.activeFilters) {
    el.activeFilters.hidden = !hasSearch && !hasChart;
  }
}

function searchFilterLabel() {
  const draft = el.searchInput.value.trim();
  const parts = committedSearchTerms.map((term) => '"' + term + '"');
  if (draft) parts.push('typing "' + draft + '"');
  return 'Search: ' + parts.join(' + ');
}

function setChartFilter(filter) {
  activeChartFilter = filter;
  syncSearchClear();
  currentPage = 1;
  applyFilter();
  $('tableWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function matchesChartFilter(m) {
  if (!activeChartFilter) return true;
  if (activeChartFilter.type === 'score') return m.score !== null && Math.round(m.score) === activeChartFilter.value;
  if (activeChartFilter.type === 'rating') return m.rating !== null && Math.abs(m.rating - activeChartFilter.value) < 1e-6;
  if (activeChartFilter.type === 'release_year') return getMovieReleaseYear(m) === activeChartFilter.value;
  return true;
}

function chartFilterLabel() {
  if (!activeChartFilter) return '';
  if (activeChartFilter.type === 'score') return 'score ' + activeChartFilter.value;
  if (activeChartFilter.type === 'rating') return activeChartFilter.value + ' stars';
  if (activeChartFilter.type === 'release_year') return 'released in ' + activeChartFilter.value;
  return '';
}

el.activeChartFilterClear.addEventListener('click', () => {
  clearChartFilter();
  syncSearchClear();
  rebuildCharts();
  currentPage = 1;
  applyFilter();
});

el.activeSearchFilterClear.addEventListener('click', () => {
  clearCommittedSearchTerms();
  el.searchInput.value = '';
  syncSearchClear();
  currentPage = 1;
  applyFilter();
});

/**
 * Title: partial match, case-insensitive.
 * Year: exact match when the query is an integer (e.g. "1999").
 * Score: exact match when the query is numeric (integer or decimal), e.g. "85" or "72.5".
 */
function matchesSearch(m, raw) {
  const q = raw.trim();
  if (!q) return true;

  const titleHit = m.movie.toLowerCase().includes(q.toLowerCase());
  const notesHit =
    m.notes && typeof m.notes === 'string' && m.notes.toLowerCase().includes(q.toLowerCase());

  const trimmed = q.trim();
  const asInt = parseInt(trimmed, 10);
  const isIntOnly = trimmed !== '' && String(asInt) === trimmed;

  const yearHit =
    isIntOnly &&
    m.year !== null &&
    m.year === asInt;

  let scoreHit = false;
  if (m.score !== null) {
    if (isIntOnly) {
      scoreHit = m.score === asInt;
    } else {
      const sf = parseFloat(trimmed.replace(/,/g, ''));
      if (
        Number.isFinite(sf) &&
        /^-?\d+(\.\d+)?$/.test(trimmed.replace(/,/g, ''))
      ) {
        scoreHit = Math.abs(m.score - sf) < 1e-6;
      }
    }
  }

  return titleHit || notesHit || yearHit || scoreHit;
}

function applyFilter() {
  const draft = el.searchInput.value.trim();
  filtered = allMovies.filter((m) => {
    const committedMatch = committedSearchTerms.every((term) => matchesSearch(m, term));
    const draftMatch = draft ? matchesSearch(m, draft) : true;
    const searchMatch = committedMatch && draftMatch;
    return searchMatch && matchesChartFilter(m);
  });
  applySort();
  renderTable();
}

document.querySelectorAll('th.sortable').forEach((th) => {
  th.title = 'Click to sort. Shift-click to add another sort.';
  th.addEventListener('click', (event) => {
    const col = th.dataset.col;
    if (!col) return;
    if (event.shiftKey) {
      extendSortRules(col);
    } else {
      setSingleSortRule(col);
    }
    currentPage = 1;
    applySort();
    renderTable();
    syncSortUI();
  });
});

function nextSortDir(dir) {
  return dir === 'asc' ? 'desc' : 'asc';
}

function findSortRuleIndex(col) {
  return sortRules.findIndex((rule) => rule.col === col);
}

function setSingleSortRule(col) {
  const idx = findSortRuleIndex(col);
  if (idx === 0) {
    sortRules = [{ col, dir: nextSortDir(sortRules[0].dir) }];
    return;
  }
  const existing = idx >= 0 ? sortRules[idx] : null;
  sortRules = [{ col, dir: existing ? existing.dir : 'asc' }];
}

function extendSortRules(col) {
  const idx = findSortRuleIndex(col);
  if (idx === -1) {
    sortRules = [...sortRules, { col, dir: 'asc' }];
    return;
  }
  const updated = sortRules.slice();
  updated[idx] = { col, dir: nextSortDir(updated[idx].dir) };
  sortRules = updated;
}

function sortKey(m, col) {
  const v = m[col];
  if (col === 'date_watched') {
    const dateValue = m.first_watched || v;
    if (!dateValue) return null;
    const t = new Date(dateValue).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (col === 'notes') {
    return v === '' || v == null ? null : String(v).toLowerCase();
  }
  if (col === 'review_link') {
    if (m.review_link) return '0|' + String(m.review_link).toLowerCase();
    if (m.notes) return '1|' + String(m.notes).toLowerCase();
    return null;
  }
  return v === '' || v === undefined ? null : v;
}

function applySort() {
  filtered.sort((a, b) => {
    for (const rule of sortRules) {
      const av = sortKey(a, rule.col);
      const bv = sortKey(b, rule.col);
      const an = av === null || av === '';
      const bn = bv === null || bv === '';
      if (an && bn) continue;
      if (an) return 1;
      if (bn) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        const diff = rule.dir === 'asc' ? av - bv : bv - av;
        if (diff !== 0) return diff;
        continue;
      }
      const diff = rule.dir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

function syncSortUI() {
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.classList.remove('sort-asc', 'sort-desc');
    const ind = th.querySelector('.sort-ind');
    if (ind) delete ind.dataset.priority;
    const idx = findSortRuleIndex(th.dataset.col);
    if (idx === -1) return;
    th.classList.add(sortRules[idx].dir === 'asc' ? 'sort-asc' : 'sort-desc');
    if (ind && sortRules.length > 1) ind.dataset.priority = String(idx + 1);
  });
}

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createRewatchIndicatorElement() {
  const badge = makeEl('span', 'rewatch-indicator', '\u21bb');
  badge.setAttribute('aria-label', 'Rewatch');
  badge.title = 'Rewatch';
  return badge;
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
  if (movie.has_rewatch) {
    rewatchCell.appendChild(createRewatchIndicatorElement());
  }
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

function buildEntryPreviewMeta(chronological, reversed, entry, idx) {
  let meta = watchTimelineLabel(reversed, entry, idx);

  if (entry.rating !== null) {
    meta += ' \u00B7 ' + String(entry.rating) + ' \u2605';
  }

  const score = entryPreviewScore(chronological, entry);
  if (score !== null) {
    meta += ' \u00B7 ' + String(score);
  }

  return meta;
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

function attachRowHandlers(tbody, resolveMovie) {
  tbody.querySelectorAll('tr').forEach((tr) => {
    const open = () => openDetail(resolveMovie(+tr.dataset.idx));
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') open();
    });
  });
}

function renderTable() {
  const total = filtered.length;
  const start = (currentPage - 1) * pageSize;
  const page = filtered.slice(start, start + pageSize);

  renderTableCount(total);

  if (!total) {
    renderEmptyTableState();
    return;
  }

  el.tableEmpty.classList.remove('table-empty--silent');
  el.tableEmpty.hidden = true;
  el.filmsTable.hidden = false;
  el.tableBody.textContent = '';
  const fragment = document.createDocumentFragment();
  page.forEach((movie, i) => {
    fragment.appendChild(createTableRowElement(movie, start + i));
  });
  el.tableBody.appendChild(fragment);

  attachRowHandlers(el.tableBody, (i) => filtered[i]);
  syncSortUI();
  renderPagination(total);
}

function renderTableCount(total) {
  if (!el.searchCount) return;
  const parts = tableCountParts(total);
  el.searchCount.textContent = '';
  const main = makeEl('span', 'search-count-main', parts.main);
  const sep = makeEl('span', 'search-count-sep', '\u00b7');
  sep.setAttribute('aria-hidden', 'true');
  const meta = makeEl('span', 'search-count-meta', parts.meta);
  el.searchCount.appendChild(main);
  el.searchCount.appendChild(sep);
  el.searchCount.appendChild(meta);
}

function tableCountParts(total) {
  const diaryEntries = filteredDiaryEntryCount();
  const filmWord = 'film' + (total !== 1 ? 's' : '');
  const chartPhrase = activeChartFilter
    ? activeChartFilter.type === 'rating'
      ? ' rated ' + chartFilterLabel()
      : activeChartFilter.type === 'score'
        ? ' with ' + chartFilterLabel()
        : ' ' + chartFilterLabel()
    : '';
  const baseLabel =
    !activeChartFilter ? total + ' ' + filmWord : total + ' ' + filmWord + chartPhrase;

  return {
    main: total > 0 ? baseLabel : activeChartFilter ? '0 films' + chartPhrase : '0 films',
    meta: diaryEntries + ' diary entr' + (diaryEntries === 1 ? 'y' : 'ies'),
  };
}

function filteredDiaryEntryCount() {
  return filtered.reduce((count, movie) => {
    return count + getLoggedWatchHistory(movie).length;
  }, 0);
}

function renderEmptyTableState() {
  el.tableBody.textContent = '';
  el.tableEmpty.hidden = false;
  el.filmsTable.hidden = true;
  el.pagination.textContent = '';

  if (allMovies.length === 0) {
    el.tableEmpty.classList.remove('table-empty--silent');
    el.tableEmptyMsg.textContent = '';
    return;
  }

  el.tableEmpty.classList.add('table-empty--silent');
  el.tableEmptyMsg.textContent = '';
}

function fmtRatingCell(r) {
  if (r === null) return '\u2014';
  return String(r) + ' \u2605';
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

function fmtNotesCell(n) {
  if (!n || !String(n).trim()) return '\u2014';
  const s = String(n).trim();
  if (s.length > 48) return s.slice(0, 45) + '\u2026';
  return s;
}

function createNotesCellContent(notes, reviewLink) {
  const noteText = fmtNotesCell(notes);
  if (!reviewLink) return document.createTextNode(noteText);

  const wrap = makeEl('div', 'notes-cell-content');
  if (noteText !== '\u2014') {
    wrap.appendChild(makeEl('span', 'notes-preview', noteText));
  }

  const link = makeEl('a', 'notes-review-link', 'Read');
  link.href = reviewLink;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.addEventListener('click', (event) => event.stopPropagation());
  link.addEventListener('keydown', (event) => event.stopPropagation());
  wrap.appendChild(link);

  return wrap;
}

function fmtScore(s) {
  if (s === null) return '\u2014';
  return String(s);
}

function createScoreContent(score) {
  const cls =
    score === null ? 'score-none' : score >= 70 ? 'score-high' : score >= 40 ? 'score-mid' : 'score-low';
  return makeEl('span', 'score-bubble ' + cls, fmtScore(score));
}

function fmtDelta(score, prev) {
  if (prev === null) return '\u2014';
  if (score === null) return String(prev);
  const d = score - prev;
  if (Math.abs(d) < 0.05) return String(prev);
  const sign = d > 0 ? '+' : '';
  return String(prev) + ' ' + sign + d.toFixed(1);
}

function createDeltaContent(score, prev) {
  const wrap = makeEl('span', 'delta-wrap');
  if (prev === null) {
    wrap.textContent = '\u2014';
    return wrap;
  }
  if (score === null || Math.abs(score - prev) < 0.05) {
    wrap.textContent = String(prev);
    return wrap;
  }

  wrap.appendChild(document.createTextNode(String(prev) + ' '));
  const delta = score - prev;
  const deltaText = (delta > 0 ? '+' : '') + delta.toFixed(1);
  wrap.appendChild(makeEl('span', delta > 0 ? 'delta-pos' : 'delta-neg', deltaText));
  return wrap;
}

function fmtDate(v) {
  if (!v) return '\u2014';
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return String(v);
}

function renderPagination(total) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) {
    el.pagination.innerHTML = '';
    return;
  }
  const mkBtn = (lbl, pg, dis, act) =>
    '<button type="button" class="pg-btn' +
    (act ? ' active' : '') +
    (dis ? ' disabled' : '') +
    '" ' +
    (dis ? 'disabled' : '') +
    ' data-page="' +
    pg +
    '">' +
    lbl +
    '</button>';
  let html = mkBtn('\u2039', currentPage - 1, currentPage === 1, false);
  const near = new Set(
    [1, pages, currentPage - 1, currentPage, currentPage + 1].filter((p) => p >= 1 && p <= pages)
  );
  let prev = 0;
  [...near]
    .sort((a, b) => a - b)
    .forEach((p) => {
      if (p - prev > 1) html += '<button type="button" class="pg-btn" disabled>\u2026</button>';
      html += mkBtn(String(p), p, false, p === currentPage);
      prev = p;
    });
  html += mkBtn('\u203a', currentPage + 1, currentPage === pages, false);
  el.pagination.innerHTML = html;
  el.pagination.querySelectorAll('.pg-btn[data-page]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.disabled || b.classList.contains('active')) return;
      currentPage = +b.dataset.page;
      renderTable();
      $('tableWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function openDetail(m) {
  $('detailYear').textContent = m.year != null ? String(m.year) : '';
  $('detailTitle').textContent = m.movie;

  renderDetailTimeline(m);
  renderDetailScores(m);

  const rb = $('detailRatingBlock');
  if (m.rating !== null) {
    rb.hidden = false;
    $('detailStars').innerHTML = renderStars(m.rating);
  } else rb.hidden = true;

  const nb = $('detailNotesBlock');
  const nEl = $('detailNotes');
  const hasNotes = !!(m.notes && String(m.notes).trim());
  const reviewLinksEl = $('detailReviewLinks');
  const hasReviews = renderDetailReviewLinks(m, reviewLinksEl);
  if (hasNotes || hasReviews) {
    nb.hidden = false;
    nEl.hidden = !hasNotes;
    nEl.textContent = hasNotes ? String(m.notes).trim() : '';
  } else {
    nb.hidden = true;
    nEl.hidden = true;
    nEl.textContent = '';
  }

  el.detailPanel.classList.add('open');
  el.detailPanel.setAttribute('aria-hidden', 'false');
  el.panelBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  el.detailClose.focus();
}

function renderDetailTimeline(movie) {
  const timeline = $('detailTimeline');
  const watches = [...getLoggedWatchHistory(movie)].reverse();
  timeline.textContent = '';

  if (!watches.length) {
    timeline.appendChild(makeEl('p', 'detail-muted', 'No watch date recorded.'));
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
  timeline.appendChild(fragment);
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
    const link = makeEl('a', 'detail-review-link', reviewEntries.length > 1 ? 'Review ' + (idx + 1) : 'Read review');
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
  const scoresEl = $('detailScores');
  const scoresToRender = detailScoresToRender(movie);
  scoresEl.textContent = '';

  if (!scoresToRender.length) {
    scoresEl.appendChild(makeEl('p', 'detail-muted', 'No scores recorded.'));
    return;
  }

  const fragment = document.createDocumentFragment();
  scoresToRender.forEach((entry, idx) => {
    if (idx > 0) fragment.appendChild(makeEl('div', 'score-arrow', '\u2192'));

    const block = makeEl('div', 'score-block');
    block.appendChild(makeEl('span', 'score-block-label', idx === scoresToRender.length - 1 ? 'Latest' : 'Past'));
    block.appendChild(makeEl('span', 'score-big' + (idx === scoresToRender.length - 1 ? ' current' : ''), String(entry.score)));
    if (entry.date_watched) {
      block.appendChild(makeEl('span', 'timeline-date', fmtDate(entry.date_watched)));
    }
    fragment.appendChild(block);
  });
  scoresEl.appendChild(fragment);
}

function watchTimelineLabel(watches, watch, idx) {
  if (watches.length === 1) return watch.rewatch ? 'Rewatch' : 'Watched';
  if (idx === 0) return watch.rewatch ? 'Latest rewatch' : 'Latest watch';
  if (idx === watches.length - 1) return watch.rewatch ? 'Rewatch' : 'First watch';
  return 'Rewatch';
}

function closeDetail() {
  el.detailPanel.classList.remove('open');
  el.detailPanel.setAttribute('aria-hidden', 'true');
  el.panelBackdrop.hidden = true;
  document.body.style.overflow = '';
}

el.detailClose.addEventListener('click', closeDetail);
el.panelBackdrop.addEventListener('click', closeDetail);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDetail();
});

function renderStars(rating) {
  let h = '';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) h += '<span class="star-full">\u2605</span>';
    else if (rating >= i - 0.5) h += '<span class="star-half">\u00bd</span>';
    else h += '<span class="star-empty">\u2606</span>';
  }
  return h + '<span class="star-label">' + rating + ' / 5</span>';
}
