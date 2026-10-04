const state={customers:[],recipes:[],selectedCustomer:null};

const $=(s)=>document.querySelector(s);
const escapeHtml=(v)=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function showTab(name){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));

async function loadData(){
  const [c,r]=await Promise.all([
    fetch("./data/customers.json",{cache:"no-store"}).then(x=>x.json()),
    fetch("./data/recipes.json",{cache:"no-store"}).then(x=>x.json())
  ]);
  state.customers=Array.isArray(c.customers)?c.customers:[];
  state.recipes=Array.isArray(r.recipes)?r.recipes:[];
  $("#dataState").textContent=state.customers.length+" zákazníků · "+state.recipes.length+" recepty";
  initFilters();
  renderCustomers();
  renderRecipes();
}
function initFilters(){
  const districts=[...new Set(state.customers.map(c=>c.district))].sort();
  $("#districtFilter").insertAdjacentHTML("beforeend",districts.map(d=>"<option>"+escapeHtml(d)+"</option>").join(""));
}
function customerMatches(c,q,d,t){
  if(d&&c.district!==d)return false;
  if(t&&c.tier!==t)return false;
  if(!q)return true;
  const hay=[c.name,c.district,c.tier,...c.preferred_effects].join(" ").toLowerCase();
  return hay.includes(q);
}
function renderCustomers(){
  const q=$("#customerSearch").value.trim().toLowerCase();
  const d=$("#districtFilter").value;
  const t=$("#tierFilter").value;
  const list=state.customers.filter(c=>customerMatches(c,q,d,t));
  $("#customerSummary").textContent=list.length+" z "+state.customers.length+" zobrazených";
  $("#customerList").innerHTML=list.map(c=>{
    const sel=state.selectedCustomer===c.id?" selected":"";
    const effects=c.preferred_effects.length?c.preferred_effects.map(e=>"<span class='effect'>"+escapeHtml(e)+"</span>").join(""):"<span class='meta'>Bez preferovaného efektu</span>";
    return "<article class='customer-card"+sel+"' data-id='"+c.id+"'><div class='customer-name'>"+escapeHtml(c.name)+"</div><div class='meta'>"+escapeHtml(c.district)+" · "+escapeHtml(c.tier)+" · $"+c.budget+" / deal · "+escapeHtml(c.orders_per_week)+" / týden</div><div class='effects'>"+effects+"</div></article>";
  }).join("")||"<div class='empty'>Žádný zákazník neodpovídá filtru.</div>";
  document.querySelectorAll(".customer-card").forEach(el=>el.addEventListener("click",()=>{state.selectedCustomer=Number(el.dataset.id);renderCustomers();renderCustomerDetail();}));
  renderCustomerDetail();
}
function renderCustomerDetail(){
  const c=state.customers.find(x=>x.id===state.selectedCustomer);
  if(!c){$("#customerDetail").innerHTML="<div class='empty'>Vyber zákazníka.</div>";return;}
  const effects=c.preferred_effects.length?c.preferred_effects.map(e=>"<span class='effect'>"+escapeHtml(e)+"</span>").join(""):"<span class='meta'>Žádné preference</span>";
  $("#customerDetail").innerHTML="<div class='label'>Customer profile</div><h3>"+escapeHtml(c.name)+"</h3><div class='meta'>"+escapeHtml(c.district)+" · "+escapeHtml(c.tier)+"</div><div class='detail-row'><span>Budget / deal</span><b>$"+c.budget+"</b></div><div class='detail-row'><span>Orders / week</span><b>"+escapeHtml(c.orders_per_week)+"</b></div><div class='detail-row'><span>Map position</span><b>Čeká na import</b></div><div style='margin-top:12px'><div class='meta'>Preferred effects</div><div class='effects'>"+effects+"</div></div>";
}
function recipeMatches(r,q,d){
  if(d&&r.drug!==d)return false;
  if(!q)return true;
  return [r.name,r.drug,...r.ingredients,...r.effects].join(" ").toLowerCase().includes(q);
}
function renderRecipes(){
  const q=$("#recipeSearch").value.trim().toLowerCase();
  const d=$("#drugFilter").value;
  const list=state.recipes.filter(r=>recipeMatches(r,q,d));
  $("#recipeList").innerHTML=list.map(r=>"<article class='recipe-card'><div class='recipe-head'><div><div class='label'>"+escapeHtml(r.drug)+"</div><div class='recipe-name'>"+escapeHtml(r.name)+"</div></div><div class='numbers'><div class='metric'><span>Náklad</span><b>$"+r.cost+"</b></div><div class='metric'><span>Prodej</span><b>$"+r.sell+"</b></div><div class='metric'><span>Profit</span><b>$"+r.profit+"</b></div></div></div><div class='ingredients'><b>Ingredience v pořadí:</b> "+r.ingredients.map(escapeHtml).join(" → ")+"</div><div class='effects'>"+r.effects.map(e=>"<span class='effect'>"+escapeHtml(e)+"</span>").join("")+"</div><div class='meta' style='margin-top:9px'>Zdroj: "+escapeHtml(r.source)+(r.customers!=null?" · "+r.customers+" zákazníků":"")+"</div></article>").join("")||"<div class='empty'>Žádný recept neodpovídá hledání.</div>";
}
$("#customerSearch").addEventListener("input",renderCustomers);
$("#districtFilter").addEventListener("change",renderCustomers);
$("#tierFilter").addEventListener("change",renderCustomers);
$("#recipeSearch").addEventListener("input",renderRecipes);
$("#drugFilter").addEventListener("change",renderRecipes);

let scale=1,startX=0,startY=0,offsetX=0,offsetY=0,drag=false;
const viewport=$("#mapViewport"),img=$("#mapImage");
function applyMap(){img.style.transform="translate("+offsetX+"px,"+offsetY+"px) scale("+scale+")";}
viewport.addEventListener("wheel",e=>{e.preventDefault();scale=Math.max(.65,Math.min(2.8,scale+(e.deltaY<0?.12:-.12)));applyMap();},{passive:false});
viewport.addEventListener("pointerdown",e=>{drag=true;startX=e.clientX-offsetX;startY=e.clientY-offsetY;viewport.setPointerCapture(e.pointerId);});
viewport.addEventListener("pointermove",e=>{if(!drag)return;offsetX=e.clientX-startX;offsetY=e.clientY-startY;applyMap();});
viewport.addEventListener("pointerup",()=>{drag=false});
$("#resetMap").addEventListener("click",()=>{scale=1;offsetX=0;offsetY=0;applyMap()});

loadData().catch(err=>{$("#dataState").textContent="Chyba načtení dat";console.error(err)});