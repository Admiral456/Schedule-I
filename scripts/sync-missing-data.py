#!/usr/bin/env python3
from __future__ import annotations
import json, re, sys, hashlib
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs, unquote

import requests
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ASSETS = ROOT / "assets" / "game" / "effects"
ASSETS.mkdir(parents=True, exist_ok=True)
EFFECTS_FILE = DATA / "effects.json"
MANIFEST_FILE = DATA / "assets-manifest.json"
AUDIT_FILE = DATA / "effect-asset-audit.json"
COMMUNITY_FILE = DATA / "community-recipes.json"

UA = "Schedule-1-Helper-asset-sync/1.0 (+https://github.com/Admiral456/Schedule-I)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})

INGREDIENTS = [
    "Addy","Banana","Battery","Chili","Cuke","Donut","Energy Drink","Flu Medicine",
    "Gasoline","Horse Semen","Iodine","Mega Bean","Motor Oil","Mouth Wash","Paracetamol","Viagor"
]
BASE_PRODUCTS = ["OG Kush","Sour Diesel","Green Crack","Granddaddy Purple","Meth","Cocaine","Shrooms"]
EFFECTS = ["Shrinking","Zombifying","Cyclopean","Anti-Gravity","Long Faced","Electrifying","Glowing","Tropic Thunder","Thought-Provoking","Jennerising","Bright-Eyed","Spicy","Foggy","Slippery","Athletic","Balding","Calorie-Dense","Sedating","Sneaky","Energizing","Gingeritis","Euphoric","Focused","Refreshing","Munchies","Calming","Disorienting","Explosive","Laxative","Lethal","Paranoia","Schizophrenic","Seizure-Inducing","Smelly","Toxic"]

def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s

def clean(s: object) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()

def norm(s: object) -> str:
    return clean(s).casefold()

def get(url: str) -> requests.Response | None:
    try:
        r = SESSION.get(url, timeout=25)
        if r.ok:
            return r
    except requests.RequestException:
        pass
    return None

def unwrap_next_image(url: str) -> str:
    if "_next/image" not in url:
        return url
    try:
        q = parse_qs(urlparse(url).query)
        raw = q.get("url", [None])[0]
        if raw:
            return unquote(raw)
    except Exception:
        pass
    return url

def verify_image(content: bytes) -> tuple[str, tuple[int,int]] | None:
    try:
        with Image.open(BytesIO(content)) as im:
            fmt = (im.format or "").lower()
            w, h = im.size
            if w < 8 or h < 8 or fmt not in {"png","jpeg","webp","gif","bmp"}:
                return None
            ext = {"jpeg":"jpg"}.get(fmt, fmt)
            return ext, (w, h)
    except Exception:
        return None

def download_image(url: str) -> tuple[bytes, str, tuple[int,int]] | None:
    r = get(url)
    if not r:
        return None
    checked = verify_image(r.content)
    if not checked:
        return None
    ext, size = checked
    return r.content, ext, size

def effect_candidates(effect_name: str) -> list[tuple[str,int,str]]:
    slug = slugify(effect_name)
    page = f"https://schedule1-lab.com/wiki/effects/{slug}"
    out: list[tuple[str,int,str]] = []
    r = get(page)
    if r:
        soup = BeautifulSoup(r.text, "html.parser")
        target = norm(effect_name)
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or ""
            if not src:
                continue
            u = urljoin(page, unwrap_next_image(src))
            path = urlparse(u).path.lower()
            alt = clean(img.get("alt") or "").lower()
            title = clean(img.get("title") or "").lower()
            if any(x in path for x in ("/wordmark", "/logo", "/favicon", "/og-", "/site-icon")):
                continue
            score = 0
            if target in alt:
                score += 140
            if target in title:
                score += 60
            if slug in path:
                score += 80
            if "/effects/" in path:
                score += 30
            # A generic page image without an effect-specific alt/title/path is never accepted.
            if score < 140:
                continue
            out.append((u, score, "effect-specific-img"))

        for img in soup.find_all("img"):
            raw = img.get("srcset") or ""
            for part in raw.split(","):
                candidate = part.strip().split(" ")[0]
                if not candidate:
                    continue
                u = urljoin(page, unwrap_next_image(candidate))
                path = urlparse(u).path.lower()
                if any(x in path for x in ("/wordmark", "/logo", "/favicon", "/og-", "/site-icon")):
                    continue
                if slug in path and "/effects/" in path:
                    out.append((u, 90, "effect-specific-srcset"))

    # Direct paths are only considered when the URL itself names the exact effect.
    for ext in ("webp","png","jpg","jpeg"):
        for base, score in [
            (f"https://schedule1-lab.com/img/effects/{slug}.{ext}", 120),
            (f"https://cdn.schedule1.io/wiki/effects/{slug}.{ext}", 115),
            (f"https://schedule1.io/img/effects/{slug}.{ext}", 110),
        ]:
            out.append((base, score, "effect-specific-direct"))

    seen=set(); dedup=[]
    for item in sorted(out, key=lambda x:x[1], reverse=True):
        if item[0] not in seen:
            seen.add(item[0]); dedup.append(item)
    return dedup[:80]

def sync_effect_icons() -> dict:
    payload = json.loads(EFFECTS_FILE.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc).isoformat()
    verified = []
    missing = []
    hashes = {}

    # Remove any previously generated effect files first. They are rebuilt only after exact-source validation.
    if ASSETS.exists():
        for old in ASSETS.glob("*"):
            if old.is_file():
                old.unlink()

    for item in payload.get("effects", []):
        name = item["name"]
        page = item.get("icon", {}).get("source_page") or f"https://schedule1-lab.com/wiki/effects/{slugify(name)}"
        result = None
        for url, _score, source_kind in effect_candidates(name):
            result = download_image(url)
            if result:
                content, ext, size = result
                result = (url, source_kind, content, ext, size)
                break
        if not result:
            item["icon"] = {
                "status": "pending-exact-source",
                "source_page": page,
                "source_asset": None,
                "local_path": None,
                "downloaded_to_repo": False,
                "verification": "No effect-specific asset was positively identified; nothing generic was accepted.",
                "synced_at": now,
            }
            missing.append({"id": item["id"], "name": name, "source_page": page, "reason": "No effect-specific asset candidate passed validation"})
            continue

        url, source_kind, content, ext, size = result
        digest = hashlib.sha256(content).hexdigest()
        path = ASSETS / f"{slugify(name)}.{ext}"
        path.write_bytes(content)
        item["icon"] = {
            "status": "verified-exact-source",
            "source_page": page,
            "source_asset": url,
            "local_path": f"./assets/game/effects/{path.name}",
            "downloaded_to_repo": True,
            "verification": "Decoded successfully as an image with Pillow and matched an effect-specific source candidate.",
            "width": size[0],
            "height": size[1],
            "sha256": digest,
            "synced_at": now,
            "source_kind": source_kind,
        }
        verified.append({"id": item["id"], "name": name, "source_asset": url, "local_path": str(path.relative_to(ROOT)), "sha256": digest})
        hashes[item["id"]] = digest

    # Identical bytes across different effects are treated as a generic/shared placeholder and rejected.
    by_hash: dict[str,list[dict]] = {}
    for row in verified:
        by_hash.setdefault(row["sha256"], []).append(row)
    duplicate_groups=[group for group in by_hash.values() if len(group)>1]
    if duplicate_groups:
        duplicate_ids={row["id"] for group in duplicate_groups for row in group}
        for group in duplicate_groups:
            for row in group:
                p=ROOT / row["local_path"]
                if p.exists():
                    p.unlink()
                item=next(x for x in payload.get("effects",[]) if x["id"]==row["id"])
                page=item.get("icon",{}).get("source_page")
                item["icon"]={
                    "status":"pending-exact-source",
                    "source_page":page,
                    "source_asset":None,
                    "local_path":None,
                    "downloaded_to_repo":False,
                    "verification":"Rejected because the downloaded bytes were identical to another effect asset; no shared placeholder is accepted.",
                    "synced_at":now,
                }
                missing.append({"id":row["id"],"name":row["name"],"source_page":page,"reason":"Duplicate image bytes across effects"})
        verified=[row for row in verified if row["id"] not in duplicate_ids]
        hashes={row["id"]:row["sha256"] for row in verified}

    payload["verified_count"] = len(verified)
    payload["pending_count"] = len(missing)
    payload["updated_at"] = now
    EFFECTS_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    audit = {
        "schema_version": 2,
        "checked_at": now,
        "expected_count": len(payload.get("effects", [])),
        "verified_count": len(verified),
        "missing_count": len(missing),
        "verified": verified,
        "missing": missing,
        "sha256": hashes,
        "policy": "Exact effect-specific asset only. Generic page images, logos, wordmarks, shared placeholders and duplicate bytes are rejected."
    }
    AUDIT_FILE.write_text(json.dumps(audit, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    try:
        manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    except Exception:
        manifest = {}
    manifest.setdefault("effects", {})
    manifest["effects"].update({
        "expected_count": audit["expected_count"],
        "verified_count": audit["verified_count"],
        "pending_count": audit["missing_count"],
        "last_sync": now,
        "source": "https://schedule1-lab.com/wiki/effects",
        "policy": "exact-effect-specific-asset-only",
    })
    MANIFEST_FILE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    return audit

def json_candidates(obj, path=()):
    if isinstance(obj, dict):
        yield obj, path
        for k,v in obj.items():
            yield from json_candidates(v, path+(str(k),))
    elif isinstance(obj, list):
        for i,v in enumerate(obj):
            yield from json_candidates(v, path+(str(i),))

def parse_embedded_json(soup: BeautifulSoup):
    scripts = soup.find_all("script")
    blobs = []
    nd = soup.find("script", id="__NEXT_DATA__")
    if nd and nd.string:
        blobs.append(nd.string)
    for s in scripts:
        txt = s.string or s.get_text()
        if txt and ("ingredients" in txt or "recipes" in txt or "community" in txt):
            blobs.append(txt)
    for raw in blobs:
        raw = raw.strip()
        try:
            yield json.loads(raw)
            continue
        except Exception:
            pass
        m = re.search(r"<script[^>]*>(.*?)</script>", raw, re.S|re.I)
        if m:
            try:
                yield json.loads(m.group(1))
            except Exception:
                pass

def normalize_ingredient(name: str) -> str | None:
    low = clean(name).lower().replace("’","'")
    for x in INGREDIENTS:
        if low == x.lower():
            return x
    aliases = {"viagra":"Viagor","mouthwash":"Mouth Wash","horse semen":"Horse Semen","energy drink":"Energy Drink"}
    return aliases.get(low)

def normalize_product(name: str) -> str | None:
    low = clean(name).lower()
    for x in BASE_PRODUCTS:
        if low == x.lower():
            return x
    return None

def extract_recipe_objects(node):
    results=[]
    for obj, path in json_candidates(node):
        if not isinstance(obj, dict):
            continue
        vals = {str(k).lower():v for k,v in obj.items()}
        ing = vals.get("ingredients") or vals.get("mixers") or vals.get("components")
        name = vals.get("name") or vals.get("title") or vals.get("recipe")
        product = vals.get("product") or vals.get("baseproduct") or vals.get("base_product") or vals.get("drug")
        if not isinstance(ing, list) or not (name or product):
            continue
        ins=[]
        for x in ing:
            if isinstance(x, dict):
                x=x.get("name") or x.get("id") or x.get("item") or x.get("label")
            y=normalize_ingredient(str(x))
            if y: ins.append(y)
        if not ins:
            continue
        effects=[]
        raw_effects=vals.get("effects") or vals.get("effect")
        if isinstance(raw_effects,list):
            for x in raw_effects:
                y=next((e for e in EFFECTS if norm(e)==norm(x)),None) if isinstance(x,(str,int,float)) else None
                if y and y not in effects: effects.append(y)
        base = normalize_product(str(product)) if product else None
        results.append({
            "name": clean(name) if name else (base or "Community mix"),
            "base_product": base,
            "ingredients": ins,
            "effects": effects,
            "cost": float(vals["cost"]) if isinstance(vals.get("cost"),(int,float)) else None,
            "sell": float(vals["sell"]) if isinstance(vals.get("sell"),(int,float)) else None,
            "profit": float(vals["profit"]) if isinstance(vals.get("profit"),(int,float)) else None,
            "customers": int(vals["customers"]) if isinstance(vals.get("customers"),(int,float)) else None,
            "asking": float(vals["asking"]) if isinstance(vals.get("asking"),(int,float)) else None,
            "source_url": "https://schedule1-lab.com/community/recipes",
            "source_type": "community",
        })
    return results

def ordered_ingredients_from_node(node):
    found=[]
    for img in node.find_all("img"):
        labels=[img.get("alt") or "", img.get("title") or ""]
        text_blob=clean(" ".join(labels))
        for ingredient in INGREDIENTS:
            if re.search(r"(?<!\\w)"+re.escape(ingredient)+r"(?!\\w)", text_blob, re.I):
                found.append(ingredient)
                break
    # Preserve legitimate repeats, but only up to the card's declared ingredient count.
    card_text=clean(node.get_text(" ", strip=True))
    m=re.search(r"Ingredients\\s*\\(\\s*(\\d+)\\s*\\)", card_text, re.I)
    declared=int(m.group(1)) if m else None
    return found[:declared] if declared else found

def ordered_effects_from_text(text):
    hits=[]
    for effect in EFFECTS:
        for m in re.finditer(r"(?<!\\w)"+re.escape(effect)+r"(?!\\w)", text, re.I):
            hits.append((m.start(), effect))
    hits.sort(key=lambda x:x[0])
    out=[]
    for _,effect in hits:
        if effect not in out:
            out.append(effect)
    m=re.search(r"Effects\\s*\\(\\s*(\\d+)\\s*\\)", text, re.I)
    return out[:int(m.group(1))] if m else out

def recipe_card_from_open_link(link):
    current=link
    best=None
    while current is not None and getattr(current, "name", None) not in ("body","html"):
        text_blob=clean(current.get_text(" ", strip=True))
        if len(text_blob)<=4500 and re.search(r"Ingredients\\s*\\(\\s*\\d+\\s*\\)",text_blob,re.I) and re.search(r"Effects\\s*\\(\\s*\\d+\\s*\\)",text_blob,re.I):
            heads=current.find_all(["h1","h2","h3","h4"])
            if heads:
                best=current
                break
        current=current.parent
    return best

def extract_card_number(text_blob, label):
    m=re.search(r"(?<![A-Za-z])"+re.escape(label)+r"\\s*\\$?\\s*([0-9]+(?:\\.[0-9]+)?)", text_blob, re.I)
    if not m:
        m=re.search(r"(?<![A-Za-z])"+re.escape(label)+r"\\s*([0-9]+(?:\\.[0-9]+)?)", text_blob, re.I)
    if not m:
        return None
    value=float(m.group(1))
    return int(value) if value.is_integer() else value

def dom_recipes(soup: BeautifulSoup):
    candidates=[]
    links=[a for a in soup.find_all("a") if clean(a.get_text(" ", strip=True)).casefold()=="open in mixing"]
    seen_cards=set()
    for link in links:
        card=recipe_card_from_open_link(link)
        if card is None:
            continue
        key=id(card)
        if key in seen_cards:
            continue
        seen_cards.add(key)
        text_blob=clean(card.get_text(" ", strip=True))
        heads=[clean(h.get_text(" ", strip=True)) for h in card.find_all(["h1","h2","h3","h4"])]
        title=heads[0] if heads else ""
        if not title:
            continue
        base=next((p for p in BASE_PRODUCTS if re.search(r"(?<!\\w)"+re.escape(p)+r"(?!\\w)", text_blob, re.I)),None)
        if not base:
            continue
        ins=ordered_ingredients_from_node(card)
        if not ins:
            continue
        effects=ordered_effects_from_text(text_blob)
        href=link.get("href") or "https://schedule1-lab.com/community/recipes"
        href=urljoin("https://schedule1-lab.com/community/recipes",href)
        customers=extract_card_number(text_blob,"Customers")
        candidate={
            "name":title,
            "base_product":base,
            "ingredients":ins,
            "effects":effects,
            "cost":extract_card_number(text_blob,"Cost"),
            "sell":extract_card_number(text_blob,"Sells for"),
            "profit":extract_card_number(text_blob,"Profit"),
            "customers":int(customers) if customers is not None else None,
            "asking":extract_card_number(text_blob,"Asking"),
            "source_url":href,
            "source_type":"community",
        }
        candidates.append(candidate)
    return candidates

def sync_community_recipes() -> dict:
    url="https://schedule1-lab.com/community/recipes"
    r=get(url)
    if not r:
        raise RuntimeError("Community Recipes page could not be fetched")

    soup=BeautifulSoup(r.text,"html.parser")
    embedded=[]
    for blob in parse_embedded_json(soup):
        embedded.extend(extract_recipe_objects(blob))

    embedded_unique=[]
    seen=set()
    for x in embedded:
        key=(clean(x["name"]).lower(), tuple(x["ingredients"]), clean(x.get("base_product") or "").lower())
        if key in seen:
            continue
        seen.add(key)
        embedded_unique.append(x)

    dom=dom_recipes(soup)
    print(f"community recipe extraction: embedded={len(embedded_unique)} dom={len(dom)}")

    # The public page itself reports 77/77. Accept exactly 77 unique recipe cards;
    # otherwise fail rather than silently importing an incorrect catalog.
    if len(embedded_unique)==77:
        source=embedded_unique
        extraction_source="embedded"
    elif len(dom)==77:
        source=dom
        extraction_source="dom"
    else:
        raise RuntimeError(f"Expected exactly 77 community recipes, got embedded={len(embedded_unique)} dom={len(dom)}")

    uniq=[]
    seen=set()
    for x in source:
        key=(clean(x["name"]).lower(), tuple(x["ingredients"]), clean(x.get("base_product") or "").lower())
        if key in seen:
            continue
        seen.add(key)
        uniq.append(x)

    if len(uniq)!=77:
        raise RuntimeError(f"Expected exactly 77 unique community recipes after deduplication, got {len(uniq)}")

    for i,x in enumerate(uniq,1):
        slug=slugify(x["name"])
        x["id"]=f"community-{i:03d}-{slug[:50]}"
        x["ingredients"]=list(x["ingredients"])
        for k in ("cost","sell","profit","asking"):
            if x.get(k) is not None:
                x[k]=int(x[k]) if float(x[k]).is_integer() else x[k]
        if x.get("customers") is not None:
            x["customers"]=int(x["customers"])

    now=datetime.now(timezone.utc).isoformat()
    out={
        "schema_version":3,
        "source":url,
        "expected_count":77,
        "verified_count":77,
        "status":"complete",
        "extraction_source":extraction_source,
        "snapshot_at":now,
        "recipes":uniq,
        "note":"Exactly 77 recipes were imported from the public Community Recipes catalog. Effects/economics are captured when present in the published recipe data."
    }
    COMMUNITY_FILE.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    return {"expected_count":77,"verified_count":77,"status":"complete","extraction_source":extraction_source}

def main():
    effect_audit=sync_effect_icons()
    recipe_audit=sync_community_recipes()
    report={"effects":effect_audit,"community_recipes":recipe_audit}
    print(json.dumps(report,ensure_ascii=False,indent=2))
    # Never fabricate missing content. A partial sync remains useful and is committed with explicit status.
    return 0

if __name__=="__main__":
    sys.exit(main())
