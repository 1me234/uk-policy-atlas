#!/usr/bin/env bash
# Rebuild every dataset in public/data from the official sources.
# Downloads go to raw/ (gitignored). Needs Python 3.11+, pandas, openpyxl, pyproj, requests,
# and LibreOffice (soffice) for .ods files. Wikidata is rate-limited, so infrastructure runs last and is slow.
set -euo pipefail
cd "$(dirname "$0")/.."
for s in spending orgs civil_service projects boundaries lookup councils population schools ks4 welfare charities contracts fiscal nhs_performance oda send infrastructure; do
  echo "== $s"; python3 pipeline/build_$s.py
done
cp pipeline/curated/*.json public/data/
echo "Done."
