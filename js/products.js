(() => {
  const esc = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
  const norm = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

  function inject() {
    const main = document.querySelector("main");
    const primary = document.querySelector(".primary-nav");
    if (!main || !primary || document.querySelector("#view-products")) return;

    const nav = document.createElement("button");
    nav.className = "tab nav-tab";
    nav.dataset.tab = "products";
    nav.type = "button";
    nav.textContent = "Produkty / příchutě";
    primary.appendChild(nav);

    const view = document.createElement("section");
    view.className = "view";
    view.id = "view-products";
    view.innerHTML = `
      <div class="toolbar">
        <div>
          <div class="label">Product Book</div>
          <h2>Produkty a příchutě</h2>
          <p>Veřejně zdokumentované varianty produktů, jejich cesta mícháním, efekty a skutečné ikony základních produktů a ingrediencí.</p>
        </div>
        <div class="filters">
          <input id="productSearch" type="search" placeholder="Hledat produkt, ingredienci nebo efekt…">
          <select id="productFamily"><option value="">Všechny skupiny</option></select>
        </div>
      </div>
      <div class="s1-products-note">
        <b>Ikony:</b> u smíchaných variant používáme ověřenou ikonu základního produktu. Samostatnou přesnou ikonu konkrétní varianty nevymýšlíme, pokud její veřejný asset není ověřený.
      </div>
      <div id="productSummary" class="catalog-summary"></div>
      <div id="productList" class="s1-product-grid"></div>`;
    main.appendChild(view);

    const style = document.createElement("style");
    style.id = "s1-products-style";
    style.textContent = `
      .s1-products-note{border:1px solid var(--border);background:var(--panel);border-radius:11px;padding:9px 11px;font-size:10px;color:var(--muted);margin:0 0 10px}
      .s1-product-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .s1-product-card{border:1px solid var(--border);background:var(--panel);border-radius:13px;padding:12px;display:grid;grid-template-columns:64px minmax(0,1fr);gap:10px}
      .s1-product-icon{width:64px;height:64px;border:1px solid var(--border);background:var(--panel2);border-radius:10px;display:grid;place-items:center;overflow:hidden}
      .s1-product-icon img{width:100%;height:100%;object-fit:contain;padding:5px}
      .s1-product-icon span{font-size:8px;color:var(--muted);padding:6px;text-align:center}
      .s1-product-name{font-size:13px;font-weight:800}
      .s1-product-family{font-size:9px;color:var(--muted);margin-top:2px}
      .s1-product-effects{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}
      .s1-product-effect{font-size:9px;border:1px solid var(--border);border-radius:999px;padding:3px 6px}
      .s1-product-recipe{margin-top:8px;border-top:1px solid var(--border);padding-top:8px}
      .s1-product-recipe-title{font-size:9px;color:var(--muted);margin-bottom:5px}
      .s1-product-chain{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
      .s1-product-step{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--border);background:var(--panel2);border-radius:8px;padding:3px 5px;font-size:9px}
      .s1-product-step img{width:24px;height:24px;object-fit:contain}
      .s1-product-arrow{font-size:12px;color:var(--muted)}
      .s1-product-source{font-size:8px;color:var(--muted);margin-top:7px;overflow-wrap:anywhere}
      @media(max-width:720px){.s1-product-grid{grid-template-columns:1fr}.s1-product-card{grid-template-columns:58px minmax(0,1fr)}.s1-product-icon{width:58px;height:58px}}
    `;
    document.head.appendChild(style);

    nav.addEventListener("click", () => render());
    view.querySelector("#productSearch").addEventListener("input", render);
    view.querySelector("#productFamily").addEventListener("change", render);
  }

  let products = [];
  let drugs = [];
  let ingredients = [];

  function baseIcon(name) {
    const n = norm(name);
    const aliases = { viagra:"Viagor", "granddaddy-purple":"Granddaddy Purple" };
    const target = aliases[n] || name;
    const d = drugs.find(x => norm(x.name) === norm(target) || norm(x.id) === norm(target));
    return d?.icon_url || "";
  }

  function ingredient(name) {
    const aliases = { viagra:"Viagor" };
    const target = aliases[norm(name)] || name;
    return ingredients.find(x => norm(x.name) === norm(target) || norm(x.id) === norm(target));
  }

  function render() {
    const list = document.querySelector("#productList");
    const summary = document.querySelector("#productSummary");
    if (!list || !summary) return;
    const q = norm(document.querySelector("#productSearch")?.value);
    const family = document.querySelector("#productFamily")?.value || "";
    const filtered = products.filter(p => (!family || p.family === family) && (!q || norm([p.name,p.family,p.base_product,...p.effects,...p.ingredients].join(" ")).includes(q)));
    summary.textContent = filtered.length + " / " + products.length + " dokumentovaných produktových variant";
    list.innerHTML = filtered.map(p => {
      const icon = baseIcon(p.base_product);
      const steps = p.ingredients?.length
        ? '<div class="s1-product-recipe"><div class="s1-product-recipe-title">Recept / cesta</div><div class="s1-product-chain"><span class="s1-product-step">'+esc(p.base_product)+'</span><span class="s1-product-arrow">＋</span>'+p.ingredients.map((name,i)=>{
            const x = ingredient(name);
            return '<span class="s1-product-step">'+(x?.icon?.secondary_source_asset_url || x?.icon?.rendered_asset_url ? '<img src="'+esc(x.icon.secondary_source_asset_url || x.icon.rendered_asset_url)+'" alt="'+esc(name)+'">' : '')+esc(name)+'</span>';
          }).join('<span class="s1-product-arrow">＋</span>')+'<span class="s1-product-arrow">→</span><strong>'+esc(p.name)+'</strong></div></div>'
        : '<div class="s1-product-recipe"><div class="s1-product-recipe-title">Základní produkt</div><div class="s1-product-chain"><strong>Bez ingredience</strong></div></div>';
      return '<article class="s1-product-card"><div class="s1-product-icon">'+(icon?'<img src="'+esc(icon)+'" alt="'+esc(p.base_product)+' icon" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'<span>Ikona základu není dostupná</span>')+'</div><div><div class="s1-product-name">'+esc(p.name)+'</div><div class="s1-product-family">'+esc(p.family)+' · základ: '+esc(p.base_product)+'</div><div class="s1-product-effects">'+(p.effects?.length?p.effects.map(e=>'<span class="s1-product-effect">'+esc(e)+'</span>').join(""):'<span class="s1-product-effect">Bez efektu</span>')+'</div>'+steps+'<div class="s1-product-source">Zdroj: Schedule 1 Wiki · veřejně zdokumentovaná varianta</div></div></article>';
    }).join("") || '<div class="empty">Žádný produkt neodpovídá hledání.</div>';
  }

  async function load() {
    try {
      const [p,d,i] = await Promise.all([
        fetch("./data/products.json?ts="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
        fetch("./data/drugs.json?ts="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
        fetch("./data/ingredients.json?ts="+Date.now(),{cache:"no-store"}).then(r=>r.json())
      ]);
      products = p.products || [];
      drugs = d.drugs || [];
      ingredients = i.items || [];
      window.__s1Products = products;
      const familySelect = document.querySelector("#productFamily");
      if (familySelect) familySelect.innerHTML = "<option value=''>Všechny skupiny</option>" + [...new Set(products.map(x=>x.family).filter(Boolean))].sort().map(x=>"<option value='"+esc(x)+"'>"+esc(x)+"</option>").join("");
      render();
      document.dispatchEvent(new CustomEvent("s1-products-loaded"));
    } catch {
      const root=document.querySelector("#productList");
      if(root)root.innerHTML='<div class="empty">Databázi produktů se nepodařilo načíst.</div>';
    }
  }

  function init() {
    inject();
    load();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();