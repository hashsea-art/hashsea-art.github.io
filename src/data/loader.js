// Data loading logic for fetching and validating the main CSV source.
import { CSV_PATH } from '../constants.js';
import { parseCSV } from './parser.js';
import { normaliseRows } from './normaliser.js';

export async function loadMoviesData() {
  const response = await fetch(CSV_PATH, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load ' + CSV_PATH + ' (HTTP ' + response.status + ').');
  }

  const rows = parseCSV(await response.text());
  if (!rows.length) {
    throw new Error('The CSV loaded successfully, but it did not contain any rows.');
  }

  const movies = normaliseRows(rows);
  if (!movies.length) {
    throw new Error('The CSV loaded, but its columns did not match the expected movie format.');
  }

  return { movies, alertMessage: '' };
}
