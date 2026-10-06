const S1_SEEDED_SOURCE_KEY="s1-seeded-runtime-source-v1";

function s1SeededReadJson(file){
  return new Promise((resolve,reject)=>{
    const rd=new FileReader();
    rd.onload=()=>{try{resolve(JSON.parse(String(rd.result)))}catch(e){reject(e)}};
    rd.onerror=()=>reject(rd.error||new Error("read error"));
    rd.readAsText(file);
  });
}

function s1SeededNormalize(snapshot){
  const out={version:1,source:snapshot?.source||"import",seed:Number.isInteger(snapshot?.seed)?snapshot.seed:null,rules:[]};
  const push=(x)=>{
    const ingredient=x?.ingredient||x?.ingredientName||x?.ingredient_name;
    const from=x?.from||x?.source||x?.before||x?.effectBefore||x?.effect_before;
    const to=x?.to||x?.target||x?.after||x?.effectAfter||x?.effect_after;
    if(ingredient&&from&&to)out.rules.push({
      drug:x?.drug||x?.drugType||x?.drug_type||null,
      ingredient:String(ingredient).trim(),
      from:String(from).trim(),
      to:String(to).trim()
    });
  };
  if(Array.isArray(snapshot?.rules)){
    snapshot.rules.forEach(push);
  }else if(snapshot?.rules&&typeof snapshot.rules==="object"){
    for(const [ingredient,table] of Object.entries(snapshot.rules)){
      if(!table||typeof table!=="object")continue;
      for(const [from,to] of Object.entries(table))push({ingredient,from,to});
    }
  }
  if(Array.isArray(snapshot?.transformations))snapshot.transformations.forEach(push);
  const seen=new Set();
  out.rules=out.rules.filter(r=>{
    const k=[r.drug||"",r.ingredient,r.from,r.to].join("::");
    if(seen.has(k))return false;
    seen.add(k);return true;
  });
  return out;
}

function s1SeededSaveScan(value,found,path="save"){
  if(!value||typeof value!=="object")return;
  if(Array.isArray(value)){
    value.forEach((x,i)=>s1SeededSaveScan(x,found,path+"["+i+"]"));
    return;
  }
  for(const [key,val] of Object.entries(value)){
    const k=String(key).toLowerCase();
    if(found.seed==null && /^(seed|gameseed|save_seed)$/.test(k) && Number.isInteger(val))found.seed=val;
    if(val&&typeof val==="object")s1SeededSaveScan(val,found,path+"."+key);
  }
  const rules=value.rules||value.seededRules||value.seededMixingRules||value.transformations;
  if(rules&&typeof rules==="object"){
    const snap=s1SeededNormalize({rules});
    for(const r of snap.rules)found.rules.push({...r,path});
  }
  const ingredient=value.ingredient||value.ingredientName||value.ingredient_name;
  const from=value.from||value.source||value.before||value.effectBefore||value.effect_before;
  const to=value.to||value.target||value.after||value.effectAfter||value.effect_after;
  if(ingredient&&from&&to)found.rules.push({ingredient,from,to,drug:value.drug||value.drugType||value.drug_type||null,path});
}

function s1SeededInject(){
  const panel=document.querySelector("#s1SeededPanel");
  if(!panel||document.querySelector("#s1SeededBridge"))return;

  const box=document.createElement("div");
  box.id="s1SeededBridge";
  box.className="s1-seeded-bridge";
  box.innerHTML="<div class='s1-panel-title'>Automatické načtení konkrétního save</div><p class='s1-seeded-bridge-note'>Helper načte skutečný Seed a všechna seeded pravidla, která jsou v save uložená. Pro kompletní přesnou tabulku, kterou si hra drží v runtime, použij export z Helper Bridge.</p><div class='s1-seeded-bridge-actions'><button class='btn' id='s1LoadSaveFolder' type='button'>Načíst save složku</button><button class='btn ghost' id='s1LoadRuntime' type='button'>Načíst runtime export</button><input id='s1SaveFiles' type='file' hidden multiple accept='application/json,.json' webkitdirectory directory><input id='s1RuntimeFile' type='file' hidden accept='application/json,.json'></div><div id='s1SeededBridgeStatus' class='s1-seeded-bridge-status'>Zatím nebyl načten konkrétní save.</div>";
  panel.appendChild(box);

  const status=document.querySelector("#s1SeededBridgeStatus");

  document.querySelector("#s1LoadSaveFolder").onclick=()=>{
    document.querySelector("#s1SaveFiles").click();
  };

  document.querySelector("#s1LoadRuntime").onclick=()=>{
    document.querySelector("#s1RuntimeFile").click();
  };

  document.querySelector("#s1RuntimeFile").onchange=async e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    try{
      const raw=await s1SeededReadJson(file);
      const snap=s1SeededNormalize(raw);
      if(!snap.rules.length)throw new Error("Runtime export neobsahuje žádná seeded pravidla.");
      localStorage.setItem(S1_SEEDED_SOURCE_KEY,JSON.stringify({source:snap.source,seed:snap.seed,count:snap.rules.length}));
      window.__s1SeededBridge?.applySnapshot(snap);
      status.textContent="Runtime snapshot načten: seed "+(snap.seed??"—")+" · "+snap.rules.length+" pravidel · "+snap.source;
    }catch(err){
      status.textContent="Runtime export nelze načíst: "+(err.message||err);
    }
    e.target.value="";
  };

  document.querySelector("#s1SaveFiles").onchange=async e=>{
    const files=[...(e.target.files||[])].filter(f=>/\.json$/i.test(f.name)).slice(0,1000);
    const found={seed:null,rules:[]};
    for(const file of files){
      try{
        const raw=await s1SeededReadJson(file);
        s1SeededSaveScan(raw,found,file.webkitRelativePath||file.name);
      }catch{}
    }
    const snap=s1SeededNormalize({source:"save-import",seed:found.seed,rules:found.rules});
    localStorage.setItem("s1-seeded-save-seed-v1",found.seed==null?"":String(found.seed));

    if(snap.rules.length){
      localStorage.setItem(S1_SEEDED_SOURCE_KEY,JSON.stringify({source:"save-import",seed:found.seed,count:snap.rules.length}));
      window.__s1SeededBridge?.applySnapshot(snap);
      status.textContent="Save analyzován: seed "+(found.seed??"—")+" · "+snap.rules.length+" uložených seeded pravidel.";
    }else if(found.seed!=null){
      window.__s1SeededBridge?.setSeed?.(found.seed);
      status.textContent="Save obsahuje Seed "+found.seed+". Samotný Seed není bezpečný podklad pro dopočtení pravidel, proto Helper nic nevymýšlí. Pro úplný runtime snapshot použij Helper Bridge.";
    }else{
      status.textContent="Ve vybraných JSON souborech nebyl nalezen Seed ani seeded pravidla.";
    }
    e.target.value="";
  };
}

function s1SeededBoot(){
  s1SeededInject();
  const styleId="s1-seeded-bridge-style";
  if(document.querySelector("#"+styleId))return;
  const style=document.createElement("style");
  style.id=styleId;
  style.textContent=".s1-seeded-bridge{border-top:1px solid var(--border);margin-top:10px;padding-top:10px}.s1-seeded-bridge-note{margin:4px 0 8px;color:var(--muted);font-size:9px;line-height:1.45}.s1-seeded-bridge-actions{display:flex;gap:7px;flex-wrap:wrap}.s1-seeded-bridge-status{margin-top:8px;border:1px solid var(--border);border-radius:9px;background:var(--panel);padding:8px;color:var(--muted);font-size:9px;line-height:1.4}";
  document.head.appendChild(style);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",s1SeededBoot,{once:true});else s1SeededBoot();

