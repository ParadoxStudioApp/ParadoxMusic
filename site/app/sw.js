const VERSION='paradox-web-1794702066507';const SHELL=VERSION+'-shell';const FILES=["./index.html","./manifest.webmanifest","./assets/index-C1dwvYK6.js","./assets/index-h4Ru0OqN.css","./assets/manrope-cyrillic-wght-normal-Dvxsihut.woff2","./assets/manrope-latin-wght-normal-DHIcAJRg.woff2","./assets/opfs-worker-CkblJ2rN.js","./assets/web-CMkfRuPP.js","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/maskable-192.png","./icons/maskable-512.png","./splash/1125x2436.png","./splash/1170x2532.png","./splash/1179x2556.png","./splash/1290x2796.png","./splash/750x1334.png"];
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('paradox-web-')&&key.endsWith('-shell')&&key!==SHELL)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE')self.skipWaiting();});
function read(key){return new Promise((resolve,reject)=>{const r=indexedDB.open('paradox-web-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('kv'),get=t.objectStore('kv').get(key);get.onsuccess=()=>{resolve(get.result);db.close()};get.onerror=()=>{db.close();reject(get.error)};};});}
const streamChoices=new Map();
function write(key,value){return new Promise((resolve,reject)=>{const r=indexedDB.open('paradox-web-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('kv','readwrite');t.objectStore('kv').put(value,key);t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>{db.close();reject(t.error)}}})}
async function openStream(req,url,auth,transport,owner,source,id){
 const key='choice:'+owner+':'+source+'/'+id,nonce=url.searchParams.get('play')||'download';
 const previous=streamChoices.get(key)||await read(key);
 let candidates;
 if(previous?.nonce===nonce)candidates=[previous];
 else{
  const snapshot=await read('snapshot:'+owner),logicalId=source==='youtube'?'yt:'+id:id;
  const track=snapshot?.tracks?.find(t=>t.id===logicalId);
  candidates=[{source,id},...(track?.alternatives||[]).map(t=>({source:t.source,id:t.source==='youtube'?(t.sourceId||t.id.slice(3)):t.id}))];
 }
 candidates=candidates.filter((t,index,all)=>['youtube','soundcloud','hitmoz'].includes(t.source)&&(t.source==='youtube'?/^[\w-]{11}$/.test(t.id):/^(?:sc|hm):\d{1,22}$/.test(t.id))&&all.findIndex(other=>other.source===t.source&&other.id===t.id)===index).slice(0,7);
 for(const candidate of candidates){
  try{
   const preparation=await fetch(transport.audio+'/v1/prepare',{method:'POST',headers:{authorization:'Bearer '+auth.token,'content-type':'application/json','x-paradox-streaming':'1'},body:JSON.stringify({source:candidate.source,id:candidate.id}),credentials:'omit',redirect:'error',signal:req.signal});
   if(!preparation.ok){await preparation.body?.cancel();continue;}await preparation.body?.cancel();
   const headers={authorization:'Bearer '+auth.token,'x-paradox-streaming':'1'};if(req.headers.has('range'))headers.range=req.headers.get('range');
   const response=await fetch(transport.audio+'/v1/audio/'+candidate.source+'/'+encodeURIComponent(candidate.id)+(candidate.source==='youtube'&&transport.mp4?'?format=mp4':''),{headers,credentials:'omit',redirect:'error',signal:req.signal});
   if(!response.ok&&response.status!==416){await response.body?.cancel();continue;}
   if(response.headers.has('content-length')&&response.headers.get('content-length')==='0'&&response.status!==416){await response.body?.cancel();continue;}
   const choice={source:candidate.source,id:candidate.id,nonce};if(streamChoices.size>=1000)streamChoices.delete(streamChoices.keys().next().value);streamChoices.set(key,choice);await write(key,choice).catch(()=>{});return response;
  }catch(error){if(req.signal.aborted)throw error;}
 }
 return new Response('Трек временно недоступен',{status:502});
}
const scope=new URL(self.registration.scope).pathname;
async function gateway(req,url){const auth=await read('auth'),transport=await read('transport');if(!auth?.token||!transport?.audio||auth.server!==transport.accounts)return new Response('Войдите в аккаунт',{status:401});if(url.pathname.startsWith(scope+'video/')){const key=url.pathname.slice((scope+'video/').length);if(!/^[a-f0-9-]{36}$/.test(key))return new Response('',{status:400});const headers={authorization:'Bearer '+auth.token};if(req.headers.has('range'))headers.range=req.headers.get('range');return fetch(transport.audio+'/v1/mobile/video/'+key,{headers,credentials:'omit',redirect:'error',signal:req.signal});}const owner='user:'+auth.server+':'+auth.user.id;const cache=await caches.open('paradox-downloads-'+owner);if(url.pathname.startsWith(scope+'stream/')){
 const saved=await cache.match(url.origin+url.pathname);if(saved){const blob=await saved.blob(),range=req.headers.get('range'),m=/^bytes=(\d*)-(\d*)$/.exec(range||'');if(range&&(!m||(!m[1]&&!m[2])))return new Response(null,{status:416,headers:{'content-range':'bytes */'+blob.size}});if(!m)return new Response(blob,{headers:{'content-type':blob.type,'content-length':String(blob.size),'accept-ranges':'bytes'}});const suffix=!m[1],start=suffix?Math.max(0,blob.size-Number(m[2])):Number(m[1]),end=suffix?blob.size-1:m[2]?Math.min(Number(m[2]),blob.size-1):blob.size-1;if(start>=blob.size||end<start)return new Response(null,{status:416,headers:{'content-range':'bytes */'+blob.size}});return new Response(blob.slice(start,end+1),{status:206,headers:{'content-type':blob.type,'content-range':`bytes ${start}-${end}/${blob.size}`,'content-length':String(end-start+1),'accept-ranges':'bytes'}});}
 const path=url.pathname.slice((scope+'stream/').length),match=/^(youtube|soundcloud|hitmoz)\/([^/]+)$/.exec(path);if(!match)return new Response('',{status:400});const id=decodeURIComponent(match[2]);if(!(match[1]==='youtube'?/^[\w-]{11}$/.test(id):/^(?:sc|hm):\d{1,22}$/.test(id)))return new Response('',{status:400});
 return openStream(req,url,auth,transport,owner,match[1],id);
 }
 const target=url.searchParams.get('url');if(!target)return new Response('',{status:400});const upstream=await fetch(transport.audio+'/v1/catalog',{method:'POST',headers:{authorization:'Bearer '+auth.token,'content-type':'application/json'},body:JSON.stringify({url:target,method:'GET'}),credentials:'omit',redirect:'error',signal:req.signal});if(!upstream.ok||!/^image\//i.test(upstream.headers.get('content-type')||'')){await upstream.body?.cancel();return new Response('',{status:404})}return upstream;
}
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith(scope+'stream/')||url.pathname.startsWith(scope+'video/')||url.pathname===scope+'image'){event.respondWith(gateway(req,url).catch(()=>new Response('Нет подключения',{status:503})));return;}
 if(req.method!=='GET')return;
 event.respondWith((async()=>{if(req.mode==='navigate'){try{return await fetch(req)}catch{return await caches.match(scope+'index.html')||new Response('Нет подключения',{status:503});}}const cached=await caches.match(req);return cached||fetch(req);})());
});
