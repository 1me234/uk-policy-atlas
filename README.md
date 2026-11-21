# UK Policy Atlas

One place to see what the UK state spends, runs and builds, and where it is going wrong or working. Every number in the app comes from an official file that is cited on the card that shows it.

Live site: https://1me234.github.io/uk-policy-atlas/ (deployed from `main` by GitHub Actions)

## Sections

| Area | What it shows | Main source |
|---|---|---|
| Overview, Findings & plan | Headline numbers; findings computed from the data; IfG service ratings; a strategy workbench you can export as Markdown | All of the below |
| Policy history | 18 landmark policies: context, what changed, effects, where to track them | Curated, with citations |
| Spending & fiscal | Spending by department, function and economic category; 1900+ debt and deficit series | HMT PESA 2025, OBR databank |
| Contracts & suppliers | 12 months of award notices, biggest buyers and suppliers | Contracts Finder (OCDS) |
| Departments & civil service | Staff, grades, pay, location, budgets and arm's-length bodies per department | Civil Service Statistics 2025, PESA, GOV.UK |
| Major projects | 189 projects with delivery-confidence ratings, costs, benefits and narratives | NISTA Annual Report 2025-26 |
| Foreign affairs & defence | FCDO, aid, defence and intelligence spending and projects | PESA, NISTA |
| Infrastructure map | ~26,000 assets (roads, rail, reservoirs, power, ports, hospitals...) with build dates, cost and parent scheme where known | Wikidata |
| Councils | Choropleth of 2025-26 outturn per head, reserves, SEND (DSG) deficits, debt costs | MHCLG Revenue Outturn, ONS population and boundaries |
| NHS | Funding, ICB map, hospitals, major projects, performance ratings | PESA, NISTA, IfG Performance Tracker |
| Education | Every open school: capacity, free school meals, GCSE results; academy trusts | DfE GIAS, KS4 performance (EES API) |
| Social security | Benefit spending 1948 to forecast, caseloads | DWP benefit expenditure tables |
| Charities & NGOs | 172,000 charities, income, government funding dependence | Charity Commission register |
| Sources & catalogue | Every dataset, 54 outside organisations that publish related research, and the backlog of data not yet ingested | |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## Rebuild the data

```bash
pip install pandas openpyxl pyproj requests
./pipeline/run_all.sh
```

Each `pipeline/build_*.py` script downloads its source into `raw/` and writes one `public/data/*.json` file with a `source` block (`name`, `url`, `file`). Hand-curated files (organisations catalogue, policy history, independent ratings, data backlog) live in `pipeline/curated/`.

## Known gaps

NHS England and NHS Digital block automated downloads, so waiting lists, workforce and trust finance are not yet ingested. Progress 8 is not published for 2025-26. See the backlog on the Sources page for the full list.
