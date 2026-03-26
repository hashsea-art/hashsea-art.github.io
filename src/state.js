// Central mutable UI state shared across modules.
import { DEFAULT_PAGE_SIZE, DEFAULT_SORT_RULES } from './constants.js';

export const state = {
  allMovies: [],
  filtered: [],
  currentPage: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  committedSearchTerms: [],
  sortRules: DEFAULT_SORT_RULES.map((rule) => ({ ...rule })),
  scoreChartDrilldown: null,
  watchPeriodChartDrilldown: null,
  activeChartFilters: {},
};
