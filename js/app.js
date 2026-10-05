const state={customers:[],recipes:[],portraitRegistry:new Map(),customerSchedules:new Map(),selectedCustomer:null,savedTab:"recipes",saved:{recipes:[],customers:[],employees:[],rooms:[],other:[]},pendingImage:null,profile:{displayName:""},settings:{density:"normal",defaultTab:"home",autoSave:true}};
const $=s=>document.querySelector(s);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const savedKey="schedule1-helper-saved-v2",profileKey="schedule1-helper-profile-v1",settingsKey="schedule1-helper-settings-v1",shareKey="schedule1-helper-share-v1";
const customerMapVerified=c=>c?.map_position?.status==="verified-external-pin";const searchNorm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();const mapCategories=[{"name":"ATM","count":16},{"name":"Recycler","count":13},{"name":"Telephone Booth","count":19},{"name":"Vending Machine","count":12},{"name":"Dead Drop","count":25},{"name":"Area / Location","count":40},{"name":"Stash","count":3},{"name":"RV","count":1},{"name":"Purchasable Area","count":5},{"name":"Main Mission","count":16},{"name":"Post Office","count":1},{"name":"Laundromat","count":1},{"name":"Car Wash","count":1},{"name":"Taco Ticklers","count":1},{"name":"Bleuball's Boutique","count":1},{"name":"Barbershop","count":1},{"name":"Casino","count":1},{"name":"Hardware","count":2},{"name":"Gas Mart","count":2},{"name":"Car Service","count":2},{"name":"Pawn Shop","count":1},{"name":"Ray's Realty","count":1},{"name":"Shred Shack","count":1},{"name":"Thrifty Threads","count":1},{"name":"Top Tattoo","count":1},{"name":"Warehouse","count":1},{"name":"Suppliers","count":6},{"name":"Dealers","count":6},{"name":"Customers","count":62}];
function showTab(name){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));window.scrollTo({top:0,behavior:"smooth"});}
document.addEventListener("click",e=>{const b=e.target.closest(".tab");if(b?.dataset.tab)showTab(b.dataset.tab);});$("#customerPinFilter")?.addEventListener("change",renderCustomers);
document.querySelectorAll("[data-tab-jump]").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tabJump)));
function searchEverything(raw){
 const value=searchNorm(raw);
 if(!value)return;
 const customer=state.customers.find(c=>searchNorm([c.name,c.district,c.tier,...c.preferred_effects].join(" ")).includes(value));
 if(customer){state.selectedCustomer=Number(customer.id);$("#customerSearch").value=String(raw);showTab("customers");renderCustomers();return;}
 const recipe=state.recipes.find(x=>searchNorm([x.name,x.drug,...x.ingredients,...x.effects].join(" ")).includes(value));
 if(recipe){$("#recipeSearch").value=String(raw);showTab("recipes");renderRecipes();return;}
 $("#catalogSearch").value=String(raw);
 const catalog=window.__s1Catalog||{};
 const kindOrder=["ingredients","drugs","effects","dealers","properties","businesses","vehicles"];
 const hit=kindOrder.find(kind=>(catalog[kind]||[]).some(x=>[x.name,x.family,x.type,x.base_effect,x.location].filter(Boolean).join(" ").toLowerCase().includes(value)));
 if(hit){$("#catalogKind").value=hit;showTab("catalog");$("#catalogSearch").dispatchEvent(new Event("input",{bubbles:true}));return;}
 $("#recipeSearch").value=String(raw);showTab("recipes");renderRecipes();
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
function customerPortrait(c){const p=state.portraitRegistry.get(Number(c.id));return p||{};}
function portraitMarkup(c,variant="card"){const p=customerPortrait(c),local=typeof p.local_path==="string"?p.local_path:"",remote=typeof p.asset_url==="string"?p.asset_url:"",src=local||remote;if(!src)return "";return "<div class='customer-portrait "+variant+"'><img src='"+esc(src)+"' data-customer-portrait data-portrait-fallback='"+esc(remote)+"' alt='' loading='lazy' decoding='async'><span class='portrait-placeholder' aria-hidden='true'>S1</span></div>";}
function bindPortraitFallbacks(){document.querySelectorAll("[data-customer-portrait]").forEach(img=>{if(img.dataset.portraitBound)return;img.dataset.portraitBound="1";img.addEventListener("error",()=>{if(img.dataset.portraitFallbackUsed)return;const fallback=img.dataset.portraitFallback||"";if(fallback&&img.getAttribute("src")!==fallback){img.dataset.portraitFallbackUsed="1";img.src=fallback;return;}img.hidden=true;img.parentElement?.classList.add("portrait-missing");});});}

function verifiedCustomerCount(){return state.customers.filter(customerMapVerified).length;}function renderCategories(){$("#mapCategoryList").innerHTML=mapCategories.map(x=>"<div class='category-row'><span>"+esc(x.name)+"</span><b>"+x.count+"</b></div>").join("");}
async function loadData(){const [c,r,p,s]=await Promise.all([fetch("./data/customers.json",{cache:"no-store"}).then(x=>x.json()),fetch("./data/recipes.json",{cache:"no-store"}).then(x=>x.json()),fetch("./data/customer-portraits.json",{cache:"no-store"}).then(x=>x.json()).catch(()=>({customers:[]})),fetch("./data/customer-schedules.json",{cache:"no-store"}).then(x=>x.json()).catch(()=>({schedules:[]}))]);state.customers=Array.isArray(c.customers)?c.customers:[];state.recipes=Array.isArray(r.recipes)?r.recipes:[];state.portraitRegistry=new Map((Array.isArray(p.customers)?p.customers:[]).map(x=>[Number(x.id),x.portrait||{}]));state.customerSchedules=new Map((Array.isArray(s.schedules)?s.schedules:[]).map(x=>[Number(x.id),x]));$("#customerCountBadge").textContent=state.customers.length;const districts=[...new Set(state.customers.map(x=>x.district))].sort();$("#districtFilter").insertAdjacentHTML("beforeend",districts.map(x=>"<option>"+esc(x)+"</option>").join(""));renderCategories();renderCustomers();renderRecipes();applySettings();applyIncomingShare();}

function cMatch(c,q,d,t,day,pinOnly){const s=customerSchedule(c);if(d&&c.district!==d)return false;if(t&&c.tier!==t)return false;if(day&&s?.preferred_day!==day)return false;if(pinOnly&&!customerMapVerified(c))return false;if(!q)return true;return[c.name,c.district,c.tier,...c.preferred_effects].join(" ").toLowerCase().includes(q);}
function renderCustomers(){
  const q=$("#customerSearch").value.trim().toLowerCase(),d=$("#districtFilter").value,t=$("#tierFilter").value,day=$("#customerDayFilter").value,pinOnly=$("#customerPinFilter")?.checked;
  const list=state.customers.filter(c=>cMatch(c,q,d,t,day,pinOnly));
  $("#customerSummary").textContent=list.length+" z "+state.customers.length+" zákazníků zobrazených · 62 má ověřený veřejný pin v Wand, 4 čekají na veřejné ověření";
  $("#customerList").innerHTML=list.map(c=>{
    const sel=c.id===state.selectedCustomer?" selected":"",sched=customerScheduleLabel(c);
    const eff=c.preferred_effects.length?c.preferred_effects.map(e=>"<span class='effect'>"+esc(e)+"</span>").join(""):"<span class='meta'>Bez preferovaného efektu</span>";
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
  const eff=c.preferred_effects.length?c.preferred_effects.map(e=>"<span class='effect'>"+esc(e)+"</span>").join(""):"<span class='meta'>Žádné preference</span>";
  const verified=customerMapVerified(c);
  const mapStatus=verified?"Ověřený veřejný pin v Wand":"Veřejný přesný pin zatím neověřen";
  $("#customerDetail").innerHTML="<div class='label'>Customer profile</div><div class='customer-profile-head'>"+portraitMarkup(c,"detail")+"<div><h3>"+esc(c.name)+"</h3><div class='meta'>"+esc(c.district)+" · "+esc(c.tier)+"</div></div></div><div class='detail-row'><span>Budget / deal</span><b>$"+c.budget+"</b></div><div class='detail-row'><span>Orders / week</span><b>"+esc(c.orders_per_week)+"</b></div><div class='detail-row'><span>Obvyklý nákup</span><b>"+(customerScheduleLabel(c)?esc(customerScheduleLabel(c)):"Neuvedeno")+"</b></div><div class='detail-row'><span>Mapa</span><b>"+mapStatus+"</b></div><div class='detail-effects'><div class='meta'>Preferred effects</div><div class='effects'>"+eff+"</div></div><div class='portrait-source'>Zdroj portrétu: herní asset · PopTracker</div><div class='detail-actions'><button class='btn primary full' id='saveSelectedCustomer'>Uložit</button><button class='btn full' id='shareSelectedCustomer'>Sdílet odkaz</button><a class='btn ghost full' href='https://wand.com/maps/schedule-i/hyland-point' target='_blank' rel='noopener noreferrer'>Otevřít mapu s piny</a></div>";
  bindPortraitFallbacks();
  $("#saveSelectedCustomer").onclick=()=>saveRecord("customers",{key:"customer:"+c.id,name:c.name,note:c.district+" · "+c.tier+" · $"+c.budget});
  $("#shareSelectedCustomer").onclick=()=>openEntityShare("customer",c.id);
}
function matchCustomers(r){const effects=new Set(r.effects.map(x=>x.toLowerCase()));return state.customers.map(c=>({...c,matchCount:c.preferred_effects.filter(x=>effects.has(x.toLowerCase())).length})).filter(c=>c.matchCount>0).sort((a,b)=>b.matchCount-a.matchCount||b.budget-a.budget);}
function renderRecipes(){const q=$("#recipeSearch").value.trim().toLowerCase(),d=$("#drugFilter").value,list=state.recipes.filter(r=>(!d||r.drug===d)&&(!q||[r.name,r.drug,...r.ingredients,...r.effects].join(" ").toLowerCase().includes(q)));$("#recipeList").innerHTML=list.map((r,i)=>{const ms=matchCustomers(r),top=ms.slice(0,6).map(c=>"<button class='match-customer' type='button' data-match-customer='"+c.id+"'><span>"+esc(c.name)+" · "+esc(c.district)+"</span><b>"+c.matchCount+"/"+r.effects.length+"</b></button>").join("");return "<article class='recipe-card'><div class='recipe-head'><div><div class='label'>"+esc(r.drug)+"</div><div class='recipe-name'>"+esc(r.name)+"</div></div><div class='numbers'><div class='metric'>Náklad<b>$"+r.cost+"</b></div><div class='metric'>Prodej<b>$"+r.sell+"</b></div><div class='metric profit'>Profit<b>$"+r.profit+"</b></div></div></div><div class='ingredients'><b>Ingredience v pořadí:</b> "+r.ingredients.map(esc).join(" → ")+"</div><div class='effects'>"+r.effects.map(x=>"<span class='effect'>"+esc(x)+"</span>").join("")+"</div><div class='recipe-actions'><button class='btn primary' type='button' data-save-recipe='"+i+"'>Uložit recept</button><button class='btn' type='button' data-share-recipe='"+i+"'>Sdílet</button><span class='match-count'>Effect match: "+ms.length+" zákazníků</span></div><div class='matches'><div class='matches-title'>Nejlepší effect matches</div>"+(top||"<span class='meta'>Bez shody efektů.</span>")+"</div><div class='source'>"+esc(r.source)+(r.customers!=null?" · zdroj uvádí "+r.customers+" vhodných zákazníků":"")+"</div></article>";}).join("")||"<div class='empty'>Žádný recept neodpovídá hledání.</div>";document.querySelectorAll("[data-save-recipe]").forEach(b=>b.addEventListener("click",()=>{const r=list[Number(b.dataset.saveRecipe)];if(r)saveRecord("recipes",{key:"recipe:"+r.id,name:r.name,note:r.drug+" · $"+r.profit+" profit"});}));document.querySelectorAll("[data-share-recipe]").forEach(b=>b.addEventListener("click",()=>{const r=list[Number(b.dataset.shareRecipe)];if(r)openEntityShare("recipe",r.id);}));document.querySelectorAll("[data-match-customer]").forEach(b=>b.addEventListener("click",()=>{state.selectedCustomer=Number(b.dataset.matchCustomer);showTab("customers");renderCustomers();}));}

function setSavedTab(type){state.savedTab=type;document.querySelectorAll(".saved-tab").forEach(b=>b.classList.toggle("active",b.dataset.saved===type));$("#editorTitle").textContent=type==="recipes"?"Recipe":type==="customers"?"Customer":type==="employees"?"Employee":type==="rooms"?"Room":"Other";$("#imageButton").hidden=false;$("#savedImage").hidden=false;$("#savedForm").reset();state.pendingImage=null;$("#imagePreview").hidden=true;renderSaved();}
function renderSaved(){const type=state.savedTab,items=state.saved[type]||[];$("#savedList").innerHTML=items.map((x,i)=>{const image=safeImage(x.image);return "<article class='saved-card'>"+(image?"<img class='saved-thumb' src='"+image+"' alt=''>":"")+"<div class='saved-card-body'><div class='saved-name'>"+esc(x.name)+"</div><div class='meta'>"+esc(x.note||"")+"</div><div class='saved-actions'>"+(type==="rooms"?"<button class='btn ghost' type='button' data-show-room='"+i+"'>Zobrazit na mapě</button>":"")+"<button class='btn ghost danger' type='button' data-delete-saved='"+i+"'>Smazat</button></div></div></article>";}).join("")||"<div class='empty'>Zatím nic uloženého.</div>";document.querySelectorAll("[data-delete-saved]").forEach(b=>b.addEventListener("click",()=>{state.saved[type].splice(Number(b.dataset.deleteSaved),1);persistSaved();renderSaved();}));document.querySelectorAll("[data-show-room]").forEach(b=>b.addEventListener("click",()=>{const room=state.saved.rooms[Number(b.dataset.showRoom)];sessionStorage.setItem("s1-room-highlight",room?.name||"");showTab("map");renderRoomHighlight();}));}
function renderRoomHighlight(){const name=sessionStorage.getItem("s1-room-highlight");let el=$("#roomHighlight");if(!el){el=document.createElement("div");el.id="roomHighlight";el.className="room-highlight";$("#view-map").prepend(el);}if(name){el.innerHTML="<b>Room highlight</b><span>"+esc(name)+"</span><button class='btn ghost' id='clearRoomHighlight'>Zavřít</button>";el.hidden=false;$("#clearRoomHighlight").onclick=()=>{sessionStorage.removeItem("s1-room-highlight");el.hidden=true;};}else el.hidden=true;}
$("#savedImage").addEventListener("change",e=>{const file=e.target.files?.[0];if(!file)return;const rd=new FileReader();rd.onload=()=>{if(!/^data:image\//i.test(String(rd.result))){alert("Neplatný obrázek.");return;}state.pendingImage=rd.result;$("#imagePreview").innerHTML="<img src='"+state.pendingImage+"' alt='Náhled'>";$("#imagePreview").hidden=false;};rd.readAsDataURL(file);});
$("#imageButton").addEventListener("click",()=>$("#savedImage").click());
$("#savedForm").addEventListener("submit",e=>{e.preventDefault();const type=state.savedTab,name=$("#savedName").value.trim(),note=$("#savedNote").value.trim();if(!name)return;saveRecord(type,{key:type+":"+Date.now(),name,note,image:safeImage(state.pendingImage)});$("#savedName").value="";$("#savedNote").value="";state.pendingImage=null;$("#imagePreview").hidden=true;});
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
    ensureAuthUI();
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
  document.addEventListener("DOMContentLoaded",async()=>{ensureAuthUI();window.s1Supabase.auth.onAuthStateChange(()=>refreshAuth());await refreshAuth();});
})();
