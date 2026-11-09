#!/usr/bin/env python3
"""Reler a planilha Omnia e regravar o painel, como atualizar uma tabela dinâmica.

Uso:
  python3 dashboard/atualizar.py caminho/da/planilha.xlsx
  python3 dashboard/atualizar.py --baixar /tmp/omnia.xlsx

A planilha não entra no site. Só saem os carros (data, origem, transportadora,
ordem de frete, material e se já tem baixa DRM).
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
DATA_JS = ROOT / "data.js"
INDEX_HTML = ROOT / "index.html"

# A ordem destes quatro nomes fica fixa para o painel não trocar as cores.
BASE_CARRIERS = ["DANIEL TRANSPORTES", "FRACHT LOG", "IRAPURU", "TERMACO"]
SHARE_URL = (
    "https://vertivco.sharepoint.com/:x:/r/teams/ops/AMER/BO/_layouts/15/Doc.aspx"
    "?sourcedoc=%7B5B78CAF7-AC4D-45E9-8C2C-AED0178DB1DB%7D"
    "&file=Controle%20Geral%20de%20Sa%C3%ADda%20de%20Material%20Omnia.xlsx"
    "&action=default"
)
CONTAINER = re.compile(r"[A-Z]{4}\d{6,7}")
SEP = " · "


def clean(value) -> str:
    if value is None:
        return ""
    return " ".join(str(value).replace("\n", " ").split())


def norm_carrier(value) -> str | None:
    text = clean(value).upper()
    if not text:
        return None
    if "IRAPURU" in text:
        return "IRAPURU"
    if text.startswith("DANIEL"):
        return "DANIEL TRANSPORTES"
    if "FRACHT" in text:
        return "FRACHT LOG"
    if "TERMACO" in text:
        return "TERMACO"
    return text


def as_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        return None
    text = value.strip()
    match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", text)
    if match:
        day, month, year = (int(match.group(i)) for i in (1, 2, 3))
        return date(year, month, day)
    match = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
    if match:
        year, month, day = (int(match.group(i)) for i in (1, 2, 3))
        return date(year, month, day)
    return None


def of_number(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value == int(value):
        return str(int(value))
    if isinstance(value, int):
        return str(value)
    text = clean(value)
    return text or None


def row_text(row) -> str:
    return " ".join(clean(cell) for cell in row if cell is not None).lower()


def cancelled(text: str) -> bool:
    return "cancelar pick" in text or "estornar pick" in text


def recusado(value) -> bool:
    return isinstance(value, str) and value.strip().lower() == "recusado"


def remember(group, material: str, carrier: str | None, delivered: bool) -> None:
    if material and material not in group["mats"]:
        group["mats"].append(material)
    if carrier and not group["carrier"]:
        group["carrier"] = carrier
    if delivered:
        group["delivered"] = 1


def read_nacional(ws):
    groups = OrderedDict()
    for row in ws.iter_rows(min_row=7, values_only=True):
        if not row:
            continue
        if cancelled(row_text(row)):
            continue
        drm = row[11] if len(row) > 11 else None
        if recusado(drm):
            continue
        ofn = of_number(row[4] if len(row) > 4 else None)
        when = as_date(row[9] if len(row) > 9 else None)
        if not ofn or not when:
            continue
        group = groups.setdefault(when.isoformat() + "|" + ofn, {
            "date": when, "of": ofn, "mats": [], "carrier": None, "delivered": 0,
        })
        remember(group, clean(row[1] if len(row) > 1 else ""), norm_carrier(row[3] if len(row) > 3 else None), as_date(drm) is not None)
    trucks = []
    for group in groups.values():
        trucks.append({
            "date": group["date"],
            "origin": "N",
            "carrier": group["carrier"],
            "ref": "OF " + group["of"],
            "delivered": group["delivered"],
            "material": SEP.join(group["mats"]),
        })
    return trucks


def container_codes(value) -> list[str]:
    if value is None:
        return []
    codes = []
    for part in re.split(r"\s+-\s+", str(value)):
        lowered = part.lower()
        if "aéreo" in lowered or "aereo" in lowered:
            continue
        codes.extend(CONTAINER.findall(part.upper()))
    seen = []
    for code in codes:
        if code not in seen:
            seen.append(code)
    return seen


def read_importado(ws):
    groups = OrderedDict()
    for row in ws.iter_rows(min_row=7, values_only=True):
        if not row:
            continue
        when = as_date(row[11] if len(row) > 11 else None)
        ofn = of_number(row[2] if len(row) > 2 else None)
        if not when or not ofn:
            continue
        codes = container_codes(row[5] if len(row) > 5 else None)
        if not codes:
            continue
        material = clean(row[1] if len(row) > 1 else "")
        carrier = norm_carrier(row[4] if len(row) > 4 else None)
        delivered = as_date(row[12] if len(row) > 12 else None) is not None
        for code in codes:
            group = groups.setdefault(when.isoformat() + "|" + code, {
                "date": when, "code": code, "ofs": [], "mats": [], "carrier": None, "delivered": 0,
            })
            if ofn not in group["ofs"]:
                group["ofs"].append(ofn)
            remember(group, material, carrier, delivered)
    trucks = []
    for group in groups.values():
        ofs = sorted(group["ofs"], key=lambda item: (not item.isdigit(), int(item) if item.isdigit() else item))
        trucks.append({
            "date": group["date"],
            "origin": "I",
            "carrier": group["carrier"],
            "ref": group["code"] + " (OF " + "/".join(ofs) + ")",
            "delivered": group["delivered"],
            "material": SEP.join(group["mats"]),
        })
    return trucks


def carrier_list(trucks) -> list[str]:
    extra = sorted({t["carrier"] for t in trucks if t["carrier"] and t["carrier"] not in BASE_CARRIERS})
    return BASE_CARRIERS + extra


def stamp(when: date) -> str:
    if when.year == 2026:
        return f"{when.month:02d}-{when.day:02d}"
    return when.isoformat()


def to_rows(trucks) -> list[list]:
    names = carrier_list(trucks)
    index = {name: i for i, name in enumerate(names)}
    rows = []
    for truck in trucks:
        carrier = -1 if not truck["carrier"] else index[truck["carrier"]]
        rows.append([
            stamp(truck["date"]),
            truck["origin"],
            carrier,
            truck["ref"],
            truck["delivered"],
            truck["material"],
        ])
    rows.sort(key=lambda row: (row[0] if len(row[0]) > 5 else "2026-" + row[0], 0 if row[1] == "I" else 1, row[2], row[3]))
    return rows


def js_string(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_data(rows, names, updated: date) -> None:
    lines = [
        "// Gerado por dashboard/atualizar.py. Não edite este arquivo à mão.",
        "window.OMNIA_UPDATED = " + js_string(updated.strftime("%d/%m/%Y")) + ";",
        "window.OMNIA_CARRIERS = " + js_string(names) + ";",
        "window.OMNIA_TRUCKS = [",
    ]
    for row in rows:
        lines.append("  " + js_string(row) + ",")
    if rows:
        lines[-1] = lines[-1].rstrip(",")
    lines.append("];")
    lines.append("")
    DATA_JS.write_text("\n".join(lines), encoding="utf-8")


def touch_index(updated: date, rows, names) -> None:
    html = INDEX_HTML.read_text(encoding="utf-8")
    label = updated.strftime("%d/%m/%Y")
    digest = hashlib.sha1(json.dumps([names, rows], ensure_ascii=False).encode("utf-8")).hexdigest()[:6]
    version = updated.strftime("%Y%m%d") + "-" + digest
    html = re.sub(r"Dados atualizados em \d{2}/\d{2}/\d{4}", "Dados atualizados em " + label, html)
    html = re.sub(r"\?v=[^\"']+", "?v=" + version, html)
    dates = []
    for row in rows:
        token = row[0]
        dates.append(token if len(token) > 5 else "2026-" + token)
    if dates:
        first = min(dates)
        last = max(dates)
        html = re.sub(r'(id="ini"[^>]*min=")[^"]+"', r'\1' + first[:8] + '01"', html, count=1)
        html = re.sub(r'(id="fim"[^>]*min=")[^"]+"', r'\1' + first[:8] + '01"', html, count=1)
        year = int(last[:4]) + 1
        html = re.sub(r'(id="ini"[^>]*max=")[^"]+"', rf'\1{year}-12-31"', html, count=1)
        html = re.sub(r'(id="fim"[^>]*max=")[^"]+"', rf'\1{year}-12-31"', html, count=1)
    INDEX_HTML.write_text(html, encoding="utf-8")


def load_rows(path: Path):
    from openpyxl import load_workbook

    book = load_workbook(path, data_only=True, read_only=True)
    try:
        missing = [name for name in ("Nacional", "Importado") if name not in book.sheetnames]
        if missing:
            raise SystemExit("A planilha não tem a aba: " + ", ".join(missing))
        trucks = read_importado(book["Importado"]) + read_nacional(book["Nacional"])
    finally:
        book.close()
    return to_rows(trucks), carrier_list(trucks)


def share_id(url: str) -> str:
    encoded = base64.urlsafe_b64encode(url.encode("utf-8")).decode("ascii").rstrip("=")
    return "u!" + encoded


def graph_request(url: str, token: str) -> bytes:
    request = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def refresh_access_token() -> str:
    refresh = os.environ.get("MS_REFRESH_TOKEN", "").strip()
    if not refresh:
        raise SystemExit("MS_REFRESH_TOKEN ausente")
    client = os.environ.get("MS_CLIENT_ID", "14d82eec-204b-4c2f-b7e8-296a70dab67e").strip()
    tenant = os.environ.get("MS_TENANT_ID", "organizations").strip()
    body = urllib.parse.urlencode({
        "client_id": client,
        "grant_type": "refresh_token",
        "refresh_token": refresh,
        "scope": "https://graph.microsoft.com/Files.Read offline_access",
    }).encode("utf-8")
    request = urllib.request.Request(
        f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:500]
        raise SystemExit("Não foi possível renovar o acesso ao SharePoint. " + detail) from error
    new_refresh = payload.get("refresh_token")
    if new_refresh and new_refresh != refresh:
        print("MS_REFRESH_TOKEN_NOVO", file=sys.stderr)
    token = payload.get("access_token")
    if not token:
        raise SystemExit("O SharePoint não devolveu acesso.")
    return token


def download_workbook(destination: Path) -> None:
    token = refresh_access_token()
    url = "https://graph.microsoft.com/v1.0/shares/" + share_id(SHARE_URL) + "/driveItem/content"
    try:
        content = graph_request(url, token)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:500]
        raise SystemExit("O SharePoint recusou a planilha. " + detail) from error
    destination.write_bytes(content)
    print(f"Planilha baixada: {destination} ({len(content)} bytes)")


def today_sp() -> date:
    return datetime.now(ZoneInfo("America/Sao_Paulo")).date()


def current_rows():
    if not DATA_JS.is_file():
        return None
    text = DATA_JS.read_text(encoding="utf-8")
    marker = "window.OMNIA_TRUCKS = "
    if marker not in text:
        return None
    start = text.index("[", text.index(marker))
    end = text.rindex("]")
    body = re.sub(r",(\s*)]", r"\1]", text[start:end + 1])
    return json.loads(body)


def summarize(rows, names) -> None:
    blank = sum(1 for row in rows if row[2] < 0)
    nacional = sum(1 for row in rows if row[1] == "N")
    print(f"{len(rows)} carros ({nacional} nacional, {len(rows) - nacional} importado), {blank} sem transportadora")
    counts = {}
    for row in rows:
        name = "Sem transportadora" if row[2] < 0 else names[row[2]]
        counts[name] = counts.get(name, 0) + 1
    for name, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
        print(f"  {name}: {count}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Atualiza o painel Omnia a partir da planilha")
    parser.add_argument("planilha", nargs="?", help="Arquivo .xlsx das abas Nacional e Importado")
    parser.add_argument("--baixar", metavar="DESTINO", help="Baixa a planilha do SharePoint para este caminho")
    args = parser.parse_args()
    if args.baixar:
        download_workbook(Path(args.baixar))
        if not args.planilha:
            return
    if not args.planilha:
        parser.error("informe o caminho da planilha")
    source = Path(args.planilha)
    if not source.is_file():
        raise SystemExit("Arquivo não encontrado: " + str(source))
    rows, names = load_rows(source)
    if current_rows() == rows:
        print("Sem mudança na programação.")
        summarize(rows, names)
        return
    today = today_sp()
    write_data(rows, names, today)
    touch_index(today, rows, names)
    print("Programação atualizada.")
    summarize(rows, names)


if __name__ == "__main__":
    main()
