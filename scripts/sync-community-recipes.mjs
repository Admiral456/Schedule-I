import fs from "node:fs/promises";
import { chromium } from "playwright";

const SOURCE = "https://schedule1-lab.com/community/recipes";
const EXPECTED = 77;

const effects = JSON.parse(await fs.readFile(new URL("../data/effects.json", import.meta.url), "utf8")).effects.map(x => x.name);
const ingredients = JSON.parse(await fs.readFile(new URL("../data/ingredients.json", import.meta.url), "utf8")).items.map(x => x.name);
const bases = ["OG Kush","Sour Diesel","Green Crack","Granddaddy Purple","Meth","Cocaine","Shrooms"];

const canon = v => String(v || "").replace(/\s+/g, " ").trim();
const escRe = s => canon(s).replace(/[.*+?^()|[\]{}\\]/g, "\\$&");

function occurrences(text, names) {
  const hits = [];
  for (const name of names) {
    const re = new RegExp("(?<![A-Za-z0-9])" + escRe(name) + "(?![A-Za-z0-9])", "gi");
    for (const m of text.matchAll(re)) hits.push({ index:m.index ?? 0, name });
  }
  return hits.sort((a,b) => a.index-b.index).map(x => x.name);
}

function slug(s) {
  return canon(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0,90);
}

function parseCard(card) {
  const text = canon(card.text);
  if (!/profit/i.test(text) || !/cost/i.test(text)) return null;

  const lines = String(card.text || "").split(/\n+/).map(canon).filter(Boolean);
  const headings = (card.headings || []).map(canon).filter(Boolean);
  const name = [...headings, ...lines].find(x =>
    x.length >= 3 &&
    !/^(community recipes|profit|cost|ingredients|effects)$/i.test(x) &&
    !bases.includes(x) &&
    !effects.includes(x) &&
    !ingredients.includes(x)
  );

  const base = bases.find(x => new RegExp("(?<![A-Za-z0-9])" + escRe(x) + "(?![A-Za-z0-9])","i").test(text)) || null;
  const drug = base === "Meth" || base === "Cocaine" || base === "Shrooms" ? base : base ? "Weed" : null;

  const profitMatch = text.match(/profit\s*[:\-]?\s*\$?\s*(-?\d+(?:\.\d+)?)/i);
  const costMatch = text.match(/cost\s*[:\-]?\s*\$?\s*(\d+(?:\.\d+)?)/i);
  const customersMatch = text.match(/(?:for|with|to)\s+(\d+)\s+customers?/i);

  const profit = profitMatch ? Number(profitMatch[1]) : NaN;
  const cost = costMatch ? Number(costMatch[1]) : NaN;
  const customers = customersMatch ? Number(customersMatch[1]) : null;

  const ing = occurrences(text, ingredients);
  const fx = occurrences(text, effects);

  const authorLine = lines.find(x => /^by\s+/i.test(x) || /^author\s*:/i.test(x));
  const author = authorLine ? canon(authorLine.replace(/^author\s*:\s*/i, "").replace(/^by\s+/i, "")) : null;

  const sourceHref = (card.links || []).map(x => x.href).find(Boolean) || SOURCE;

  if (!name || !base || !drug || !Number.isFinite(profit) || !Number.isFinite(cost) || !ing.length || !fx.length) return null;

  return {
    id:"community:" + slug(name) + "::" + slug(base) + "::" + slug(ing.join("-")),
    name,
    author,
    drug,
    base_product:base,
    ingredients:ing,
    effects:fx,
    cost,
    profit,
    customers,
    source:SOURCE,
    source_url:sourceHref,
    source_type:"community"
  };
}

const browser = await chromium.launch({headless:true});

try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(SOURCE,{waitUntil:"networkidle",timeout:120000});

  for (let i=0; i<24; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(450);
  }

  const cards = await page.evaluate(() => {
    const selectors = ["article","[class*='recipe-card']","[data-testid*='recipe']","[data-recipe]"];
    let all = [...new Set(selectors.flatMap(s => [...document.querySelectorAll(s)]))];

    let candidates = all.map(el => ({el,text:(el.innerText || "").trim()}))
      .filter(x => /profit/i.test(x.text) && /cost/i.test(x.text) && x.text.length > 50 && x.text.length < 3000);

    if (candidates.length < 77) {
      candidates = [...document.querySelectorAll("body *")].map(el => ({el,text:(el.innerText || "").trim()}))
        .filter(x => /profit/i.test(x.text) && /cost/i.test(x.text) && x.text.length > 80 && x.text.length < 3000);
    }

    const set = new Set(candidates.map(x => x.el));
    return candidates.filter(x => ![...x.el.querySelectorAll(":scope *")].some(ch => set.has(ch.el || ch)))
      .map(x => ({
        text:x.el.innerText || "",
        headings:[...x.el.querySelectorAll("h1,h2,h3,h4,h5,[class*='title'],[class*='name']")].map(n => n.innerText || ""),
        links:[...x.el.querySelectorAll("a[href]")].map(a => ({href:a.href,text:a.innerText || ""}))
      }));
  });

  const parsed = cards.map(parseCard).filter(Boolean);
  const unique = new Map(parsed.map(r => [r.id,r]));
  const recipes = [...unique.values()];

  const invalid = recipes.filter(r =>
    r.ingredients.some(x => !ingredients.includes(x)) ||
    r.effects.some(x => !effects.includes(x)) ||
    !bases.includes(r.base_product)
  );

  console.log("Catalog parser found", recipes.length, "valid candidates.");
  recipes.forEach((r, i) => console.log(String(i + 1).padStart(2, "0") + " | " + r.name + " | " + r.drug + " | " + r.ingredients.join(" -> ")));
  if (recipes.length !== EXPECTED || invalid.length) {
    console.error("Sync refused: expected " + EXPECTED + " valid recipes, got " + recipes.length + ", invalid " + invalid.length);
    process.exitCode = 2;
  } else {
    const out = {
      schema_version:1,
      source:SOURCE,
      expected_count:EXPECTED,
      checked_on:new Date().toISOString().slice(0,10),
      status:"verified-live-catalog",
      record_count:recipes.length,
      verification_policy:"Live public catalog only; no synthetic records.",
      recipes
    };
    await fs.writeFile(new URL("../data/community-recipes.json", import.meta.url), JSON.stringify(out,null,2) + "\n");
    console.log("Synced", recipes.length, "community recipes");
  }
} finally {
  await browser.close();
}
