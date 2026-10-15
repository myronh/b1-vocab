/* 離線快取：網頁與音檔第一次載入後存在裝置上，之後沒有網路也能使用 */
const CACHE='b1-vocab-v2';
const CORE=['./','./index.html','./sync.js','./firebase-config.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  /* 帳號登入與雲端資料（Firebase）不經過快取 */
  const sameOrigin=url.origin===self.location.origin;
  const cacheable=sameOrigin||url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'||url.hostname==='www.gstatic.com';
  if(!cacheable)return;
  /* 音檔：先用裝置上的，沒有才下載（檔名帶版本，更新時會換網址） */
  if(url.pathname.endsWith('.m4a')){
    e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(req);if(hit)return hit;
      const res=await fetch(req);if(res.ok&&res.status===200){c.put(req,res.clone());
        /* 刪掉同一口音的舊版本 */
        c.keys().then(ks=>ks.forEach(k=>{const u=new URL(k.url);if(u.pathname===url.pathname&&u.search!==url.search)c.delete(k)}))}
      return res}));return}
  /* 網頁本身：有網路就拿最新的，沒網路用裝置上的 */
  if(sameOrigin&&(req.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('.js'))){
    e.respondWith(fetch(req).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put(req.mode==='navigate'?'./index.html':req,cp));return res}).catch(()=>caches.match(req.mode==='navigate'?'./index.html':req)));return}
  /* 其他（圖示、字型）：先用快取，背景更新 */
  e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(req);
    const net=fetch(req).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(req,res.clone());return res}).catch(()=>hit);
    return hit||net}));
});
