// Data loading logic for CSV fetches plus bundled and sample-data fallbacks.
import { CSV_PATH, SAMPLE_MOVIES } from '../constants.js';
import { parseCSV } from './parser.js';
import { normaliseRows } from './normaliser.js';

function cloneSampleMovies() {
  return SAMPLE_MOVIES.map((movie) => ({ ...movie }));
}

function bundledMovies() {
  if (!Array.isArray(window.__MOVIES_DATA__) || !window.__MOVIES_DATA__.length) return [];
  return normaliseRows(window.__MOVIES_DATA__);
}

export async function loadMoviesData() {
  try {
    if (window.location.protocol === 'file:') {
      const bundledData = bundledMovies();
      if (bundledData.length) {
        return { movies: bundledData, alertMessage: '' };
      }
    }

    const response = await fetch(CSV_PATH, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const rows = parseCSV(await response.text());
    if (!rows.length) {
      return {
        movies: cloneSampleMovies(),
        alertMessage: 'The CSV was found, but it was empty. The page is showing built-in sample entries instead.',
      };
    }

    const movies = normaliseRows(rows);
    if (!movies.length) {
      return {
        movies: cloneSampleMovies(),
        alertMessage:
          'The CSV loaded, but its columns did not match the expected movie format. The page is showing sample entries instead.',
      };
    }

    return { movies, alertMessage: '' };
  } catch (error) {
    console.warn("[Harsh's Film Diary]", error);

    const bundledData = bundledMovies();
    if (bundledData.length) {
      return { movies: bundledData, alertMessage: '' };
    }

    return {
      movies: cloneSampleMovies(),
      alertMessage:
        'The page could not read data/movies.csv. This usually happens when index.html is opened directly with file:// instead of through a local server like Live Server.',
    };
  }
}
