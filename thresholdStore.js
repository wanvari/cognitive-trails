// Threshold persistence for semantic similarity calibration
// Uses IndexedDB store 'semanticMeta' with key 'thresholds'

const SEMANTIC_META_DB = 'semanticMeta';
const SEMANTIC_META_STORE = 'kv';

function openMetaDb(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(SEMANTIC_META_DB,1);
    req.onupgradeneeded = ()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(SEMANTIC_META_STORE)) db.createObjectStore(SEMANTIC_META_STORE, { keyPath:'key' });
    };
    req.onerror = ()=> reject(req.error);
    req.onsuccess = ()=> resolve(req.result);
  });
}

async function metaTxn(mode, fn){
  const db = await openMetaDb();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(SEMANTIC_META_STORE, mode);
    const store = tx.objectStore(SEMANTIC_META_STORE);
    let res; try { res = fn(store); } catch(e){ reject(e); }
    tx.oncomplete = ()=> resolve(res);
    tx.onerror = ()=> reject(tx.error);
  });
}

export async function loadThresholds(){
  try {
    return await metaTxn('readonly', store=> new Promise(r=>{ const req=store.get('thresholds'); req.onsuccess=()=> r(req.result?.value||null); req.onerror=()=> r(null); }));
  } catch { return null; }
}

export async function saveThresholds(obj){
  try { await metaTxn('readwrite', store=> store.put({ key:'thresholds', value: obj, ts: Date.now() })); } catch(e){ console.warn('Save thresholds failed', e); }
}
