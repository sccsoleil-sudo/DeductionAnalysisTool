"""Independent pandas implementation of the dashboard KPIs.

Deliberately written from the codification book rather than shared with the app, so
that agreement between the two is real evidence the rules were applied correctly.

    python tools/reference_calc.py "../Logistics master data Final 202501 TO 202607.xlsx"

Compare its output against `npm run verify`, which runs the app's own TypeScript.
"""

import sys

import pandas as pd

PATH = sys.argv[1] if len(sys.argv) > 1 else "../Logistics master data Final 202501 TO 202607.xlsx"

REQUIRED = ["Reason Code", "Amount (CoCode Crcy)", "Customer Name", "Journal Entry Date"]
EXCLUDED_EXACT = {"PMT"}
EXCLUDED_CONTAINS = ("XX",)  # *XX* — XXX, XXXX, XXXXX, …


def is_excluded(code: str) -> bool:
    c = str(code).strip().upper()
    if c in EXCLUDED_EXACT:
        return True
    return any(part in c for part in EXCLUDED_CONTAINS)
RECOVERED_CODES = {"", "PAYBACK", "RET", "RT", "R1R2"}
DIVISIONS = {"02AA": "CPD", "02AB": "PPD", "02AC": "LPD", "02AD": "LDB"}
R16_CATS = {"FR": "Fill Rate", "EDI": "EDI", "PREP": "DC Charges", "SHIP": "Delivery", "KAM": "Commercial"}

xl = pd.ExcelFile(PATH)
frames = []
for s in xl.sheet_names:
    df = xl.parse(s)
    cols = [str(c).strip() for c in df.columns]
    df.columns = cols
    if all(r in cols for r in REQUIRED):
        df["__sheet"] = s
        frames.append(df)
    else:
        print(f"skipped sheet {s!r} (missing required columns)")

data = pd.concat(frames, ignore_index=True)
print("combined rows:", len(data))


def norm(v):
    if pd.isna(v):
        return ""
    return " ".join(str(v).strip().upper().split())


data["rc"] = data["Reason Code"].map(norm)
data["rk2"] = data["Reference Key 2"].map(norm)
data["amt"] = pd.to_numeric(data["Amount (CoCode Crcy)"], errors="coerce").fillna(0.0)
data["jed"] = pd.to_datetime(data["Journal Entry Date"], errors="coerce")
data["cd"] = pd.to_datetime(data["Clearing Date"], errors="coerce")
data["cje"] = data["Clearing Journal Entry"].map(lambda v: "" if pd.isna(v) else str(v).strip())
data["is_open"] = (data["cd"].isna()) & (data["cje"] == "")
data["div"] = data["Business Area"].map(norm).map(lambda c: DIVISIONS.get(c, "Unknown"))

print("\nclearing-date-blank vs cje-blank agreement:")
print(pd.crosstab(data["cd"].isna(), data["cje"] == ""))


def r02_outcome(row):
    if is_excluded(row.rk2):
        return "Excluded"
    if row.is_open:
        return "Open"
    if row.rk2 in RECOVERED_CODES:
        return "Recovered"
    if "WO" in row.rk2:
        return "COM Write-Off" if row.rk2.startswith("COM") else "Write-Off"
    if row.rk2.startswith("COM"):
        return "Refuse to Pay"
    if row.rk2 == "SHO":
        return "Actual Shortage"
    return "Unclassified"


def r16_outcome(row):
    if is_excluded(row.rk2):
        return "Excluded"
    if row.is_open:
        return "Open"
    if row.rk2 in RECOVERED_CODES:
        return "Recovered"
    if "WO" in row.rk2:
        return "COM Write-Off" if row.rk2.startswith("COM") else "Write-Off"
    if row.rk2.startswith("COM"):
        return "Refuse to Pay"
    return R16_CATS.get(row.rk2, "Unclassified")


r02 = data[data.rc == "R02"].copy()
r16 = data[data.rc == "R16"].copy()
r02["outcome"] = r02.apply(r02_outcome, axis=1)
r16["outcome"] = r16.apply(r16_outcome, axis=1)

asof = data["jed"].max()
print("\nas-of (max journal entry date):", asof)
cy = asof.year
ly = cy - 1


def ytd(df, year):
    start = pd.Timestamp(year=year, month=1, day=1)
    end = pd.Timestamp(year=year, month=asof.month, day=asof.day)
    return df[(df.jed >= start) & (df.jed <= end)]


def open_ar_asof(df, d):
    """Open balance snapshot: booked on/before d and not cleared on/before d."""
    return df[(df.jed <= d) & (df.cd.isna() | (df.cd > d))]


for label, df, fn in [("R02 SHORTAGE", r02, r02_outcome), ("R16 PENALTIES", r16, r16_outcome)]:
    print("\n" + "=" * 70)
    print(label)
    print("\noutcome totals (all time):")
    print(df.groupby("outcome")["amt"].agg(["count", "sum"]).round(2).to_string())

    for year in (ly, cy):
        w = ytd(df, year)
        incl = w[w.outcome != "Excluded"]
        rec = incl.loc[incl.outcome == "Recovered", "amt"].sum()
        wo = incl.loc[incl.outcome.isin(["Write-Off", "COM Write-Off"]), "amt"].sum()
        comwo = incl.loc[incl.outcome == "COM Write-Off", "amt"].sum()
        rtp = incl.loc[incl.outcome == "Refuse to Pay", "amt"].sum()
        sho = incl.loc[incl.outcome == "Actual Shortage", "amt"].sum()
        opn = incl.loc[incl.outcome == "Open", "amt"].sum()
        lost = wo + rtp
        denom = rec + lost + sho
        d = pd.Timestamp(year=year, month=asof.month, day=asof.day)
        oar = open_ar_asof(df[~df.rk2.map(is_excluded)], d)["amt"].sum()
        print(f"\n  YTD {year} (Jan 1 -> {d.date()}):")
        print(f"    Deduction received (excl PMT, *XX*): {incl.amt.sum():,.2f}  rows={len(incl)}")
        print(f"    Recovered                                        : {rec:,.2f}")
        print(f"    P&L impact / Write-Off (total)                   : {wo:,.2f}")
        print(f"       of which COM Write-Off                        : {comwo:,.2f}")
        print(f"    Refuse to Pay (COM, not written off)             : {rtp:,.2f}")
        print(f"    Actual Shortage                                  : {sho:,.2f}")
        print(f"    Open (in period)                                 : {opn:,.2f}")
        print(f"    Recovery rate                                    : {(rec / denom * 100) if denom else 0:,.2f}%")
        print(f"    Open AR balance as of {d.date()}                 : {oar:,.2f}")

    print("\n  division split (current YTD, excl. excluded):")
    w = ytd(df, cy)
    w = w[w.outcome != "Excluded"]
    print(w.groupby("div")["amt"].sum().round(2).to_string())

print("\n" + "=" * 70)
print("R16 category totals (closed only, current YTD):")
w = ytd(r16, cy)
print(w.groupby("outcome")["amt"].agg(["count", "sum"]).round(2).to_string())

print("\nDistinct Reference Key 2 by reason code:")
print(data.groupby(["rc", "rk2"])["amt"].agg(["count", "sum"]).round(2).to_string())
