
// Expense Tracker Multi-window PWA
const STORAGE = 'exp_multi_v1';
let data = { expenses: [], budget: 0 };

const views = document.querySelectorAll('.view');
const navButtons = document.querySelectorAll('.nav-btn');
const floatContainer = document.getElementById('float-container');
const tpl = document.getElementById('floating-template');
const expensesList = document.getElementById('expensesList');
const noExpenses = document.getElementById('noExpenses');
const totalSpentEl = document.getElementById('totalSpent');
const monthSpentEl = document.getElementById('monthSpent');
const budgetValueEl = document.getElementById('budgetValue');
const chartCanvas = document.getElementById('chart');
const installBtn = document.getElementById('installBtn');

function load(){ const raw = localStorage.getItem(STORAGE); if(raw) data = JSON.parse(raw); renderAll(); }
function save(){ localStorage.setItem(STORAGE, JSON.stringify(data)); }

// Router
function navigate(route){ document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); const t = document.getElementById('view-'+route); if(t) t.classList.add('active'); navButtons.forEach(b=>b.classList.toggle('active', b.dataset.route===route)); }
document.querySelectorAll('[data-route]').forEach(btn=> btn.addEventListener('click', ()=> navigate(btn.dataset.route)));
navButtons.forEach(b=> b.addEventListener('click', ()=> navigate(b.dataset.route)));

// Draggable helper
function makeDraggable(el){
  let startX=0,startY=0,origX=0,origY=0,dragging=false;
  const header = el.querySelector('.fw-header');
  header.addEventListener('pointerdown', e=>{ dragging=true; startX=e.clientX; startY=e.clientY; el.setPointerCapture && el.setPointerCapture(e.pointerId); });
  header.addEventListener('pointermove', e=>{ if(!dragging) return; const dx=e.clientX-startX, dy=e.clientY-startY; el.style.transform = `translate(${origX+dx}px, ${origY+dy}px)`; });
  header.addEventListener('pointerup', e=>{ dragging=false; const tr = el.style.transform; if(tr && tr.startsWith('translate(')){ const vals = tr.replace('translate(','').replace(')','').split(','); origX = parseFloat(vals[0])||0; origY = parseFloat(vals[1])||0; } });
}

// Improved openFloating (measures and clamps to viewport)
function openFloating(title, html){
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.querySelector('.fw-title').textContent = title;
  node.querySelector('.fw-body').innerHTML = html;
  node.style.visibility='hidden'; node.style.opacity='0'; node.style.left='0px'; node.style.top='0px'; node.style.transform='none';
  floatContainer.appendChild(node);
  requestAnimationFrame(()=>{
    const win = { w: window.innerWidth, h: window.innerHeight };
    const rect = node.getBoundingClientRect(); const nw = rect.width; const nh = rect.height;
    let left = (win.w - nw)/2; let top = (win.h - nh)/2; const M = 12;
    if(left < M) left = M; if(top < M) top = M;
    if(left + nw + M > win.w) left = Math.max(M, win.w - nw - M);
    if(top + nh + M > win.h) top = Math.max(M, win.h - nh - M);
    node.style.left = Math.round(left) + 'px'; node.style.top = Math.round(top) + 'px'; node.style.position='fixed';
    node.style.maxHeight = (win.h - 2*M) + 'px'; node.style.overflow='auto';
    node.style.visibility='visible'; node.style.opacity='1'; node.style.transition='transform .15s, opacity .12s'; node.style.transform='translateY(0)';
    const closeBtn = node.querySelector('.fw-close'); if(closeBtn) closeBtn.addEventListener('click', ()=> node.remove());
    const minBtn = node.querySelector('.fw-minimize'); if(minBtn) minBtn.addEventListener('click', ()=> node.style.display='none');
    makeDraggable(node);
  });
  return node;
}

// Expense functions
function addExpense(exp){
  data.expenses.push(exp); save(); renderAll(); notify('Expense added', `${exp.category}: ₹${exp.amount}`);
  checkBudget();
}

function updateExpense(id, patch){
  const e = data.expenses.find(x=>x.id===id); if(!e) return;
  Object.assign(e, patch); save(); renderAll(); notify('Expense updated', `${e.category}: ₹${e.amount}`); checkBudget();
}

function deleteExpense(id){
  data.expenses = data.expenses.filter(x=>x.id!==id); save(); renderAll(); notify('Expense deleted', 'Entry removed'); 
}

// UI render
function renderAll(){
  renderExpenses(); renderSummary(); renderChart();
}

function renderExpenses(){
  expensesList.innerHTML=''; if(!data.expenses || data.expenses.length===0){ noExpenses.style.display='block'; return; } else noExpenses.style.display='none';
  data.expenses.slice().reverse().forEach(e=>{
    const div = document.createElement('div'); div.className='expense';
    const left = document.createElement('div'); left.innerHTML = `<div style="font-weight:700">${e.title}</div><div class="muted">${e.category} • ${e.date}</div>`;
    const right = document.createElement('div');
    const amt = document.createElement('div'); amt.style.fontWeight='800'; amt.textContent = '₹'+e.amount;
    const edit = document.createElement('button'); edit.className='btn'; edit.textContent='Edit'; edit.addEventListener('click', ()=> openEditExpense(e.id));
    const del = document.createElement('button'); del.className='btn'; del.textContent='Delete'; del.addEventListener('click', ()=> { if(confirm('Delete this expense?')) deleteExpense(e.id); });
    right.appendChild(amt); right.appendChild(edit); right.appendChild(del);
    div.appendChild(left); div.appendChild(right); expensesList.appendChild(div);
  });
}

function renderSummary(){
  const total = data.expenses.reduce((s,x)=>s + Number(x.amount), 0);
  const now = new Date(); const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;
  const monthTotal = data.expenses.filter(x=> x.date && x.date.startsWith(now.toISOString().slice(0,7))).reduce((s,x)=>s + Number(x.amount), 0);
  totalSpentEl.textContent = '₹' + total;
  monthSpentEl.textContent = '₹' + monthTotal;
  budgetValueEl.textContent = '₹' + (data.budget || 0);
}

function renderChart(){
  const ctx = chart.getContext('2d'); ctx.clearRect(0,0,chart.width,chart.height);
  // simple category totals
  const totals = {};
  data.expenses.forEach(e=> totals[e.category] = (totals[e.category] || 0) + Number(e.amount));
  const cats = Object.keys(totals); if(cats.length===0) return;
  const vals = cats.map(c=>totals[c]);
  // draw bars
  const w = chart.width; const h = chart.height; const bw = w / (cats.length*2);
  ctx.fillStyle = '#3b82f6';
  vals.forEach((v,i)=>{ const x = i*(bw*2)+bw/2; const bh = (v/Math.max(...vals))* (h-30); ctx.fillRect(x, h-20-bh, bw, bh); ctx.fillStyle='#000'; ctx.fillText(cats[i], x, h-4); ctx.fillStyle='#3b82f6'; });
}

// Add/Edit windows
document.getElementById('addExpenseBtn').addEventListener('click', ()=> openAddExpense());
document.getElementById('openQuickAdd').addEventListener('click', ()=> openQuickAdd());

function openQuickAdd(){
  const html = `<form id="quickForm">
    <input id="qtitle" placeholder="Title" required/>
    <input id="qamount" type="number" placeholder="Amount" required/>
    <select id="qcat"><option>Food</option><option>Transport</option><option>Shopping</option><option>Other</option></select>
    <div class="row"><button class="btn primary" type="submit">Add</button></div>
  </form>`;
  const win = openFloating('Quick Add', html);
  const form = win.querySelector('#quickForm');
  form.addEventListener('submit', (e)=>{ e.preventDefault(); const t = win.querySelector('#qtitle').value.trim(); const a = Number(win.querySelector('#qamount').value); const c = win.querySelector('#qcat').value; if(!t || !a) return alert('Enter title & amount'); addExpense({ id: Date.now().toString(), title: t, amount: a, category: c, date: new Date().toISOString().slice(0,10) }); win.remove(); });
}

function openAddExpense(){
  const html = `<form id="addForm">
    <input id="title" placeholder="Title" required/>
    <input id="amount" type="number" placeholder="Amount" required/>
    <select id="category"><option>Food</option><option>Transport</option><option>Shopping</option><option>Other</option></select>
    <label>Date</label>
    <input id="edate" type="date" value="${new Date().toISOString().slice(0,10)}"/>
    <div class="row"><button class="btn primary" type="submit">Save</button></div>
  </form>`;
  const win = openFloating('Add Expense', html);
  const form = win.querySelector('#addForm');
  form.addEventListener('submit', (e)=>{ e.preventDefault(); const t = win.querySelector('#title').value.trim(); const a = Number(win.querySelector('#amount').value); const c = win.querySelector('#category').value; const d = win.querySelector('#edate').value; if(!t || !a) return alert('Enter title & amount'); addExpense({ id: Date.now().toString(), title: t, amount: a, category: c, date: d }); win.remove(); });
}

function openEditExpense(id){
  const e = data.expenses.find(x=>x.id===id); if(!e) return;
  const html = `<form id="editForm">
    <input id="etitle" value="${e.title}" required/>
    <input id="eamount" type="number" value="${e.amount}" required/>
    <select id="ecat"><option${e.category==='Food'?' selected':''}>Food</option><option${e.category==='Transport'?' selected':''}>Transport</option><option${e.category==='Shopping'?' selected':''}>Shopping</option><option${e.category==='Other'?' selected':''}>Other</option></select>
    <label>Date</label>
    <input id="edate" type="date" value="${e.date}"/>
    <div class="row"><button class="btn primary" type="submit">Update</button></div>
  </form>`;
  const win = openFloating('Edit Expense', html);
  const form = win.querySelector('#editForm');
  form.addEventListener('submit', (ev)=>{ ev.preventDefault(); const t = win.querySelector('#etitle').value.trim(); const a = Number(win.querySelector('#eamount').value); const c = win.querySelector('#ecat').value; const d = win.querySelector('#edate').value; if(!t || !a) return alert('Enter title & amount'); updateExpense(id, { title: t, amount: a, category: c, date: d }); win.remove(); });
}

// Notifications + budget check
function notify(title, body){
  // play beep (WebAudio)
  try{ const ctx = new (window.AudioContext||window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.type='sine'; o.frequency.value=880; g.gain.value=0.06; o.connect(g); g.connect(ctx.destination); o.start(); setTimeout(()=>{ o.stop(); try{ ctx.close(); }catch(e){} }, 500); }catch(e){}
  // SW notification if available
  if(navigator.serviceWorker && navigator.serviceWorker.controller){
    navigator.serviceWorker.controller.postMessage({ type:'notify', title, body });
  } else if('Notification' in window && Notification.permission==='granted'){
    new Notification(title, { body });
  }
}

function checkBudget(){
  const total = data.expenses.reduce((s,x)=>s + Number(x.amount), 0);
  if(data.budget && total > Number(data.budget)){
    notify('Budget exceeded', `You have spent ₹${total} which is above your budget ₹${data.budget}`);
  }
}

// Export CSV
document.getElementById('exportBtn').addEventListener('click', ()=>{
  if(!data.expenses || data.expenses.length===0) return alert('No data to export');
  const rows = [['Title','Amount','Category','Date']].concat(data.expenses.map(e=>[e.title,e.amount,e.category,e.date]));
  const csv = rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='expenses.csv'; a.click();
});

// Budget save/clear
document.getElementById('saveBudget').addEventListener('click', ()=>{ const v = Number(document.getElementById('budgetInput').value); data.budget = v; save(); renderSummary(); alert('Budget saved'); });
document.getElementById('clearAll').addEventListener('click', ()=>{ if(confirm('Clear all data?')){ data = { expenses: [], budget: 0 }; save(); renderAll(); } });

// Notification permission
document.getElementById('notifyPermBtn').addEventListener('click', async ()=>{ if(!('Notification' in window)) return alert('No Notification API'); const p = await Notification.requestPermission(); alert('Permission: '+p); });

// SW register
if('serviceWorker' in navigator){ navigator.serviceWorker.register('service-worker.js').then(()=>console.log('SW reg')).catch(e=>console.warn(e)); }

// Install prompt
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredInstall = e; installBtn.style.display = 'inline-block'; });
installBtn.addEventListener('click', async ()=>{ if(!deferredInstall) return; deferredInstall.prompt(); const choice = await deferredInstall.userChoice; deferredInstall=null; installBtn.style.display='none'; });

// Listen to messages from SW
navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', event=>{ const d = event.data; if(d && d.type==='notif-click'){ console.log('Notification clicked', d.data); navigate('expenses'); } });

// Boot
load();
setInterval(()=>{ renderAll(); }, 5000);
