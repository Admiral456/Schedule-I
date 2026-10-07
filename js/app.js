const state={customers:[],recipes:[],effects:[],portraitRegistry:new Map(),customerSchedules:new Map(),selectedCustomer:null,savedTab:"recipes",saved:{recipes:[],customers:[],employees:[],rooms:[],other:[]},pendingImage:null,profile:{displayName:""},settings:{density:"normal",defaultTab:"home",autoSave:true}};
const $=s=>document.querySelector(s);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const savedKey="schedule1-helper-saved-v2",profileKey="schedule1-helper-profile-v1",settingsKey="schedule1-helper-settings-v1",shareKey="schedule1-helper-share-v1";
const customerMapVerified=c=>c?.map_position?.status==="verified-source-map-coordinate"||c?.map_position?.status==="verified-external-pin";const searchNorm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();const mapCategories=[{"name":"ATM","count":16},{"name":"Recycler","count":13},{"name":"Telephone Booth","count":19},{"name":"Vending Machine","count":12},{"name":"Dead Drop","count":25},{"name":"Area / Location","count":40},{"name":"Stash","count":3},{"name":"RV","count":1},{"name":"Purchasable Area","count":5},{"name":"Main Mission","count":16},{"name":"Post Office","count":1},{"name":"Laundromat","count":1},{"name":"Car Wash","count":1},{"name":"Taco Ticklers","count":1},{"name":"Bleuball's Boutique","count":1},{"name":"Barbershop","count":1},{"name":"Casino","count":1},{"name":"Hardware","count":2},{"name":"Gas Mart","count":2},{"name":"Car Service","count":2},{"name":"Pawn Shop","count":1},{"name":"Ray's Realty","count":1},{"name":"Shred Shack","count":1},{"name":"Thrifty Threads","count":1},{"name":"Top Tattoo","count":1},{"name":"Warehouse","count":1},{"name":"Suppliers","count":6},{"name":"Dealers","count":6},{"name":"Customers","count":62}];
function showTab(name){
  const target=String(name||"").trim();
  if(!target)return;
  document.querySelectorAll("[data-tab]").forEach(b=>{
    const t=b.getAttribute("data-tab");
    b.classList.toggle("active",t===target);
    b.setAttribute("aria-current",t===target?"page":"false");
  });
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+target));
  const active=document.querySelector("#view-"+CSS.escape(target));
  if(active){active.setAttribute("tabindex","-1");active.focus({preventScroll:true});}
  window.scrollTo({top:0,behavior:"smooth"});
}

// One navigation controller for every header/footer action. This also handles
// buttons injected later by enhancement modules (Products/Planner/etc.).
document.addEventListener("click",e=>{
  const tab=e.target.closest("[data-tab]");
  if(tab){e.preventDefault();e.stopImmediatePropagation();showTab(tab.dataset.tab);return;}
  const jump=e.target.closest("[data-tab-jump]");
  if(jump){e.preventDefault();e.stopImmediatePropagation();showTab(jump.dataset.tabJump);}
},true);
document.addEventListener("s1-map-open",e=>{const d=e.detail||{};if(d.type==="customer"){state.selectedCustomer=Number(d.id);$("#customerSearch").value=d.name||"";showTab("customers");renderCustomers();return;}if(["dealer","property","business"].includes(d.type)){const kind=d.kind||({dealer:"dealers",property:"properties",business:"businesses"}[d.type]);$("#catalogKind").value=kind;$("#catalogSearch").value=d.name||"";showTab("catalog");$("#catalogSearch").dispatchEvent(new Event("input",{bubbles:true}));}});
$("#customerPinFilter")?.addEventListener("change",renderCustomers);
function searchEverything(raw){
 const value=searchNorm(raw);
 if(!value)return;
 const customers=state.customers||[];
 const catalog=window.__s1Catalog||{};
 const drugs=catalog.drugs||[];
 const ingredients=catalog.ingredients||[];
 const effects=catalog.effects||[];
 const dealers=catalog.dealers||[];
 const properties=catalog.properties||[];
 const businesses=catalog.businesses||[];
 const vehicles=catalog.vehicles||[];
 const productList=window.__s1Products||[];

 const exactCustomer=customers.find(c=>searchNorm(c.name)===value);
 if(exactCustomer){state.selectedCustomer=Number(exactCustomer.id);$("#customerSearch").value=String(raw);showTab("customers");renderCustomers();return;}

 const exactDrug=drugs.find(x=>searchNorm(x.name)===value||searchNorm(x.id)===value);
 if(exactDrug){$("#catalogKind").value="drugs";$("#catalogSearch").value=exactDrug.name;showTab("catalog");$("#catalogSearch").dispatchEvent(new Event("input",{bubbles:true}));return;}

 const exactIngredient=ingredients.find(x=>searchNorm(x.name)===value||searchNorm(x.id)===value);
 if(exactIngredient){$("#catalogKind").value="ingredients";$("#catalogSearch").value=exactIngredient.name;showTab("catalog");$("#catalogSearch").dispatchEvent(new Event("input",{bubbles:true}));return;}

 const exactEffect=effects.find(x=>searchNorm(x.name)===value||searchNorm(x.id)===value);
 if(exactEffect){$("#catalogKind").value="effects";$("#catalogSearch").value=exactEffect.name;showTab("catalog");$("#catalogSearch").dispatchEvent(new Event("input",{bubbles:true}));return;}

 const exactRecipe=state.recipes.find(x=>searchNorm(x.name)===value);
 if(exactRecipe){$("#recipeSearch").value=String(raw);showTab("recipes");renderRecipes();return;}

 const broadCustomer=customers.find(c=>searchNorm([c.name,c.district,c.tier,...(c.preferred_effects||[])].join(" ")).includes(value));
 if(broadCustomer){state.selectedCustomer=Number(broadCustomer.id);$("#customerSearch").value=String(raw);showTab("customers");renderCustomers();return;}

 const broadProduct=productList.find(x=>searchNorm([x.name,x.family,x.base_product,...(x.ingredients||[]),...(x.effects||[])].join(" ")).includes(value));
 if(broadProduct){
   const tab=document.querySelector('.tab[data-tab="products"]');
   showTab("products");
   tab?.classList.add("active");
   const input=$("#productSearch");
   if(input){input.value=String(raw);input.dispatchEvent(new Event("input",{bubbles:true}));}
   return;
 }

 const broadRecipe=state.recipes.find(x=>searchNorm([x.name,x.drug,...(x.ingredients||[]),...(x.effects||[])].join(" ")).includes(value));
 if(broadRecipe){$("#recipeSearch").value=String(raw);showTab("recipes");renderRecipes();return;}

 const catalogGroups=[
   ["drugs",drugs],["ingredients",ingredients],["effects",effects],
   ["dealers",dealers],["properties",properties],["businesses",businesses],["vehicles",vehicles]
 ];
 const hit=catalogGroups.find(([kind,items])=>items.some(x=>searchNorm([x.name,x.family,x.type,x.base_effect,x.location,x.specialty].filter(Boolean).join(" ")).includes(value)));
 if(hit){
   $("#catalogKind").value=hit[0];
   $("#catalogSearch").value=String(raw);
   showTab("catalog");
   $("#catalogSearch").dispatchEvent(new Event("input",{bubbles:true}));
   return;
 }
 $("#recipeSearch").value=String(raw);
 showTab("recipes");
 renderRecipes();
}
$("#homeSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter")searchEverything(e.currentTarget.value);});


function loadLocal(){try{state.saved={recipes:[],customers:[],employees:[],rooms:[],other:[],...JSON.parse(localStorage.getItem(savedKey)||"{}")};}catch{state.saved={recipes:[],customers:[],employees:[],rooms:[],other:[]};}try{state.profile={displayName:"",...JSON.parse(localStorage.getItem(profileKey)||"{}")};}catch{}try{state.settings={density:"normal",defaultTab:"home",autoSave:true,...JSON.parse(localStorage.getItem(settingsKey)||"{}")};}catch{}}
function persistSaved(){localStorage.setItem(savedKey,JSON.stringify(state.saved));}
function persistProfile(){localStorage.setItem(profileKey,JSON.stringify(state.profile));}
function persistSettings(){localStorage.setItem(settingsKey,JSON.stringify(state.settings));}
function saveRecord(type,data){if(!state.saved[type])state.saved[type]=[];if(!state.saved[type].some(x=>x.key===data.key)){state.saved[type].unshift(data);persistSaved();renderSaved();}}
function safeImage(src){return typeof src==="string"&&/^data:image\//i.test(src)?src:"";}
const dayLabels={Monday:"Pondělí",Tuesday:"Úterý",Wednesday:"Středa",Thursday:"Čtvrtek",Friday:"Pátek",Saturday:"Sobota",Sunday:"Neděle"};
function customerSchedule(c){return state.customerSchedules.get(Number(c.id))||null;}
function customerScheduleLabel(c){const s=customerSchedule(c);return s?(dayLabels[s.preferred_day]||s.preferred_day)+" "+s.order_time:"";}
function effectColor(name){const x=state.effects.find(e=>e.name===name);return x?.color||"";}function effectMarkup(name){const c=effectColor(name);return "<span class='effect'"+(c?" style='color:"+esc(c)+";border-color:"+esc(c)+"55":"")+">"+esc(name)+"</span>";}function customerPortrait(c){const p=state.portraitRegistry.get(Number(c.id));return p||{};}
function portraitMarkup(c,variant="card"){const p=customerPortrait(c),local=typeof p.local_path==="string"?p.local_path:"",remote=typeof p.asset_url==="string"?p.asset_url:"",src=local||remote;if(!src)return "";return "<div class='customer-portrait "+variant+"'><img src='"+esc(src)+"' data-customer-portrait data-portrait-fallback='"+esc(remote)+"' alt='' loading='lazy' decoding='async'><span class='portrait-placeholder' aria-hidden='true'>S1</span></div>";}
function bindPortraitFallbacks(){document.querySelectorAll("[data-customer-portrait]").forEach(img=>{if(img.dataset.portraitBound)return;img.dataset.portraitBound="1";img.addEventListener("error",()=>{if(img.dataset.portraitFallbackUsed)return;const fallback=img.dataset.portraitFallback||"";if(fallback&&img.getAttribute("src")!==fallback){img.dataset.portraitFallbackUsed="1";img.src=fallback;return;}img.hidden=true;img.parentElement?.classList.add("portrait-missing");});});}

function verifiedCustomerCount(){return state.customers.filter(customerMapVerified).length;}function renderCategories(){$("#mapCategoryList").innerHTML=mapCategories.map(x=>"<div class='category-row'><span>"+esc(x.name)+"</span><b>"+x.count+"</b></div>").join("");}
async function loadData(){const [c,r,e,p,s,d]=await Promise.all([fetch("./data/customers.json",{cache:"no-store"}).then(x=>x.json()),fetch("./data/recipes.json",{cache:"no-store"}).then(x=>x.json()),fetch("./data/effects.json",{cache:"no-store"}).then(x=>x.json()),fetch("./data/customer-portraits.json",{cache:"no-store"}).then(x=>x.json()).catch(()=>({customers:[]})),fetch("./data/customer-schedules.json",{cache:"no-store"}).then(x=>x.json()).catch(()=>({schedules:[]})),fetch("./data/drugs.json",{cache:"no-store"}).then(x=>x.json()).catch(()=>({drugs:[]}))]);state.customers=Array.isArray(c.customers)?c.customers:[];state.recipes=Array.isArray(r.recipes)?r.recipes:[];state.effects=Array.isArray(e.effects)?e.effects:[];state.portraitRegistry=new Map((Array.isArray(p.customers)?p.customers:[]).map(x=>[Number(x.id),x.portrait||{}]));state.customerSchedules=new Map((Array.isArray(s.schedules)?s.schedules:[]).map(x=>[Number(x.id),x]));const drugSelect=$("#drugFilter");if(drugSelect){const current=drugSelect.value;drugSelect.innerHTML='<option value="">Všechny drogy</option>'+((Array.isArray(d.drugs)?d.drugs:[]).map(x=>"<option value=\""+esc(x.name)+"\">"+esc(x.name)+"</option>").join(""));if([...drugSelect.options].some(o=>o.value===current))drugSelect.value=current;}$("#customerCountBadge").textContent=state.customers.length;const districts=[...new Set(state.customers.map(x=>x.district))].sort();$("#districtFilter").insertAdjacentHTML("beforeend",districts.map(x=>"<option>"+esc(x)+"</option>").join(""));renderCategories();renderCustomers();renderRecipes();applySettings();applyIncomingShare();}

function cMatch(c,q,d,t,day,pinOnly){const s=customerSchedule(c);if(d&&c.district!==d)return false;if(t&&c.tier!==t)return false;if(day&&s?.preferred_day!==day)return false;if(pinOnly&&!customerMapVerified(c))return false;if(!q)return true;return searchNorm([c.name,c.district,c.tier,...(c.preferred_effects||[])].join(" ")).includes(searchNorm(q));}
function renderCustomers(){
  const q=$("#customerSearch").value.trim().toLowerCase(),d=$("#districtFilter").value,t=$("#tierFilter").value,day=$("#customerDayFilter").value,pinOnly=$("#customerPinFilter")?.checked;
  const list=state.customers.filter(c=>cMatch(c,q,d,t,day,pinOnly));
  $("#customerSummary").textContent=list.length+" z "+state.customers.length+" zákazníků zobrazených · 66 má zdrojově ověřený mapový pin; 62 z nich je navíc potvrzených ve Wand";
  $("#customerList").innerHTML=list.map(c=>{
    const sel=c.id===state.selectedCustomer?" selected":"",sched=customerScheduleLabel(c);
    const eff=c.preferred_effects.length?c.preferred_effects.map(e=>effectMarkup(e)).join(""):"<span class='meta'>Bez preferovaného efektu</span>";
    const verified=customerMapVerified(c);
    const mapBadge="<span class='customer-map-badge "+(verified?"verified":"pending")+"'>"+(verified?"PIN Ověřen":"PIN čeká")+"</span>";
    return "<article class='customer-card"+sel+"' data-id='"+c.id+"'>"+portraitMarkup(c,"card")+"<div class='customer-main'><div><div class='customer-name'>"+esc(c.name)+"</div><div class='meta'>"+esc(c.district)+" · "+esc(c.tier)+" · $"+c.budget+" / deal · "+esc(c.orders_per_week)+" / týden"+(sched?" · <span class='customer-schedule'>"+esc(sched)+"</span>":"")+"</div>"+mapBadge+"</div><button class='mini-save' type='button' data-save-customer='"+c.id+"'>Uložit</button></div><div class='effects'>"+eff+"</div></article>";
  }).join("")||"<div class='empty'>Žádný zákazník neodpovídá filtru.</div>";
  document.querySelectorAll(".customer-card").forEach(el=>el.addEventListener("click",e=>{if(e.target.closest("button"))return;state.selectedCustomer=Number(el.dataset.id);renderCustomers();}));
  document.querySelectorAll("[data-save-customer]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();const c=state.customers.find(x=>x.id===Number(b.dataset.saveCustomer));if(c)saveRecord("customers",{key:"customer:"+c.id,name:c.name,note:c.district+" · "+c.tier+" · $"+c.budget});}));
  bindPortraitFallbacks();renderCustomerDetail();
}
function renderCustomerDetail(){
  const c=state.customers.find(x=>x.id===state.selectedCustomer);
  if(!c){$("#customerDetail").innerHTML="<div class='empty'>Vyber zákazníka.</div>";return;}
  const eff=c.preferred_effects.length?c.preferred_effects.map(e=>effectMarkup(e)).join(""):"<span class='meta'>Žádné preference</span>";
  const verified=customerMapVerified(c);
  const mapStatus=verified?(c.map_position?.wand_public_status==="verified-external-pin"?"Ověřený veřejný pin v Wand + PopTracker":"Ověřená přesná pozice z PopTracker"):"Veřejný přesný pin zatím neověřen";
  $("#customerDetail").innerHTML="<div class='label'>Customer profile</div><div class='customer-profile-head'>"+portraitMarkup(c,"detail")+"<div><h3>"+esc(c.name)+"</h3><div class='meta'>"+esc(c.district)+" · "+esc(c.tier)+"</div></div></div><div class='detail-row'><span>Budget / deal</span><b>$"+c.budget+"</b></div><div class='detail-row'><span>Orders / week</span><b>"+esc(c.orders_per_week)+"</b></div><div class='detail-row'><span>Obvyklý nákup</span><b>"+(customerScheduleLabel(c)?esc(customerScheduleLabel(c)):"Neuvedeno")+"</b></div><div class='detail-row'><span>Mapa</span><b>"+mapStatus+"</b></div><div class='detail-effects'><div class='meta'>Preferred effects</div><div class='effects'>"+eff+"</div></div><div class='portrait-source'>Zdroj portrétu: herní asset · PopTracker</div><div class='detail-actions'><button class='btn primary full' id='saveSelectedCustomer'>Uložit</button><button class='btn full' id='shareSelectedCustomer'>Sdílet odkaz</button><a class='btn ghost full' href='https://wand.com/maps/schedule-i/hyland-point' target='_blank' rel='noopener noreferrer'>Otevřít mapu s piny</a></div>";
  bindPortraitFallbacks();
  $("#saveSelectedCustomer").onclick=()=>saveRecord("customers",{key:"customer:"+c.id,name:c.name,note:c.district+" · "+c.tier+" · $"+c.budget});
  $("#shareSelectedCustomer").onclick=()=>openEntityShare("customer",c.id);
}
function matchCustomers(r){const effects=new Set(r.effects.map(x=>x.toLowerCase()));return state.customers.map(c=>({...c,matchCount:c.preferred_effects.filter(x=>effects.has(x.toLowerCase())).length})).filter(c=>c.matchCount>0).sort((a,b)=>b.matchCount-a.matchCount||b.budget-a.budget);}
function renderRecipes(){const q=searchNorm($("#recipeSearch").value),d=$("#drugFilter").value,list=state.recipes.filter(r=>(!d||r.drug===d)&&(!q||searchNorm([r.name,r.drug,...(r.ingredients||[]),...(r.effects||[]),r.author].join(" ")).includes(q)));$("#recipeList").innerHTML=list.map((r,i)=>{const ms=matchCustomers(r),top=ms.slice(0,6).map(c=>"<button class='match-customer' type='button' data-match-customer='"+c.id+"'><span>"+esc(c.name)+" · "+esc(c.district)+"</span><b>"+c.matchCount+"/"+r.effects.length+"</b></button>").join("");return "<article class='recipe-card'><div class='recipe-head'><div><div class='label'>"+esc(r.drug)+"</div><div class='recipe-name'>"+esc(r.name)+"</div></div><div class='numbers'><div class='metric'>Náklad<b>$"+r.cost+"</b></div><div class='metric'>Prodej<b>$"+r.sell+"</b></div><div class='metric profit'>Profit<b>$"+r.profit+"</b></div></div></div><div class='ingredients'><b>Ingredience v pořadí:</b> "+r.ingredients.map(esc).join(" → ")+"</div><div class='effects'>"+r.effects.map(x=>effectMarkup(x)).join("")+"</div><div class='recipe-actions'><button class='btn primary' type='button' data-save-recipe='"+i+"'>Uložit recept</button><button class='btn' type='button' data-share-recipe='"+i+"'>Sdílet</button><span class='match-count'>Effect match: "+ms.length+" zákazníků</span></div><div class='matches'><div class='matches-title'>Nejlepší effect matches</div>"+(top||"<span class='meta'>Bez shody efektů.</span>")+"</div><div class='source'>"+esc(r.source)+(r.customers!=null?" · zdroj uvádí "+r.customers+" vhodných zákazníků":"")+"</div></article>";}).join("")||"<div class='empty'>Žádný recept neodpovídá hledání.</div>";document.querySelectorAll("[data-save-recipe]").forEach(b=>b.addEventListener("click",()=>{const r=list[Number(b.dataset.saveRecipe)];if(r)saveRecord("recipes",{key:"recipe:"+r.id,name:r.name,note:r.drug+" · $"+r.profit+" profit"});}));document.querySelectorAll("[data-share-recipe]").forEach(b=>b.addEventListener("click",()=>{const r=list[Number(b.dataset.shareRecipe)];if(r)openEntityShare("recipe",r.id);}));document.querySelectorAll("[data-match-customer]").forEach(b=>b.addEventListener("click",()=>{state.selectedCustomer=Number(b.dataset.matchCustomer);showTab("customers");renderCustomers();}));}

function setSavedTab(type){state.savedTab=type;document.querySelectorAll(".saved-tab").forEach(b=>b.classList.toggle("active",b.dataset.saved===type));$("#editorTitle").textContent=type==="recipes"?"Recipe":type==="customers"?"Customer":type==="employees"?"Employee":type==="rooms"?"Room":"Other";$("#imageButton").hidden=false;$("#savedImage").hidden=false;$("#savedForm").reset();state.pendingImage=null;$("#imagePreview").hidden=true;renderSaved();}
function renderSaved(){const type=state.savedTab,items=state.saved[type]||[];$("#savedList").innerHTML=items.map((x,i)=>{const image=safeImage(x.image);const employeeMeta=type==="employees"?((x.role?"Pozice: "+esc(x.role)+" · ":"")+(x.room?"Místnost: "+esc(x.room):"")):"";return "<article class='saved-card'>"+(image?"<img class='saved-thumb' src='"+image+"' alt=''>":"")+"<div class='saved-card-body'><div class='saved-name'>"+esc(x.name)+"</div><div class='meta'>"+esc(x.note||"")+"</div>"+(employeeMeta?"<div class='meta s1-employee-meta'>"+employeeMeta+"</div>":"")+"<div class='saved-actions'>"+(type==="rooms"?"<button class='btn ghost' type='button' data-show-room='"+i+"'>Zobrazit na mapě</button>":"")+(type==="employees"&&x.room?"<button class='btn ghost' type='button' data-employee-map-room='"+esc(x.room)+"'>Zobrazit místnost</button>":"")+"<button class='btn ghost danger' type='button' data-delete-saved='"+i+"'>Smazat</button></div></div></article>";}).join("")||"<div class='empty'>Zatím nic uloženého.</div>";document.querySelectorAll("[data-delete-saved]").forEach(b=>b.addEventListener("click",()=>{state.saved[type].splice(Number(b.dataset.deleteSaved),1);persistSaved();renderSaved();}));document.querySelectorAll("[data-show-room]").forEach(b=>b.addEventListener("click",()=>{const room=state.saved.rooms[Number(b.dataset.showRoom)];sessionStorage.setItem("s1-room-highlight",room?.name||"");showTab("map");renderRoomHighlight();}));}
function renderRoomHighlight(){const name=sessionStorage.getItem("s1-room-highlight");let el=$("#roomHighlight");if(!el){el=document.createElement("div");el.id="roomHighlight";el.className="room-highlight";$("#view-map").prepend(el);}if(name){el.innerHTML="<b>Room highlight</b><span>"+esc(name)+"</span><button class='btn ghost' id='clearRoomHighlight'>Zavřít</button>";el.hidden=false;$("#clearRoomHighlight").onclick=()=>{sessionStorage.removeItem("s1-room-highlight");el.hidden=true;};}else el.hidden=true;}
$("#savedImage").addEventListener("change",e=>{const file=e.target.files?.[0];if(!file)return;const rd=new FileReader();rd.onload=()=>{if(!/^data:image\//i.test(String(rd.result))){alert("Neplatný obrázek.");return;}state.pendingImage=rd.result;$("#imagePreview").innerHTML="<img src='"+state.pendingImage+"' alt='Náhled'>";$("#imagePreview").hidden=false;};rd.readAsDataURL(file);});
$("#imageButton").addEventListener("click",()=>$("#savedImage").click());
$("#savedForm").addEventListener("submit",e=>{e.preventDefault();const type=state.savedTab,name=$("#savedName").value.trim(),note=$("#savedNote").value.trim();if(!name)return;const data={key:type+":"+Date.now(),name,note,image:safeImage(state.pendingImage)};if(type==="employees"){data.role=String($("#s1EmployeeRole")?.value||"").trim().slice(0,80);data.room=String($("#s1EmployeeRoom")?.value||"").trim().slice(0,120);}saveRecord(type,data);$("#savedName").value="";$("#savedNote").value="";if($("#s1EmployeeRole"))$("#s1EmployeeRole").value="";if($("#s1EmployeeRoom"))$("#s1EmployeeRoom").value="";state.pendingImage=null;$("#imagePreview").hidden=true;});
document.querySelectorAll(".saved-tab").forEach(b=>b.addEventListener("click",()=>setSavedTab(b.dataset.saved)));

function randomId(){return "s1-"+Math.random().toString(36).slice(2,10);}
function b64urlEncode(obj){const bytes=new TextEncoder().encode(JSON.stringify(obj));let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function b64urlDecode(s){try{const pad=s.length%4?4-(s.length%4):0,bin=atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat(pad)),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}}
function saveShareSettings(){localStorage.setItem(shareKey,JSON.stringify({id:$("#shareId").value.trim(),title:$("#shareTitle").value.trim(),kind:$("#shareKind").value}));}
function loadShareSettings(){try{const x=JSON.parse(localStorage.getItem(shareKey)||"{}");$("#shareId").value=x.id||randomId();$("#shareTitle").value=x.title||"Moje Hyland Point nastavení";$("#shareKind").value=x.kind||"view";}catch{$("#shareId").value=randomId();$("#shareTitle").value="Moje Hyland Point nastavení";}}
function buildShare(kind=null,id=null){const shareId=$("#shareId").value.trim()||randomId();if(!/^[A-Za-z0-9_-]{3,32}$/.test(shareId)){alert("Share ID musí mít 3–32 znaků: písmena, čísla, _ nebo -.");return null;}const payload={v:1,id:shareId,title:$("#shareTitle").value.trim()||"Schedule 1 Helper",kind:kind||$("#shareKind").value,tab:document.querySelector(".tab.active")?.dataset.tab||"map",filters:{customerSearch:$("#customerSearch").value,district:$("#districtFilter").value,tier:$("#tierFilter").value,customerDay:$("#customerDayFilter").value,recipeSearch:$("#recipeSearch").value,drug:$("#drugFilter").value},customerId:(kind==="customer"?id:state.selectedCustomer||null),recipeId:(kind==="recipe"?id:null)};const url=location.origin+location.pathname+"?share="+b64urlEncode(payload);$("#shareUrl").value=url;$("#shareSummary").textContent="Připraveno: "+payload.title+" · "+payload.kind+" · "+shareId;saveShareSettings();return url;}
function openEntityShare(kind,id){showTab("share");$("#shareKind").value=kind;buildShare(kind,id);}
function applyIncomingShare(){const token=new URLSearchParams(location.search).get("share");if(!token)return;const p=b64urlDecode(token);if(!p||p.v!==1)return;if(p.filters){$("#customerSearch").value=p.filters.customerSearch||"";$("#districtFilter").value=p.filters.district||"";$("#tierFilter").value=p.filters.tier||"";$("#customerDayFilter").value=p.filters.customerDay||"";$("#recipeSearch").value=p.filters.recipeSearch||"";$("#drugFilter").value=p.filters.drug||"";}if(p.kind==="customer"&&p.customerId){state.selectedCustomer=Number(p.customerId);showTab("customers");renderCustomers();}else if(p.kind==="recipe"){showTab("recipes");renderRecipes();}else showTab(p.tab||"map");$("#shareId").value=p.id||"";$("#shareTitle").value=p.title||"Sdílené nastavení";$("#shareKind").value=p.kind||"view";$("#shareUrl").value=location.href;$("#shareSummary").textContent="Načten sdílený odkaz: "+$("#shareTitle").value;}
$("#randomShareId").addEventListener("click",()=>{$("#shareId").value=randomId();saveShareSettings();});
$("#buildShare").addEventListener("click",()=>buildShare());
$("#copyShare").addEventListener("click",async()=>{const url=$("#shareUrl").value||buildShare();if(!url)return;try{await navigator.clipboard.writeText(url);$("#shareSummary").textContent="Odkaz zkopírován do schránky.";}catch{$("#shareUrl").select();document.execCommand("copy");$("#shareSummary").textContent="Odkaz je připravený ke zkopírování.";}});

function renderProfile(){const name=state.profile.displayName||"";$("#displayName").value=name;$("#accountStatus").textContent=name?"Profil: "+name:"Nepřihlášen";$("#densitySetting").value=state.settings.density;$("#defaultTabSetting").value=state.settings.defaultTab;$("#autoSaveSetting").checked=state.settings.autoSave;}
function applySettings(){document.body.classList.toggle("compact",state.settings.density==="compact");renderProfile();if(!new URLSearchParams(location.search).has("share"))showTab(state.settings.defaultTab||"map");}
$("#profileForm").addEventListener("submit",e=>{e.preventDefault();state.profile.displayName=$("#displayName").value.trim();persistProfile();renderProfile();});
$("#localSignOut").addEventListener("click",()=>{state.profile={displayName:""};persistProfile();renderProfile();});
$("#densitySetting").addEventListener("change",e=>{state.settings.density=e.target.value;persistSettings();applySettings();});
$("#defaultTabSetting").addEventListener("change",e=>{state.settings.defaultTab=e.target.value;persistSettings();});
$("#autoSaveSetting").addEventListener("change",e=>{state.settings.autoSave=e.target.checked;persistSettings();});
$("#exportData").addEventListener("click",()=>{const safeSaved={recipes:[],customers:[],employees:[],rooms:[],other:[]};for(const [type,items] of Object.entries(state.saved)){safeSaved[type]=(Array.isArray(items)?items:[]).map(x=>({...x,image:safeImage(x.image)}));}const payload={version:1,exportedAt:new Date().toISOString(),profile:state.profile,settings:state.settings,saved:safeSaved};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="schedule-1-helper-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
$("#importData").addEventListener("click",()=>$("#importFile").click());
$("#importFile").addEventListener("change",e=>{const file=e.target.files?.[0];if(!file)return;const rd=new FileReader();rd.onload=()=>{try{const p=JSON.parse(rd.result);if(!p||typeof p!=="object"||!p.saved)throw new Error("invalid");const clean={recipes:[],customers:[],employees:[],rooms:[],other:[]};for(const type of Object.keys(clean)){if(Array.isArray(p.saved[type]))clean[type]=p.saved[type].filter(x=>x&&typeof x==="object").slice(0,500).map(x=>({...x,name:String(x.name||"").slice(0,200),note:String(x.note||"").slice(0,2000),image:safeImage(x.image)}));}if(!confirm("Import nahradí aktuální lokální uložená data. Pokračovat?"))return;state.saved=clean;state.profile={displayName:String(p.profile?.displayName||"").slice(0,40)};state.settings={density:p.settings?.density==="compact"?"compact":"normal",defaultTab:["home","map","customers","recipes","saved","share"].includes(p.settings?.defaultTab)?p.settings.defaultTab:"home",autoSave:p.settings?.autoSave!==false};persistSaved();persistProfile();persistSettings();renderSaved();renderProfile();applySettings();alert("Záloha byla načtena.");}catch{alert("Soubor není platná Schedule 1 Helper záloha.");}};rd.readAsText(file);});

let scale=1,ox=0,oy=0,drag=false,sx=0,sy=0;const vp=$("#mapViewport"),img=$("#mapImage");function applyMap(){img.style.transform="translate("+ox+"px,"+oy+"px) scale("+scale+")";}$("#zoomIn").addEventListener("click",()=>{scale=Math.min(3.2,scale+.18);applyMap();});$("#zoomOut").addEventListener("click",()=>{scale=Math.max(.72,scale-.18);applyMap();});$("#resetMap").addEventListener("click",()=>{scale=1;ox=0;oy=0;applyMap();});vp.addEventListener("wheel",e=>{e.preventDefault();scale=Math.max(.72,Math.min(3.2,scale+(e.deltaY<0?.15:-.15)));applyMap();},{passive:false});vp.addEventListener("pointerdown",e=>{drag=true;sx=e.clientX-ox;sy=e.clientY-oy;vp.setPointerCapture(e.pointerId);});vp.addEventListener("pointermove",e=>{if(!drag)return;ox=e.clientX-sx;oy=e.clientY-sy;applyMap();});vp.addEventListener("pointerup",()=>drag=false);vp.addEventListener("pointercancel",()=>drag=false);
$("#customerSearch")?.addEventListener("input",renderCustomers);$("#districtFilter")?.addEventListener("change",renderCustomers);$("#tierFilter")?.addEventListener("change",renderCustomers);$("#customerDayFilter")?.addEventListener("change",renderCustomers);

loadLocal();setSavedTab("recipes");loadShareSettings();renderRoomHighlight();loadData().catch(err=>{console.error(err);$("#customerSummary").textContent="Data se nepodařilo načíst";});

$("#clearLocalData").addEventListener("click",()=>{if(!confirm("Smazat lokální profil, nastavení a všechny Saved položky z tohoto zařízení?"))return;localStorage.removeItem(savedKey);localStorage.removeItem(profileKey);localStorage.removeItem(settingsKey);localStorage.removeItem(shareKey);sessionStorage.removeItem("s1-room-highlight");state.saved={recipes:[],customers:[],employees:[],rooms:[],other:[]};state.profile={displayName:""};state.settings={density:"normal",defaultTab:"home",autoSave:true};state.savedTab="recipes";renderProfile();applySettings();renderSaved();loadShareSettings();renderRoomHighlight();});

/* Supabase backend integration */
(function(){
  const SUPABASE_URL="https://rwrmtuaopbomstjfdlsx.supabase.co";
  const SUPABASE_KEY=atob("c2JfcHVibGlzaGFibGVfYmt5cHVSNENRRXpTeDVHM2FvZG5Td18zX3g4YWY4Zw==");
  if(!window.supabase){console.error("Supabase JS klient není načten.");return;}
  window.s1Supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const authCard=document.querySelector("#view-account .account-card:nth-child(3)");
  function ensureAuthGate(){
    if(document.querySelector("#s1AuthGate"))return;
    const style=document.createElement("style");
    style.id="s1-auth-gate-style";
    style.textContent=`
      html.s1-login-locked,body.s1-login-locked{overflow:hidden!important}
      #s1AuthGate{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px;background:rgba(4,7,9,.78);backdrop-filter:blur(18px) saturate(125%)}
      #s1AuthGate[hidden]{display:none}
      .s1-auth-gate-card{width:min(460px,100%);border:1px solid var(--border-strong);border-radius:22px;background:linear-gradient(180deg,#121a20,#0b1116);box-shadow:0 28px 100px rgba(0,0,0,.58);padding:26px}
      .s1-auth-gate-kicker{color:var(--accent);font-size:10px;font-weight:850;letter-spacing:.18em}
      .s1-auth-gate-card h2{margin:7px 0 8px;font-size:28px;letter-spacing:-.035em}
      .s1-auth-gate-card p{margin:0 0 18px;color:var(--muted);font-size:11px;line-height:1.55}
      .s1-auth-gate-form{display:grid;gap:9px}
      .s1-auth-gate-form input{width:100%;min-height:44px;border:1px solid var(--border);background:var(--panel-2);color:var(--text);border-radius:12px;padding:9px 11px;box-sizing:border-box}
      .s1-auth-gate-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .s1-auth-gate-actions .btn{width:100%}
      #s1AuthGateStatus{min-height:18px;color:var(--muted);font-size:10px;line-height:1.45}
      #s1AuthGateStatus.good{color:var(--accent)}
      #s1AuthGateStatus.error{color:var(--danger)}
      .s1-auth-gate-lock{margin-top:13px;padding-top:12px;border-top:1px solid var(--border);color:var(--muted-2);font-size:9px;line-height:1.45}
      @media(max-width:520px){#s1AuthGate{padding:12px}.s1-auth-gate-card{padding:20px;border-radius:18px}.s1-auth-gate-card h2{font-size:24px}.s1-auth-gate-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
    const gate=document.createElement("div");
    gate.id="s1AuthGate";
    gate.hidden=true;
    gate.setAttribute("role","dialog");
    gate.setAttribute("aria-modal","true");
    gate.innerHTML=`<div class="s1-auth-gate-card"><div class="s1-auth-gate-kicker">SCHEDULE 1 HELPER</div><h2>Přihlášení je povinné</h2><p>Pro používání Helperu se musíš nejdřív přihlásit. Přihlášení probíhá přes email a jednorázový ověřovací kód.</p><form class="s1-auth-gate-form" id="s1AuthGateForm"><label class="field-label" for="s1GateEmail">Email</label><input id="s1GateEmail" type="email" autocomplete="email" placeholder="tvuj@email.cz" required><div class="s1-auth-gate-actions"><button class="btn" id="s1GateSend" type="button">Poslat kód</button><button class="btn primary" id="s1GateVerify" type="submit">Přihlásit</button></div><label class="field-label" for="s1GateCode">Ověřovací kód</label><input id="s1GateCode" inputmode="numeric" autocomplete="one-time-code" placeholder="Kód z emailu" required><div id="s1AuthGateStatus" aria-live="polite"></div></form><div class="s1-auth-gate-lock">Toto okno nejde zavřít ani přeskočit. Po úspěšném přihlášení se Helper automaticky odemkne.</div></div>`;
    document.body.appendChild(gate);
    const email=gate.querySelector("#s1GateEmail"),code=gate.querySelector("#s1GateCode"),status=gate.querySelector("#s1AuthGateStatus"),send=gate.querySelector("#s1GateSend"),verify=gate.querySelector("#s1GateVerify");
    const setStatus=(message,type="")=>{status.textContent=message;status.className=type;};
    const setLocked=locked=>{gate.hidden=!locked;document.documentElement.classList.toggle("s1-login-locked",locked);document.body.classList.toggle("s1-login-locked",locked);if(locked)setTimeout(()=>email.focus(),0);};
    send.onclick=async()=>{
      const value=email.value.trim();
      if(!/^\\S+@\\S+\\.\\S+$/.test(value)){setStatus("Zadej platný email.","error");email.focus();return;}
      send.disabled=true;setStatus("Odesílám ověřovací kód…");
      try{
        const {error}=await window.s1Supabase.auth.signInWithOtp({email:value,options:{shouldCreateUser:true}});
        if(error)throw error;
        setStatus("Kód byl odeslán na email. Zadej ho níže.","good");code.focus();
      }catch(err){setStatus("Kód se nepodařilo odeslat: "+(err?.message||"neznámá chyba"),"error");}
      finally{send.disabled=false;}
    };
    gate.querySelector("#s1AuthGateForm").onsubmit=async e=>{
      e.preventDefault();
      const value=email.value.trim(),token=code.value.trim();
      if(!/^\\S+@\\S+\\.\\S+$/.test(value)){setStatus("Zadej platný email.","error");return;}
      if(!token){setStatus("Zadej ověřovací kód.","error");return;}
      verify.disabled=true;setStatus("Ověřuji přihlášení…");
      try{
        const {error}=await window.s1Supabase.auth.verifyOtp({email:value,token,type:"email"});
        if(error)throw error;
        setStatus("Přihlášení proběhlo úspěšně.","good");
        await refreshAuth();
      }catch(err){setStatus("Kód není platný nebo vypršel: "+(err?.message||"neznámá chyba"),"error");}
      finally{verify.disabled=false;}
    };
    gate._setLocked=setLocked;
  }

  function ensureAuthUI(){
    if(!authCard||document.querySelector("#s1ServerAuthUI"))return;
    const old=authCard.querySelector(".login-steps");
    if(old)old.hidden=true;
    const box=document.createElement("div");box.id="s1ServerAuthUI";box.className="s1-feature-card";box.innerHTML="<div class='label'>Supabase účet</div><div class='meta' id='serverAuthStatus'>Nepřihlášen</div><label class='field-label' for='authEmail'>Email</label><input id='authEmail' type='email' autocomplete='email' placeholder='tvuj@email.cz'><div class='share-actions'><button class='btn' id='sendAuthCode' type='button'>Poslat kód</button></div><label class='field-label' for='authCode'>Ověřovací kód</label><input id='authCode' inputmode='numeric' autocomplete='one-time-code' placeholder='Kód z emailu'><div class='share-actions'><button class='btn primary' id='verifyAuthCode' type='button'>Přihlásit</button><button class='btn ghost' id='serverSignOut' type='button'>Odhlásit</button><button class='btn' id='serverProfileSave' type='button'>Uložit profil na server</button></div><div class='account-note'>Přihlášení používá Supabase Auth a emailový OTP kód. Heslo se v Helperu neukládá.</div>";
    authCard.appendChild(box);
    document.querySelector("#profileForm")?.addEventListener("submit",async()=>{if(window.s1Session)await syncProfile();});
    box.querySelector("#sendAuthCode").onclick=sendOtp;
    box.querySelector("#verifyAuthCode").onclick=verifyOtp;
    box.querySelector("#serverSignOut").onclick=async()=>{await window.s1Supabase.auth.signOut();await refreshAuth();};
    box.querySelector("#serverProfileSave").onclick=syncProfile;
    box.querySelector("#authEmail").addEventListener("input",updateVerifyButton);
    box.querySelector("#authCode").addEventListener("input",updateVerifyButton);
  }
  function updateVerifyButton(){const b=document.querySelector("#verifyAuthCode");if(b)b.disabled=!document.querySelector("#authEmail")?.value.trim()||!document.querySelector("#authCode")?.value.trim();}
  async function refreshAuth(){
    const {data}=await window.s1Supabase.auth.getSession();window.s1Session=data?.session||null;
    ensureAuthGate();
    ensureAuthUI();
    document.querySelector("#s1AuthGate")?._setLocked(!window.s1Session);
    if(window.s1Session){document.querySelector("#s1AuthGateStatus")?.replaceChildren();}
    const status=document.querySelector("#serverAuthStatus");if(status)status.textContent=window.s1Session?"Přihlášen: "+(window.s1Session.user.email||""):"Nepřihlášen";
    const signout=document.querySelector("#serverSignOut");if(signout)signout.disabled=!window.s1Session;
    const name=document.querySelector("#displayName");
    if(name&&window.s1Session&&!name.value)name.value=window.s1Session.user.user_metadata?.display_name||"";
    document.dispatchEvent(new CustomEvent("s1-auth-changed",{detail:{session:window.s1Session}}));
  }
  async function sendOtp(){
    const email=(document.querySelector("#authEmail")?.value||"").trim();
    if(!/^\S+@\S+\.\S+$/.test(email)){alert("Zadej platný email.");return;}
    const displayName=(document.querySelector("#displayName")?.value||"").trim().slice(0,40);
    const {error}=await window.s1Supabase.auth.signInWithOtp({email,options:{shouldCreateUser:true,data:{display_name:displayName}}});
    if(error){alert("Kód se nepodařilo odeslat: "+error.message);return;}
    alert("Kód byl odeslán na email.");document.querySelector("#authCode")?.focus();
  }
  async function verifyOtp(){
    const email=(document.querySelector("#authEmail")?.value||"").trim(),token=(document.querySelector("#authCode")?.value||"").trim();
    if(!email||!token){alert("Zadej email a kód.");return;}
    const {error}=await window.s1Supabase.auth.verifyOtp({email,token,type:"email"});
    if(error){alert("Kód není platný nebo vypršel: "+error.message);return;}
    await refreshAuth();alert("Přihlášení proběhlo úspěšně.");
  }
  async function syncProfile(){
    if(!window.s1Session)return;
    const displayName=(document.querySelector("#displayName")?.value||"").trim().slice(0,40);
    const {error}=await window.s1Supabase.from("profiles").upsert({id:window.s1Session.user.id,display_name:displayName},{onConflict:"id"});
    if(error){alert("Profil se nepodařilo uložit: "+error.message);return;}
    await window.s1Supabase.auth.updateUser({data:{display_name:displayName}});
    document.dispatchEvent(new CustomEvent("s1-profile-saved"));alert("Profil uložen na serveru.");
  }
  window.s1RefreshAuth=refreshAuth;
  document.addEventListener("DOMContentLoaded",async()=>{ensureAuthGate();ensureAuthUI();window.s1Supabase.auth.onAuthStateChange(()=>refreshAuth());await refreshAuth();});
})();
