// Web Worker (module) for semantic embeddings using E5 small model via Transformers.js
// Converted to ES module to allow importing files that export functions.

import './semanticConfig.js';
import { getEmbedding, setEmbedding, hashString } from './embeddingCache.js';
import { loadThresholds, saveThresholds } from './thresholdStore.js';

let modelLoaded = false;
let modelInfo = { name: 'e5-small', dim: SEMANTIC_CONFIG.model.dim };
let pipeline = null;

// Import Transformers.js dynamically - this may fail in Web Worker context
async function loadTransformers() {
  try {
    console.log('Attempting to load Transformers.js in Web Worker...');
    // Try different import methods
    
    // Method 1: ES6 dynamic import
    try {
      const module = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
      console.log('Transformers.js loaded via ES6 import');
      return module.pipeline;
    } catch (e1) {
      console.warn('ES6 import failed:', e1.message);
    }
    
    // Method 2: importScripts (Web Worker specific)
    try {
      importScripts('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
      if (typeof Transformers !== 'undefined' && Transformers.pipeline) {
        console.log('Transformers.js loaded via importScripts');
        return Transformers.pipeline;
      }
    } catch (e2) {
      console.warn('importScripts failed:', e2.message);
    }
    
    throw new Error('All loading methods failed');
    
  } catch (error) {
    console.error('Failed to load Transformers.js:', error);
    console.log('FALLING BACK TO PSEUDOENCODE - E5 is not available');
    return null;
  }
}

// Real E5 encoder using Transformers.js
async function e5Encode(text) {
  if (!pipeline) {
    throw new Error('E5 model not loaded');
  }
  
  try {
    // E5 models expect "query: " or "passage: " prefix for optimal performance
    const prefixedText = text.startsWith('query:') || text.startsWith('passage:') ? text : `passage: ${text}`;
    
    // Get embedding from E5 model
    const result = await pipeline(prefixedText);
    
    // Handle different possible result formats from Transformers.js
    let vector;
    if (result.data) {
      vector = new Float32Array(result.data);
    } else if (Array.isArray(result)) {
      vector = new Float32Array(result);
    } else if (result.tensor) {
      vector = new Float32Array(result.tensor.data);
    } else {
      throw new Error('Unexpected embedding format from pipeline');
    }
    
    // Update model info with actual dimensions
    if (modelInfo.dim !== vector.length) {
      console.log(`Updating model dimensions from ${modelInfo.dim} to ${vector.length}`);
      modelInfo.dim = vector.length;
      SEMANTIC_CONFIG.model.dim = vector.length;
    }
    
    return vector;
  } catch (error) {
    console.warn('E5 encoding failed, falling back to pseudoEncode:', error);
    return pseudoEncode(text);
  }
}

// Better fallback encoder that considers semantic relationships
function pseudoEncode(text){
  const dim = modelInfo.dim;
  const v = new Float32Array(dim);
  
  // Extract meaningful tokens and apply semantic understanding
  const tokens = text.toLowerCase().split(/\s+/).slice(0,128);
  
  // Create semantic groups for better similarity
  const semanticGroups = {
    'anthropic': ['anthropic', 'claude', 'ai', 'assistant', 'chatbot', 'console', 'docs', 'artificial', 'intelligence', 'dashboard', 'documentation', 'guides', 'technical'],
    'job': ['job', 'career', 'employment', 'work', 'linkedin', 'indeed', 'glassdoor', 'professional', 'hiring', 'resume', 'networking'],
    'tech': ['github', 'programming', 'code', 'developer', 'software', 'tech', 'stackoverflow', 'development', 'coding'],
    'social': ['facebook', 'twitter', 'social', 'networking', 'instagram', 'discussion', 'community', 'forum'],
    'shopping': ['amazon', 'ebay', 'shopping', 'buy', 'retail', 'store', 'ecommerce', 'products'],
    'news': ['news', 'cnn', 'bbc', 'article', 'media', 'journalism', 'current', 'events', 'politics'],
    'video': ['youtube', 'netflix', 'video', 'streaming', 'watch', 'entertainment', 'movies'],
    'education': ['wikipedia', 'learn', 'education', 'university', 'course', 'knowledge', 'encyclopedia', 'reference']
  };
  
  // Map tokens to semantic groups and boost related terms
  const groupCounts = {};
  tokens.forEach(token => {
    // Hash individual token
    let h = 0;
    for(let c = 0; c < token.length; c++) {
      h = (h * 31 + token.charCodeAt(c)) >>> 0;
    }
    const idx = h % dim;
    v[idx] += 1;
    
    // Boost semantic groups
    for(const [group, keywords] of Object.entries(semanticGroups)) {
      if(keywords.some(keyword => token.includes(keyword) || keyword.includes(token))) {
        groupCounts[group] = (groupCounts[group] || 0) + 1;
        // Add to multiple related positions for this group
        const groupHash = semanticHash(group);
        for(let i = 0; i < 5; i++) {
          const groupIdx = (groupHash + i * 73) % dim;
          v[groupIdx] += 0.5; // Boost related semantic areas
        }
      }
    }
  });
  
  // L2 normalize
  let norm = 0;
  for(let i = 0; i < dim; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for(let i = 0; i < dim; i++) v[i] /= norm;
  
  return v;
}

// Simple hash function for consistent group mapping
function semanticHash(str) {
  let hash = 0;
  for(let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function cosine(a,b){
  if(!a||!b||a.length!==b.length) return 0;
  let dot=0, na=0, nb=0; for(let i=0;i<a.length;i++){ const x=a[i], y=b[i]; dot+=x*y; na+=x*x; nb+=y*y; }
  const denom = Math.sqrt(na)*Math.sqrt(nb) || 1;
  return Math.min(1, Math.max(-1, dot/denom));
}

function buildPassage(url, title){
  try {
    const u = new URL(url);
    const domain = u.hostname.replace('www.','');
    const pathSegs = u.pathname.split('/').filter(p=>p && p.length<80).slice(0,5); // More path segments
    
    // Extract meaningful tokens from URL path
    const pathTokens = [];
    pathSegs.forEach(seg => {
      seg.split(/[-_]/).forEach(token => {
        if (token.length > 2 && !/^[0-9]+$/.test(token)) {
          pathTokens.push(token.toLowerCase());
        }
      });
    });
    
    // Clean and preserve more of the title
    const cleanTitle = (title || '').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Add domain context for better semantic understanding
    const domainContext = getDomainContext(domain);
    
    // Build richer passage text
    let passageText = cleanTitle;
    if (domainContext) {
      passageText += ` ${domainContext}`;
    }
    if (pathTokens.length > 0) {
      passageText += ` ${pathTokens.join(' ')}`;
    }
    passageText += ` ${domain}`;
    
    return `passage: ${passageText}`.trim();
  } catch { 
    return `passage: ${(title||'').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim()}`; 
  }
}

// Add semantic context for common domains
function getDomainContext(domain) {
  const domainMap = {
    // Anthropic/Claude domains - CRITICAL FIX
    'claude.ai': 'anthropic claude ai assistant chatbot artificial intelligence',
    'docs.anthropic.com': 'anthropic claude ai documentation technical guides artificial intelligence',
    'console.anthropic.com': 'anthropic claude ai console dashboard artificial intelligence',
    'anthropic.com': 'anthropic claude ai company artificial intelligence research',
    'www.anthropic.com': 'anthropic claude ai company artificial intelligence research',
    
    // Job/Career domains
    'linkedin.com': 'professional networking career jobs',
    'indeed.com': 'job search employment careers',
    'glassdoor.com': 'job reviews company salaries careers',
    'monster.com': 'job search employment careers',
    'careerbuilder.com': 'job search employment careers',
    'ziprecruiter.com': 'job search employment careers',
    
    // Tech domains
    'github.com': 'code development programming software',
    'stackoverflow.com': 'programming development coding technical',
    
    // Social domains
    'reddit.com': 'social discussion community forum',
    'twitter.com': 'social media microblogging news',
    'facebook.com': 'social networking social media',
    
    // Entertainment domains
    'youtube.com': 'video entertainment content streaming',
    'netflix.com': 'video streaming entertainment movies',
    
    // Shopping domains
    'amazon.com': 'shopping ecommerce retail products',
    'ebay.com': 'shopping ecommerce auction marketplace',
    
    // Information domains
    'wikipedia.org': 'knowledge encyclopedia information reference',
    'medium.com': 'articles blogging writing content',
    
    // News domains
    'news.ycombinator.com': 'technology news startup programming',
    'techcrunch.com': 'technology news startup business',
    'cnn.com': 'news current events politics',
    'bbc.com': 'news current events international',
    'nytimes.com': 'news journalism politics current events'
  };
  
  // Also check for partial domain matches for Anthropic
  if (!domainMap[domain]) {
    if (domain.includes('anthropic') || domain.includes('claude')) {
      return 'anthropic claude ai artificial intelligence assistant chatbot';
    }
  }
  
  return domainMap[domain] || '';
}

async function handleInit(){
  if(modelLoaded){ return { ok:true, already:true, model:modelInfo, thresholds: SEMANTIC_CONFIG.thresholds }; }
  
  console.log('Loading E5 embedding model...');
  
  try {
    // Load Transformers.js pipeline
    const createPipeline = await loadTransformers();
    
    if (createPipeline) {
      console.log('Loading E5-small-v2 model...');
      // Load E5-small model for feature extraction
      pipeline = await createPipeline('feature-extraction', 'Xenova/e5-small-v2', {
        quantized: false, // Try unquantized first to ensure accuracy
        pooling: 'mean', // Use mean pooling for sentence-level embeddings
        normalize: true,  // L2 normalize the embeddings
      });
      
      // Test the model with a sample text to get actual dimensions
      const testVector = await e5Encode('test');
      modelInfo.dim = testVector.length;
      SEMANTIC_CONFIG.model.dim = testVector.length;
      
      console.log(`E5 model loaded successfully, embedding dimension: ${modelInfo.dim}`);
    } else {
      console.log('Using fallback pseudoEncode method');
    }
    
    // Load persisted thresholds
    const persisted = await loadThresholds();
    if(persisted && typeof persisted.related === 'number'){ 
      Object.assign(SEMANTIC_CONFIG.thresholds, persisted); 
    }
    
    modelLoaded = true;
    return { ok:true, model:modelInfo, thresholds: SEMANTIC_CONFIG.thresholds, usingE5: !!pipeline };
    
  } catch(error) {
    console.warn('Failed to load E5 model, using fallback:', error);
    modelLoaded = true; // Still mark as loaded to avoid retry loops
    return { ok:true, model:modelInfo, thresholds: SEMANTIC_CONFIG.thresholds, usingE5: false, error: error.message };
  }
}

async function embedOne(text){
  const key = hashString(text);
  const cached = await getEmbedding(key);
  if(cached) return { vector: cached.value, key, from: cached.hit };
  
  // Use real E5 model if available, otherwise fallback to pseudoEncode
  let vector, method;
  if (pipeline) {
    try {
      vector = await e5Encode(text);
      method = 'E5';
    } catch (error) {
      console.error('E5 encoding failed:', error);
      vector = pseudoEncode(text);
      method = 'pseudo';
    }
  } else {
    vector = pseudoEncode(text);
    method = 'pseudo';
  }
  
  // Debug log for first few embeddings
  if (Math.random() < 0.05) {
    console.log(`Generated embedding using ${method} method:`, {
      textPreview: text.substring(0, 50) + '...',
      vectorLength: vector.length,
      vectorSample: Array.from(vector.slice(0, 5)).map(x => x.toFixed(4))
    });
  }
  
  await setEmbedding(key, vector, { t: Date.now(), textHash: hashString(text) });
  return { vector, key, from: 'new', method };
}

async function embedBatch(inputs){
  const out=[]; for(const inp of inputs){ out.push(await embedOne(inp)); } return out;
}

async function similarityForPair(a,b){
  const passageA = buildPassage(a.url || a, a.title);
  const passageB = buildPassage(b.url || b, b.title);
  
  const ea = await embedOne(passageA);
  const eb = await embedOne(passageB);
  const similarity = cosine(ea.vector, eb.vector);
  
  // Debug logging for interesting pairs
  const domainA = (a.url || a).includes('://') ? new URL(a.url || a).hostname : (a.url || a);
  const domainB = (b.url || b).includes('://') ? new URL(b.url || b).hostname : (b.url || b);
  
  // Log same-company or clearly related domains - ALWAYS log Anthropic comparisons
  if (similarity > 0.8 || similarity < 0.2 || 
      (domainA.includes('anthropic') || domainA.includes('claude')) ||
      (domainB.includes('anthropic') || domainB.includes('claude')) ||
      Math.random() < 0.02) {
    console.log('=== SIMILARITY CALCULATION DEBUG ===');
    console.log('DomainA:', domainA);
    console.log('DomainB:', domainB);
    console.log('Full PassageA:', passageA);
    console.log('Full PassageB:', passageB);
    console.log('Similarity:', similarity.toFixed(4));
    console.log('Method A:', ea.method || 'unknown');
    console.log('Method B:', eb.method || 'unknown');
    console.log('Using E5:', !!pipeline);
    console.log('==========================================');
  }
  
  return { sim: similarity, aKey: ea.key, bKey: eb.key };
}

let similaritySamples = [];

function calibrateIfNeeded(){
  const cfg = SEMANTIC_CONFIG.calibration;
  if(similaritySamples.length < cfg.window) return;
  similaritySamples = similaritySamples.slice(-cfg.window);
  const sorted = [...similaritySamples].sort((a,b)=>a-b);
  const idx = Math.floor((1-cfg.targetTopFraction)*sorted.length);
  const newRelated = sorted[idx] || SEMANTIC_CONFIG.thresholds.related;
  const before = SEMANTIC_CONFIG.thresholds.related;
  SEMANTIC_CONFIG.thresholds.related = Math.max(SEMANTIC_CONFIG.thresholds.topicShift+0.01, Math.min(0.95, newRelated));
  if(Math.abs(before - SEMANTIC_CONFIG.thresholds.related) > 0.005){ saveThresholds(SEMANTIC_CONFIG.thresholds); }
}

function noteSimilarity(sim){
  similaritySamples.push(sim);
  if(similaritySamples.length % SEMANTIC_CONFIG.calibration.adjustEvery === 0){ calibrateIfNeeded(); }
}

function lexicalScore(a,b){ // simple token overlap for shortlist fallback
  const sa=new Set(a.split(/\s+/)); const sb=new Set(b.split(/\s+/));
  let inter=0; sa.forEach(t=>{ if(sb.has(t)) inter++; });
  return inter / Math.max(1, Math.min(sa.size,sb.size));
}

function tokenizeLex(s){ return s.toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>2); }
function buildLexEntry(raw){
  const lex = `${raw.title||''} ${raw.url||''}`; const tokens = tokenizeLex(lex);
  return { raw, lex, tokens };
}

function buildIdf(recent){
  const df = new Map(); const N = recent.length || 1;
  recent.forEach(r=>{ const seen=new Set(); r.tokens.forEach(t=>{ if(!seen.has(t)){ seen.add(t); df.set(t,(df.get(t)||0)+1); } }); });
  const idf = new Map(); df.forEach((v,k)=> idf.set(k, Math.log( (N+1)/(v+0.5) )) );
  return idf;
}

function bm25Score(qTokens, docTokens, idf){
  const avgdl = docTokens.length || 1; const k1=1.2, b=0.75; let score=0; const qFreq={}; qTokens.forEach(t=> qFreq[t]=(qFreq[t]||0)+1);
  const freqs={}; docTokens.forEach(t=> freqs[t]=(freqs[t]||0)+1);
  Object.keys(qFreq).forEach(t=>{ if(!freqs[t]) return; const f=freqs[t]; const id = idf.get(t)||0; const denom = f + k1*(1-b + b*(docTokens.length/avgdl)); score += id * ((f*(k1+1))/(denom)); });
  return score;
}

function shortlist(current, recents, K){
  const curEntry = buildLexEntry(current.raw);
  const recEntries = recents.map(r=> buildLexEntry(r.raw));
  const idf = buildIdf([curEntry, ...recEntries]);
  const qTokens = curEntry.tokens;
  const scored = recEntries.map(e=> ({ r: e.raw, score: bm25Score(qTokens, e.tokens, idf) }));
  scored.sort((a,b)=> b.score - a.score);
  return scored.slice(0,K).map(o=>o.r);
}

async function classifyTransition(a,b,timeDiff){
  const { sim } = await similarityForPair(a,b);
  noteSimilarity(sim);
  if(timeDiff <= 5*60*1000 && sim >= SEMANTIC_CONFIG.thresholds.related) return { type:'related', sim };
  if(sim >= SEMANTIC_CONFIG.thresholds.topicShift || timeDiff <= 30*60*1000) return { type:'topic_shift', sim };
  return { type:'context_switch', sim };
}

self.onmessage = async (e)=>{
  const { id, type, payload } = e.data;
  try {
    let result;
    if(type==='init') result = await handleInit();
    else if(type==='embedBatch') result = await embedBatch(payload.inputs);
    else if(type==='similarityForPair') result = await similarityForPair(payload.a, payload.b);
    else if(type==='cosine') result = cosine(payload.a, payload.b);
    else if(type==='shortlistCandidates') result = shortlist(payload.current, payload.recents, payload.K||SEMANTIC_CONFIG.shortlistSize);
    else if(type==='classifyTransition') result = await classifyTransition(payload.a, payload.b, payload.timeDiffMs);
    else result = { error: 'unknown type'};
    self.postMessage({ id, result });
  } catch(err){
    self.postMessage({ id, error: err.message || String(err) });
  }
};
