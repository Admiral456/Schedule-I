import { chromium } from "playwright";

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors = [];
const localFailures = [];
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("response", r => {
  if (r.status() >= 400 && new URL(r.url()).origin === "http://127.0.0.1:4173") {
    localFailures.push(r.status() + " " + r.url());
  }
});

await page.goto("http://127.0.0.1:4173/", {waitUntil:"networkidle"});
if ((await page.title()) !== "Schedule 1 Helper") throw new Error("Bad title");
if ((await page.locator("#view-home").innerText()).trim().length < 20) throw new Error("Home is blank");

await page.locator('[data-tab="account"]').first().click();
if (!(await page.locator("#view-account").evaluate(el => el.classList.contains("active")))) throw new Error("Settings navigation failed");

await page.locator('[data-tab="products"]').click();
await page.waitForFunction(() => document.querySelectorAll("#productList .s1-product-card").length === 49);
if (await page.locator("#productList .s1-product-card").count() !== 49) throw new Error("Expected 49 products");

await page.locator('[data-tab="recipes"]').first().click();
await page.waitForFunction(() => document.querySelectorAll("#recipeList .recipe-card").length >= 52);
if (await page.locator("#recipeList .recipe-card").count() < 52) throw new Error("Recipe Finder did not include products");
await page.waitForSelector("#s1MixTools");
await page.locator("#s1MixBase").selectOption({value:"Meth"});
const mixSelects = page.locator("#s1MixSlots select");
const mixOrder = ["Banana","Cuke","Horse Semen","Mega Bean"];
await page.waitForFunction(() => document.querySelectorAll("#s1MixSlots option[value]").length >= 16);
for (let i = 0; i < mixOrder.length; i++) await mixSelects.nth(i).selectOption({value: mixOrder[i]});
await page.waitForFunction(() => /\$206/.test(document.querySelector("#s1MixCalcResult")?.innerText||"") && /\$20/.test(document.querySelector("#s1MixCalcResult")?.innerText||"") && /\$186/.test(document.querySelector("#s1MixCalcResult")?.innerText||""));
const mixText = await page.locator("#s1MixCalcResult").innerText();
for (const effect of ["Electrifying","Cyclopean","Long Faced","Foggy"]) if (!mixText.includes(effect)) throw new Error("Mix engine missing expected effect: " + effect);
const seededMode = page.locator("#s1SeededMode");
await seededMode.selectOption("seeded");
if (!(await page.locator("#s1RunReverse").isDisabled())) throw new Error("Reverse Finder should be disabled in Seeded mode");
await seededMode.selectOption("standard");
if (await page.locator("#s1RunReverse").isDisabled()) throw new Error("Reverse Finder did not return in Standard mode");

await page.locator("#recipeSearch").fill("fiona");
if (await page.locator("#recipeList .recipe-card").count() === 0) {
  // expected no direct recipe match; clear before continuing
}
await page.locator('[data-tab="map"]').first().click();
await page.waitForSelector("#mapDataSearch");
await page.locator("#mapDataSearch").fill("Fiona Hancock");
await page.waitForSelector('#mapDataResults [data-e="customer"]');
await page.locator("#mapDataSearch").press("Enter");
await page.waitForFunction(() => !!document.querySelector("#mapDataResults .map-entity.selected"));
if (await page.locator("#mapDataResults .map-entity.selected").count() !== 1) throw new Error("Map search did not highlight result");

const shared = page.locator('[data-tab="shared"]').first();
await shared.click();
if (!(await page.locator("#view-shared").evaluate(el => el.classList.contains("active")))) throw new Error("Shared navigation failed");

await page.locator('[data-tab-jump="home"]').first().click();
await page.waitForFunction(() => document.querySelector("#view-home")?.classList.contains("active"));
await page.locator("#homeSearch").fill("Fiona Hancock");
await page.locator("#homeSearch").press("Enter");
if (!(await page.locator("#view-customers").evaluate(el => el.classList.contains("active")))) throw new Error("Global customer search failed");

await page.setViewportSize({width:390,height:844});
await page.reload({waitUntil:"networkidle"});
if (await page.locator("body").boundingBox() === null) throw new Error("Mobile page missing");

if (localFailures.length) throw new Error("Local HTTP failures:\n" + localFailures.slice(0,10).join("\n"));
const remoteErrors = errors.filter(x => !/Failed to load resource/.test(x));
if (remoteErrors.length) throw new Error(remoteErrors.slice(0,10).join("\n"));
await browser.close();
console.log("BROWSER SMOKE PASS");
