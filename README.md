# Finance Tracker (Static Web App)

A simple, free, and pretty finance tracker you can host on GitHub Pages. No backend needed. Data is stored in your browser (localStorage).

## Features
- Add income and expense transactions
- Saved categories with autocomplete (no more retyping)
- Filter by month and search by text or category
- Summary of income, expenses, and balance
- Monthly budget with remaining amount indicator
- Charts
  - Line chart of income vs expense by month
  - Pie chart of spending by category (filterable by month)
- Edit and delete transactions
- Export to CSV
- **Import CSV** (merge or replace existing)
- Dark, modern UI
- 100% client-side, deployable to GitHub Pages

## CSV Format
Header row required. Supported columns:
```
id,type,amount,category,desc,dateISO
```
- `id` is optional. If missing, one will be generated.
- `type` must be `income` or `expense`.
- `dateISO` should be `YYYY-MM-DD`. If not, the app will try to parse it.

On import you will be asked:
- OK = replace existing transactions with the CSV
- Cancel = merge CSV into current data (duplicates by id are overwritten)

## Quick Start
1. Download this repo or click **Use this template** on GitHub.
2. Open `index.html` in a browser to run locally.
3. Deploy to GitHub Pages:
   - Push to a public repo.
   - In GitHub: Settings → Pages → Build and deployment → Deploy from branch → `main` → `/root`.
   - The site will be live on `https://<your-username>.github.io/<repo-name>/`.

## Tech
- Vanilla HTML + CSS + JavaScript
- Chart.js via CDN
- localStorage for persistence

## Roadmap Ideas
- Recurring transactions
- Currency switcher
- PWA installable app
- IndexedDB for large datasets
