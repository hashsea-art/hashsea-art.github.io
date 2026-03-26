# Harsh's Film Diary

A static personal film diary site built for GitHub Pages.

The site reads diary data from `data/movies.csv` and renders stats, charts, filters, a watch heatmap, and a film table entirely in the browser. The frontend is organized into small ES modules under `src/` so the project stays manageable as it grows.

## Structure

- `index.html`: page shell, metadata, and static panel content
- `style.css`: site styles
- `data/movies.csv`: diary data source
- `vendor/chart.umd.min.js`: Chart.js bundle
- `src/main.js`: app entrypoint and top-level wiring
- `src/state.js`: shared app state
- `src/constants.js`: shared constants and column aliases
- `src/movies.js`: movie/watch helpers used across the UI
- `src/data/`: CSV loading, parsing, and normalization
- `src/ui/`: charts, filters, table, detail panel, heatmap, sorting, stats, and static chrome
- `src/utils/`: shared DOM and formatting helpers

## Local Development

Use a local server rather than opening `index.html` with `file://`, because the app fetches `data/movies.csv` at runtime.

Recommended setup with VS Code:

1. Open the project folder in VS Code.
2. Install the `Live Server` extension.
3. Right-click `index.html`.
4. Choose `Open with Live Server`.

This should open a local URL such as `http://127.0.0.1:5500/`.

## GitHub Pages

This project is set up to work as a static GitHub Pages site:

- assets use relative paths
- the app runs fully in the browser
- `src/main.js` loads as an ES module
- diary data is read from `data/movies.csv`

## Data

- Edit `data/movies.csv` as the main source of truth.
- Keep the CSV available alongside the site when deploying.
- If the CSV cannot be loaded, the page shows a load warning instead of fallback sample data.

## License

This project is proprietary. See [LICENSE](./LICENSE).
