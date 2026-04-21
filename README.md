# Harsh's Film Diary

A personal film diary. Tracks films I've watched and serves as a richer stats companion to my Letterboxd profile.

## How It Works

- `data/movies.csv` is fetched and parsed on page load
- Movie records are normalized and loaded into shared app state
- Stats, charts, and the heatmap are rendered from that state
- The film table populates with sorting and filter controls
- Selecting a film opens a detail panel with full info
- All filtering, sorting, and navigation happens client-side — no reloads

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

## License

This project is proprietary. See [LICENSE](./LICENSE).
