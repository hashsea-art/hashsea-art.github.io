# Harsh's Film Diary

A static personal film diary site built for GitHub Pages.

The site reads diary data from `data/movies.csv` and renders stats, charts, filters, and a film table entirely in the browser. The frontend is split into small ES modules under `src/` for easier maintenance.

## Project Structure

- `index.html`: page shell and security-related meta tags
- `style.css`: site styles
- `data/movies.csv`: primary diary data source
- `src/main.js`: app entrypoint
- `src/data/`: CSV loading, parsing, and normalization
- `src/ui/`: charts, filters, table, detail panel, heatmap, and other UI modules
- `src/utils/`: shared DOM and formatting helpers
- `vendor/chart.umd.min.js`: Chart.js bundle

## Local Development

Use a local server rather than opening `index.html` with `file://`, because the app fetches `data/movies.csv` at runtime.

Recommended:

1. Open the project in VS Code.
2. Install the `Live Server` extension.
3. Right-click `index.html`.
4. Choose `Open with Live Server`.

This should open a local URL such as `http://127.0.0.1:5500/`.

## GitHub Pages

This project is structured to work as a static site on GitHub Pages:

- all assets are referenced with relative paths
- the app runs entirely in the browser
- `src/main.js` is loaded as an ES module
- the diary data is fetched from `data/movies.csv`

## Data Notes

- Keep `data/movies.csv` as the main editable source.
- The site expects `data/movies.csv` to be available through a local server or static host.

## License

This project is proprietary. See [LICENSE](./LICENSE).
