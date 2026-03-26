// Monthly watch heatmap rendering and its filter interactions.
import { MONTH_LABELS } from '../constants.js';
import { state } from '../state.js';
import { getMovieHeatmapDate, monthHeatmapKey } from '../movies.js';
import { makeEl } from '../utils/dom.js';

let onSetChartFilter = () => {};
let onClearChartFilterType = () => {};

function getElements() {
  return {
    monthHeatmap: document.getElementById('monthHeatmap'),
  };
}

function getMonthHeatmapState(movies) {
  const countsByYear = new Map();

  movies.forEach((movie) => {
    const date = getMovieHeatmapDate(movie);
    if (!date) return;

    const year = date.getFullYear();
    const month = date.getMonth();
    if (!countsByYear.has(year)) countsByYear.set(year, Array(12).fill(0));
    countsByYear.get(year)[month]++;
  });

  const years = [...countsByYear.keys()].sort((a, b) => b - a);
  const rows = years.map((year) => ({ year, counts: countsByYear.get(year) }));
  const maxCount = rows.reduce((max, row) => Math.max(max, ...row.counts), 0);

  return { rows, maxCount };
}

function monthHeatmapLevel(count, maxCount) {
  if (!count || !maxCount) return 0;
  const ratio = count / maxCount;
  if (ratio >= 0.75 || count === maxCount) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

export function renderMonthHeatmap() {
  const { monthHeatmap } = getElements();
  if (!monthHeatmap) return;

  const heatmapState = getMonthHeatmapState(state.filtered);
  monthHeatmap.textContent = '';

  if (!heatmapState.rows.length) {
    monthHeatmap.appendChild(
      makeEl('p', 'month-heatmap-empty', 'No watched months are available in the current film list.')
    );
    return;
  }

  const scroll = makeEl(
    'div',
    'month-heatmap-scroll' + (heatmapState.rows.length > 5 ? ' month-heatmap-scroll--tall' : '')
  );
  const grid = makeEl('div', 'month-heatmap-grid');
  grid.appendChild(makeEl('div', 'month-heatmap-head month-heatmap-head--year', 'Year'));
  MONTH_LABELS.forEach((label) => {
    grid.appendChild(makeEl('div', 'month-heatmap-head', label));
  });

  heatmapState.rows.forEach((row) => {
    grid.appendChild(makeEl('div', 'month-heatmap-year', String(row.year)));

    row.counts.forEach((count, monthIndex) => {
      const key = monthHeatmapKey(row.year, monthIndex);
      const cell = makeEl('button', 'month-heatmap-cell', String(count));
      cell.type = 'button';
      cell.classList.add(
        count ? 'month-heatmap-cell--lvl' + monthHeatmapLevel(count, heatmapState.maxCount) : 'month-heatmap-cell--empty'
      );
      cell.disabled = count === 0;

      if (state.activeChartFilters.watched_month && key === state.activeChartFilters.watched_month.value) {
        cell.classList.add('is-active');
      }

      const label = MONTH_LABELS[monthIndex] + ' ' + row.year + ' · ' + count + ' film' + (count === 1 ? '' : 's');
      cell.title = count ? label + ' · filter films watched in that month' : label;
      cell.setAttribute('aria-label', count ? label + '. Filter films watched in that month.' : label + '.');

      if (count) {
        cell.addEventListener('click', () => {
          if (state.activeChartFilters.watched_month && state.activeChartFilters.watched_month.value === key) {
            onClearChartFilterType('watched_month');
            return;
          }

          onSetChartFilter({
            type: 'watched_month',
            value: key,
            year: row.year,
            monthIndex,
          });
        });
      }

      grid.appendChild(cell);
    });
  });

  scroll.appendChild(grid);
  monthHeatmap.appendChild(scroll);
  scroll.scrollTop = 0;
  scroll.scrollLeft = 0;

  const legend = makeEl('div', 'month-heatmap-legend');
  legend.appendChild(makeEl('span', '', 'Low'));
  legend.appendChild(makeEl('span', 'month-heatmap-legend-swatch month-heatmap-legend-swatch--low'));
  legend.appendChild(makeEl('span', 'month-heatmap-legend-swatch month-heatmap-legend-swatch--high'));
  legend.appendChild(makeEl('span', '', 'High'));
  monthHeatmap.appendChild(legend);
}

export function initHeatmap({ setChartFilter, clearChartFilterType }) {
  onSetChartFilter = setChartFilter;
  onClearChartFilterType = clearChartFilterType;
}
