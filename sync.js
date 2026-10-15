/* 帳號與同步：Email 註冊、Email 驗證、在不同裝置同步設定與「已學會」紀錄（Firebase） */
import CFG from './firebase-config.js';
const V='10.14.1',G='https://www.gstatic.com/firebasejs/'+V+'/';
const box=document.getElementById('acctbox');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=s=>box.querySelector(s);
const ERR={
 'auth/email-already-in-use':'這個 Email 已經註冊過了，請直接登入。',
 'auth/invalid-email':'Email 格式不正確。',
 'auth/missing-email':'請輸入 Email。',
 'auth/weak-password':'密碼至少需要 6 個字元。',
 'auth/missing-password':'請輸入密碼。',
 'auth/invalid-credential':'Email 或密碼不正確。',
 'auth/wrong-password':'Email 或密碼不正確。',
 'auth/user-not-found':'找不到這個帳號，請先註冊。',
 'auth/too-many-requests':'嘗試次數太多，請稍後再試。',
 'auth/network-request-failed':'網路連線失敗，請確認網路後再試。',
 'auth/unauthorized-domain':'這個網址尚未加入 Firebase 的授權網域。',
 'auth/operation-not-allowed':'Firebase 尚未啟用「電子郵件/密碼」登入方式。'
};
const errMsg=e=>ERR[e&&e.code]||('發生錯誤：'+((e&&(e.code||e.message))||'未知'));

if(!CFG||!CFG.apiKey){box.textContent='帳號功能尚未啟用（尚未完成 Firebase 設定）。';throw 0}

let A,F;
try{
  const [app,auth,fs]=await Promise.all([import(G+'firebase-app.js'),import(G+'firebase-auth.js'),import(G+'firebase-firestore.js')]);
  A=auth;F=fs;
  const fapp=app.initializeApp(CFG);
  window.__fb={auth:auth.getAuth(fapp),db:(()=>{try{return fs.initializeFirestore(fapp,{localCache:fs.persistentLocalCache()})}catch(e){return fs.getFirestore(fapp)}})()};
}catch(e){box.textContent='目前無法載入帳號功能（可能沒有網路）。網頁其他功能可正常使用。';throw e}
const auth=window.__fb.auth,db=window.__fb.db;
auth.languageCode='zh-TW';

/* ---------- 同步 ---------- */
let unsub=null,ref=null,pushT=null,applying=false,lastSync=null,firstSnap=true;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function settingsOf(o){const s={...o};delete s.learned;return s}
function push(){if(!ref)return;clearTimeout(pushT);pushT=setTimeout(async()=>{
  try{await F.setDoc(ref,{state:B1.snapshot(),updatedAt:F.serverTimestamp()});lastSync=new Date();renderStatus()}catch(e){renderStatus(errMsg(e))}},800)}
B1.onSet=()=>{if(ref&&!applying)push()};
function applyRemote(remote){
  const local=B1.snapshot();
  applying=true;
  try{
    if(!same(remote.learned||[],local.learned))B1.applyLearned(remote.learned||[]);
    const rs=settingsOf(remote),ls=settingsOf(local);
    if(!same(rs,ls)){
      B1.KEYS.forEach(k=>{try{if(k in rs)localStorage.setItem(k,JSON.stringify(rs[k]))}catch(e){}});
      /* 設定不同：重新載入網頁套用（播放中則等停止後） */
      const go=()=>{const key='b1-sync-reload',now=Date.now(),last=+sessionStorage.getItem(key)||0;
        if(now-last<10000)return;sessionStorage.setItem(key,now);location.reload()};
      if(B1.isPlaying()){renderStatus('其他裝置的設定已同步，停止播放後套用。');const iv=setInterval(()=>{if(!B1.isPlaying()){clearInterval(iv);go()}},2000)}else go();
    }
  }finally{applying=false}
}
function startSync(user){
  stopSync();firstSnap=true;
  ref=F.doc(db,'users',user.uid);
  unsub=F.onSnapshot(ref,snap=>{
    if(snap.metadata.hasPendingWrites)return;
    if(!snap.exists()){push();firstSnap=false;return}   /* 雲端還沒有資料：上傳這台裝置的設定 */
    const remote=(snap.data()||{}).state||{};
    applyRemote(remote);lastSync=new Date();firstSnap=false;renderStatus();
  },e=>renderStatus(errMsg(e)));
}
function stopSync(){if(unsub)unsub();unsub=null;ref=null;clearTimeout(pushT)}

/* ---------- 畫面 ---------- */
let cur=null;
function renderStatus(msg){const s=$('.astat');if(!s)return;
  if(msg){s.textContent=msg;s.className='amsg astat err';return}
  s.className='amsg astat ok';
  s.textContent=lastSync?`✓ 已同步（${lastSync.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}）`:'同步中…'}
function setMsg(t,cls){const m=$('.amsg.form');if(m){m.textContent=t||'';m.className='amsg form'+(cls?' '+cls:'')}}
async function run(btn,fn){const bs=box.querySelectorAll('button');bs.forEach(b=>b.disabled=true);try{await fn()}catch(e){setMsg(errMsg(e),'err')}finally{bs.forEach(b=>b.disabled=false)}}
function render(){
  const u=cur;
  if(!u){
    box.innerHTML=`<div>用 Email 註冊帳號後，可以在手機、電腦等不同裝置同步設定和「已學會」紀錄。</div>
      <div class="arow"><input type="email" id="aEmail" placeholder="Email" autocomplete="email" inputmode="email"><input type="password" id="aPw" placeholder="密碼（至少 6 個字元）" autocomplete="current-password"></div>
      <div class="arow"><button class="pri" id="aIn">登入</button><button id="aUp">註冊新帳號</button><button id="aReset">忘記密碼</button></div>
      <div class="amsg form"></div>`;
    const em=()=>$('#aEmail').value.trim(),pw=()=>$('#aPw').value;
    $('#aIn').onclick=()=>run(0,async()=>{await A.signInWithEmailAndPassword(auth,em(),pw())});
    $('#aUp').onclick=()=>run(0,async()=>{const c=await A.createUserWithEmailAndPassword(auth,em(),pw());await A.sendEmailVerification(c.user)});
    $('#aReset').onclick=()=>run(0,async()=>{if(!em())throw{code:'auth/missing-email'};await A.sendPasswordResetEmail(auth,em());setMsg('已寄出重設密碼的信，請到信箱查看。','ok')});
    $('#aPw').addEventListener('keydown',e=>{if(e.key==='Enter')$('#aIn').click()});
    return;
  }
  if(!u.emailVerified){
    box.innerHTML=`<div>驗證信已寄到 <b>${esc(u.email)}</b>。請到信箱點信中的連結完成驗證，再回來按「我已完成驗證」。找不到信時，請查看垃圾郵件匣。</div>
      <div class="arow"><button class="pri" id="aChk">我已完成驗證</button><button id="aResend">重寄驗證信</button><button id="aOut">登出</button></div>
      <div class="amsg form"></div>`;
    $('#aChk').onclick=()=>run(0,async()=>{await A.reload(u);await u.getIdToken(true);if(auth.currentUser.emailVerified){cur=auth.currentUser;render();startSync(cur)}else setMsg('還沒有完成驗證，請先點信中的連結。','err')});
    $('#aResend').onclick=()=>run(0,async()=>{await A.sendEmailVerification(u);setMsg('已重新寄出驗證信。','ok')});
    $('#aOut').onclick=()=>run(0,async()=>{await A.signOut(auth)});
    return;
  }
  box.innerHTML=`<div>已登入 <b>${esc(u.email)}</b></div>
    <div class="amsg astat ok">同步中…</div>
    <div class="arow"><button id="aOut">登出</button></div>`;
  $('#aOut').onclick=()=>run(0,async()=>{stopSync();await A.signOut(auth)});
  renderStatus();
}
A.onAuthStateChanged(auth,u=>{cur=u;render();if(u&&u.emailVerified)startSync(u);else stopSync()});
