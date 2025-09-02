// IndexedDB + in-memory LRU cache for embeddings
// Keyed by URL hash (simple stable hash of semantic input)

export const EMBED_DB_NAME = 'embeddings';
export const EMBED_DB_STORE = 'vectors';

function hashString(str){
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

class LRU {
  constructor(limit){ this.limit=limit; this.map=new Map(); }
  get(k){ if(!this.map.has(k)) return; const v=this.map.get(k); this.map.delete(k); this.map.set(k,v); return v; }
  set(k,v){ if(this.map.has(k)) this.map.delete(k); this.map.set(k,v); if(this.map.size>this.limit){ const first=this.map.keys().next().value; this.map.delete(first);} }
}

const lru = new LRU((typeof self!=='undefined' && self.SEMANTIC_CONFIG?.lruSize) || 200);

function openDb(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(EMBED_DB_NAME,1);
    req.onupgradeneeded = e => {
      const db = req.result;
      if(!db.objectStoreNames.contains(EMBED_DB_STORE)){
        db.createObjectStore(EMBED_DB_STORE, { keyPath:'key' });
      }
    };
    req.onerror = ()=> reject(req.error);
    req.onsuccess = ()=> resolve(req.result);
  });
}

async function withStore(mode, fn){
  const db = await openDb();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(EMBED_DB_STORE, mode);
    const store = tx.objectStore(EMBED_DB_STORE);
    let res; try { res = fn(store);} catch(e){ reject(e); }
    tx.oncomplete = ()=> resolve(res);
    tx.onerror = ()=> reject(tx.error);
  });
}

export async function getEmbedding(key){
  const cached = lru.get(key);
  if (cached) return { hit:'memory', value: cached.value, meta: cached.meta };
  return withStore('readonly', store=> new Promise((resolve)=>{
    const req = store.get(key);
    req.onsuccess = ()=>{
      if(req.result){
        const { vector, meta } = req.result;
        const buff = atob(vector);
        const arr = new Float32Array(buff.length/4);
        for(let i=0;i<arr.length;i++){
          const o=i*4; arr[i]= new DataView(new Uint8Array([
            buff.charCodeAt(o),buff.charCodeAt(o+1),buff.charCodeAt(o+2),buff.charCodeAt(o+3)
          ]).buffer).getFloat32(0,true);
        }
        lru.set(key,{value:arr, meta});
        resolve({ hit:'disk', value: arr, meta });
      } else resolve(null);
    };
    req.onerror = ()=> resolve(null);
  }));
}

function float32ToBase64(arr){
  const bytes = new Uint8Array(arr.length*4);
  const view = new DataView(bytes.buffer);
  for(let i=0;i<arr.length;i++) view.setFloat32(i*4, arr[i], true);
  let s=''; for(let i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]);
  return btoa(s);
}

export async function setEmbedding(key, vector, meta){
  lru.set(key,{value:vector, meta});
  const base64 = float32ToBase64(vector);
  return withStore('readwrite', store=> store.put({ key, vector: base64, meta }));
}

export { hashString };
