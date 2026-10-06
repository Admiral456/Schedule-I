(() => {
  const esc = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
  const norm = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  let recipes = []; let effectColors = {};

  function inject() {
    if (document.querySelector('.tab[data-tab="community"]')) return;
    const nav = document.querySelector(".tabs");
    const main = document.querySelector("main");
    if (!nav || !main) return;
    const b = document.createElement("button");
    b.className = "tab";
    b.dataset.tab = "community";
    b.textContent = "Community";
    const target = document.querySelector('.tab[data-tab="recipes"]');
    target ? target.insertAdjacentElement("afterend", b) : nav.appendChild(b);

    const section = document.createElement("section");
    section.className = "view";
    section.id = "view-community";
    section.innerHTML = `
      <div class="toolbar">
        <div><div class="label">Community catalog</div><h2>Community recepty</h2><p>Přímo v Helperu. Recepty jsou uložené s přesným pořadím ingrediencí a zdrojem z veřejného komunitního katalogu.</p></div>
        <div class="filters"><input id="communitySearch" type="search" placeholder="Hledat recept nebo ingredienci…"><select id="communityBase"><option value="">Všechny základy</option></select></div>
      </div>
      <div id="communitySummary" class="catalog-summary"></div>
      <div id="communityList" class="s1-community-grid"></div>`;
    main.appendChild(section);

    const style = document.createElement("style");
    style.id = "s1-community-style";
    style.textContent = `
      .s1-community-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .s1-community-card{border:1px solid var(--border);background:var(--panel);border-radius:13px;padding:12px}
      .s1-community-id{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
      .s1-community-name{font-size:13px;font-weight:800;margin-top:3px}
      .s1-community-meta{font-size:9px;color:var(--muted);margin-top:3px}
      .s1-community-ings{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
      .s1-community-ing{padding:4px 7px;border-radius:999px;border:1px solid var(--border);background:var(--panel2);font-size:9px}
      .s1-community-effects{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.s1-community-effect{padding:4px 7px;border-radius:999px;border:1px solid var(--border);background:color-mix(in srgb,var(--effect-color) 18%,var(--panel2));color:var(--effect-color);font-size:9px;font-weight:700}.s1-community-source{font-size:8px;color:var(--muted);margin-top:9px}
      @media(max-width:720px){.s1-community-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
    b.addEventListener("click", render);
    section.querySelector("#communitySearch").addEventListener("input", render);
    section.querySelector("#communityBase").addEventListener("change", render);
  }

  function render() {
    const list=document.querySelector("#communityList"), summary=document.querySelector("#communitySummary");
    if(!list || !summary) return;
    const q=norm(document.querySelector("#communitySearch")?.value);
    const base=document.querySelector("#communityBase")?.value || "";
    const filtered=recipes.filter(r=>(!base || r.base_product===base)&&(!q || norm([r.name,r.base_product,...(r.ingredients||[])].join(" ")).includes(q)));
    summary.textContent=`${filtered.length} / ${recipes.length} receptů v Helperu`;
    list.innerHTML=filtered.map(r=>`
      <article class="s1-community-card">
        <div class="s1-community-id">${esc(r.id)}</div>
        <div class="s1-community-name">${esc(r.name)}</div>
        <div class="s1-community-meta">Základ: ${esc(r.base_product || "neuvedený")}</div>
        <div class="s1-community-ings">${(r.ingredients||[]).map(x=>`<span class="s1-community-ing">${esc(x)}</span>`).join("")}</div>
        <div class="s1-community-effects">${(r.effects||[]).map(e=>`<span class="s1-community-effect" style="--effect-color:${esc(effectColors[e]||"transparent")}">${esc(e)}</span>`).join("")}</div><div class="s1-community-source">Source: Schedule 1 Lab · community · ${esc(r.author || "autor neuveden")}</div>
      </article>`).join("") || '<div class="empty">Žádný recept neodpovídá hledání.</div>';
  }

  async function load(){
    try{
      const r=await fetch("./data/community-recipes.json?ts="+Date.now(),{cache:"no-store"});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const d=await r.json();
      recipes=Array.isArray(d.recipes)?d.recipes:[];
      const select=document.querySelector("#communityBase");
      const bases=[...new Set(recipes.map(x=>x.base_product).filter(Boolean))].sort();
      if(select && select.options.length===1) bases.forEach(x=>select.insertAdjacentHTML("beforeend",`<option value="${esc(x)}">${esc(x)}</option>`));
      render();
    }catch{
      const root=document.querySelector("#communityList");
      if(root)root.innerHTML='<div class="empty">Community databázi se nepodařilo načíst.</div>';
    }
  }

  function init(){inject();load();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();