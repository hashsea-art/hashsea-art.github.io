// Movie-domain helpers for watch history, score buckets, dates, and derived labels.
export function getWatchHistory(movie) {
  return movie.watch_history && movie.watch_history.length ? movie.watch_history : [movie];
}

export function hasLoggedDate(value) {
  return !!(value && String(value).trim());
}

export function getLoggedWatchHistory(movie) {
  return getWatchHistory(movie).filter((watch) => hasLoggedDate(watch.date_watched));
}

export function getMovieReleaseYear(movie) {
  if (movie.year == null || movie.year === '') return null;
  const year = parseInt(String(movie.year), 10);
  return Number.isFinite(year) ? year : null;
}

export function getWatchEntries(movies) {
  return movies.flatMap((movie) =>
    getWatchHistory(movie).map((watch) => ({
      rating: watch.rating ?? null,
      score: watch.score ?? null,
      date_watched: watch.date_watched ?? '',
    }))
  );
}

export function scoreToBucket(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  if (value <= 10) return 0;
  return Math.min(9, Math.floor((value - 1) / 10));
}

export function scoreBinLabels() {
  const labels = [];
  for (let i = 0; i < 10; i++) {
    const start = i * 10 + 1;
    const end = (i + 1) * 10;
    labels.push(start + '\u2013' + end);
  }
  return labels;
}

export function scoreBucketRange(index) {
  const start = index * 10 + 1;
  const end = (index + 1) * 10;
  return { start, end };
}

export function exactScoreLabels(range) {
  const labels = [];
  for (let score = range.start; score <= range.end; score++) labels.push(String(score));
  return labels;
}

export function decadeStart(year) {
  return Math.floor(year / 10) * 10;
}

export function monthHeatmapKey(year, monthIndex) {
  return String(year) + '-' + String(monthIndex + 1).padStart(2, '0');
}

export function getMovieHeatmapDate(movie) {
  const raw = movie.date_watched || movie.first_watched;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function watchTimelineLabel(watches, watch, idx) {
  if (watches.length === 1) return watch.rewatch ? 'Rewatch' : 'Watched';
  if (idx === 0) return watch.rewatch ? 'Latest rewatch' : 'Latest watch';
  if (idx === watches.length - 1) return watch.rewatch ? 'Rewatch' : 'First watch';
  return 'Rewatch';
}

export function latestByFilmMap(movies) {
  const map = new Map();
  for (const movie of movies) {
    const key = `${movie.movie}|${movie.year}`;
    const existing = map.get(key);
    if (!existing || movie.date_watched > existing.date_watched) map.set(key, movie);
  }
  return map;
}
