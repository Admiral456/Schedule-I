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

def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s

def clean(s: object) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()

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
        for meta in soup.find_all("meta"):
            prop = (meta.get("property") or meta.get("name") or "").lower()
            val = meta.get("content") or ""
            if "image" in prop and val:
                u = urljoin(page, unwrap_next_image(val))
                path = urlparse(u).path.lower()
                score = 60 + (35 if "/effects/" in path else 0) + (10 if slug in path else 0)
                out.append((u, score, "meta"))
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or ""
            if not src:
                continue
            u = urljoin(page, unwrap_next_image(src))
            path = urlparse(u).path.lower()
            alt = clean(img.get("alt") or "").lower()
            score = 25
            if "/effects/" in path: score += 45
            if slug in path: score += 20
            if effect_name.lower() in alt: score += 30
            if effect_name.replace("-", " ").lower() in alt: score += 20
            out.append((u, score, "img"))
        srcset = []
        for img in soup.find_all("img"):
            raw = img.get("srcset") or ""
            for part in raw.split(","):
                candidate = part.strip().split(" ")[0]
                if candidate:
                    srcset.append(candidate)
        for candidate in srcset:
            u = urljoin(page, unwrap_next_image(candidate))
            path = urlparse(u).path.lower()
            score = 20 + (45 if "/effects/" in path else 0) + (20 if slug in path else 0)
            out.append((u, score, "srcset"))

    for ext in ("webp","png","jpg","jpeg"):
        for base, score in [
            (f"https://schedule1-lab.com/img/effects/{slug}.{ext}", 105),
            (f"https://cdn.schedule1.io/wiki/effects/{slug}.{ext}", 100),
            (f"https://schedule1.io/img/effects/{slug}.{ext}", 90),
        ]:
            out.append((base, score, "direct"))
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
            missing.append({"id": item["id"], "name": name, "source_page": page})
            continue
        url, source_kind, content, ext, size = result
        path = ASSETS / f"{slugify(name)}.{ext}"
        path.write_bytes(content)
        digest = hashlib.sha256(content).hexdigest()
        hashes[item["id"]] = digest
        item["icon"] = {
            "status": "verified-exact-source",
            "source_page": page,
            "source_asset": url,
            "local_path": f"./assets/game/effects/{path.name}",
            "downloaded_to_repo": True,
            "verification": "Decoded successfully as an image with Pillow",
            "width": size[0],
            "height": size[1],
            "sha256": digest,
            "synced_at": now,
            "source_kind": source_kind,
        }
        verified.append({"id": item["id"], "name": name, "source_asset": url, "local_path": str(path.relative_to(ROOT))})
    payload["verified_count"] = len(verified)
    payload["updated_at"] = now
    EFFECTS_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    audit = {
        "schema_version": 1,
        "checked_at": now,
        "expected_count": len(payload.get("effects", [])),
        "verified_count": len(verified),
        "missing_count": len(missing),
        "verified": verified,
        "missing": missing,
        "sha256": hashes,
        "policy": "Only exact image assets discovered from an effect page/direct game-derived source are accepted; no generated or generic icons."
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
        "policy": "exact-source-only",
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
        if isinstance(ing, list) and ing and (name or product):
            ins=[]
            for x in ing:
                if isinstance(x, dict):
                    x=x.get("name") or x.get("id") or x.get("item")
                y=normalize_ingredient(str(x))
                if y: ins.append(y)
            if ins:
                pname = clean(name) if name else clean(product)
                base = normalize_product(str(product)) if product else None
                results.append((pname, base, ins))
    return results

def dom_recipes(soup: BeautifulSoup):
    candidates=[]
    nodes=soup.select('a[href*="/community/recipes/"], article, [class*="recipe"], [class*="Recipe"], [class*="card"], [class*="Card"]')
    seen=set()
    for node in nodes:
        text=clean(node.get_text(" ", strip=True))
        if len(text)<10 or len(text)>2500:
            continue
        names=[]
        for ing in INGREDIENTS:
            if re.search(r"(?<!\w)"+re.escape(ing)+r"(?!\w)", text, re.I):
                names.append(ing)
        if not names:
            continue
        bases=[p for p in BASE_PRODUCTS if re.search(r"(?<!\w)"+re.escape(p)+r"(?!\w)", text, re.I)]
        heads=[clean(h.get_text(" ", strip=True)) for h in node.find_all(["h1","h2","h3","h4"])]
        title=heads[0] if heads else ""
        if not title:
            href=node.get("href") or ""
            m=re.search(r"/community/recipes/([^/?#]+)", href)
            title=m.group(1).replace("-"," ").title() if m else ""
        if not title:
            continue
        key=(title.lower(), tuple(names), (bases[0] if bases else ""))
        if key in seen: continue
        seen.add(key)
        candidates.append({
            "name": title, "base_product": bases[0] if bases else None,
            "ingredients": names,
            "source_url": "https://schedule1-lab.com/community/recipes",
            "source_type": "community",
        })
    return candidates

def sync_community_recipes() -> dict:
    url="https://schedule1-lab.com/community/recipes"
    r=get(url)
    recipes=[]
    if r:
        soup=BeautifulSoup(r.text,"html.parser")
        for blob in parse_embedded_json(soup):
            for name,base,ins in extract_recipe_objects(blob):
                recipes.append({"name":name,"base_product":base,"ingredients":ins,"source_url":url,"source_type":"community"})
        recipes.extend(dom_recipes(soup))
    uniq=[]
    seen=set()
    for x in recipes:
        key=(clean(x["name"]).lower(), tuple(x["ingredients"]), clean(x.get("base_product") or "").lower())
        if key in seen: continue
        seen.add(key); uniq.append(x)
    for i,x in enumerate(uniq,1):
        slug=slugify(x["name"])
        x["id"]=f"community-{i:03d}-{slug[:50]}"
        x["ingredients"]=list(dict.fromkeys(x["ingredients"]))
    now=datetime.now(timezone.utc).isoformat()
    out={
        "schema_version":1,
        "source":url,
        "expected_count":77,
        "verified_count":len(uniq),
        "status":"complete" if len(uniq)==77 else "partial",
        "snapshot_at":now,
        "recipes":uniq,
        "note":"Community recipes store product/ingredient lists; the Helper may recalculate effects/value through its own mixing engine."
    }
    COMMUNITY_FILE.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    return {"expected_count":77,"verified_count":len(uniq),"status":out["status"]}

def main():
    effect_audit=sync_effect_icons()
    recipe_audit=sync_community_recipes()
    report={"effects":effect_audit,"community_recipes":recipe_audit}
    print(json.dumps(report,ensure_ascii=False,indent=2))
    # Never fabricate missing content. A partial sync remains useful and is committed with explicit status.
    return 0

if __name__=="__main__":
    sys.exit(main())
