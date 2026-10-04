const state={customers:[],recipes:[],selectedCustomer:null};
const $=s=>document.querySelector(s);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function showTab(name){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));window.scrollTo({top:0,behavior:"smooth"});}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
document.querySelectorAll("[data-tab-jump]").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tabJump)));

async function loadData(){
 const [c,r]=await Promise.all([
  fetch("./data/customers.json",{cache:"no-store"}).then(x=>x.json()),
  fetch("./data/recipes.json",{cache:"no-store"}).then(x=>x.json())
 ]);
 state.customers=Array.isArray(c.customers)?c.customers:[];
 state.recipes=Array.isArray(r.recipes)?r.recipes:[];
 $("#customerCountBadge").textContent=state.customers.length;
 const districts=[...new Set(state.customers.map(x=>x.district))].sort();
 $("#districtFilter").insertAdjacentHTML("beforeend",districts.map(d=>"<option>"+esc(d)+"</option>").join(""));
 $("#customerSummary").textContent=state.customers.length+" zákazníků v databázi";
 renderCustomers();renderRecipes();
}
function cMatches(c,q,d,t){if(d&&c.district!==d)return false;if(t&&c.tier!==t)return false;if(!q)return true;return[c.name,c.district,c.tier,...c.preferred_effects].join(" ").toLowerCase().includes(q);}
function renderCustomers(){
 const q=$("#customerSearch").value.trim().toLowerCase(),d=$("#districtFilter").value,t=$("#tierFilter").value;
 const list=state.customers.filter(c=>cMatches(c,q,d,t));
 $("#customerSummary").textContent=list.length+" z "+state.customers.length+" zákazníků zobrazených";
 $("#customerList").innerHTML=list.map(c=>{
  const selected=c.id===state.selectedCustomer?" selected":"";
  const effects=c.preferred_effects.length?c.preferred_effects.map(e=>"<span class='effect'>"+esc(e)+"</span>").join(""):"<span class='meta'>Bez preferovaného efektu</span>";
  return "<article class='customer-card"+selected+"' data-id='"+c.id+"'><div class='customer-name'>"+esc(c.name)+"</div><div class='meta'>"+esc(c.district)+" · "+esc(c.tier)+" · $"+c.budget+" / deal · "+esc(c.orders_per_week)+" / týden</div><div class='effects'>"+effects+"</div></article>";
 }).join("")||"<div class='empty'>Žádný zákazník neodpovídá filtru.</div>";
 document.querySelectorAll(".customer-card").forEach(el=>el.addEventListener("click",()=>{state.selectedCustomer=Number(el.dataset.id);renderCustomers();}));
 renderCustomerDetail();
}
function renderCustomerDetail(){
 const c=state.customers.find(x=>x.id===state.selectedCustomer);
 if(!c){$("#customerDetail").innerHTML="<div class='empty'>Vyber zákazníka.</div>";return;}
 const effects=c.preferred_effects.length?c.preferred_effects.map(e=>"<span class='effect'>"+esc(e)+"</span>").join(""):"<span class='meta'>Žádné preference</span>";
 $("#customerDetail").innerHTML="<div class='label'>Customer profile</div><h3>"+esc(c.name)+"</h3><div class='meta'>"+esc(c.district)+" · "+esc(c.tier)+"</div><div class='detail-row'><span>Budget / deal</span><b>$"+c.budget+"</b></div><div class='detail-row'><span>Orders / week</span><b>"+esc(c.orders_per_week)+"</b></div><div class='detail-row'><span>Mapa</span><b>Souřadnice čekají na ověření</b></div><div style='margin-top:12px'><div class='meta'>Preferred effects</div><div class='effects'>"+effects+"</div></div>";
}
function rMatches(r,q,d){if(d&&r.drug!==d)return false;if(!q)return true;return[r.name,r.drug,...r.ingredients,...r.effects].join(" ").toLowerCase().includes(q);}
function renderRecipes(){
 const q=$("#recipeSearch").value.trim().toLowerCase(),d=$("#drugFilter").value;
 const list=state.recipes.filter(r=>rMatches(r,q,d));
 $("#recipeList").innerHTML=list.map(r=>"<article class='recipe-card'><div class='recipe-head'><div><div class='label'>"+esc(r.drug)+"</div><div class='recipe-name'>"+esc(r.name)+"</div></div><div class='numbers'><div class='metric'>Náklad<b>$"+r.cost+"</b></div><div class='metric'>Prodej<b>$"+r.sell+"</b></div><div class='metric'>Profit<b>$"+r.profit+"</b></div></div></div><div class='ingredients'><b>Ingredience v pořadí:</b> "+r.ingredients.map(esc).join(" → ")+"</div><div class='effects'>"+r.effects.map(e=>"<span class='effect'>"+esc(e)+"</span>").join("")+"</div><div class='source'>"+esc(r.source)+(r.customers!=null?" · "+r.customers+" vhodných zákazníků":"")+"</div></article>").join("")||"<div class='empty'>Žádný recept neodpovídá hledání.</div>";
}
$("#customerSearch").addEventListener("input",renderCustomers);$("#districtFilter").addEventListener("change",renderCustomers);$("#tierFilter").addEventListener("change",renderCustomers);$("#recipeSearch").addEventListener("input",renderRecipes);$("#drugFilter").addEventListener("change",renderRecipes);

let scale=1,ox=0,oy=0,drag=false,sx=0,sy=0;
const vp=$("#mapViewport"),img=$("#mapImage");
function applyMap(){img.style.transform="translate("+ox+"px,"+oy+"px) scale("+scale+")";}
$("#zoomIn").addEventListener("click",()=>{scale=Math.min(3.2,scale+.18);applyMap()});
$("#zoomOut").addEventListener("click",()=>{scale=Math.max(.72,scale-.18);applyMap()});
$("#resetMap").addEventListener("click",()=>{scale=1;ox=0;oy=0;applyMap()});
vp.addEventListener("wheel",e=>{e.preventDefault();scale=Math.max(.72,Math.min(3.2,scale+(e.deltaY<0?.15:-.15)));applyMap()},{passive:false});
vp.addEventListener("pointerdown",e=>{drag=true;sx=e.clientX-ox;sy=e.clientY-oy;vp.setPointerCapture(e.pointerId)});
vp.addEventListener("pointermove",e=>{if(!drag)return;ox=e.clientX-sx;oy=e.clientY-sy;applyMap()});
vp.addEventListener("pointerup",()=>drag=false);vp.addEventListener("pointercancel",()=>drag=false);
loadData().catch(err=>{$("#customerSummary").textContent="Data se nepodařilo načíst";console.error(err);});
