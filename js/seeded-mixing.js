(() => {
  const STORE="schedule1-helper-seeded-save-v2";
  const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  const knownEffects=["Shrinking","Zombifying","Cyclopean","Anti-Gravity","Long Faced","Electrifying","Glowing","Tropic Thunder","Thought-Provoking","Jennerising","Bright-Eyed","Spicy","Foggy","Slippery","Athletic","Balding","Calorie-Dense","Sedating","Sneaky","Energizing","Gingeritis","Euphoric","Focused","Refreshing","Munchies","Calming","Disorienting","Explosive","Laxative","Lethal","Paranoia","Schizophrenic","Seizure-Inducing","Smelly","Toxic"];
  const ingredients=["Addy","Banana","Battery","Chili","Cuke","Donut","Energy Drink","Flu Medicine","Gasoline","Horse Semen","Iodine","Mega Bean","Motor Oil","Mouth Wash","Paracetamol","Viagor"];
  const state={payload:loadStored()};

  function loadStored(){try{return JSON.parse(localStorage.getItem(STORE)||"null")}catch{return null}}
  function saveStored(x){try{localStorage.setItem(STORE,JSON.stringify(x));return true}catch{return false}}
  function effectName(v){const s=norm(v);return knownEffects.find(x=>norm(x)===s)||null}
  function ingredientName(v){const s=norm(v);return ingredients.find(x=>norm(x)===s)||null}

  function deepWalk(node,path=[],out={nodes:0,seedCandidates:[],rules:[],products:[]}) {
    if(out.nodes++>120000)return out;
    if(typeof node==="string"){
      try{
        const parsed=JSON.parse(node);
        if(parsed && parsed!==node) deepWalk(parsed,path,out);
      }catch{}
      return out;
    }
    if(Array.isArray(node)){node.forEach((x,i)=>deepWalk(x,path.concat(String(i)),out));return out;}
    if(!node||typeof node!=="object")return out;

    for(const [k,v] of Object.entries(node)){
      const lk=norm(k).replace(/[^a-z0-9]/g,"");
      if(/^(gameseed|saveseed|seed|seedvalue|seednumber|worldseed)$/i.test(lk) && (typeof v==="number" || typeof v==="string")){
        out.seedCandidates.push({path:path.concat(k),value:String(v)});
      }
    }

    const vals=Object.entries(node).map(([k,v])=>({k,lk:norm(k),v,s:String(v??"")}));
    const effs=vals.map(x=>effectName(x.s)).filter(Boolean);
    const ing=vals.map(x=>ingredientName(x.s)).find(Boolean);
    const source=vals.find(x=>["from","input","source","previous","before","input_effect","source_effect","requiredeffect"].includes(x.lk.replace(/[^a-z]/g,"")));
    const target=vals.find(x=>["to","output","result","next","after","output_effect","resulteffect"].includes(x.lk.replace(/[^a-z]/g,"")));
    const from=source?.v?effectName(String(source.v)):null;
    const to=target?.v?effectName(String(target.v)):null;
    if(from && to && ing){
      out.rules.push({from,to,ingredient:ing,path:[...path]});
    }else if(effs.length>=2 && ing){
      const unique=[...new Set(effs)];
      out.rules.push({from:unique[0],to:unique[1],ingredient:ing,path:[...path],confidence:"heuristic"});
    }

    const product=Math.min(...["Product","product","Output","output","Mixer","mixer"].map(k=>Object.prototype.hasOwnProperty.call(node,k)?0:1));
    if(product===0){
      const p=node.Product??node.product??null, m=node.Mixer??node.mixer??null, o=node.Output??node.output??null;
      if(p||m||o) out.products.push({Product:p,Mixer:m,Output:o,path:[...path]});
    }
    Object.entries(node).forEach(([k,v])=>deepWalk(v,path.concat(k),out));
    return out;
  }

  async function readDirectory(handle){
    const files=[];
    async function walk(h,prefix=[]){
      for await(const entry of h.values()){
        const p=prefix.concat(entry.name);
        if(entry.kind==="directory") await walk(entry,p);
        else if(entry.kind==="file" && /\.json$/i.test(entry.name)){
          const f=await entry.getFile();
          if(f.size>8*1024*1024) continue;
          files.push({name:p.join("/"),text:await f.text()});
        }
      }
    }
    await walk(handle);
    return files;
  }

  function analyzeFiles(files){
    const roots=files.flatMap(f=>{
      try{return [{...JSON.parse(f.text),__file:f.name}]}
      catch{return []}
    });
    const acc={nodes:0,seedCandidates:[],rules:[],products:[]};
    roots.forEach(x=>deepWalk(x,[x.__file],acc));
    const seeds=[...new Map(acc.seedCandidates.map(x=>[JSON.stringify(x),x])).values()];
    const rules=[...new Map(acc.rules.map(x=>[norm(x.ingredient)+"|"+norm(x.from)+"|"+norm(x.to),x])).values()];
    return {
      schema_version:2,mode:"seeded",imported_at:new Date().toISOString(),
      files:files.map(x=>x.name),detected_seed_candidates:seeds,
      detected_rules:rules,detected_product_mix_records:acc.products,
      scan_nodes:acc.nodes,rule_count:rules.length,product_record_count:acc.products.length
    };
  }

  function ui(){
    const recipes=document.querySelector("#view-recipes");
    if(!recipes || document.querySelector("#s1-seeded-card")) return;
    const card=document.createElement("div");
    card.id="s1-seeded-card";card.className="s1-feature-card";
    card.innerHTML=`
      <div class="label">Save-specific mixing</div>
      <h3>Seeded Mixing</h3>
      <p>Vyber skutečnou složku <b>SaveGame_*</b>. Helper přečte pouze lokální JSON soubory a uloží extrahovaná pravidla do tohoto prohlížeče. Nic se neposílá na server.</p>
      <div class="s1-feature-actions">
        <button class="btn primary" id="s1PickSaveFolder" type="button">Vybrat SaveGame složku</button>
        <button class="btn" id="s1PickSaveJson" type="button">Vybrat JSON soubory</button>
        <button class="btn ghost danger" id="s1ClearSeeded" type="button">Smazat save data</button>
        <input id="s1SaveJsonInput" type="file" accept="application/json,.json" multiple hidden>
      </div>
      <div id="s1SeededStatus" class="account-note"></div>
      <div id="s1SeededRules" class="s1-new-grid"></div>`;
    recipes.prepend(card);
    const folderBtn=card.querySelector("#s1PickSaveFolder");
    folderBtn.addEventListener("click",pickFolder);
    card.querySelector("#s1PickSaveJson").addEventListener("click",()=>card.querySelector("#s1SaveJsonInput").click());
    card.querySelector("#s1SaveJsonInput").addEventListener("change",async e=>{
      const files=[...e.target.files].map(f=>f);
      await processFileList(files.map(f=>f.text().then(t=>({name:f.name,text:t}))).length?await Promise.all(files.map(async f=>({name:f.name,text:await f.text()}))):[]);
      e.target.value="";
    });
    card.querySelector("#s1ClearSeeded").addEventListener("click",()=>{localStorage.removeItem(STORE);state.payload=null;renderStatus();});
    renderStatus();
  }

  async function pickFolder(){
    if(!window.showDirectoryPicker){
      alert("Tento prohlížeč nepodporuje výběr složky. Použij tlačítko „Vybrat JSON soubory“ a vyber JSON soubory ze SaveGame_*.");
      return;
    }
    try{
      const dir=await window.showDirectoryPicker({mode:"read"});
      const files=await readDirectory(dir);
      if(!files.length){alert("Ve složce nebyly nalezeny JSON save soubory.");return;}
      await processFileList(files);
    }catch(e){if(e?.name!=="AbortError")alert("Save se nepodařilo načíst: "+(e?.message||e));}
  }

  async function processFileList(files){
    const p=analyzeFiles(files);
    p.summary=`Načteno ${files.length} JSON souborů · nalezené kandidátní seedy: ${p.detected_seed_candidates.length} · detekovaná save-specific pravidla: ${p.rule_count} · ProductManager záznamy: ${p.product_record_count}`;
    if(!saveStored(p)){alert("Save data se nepodařilo uložit do localStorage.");return;}
    state.payload=p;renderStatus();
  }

  function renderStatus(){
    const s=document.querySelector("#s1SeededStatus"),r=document.querySelector("#s1SeededRules");
    if(!s||!r)return;
    const p=state.payload;
    if(!p){s.textContent="Žádný save není načten.";r.innerHTML="";return;}
    const seeds=(p.detected_seed_candidates||[]).map(x=>esc(x.value)).slice(0,8);
    s.innerHTML=esc(p.summary||"Save načten.")+`<br><span class="meta">Seed kandidáti: ${seeds.length?seeds.join(", "):"nenalezeny"}</span>`;
    const rules=(p.detected_rules||[]).slice(0,30);
    r.innerHTML=rules.map(x=>`<div class="s1-new-item"><b>${esc(x.ingredient)}</b> · ${esc(x.from)} → ${esc(x.to)}<div class="meta">${esc((x.path||[]).join(" / "))}</div></div>`).join("") || '<div class="s1-new-item">Žádné pravidlo nebylo z uložených JSON dat bezpečně rozpoznáno. Standardní pravidla se proto nepřepisují.</div>';
  }

  window.__s1SeededMixing={
    getState:()=>state.payload,
    getRule:(ingredient,from)=>{
      const p=state.payload;if(!p)return null;
      return (p.detected_rules||[]).find(x=>norm(x.ingredient)===norm(ingredient)&&norm(x.from)===norm(from))||null;
    },
    clear:()=>{localStorage.removeItem(STORE);state.payload=null;renderStatus();}
  };

  function init(){
    const observer=new MutationObserver(()=>ui());
    observer.observe(document.body,{childList:true,subtree:true});
    ui();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();