// Data normalization pipeline that maps raw CSV rows into the app's movie model.
import { COL_ALIASES } from '../constants.js';

function buildColMap(row) {
  const keys = Object.keys(row);
  const map = {};
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    map[field] = keys.find((key) => aliases.includes(key)) || null;
  }
  return map;
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

function parseScore(value) {
  if (value === '' || value == null) return null;
  const score = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(score) ? score : null;
}

function parseYear(value) {
  if (value === '' || value == null) return null;
  const year = parseInt(String(value).trim(), 10);
  return Number.isFinite(year) ? year : null;
}

function parseRating(value) {
  if (!value) return null;
  const raw = String(value).trim();
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
  const rating = parseFloat(normalized);
  if (!Number.isFinite(rating)) return null;
  return Math.min(5, Math.max(0, rating));
}

function parseRewatch(value) {
  if (!value) return false;
  return ['yes', 'true', '1', 'rewatch'].includes(String(value).trim().toLowerCase());
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
  const time = new Date(date).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER - 100000 + fallbackIdx;
}

function buildMoviesFromEntries(entries) {
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

  const first = watches[0];
  const rewatchCount = watches.filter((watch) => watch.rewatch).length;
  const scoreHistory = watches
    .filter((watch) => watch.score !== null)
    .map((watch) => ({ score: watch.score, date_watched: watch.date_watched }));

  const datedWatches = watches.filter((w) => w.date_watched && String(w.date_watched).trim());

  // Single or no dated entry: original single-row behavior
  if (datedWatches.length <= 1) {
    const latest = watches[watches.length - 1];
    const latestReviewedWatch = [...watches].reverse().find(
      (watch) => watch.review_link && String(watch.review_link).trim()
    );
    return [{
      movie: latest.movie,
      year: latest.year,
      rating: latest.rating,
      score: latest.score,
      date_watched: latest.date_watched,
      first_watched: first.date_watched,
      has_rewatch: rewatchCount > 0,
      rewatch_count: rewatchCount,
      previous_score: latest.previous_score,
      notes: latest.notes,
      review_link: latestReviewedWatch ? latestReviewedWatch.review_link : latest.review_link,
      watch_history: watches,
      score_history: scoreHistory,
    }];
  }

  // Multiple dated entries: one row per dated entry
  return datedWatches.map((watch) => {
    return {
      movie: watch.movie,
      year: watch.year,
      rating: watch.rating,
      score: watch.score,
      date_watched: watch.date_watched,
      first_watched: first.date_watched,
      has_rewatch: watch.rewatch,
      rewatch_count: rewatchCount,
      previous_score: watch.previous_score,
      notes: watch.notes,
      review_link: watch.review_link || '',
      watch_history: watches,
      score_history: scoreHistory,
    };
  });
}

export function normaliseRows(rows) {
  if (!rows.length) return [];
  const colMap = buildColMap(rows[0]);
  if (!colMap.movie) return [];

  const parsed = rows
    .map((row, idx) => ({
      movie: str(row, colMap.movie),
      year: parseYear(str(row, colMap.year)),
      rating: parseRating(str(row, colMap.rating)),
      rewatch: parseRewatch(str(row, colMap.rewatch)),
      score: parseScore(str(row, colMap.score)),
      date_watched: str(row, colMap.date_watched),
      previous_score: parseScore(str(row, colMap.previous_score)),
      notes: colMap.notes ? str(row, colMap.notes) : '',
      review_link: colMap.review_link ? safeExternalUrl(str(row, colMap.review_link)) : '',
      _idx: idx,
    }))
    .filter((movie) => isUsableMovieTitle(movie.movie));

  const grouped = new Map();
  parsed.forEach((entry) => {
    const key = normalizeMovieKey(entry.movie, entry.year);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  });

  return Array.from(grouped.values()).flatMap(buildMoviesFromEntries);
}
