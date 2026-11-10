# Ground truth for `npm run parity`: runs the real FastAPI detector (BackEnd/src) over the sample CSVs exactly like
# POST /validate/csv (pandas.read_csv + analisar_texto(str(x))) and over scripts/parity/cases.json, then writes
# scripts/parity/expected.json. Only needed when the Python rules change.
# Needs pandas (pip install pandas==2.2.0). Run from FrontEnd/ with a relative path: Python argv mangles the
# non-ASCII repo path.   python -I scripts/parity_expected.py
import json
import sys
from pathlib import Path

import pandas as pd

here = Path(__file__).resolve().parent
backend = here.parent.parent / "BackEnd"
sys.path.insert(0, str(backend))

from src.core.config import TEXT_COLUMN_CANDIDATES  # noqa: E402
from src.core.detector import analisar_texto  # noqa: E402

out = {"csv": {}, "cases": []}
for path in sorted((backend / "data" / "input").glob("*.csv")):
    df = pd.read_csv(path)
    coluna = next((c for c in df.columns if c.lower() in TEXT_COLUMN_CANDIDATES), None)
    out["csv"][path.name] = df[coluna].apply(lambda x: analisar_texto(str(x))).tolist()

cases = json.loads((here / "parity" / "cases.json").read_text(encoding="utf-8"))
out["cases"] = [analisar_texto(t) for t in cases]

(here / "parity" / "expected.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print(f"expected: {sum(len(v) for v in out['csv'].values())} csv rows, {len(cases)} cases")
