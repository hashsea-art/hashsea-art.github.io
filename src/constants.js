// Shared app constants: data paths, chart theme values, and app defaults.
export const CSV_PATH = './data/movies.csv';

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [20, 50, 100];
export const RATING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CHART_THEME = {
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

export const COL_ALIASES = {
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

export const DEFAULT_SORT_RULES = [{ col: 'date_watched', dir: 'desc' }];
