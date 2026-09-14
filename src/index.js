import { generateVapidKeys } from '@mmmike/web-push/vapid';
import { sendPushNotification } from '@mmmike/web-push/send';

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const FINANCE_KEY = 'finance/state.json';
const MES_KEY = 'mes/state.json';
const PUSH_SUBS_KEY = 'push/subscriptions.json';
const VAPID_KEY = 'push/vapid.json';

function seedState(){return {
  accounts:{'강신나':0,'허슬':0,'엘리븐':0,'로아미':0},
  budgets:{'허슬':{approved:0,unused:0,extra:0},'엘리븐':{approved:0,unused:0,extra:0},'로아미':{approved:0,unused:0,extra:0}},
  weeklyBudgets:{},budgetRequests:[],calendarNotes:{},weekStandard:'sunday',
  sales:[],expenses:[],plans:[],recurringExpenses:[],fixedCosts:[],debts:[],
  notifications:{'강신나':[],'허슬':[],'엘리븐':[],'로아미':[]}
};}
function validTeam(team){return ['강신나','허슬','엘리븐','로아미'].includes(team)}
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}})}
function text(body,status=200,type='text/plain; charset=utf-8',headers={}){return new Response(body,{status,headers:{'Content-Type':type,'Cache-Control':'no-store',...headers}})}
function redirect(location){return new Response(null,{status:302,headers:{Location:location,'Cache-Control':'no-store'}})}
function parseCookies(request){
  const out={};
  for(const part of (request.headers.get('Cookie')||'').split(';')){
    const s=part.trim(); if(!s)continue; const i=s.indexOf('='); if(i<0)continue;
    try{out[s.slice(0,i)]=decodeURIComponent(s.slice(i+1))}catch{out[s.slice(0,i)]=s.slice(i+1)}
  }
  return out;
}
function b64urlBytes(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function b64urlText(s){return b64urlBytes(new TextEncoder().encode(s))}
function fromB64url(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const raw=atob(s);return new Uint8Array([...raw].map(c=>c.charCodeAt(0)))}
async function hmac(secret,data){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data)))}
function safeEqual(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a[i]^b[i];return x===0}
async function makeSession(env,role){
  const secret=env.SESSION_SECRET||env.APP_PASSWORD||'ksn-session-fallback';
  const payload=b64urlText(JSON.stringify({role,exp:Date.now()+SESSION_MS}));
  const sig=b64urlBytes(await hmac(secret,payload)); return `${payload}.${sig}`;
}
async function readSession(request,env,cookieName){
  const token=parseCookies(request)[cookieName]; if(!token)return null;
  const [payload,sig]=String(token).split('.'); if(!payload||!sig)return null;
  const secret=env.SESSION_SECRET||env.APP_PASSWORD||'ksn-session-fallback';
  const expected=await hmac(secret,payload); let got; try{got=fromB64url(sig)}catch{return null}
  if(!safeEqual(expected,got))return null;
  try{const data=JSON.parse(new TextDecoder().decode(fromB64url(payload)));if(!data.exp||data.exp<Date.now())return null;return data}catch{return null}
}
async function financeAuth(request,env){const s=await readSession(request,env,'sid');return s?.role==='finance'}
async function mesAuth(request,env){const s=await readSession(request,env,'mes_sid');return s?.role==='mes'}
async function canUseMes(request,env){return (await financeAuth(request,env))||(await mesAuth(request,env))}
function sessionCookie(name,value){return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_MS/1000)}`}
function clearCookie(name){return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`}

async function getJsonObject(env,key,fallback=null){
  const obj=await env.DATA.get(key); if(!obj)return {obj:null,data:fallback};
  try{return {obj,data:await obj.json()}}catch{return {obj,data:fallback}}
}
async function putJson(env,key,data,opts={}){return env.DATA.put(key,JSON.stringify(data,null,2),{httpMetadata:{contentType:'application/json; charset=utf-8'},...opts})}
async function loadFinance(env){
  let {obj,data}=await getJsonObject(env,FINANCE_KEY,null);
  if(!data){data={version:0,state:seedState()};await putJson(env,FINANCE_KEY,data);({obj,data}=await getJsonObject(env,FINANCE_KEY,data));}
  return {obj,data:{version:Number(data.version)||0,state:data.state||seedState()}};
}
async function loadMes(env){const {obj,data}=await getJsonObject(env,MES_KEY,null);return {obj,data:data?{version:Number(data.version)||0,state:data.state&&typeof data.state==='object'?data.state:null}:{version:0,state:null}}}
async function backupAndTrim(env,prefix,store){
  if(!store)return;
  const name=`${prefix}${Date.now()}-v${Number(store.version)||0}.json`;
  await putJson(env,name,store);
  const list=await env.DATA.list({prefix,limit:1000});
  if(list.objects.length>50){const old=[...list.objects].sort((a,b)=>a.uploaded-b.uploaded).slice(0,list.objects.length-50);await Promise.all(old.map(o=>env.DATA.delete(o.key)))}
}
async function conditionalStore(env,key,currentObj,next){
  if(currentObj?.etag){const r=await putJson(env,key,next,{onlyIf:{etagMatches:currentObj.etag}});return !!r}
  await putJson(env,key,next); return true;
}
async function getVapid(env){
  const {data}=await getJsonObject(env,VAPID_KEY,null);
  if(data?.publicKey&&data?.privateKey)return data;
  const keys=await generateVapidKeys();
  const vapid={...keys,subject:env.VAPID_SUBJECT||'mailto:admin@example.com'};
  await putJson(env,VAPID_KEY,vapid);return vapid;
}
async function getPushSubs(env){const {data}=await getJsonObject(env,PUSH_SUBS_KEY,[]);return Array.isArray(data)?data:[]}
async function savePushSubs(env,subs){await putJson(env,PUSH_SUBS_KEY,subs)}
function newNotifications(prevState,nextState){
  const out=[];
  for(const team of ['강신나','허슬','엘리븐','로아미']){
    const before=Array.isArray(prevState?.notifications?.[team])?prevState.notifications[team]:[];
    const after=Array.isArray(nextState?.notifications?.[team])?nextState.notifications[team]:[];
    const added=Math.max(0,after.length-before.length);
    after.slice(0,added).reverse().forEach(n=>out.push({team,title:String(n?.title||'강신나 자금관리'),text:String(n?.text||'변경사항이 있습니다.')}));
  }
  return out;
}
async function sendPushes(env,items){
  if(!items.length)return;
  const subs=await getPushSubs(env); if(!subs.length)return;
  const vapid=await getVapid(env); const gone=new Set();
  for(const item of items){
    const targets=subs.filter(x=>x.team===item.team&&x.subscription?.endpoint);
    for(const x of targets){
      try{const delivered=await sendPushNotification(x.subscription,{title:item.title,body:item.text,url:'/',tag:`ksn-${item.team}`},vapid,{ttl:3600});if(!delivered)gone.add(x.subscription.endpoint)}catch(e){if(e?.statusCode===404||e?.statusCode===410)gone.add(x.subscription.endpoint);else console.error('push failed',e?.statusCode||e?.message||e)}}
  }
  if(gone.size)await savePushSubs(env,subs.filter(x=>!gone.has(x.subscription?.endpoint)));
}

function mesLoginHtml(){return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#10212a"><title>허슬 MES</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f6f7;color:#172127;font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Noto Sans KR",sans-serif;min-height:100vh;display:grid;place-items:center;padding:20px}.box{width:min(440px,100%);background:#fff;border:1px solid #dfe5e8;border-radius:18px;padding:26px}.mark{width:44px;height:44px;border-radius:12px;background:#10212a;color:#fff;display:grid;place-items:center;font-weight:950;margin-bottom:18px}h1{font-size:28px;margin:0 0 7px}p{font-size:13px;color:#68757c;line-height:1.6;margin:0 0 20px}.row{display:flex;gap:8px}input{min-width:0;flex:1;border:1px solid #d8e0e3;border-radius:10px;padding:13px;font-size:16px}button{border:0;border-radius:10px;padding:13px 18px;background:#10212a;color:#fff;font-weight:900}.err{min-height:20px;color:#bd3a37;font-size:12px;margin-top:10px}@media(max-width:520px){.box{padding:20px}.row{flex-direction:column}button{width:100%}}</style></head><body><div class="box"><div class="mark">MES</div><h1>허슬 생산관리</h1><p>MES 전용 비밀번호를 입력하세요.</p><div class="row"><input id="pw" type="password" inputmode="numeric" autocomplete="current-password" placeholder="MES 비밀번호"><button id="go">접속</button></div><div class="err" id="err"></div></div><script>async function go(){const p=document.getElementById('pw').value;document.getElementById('err').textContent='';try{const r=await fetch('/api/mes/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:p})});if(!r.ok){document.getElementById('err').textContent='비밀번호가 맞지 않습니다.';return}location.href='/mes'}catch(e){document.getElementById('err').textContent='서버 연결을 확인해주세요.'}}document.getElementById('go').onclick=go;document.getElementById('pw').addEventListener('keydown',e=>{if(e.key==='Enter')go()});</script></body></html>`}
function migrationHtml(){return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KSN 데이터 이식</title><style>*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif;background:#f5f6f7;margin:0;padding:24px;color:#111}.box{max-width:620px;margin:auto;background:white;border:1px solid #e4e7e9;border-radius:16px;padding:24px}h1{font-size:24px;margin:0 0 8px}p{color:#666;line-height:1.6}.drop{border:1px dashed #aeb7bd;border-radius:12px;padding:20px;margin:20px 0}input{font-size:16px;width:100%}button{width:100%;border:0;border-radius:10px;background:#111;color:#fff;font-weight:800;padding:14px;font-size:16px}.msg{margin-top:14px;font-size:14px;white-space:pre-line}</style></head><body><div class="box"><h1>Railway 데이터 이식</h1><p>Railway에서 내려받은 <b>KSN_full_backup_....json</b> 파일을 선택한 뒤 이식하세요.</p><div class="drop"><input id="file" type="file" accept="application/json,.json"></div><button id="go">데이터 이식</button><div class="msg" id="msg"></div></div><script>document.getElementById('go').onclick=async()=>{const f=document.getElementById('file').files[0],m=document.getElementById('msg');if(!f){m.textContent='백업 파일을 선택하세요.';return}m.textContent='이식 중...';try{const t=await f.text();const r=await fetch('/api/migration/import',{method:'POST',headers:{'Content-Type':'application/json'},body:t});const j=await r.json();if(!r.ok)throw new Error(j.error||'실패');m.textContent='이식 완료\n자금관리와 MES 데이터를 확인하세요.\n모바일 푸시알림은 새 주소에서 다시 켜야 합니다.'}catch(e){m.textContent='실패: '+e.message}};</script></body></html>`}

async function handle(request,env,ctx){
  const url=new URL(request.url), p=url.pathname;
  if(!env.DATA)return json({error:'R2 binding DATA missing'},500);

  if(request.method==='GET'&&(p==='/'||p==='/index.html')){
    if((await mesAuth(request,env))&&!(await financeAuth(request,env)))return redirect('/mes');
    return env.ASSETS.fetch(request);
  }
  if(request.method==='GET'&&(p==='/mes'||p==='/mes/'||p==='/mes.html')){
    if(!(await canUseMes(request,env)))return text(mesLoginHtml(),200,'text/html; charset=utf-8');
    const target=new URL('/mes.html',url);return env.ASSETS.fetch(new Request(target,request));
  }
  if(request.method==='GET'&&p==='/migration'){
    if(!(await financeAuth(request,env)))return redirect('/');
    return text(migrationHtml(),200,'text/html; charset=utf-8');
  }
  if(request.method==='GET'&&p==='/health'){
    const [f,m]=await Promise.all([loadFinance(env),loadMes(env)]);return json({ok:true,version:f.data.version,mesVersion:m.data.version,storage:'cloudflare-r2'});
  }

  if(request.method==='GET'&&p==='/api/mes/session')return json({authenticated:await canUseMes(request,env),financeAuthenticated:await financeAuth(request,env),mesAuthenticated:await mesAuth(request,env)});
  if(request.method==='POST'&&p==='/api/mes/login'){
    const body=await request.json().catch(()=>({})); if(String(body.password||'')!==String(env.MES_PASSWORD||''))return json({ok:false},401);
    const token=await makeSession(env,'mes');return json({ok:true},200,{'Set-Cookie':sessionCookie('mes_sid',token)});
  }
  if(request.method==='POST'&&p==='/api/mes/logout')return json({ok:true},200,{'Set-Cookie':clearCookie('mes_sid')});
  if(p.startsWith('/api/mes/')&&!(await canUseMes(request,env)))return json({error:'unauthorized'},401);
  if(request.method==='GET'&&p==='/api/mes/state'){const {data}=await loadMes(env);return json(data)}
  if(request.method==='PUT'&&p==='/api/mes/state'){
    const body=await request.json().catch(()=>({})); const cur=await loadMes(env);
    if(Number(body.version)!==cur.data.version)return json(cur.data,409);
    if(!body.state||typeof body.state!=='object')return json({error:'invalid state'},400);
    await backupAndTrim(env,'mes/backups/',cur.data);
    const next={version:cur.data.version+1,state:body.state};
    if(!(await conditionalStore(env,MES_KEY,cur.obj,next))){const latest=await loadMes(env);return json(latest.data,409)}
    return json({ok:true,version:next.version});
  }

  if(request.method==='GET'&&p==='/api/session')return json({authenticated:await financeAuth(request,env)});
  if(request.method==='POST'&&p==='/api/login'){
    const body=await request.json().catch(()=>({})); if(String(body.password||'')!==String(env.APP_PASSWORD||''))return json({ok:false},401);
    const token=await makeSession(env,'finance');return json({ok:true},200,{'Set-Cookie':sessionCookie('sid',token)});
  }
  if(request.method==='POST'&&p==='/api/logout')return json({ok:true},200,{'Set-Cookie':clearCookie('sid')});
  if(p.startsWith('/api/')&&!(await financeAuth(request,env)))return json({error:'unauthorized'},401);

  if(request.method==='GET'&&p==='/api/push/config'){const vapid=await getVapid(env);return json({enabled:!!vapid.publicKey,publicKey:vapid.publicKey})}
  if(request.method==='POST'&&p==='/api/push/subscribe'){
    const body=await request.json().catch(()=>({})),sub=body.subscription,team=String(body.team||'');
    if(!validTeam(team)||!sub?.endpoint)return json({error:'invalid_subscription'},400);
    const subs=await getPushSubs(env),item={team,subscription:sub,updatedAt:new Date().toISOString()};
    const i=subs.findIndex(x=>x.subscription?.endpoint===sub.endpoint);if(i>=0)subs[i]=item;else subs.push(item);await savePushSubs(env,subs);return json({ok:true});
  }
  if(request.method==='POST'&&p==='/api/push/unsubscribe'){
    const body=await request.json().catch(()=>({})),endpoint=String(body.endpoint||'');let subs=await getPushSubs(env);subs=subs.filter(x=>x.subscription?.endpoint!==endpoint);await savePushSubs(env,subs);return json({ok:true});
  }
  if(request.method==='GET'&&p==='/api/state'){const {data}=await loadFinance(env);return json(data)}
  if(request.method==='PUT'&&p==='/api/state'){
    const body=await request.json().catch(()=>({}));const cur=await loadFinance(env);
    if(Number(body.version)!==cur.data.version)return json(cur.data,409);
    if(!body.state||typeof body.state!=='object')return json({error:'invalid state'},400);
    const pushes=newNotifications(cur.data.state,body.state);await backupAndTrim(env,'finance/backups/',cur.data);
    const next={version:cur.data.version+1,state:body.state};
    if(!(await conditionalStore(env,FINANCE_KEY,cur.obj,next))){const latest=await loadFinance(env);return json(latest.data,409)}
    if(pushes.length)ctx.waitUntil(sendPushes(env,pushes));return json({ok:true,version:next.version});
  }
  if(request.method==='POST'&&p==='/api/migration/import'){
    const bundle=await request.json().catch(()=>null);
    if(!bundle||bundle.format!=='ksn-cloudflare-migration-v1')return json({error:'invalid migration file'},400);
    if(bundle.finance)await putJson(env,FINANCE_KEY,bundle.finance);
    if(bundle.mes)await putJson(env,MES_KEY,bundle.mes);
    if(bundle.vapid?.publicKey&&bundle.vapid?.privateKey)await putJson(env,VAPID_KEY,bundle.vapid);
    if(Array.isArray(bundle.legacyPushSubscriptions))await putJson(env,'migration/legacy-push-subscriptions.json',bundle.legacyPushSubscriptions);
    for(const x of (bundle.financeBackups||[]).slice(-50)){if(x?.data)await putJson(env,`finance/backups/imported-${x.name||crypto.randomUUID()+'.json'}`,x.data)}
    for(const x of (bundle.mesBackups||[]).slice(-50)){if(x?.data)await putJson(env,`mes/backups/imported-${x.name||crypto.randomUUID()+'.json'}`,x.data)}
    await savePushSubs(env,[]);
    return json({ok:true,financeVersion:Number(bundle.finance?.version)||0,mesVersion:Number(bundle.mes?.version)||0,pushNeedsResubscribe:true});
  }

  return env.ASSETS.fetch(request);
}

export default {fetch:handle};
