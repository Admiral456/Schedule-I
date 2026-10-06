const S1_MIX={rules:null,ingredients:[],drugs:[],effects:[],references:[],byIngredient:new Map(),byEffect:new Map(),ready:false,mode:localStorage.getItem("s1-mix-mode-v1")==="seeded"?"seeded":"standard",seededRules:{}};
const qm=s=>document.querySelector(s); const qms=s=>[...document.querySelectorAll(s)];
const em=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const ALIASES={viagra:'Viagor'};
function canon(v){const x=String(v||'').trim();return ALIASES[nm(x)]||x;}
function ingByName(v){return S1_MIX.byIngredient.get(nm(canon(v)));}
function ruleMapFor(ingredient){
  const key=nm(canon(ingredient));
  const standard=ingByName(ingredient)?.rules||{};
  return S1_MIX.mode==="seeded" ? (S1_MIX.seededRules[key]||{}) : standard;
}
function seededRuleCount(){return Object.values(S1_MIX.seededRules).reduce((n,m)=>n+Object.keys(m||{}).length,0);}
function persistSeededRules(){localStorage.setItem("s1-seeded-rules-v1",JSON.stringify(S1_MIX.seededRules));}
function loadSeededRules(){try{const x=JSON.parse(localStorage.getItem("s1-seeded-rules-v1")||"{}");if(x&&typeof x==="object")S1_MIX.seededRules=x;}catch{S1_MIX.seededRules={};}}
function effMult(v){const x=S1_MIX.byEffect.get(nm(v));return Number(x&&x.price_multiplier)||0;}
function ingIcon(v){const x=ingByName(v);return x&&x.icon?(x.icon.secondary_source_asset_url||x.icon.rendered_asset_url||x.icon.asset_url||x.icon_url||''):'';}
function drugIcon(v){const x=S1_MIX.drugs.find(d=>nm(d.name)===nm(v));return x&&x.icon_url||'';}
function money(v){return '$'+Math.round(Number(v)||0);}
function uniq(a){return [...new Set(a)];}
function applyIngredient(effects,ingredient,unknowns){
  const rule=ingByName(ingredient); if(!rule)return [...new Set(effects)];
  const original=[...new Set(effects)], originalSet=new Set(original), standard=rule.rules||{}, rules=ruleMapFor(ingredient);
  let current=[...original], blocked=[];
  if(S1_MIX.mode==="seeded"){
    for(const source of original){
      if(standard[source]&&!Object.prototype.hasOwnProperty.call(rules,source)&&Array.isArray(unknowns))unknowns.push(rule.name+" · "+source+" → ?");
    }
  }
  for(const source of original){
    const target=rules[source]; if(!target)continue;
    if(originalSet.has(target)) blocked.push([source,target]);
    else {
      const i=current.indexOf(source); if(i>=0)current.splice(i,1);
      if(!current.includes(target))current.push(target);
    }
  }
  for(const pair of blocked){
    const source=pair[0], target=pair[1];
    if(!current.includes(source)||current.includes(target))continue;
    const i=current.indexOf(source); if(i>=0)current.splice(i,1);
    if(!current.includes(target))current.push(target);
  }
  const baseEffect=rule.base_effect;
  if(baseEffect&&!current.includes(baseEffect)&&current.length<8)current.push(baseEffect);
  return [...new Set(current)].slice(0,8);
}
function calculateMix(baseName,sequence){
  const base=S1_MIX.drugs.find(d=>nm(d.name)===nm(baseName))||S1_MIX.drugs[0]; let effects=uniq(Array.isArray(base&&base.base_effects)?base.base_effects:[]),cost=0,steps=[],unknownTransformations=[];
  for(const raw of sequence||[]){const name=canon(raw),ing=ingByName(name);if(!ing)continue;const before=[...effects];effects=applyIngredient(effects,name,unknownTransformations);cost+=Number(ing.cost)||0;steps.push({name,before,effects:[...effects],cost:Number(ing.cost)||0});}
  const mult=effects.reduce((a,e)=>a+effMult(e),0), value=Math.round((Number(base&&base.base_price)||0)*(1+mult));
  return {base:base&&base.name||baseName,effects,sequence:steps.map(x=>x.name),cost,value,profit:value-cost,asking:Math.round(value*1.4),multiplier:mult,steps,unknownTransformations:uniq(unknownTransformations),uncertain:S1_MIX.mode==="seeded"&&unknownTransformations.length>0,mode:S1_MIX.mode};
}
function score(r,desired,avoid){const have=r.effects.map(nm),want=desired.map(nm),bad=avoid.map(nm),got=want.filter(x=>have.includes(x)).length,badn=bad.filter(x=>have.includes(x)).length;return got*100000-badn*100000+r.value*10-r.cost-r.sequence.length*2;}
function reverseSearch(baseName,desired,avoid,maxSteps){
  desired=uniq((desired||[]).filter(Boolean));avoid=uniq((avoid||[]).filter(Boolean));let states=[calculateMix(baseName,[])];const solutions=[],seenSol=new Set();
  for(let depth=0;depth<=maxSteps;depth++){
    for(const s of states){const h=new Set(s.effects.map(nm));if(desired.every(x=>h.has(nm(x)))&&!avoid.some(x=>h.has(nm(x)))){const k=s.sequence.join('|')+'::'+s.effects.slice().sort().join(',');if(!seenSol.has(k)){seenSol.add(k);solutions.push(s);}}}
    if(depth===maxSteps)break;
    const byState=new Map();
    for(const s of states)for(const ing of S1_MIX.ingredients){const r=calculateMix(baseName,[...s.sequence,ing.name]);const k=r.effects.slice().sort().join('|');const p=byState.get(k);if(!p||score(r,desired,avoid)>score(p,desired,avoid))byState.set(k,r);}
    states=[...byState.values()].sort((a,b)=>score(b,desired,avoid)-score(a,desired,avoid)).slice(0,1800);
  }
  return solutions.sort((a,b)=>score(b,desired,avoid)-score(a,desired,avoid)||b.profit-a.profit||a.sequence.length-b.sequence.length).slice(0,8);
}
function resHTML(r,buttons){
  const baseImg=drugIcon(r.base), steps=r.sequence.map((x,i)=>{const src=ingIcon(x);return '<span class="s1-step"><b>'+String(i+1)+'</b>'+(src?'<img src="'+em(src)+'" alt="">':'')+'<span>'+em(x)+'</span></span>';}).join('');
  const effects=r.effects.map(e=>'<span class="s1-effect-out">'+em(e)+' <small>'+Math.round(effMult(e)*100)+'%</small></span>').join('');
  const warning=r.uncertain?'<div class="s1-seeded-warning"><b>Seeded výsledek je neúplný.</b><span>Neznámá save-specific pravidla: '+em(r.unknownTransformations.join(', '))+'</span></div>':'';
  const data=em(JSON.stringify(r));
  return '<article class="s1-mix-result"><div class="s1-result-head"><div class="s1-result-base">'+(baseImg?'<img src="'+em(baseImg)+'" alt="">':'')+'<div><b>'+em(r.base)+'</b><small>'+r.sequence.length+' kroků</small></div></div><div class="s1-result-metrics"><span>Hodnota<b>'+money(r.value)+'</b></span><span>Náklad<b>'+money(r.cost)+'</b></span><span>Profit<b>'+money(r.profit)+'</b></span></div></div><div class="s1-result-title">Postup</div><div class="s1-steps">'+(steps||'<span class="s1-muted">Bez přísady</span>')+'</div><div class="s1-result-title">Efekty</div><div class="s1-effects">'+(effects||'<span class="s1-muted">Žádné</span>')+'</div>'+warning+'<div class="s1-result-foot"><span>Multiplier '+Math.round(r.multiplier*100)+'%</span><span>8-effect cap</span>'+(!buttons?'': '<button class="btn ghost s1-load-mix" type="button" data-mix="'+data+'">Načíst</button><button class="btn ghost s1-save-mix" type="button" data-save-mix="'+data+'">Uložit</button>')+'</div></article>';
}
function renderCalc(){const base=qm('#s1MixBase')&&qm('#s1MixBase').value;const seq=qms('#s1MixSlots select').map(x=>x.value).filter(Boolean);const host=qm('#s1MixCalcResult');if(host&&base)host.innerHTML=resHTML(calculateMix(base,seq),false);}
function loadCalc(r){if(qm('#s1MixBase'))qm('#s1MixBase').value=r.base;if(qm('#s1ReverseBase'))qm('#s1ReverseBase').value=r.base;qms('#s1MixSlots select').forEach((s,i)=>s.value=r.sequence[i]||'');renderCalc();qm('#s1MixTools')&&qm('#s1MixTools').scrollIntoView({behavior:'smooth',block:'start'});}
function targets(id){return qms(id+' input:checked').map(x=>x.value);}
function runReverse(){const base=qm('#s1MixBase').value||S1_MIX.drugs[0].name,max=Math.max(0,Math.min(12,Number(qm('#s1MixMax').value)||12)),wanted=targets('#s1DesiredEffects'),avoid=targets('#s1AvoidEffects'),host=qm('#s1ReverseResults');host.innerHTML='<div class="s1-mix-loading">Počítám…</div>';setTimeout(()=>{const f=reverseSearch(base,wanted,avoid,max);host.innerHTML=f.length?f.map(x=>resHTML(x,true)).join(''):'<div class="s1-mix-empty">Nenalezen mix do '+max+' kroků.</div>';bindMixButtons();},20);}
function bindMixButtons(){qms('.s1-load-mix').forEach(b=>b.onclick=()=>{try{loadCalc(JSON.parse(b.dataset.mix))}catch{}});qms('.s1-save-mix').forEach(b=>b.onclick=()=>{try{const r=JSON.parse(b.dataset.saveMix),x=JSON.parse(localStorage.getItem('schedule1-helper-saved-v2')||'{}');x.recipes=Array.isArray(x.recipes)?x.recipes:[];x.recipes.unshift({key:'recipe:generated:'+Date.now(),name:r.base+' — generated mix',note:r.sequence.join(' → ')+' · '+r.effects.join(', ')+' · profit '+money(r.profit)});localStorage.setItem('schedule1-helper-saved-v2',JSON.stringify(x));document.dispatchEvent(new CustomEvent('s1-saved-updated'));b.textContent='Uloženo';}catch{b.textContent='Chyba';}});}
function effectChip(e,disabled){return '<label class="s1-effect-chip'+(disabled?' is-disabled':'')+'"><input type="checkbox" value="'+em(e)+'"'+(disabled?' disabled':'')+'><span>'+em(e)+'</span></label>';}

function renderSeededNotebook(){
  const count=qm("#s1SeededCount"),list=qm("#s1SeededRules");
  if(count)count.textContent=seededRuleCount()+" zaznamenaných pravidel";
  if(!list)return;
  const rows=[];
  for(const ingredient of S1_MIX.ingredients){
    const rules=S1_MIX.seededRules[nm(ingredient.name)]||{};
    for(const [from,to] of Object.entries(rules))rows.push('<div class="s1-seeded-rule"><span>'+em(ingredient.name)+'</span><b>'+em(from)+'</b><i>→</i><span>'+em(to)+'</span><button class="btn ghost danger" type="button" data-seeded-delete="'+em(ingredient.name)+'::'+em(from)+'">×</button></div>');
  }
  list.innerHTML=rows.join("")||'<div class="s1-muted">Zatím nemáš zaznamenané žádné save-specific pravidlo.</div>';
  qms("[data-seeded-delete]").forEach(b=>b.onclick=()=>{
    const [ingredient,source]=b.dataset.seededDelete.split("::");
    const key=nm(canon(ingredient));
    if(S1_MIX.seededRules[key])delete S1_MIX.seededRules[key][source];
    persistSeededRules();renderSeededNotebook();renderCalc();
  });
}
function addSeededRule(){
  const ingredient=qm("#s1SeededIngredient")?.value,source=qm("#s1SeededSource")?.value,target=qm("#s1SeededTarget")?.value;
  if(!ingredient||!source||!target)return;
  const key=nm(canon(ingredient));
  S1_MIX.seededRules[key]=S1_MIX.seededRules[key]||{};
  S1_MIX.seededRules[key][source]=target;
  persistSeededRules();renderSeededNotebook();renderCalc();
}
function setMixMode(mode){
  S1_MIX.mode=mode==="seeded"?"seeded":"standard";
  localStorage.setItem("s1-mix-mode-v1",S1_MIX.mode);
  const picker=qm("#s1SeededMode");if(picker)picker.value=S1_MIX.mode;
  const reverse=qm("#s1RunReverse");
  if(reverse){
    reverse.disabled=S1_MIX.mode==="seeded";
    reverse.title=S1_MIX.mode==="seeded"?"Reverse Finder je v Seeded režimu vypnutý, protože neznáme celý save-specific rule set.":"";
  }
  renderSeededNotebook();renderCalc();
}
function exportSeededRules(){
  const blob=new Blob([JSON.stringify({version:1,mode:"seeded",rules:S1_MIX.seededRules},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="schedule-1-seeded-rules.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function importSeededRules(file){
  const rd=new FileReader();
  rd.onload=()=>{try{
    const p=JSON.parse(rd.result);if(!p||typeof p.rules!=="object")throw new Error("invalid");
    S1_MIX.seededRules=p.rules||{};persistSeededRules();setMixMode("seeded");renderSeededNotebook();
  }catch{alert("Soubor seeded pravidel není platný JSON export.");}};
  rd.readAsText(file);
}

function setupUI(){const v=qm('#view-recipes');if(!v||qm('#s1MixTools'))return;const bases=S1_MIX.drugs.map(d=>'<option value="'+em(d.name)+'">'+em(d.name)+'</option>').join(''),opts='<option value="">— prázdný slot —</option>'+S1_MIX.ingredients.map(i=>'<option value="'+em(i.name)+'">'+em(i.name)+' · $'+em(i.cost)+'</option>').join(''),slots=Array.from({length:8},(_,i)=>'<label class="s1-slot"><span>'+(i+1)+'</span><select>'+opts+'</select></label>').join(''),fx=S1_MIX.effects.map(e=>effectChip(e.name,e.name==='Lethal')).join('');
 const w=document.createElement('section');w.id='s1MixTools';w.className='s1-mix-tools';w.innerHTML='<div class="s1-mix-tools-head"><div><div class="label">Mix engine</div><h3>Kalkulačka + Reverse Finder</h3><p>16 ingrediencí, pořadí, transformace, 8-effect cap, cena, hodnota a profit.</p></div><span class="s1-mix-source-badge">16 ingrediencí · 35 efektů · 7 základů</span></div><div class="s1-mix-calculator"><div class="s1-panel-title">Ruční kalkulačka</div><div class="s1-mix-base-row"><label><span>Základ</span><select id="s1MixBase">'+bases+'</select></label><span class="s1-mini-note">Opakování ingrediencí je povoleno.</span></div><div id="s1MixSlots" class="s1-slots">'+slots+'</div><div id="s1MixCalcResult"></div></div><div class="s1-mix-reverse"><div class="s1-panel-title">Reverse Finder</div><div class="s1-target-title">Požadované nebo nechtěné efekty</div><div id="s1DesiredEffects" class="s1-effects-picker">'+fx+'</div><div class="s1-mini-note">Zaškrtni efekty, které chceš. Druhý seznam se aktivuje jako zakázané efekty.</div><div id="s1AvoidEffects" class="s1-effects-picker">'+S1_MIX.effects.filter(e=>e.name!=='Lethal').map(e=>effectChip(e.name,false)).join('')+'</div><div class="s1-reverse-controls"><label><span>Produkt</span><select id="s1ReverseBase">'+bases+'</select></label><label><span>Max. kroků</span><input id="s1MixMax" type="number" min="0" max="12" value="12"></label><button class="btn primary" id="s1RunReverse" type="button">Najít nejlepší mixy</button></div><div id="s1ReverseResults"></div></div><div class="s1-reference"><div class="s1-panel-title">Zdrojové referenční mixy</div><div class="s1-mini-note">Veřejné best-mix příklady ze Schedule1.dev; tlačítkem je můžeš načíst do kalkulačky.</div><div id="s1ReferenceList" class="s1-reference-list"></div></div>';

 const seeded=document.createElement("section");
 seeded.id="s1SeededPanel";seeded.className="s1-seeded-panel";
 const effectOptions=S1_MIX.effects.map(e=>"<option value=\""+em(e.name)+"\">"+em(e.name)+"</option>").join("");
 const ingredientOptions=S1_MIX.ingredients.map(i=>"<option value=\""+em(i.name)+"\">"+em(i.name)+"</option>").join("");
 seeded.innerHTML="<div class=\"s1-seeded-head\"><div><div class=\"s1-panel-title\">Seeded Mixing notebook</div><p>Seeded Mixing generuje pravidla pro konkrétní save. Tady zapisuješ pravidla, která jsi skutečně pozoroval ve hře; neznámá pravidla Helper označí místo toho, aby si je vymyslel.</p></div><label><span>Režim</span><select id=\"s1SeededMode\"><option value=\"standard\">Standardní pravidla</option><option value=\"seeded\">Seeded save</option></select></label></div><div class=\"s1-seeded-actions\"><label><span>Ingredience</span><select id=\"s1SeededIngredient\">"+ingredientOptions+"</select></label><label><span>Efekt před</span><select id=\"s1SeededSource\">"+effectOptions+"</select></label><label><span>Efekt po</span><select id=\"s1SeededTarget\">"+effectOptions+"</select></label><button class=\"btn primary\" id=\"s1AddSeededRule\" type=\"button\">Zapsat pravidlo</button></div><div class=\"s1-seeded-tools\"><span id=\"s1SeededCount\">0 zaznamenaných pravidel</span><button class=\"btn ghost\" id=\"s1ExportSeeded\" type=\"button\">Export</button><button class=\"btn ghost\" id=\"s1ImportSeeded\" type=\"button\">Import</button><input id=\"s1ImportSeededFile\" type=\"file\" accept=\"application/json,.json\" hidden></div><div id=\"s1SeededRules\" class=\"s1-seeded-rules\"></div>";
 w.insertAdjacentElement("afterbegin",seeded);

 const tb=v.querySelector('.toolbar');if(tb)tb.insertAdjacentElement('afterend',w);
 qm('#s1SeededMode').value=S1_MIX.mode;
 qm('#s1SeededMode').addEventListener('change',e=>setMixMode(e.target.value));
 qm('#s1AddSeededRule').addEventListener('click',addSeededRule);
 qm('#s1ExportSeeded').addEventListener('click',exportSeededRules);
 qm('#s1ImportSeeded').addEventListener('click',()=>qm('#s1ImportSeededFile').click());
 qm('#s1ImportSeededFile').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importSeededRules(file);e.target.value="";});
 qm('#s1MixBase').addEventListener('change',e=>{qm('#s1ReverseBase').value=e.target.value;renderCalc()});qm('#s1ReverseBase').addEventListener('change',e=>{qm('#s1MixBase').value=e.target.value;renderCalc()});qm('#s1MixSlots').addEventListener('change',renderCalc);qm('#s1RunReverse').addEventListener('click',runReverse);
 renderSeededNotebook();qm('#s1MixMax').addEventListener('change',e=>e.target.value=Math.max(0,Math.min(12,Number(e.target.value)||12)));renderCalc();renderRefs();
}
function renderRefs(){const h=qm('#s1ReferenceList');if(!h)return;h.innerHTML=S1_MIX.references.map(r=>'<button class="s1-reference-row" type="button" data-ref="'+em(JSON.stringify({base:r.base_product,sequence:r.ingredients}))+'"><span><b>'+em(r.name)+'</b><small>'+em(r.base_product)+' · source profit '+money(r.source_profit)+'</small></span><span>'+em(r.ingredients.join(' → '))+'</span><b>→</b></button>').join('');qms('[data-ref]').forEach(b=>b.onclick=()=>{try{const r=JSON.parse(b.dataset.ref);loadCalc(r)}catch{}})}
function css(){if(qm('#s1-mix-style'))return;const s=document.createElement('style');s.id='s1-mix-style';s.textContent='#s1MixTools{margin:0 12px 14px;border:1px solid var(--border);border-radius:15px;background:var(--panel);padding:14px}.s1-mix-tools-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.s1-mix-tools-head h3{margin:3px 0 5px}.s1-mix-tools-head p{margin:0;color:var(--muted);font-size:10px}.s1-mix-source-badge{font-size:9px;border:1px solid var(--border);border-radius:999px;padding:6px 8px;color:var(--muted)}.s1-mix-calculator,.s1-mix-reverse,.s1-reference{border-top:1px solid var(--border);margin-top:14px;padding-top:14px}.s1-panel-title{font-size:12px;font-weight:850;margin-bottom:8px}.s1-mix-base-row,.s1-reverse-controls{display:flex;gap:9px;align-items:end;flex-wrap:wrap}.s1-mix-base-row label,.s1-reverse-controls label{display:grid;gap:4px;min-width:190px}.s1-mix-base-row label span,.s1-reverse-controls label span{font-size:9px;color:var(--muted)}.s1-mix-base-row select,.s1-reverse-controls select,.s1-reverse-controls input,.s1-slot select{background:var(--panel2);color:var(--text);border:1px solid var(--border);border-radius:9px;padding:8px;font-size:10px}.s1-slots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}.s1-slot{display:grid;grid-template-columns:18px 1fr;gap:4px;align-items:center}.s1-slot>span{font-size:9px;color:var(--muted);text-align:center}.s1-effects-picker{display:flex;flex-wrap:wrap;gap:5px;max-height:130px;overflow:auto;padding:7px;border:1px solid var(--border);border-radius:10px;background:var(--panel2);margin-bottom:7px}.s1-effect-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:999px;padding:4px 7px;font-size:9px;color:var(--muted);cursor:pointer}.s1-effect-chip input{margin:0}.s1-effect-chip.is-disabled{opacity:.45}.s1-reverse-controls{margin-top:9px}.s1-mix-loading,.s1-mix-empty{border:1px dashed var(--border);padding:12px;border-radius:9px;color:var(--muted);font-size:10px;margin-top:8px}.s1-mix-result{border:1px solid var(--border);background:var(--panel2);border-radius:12px;padding:10px;margin-top:8px}.s1-result-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.s1-result-base{display:flex;align-items:center;gap:8px}.s1-result-base img{width:34px;height:34px;object-fit:contain}.s1-result-base small{display:block;color:var(--muted);font-size:8px}.s1-result-metrics{display:flex;gap:8px;flex-wrap:wrap;font-size:8px;color:var(--muted)}.s1-result-metrics b{display:block;color:var(--text);font-size:12px}.s1-result-title{font-size:9px;color:var(--muted);margin-top:8px;margin-bottom:4px}.s1-steps,.s1-effects{display:flex;flex-wrap:wrap;gap:5px}.s1-step{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:7px;padding:4px 6px;font-size:9px}.s1-step img{width:18px;height:18px;object-fit:contain}.s1-step b{font-size:8px;color:var(--muted)}.s1-effect-out{border:1px solid var(--border);border-radius:999px;padding:4px 7px;font-size:9px}.s1-effect-out small{color:var(--muted)}.s1-result-foot{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:8px;color:var(--muted);font-size:8px}.s1-result-foot .btn{margin-left:0}.s1-reference-list{display:grid;gap:5px}.s1-reference-row{display:grid;grid-template-columns:.8fr 2fr 20px;gap:8px;align-items:center;text-align:left;border:1px solid var(--border);background:var(--panel2);color:var(--text);border-radius:9px;padding:7px 9px}.s1-reference-row b{font-size:10px}.s1-reference-row small{display:block;color:var(--muted);font-size:8px;margin-top:2px}.s1-reference-row span:nth-child(2){font-size:8px;color:var(--muted)} .s1-seeded-panel{border:1px solid var(--border);background:var(--panel2);border-radius:12px;padding:10px;margin-bottom:14px}.s1-seeded-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.s1-seeded-head p{margin:4px 0 0;color:var(--muted);font-size:9px;line-height:1.45;max-width:760px}.s1-seeded-head label,.s1-seeded-actions label{display:grid;gap:4px;min-width:150px}.s1-seeded-head label span,.s1-seeded-actions label span{font-size:8px;color:var(--muted)}.s1-seeded-head select,.s1-seeded-actions select{background:var(--panel);color:var(--text);border:1px solid var(--border);border-radius:9px;padding:8px;font-size:10px}.s1-seeded-actions{display:flex;gap:7px;align-items:end;flex-wrap:wrap;margin-top:9px}.s1-seeded-tools{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:8px;color:var(--muted);font-size:8px}.s1-seeded-rules{display:grid;gap:4px;margin-top:8px;max-height:180px;overflow:auto}.s1-seeded-rule{display:grid;grid-template-columns:1fr 1fr 18px 1fr auto;gap:6px;align-items:center;border:1px solid var(--border);background:var(--panel);border-radius:8px;padding:5px 7px;font-size:8px}.s1-seeded-rule b{font-size:8px}.s1-seeded-rule i{font-style:normal;color:var(--muted);text-align:center}.s1-seeded-rule .btn{padding:4px 7px;margin:0}.s1-seeded-warning{margin-top:8px;border:1px solid rgba(216,180,99,.3);background:rgba(216,180,99,.06);border-radius:9px;padding:8px;display:grid;gap:2px;color:#d9c58a;font-size:8px}.s1-seeded-warning b{font-size:9px}.s1-seeded-warning span{line-height:1.4} @media(max-width:850px){.s1-slots{grid-template-columns:repeat(2,minmax(0,1fr))}.s1-mix-tools-head{flex-direction:column}.s1-reference-row{grid-template-columns:1fr}.s1-reference-row span:nth-child(2){display:none}}@media(max-width:560px){.s1-seeded-head{flex-direction:column}.s1-seeded-head label,.s1-seeded-actions label{min-width:100%}.s1-seeded-actions .btn{width:100%}.s1-seeded-rule{grid-template-columns:1fr 1fr 14px 1fr auto}#s1MixTools{margin-left:4px;margin-right:4px;padding:10px}.s1-slots{grid-template-columns:1fr}.s1-mix-base-row label,.s1-reverse-controls label{min-width:100%}.s1-reverse-controls .btn{width:100%}.s1-result-head{align-items:flex-start;flex-direction:column}}';document.head.appendChild(s)}
async function loadMix(){try{const a=await Promise.all([fetch('./data/mixing-rules.json?ts='+Date.now()).then(r=>r.json()),fetch('./data/drugs.json?ts='+Date.now()).then(r=>r.json()),fetch('./data/effects.json?ts='+Date.now()).then(r=>r.json()),fetch('./data/reference-recipes.json?ts='+Date.now()).then(r=>r.json())]);S1_MIX.rules=a[0];S1_MIX.ingredients=a[0].ingredients||[];S1_MIX.drugs=a[1].drugs||[];S1_MIX.effects=a[2].effects||[];S1_MIX.references=a[3].recipes||[];loadSeededRules();S1_MIX.byIngredient=new Map(S1_MIX.ingredients.map(x=>[nm(x.name),x]));S1_MIX.byEffect=new Map(S1_MIX.effects.map(x=>[nm(x.name),x]));S1_MIX.ready=true;window.__s1MixEngine={calculateMix,reverseSearch,loadCalc};css();setupUI();document.dispatchEvent(new CustomEvent('s1-mix-ready'));}catch(e){console.error('Mix engine load failed',e)}}
window.__s1SeededBridge={
  setSeed(seed){
    localStorage.setItem("s1-seeded-save-seed-v1",String(seed));
  },
  applySnapshot(snapshot){
    const next={};
    const add=(ingredient,from,to)=>{
      if(!ingredient||!from||!to)return;
      const i=nm(canon(ingredient));
      if(!next[i])next[i]={};
      next[i][String(from).trim()]=String(to).trim();
    };
    if(Array.isArray(snapshot?.rules)){
      snapshot.rules.forEach(x=>add(
        x.ingredient||x.ingredient_name,
        x.from||x.source||x.before||x.effectBefore||x.effect_before,
        x.to||x.target||x.after||x.effectAfter||x.effect_after
      ));
    }else if(snapshot?.rules&&typeof snapshot.rules==="object"){
      for(const [ingredient,table] of Object.entries(snapshot.rules)){
        if(!table||typeof table!=="object")continue;
        for(const [from,to] of Object.entries(table))add(ingredient,from,to);
      }
    }
    S1_MIX.seededRules=next;
    persistSeededRules();
    localStorage.setItem(
      "s1-seeded-runtime-source-v1",
      JSON.stringify({
        version:1,
        source:snapshot?.source||"runtime-import",
        seed:Number.isInteger(snapshot?.seed)?snapshot.seed:null,
        ruleCount:Object.values(next).reduce((n,x)=>n+Object.keys(x).length,0)
      })
    );
    setMixMode("seeded");
    renderSeededNotebook();
    renderCalc();
  }
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadMix,{once:true});else loadMix();