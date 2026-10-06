(() => {
  const STORE="schedule1-helper-seeded-save-v3";
  const MAX_EFFECTS=8;
  const EFFECTS=["Shrinking","Zombifying","Cyclopean","Anti-Gravity","Long Faced","Electrifying","Glowing","Tropic Thunder","Thought-Provoking","Jennerising","Bright-Eyed","Spicy","Foggy","Slippery","Athletic","Balding","Calorie-Dense","Sedating","Sneaky","Energizing","Gingeritis","Euphoric","Focused","Refreshing","Munchies","Calming","Disorienting","Explosive","Laxative","Lethal","Paranoia","Schizophrenic","Seizure-Inducing","Smelly","Toxic"];
  const FALLBACK_INGREDIENTS={
    "Addy":"Thought-Provoking","Banana":"Gingeritis","Battery":"Bright-Eyed","Chili":"Spicy","Cuke":"Energizing","Donut":"Calorie-Dense",
    "Energy Drink":"Athletic","Flu Medicine":"Sedating","Gasoline":"Toxic","Horse Semen":"Long Faced","Iodine":"Jennerising","Mega Bean":"Foggy",
    "Motor Oil":"Slippery","Mouth Wash":"Balding","Paracetamol":"Sneaky","Viagor":"Tropic Thunder"
  };
  const FALLBACK_DRUGS={"OG Kush":["Calming"],"Sour Diesel":["Refreshing"],"Green Crack":["Energizing"],"Granddaddy Purple":["Sedating"],"Meth":[],"Cocaine":[],"Shrooms":[]};
  const state={payload:loadStored(),ingredients:{...FALLBACK_INGREDIENTS},drugs:{...FALLBACK_DRUGS},effectAliases:{},officialCore:null,officialRules:null};
  const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  const effectName=v=>EFFECTS.find(x=>norm(x)===norm(v))||null;
  const ingredientName=v=>Object.keys(state.ingredients).find(x=>norm(x)===norm(v))||null;
  const uniq=a=>[...new Set(a)];

  function loadStored(){try{return JSON.parse(localStorage.getItem(STORE)||"null")}catch{return null}}
  function saveStored(x){try{localStorage.setItem(STORE,JSON.stringify(x));return true}catch{return false}}

  function deepWalk(node,path=[],out={nodes:0,seedCandidates:[],rules:[],products:[]}){
    if(out.nodes++>250000)return out;
    if(typeof node==="string"){try{const parsed=JSON.parse(node);if(parsed&&parsed!==node)deepWalk(parsed,path,out)}catch{};return out;}
    if(Array.isArray(node)){node.forEach((x,i)=>deepWalk(x,path.concat(String(i)),out));return out;}
    if(!node||typeof node!=="object")return out;

    for(const [k,v] of Object.entries(node)){
      const lk=norm(k).replace(/[^a-z0-9]/g,"");
      if(/^(gameseed|saveseed|seed|seedvalue|seednumber|worldseed|mixseed|mixingseed)$/i.test(lk)&&(typeof v==="number"||typeof v==="string")){
        out.seedCandidates.push({path:path.concat(k),value:String(v)});
      }
    }

    const entries=Object.entries(node);
    const effectEntries=entries.map(([k,v])=>({k,v,e:effectName(v)})).filter(x=>x.e);
    const ingredientEntries=entries.map(([k,v])=>({k,v,i:ingredientName(v)})).filter(x=>x.i);
    const fromKeys=["from","input","source","previous","before","inputeffect","sourceeffect","requiredeffect","oldeffect","originaleffect"];
    const toKeys=["to","output","result","next","after","outputeffect","resulteffect","neweffect","replacedeffect","transformedto"];
    const fromEntry=entries.find(([k,v])=>fromKeys.includes(norm(k).replace(/[^a-z]/g,""))&&effectName(v));
    const toEntry=entries.find(([k,v])=>toKeys.includes(norm(k).replace(/[^a-z]/g,""))&&effectName(v));
    if(fromEntry&&toEntry&&ingredientEntries.length){
      out.rules.push({from:effectName(fromEntry[1]),to:effectName(toEntry[1]),ingredient:ingredientEntries[0].i,path:[...path],confidence:"explicit"});
    }else if(effectEntries.length>=2&&ingredientEntries.length){
      const es=uniq(effectEntries.map(x=>x.e));
      out.rules.push({from:es[0],to:es[1],ingredient:ingredientEntries[0].i,path:[...path],confidence:"heuristic"});
    }

    if(Object.prototype.hasOwnProperty.call(node,"Product")||Object.prototype.hasOwnProperty.call(node,"product")||
       Object.prototype.hasOwnProperty.call(node,"Output")||Object.prototype.hasOwnProperty.call(node,"output")||
       Object.prototype.hasOwnProperty.call(node,"Mixer")||Object.prototype.hasOwnProperty.call(node,"mixer")){
      out.products.push({Product:node.Product??node.product??null,Mixer:node.Mixer??node.mixer??null,Output:node.Output??node.output??null,path:[...path]});
    }
    entries.forEach(([k,v])=>deepWalk(v,path.concat(k),out));
    return out;
  }

  async function readDirectory(handle){
    const files=[];
    async function walk(h,prefix=[]){
      for await(const entry of h.values()){
        const p=prefix.concat(entry.name);
        if(entry.kind==="directory")await walk(entry,p);
        else if(entry.kind==="file"&&/\.json$/i.test(entry.name)){
          const f=await entry.getFile();
          if(f.size<=12*1024*1024)files.push({name:p.join("/"),text:await f.text()});
        }
      }
    }
    await walk(handle);return files;
  }

  function normalizeSaveEffect(value){
    if(value==null)return null;
    const direct=effectName(value);
    if(direct)return direct;
    const key=norm(value).replace(/[^a-z0-9]/g,"");
    return state.effectAliases[key]||null;
  }

  function extractProductManagerData(files){
    const productsFile=files.find(f=>/^(?:.*\\/)?products\\/products\\.json$/i.test(f.name)||(/products\\.json$/i.test(f.name)&&f.text.includes("MixRecipes")));
    if(!productsFile)return {rules:[],mixRecords:[],createdCount:0};
    let products;
    try{products=JSON.parse(productsFile.text)}catch{return {rules:[],mixRecords:[],createdCount:0}};
    const created=new Map();
    for(const f of files){
      if(!/createdproducts\\/[^/]+\\.json$/i.test(f.name))continue;
      try{
        const d=JSON.parse(f.text);
        const id=d.ID||d.Id||d.id||d.Name||d.name;
        const props=Array.isArray(d.Properties)?d.Properties:[];
        if(id&&props.length)created.set(String(id),props.map(normalizeSaveEffect).filter(Boolean));
      }catch{}
    }
    const rules=new Map();
    const mixRecords=[];
    for(const m of (Array.isArray(products.MixRecipes)?products.MixRecipes:[])){
      const ingredient=ingredientName(m.Product)||ingredientName(m.Ingredient)||null;
      const mixerId=m.Mixer??m.Input??null;
      const outputId=m.Output??m.Result??null;
      if(!ingredient||mixerId==null||outputId==null)continue;
      const before=created.get(String(mixerId))||[];
      const after=created.get(String(outputId))||[];
      const removed=before.filter(x=>!after.includes(x));
      const added=after.filter(x=>!before.includes(x));
      const rec={ingredient,mixer:String(mixerId),output:String(outputId),before,after,removed,added};
      mixRecords.push(rec);
      if(removed.length===1&&added.length===1){
        const key=norm(ingredient)+"|"+norm(removed[0]);
        rules.set(key,{from:removed[0],to:added[0],ingredient,path:["Products/Products.json","MixRecipes"],confidence:"product-manager-diff"});
      }
    }
    return {rules:[...rules.values()],mixRecords,createdCount:created.size};
  }

  function analyzeFiles(files){
    const acc={nodes:0,seedCandidates:[],rules:[],products:[]};
    for(const f of files){try{deepWalk(JSON.parse(f.text),[f.name],acc)}catch{}}
    const pm=extractProductManagerData(files);
    acc.rules.push(...pm.rules);
    acc.products.push(...pm.mixRecords);
    const seeds=uniq(acc.seedCandidates.map(x=>JSON.stringify(x))).map(x=>JSON.parse(x));
    const ruleMap=new Map();
    for(const r of acc.rules){
      if(!r.from||!r.to||!r.ingredient||r.from===r.to)continue;
      const key=norm(r.ingredient)+"|"+norm(r.from);
      if(!ruleMap.has(key)||r.confidence==="explicit")ruleMap.set(key,r);
    }
    return {
      schema_version:3,mode:"seeded",imported_at:new Date().toISOString(),
      files:files.map(f=>f.name),detected_seed_candidates:seeds,
      detected_rules:[...ruleMap.values()],detected_product_mix_records:acc.products,
      scan_nodes:acc.nodes,rule_count:ruleMap.size,product_record_count:acc.products.length,product_manager_created_count:pm.createdCount,product_manager_rule_count:pm.rules.length
    };
  }


  async function loadOfficialMixerCore(){
    try{
      const res=await fetch("./data/schedule1-tools-core.json?ts="+Date.now(),{cache:"no-store"});
      if(!res.ok)throw new Error("HTTP "+res.status);
      const core=await res.json();
      state.officialCore=core;
      state.officialRules=core.rules||{};
      for(const [name,v] of Object.entries(core.substances||{})){ if(v?.effect?.[0]) state.ingredients[name]=(core.effects?.[v.effect[0]]?.name)||state.ingredients[name]||v.effect[0]; }
      for(const [name,v] of Object.entries(core.products||{})){ state.drugs[name]=(v.effects||[]).map(code=>core.effects?.[code]?.name||code); }
      for(const [code,v] of Object.entries(core.effects||{})){ if(v?.name) state.effectAliases[norm(code).replace(/[^a-z0-9]/g,"")]=v.name; }
      state.effectAliases.schizophrenic="Schizophrenia";
      state.effectAliases.schizophrenia="Schizophrenia";
    }catch(e){ console.warn("Official mixer core unavailable:",e); }
  }

  async function loadReferenceData(){
    try{
      const [iRes,dRes,eRes]=await Promise.all([fetch("./data/ingredients.json",{cache:"no-store"}),fetch("./data/drugs.json",{cache:"no-store"}),fetch("./data/effects.json",{cache:"no-store"})]);
      if(iRes.ok){const d=await iRes.json();for(const x of(d.items||[]))if(x?.name&&x?.base_effect)state.ingredients[x.name]=x.base_effect;}
      if(dRes.ok){const d=await dRes.json();for(const x of(d.drugs||[]))if(x?.name)state.drugs[x.name]=Array.isArray(x.base_effects)?x.base_effects:[];}
      if(eRes.ok){const d=await eRes.json();for(const x of(d.effects||[])){if(!x?.name)continue;state.effectAliases[norm(x.name).replace(/[^a-z0-9]/g,"")]=x.name;const id=x.id||x.effect_id||x.key;if(id)state.effectAliases[norm(id).replace(/[^a-z0-9]/g,"")]=x.name;}}
    }catch{}
  }

  function calculate(product,sequence){
    const rules=new Map((state.payload?.detected_rules||[]).map(r=>[norm(r.ingredient)+"|"+norm(r.from),r]));
    let effects=uniq((state.drugs[product]||[]).map(effectName).filter(Boolean));
    const steps=[],unresolved=[];
    for(const ingredient of sequence){
      const before=[...effects],next=[];
      for(const eff of effects){
        const rule=rules.get(norm(ingredient)+"|"+norm(eff));
        if(rule)next.push(rule.to);else{next.push(eff);unresolved.push({ingredient,from:eff});}
      }
      effects=uniq(next);
      const added=state.ingredients[ingredient];
      if(added&&!effects.includes(added)&&effects.length<MAX_EFFECTS)effects.push(added);
      steps.push({ingredient,ingredient_effect:added,before,after:[...effects]});
    }
    return {product,sequence,final_effects:effects,steps,unresolved:uniq(unresolved.map(x=>JSON.stringify(x))).map(x=>JSON.parse(x)),rulesKnown:rules.size};
  }

  function renderCalc(){
    const result=document.querySelector("#s1SeededCalcResult");
    const product=document.querySelector("#s1SeededProduct")?.value;
    const seqRaw=document.querySelector("#s1SeededSequence")?.value||"";
    if(!result)return;
    const sequence=seqRaw.split(/\n|→|,|;/).map(s=>ingredientName(s.trim())).filter(Boolean);
    if(!product||!sequence.length){result.innerHTML='<div class="s1-seeded-empty">Vyber produkt a zadej alespoň jednu ingredienci.</div>';return;}
    if(!state.payload?.detected_rules?.length){result.innerHTML='<div class="s1-seeded-empty">Save nemá rozpoznaná save-specific pravidla. Standardní engine se tímto režimem nepřepisuje.</div>';return;}
    const out=calculate(product,sequence);
    result.innerHTML=`<div class="s1-seeded-result-head"><b>${esc(out.product)}</b><span>${out.sequence.length} ingrediencí · ${out.rulesKnown} uložených seeded pravidel</span></div><div class="s1-seeded-effects">${out.final_effects.map(e=>`<span class="s1-community-ing">${esc(e)}</span>`).join("")}</div><div class="s1-seeded-steps">${out.steps.map(s=>`<div><b>${esc(s.ingredient)}</b> → ${esc(s.after.join(", "))}</div>`).join("")}</div><div class="s1-seeded-confidence">${out.unresolved.length?("⚠️ Neznámé transformace: "+out.unresolved.length+". Výsledek je jen částečný."):("✅ Všechny použité transformace jsou pokryté importovanými save-specific pravidly.")}</div>`;
  }

  function populateCalc(){
    const p=document.querySelector("#s1SeededProduct");
    if(p&&p.options.length===1)Object.keys(state.drugs).forEach(x=>p.insertAdjacentHTML("beforeend",`<option value="${esc(x)}">${esc(x)}</option>`));
    const btn=document.querySelector("#s1RunSeededCalc");
    if(btn&&!btn.dataset.bound){btn.dataset.bound="1";btn.addEventListener("click",renderCalc);}
    renderCalc();
  }

  function renderStatus(){
    const s=document.querySelector("#s1SeededStatus"),r=document.querySelector("#s1SeededRules");
    if(!s||!r)return;
    const p=state.payload;
    if(!p){s.textContent="Žádný save není načten.";r.innerHTML="";populateCalc();return;}
    const seeds=(p.detected_seed_candidates||[]).map(x=>esc(x.value)).slice(0,8);
    s.innerHTML=esc(p.summary||"Save načten. Seeded pravidla jsou vázaná na konkrétní save.")+`<br><span class="meta">Seed kandidáti: ${seeds.length?seeds.join(", "):"nenalezeny"}</span>`;
    const rules=(p.detected_rules||[]).slice(0,30);
    r.innerHTML=rules.map(x=>`<div class="s1-new-item"><b>${esc(x.ingredient)}</b> · ${esc(x.from)} → ${esc(x.to)}<div class="meta">${esc((x.path||[]).join(" / "))} · ${esc(x.confidence||"")}</div></div>`).join("")||'<div class="s1-new-item">Žádné save-specific transformační pravidlo nebylo rozpoznáno.</div>';
    populateCalc();
  }

  async function processFileList(files){
    const p=analyzeFiles(files);
    p.summary=`Načteno ${files.length} JSON souborů · kandidátní seedy: ${p.detected_seed_candidates.length} · save-specific pravidla: ${p.rule_count} · ProductManager mixy: ${p.product_record_count} · automaticky odvozená pravidla: ${p.product_manager_rule_count||0}`;
    if(!saveStored(p)){alert("Save data se nepodařilo uložit do localStorage.");return;}
    state.payload=p;renderStatus();
  }

  async function pickFolder(){
    if(!window.showDirectoryPicker){alert("Tento prohlížeč nepodporuje výběr složky. Použij „Vybrat JSON soubory“ a vyber JSON soubory ze SaveGame_*.");return;}
    try{
      const dir=await window.showDirectoryPicker({mode:"read"});
      const files=await readDirectory(dir);
      if(!files.length){alert("Ve složce nebyly nalezeny JSON save soubory.");return;}
      await processFileList(files);
    }catch(e){if(e?.name!=="AbortError")alert("Save se nepodařilo načíst: "+(e?.message||e));}
  }

  function ui(){
    const recipes=document.querySelector("#view-recipes");
    if(!recipes)return;
    let card=document.querySelector("#s1-seeded-card");
    if(!card){
      card=document.createElement("div");card.id="s1-seeded-card";card.className="s1-feature-card";
      card.innerHTML=`
        <div class="label">Save-specific mixing</div>
        <h3>Seeded Mixing</h3>
        <p>Vyber skutečnou složku <b>SaveGame_*</b>. Data zůstávají lokálně v prohlížeči a po importu se automaticky použijí ve seeded kalkulátoru.</p>
        <div class="s1-feature-actions">
          <button class="btn primary" id="s1PickSaveFolder" type="button">Vybrat SaveGame složku</button>
          <button class="btn" id="s1PickSaveJson" type="button">Vybrat JSON soubory</button>
          <button class="btn ghost danger" id="s1ClearSeeded" type="button">Smazat save data</button>
          <input id="s1SaveJsonInput" type="file" accept="application/json,.json" multiple hidden>
        </div>
        <div id="s1SeededStatus" class="account-note"></div>
        <div id="s1SeededRules" class="s1-new-grid"></div>
        <div class="s1-seeded-calc">
          <div class="label">Seeded calculator</div>
          <div class="s1-seeded-controls">
            <select id="s1SeededProduct"><option value="">Produkt…</option></select>
            <textarea id="s1SeededSequence" rows="2" placeholder="Banana → Cuke → Horse Semen → Mega Bean"></textarea>
            <button class="btn primary" id="s1RunSeededCalc" type="button">Spočítat seeded mix</button>
          </div>
          <div id="s1SeededCalcResult" class="s1-seeded-result"></div>
        </div>`;
      recipes.prepend(card);
      card.querySelector("#s1PickSaveFolder").addEventListener("click",pickFolder);
      card.querySelector("#s1PickSaveJson").addEventListener("click",()=>card.querySelector("#s1SaveJsonInput").click());
      card.querySelector("#s1SaveJsonInput").addEventListener("change",async e=>{
        const files=[...e.target.files].map(async f=>({name:f.webkitRelativePath||f.name,text:await f.text()}));
        await processFileList(await Promise.all(files));e.target.value="";
      });
      card.querySelector("#s1ClearSeeded").addEventListener("click",()=>{localStorage.removeItem(STORE);state.payload=null;renderStatus();});
      const css=document.createElement("style");css.id="s1-seeded-css";css.textContent=`
        .s1-seeded-calc{margin-top:14px;padding-top:14px;border-top:1px solid var(--border)}
        .s1-seeded-controls{display:grid;grid-template-columns:170px 1fr auto;gap:8px;margin-top:8px}
        .s1-seeded-controls select,.s1-seeded-controls textarea{width:100%;box-sizing:border-box;background:var(--panel2);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:9px;font:inherit}
        .s1-seeded-result{margin-top:10px}
        .s1-seeded-result-head{display:flex;justify-content:space-between;gap:10px;font-size:11px}
        .s1-seeded-result-head span,.s1-seeded-confidence{font-size:9px;color:var(--muted)}
        .s1-seeded-effects{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
        .s1-seeded-steps{display:grid;gap:4px;margin-top:9px;font-size:9px}
        .s1-seeded-empty{font-size:9px;color:var(--muted)}
        @media(max-width:720px){.s1-seeded-controls{grid-template-columns:1fr}.s1-seeded-result-head{display:grid}}
      `;document.head.appendChild(css);
    }
    populateCalc();renderStatus();
  }

  window.__s1SeededMixing={
    getState:()=>state.payload,
    getRule:(ingredient,from)=>state.payload?.detected_rules?.find(x=>norm(x.ingredient)===norm(ingredient)&&norm(x.from)===norm(from))||null,
    calculate,
    clear:()=>{localStorage.removeItem(STORE);state.payload=null;renderStatus();}
  };

  async function init(){
    await loadOfficialMixerCore();
    await loadReferenceData();
    const observer=new MutationObserver(ui);
    observer.observe(document.body,{childList:true,subtree:true});
    ui();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();