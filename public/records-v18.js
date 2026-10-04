
(function(){
"use strict";

const style=document.createElement("style");
style.textContent=`
.record-tabs{display:flex;gap:6px;margin:0 0 14px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:5px;width:max-content;max-width:100%}
.record-tabs button{border:0;background:transparent;border-radius:10px;padding:10px 16px;font-weight:850;color:var(--muted)}.record-tabs button.active{background:var(--dark);color:#fff}
.compact-section{padding:15px 17px}.record-select{border:1px solid var(--line);border-radius:10px;background:#fff;padding:9px 11px;font-weight:750;min-width:150px}
.activity-list{display:grid;gap:8px}.activity-row{display:grid;grid-template-columns:88px minmax(0,1fr) auto auto;gap:12px;align-items:center;border:1px solid var(--line);border-radius:13px;padding:12px;background:#fff}
.activity-date{font-size:12px;color:var(--muted);font-weight:750}.activity-main{min-width:0}.activity-title{display:flex;align-items:center;gap:7px;min-width:0}.activity-title b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}
.activity-meta{font-size:11px;color:var(--muted);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.activity-money{min-width:100px;text-align:right;white-space:nowrap}.activity-actions{display:flex;gap:5px;justify-content:flex-end}
.record-toolbar{display:flex;justify-content:space-between;align-items:end;gap:14px;flex-wrap:wrap}.record-date-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;min-width:300px}
.record-team-checks{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}.record-team-checks label{cursor:pointer}.record-team-checks input{position:absolute;opacity:0;pointer-events:none}
.record-team-checks span{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:7px 11px;font-size:12px;font-weight:850;background:#fff}
.record-team-checks input:checked+span{box-shadow:inset 0 0 0 2px var(--check-color);border-color:var(--check-color)}.record-summary{margin-top:15px}.table-scroll{width:100%;overflow:auto;-webkit-overflow-scrolling:touch}
.event-top{display:flex;justify-content:space-between;align-items:end;gap:10px}.event-select-wrap label{display:block;font-size:11px;color:var(--muted);font-weight:800;margin-bottom:5px}.event-select-wrap .record-select{min-width:min(360px,62vw)}
.event-head-card{padding-top:16px}.event-head-copy{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}.event-head-copy h2{margin:0 0 5px}.event-head-actions{display:flex;gap:6px}
.modal-wide{width:min(760px,100%);max-height:88vh;overflow:auto}.event-picker-tools{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin:12px 0}
.event-picker-list{display:grid;gap:6px;max-height:48vh;overflow:auto;padding-right:2px}.event-pick-row{display:grid;grid-template-columns:auto 88px minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:11px;padding:10px;cursor:pointer}
.event-pick-row input{width:18px;height:18px}.event-pick-date{font-size:11px;color:var(--muted)}.event-pick-main{min-width:0}.event-pick-main b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.event-pick-main small{display:block;color:var(--muted);font-size:11px;margin-top:3px}
@media(max-width:720px){.record-tabs{width:100%}.record-tabs button{flex:1}.activity-row{grid-template-columns:72px minmax(0,1fr) auto;gap:8px;padding:11px}.activity-actions{grid-column:2/-1;justify-content:flex-start}.activity-money{min-width:0}.record-date-pair{width:100%;min-width:0}.record-toolbar{align-items:stretch}.event-head-copy{flex-direction:column}.event-head-actions{width:100%}.event-head-actions button{flex:1}.event-picker-tools{grid-template-columns:1fr 1fr}.event-picker-tools button{grid-column:1/-1}.event-pick-row{grid-template-columns:auto minmax(0,1fr) auto}.event-pick-date{display:none}}
@media(max-width:480px){.activity-row{grid-template-columns:62px minmax(0,1fr)}.activity-money{grid-column:2;text-align:left}.activity-actions{grid-column:2}.event-top{align-items:stretch;flex-direction:column}.event-select-wrap,.event-select-wrap .record-select{width:100%}.event-pick-row{grid-template-columns:auto minmax(0,1fr)}.event-pick-row>strong{grid-column:2}}
`;
document.head.appendChild(style);

function ensureRecordState(x){
  x.balanceAdjustments=Array.isArray(x.balanceAdjustments)?x.balanceAdjustments:[];
  x.events=Array.isArray(x.events)?x.events:[];
  x.activityLog=Array.isArray(x.activityLog)?x.activityLog:[];
  x.events=x.events.map(ev=>({
    id:ev.id??Date.now()+Math.random(),
    name:String(ev.name||"이벤트"),
    startDate:String(ev.startDate||""),
    endDate:String(ev.endDate||ev.startDate||""),
    memo:String(ev.memo||""),
    links:Array.isArray(ev.links)?[...new Set(ev.links.map(String))]:[],
    createdAt:ev.createdAt||new Date().toISOString()
  }));
  return x;
}

const oldNormalize=normalizeState;
normalizeState=function(s){return ensureRecordState(oldNormalize(s));};
ensureRecordState(state);

let activityKindFilter="all";
let recordViewMode="period";
let recordStart=todayISO().slice(0,8)+"01";
let recordEnd=todayISO();
let recordTeams=new Set(["강신나","허슬","엘리븐","로아미"]);
let recordEventId=null;
let eventPickerStart="";
let eventPickerEnd="";

function kindLabel(k){return {sale:"매출",expense:"지출",plan:"예정",budget:"예산",transfer:"자금이동",balance:"잔액조정",other:"기타"}[k]||"기타";}
function kindPill(k){if(k==="sale")return "ok";if(k==="expense")return "danger";if(k==="plan"||k==="budget")return "wait";return "";}
function amountHtml(item){
  if(item.amount===null||item.amount===undefined||item.amount==="")return "";
  const n=Number(item.amount)||0;
  const sign=item.sign!==undefined?item.sign:(n>0?"+":n<0?"-":"");
  const cls=sign==="+"?"money-income":sign==="-"?"money-expense":"";
  return `<strong class="${cls}">${sign}${won(Math.abs(n))}</strong>`;
}
function sortActivities(a,b){
  const ad=String(a.createdAt||a.date||""),bd=String(b.createdAt||b.date||"");
  if(ad!==bd)return bd.localeCompare(ad);
  return Number(b.id||0)-Number(a.id||0);
}
function actionButtons(x){
  if(x.kind==="sale")return `<button class="soft-btn" onclick="editSale(${x.id})">수정</button><button class="soft-btn" onclick="deleteSale(${x.id})">삭제</button>`;
  if(x.kind==="expense")return `<button class="soft-btn" onclick="editExpense(${x.id})">수정</button><button class="soft-btn" onclick="deleteExpense(${x.id})">삭제</button>`;
  if(x.kind==="plan"&&x.status==="planned"&&!x.isRecurring)return `<button class="soft-btn" onclick="editPlan(${x.id})">수정</button><button class="soft-btn" onclick="deletePlan(${x.id})">삭제</button>`;
  if(x.kind==="transfer"&&x.transferType==="내부이동")return `<button class="soft-btn" onclick="editTransferRecord(${x.id})">수정</button>`;
  if(x.kind==="balance")return `<button class="soft-btn" onclick="editBalanceRecord(${x.id})">수정</button>`;
  if(x.kind==="budget"&&x.status==="요청")return `<button class="soft-btn" onclick="editBudgetRequestRecord(${x.id})">수정</button>`;
  return "";
}
function teamActivities(team){
  const arr=[];
  (state.sales||[]).filter(x=>x.team===team).forEach(x=>arr.push({id:x.id,kind:"sale",date:x.receivedAt||x.date,team,title:x.name,amount:x.amount,sign:"+",status:x.status,meta:`${x.status}${x.account?` · ${x.account} 계좌`:""}${x.updatedAt?" · 수정됨":""}`}));
  (state.expenses||[]).filter(x=>x.team===team).forEach(x=>arr.push({id:x.id,kind:"expense",date:x.date,team,title:x.name,amount:x.amount,sign:"-",status:"완료",meta:`${x.account||team} 결제 · 사용 ${x.expenseFor||x.team}${x.updatedAt?" · 수정됨":""}`}));
  (state.plans||[]).filter(x=>x.team===team&&x.status==="planned").forEach(x=>arr.push({id:x.id,kind:"plan",date:x.date,team,title:x.name,amount:x.amount,sign:x.type==="expense"?"-":"+",status:x.status,isRecurring:!!x.isRecurring,meta:`${x.type==="expense"?"예상 지출":"예상 매출"}${x.isRecurring?" · 고정":""}${x.updatedAt?" · 수정됨":""}`}));
  (state.budgetRequests||[]).filter(x=>x.team===team).forEach(x=>arr.push({id:x.id,kind:"budget",date:String(x.createdAt||x.weekStart||todayISO()).slice(0,10),team,title:x.requestType==="추가"?"추가 예산 요청":"주간 예산 요청",amount:x.requestedAmount,sign:"+",status:x.status,meta:`${weekLabelInfo(x.weekStart).label} · ${x.status}${x.memo?` · ${x.memo}`:""}${x.updatedAt?" · 수정됨":""}`}));
  (state.transfers||[]).filter(x=>x.from===team||x.to===team).forEach(x=>{
    const incoming=x.to===team;
    arr.push({id:x.id,kind:"transfer",date:x.date||todayISO(),team,title:x.type==="예산지급"?"예산 지급":"내부 자금이동",amount:x.amount,sign:incoming?"+":"-",status:"완료",transferType:x.type,meta:`${x.from} → ${x.to}${x.memo?` · ${x.memo}`:""}${x.updatedAt?" · 수정됨":""}`});
  });
  (state.balanceAdjustments||[]).filter(x=>x.team===team).forEach(x=>arr.push({id:x.id,kind:"balance",date:x.date||String(x.createdAt||todayISO()).slice(0,10),team,title:"잔액 맞추기",amount:Math.abs(Number(x.delta)||0),sign:Number(x.delta)>=0?"+":"-",status:"완료",meta:`${won(x.before)} → ${won(x.after)}${x.memo?` · ${x.memo}`:""}${x.updatedAt?" · 수정됨":""}`}));
  (state.activityLog||[]).filter(x=>x.team===team).forEach(x=>arr.push({id:x.id,kind:x.kind||"other",date:x.date||String(x.createdAt||todayISO()).slice(0,10),team,title:x.title||"기록",amount:x.amount===undefined?null:Math.abs(Number(x.amount)||0),sign:Number(x.amount)>0?"+":Number(x.amount)<0?"-":"",status:"완료",meta:x.memo||""}));
  return arr.sort(sortActivities);
}
window.setActivityKind=function(v){activityKindFilter=v;renderApp();};
function activityFilterHtml(){
  const kinds=[["all","전체"],["sale","매출"],["expense","지출"],["plan","예정"],["budget","예산"],["transfer","자금"],["balance","잔액"]];
  return `<section class="section compact-section"><div class="history-filter"><div class="history-filter-row"><div><div class="history-filter-label">조회 기간</div><div class="filter-group" style="margin-top:6px"><button class="filter-btn ${ledgerRangeMode==="week"?"active":""}" onclick="setLedgerRange('week')">선택 주</button><button class="filter-btn ${ledgerRangeMode==="month"?"active":""}" onclick="setLedgerRange('month')">이번 달</button><button class="filter-btn ${ledgerRangeMode==="custom"?"active":""}" onclick="setLedgerRange('custom')">기간 선택</button></div></div><div><div class="history-filter-label">활동 종류</div><select class="record-select" onchange="setActivityKind(this.value)">${kinds.map(([v,l])=>`<option value="${v}" ${activityKindFilter===v?"selected":""}>${l}</option>`).join("")}</select></div></div>${ledgerRangeMode==="custom"?`<div class="history-filter-row"><div class="history-date-range"><div class="field"><label>시작일</label><input type="date" value="${ledgerCustomStart}" onchange="setLedgerCustom('start',this.value)"></div><div class="field"><label>종료일</label><input type="date" value="${ledgerCustomEnd}" onchange="setLedgerCustom('end',this.value)"></div></div></div>`:""}</div></section>`;
}
historyPage=function(team){
  const r=ledgerRangeDates();
  const items=teamActivities(team).filter(x=>x.date>=r.start&&x.date<=r.end&&(activityKindFilter==="all"||x.kind===activityKindFilter));
  return `<div class="page-head"><div><h1>활동 내역</h1><div class="sub">${team}에서 발생한 매출·지출·예산·자금이동·잔액조정을 한 곳에서 확인합니다.</div></div></div>${activityFilterHtml()}<section class="section"><div class="section-title"><h2>조회 내역</h2><div class="hint">${r.start} ~ ${r.end} · ${items.length}건</div></div>${items.length?`<div class="activity-list">${items.map(x=>`<div class="activity-row"><div class="activity-date">${safeText(x.date||"-")}</div><div class="activity-main"><div class="activity-title"><span class="pill ${kindPill(x.kind)}">${kindLabel(x.kind)}</span><b>${safeText(x.title)}</b></div><div class="activity-meta">${safeText(x.meta||"")}</div></div><div class="activity-money">${amountHtml(x)}</div><div class="activity-actions">${actionButtons(x)}</div></div>`).join("")}</div>`:`<div class="empty">선택한 기간에 해당하는 활동이 없습니다.</div>`}</section>`;
};

window.saveBalance=function(team){
  ensureRecordState(state);
  const before=Number(state.accounts[team])||0;
  const v=parseMoney(document.getElementById("balVal").value);
  const memo=document.getElementById("balMemo").value||"잔액 조정";
  const delta=v-before;
  if(delta===0){closeModal();return showToast("잔액 변동이 없습니다.",`${team} · ${won(v)}`);}
  state.accounts[team]=v;
  state.balanceAdjustments.push({id:Date.now(),team,date:todayISO(),before,after:v,delta,memo,createdAt:new Date().toISOString()});
  notify("강신나",`${team} 잔액 조정`,`${won(before)} → ${won(v)} · ${delta>=0?"+":""}${won(delta)} · ${memo}`);
  if(team!=="강신나")notify(team,"계좌잔액 조정",`현재 계좌잔액이 ${won(v)}으로 수정되었습니다.`);
  saveState();closeModal();showToast("계좌잔액이 수정되었습니다.",`${team} · ${delta>=0?"+":""}${won(delta)}`);renderApp();
};
window.editBalanceRecord=function(id){
  const a=(state.balanceAdjustments||[]).find(x=>String(x.id)===String(id));if(!a)return;
  document.getElementById("modalRoot").innerHTML=`<div class="modal-back"><div class="modal"><h3>잔액 조정 수정</h3><p>조정금액의 차이만큼 현재 계좌잔액에도 다시 반영됩니다.</p><div class="form-grid"><div class="field"><label>날짜</label><input id="baDate" type="date" value="${safeText(a.date||todayISO())}"></div><div class="field"><label>조정금액 (+ / -)</label><input id="baDelta" value="${Number(a.delta)||0}"></div><div class="field" style="grid-column:1/-1"><label>사유</label><input id="baMemo" value="${safeText(a.memo||"")}"></div></div><div class="form-actions"><button class="ghost" onclick="closeModal()">취소</button><button class="primary" onclick="saveBalanceRecordEdit(${id})">수정 저장</button></div></div></div>`;
};
window.saveBalanceRecordEdit=function(id){
  const a=(state.balanceAdjustments||[]).find(x=>String(x.id)===String(id));if(!a)return;
  const raw=String(document.getElementById("baDelta").value||"").trim();
  const newDelta=parseMoney(raw)*(raw.startsWith("-")?-1:1);
  const diff=newDelta-(Number(a.delta)||0);
  state.accounts[a.team]=(Number(state.accounts[a.team])||0)+diff;
  Object.assign(a,{delta:newDelta,after:(Number(a.before)||0)+newDelta,date:document.getElementById("baDate").value||a.date,memo:document.getElementById("baMemo").value.trim()||"잔액 조정",updatedAt:new Date().toISOString()});
  saveState();closeModal();showToast("잔액 조정 기록이 수정되었습니다.",`${a.team} · ${newDelta>=0?"+":""}${won(newDelta)}`);renderApp();
};

window.saveWeekRemain=function(team){
  ensureRecordState(state);
  const b=getWeekBudget(team),before=Number(b.unused)||0;
  const v=parseMoney(document.getElementById("weekRemain").value),cash=teamAccountCash(team);
  if(v>cash)return alert(`실제 ${team} 계좌잔액 ${won(cash)}보다 큰 미사용예산은 저장할 수 없습니다.`);
  b.unused=v;syncBudgetMirror();
  state.activityLog.push({id:Date.now(),team,kind:"budget",date:todayISO(),title:"주말 예산 정산",amount:v-before,memo:`${weekLabelInfo().label} · ${won(before)} → ${won(v)}`,createdAt:new Date().toISOString()});
  saveState();notify("강신나",`${team} 주말 정산`,`${weekLabelInfo().label} 남은 예산 ${won(v)}으로 정산되었습니다.`);showToast("주간 잔액이 저장되었습니다.",`${weekLabelInfo().label} · ${won(v)}`);renderApp();
};
window.reconcileBudgetToCash=function(team,weekStart=selectedWeekStart){
  ensureRecordState(state);
  const b=getWeekBudget(team,weekStart),before=Math.max(0,Number(b.unused)||0),cash=teamAccountCash(team),after=Math.min(before,cash);
  if(after===before)return showToast("예산과 계좌잔액이 이미 맞습니다.",`${team} · ${won(after)}`);
  openConfirm("미사용예산 맞추기",`${weekLabelInfo(weekStart).label} 장부상 미사용예산 ${won(before)}을 현재 ${team} 계좌잔액 기준 ${won(after)}으로 낮출까요? 승인예산 기록은 유지됩니다.`,()=>{
    b.unused=after;syncBudgetMirror();
    state.activityLog.push({id:Date.now(),team,kind:"budget",date:todayISO(),title:"예산잔액 맞추기",amount:after-before,memo:`${weekLabelInfo(weekStart).label} · ${won(before)} → ${won(after)}`,createdAt:new Date().toISOString()});
    notify("강신나",`${team} 예산잔액 조정`,`${weekLabelInfo(weekStart).label} 미사용예산 ${won(before)} → ${won(after)} · 실제 계좌잔액 기준`);
    notify(team,"미사용예산 조정",`${weekLabelInfo(weekStart).label} 미사용예산이 실제 계좌잔액 기준 ${won(after)}으로 조정되었습니다.`);
    saveState();showToast("미사용예산을 실제 잔액에 맞췄습니다.",`${won(before)} → ${won(after)}`);renderApp();
  },"맞추기");
};

const oldSaleEdit=window.saveSaleEdit;
window.saveSaleEdit=function(id){oldSaleEdit(id);const x=state.sales.find(v=>String(v.id)===String(id));if(x){x.updatedAt=new Date().toISOString();saveState();}};
const oldExpenseEdit=window.saveExpenseEdit;
window.saveExpenseEdit=function(id){oldExpenseEdit(id);const x=state.expenses.find(v=>String(v.id)===String(id));if(x){x.updatedAt=new Date().toISOString();saveState();}};
const oldPlanEdit=window.savePlanEdit;
window.savePlanEdit=function(id){oldPlanEdit(id);const x=state.plans.find(v=>String(v.id)===String(id));if(x){x.updatedAt=new Date().toISOString();saveState();}};

window.editTransferRecord=function(id){
  const t=(state.transfers||[]).find(x=>String(x.id)===String(id));if(!t||t.type!=="내부이동")return;
  const teams=["강신나","허슬","엘리븐","로아미"];
  document.getElementById("modalRoot").innerHTML=`<div class="modal-back"><div class="modal"><h3>자금이동 수정</h3><p>기존 이동을 되돌린 뒤 수정한 내용으로 다시 반영합니다.</p><div class="form-grid"><div class="field"><label>보내는 계좌</label><select id="etFrom">${teams.map(v=>`<option ${v===t.from?"selected":""}>${v}</option>`).join("")}</select></div><div class="field"><label>받는 계좌</label><select id="etTo">${teams.map(v=>`<option ${v===t.to?"selected":""}>${v}</option>`).join("")}</select></div><div class="field"><label>날짜</label><input id="etDate" type="date" value="${safeText(t.date||todayISO())}"></div><div class="field"><label>금액</label><input id="etAmount" value="${Number(t.amount)||0}"></div><div class="field" style="grid-column:1/-1"><label>메모</label><input id="etMemo" value="${safeText(t.memo||"")}"></div></div><div class="form-actions"><button class="ghost" onclick="closeModal()">취소</button><button class="primary" onclick="saveTransferRecordEdit(${id})">수정 저장</button></div></div></div>`;
};
window.saveTransferRecordEdit=function(id){
  const t=(state.transfers||[]).find(x=>String(x.id)===String(id));if(!t||t.type!=="내부이동")return;
  const from=document.getElementById("etFrom").value,to=document.getElementById("etTo").value,amount=parseMoney(document.getElementById("etAmount").value),date=document.getElementById("etDate").value,memo=document.getElementById("etMemo").value.trim()||"내부 자금이동";
  if(from===to)return alert("서로 다른 계좌를 선택하세요.");if(!amount||!date)return alert("금액과 날짜를 입력하세요.");
  state.accounts[t.from]=(Number(state.accounts[t.from])||0)+Number(t.amount||0);
  state.accounts[t.to]=(Number(state.accounts[t.to])||0)-Number(t.amount||0);
  if((Number(state.accounts[from])||0)<amount&&!confirm("보내는 계좌 잔액보다 큰 금액입니다. 계속할까요?")){
    state.accounts[t.from]-=Number(t.amount||0);state.accounts[t.to]+=Number(t.amount||0);return;
  }
  state.accounts[from]-=amount;state.accounts[to]+=amount;Object.assign(t,{from,to,amount,date,memo,updatedAt:new Date().toISOString()});
  saveState();closeModal();showToast("자금이동 내역이 수정되었습니다.",`${from} → ${to} · ${won(amount)}`);renderApp();
};
window.editBudgetRequestRecord=function(id){
  const r=(state.budgetRequests||[]).find(x=>String(x.id)===String(id));if(!r||r.status!=="요청")return;
  document.getElementById("modalRoot").innerHTML=`<div class="modal-back"><div class="modal"><h3>예산 요청 수정</h3><p>아직 승인 전인 요청만 수정할 수 있습니다.</p><div class="form-grid"><div class="field"><label>요청 금액</label><input id="ebrAmount" value="${Number(r.requestedAmount)||0}"></div><div class="field"><label>메모</label><input id="ebrMemo" value="${safeText(r.memo||"")}"></div></div><div class="form-actions"><button class="ghost" onclick="closeModal()">취소</button><button class="primary" onclick="saveBudgetRequestRecordEdit(${id})">수정 저장</button></div></div></div>`;
};
window.saveBudgetRequestRecordEdit=function(id){
  const r=(state.budgetRequests||[]).find(x=>String(x.id)===String(id));if(!r||r.status!=="요청")return;
  const amount=parseMoney(document.getElementById("ebrAmount").value),memo=document.getElementById("ebrMemo").value.trim()||r.memo;
  if(!amount)return alert("요청 금액을 입력하세요.");
  r.requestedAmount=amount;r.memo=memo;r.updatedAt=new Date().toISOString();
  if(r.requestType!=="추가")r.targetAmount=(Number(r.carryover)||0)+(Number(r.currentApproved)||0)+amount;
  saveState();closeModal();showToast("예산 요청이 수정되었습니다.",`${r.team} · ${won(amount)}`);renderApp();
};

window.toggleRecordTeam=function(team,checked){if(checked)recordTeams.add(team);else recordTeams.delete(team);renderApp();};
window.setRecordViewMode=function(mode){recordViewMode=mode;renderApp();};
window.setRecordDate=function(which,v){if(!v)return;if(which==="start")recordStart=v;else recordEnd=v;if(recordStart>recordEnd){const t=recordStart;recordStart=recordEnd;recordEnd=t;}renderApp();};
window.setRecordPreset=function(mode){
  const d=new Date(todayISO()+"T00:00:00");
  if(mode==="month"){recordStart=todayISO().slice(0,8)+"01";recordEnd=monthEndISO(todayISO());}
  if(mode==="last30"){const s=new Date(d);s.setDate(s.getDate()-29);recordStart=iso(s);recordEnd=todayISO();}
  if(mode==="year"){recordStart=todayISO().slice(0,4)+"-01-01";recordEnd=todayISO().slice(0,4)+"-12-31";}
  renderApp();
};
function recordTeamChecks(){
  return `<div class="record-team-checks">${["강신나","허슬","엘리븐","로아미"].map(t=>`<label><input type="checkbox" ${recordTeams.has(t)?"checked":""} onchange="toggleRecordTeam('${t}',this.checked)"><span style="--check-color:${TEAM_META[t].color}">${t}</span></label>`).join("")}</div>`;
}
function periodSales(){return (state.sales||[]).filter(x=>recordTeams.has(x.team)&&x.status==="입금완료"&&(x.receivedAt||x.date)>=recordStart&&(x.receivedAt||x.date)<=recordEnd);}
function periodExpenses(){return (state.expenses||[]).filter(x=>recordTeams.has(x.team)&&x.date>=recordStart&&x.date<=recordEnd);}
function periodOther(){
  const out=[];
  (state.transfers||[]).filter(x=>(recordTeams.has(x.from)||recordTeams.has(x.to))&&(x.date||"")>=recordStart&&(x.date||"")<=recordEnd).forEach(x=>out.push({id:x.id,date:x.date,kind:"transfer",team:x.from,title:x.type==="예산지급"?"예산 지급":"내부 자금이동",meta:`${x.from} → ${x.to}${x.memo?` · ${x.memo}`:""}`,amount:x.amount}));
  (state.balanceAdjustments||[]).filter(x=>recordTeams.has(x.team)&&(x.date||"")>=recordStart&&(x.date||"")<=recordEnd).forEach(x=>out.push({id:x.id,date:x.date,kind:"balance",team:x.team,title:"잔액 맞추기",meta:`${won(x.before)} → ${won(x.after)}${x.memo?` · ${x.memo}`:""}`,amount:x.delta}));
  return out.sort(sortActivities);
}
function recordsHeader(){return `<div class="page-head"><div><h1>기록</h1><div class="sub">기간 또는 이벤트 기준으로 실제 매출·지출과 자금 흐름을 확인합니다.</div></div></div><div class="record-tabs"><button class="${recordViewMode==="period"?"active":""}" onclick="setRecordViewMode('period')">기간 분석</button><button class="${recordViewMode==="event"?"active":""}" onclick="setRecordViewMode('event')">이벤트 분석</button></div>`;}
function periodRecordsPage(){
  const sales=periodSales(),expenses=periodExpenses();
  const revenue=sales.reduce((a,b)=>a+Number(b.amount||0),0),cost=expenses.reduce((a,b)=>a+Number(b.amount||0),0),profit=revenue-cost;
  const teams=["강신나","허슬","엘리븐","로아미"].filter(t=>recordTeams.has(t));
  const details=[...sales.map(x=>({kind:"sale",date:x.receivedAt||x.date,team:x.team,title:x.name,amount:x.amount,sign:"+",id:x.id,meta:`${x.account||x.team} 입금`})),...expenses.map(x=>({kind:"expense",date:x.date,team:x.team,title:x.name,amount:x.amount,sign:"-",id:x.id,meta:`사용 ${x.expenseFor||x.team}`}))].sort(sortActivities);
  const other=periodOther();
  return `${recordsHeader()}
  <section class="section compact-section"><div class="record-toolbar"><div><div class="history-filter-label">기간</div><div class="filter-group" style="margin-top:6px"><button class="filter-btn" onclick="setRecordPreset('month')">이번 달</button><button class="filter-btn" onclick="setRecordPreset('last30')">최근 30일</button><button class="filter-btn" onclick="setRecordPreset('year')">올해</button></div></div><div class="record-date-pair"><div class="field"><label>시작</label><input type="date" value="${recordStart}" onchange="setRecordDate('start',this.value)"></div><div class="field"><label>종료</label><input type="date" value="${recordEnd}" onchange="setRecordDate('end',this.value)"></div></div></div><div class="history-filter-label" style="margin-top:12px">팀 선택</div>${recordTeamChecks()}</section>
  <div class="cards record-summary">${stat("매출",won(revenue),`${sales.length}건 · 입금완료 기준`)}${stat("지출",won(cost),`${expenses.length}건`)}${stat("차액",`${profit>=0?"+":""}${won(profit)}`,`${recordStart} ~ ${recordEnd}`)}</div>
  <section class="section"><div class="section-title"><h2>팀별 요약</h2><div class="hint">선택한 팀만 합산</div></div>${teams.length?`<div class="table-scroll"><table><thead><tr><th>팀</th><th>매출</th><th>지출</th><th>차액</th></tr></thead><tbody>${teams.map(t=>{const s=sales.filter(x=>x.team===t).reduce((a,b)=>a+Number(b.amount||0),0),e=expenses.filter(x=>x.team===t).reduce((a,b)=>a+Number(b.amount||0),0),p=s-e;return `<tr><td><b style="color:${TEAM_META[t].color}">${t}</b></td><td class="money-income">${won(s)}</td><td class="money-expense">${won(e)}</td><td><b>${p>=0?"+":""}${won(p)}</b></td></tr>`;}).join("")}</tbody></table></div>`:`<div class="empty">팀을 하나 이상 선택하세요.</div>`}</section>
  <section class="section"><div class="section-title"><h2>매출·지출 내역</h2><div class="hint">${details.length}건</div></div>${details.length?`<div class="activity-list">${details.map(x=>`<div class="activity-row"><div class="activity-date">${x.date}</div><div class="activity-main"><div class="activity-title"><span class="pill ${x.kind==="sale"?"ok":"danger"}">${kindLabel(x.kind)}</span><b>${safeText(x.title)}</b></div><div class="activity-meta">${safeText(x.team)} · ${safeText(x.meta)}</div></div><div class="activity-money">${amountHtml(x)}</div><div class="activity-actions"><button class="soft-btn" onclick="${x.kind==="sale"?`editSale(${x.id})`:`editExpense(${x.id})`}">수정</button></div></div>`).join("")}</div>`:`<div class="empty">선택한 기간의 매출·지출이 없습니다.</div>`}</section>
  <section class="section"><div class="section-title"><h2>기타 자금 기록</h2><div class="hint">매출·지출 손익에는 포함하지 않음</div></div>${other.length?`<div class="activity-list">${other.map(x=>`<div class="activity-row"><div class="activity-date">${x.date}</div><div class="activity-main"><div class="activity-title"><span class="pill">${kindLabel(x.kind)}</span><b>${safeText(x.title)}</b></div><div class="activity-meta">${safeText(x.meta)}</div></div><div class="activity-money">${x.kind==="balance"?amountHtml({amount:Math.abs(x.amount),sign:x.amount>=0?"+":"-"}):won(x.amount)}</div><div class="activity-actions">${x.kind==="balance"?`<button class="soft-btn" onclick="editBalanceRecord(${x.id})">수정</button>`:""}</div></div>`).join("")}</div>`:`<div class="empty">이 기간의 기타 자금 기록이 없습니다.</div>`}</section>`;
}

window.openEventAdd=function(){
  document.getElementById("modalRoot").innerHTML=`<div class="modal-back"><div class="modal"><h3>이벤트 만들기</h3><p>행사 이름과 기간만 먼저 만들고, 기존 매출·지출 내역을 선택해서 연결합니다.</p><div class="form-grid"><div class="field" style="grid-column:1/-1"><label>이벤트 이름</label><input id="evName" placeholder="예: 2026 송도 펫페어"></div><div class="field"><label>시작일</label><input id="evStart" type="date" value="${todayISO()}"></div><div class="field"><label>종료일</label><input id="evEnd" type="date" value="${todayISO()}"></div><div class="field" style="grid-column:1/-1"><label>메모</label><input id="evMemo" placeholder="선택 입력"></div></div><div class="form-actions"><button class="ghost" onclick="closeModal()">취소</button><button class="primary" onclick="saveEvent()">만들기</button></div></div></div>`;
};
window.saveEvent=function(){
  const name=document.getElementById("evName").value.trim(),startDate=document.getElementById("evStart").value,endDate=document.getElementById("evEnd").value,memo=document.getElementById("evMemo").value.trim();
  if(!name)return alert("이벤트 이름을 입력하세요.");if(startDate&&endDate&&startDate>endDate)return alert("종료일은 시작일 이후여야 합니다.");
  const ev={id:Date.now(),name,startDate,endDate,memo,links:[],createdAt:new Date().toISOString()};
  state.events.push(ev);recordEventId=ev.id;eventPickerStart=startDate;eventPickerEnd=endDate;saveState();closeModal();showToast("이벤트가 만들어졌습니다.",name);renderApp();
};
window.selectRecordEvent=function(id){recordEventId=id;renderApp();};
window.editEvent=function(id){
  const ev=state.events.find(x=>String(x.id)===String(id));if(!ev)return;
  document.getElementById("modalRoot").innerHTML=`<div class="modal-back"><div class="modal"><h3>이벤트 수정</h3><div class="form-grid"><div class="field" style="grid-column:1/-1"><label>이벤트 이름</label><input id="eevName" value="${safeText(ev.name)}"></div><div class="field"><label>시작일</label><input id="eevStart" type="date" value="${safeText(ev.startDate||"")}"></div><div class="field"><label>종료일</label><input id="eevEnd" type="date" value="${safeText(ev.endDate||"")}"></div><div class="field" style="grid-column:1/-1"><label>메모</label><input id="eevMemo" value="${safeText(ev.memo||"")}"></div></div><div class="form-actions"><button class="ghost" onclick="closeModal()">취소</button><button class="primary" onclick="saveEventEdit(${id})">저장</button></div></div></div>`;
};
window.saveEventEdit=function(id){
  const ev=state.events.find(x=>String(x.id)===String(id));if(!ev)return;
  const name=document.getElementById("eevName").value.trim(),startDate=document.getElementById("eevStart").value,endDate=document.getElementById("eevEnd").value,memo=document.getElementById("eevMemo").value.trim();
  if(!name)return alert("이벤트 이름을 입력하세요.");if(startDate&&endDate&&startDate>endDate)return alert("종료일은 시작일 이후여야 합니다.");
  Object.assign(ev,{name,startDate,endDate,memo,updatedAt:new Date().toISOString()});saveState();closeModal();showToast("이벤트가 수정되었습니다.",name);renderApp();
};
window.deleteEvent=function(id){
  const ev=state.events.find(x=>String(x.id)===String(id));if(!ev)return;
  openConfirm("이벤트 삭제",`${ev.name} 이벤트를 삭제할까요? 연결된 원본 매출·지출 기록은 삭제되지 않습니다.`,()=>{state.events=state.events.filter(x=>String(x.id)!==String(id));if(String(recordEventId)===String(id))recordEventId=null;saveState();showToast("이벤트가 삭제되었습니다.",ev.name);renderApp();});
};
function eventCandidates(start,end){
  const arr=[];
  (state.sales||[]).forEach(x=>{const d=x.receivedAt||x.date;if((!start||d>=start)&&(!end||d<=end))arr.push({key:`sale:${x.id}`,kind:"sale",id:x.id,date:d,team:x.team,title:x.name,amount:x.amount,status:x.status});});
  (state.expenses||[]).forEach(x=>{const d=x.date;if((!start||d>=start)&&(!end||d<=end))arr.push({key:`expense:${x.id}`,kind:"expense",id:x.id,date:d,team:x.team,title:x.name,amount:x.amount,status:"완료"});});
  return arr.sort(sortActivities);
}
window.openEventLinkPicker=function(id,startOverride,endOverride){
  const ev=state.events.find(x=>String(x.id)===String(id));if(!ev)return;
  eventPickerStart=startOverride!==undefined?startOverride:(eventPickerStart||ev.startDate||recordStart);
  eventPickerEnd=endOverride!==undefined?endOverride:(eventPickerEnd||ev.endDate||recordEnd);
  const items=eventCandidates(eventPickerStart,eventPickerEnd),linked=new Set(ev.links||[]);
  document.getElementById("modalRoot").innerHTML=`<div class="modal-back"><div class="modal modal-wide"><h3>기존 내역 선택</h3><p>새 거래를 만드는 게 아니라 기존 매출·지출을 이 이벤트에 연결합니다. 원본을 수정하면 이벤트 금액도 자동으로 바뀝니다.</p><div class="event-picker-tools"><div class="field"><label>조회 시작</label><input id="epStart" type="date" value="${safeText(eventPickerStart||"")}"></div><div class="field"><label>조회 종료</label><input id="epEnd" type="date" value="${safeText(eventPickerEnd||"")}"></div><button class="soft-btn" onclick="refreshEventPicker(${id})">조회</button></div><div class="event-picker-list">${items.length?items.map(x=>`<label class="event-pick-row"><input class="event-link-check" type="checkbox" value="${x.key}" ${linked.has(x.key)?"checked":""}><span class="event-pick-date">${x.date}</span><span class="event-pick-main"><b>${safeText(x.title)}</b><small>${safeText(x.team)} · ${kindLabel(x.kind)}${x.kind==="sale"?` · ${safeText(x.status)}`:""}</small></span><strong class="${x.kind==="sale"?"money-income":"money-expense"}">${x.kind==="sale"?"+":"-"}${won(x.amount)}</strong></label>`).join(""):`<div class="empty">이 조회 기간의 매출·지출이 없습니다.</div>`}</div><div class="form-actions"><button class="ghost" onclick="closeModal()">취소</button><button class="primary" onclick="saveEventLinks(${id})">선택 저장</button></div></div></div>`;
};
window.refreshEventPicker=function(id){
  eventPickerStart=document.getElementById("epStart").value;eventPickerEnd=document.getElementById("epEnd").value;
  if(eventPickerStart&&eventPickerEnd&&eventPickerStart>eventPickerEnd)return alert("조회 종료일은 시작일 이후여야 합니다.");
  openEventLinkPicker(id,eventPickerStart,eventPickerEnd);
};
window.saveEventLinks=function(id){
  const ev=state.events.find(x=>String(x.id)===String(id));if(!ev)return;
  const visible=new Set(eventCandidates(eventPickerStart,eventPickerEnd).map(x=>x.key));
  const keep=(ev.links||[]).filter(k=>!visible.has(k));
  const selected=[...document.querySelectorAll(".event-link-check:checked")].map(x=>x.value);
  ev.links=[...new Set([...keep,...selected])];saveState();closeModal();showToast("이벤트 내역이 연결되었습니다.",`${selected.length}건 선택`);renderApp();
};
window.removeEventLink=function(eventId,key){
  const ev=state.events.find(x=>String(x.id)===String(eventId));if(!ev)return;
  ev.links=(ev.links||[]).filter(x=>x!==key);saveState();renderApp();
};
function resolveEventLinks(ev){
  const out=[];
  (ev.links||[]).forEach(key=>{
    const [kind,id]=String(key).split(":");
    if(kind==="sale"){
      const x=(state.sales||[]).find(v=>String(v.id)===id);
      if(x)out.push({key,kind,id:x.id,date:x.receivedAt||x.date,team:x.team,title:x.name,amount:x.amount,status:x.status,sign:"+",meta:`${x.account||x.team} 입금`});
    }
    if(kind==="expense"){
      const x=(state.expenses||[]).find(v=>String(v.id)===id);
      if(x)out.push({key,kind,id:x.id,date:x.date,team:x.team,title:x.name,amount:x.amount,status:"완료",sign:"-",meta:`사용 ${x.expenseFor||x.team}`});
    }
  });
  return out.sort(sortActivities);
}
function eventRecordsPage(){
  const events=(state.events||[]).slice().sort((a,b)=>String(b.startDate||b.createdAt).localeCompare(String(a.startDate||a.createdAt)));
  if(!recordEventId&&events.length)recordEventId=events[0].id;
  const ev=events.find(x=>String(x.id)===String(recordEventId));
  const top=`${recordsHeader()}<section class="section compact-section"><div class="event-top"><div class="event-select-wrap"><label>이벤트</label><select class="record-select" onchange="selectRecordEvent(this.value)">${events.map(x=>`<option value="${x.id}" ${ev&&String(x.id)===String(ev.id)?"selected":""}>${safeText(x.name)}</option>`).join("")}</select></div><button class="soft-btn" onclick="openEventAdd()">+ 이벤트</button></div></section>`;
  if(!ev)return `${top}<section class="section"><div class="empty">아직 이벤트가 없습니다.<br><button class="primary" style="margin-top:12px" onclick="openEventAdd()">첫 이벤트 만들기</button></div></section>`;
  const linked=resolveEventLinks(ev);
  const sales=linked.filter(x=>x.kind==="sale"&&x.status==="입금완료"),expenses=linked.filter(x=>x.kind==="expense");
  const revenue=sales.reduce((a,b)=>a+Number(b.amount||0),0),cost=expenses.reduce((a,b)=>a+Number(b.amount||0),0),profit=revenue-cost,margin=revenue?Math.round(profit/revenue*1000)/10:0;
  const teams=[...new Set(linked.map(x=>x.team))];
  return `${top}<section class="section event-head-card"><div class="event-head-copy"><div><h2>${safeText(ev.name)}</h2><div class="sub">${safeText(ev.startDate||"-")} ~ ${safeText(ev.endDate||"-")}${ev.memo?` · ${safeText(ev.memo)}`:""}</div></div><div class="event-head-actions"><button class="soft-btn" onclick="editEvent(${ev.id})">이벤트 수정</button><button class="soft-btn" onclick="deleteEvent(${ev.id})">삭제</button></div></div><div class="cards record-summary">${stat("이벤트 매출",won(revenue),`${sales.length}건 · 입금완료`)}${stat("이벤트 지출",won(cost),`${expenses.length}건`)}${stat("손익",`${profit>=0?"+":""}${won(profit)}`,revenue?`이익률 ${margin}%`:"매출 없음")}</div></section>
  <section class="section"><div class="section-title"><h2>연결된 매출·지출</h2><button class="primary" onclick="openEventLinkPicker(${ev.id})">기존 내역 선택</button></div>${linked.length?`<div class="activity-list">${linked.map(x=>`<div class="activity-row"><div class="activity-date">${x.date}</div><div class="activity-main"><div class="activity-title"><span class="pill ${x.kind==="sale"?"ok":"danger"}">${kindLabel(x.kind)}</span><b>${safeText(x.title)}</b></div><div class="activity-meta">${safeText(x.team)} · ${safeText(x.meta)}${x.kind==="sale"&&x.status!=="입금완료"?` · 손익 미포함(${safeText(x.status)})`:""}</div></div><div class="activity-money">${amountHtml(x)}</div><div class="activity-actions"><button class="soft-btn" onclick="removeEventLink(${ev.id},'${x.key}')">제외</button></div></div>`).join("")}</div>`:`<div class="empty">연결된 내역이 없습니다.<br>‘기존 내역 선택’에서 행사 관련 매출·지출을 체크하세요.</div>`}</section>
  ${teams.length?`<section class="section"><div class="section-title"><h2>팀별 보기</h2><div class="hint">이 이벤트에 연결된 거래 기준</div></div><div class="table-scroll"><table><thead><tr><th>팀</th><th>매출</th><th>지출</th><th>차액</th></tr></thead><tbody>${teams.map(t=>{const s=sales.filter(x=>x.team===t).reduce((a,b)=>a+Number(b.amount||0),0),e=expenses.filter(x=>x.team===t).reduce((a,b)=>a+Number(b.amount||0),0),p=s-e;return `<tr><td><b style="color:${TEAM_META[t]?.color||"#334155"}">${safeText(t)}</b></td><td class="money-income">${won(s)}</td><td class="money-expense">${won(e)}</td><td><b>${p>=0?"+":""}${won(p)}</b></td></tr>`;}).join("")}</tbody></table></div></section>`:""}`;
}
window.recordsPage=function(){ensureRecordState(state);return recordViewMode==="event"?eventRecordsPage():periodRecordsPage();};

menus=function(team){
  if(team==="강신나")return {main:["홈","기록","지출 등록","통합 캘린더","주간예산","월간예산","매출·지출","자금·계좌","고정비","설정"],bottom:["부채·상환계획"]};
  return {main:["홈","예산 요청","매출 등록","지출 등록","미리 신고","잔액 입력","내역 보기"],bottom:[]};
};
renderNav=function(){
  const m=menus(currentTeam),side=document.getElementById("sidebar");
  side.innerHTML=`<div class="nav-main">${m.main.map(x=>`<button class="nav-btn ${x===currentPage?"active":""}" data-p="${x}">${x}</button>`).join("")}</div><div class="nav-bottom">${m.bottom.map(x=>`<button class="nav-btn debt ${x===currentPage?"active":""}" data-p="${x}">▣ ${x}</button>`).join("")}</div>`;
  side.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{currentPage=b.dataset.p;renderApp();});
  const mobileItems=currentTeam==="강신나"?["홈","기록","통합 캘린더","주간예산","자금·계좌"]:["홈","예산 요청","매출 등록","지출 등록","미리 신고"];
  const mob=document.getElementById("mobileNav");
  mob.innerHTML=mobileItems.map(x=>`<button class="${x===currentPage?"active":""}" data-p="${x}">${x}</button>`).join("");
  mob.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{currentPage=b.dataset.p;renderApp();});
};

const oldRenderApp=renderApp;
renderApp=function(){
  ensureRecordState(state);
  if(currentTeam==="강신나"&&currentPage==="기록"){
    materializeRecurringExpenses();syncBudgetMirror();updateWeekSwitcher();teamStyle(currentTeam);
    document.getElementById("brandTitle").textContent="강신나 자금관리";
    renderNav();renderNotifications();document.getElementById("content").innerHTML=recordsPage();bindCalendarLongPress();return;
  }
  oldRenderApp();
};
})();
