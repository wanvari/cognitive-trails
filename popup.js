// Cognitive Transition Analysis for Browser History
// Analyzes how the user's attention flows between different types of content

const FILTERED_DOMAINS = ['google.com', 'www.google.com', 'bing.com', 'duckduckgo.com'];

// Transition type colors for connection lines
const TRANSITION_COLORS = {
  'related': '#4285f4',        // Blue - staying on topic
  'topic_shift': '#f4b942',   // Yellow - moderate cognitive jump  
  'context_switch': '#ea4335', // Red - major mental gear change
  'default': '#9e9e9e'         // Gray - uncertain/default
};

// All nodes will be colored gray since we focus on transitions, not topics
const NODE_COLORS = {
  default: '#9e9e9e'
};
const DEFAULT_NODE_COLOR = NODE_COLORS.default;

// Transition analysis thresholds
const TRANSITION_THRESHOLDS = {
  TIME_RELATED: 5 * 60 * 1000,
  TIME_TOPIC_SHIFT: 30 * 60 * 1000,
  SEMANTIC_RELATED: 0.4,
  SEMANTIC_TOPIC_SHIFT: 0.1
};

// --- Local Semantic Analysis (No External Dependencies) ---
const SEM_CFG = (typeof window !== 'undefined' && window.SEMANTIC_CONFIG) ? window.SEMANTIC_CONFIG : { thresholds:{ related:0.70, topicShift:0.40 } };

// Calculate similarity using local semantic analyzer
function calculateLocalSimilarity(itemA, itemB) {
  console.log('=== LOCAL SEMANTIC SIMILARITY ===');
  
  if (!window.localSemanticAnalyzer) {
    console.error('❌ Local semantic analyzer not available');
    throw new Error('Local semantic analyzer not available');
  }
  
  try {
    const similarity = window.localSemanticAnalyzer.calculateSimilarity(itemA, itemB);
    
    console.log('✅ Local Similarity Result:', similarity.toFixed(6));
    console.log('================================');
    
    return similarity;
    
  } catch (error) {
    console.error('❌ Local similarity calculation failed:', error);
    console.log('================================');
    throw error;
  }
}
// ----------------------------------------------------

class HistoryGraphVisualizer {
  constructor() {
    this.svg = null;
    this.g = null;
    this.width = 1000;
    this.height = 650;
    this.nodes = [];
    this.links = [];
    this.simulation = null;
    this.zoom = null;
    this.transitions = new Map(); // Store transition analysis results
  // Cognitive analysis state
  this.temporalAnalysis = null;
  this.complexityByHour = new Array(24).fill().map(() => ({ total: 0, count: 0 }));
  this.chains = [];
  this.focusSessions = [];
  this.graphMetrics = null;
  this.insights = null;
  // Interaction / focus state
  this.selectionFrozen = false; // Whether a node focus is frozen
  this.selectedNode = null;     // Currently selected (focused) node domain
  this.linkSelection = null;    // d3 selection of links (set in createVisualization)
  this.nodeSelection = null;    // d3 selection of nodes
  this.labelSelection = null;   // d3 selection of labels
  this.currentScale = 1;        // track zoom scale for LOD logic
    
    this.init();
  }

  init() {
    this.setupSVG();
    this.setupEventListeners();
    this.loadAndVisualize();
    
    // Handle window resize for full-screen tab
    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }

  setupSVG() {
    const container = document.getElementById('graph-container');
    const rect = container.getBoundingClientRect();
    this.width = rect.width || 1000;  // Fallback width
    this.height = rect.height || 650; // Fallback height
    
    // Validate dimensions
    if (isNaN(this.width) || this.width <= 0) this.width = 1000;
    if (isNaN(this.height) || this.height <= 0) this.height = 650;
    
    console.log(`SVG dimensions: ${this.width}x${this.height}`);

    this.svg = d3.select('#graph')
      .attr('width', this.width)
      .attr('height', this.height);

    // Create a group for all graph elements (for pan/zoom)
    this.g = this.svg.append('g');

    // Idempotently add refined arrow marker (thin open chevron) for directed edges
    if (!this.svg.select('defs#graph-defs').node()) {
      const defs = this.svg.append('defs').attr('id', 'graph-defs');
      // Thin open chevron: direction cue without heavy visual weight
      defs.append('marker')
        .attr('id', 'arrowhead-thin')
        .attr('viewBox', '0 -3 6 6')
        .attr('refX', 6) // tip of arrow path at x=6
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .attr('markerUnits', 'userSpaceOnUse') // constant size independent of stroke width
        .append('path')
        .attr('d', 'M0,-3 L6,0 L0,3')
        .attr('fill', 'none')
        .attr('stroke', 'currentColor')
        .attr('stroke-width', 1.2)
        .attr('stroke-linejoin', 'round')
        .attr('opacity', 0.9);
    }

    // Set up zoom behavior
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .wheelDelta((event) => {
  // Slightly increased scroll zoom sensitivity (previous pixel factor 0.002 -> 0.003, line factor 0.05 -> 0.07)
  return -event.deltaY * (event.deltaMode === 1 ? 0.07 : event.deltaMode ? 1 : 0.003);
      })
      .on('zoom', (event) => {
        // Validate transform values to prevent NaN
        const transform = event.transform;
        if (isNaN(transform.x) || isNaN(transform.y) || isNaN(transform.k) || transform.k <= 0) {
          console.warn('Invalid transform detected, resetting:', transform);
          // Reset to identity transform
          const identity = d3.zoomIdentity;
          this.svg.call(this.zoom.transform, identity);
          this.g.attr('transform', identity);
          this.updateZoomDisplay(1);
          return;
        }
        
        this.g.attr('transform', transform);
        // Update zoom level display
        this.updateZoomDisplay(transform.k);
  // Apply level-of-detail updates (labels visibility & link thickness)
  this.updateLevelOfDetail(transform.k);
      });

    this.svg.call(this.zoom);

    // Prevent default scrolling on the container
    document.getElementById('graph-container').addEventListener('wheel', (event) => {
      event.preventDefault();
    });

    // Add zoom controls info
    this.addZoomControls();
  }

  setupEventListeners() {
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.loadAndVisualize();
    });
  }

  handleResize() {
    const container = document.getElementById('graph-container');
    const rect = container.getBoundingClientRect();
    const newWidth = rect.width;
    const newHeight = rect.height;
    
    if (newWidth !== this.width || newHeight !== this.height) {
      this.width = newWidth;
      this.height = newHeight;
      
      // Update SVG dimensions
      this.svg
        .attr('width', this.width)
        .attr('height', this.height);
      
      // Update force simulation center
      if (this.simulation) {
        this.simulation
          .force('center', d3.forceCenter(this.width / 2, this.height / 2))
          .alpha(0.3)
          .restart();
      }
    }
  }

  addZoomControls() {
    // Add zoom control buttons
    const zoomControls = document.createElement('div');
    zoomControls.style.cssText = 'position: absolute; top: 70px; right: 16px; display: flex; flex-direction: column; gap: 4px; z-index: 100;';
    
    const zoomInBtn = document.createElement('button');
    zoomInBtn.textContent = '+';
    zoomInBtn.className = 'zoom-control';
    zoomInBtn.style.fontSize = '18px';
    zoomInBtn.title = 'Zoom In (or scroll up)';
    zoomInBtn.addEventListener('click', () => {
      this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.5);
    });
    
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.textContent = '−';
    zoomOutBtn.className = 'zoom-control';
    zoomOutBtn.style.fontSize = '18px';
    zoomOutBtn.title = 'Zoom Out (or scroll down)';
    zoomOutBtn.addEventListener('click', () => {
      this.svg.transition().duration(300).call(this.zoom.scaleBy, 1/1.5);
    });
    
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '⌂';
    resetBtn.className = 'zoom-control';
    resetBtn.style.fontSize = '14px';
    resetBtn.title = 'Reset View';
    resetBtn.addEventListener('click', () => {
      this.svg.transition().duration(500).call(this.zoom.transform, d3.zoomIdentity);
    });
    
    // Add zoom level display
    const zoomDisplay = document.createElement('div');
    zoomDisplay.id = 'zoom-display';
    zoomDisplay.style.cssText = 'width: 30px; height: 20px; background: white; border: 1px solid #ccc; border-radius: 4px; font-size: 10px; text-align: center; line-height: 20px; color: #666; font-weight: bold;';
    zoomDisplay.textContent = '100%';
    zoomDisplay.title = 'Current zoom level';
    
    zoomControls.appendChild(zoomInBtn);
    zoomControls.appendChild(zoomOutBtn);
    zoomControls.appendChild(resetBtn);
    zoomControls.appendChild(zoomDisplay);
    
    document.getElementById('graph-container').appendChild(zoomControls);
    
    // Add instructions
    const instructions = document.createElement('div');
    instructions.textContent = '🖱️ Scroll to zoom • Drag to pan • Drag nodes to move';
    instructions.style.cssText = 'position: absolute; bottom: 8px; left: 16px; font-size: 11px; color: #666; background: rgba(255,255,255,0.9); padding: 6px 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
    document.getElementById('graph-container').appendChild(instructions);
  }

  updateZoomDisplay(scale) {
    const zoomDisplay = document.getElementById('zoom-display');
    if (zoomDisplay) {
      // Validate scale value
      if (isNaN(scale) || !isFinite(scale) || scale <= 0) {
        console.warn('Invalid scale for zoom display:', scale);
        scale = 1; // Default to 100%
      }
      
      const percentage = Math.round(scale * 100);
      zoomDisplay.textContent = `${percentage}%`;
      
      // Change color based on zoom level
      if (scale < 0.5) {
        zoomDisplay.style.color = '#1976d2'; // Blue for zoomed out
      } else if (scale > 2) {
        zoomDisplay.style.color = '#d32f2f'; // Red for zoomed in
      } else {
        zoomDisplay.style.color = '#666'; // Default gray
      }
    }
  }

  async loadAndVisualize() {
    try {
      document.getElementById('loading').style.display = 'block';
      document.getElementById('loading').textContent = 'Loading history data...';
      
      // Check if chrome.history is available
      if (!chrome?.history) {
        throw new Error('Chrome history API not available');
      }
      
      const historyItems = await this.getHistoryData();
      
      if (!historyItems || historyItems.length === 0) {
        document.getElementById('loading').textContent = 'No history data found. Please check permissions.';
        return;
      }
      
      document.getElementById('loading').textContent = `Processing ${historyItems.length} history items...`;
      
      let processedData;
      try {
        processedData = await this.processHistoryData(historyItems);
      } catch (transitionError) {
        console.warn('Transition analysis failed, using fallback:', transitionError);
        document.getElementById('loading').textContent = 'Using basic grouping...';
        processedData = await this.processHistoryDataFallback(historyItems);
      }
      
      if (processedData.nodes.length === 0) {
        document.getElementById('loading').textContent = 'No valid domains found in history.';
        return;
      }
      
      document.getElementById('loading').textContent = 'Creating visualization...';
      this.createVisualization(processedData);
      this.updateLegend();
      
      document.getElementById('loading').style.display = 'none';
      
    } catch (error) {
      console.error('Error in loadAndVisualize:', error);
      document.getElementById('loading').textContent = `Error: ${error.message}`;
      document.getElementById('loading').style.color = '#d93025';
    }
  }

  getHistoryData() {
    return new Promise((resolve, reject) => {
      try {
        // Add timeout to prevent infinite loading
        const timeout = setTimeout(() => {
          reject(new Error('History API request timed out'));
        }, 10000); // 10 second timeout

        chrome.history.search({
          text: '',
          maxResults: 2000, // Increased from 500
          startTime: Date.now() - (7 * 24 * 60 * 60 * 1000) // Last 7 days for more recent transitions
        }, (results) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message || 'History API error'));
          } else {
            console.log(`Found ${results ? results.length : 0} history items`);
            console.log('Sample items:', results?.slice(0, 5));
            resolve(results || []);
          }
        });
      } catch (error) {
        reject(new Error(`Failed to access history: ${error.message}`));
      }
    });
  }

  async processHistoryData(historyItems) {
    try {
      const domainData = new Map();
      const connections = new Map();
  // Collect visit events (sorted later) for cognitive analyses
  const visitEvents = [];
      
      console.log(`Starting cognitive transition analysis for ${historyItems.length} history items`);
      
      document.getElementById('loading').textContent = 'Analyzing cognitive transitions...';
      
      // Sort history items chronologically
      const sortedHistory = historyItems
        .filter(item => !FILTERED_DOMAINS.some(d => this.extractDomain(item.url).includes(d)))
        .sort((a, b) => a.lastVisitTime - b.lastVisitTime);
      
      console.log(`Analyzing transitions between ${sortedHistory.length} history entries`);
      
      // Build domain data (all nodes will be gray)
      for (const item of sortedHistory) {
        const domain = this.extractDomain(item.url);
        
        if (!domainData.has(domain)) {
          domainData.set(domain, {
            domain,
            title: item.title,
            visitCount: 0,
            color: DEFAULT_NODE_COLOR, // All nodes are gray
            lastVisit: item.lastVisitTime,
            urls: new Set()
          });
        }
        
        const data = domainData.get(domain);
        data.visitCount++;
        data.urls.add(item.url);
        data.lastVisit = Math.max(data.lastVisit, item.lastVisitTime);
        visitEvents.push({
          domain,
          url: item.url,
            title: item.title || '',
          time: item.lastVisitTime
        });
      }

      document.getElementById('loading').textContent = 'Analyzing attention flow patterns...';
      
      // Analyze transitions between consecutive visits
      for (let i = 0; i < sortedHistory.length - 1; i++) {
        const current = sortedHistory[i];
        const next = sortedHistory[i + 1];
        const currentDomain = this.extractDomain(current.url);
        const nextDomain = this.extractDomain(next.url);
        if (currentDomain === nextDomain) continue;
        let transitionType, semanticSimilarity = 0;
        try {
          // Use local semantic analyzer
          semanticSimilarity = calculateLocalSimilarity(
            { url: current.url, title: current.title },
            { url: next.url, title: next.title }
          );
          
          const timeDiff = next.lastVisitTime - current.lastVisitTime;
          
          // Classify transition based on semantic similarity and time
          if (timeDiff <= 5 * 60 * 1000 && semanticSimilarity >= SEM_CFG.thresholds.related) {
            transitionType = 'related';
          } else if (semanticSimilarity >= SEM_CFG.thresholds.topicShift || timeDiff <= 30 * 60 * 1000) {
            transitionType = 'topic_shift';
          } else {
            transitionType = 'context_switch';
          }
          
        } catch(err){
          console.warn('❌ E5 similarity calculation failed, using basic heuristic:', err);
          semanticSimilarity = this.calculateBasicSimilarity(current, next);
          
          console.log('Fallback Similarity Calculation:', {
            currentUrl: current.url,
            nextUrl: next.url,
            fallbackSimilarity: semanticSimilarity.toFixed(6),
            method: 'basic_fallback'
          });
          
          // Use fallback classification
          if (semanticSimilarity >= 0.7) {
            transitionType = 'related';
          } else if (semanticSimilarity >= 0.3) {
            transitionType = 'topic_shift';
          } else {
            transitionType = 'context_switch';
          }
        }
        const connectionKey = `${currentDomain}-${nextDomain}`;
        if (!connections.has(connectionKey)) {
          const connection = { 
            source: currentDomain, 
            target: nextDomain, 
            weight: 1, 
            transitionType, 
            color: TRANSITION_COLORS[transitionType] || TRANSITION_COLORS.default, 
            lastTime: next.lastVisitTime,
            similarity: semanticSimilarity // Store similarity score for visualization
          };
          connections.set(connectionKey, connection);
          if (connections.size <= 10) console.log(`Connection ${connections.size}:`, currentDomain, '->', nextDomain, 'Type:', transitionType, 'Similarity:', semanticSimilarity?.toFixed(3), 'Color:', connection.color);
        } else {
          const conn = connections.get(connectionKey); 
          conn.weight++; 
          if (next.lastVisitTime > conn.lastTime) {
            conn.lastTime = next.lastVisitTime;
          }
          // Update similarity score if we have a newer calculation
          if (semanticSimilarity && semanticSimilarity > (conn.similarity || 0)) {
            conn.similarity = semanticSimilarity;
          }
        }
        if (i % 50 === 0) { document.getElementById('loading').textContent = `Analyzing transitions... ${i}/${sortedHistory.length}`; await new Promise(resolve => setTimeout(resolve, 1)); }
      }

      // Store transitions for legend generation
      this.transitions = this.calculateTransitionStats(connections);

  // Run cognitive analyses
  this.temporalAnalysis = this.analyzeTemporalPatterns(visitEvents);
  this.detectInformationChains(visitEvents);
  this.analyzeFocusSessions(visitEvents);
  this.graphMetrics = this.calculateGraphMetrics(Array.from(domainData.values()), Array.from(connections.values()));
  this.insights = this.generateInsights();
  // Cognitive panels moved to dedicated dashboard (analysis.html)
      
      console.log(`Completed transition analysis: ${domainData.size} domains, ${connections.size} transitions`);

      return {
        nodes: Array.from(domainData.values()),
        links: Array.from(connections.values())
      };
      
    } catch (error) {
      console.error('Error in processHistoryData:', error);
      throw error;
    }
  }

  // (1) Temporal Pattern Analysis
  analyzeTemporalPatterns(visitEvents) {
    const hourlyActivity = new Array(24).fill(0);
    const visitsSorted = [...visitEvents].sort((a,b) => a.time - b.time);
    // For sessions average length
    let sessions = [];
    let sessionStart = null;
    let lastTime = null;
    const SESSION_GAP = 5 * 60 * 1000;
    visitsSorted.forEach(v => {
      const date = new Date(v.time);
      const h = date.getHours();
      hourlyActivity[h]++;
      if (lastTime === null || (v.time - lastTime) > SESSION_GAP) {
        if (sessionStart !== null) {
          sessions.push(lastTime - sessionStart);
        }
        sessionStart = v.time;
      }
      lastTime = v.time;
    });
    if (sessionStart !== null && lastTime !== null) sessions.push(lastTime - sessionStart);
    const avgSessionLength = sessions.length ? sessions.reduce((a,b)=>a+b,0)/sessions.length : 0;
    // Peak hours > 75th percentile
    const sortedCounts = [...hourlyActivity].sort((a,b)=>a-b);
    const threshold = sortedCounts[Math.floor(0.75 * sortedCounts.length)] || 0;
    const peakHours = hourlyActivity.map((c,i)=>({c,i})).filter(o=>o.c>=threshold && o.c>0).map(o=>o.i);
    // Ultradian rhythm detection via simple autocorrelation between 60-150 mins window on minute resolution aggregated
    // Convert to minute series repeating hour counts (rough approx)
    const minuteSeries = [];
    // Represent one day (1440) using distribution proportions
    const total = hourlyActivity.reduce((a,b)=>a+b,0) || 1;
    for (let h=0; h<24; h++) {
      const count = hourlyActivity[h];
      const perMinute = count / 60;
      for (let m=0; m<60; m++) minuteSeries.push(perMinute);
    }
    function autocorr(series, lag){
      const n = series.length - lag;
      if (n <= 1) return 0;
      let mean = series.reduce((a,b)=>a+b,0)/series.length;
      let num=0, den=0;
      for (let i=0;i<n;i++){ num += (series[i]-mean)*(series[i+lag]-mean); }
      for (let i=0;i<series.length;i++){ den += (series[i]-mean)**2; }
      return den ? num/den : 0;
    }
    let bestLag = null, bestR = -Infinity;
    for (let lag=90; lag<=120; lag+=5){ // test 90-120 minute cycles
      const r = autocorr(minuteSeries, lag);
      if (r > bestR) { bestR = r; bestLag = lag; }
    }
    return {
      hourlyActivity,
      peakHours,
      rhythmPeriod: bestLag || null,
      avgSessionMinutes: +(avgSessionLength/60000).toFixed(2)
    };
  }

  // (2) Content Complexity Scoring
  calculateComplexity(domain, title='') {
    const base = {
      'github.com': 0.7,'stackoverflow.com':0.8,'arxiv.org':0.9,
      'wikipedia.org':0.6,'reddit.com':0.4,'youtube.com':0.3
    };
    let score = base[domain] ?? 0.5;
    const lower = title.toLowerCase();
    const plus = ['documentation','api','tutorial','research'];
    const minus = ['meme','funny','social'];
    plus.forEach(k=>{ if(lower.includes(k)) score += 0.1; });
    minus.forEach(k=>{ if(lower.includes(k)) score -= 0.1; });
    return Math.min(1, Math.max(0, score));
  }

  // Helper for semantic similarity (reused for chains/sessions)
  jaccardSimilarityTokens(a, b) {
    const ta = (a||'').toLowerCase().match(/\b\w+\b/g) || [];
    const tb = (b||'').toLowerCase().match(/\b\w+\b/g) || [];
    const sa = new Set(ta);
    const sb = new Set(tb);
    const inter = [...sa].filter(x=>sb.has(x));
    const union = new Set([...sa, ...sb]);
    return union.size ? inter.length/union.size : 0;
  }

  // (3) Information Foraging Chain Detection
  detectInformationChains(visitEvents) {
    const events = [...visitEvents].sort((a,b)=>a.time-b.time);
    const chains = [];
    let current = [];
    const MAX_GAP = 5*60*1000;
    for (let i=0;i<events.length;i++) {
      const e = events[i];
      if (!current.length) { current.push(e); continue; }
      const prev = current[current.length-1];
      const sim = this.jaccardSimilarityTokens(prev.title+prev.domain, e.title+e.domain);
      if ( (e.time - prev.time) <= MAX_GAP && sim > 0.3 ) {
        current.push(e);
      } else {
        if (current.length>1) chains.push(this.summarizeChain(current));
        current = [e];
      }
    }
    if (current.length>1) chains.push(this.summarizeChain(current));
    this.chains = chains;
    return chains;
  }

  summarizeChain(events) {
    const durationMs = events[events.length-1].time - events[0].time || 1;
    const complexities = events.map(e=> this.calculateComplexity(e.domain, e.title));
    const avgComplexity = complexities.reduce((a,b)=>a+b,0)/complexities.length;
    const chainLength = events.length;
    const minutes = durationMs/60000 || 1;
    const scentStrength = +(chainLength / minutes).toFixed(2);
    return {
      length: chainLength,
      durationMinutes: +minutes.toFixed(2),
      avgComplexity: +avgComplexity.toFixed(2),
      scentStrength,
      topic: 'general'
    };
  }

  // (4) Focus Session Analysis
  analyzeFocusSessions(visitEvents) {
    const events = [...visitEvents].sort((a,b)=>a.time-b.time);
    const sessions = [];
    let session = [];
    const MAX_GAP = 5*60*1000;
    for (let i=0;i<events.length;i++) {
      const e = events[i];
      if (!session.length) { session.push(e); continue; }
      const prev = session[session.length-1];
      const sim = this.jaccardSimilarityTokens(prev.title+prev.domain, e.title+e.domain);
      if ((e.time - prev.time) <= MAX_GAP && (prev.domain===e.domain || sim>0.4)) {
        session.push(e);
      } else {
        sessions.push(this.summarizeSession(session));
        session = [e];
      }
    }
    if (session.length) sessions.push(this.summarizeSession(session));
    this.focusSessions = sessions;
    // Complexity by hour accumulation
    sessions.forEach(s=>{
      s.events.forEach(ev=>{
        const h = new Date(ev.time).getHours();
        const c = this.calculateComplexity(ev.domain, ev.title);
        this.complexityByHour[h].total += c; this.complexityByHour[h].count++;
      });
    });
    return sessions;
  }

  summarizeSession(events) {
    const durationMs = events[events.length-1].time - events[0].time || 1;
    const complexities = events.map(e=> this.calculateComplexity(e.domain, e.title));
    const avgComplexity = complexities.reduce((a,b)=>a+b,0)/complexities.length;
    return {
      durationMinutes: +(durationMs/60000).toFixed(2),
      pages: events.length,
      avgComplexity: +avgComplexity.toFixed(2),
      category: 'general',
      events
    };
  }

  // (5) Knowledge Graph Metrics
  calculateGraphMetrics(nodes, links) {
    // Betweenness centrality approximation via counting middle nodes in simple paths of length 2
    const adjacency = new Map();
    nodes.forEach(n=>adjacency.set(n.domain, new Set()));
    links.forEach(l=>{ adjacency.get(l.source).add(l.target); });
    const betweenness = new Map();
    nodes.forEach(n=>betweenness.set(n.domain,0));
    nodes.forEach(a=>{
      nodes.forEach(b=>{
        if (a===b) return;
        const aNeighbors = adjacency.get(a.domain);
        aNeighbors.forEach(mid=>{
          const midNeighbors = adjacency.get(mid) || new Set();
          if (midNeighbors.has(b.domain)) {
            betweenness.set(mid, betweenness.get(mid)+1);
          }
        });
      });
    });
    const hubs = [...betweenness.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([d,v])=>({domain:d,score:v}));
    // Entropy of domain visits
    const totalVisits = nodes.reduce((a,b)=>a+b.visitCount,0) || 1;
    const diversity = -nodes.reduce((sum,n)=>{ const p=n.visitCount/totalVisits; return sum + (p? p*Math.log2(p):0); },0);
    return { betweenness: Object.fromEntries(betweenness), hubs, informationDiversity: +diversity.toFixed(3) };
  }

  // (6) Cognitive Rhythm Visualizations
  renderCognitivePanels() {
    const heatmapContainer = document.getElementById('complexity-heatmap');
    const focusContainer = document.getElementById('focus-timeline');
    if (heatmapContainer) this.renderComplexityHeatmap(heatmapContainer);
    if (focusContainer) this.renderFocusTimeline(focusContainer);
    this.renderInsights();
  }

  renderComplexityHeatmap(container) {
    container.innerHTML = '';
    const data = this.complexityByHour.map(o=> o.count? o.total/o.count : 0);
    const w = 12*24; const h = 60;
    const svg = d3.select(container).append('svg').attr('width', w).attr('height', h);
    const color = d3.scaleSequential(d3.interpolateRdYlBu).domain([1,0]);
    const peak = [];
    data.forEach((v,i)=>{ if (v>0.7) peak.push(i); });
    svg.selectAll('rect').data(data).enter().append('rect')
      .attr('x',(d,i)=>i*12).attr('y',10).attr('width',12).attr('height',30)
      .attr('fill',d=>color(d))
      .attr('stroke',d=> d>0.7 ? '#000' : '#fff')
      .append('title').text((d,i)=>`Hour ${i}: ${(d*100).toFixed(0)}% complexity`);
    // Axis labels
    svg.selectAll('text.hour').data([0,6,12,18,23]).enter().append('text').attr('class','hour')
      .attr('x',d=>d*12+6).attr('y',55).attr('text-anchor','middle').attr('font-size',9).text(d=>d);
  }

  renderFocusTimeline(container) {
    container.innerHTML='';
    const sessions = this.focusSessions.slice(-30); // recent sessions
    const w = container.clientWidth || 300;
    const barH = 10;
    const h = sessions.length * (barH+4) + 20;
    const svg = d3.select(container).append('svg').attr('width', w).attr('height', h);
    const maxDur = d3.max(sessions, s=>s.durationMinutes)||1;
    const x = d3.scaleLinear().domain([0,maxDur]).range([60, w-10]);
    const cats = [...new Set(sessions.map(s=>s.category))];
    const catColor = d3.scaleOrdinal().domain(cats).range(['#4285f4','#f4b942','#ea4335','#34a853']);
    svg.selectAll('g.session').data(sessions).enter().append('rect')
      .attr('x',60).attr('y',(d,i)=>i*(barH+4)+10).attr('height',barH)
      .attr('width',d=>x(d.durationMinutes)-60)
      .attr('fill',d=>catColor(d.category))
      .attr('opacity',d=>0.4 + 0.6*d.avgComplexity)
      .append('title').text(d=>`Duration ${d.durationMinutes}m, complexity ${d.avgComplexity}`);
    // Y labels
    svg.selectAll('text.label').data(sessions).enter().append('text')
      .attr('x',0).attr('y',(d,i)=>i*(barH+4)+18).attr('font-size',9).text((d,i)=>`S${i+1}`);
    // X axis ticks
    const ticks = x.ticks(4);
    svg.selectAll('text.xtick').data(ticks).enter().append('text')
      .attr('x',d=>x(d)).attr('y',h-4).attr('font-size',9).attr('text-anchor','middle').text(d=>d+'m');
  }

  // (7) Insights Generation
  generateInsights() {
    const hourlyComplexity = this.complexityByHour.map(o=> o.count? o.total/o.count : 0);
    const peakComplexityHours = hourlyComplexity.map((v,i)=>({v,i})).filter(o=>o.v>0.7).map(o=>o.i);
    const avgFocusDuration = this.focusSessions.length ? this.focusSessions.reduce((a,b)=>a+b.durationMinutes,0)/this.focusSessions.length : 0;
    // Topic switch rate = context_switch+topic_shift per hour of data (approx over hours covered)
    const totalHoursObserved = this.temporalAnalysis ? this.temporalAnalysis.hourlyActivity.filter(c=>c>0).length || 1 : 1;
    const topicSwitches = (this.transitions.topic_shift||0)+(this.transitions.context_switch||0);
    const topicSwitchRate = topicSwitches / totalHoursObserved;
    const informationDiversity = this.graphMetrics?.informationDiversity || 0;
    const insights = {
      peakComplexityHours,
      avgFocusDuration: +avgFocusDuration.toFixed(2),
      topicSwitchRate: +topicSwitchRate.toFixed(2),
      informationDiversity,
      recommendations: []
    };
    if (topicSwitchRate > 10) insights.recommendations.push('High context switching detected. Consider time-blocking.');
    if (this.temporalAnalysis) {
      const mismatch = insights.peakComplexityHours.some(h=> !this.temporalAnalysis.peakHours.includes(h));
      if (mismatch) insights.recommendations.push('Complexity-activity mismatch. Reschedule demanding tasks.');
    }
    if (avgFocusDuration < 5) insights.recommendations.push('Short focus periods. Minimize interruptions.');
    return insights;
  }

  renderInsights() {
    const list = document.getElementById('insights-list');
    if (!list || !this.insights) return;
    list.innerHTML='';
    const items = [
      `Peak Complexity Hours: ${this.insights.peakComplexityHours.join(', ') || 'None'}`,
      `Avg Focus Duration: ${this.insights.avgFocusDuration}m`,
      `Topic Switch Rate: ${this.insights.topicSwitchRate}/hr`,
      `Information Diversity (entropy): ${this.insights.informationDiversity}`,
      `Recommendations: ${this.insights.recommendations.length? '' : 'None'}`
    ];
    items.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; list.appendChild(li); });
    this.insights.recommendations.forEach(r=>{ const li=document.createElement('li'); li.textContent='• '+r; list.appendChild(li); });
  }

  // (8) Data Export
  exportCognitiveAnalysis() {
    const data = {
      timestamp: new Date().toISOString(),
      temporalPatterns: this.temporalAnalysis,
      focusSessions: this.focusSessions,
      complexityRhythm: this.complexityByHour.map(o=> o.count? +(o.total/o.count).toFixed(3):0),
      informationChains: this.chains,
      graphMetrics: this.graphMetrics,
      insights: this.insights
    };
    const blob = new Blob([JSON.stringify(data,null,2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognitive-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // (Removed legacy analyzeTransition & calculateSemanticSimilarity – ML worker now sole path)

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  // Basic similarity calculation for fallback when semantic worker is unavailable
  calculateBasicSimilarity(a, b) {
    const aTitle = (a.title || '').toLowerCase();
    const bTitle = (b.title || '').toLowerCase();
    const aDomain = this.extractDomain(a.url);
    const bDomain = this.extractDomain(b.url);
    
    // Domain similarity (same TLD gets points)
    const aTld = aDomain.split('.').pop();
    const bTld = bDomain.split('.').pop();
    let similarity = aTld === bTld ? 0.2 : 0;
    
    // Title word overlap using Jaccard similarity
    const aWords = new Set(aTitle.match(/\b\w+\b/g) || []);
    const bWords = new Set(bTitle.match(/\b\w+\b/g) || []);
    const intersection = new Set([...aWords].filter(x => bWords.has(x)));
    const union = new Set([...aWords, ...bWords]);
    
    if (union.size > 0) {
      similarity += (intersection.size / union.size) * 0.8;
    }
    
    return Math.min(1, similarity);
  }

  // (Removed legacy createSemanticInput / calculateSimilarity utilities)

  // (RESTORED) Calculate statistics about transitions for legend
  calculateTransitionStats(connections) {
    const stats = { related:0, topic_shift:0, context_switch:0, total: connections.size };
    for(const c of connections.values()) { if (stats.hasOwnProperty(c.transitionType)) stats[c.transitionType]++; }
    return stats;
  }

  // (RESTORED) Fallback processing when semantic pipeline fails
  async processHistoryDataFallback(historyItems) {
    const domainData = new Map();
    const connections = new Map();
    const sortedHistory = historyItems
      .filter(item => !FILTERED_DOMAINS.some(d => this.extractDomain(item.url).includes(d)))
      .sort((a,b)=> a.lastVisitTime - b.lastVisitTime);
    for(const item of sortedHistory){
      const domain = this.extractDomain(item.url);
      if(!domainData.has(domain)) domainData.set(domain,{ domain, title:item.title, visitCount:0, color: DEFAULT_NODE_COLOR, lastVisit:item.lastVisitTime, urls:new Set() });
      const d=domainData.get(domain); d.visitCount++; d.urls.add(item.url); d.lastVisit = Math.max(d.lastVisit, item.lastVisitTime);
    }
    for(let i=0;i<sortedHistory.length-1;i++){
      const a=sortedHistory[i], b=sortedHistory[i+1];
      const da=this.extractDomain(a.url), db=this.extractDomain(b.url);
      if(da===db) continue;
      const key=`${da}-${db}`;
      const timeDiff = b.lastVisitTime - a.lastVisitTime;
      let transitionType = timeDiff <= TRANSITION_THRESHOLDS.TIME_RELATED ? 'related' : (timeDiff <= TRANSITION_THRESHOLDS.TIME_TOPIC_SHIFT ? 'topic_shift':'context_switch');
      // Add basic similarity score based on domain and title matching for fallback
      const similarity = this.calculateBasicSimilarity(a, b);
      if(!connections.has(key)) connections.set(key,{ source:da,target:db,weight:1,transitionType,color:TRANSITION_COLORS[transitionType], lastTime:b.lastVisitTime, similarity }); else { const c=connections.get(key); c.weight++; c.lastTime=b.lastVisitTime; if(similarity > (c.similarity || 0)) c.similarity=similarity; }
    }
    this.transitions = this.calculateTransitionStats(connections);
    return { nodes: Array.from(domainData.values()), links: Array.from(connections.values()) };
  }

  // (Removed legacy classifyEnhancedTopic)



  // Test mode with sample data for debugging
  loadTestData() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('loading').textContent = 'Loading test data...';
    
    // Sample history data for testing
    const sampleHistory = [
      { url: 'https://github.com/user/repo', title: 'GitHub Repository', lastVisitTime: Date.now() - 1000000, visitCount: 5 },
      { url: 'https://stackoverflow.com/questions/123', title: 'Stack Overflow Question', lastVisitTime: Date.now() - 2000000, visitCount: 3 },
      { url: 'https://facebook.com/feed', title: 'Facebook', lastVisitTime: Date.now() - 3000000, visitCount: 10 },
      { url: 'https://twitter.com/home', title: 'Twitter', lastVisitTime: Date.now() - 3500000, visitCount: 8 },
      { url: 'https://amazon.com/product/123', title: 'Amazon Product', lastVisitTime: Date.now() - 4000000, visitCount: 2 },
      { url: 'https://netflix.com/watch', title: 'Netflix', lastVisitTime: Date.now() - 5000000, visitCount: 15 },
      { url: 'https://news.bbc.co.uk/article', title: 'BBC News', lastVisitTime: Date.now() - 6000000, visitCount: 4 },
      { url: 'https://youtube.com/watch', title: 'YouTube', lastVisitTime: Date.now() - 1500000, visitCount: 20 }
    ];
    
    try {
      // Create test transition clusters for legend
      this.clusters = new Map([
        ['related', {
          name: 'Related Transitions',
          color: TRANSITION_COLORS.related,
          items: [],
          representative: 'Quick attention flow'
        }],
        ['topic_shift', {
          name: 'Topic Shifts',
          color: TRANSITION_COLORS.topic_shift,
          items: [],
          representative: 'Moderate cognitive jumps'
        }],
        ['context_switch', {
          name: 'Context Switches',
          color: TRANSITION_COLORS.context_switch,
          items: [],
          representative: 'Major cognitive shifts'
        }]
      ]);
      
      // Create test nodes for transition analysis
      const testNodes = sampleHistory.map((item, index) => {
        const domain = this.extractDomain(item.url);
        
        return {
          domain,
          title: item.title,
          visitCount: item.visitCount || 1,
          color: NODE_COLORS.default, // All nodes gray for transition focus
          lastVisit: item.lastVisitTime,
          urls: new Set([item.url])
        };
      });
      
      // Create some sample transitions for testing - make them more visible
      const testLinks = [
        {
          source: 'github.com',
          target: 'stackoverflow.com',
          weight: 5,
          transitionType: 'related',
          color: TRANSITION_COLORS.related,
          similarity: 0.85
        },
        {
          source: 'stackoverflow.com', 
          target: 'facebook.com',
          weight: 3,
          transitionType: 'topic_shift',
          color: TRANSITION_COLORS.topic_shift,
          similarity: 0.45
        },
        {
          source: 'facebook.com',
          target: 'amazon.com',
          weight: 2,
          transitionType: 'context_switch',
          color: TRANSITION_COLORS.context_switch,
          similarity: 0.15
        },
        {
          source: 'amazon.com',
          target: 'netflix.com',
          weight: 4,
          transitionType: 'related',
          color: TRANSITION_COLORS.related,
          similarity: 0.72
        },
        {
          source: 'netflix.com',
          target: 'news.bbc.co.uk',
          weight: 2,
          transitionType: 'topic_shift',
          color: TRANSITION_COLORS.topic_shift,
          similarity: 0.35
        },
        {
          source: 'youtube.com',
          target: 'github.com',
          weight: 1,
          transitionType: 'context_switch',
          color: TRANSITION_COLORS.context_switch,
          similarity: 0.08
        }
      ];
      
      console.log('Test links with colors:', testLinks);
      
      const testData = {
        nodes: testNodes,
        links: testLinks
      };
      
      this.createVisualization(testData);
      document.getElementById('loading').style.display = 'none';
    } catch (error) {
      console.error('Error in test mode:', error);
      document.getElementById('loading').textContent = `Test mode error: ${error.message}`;
    }
  }

  createVisualization(data) {
    // Clear existing visualization and reset selections
    this.g.selectAll('*').remove();
    this.linkSelection = null;
    this.nodeSelection = null;
    this.labelSelection = null;
    this.linkLabelSelection = null;
    this.linkLabelBgSelection = null;
    
    // Validate data
    if (!data.nodes || data.nodes.length === 0) {
      console.warn('No nodes to visualize');
      document.getElementById('loading').style.display = 'none';
      return;
    }
    
    this.nodes = data.nodes.map(node => ({
      ...node,
      x: node.x || this.width / 2 + (Math.random() - 0.5) * 100,
      y: node.y || this.height / 2 + (Math.random() - 0.5) * 100
    }));
    this.links = data.links || [];
    
    console.log(`Visualizing ${this.nodes.length} nodes and ${this.links.length} links`);
    
    // Create force simulation
    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links).id(d => d.domain).distance(120))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(d => this.getNodeRadius(d) + 8));

    // Create links with transition-based coloring
    const link = this.g.append('g')
      .selectAll('line')
      .data(this.links)
      .enter()
  .append('line')
      .attr('class', 'link')
      .attr('stroke', d => {
        const color = d.color || TRANSITION_COLORS.default;
        console.log('Setting link stroke color:', color, 'for transition type:', d.transitionType);
        return color;
      })
      .attr('stroke-width', d => {
        d._baseWidth = Math.max(4, Math.sqrt(d.weight) + 3); // store for zoom scaling
        return d._baseWidth;
      })
      .attr('stroke-opacity', d => this.linkRecencyOpacity(d))
  .attr('marker-end', 'url(#arrowhead-thin)')
  .attr('stroke-linecap', 'round')
      .style('color', d => d.color || TRANSITION_COLORS.default); // enables currentColor for marker

    // Create nodes (all gray since we focus on transitions)
    const node = this.g.append('g')
      .selectAll('circle')
      .data(this.nodes)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('r', d => this.getNodeRadius(d))
      .attr('fill', DEFAULT_NODE_COLOR) // All nodes are gray
      .attr('stroke', '#fff')
      .attr('stroke-width', d => this.nodeRecencyStrokeWidth(d))
      .call(d3.drag()
        .on('start', (event, d) => this.dragStarted(event, d))
        .on('drag', (event, d) => this.dragged(event, d))
        .on('end', (event, d) => this.dragEnded(event, d)));

    // Add labels for larger nodes
  const label = this.g.append('g')
      .selectAll('text')
      .data(this.nodes.filter(d => d.visitCount > 2))
      .enter()
      .append('text')
      .attr('class', 'node-label')
      .text(d => d.domain.length > 15 ? d.domain.substring(0, 12) + '...' : d.domain);

  // Store selections for later (zoom LOD & focus interactions)
  this.linkSelection = link;
  this.nodeSelection = node;
  this.labelSelection = label;

    // Add similarity score labels on links with background for better visibility
    const linkLabelGroup = this.g.append('g').attr('class', 'link-labels');
    
    // Add background rectangles for labels
    const linkLabelBgs = linkLabelGroup
      .selectAll('rect')
      .data(this.links)
      .enter()
      .append('rect')
      .attr('class', 'link-label-bg')
      .style('fill', 'rgba(255, 255, 255, 0.8)')
      .style('stroke', 'rgba(0, 0, 0, 0.1)')
      .style('stroke-width', '0.5px')
      .style('rx', '2')
      .style('ry', '2')
      .style('pointer-events', 'none');
    
    // Add text labels
    const linkLabels = linkLabelGroup
      .selectAll('text')
      .data(this.links)
      .enter()
      .append('text')
      .attr('class', 'link-label')
      .style('font-size', '9px')
      .style('fill', '#444')
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'middle')
      .style('pointer-events', 'none')
      .style('font-weight', '600')
      .text(d => d.similarity ? d.similarity.toFixed(2) : '');

    // Store link labels selection for later updates
    this.linkLabelSelection = linkLabels;
    this.linkLabelBgSelection = linkLabelBgs;

    // Add tooltips
    const tooltip = d3.select('#tooltip');
    
    // Link tooltips to show detailed similarity information
    link
      .on('mouseover', (event, d) => {
        tooltip
          .style('opacity', 1)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
          .html(`
            <strong>${d.source.domain || d.source} → ${d.target.domain || d.target}</strong><br/>
            Transition type: ${d.transitionType}<br/>
            Semantic similarity: ${d.similarity ? d.similarity.toFixed(3) : 'N/A'}<br/>
            Connection weight: ${d.weight}<br/>
            <em>Higher similarity = more related content</em>
          `);
      })
      .on('mouseout', (event, d) => {
        tooltip.style('opacity', 0);
      });
    
    node
      .on('mouseover', (event, d) => {
        tooltip
          .style('opacity', 1)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
          .html(`
            <strong>${d.domain}</strong><br/>
            Visits: ${d.visitCount}<br/>
            Last visit: ${new Date(d.lastVisit).toLocaleString()}<br/>
            <em>Connections show attention flow patterns</em>
          `);
        if (!this.selectionFrozen) {
          this.applyFocusHighlight(d);
        }
      })
      .on('mouseout', (event, d) => {
        tooltip.style('opacity', 0);
        if (!this.selectionFrozen) {
          this.clearFocusHighlight();
        }
      })
      .on('click', (event, d) => {
        if (this.selectionFrozen && this.selectedNode === d.domain) {
          // Unfreeze
            this.selectionFrozen = false;
            this.selectedNode = null;
            this.clearFocusHighlight();
        } else {
          this.selectionFrozen = true;
          this.selectedNode = d.domain;
          this.applyFocusHighlight(d);
        }
        event.stopPropagation();
      });

    // Clicking background clears frozen selection
    this.svg.on('click', () => {
      if (this.selectionFrozen) {
        this.selectionFrozen = false;
        this.selectedNode = null;
        this.clearFocusHighlight();
      }
    });

    // Update positions on simulation tick
    this.simulation.on('tick', () => {
      // Shorten lines so arrowheads sit just outside node borders (avoids overlap clutter)
      link.each((d, i, nodes) => {
        const sx = isNaN(d.source.x) ? 0 : d.source.x;
        const sy = isNaN(d.source.y) ? 0 : d.source.y;
        const tx = isNaN(d.target.x) ? 0 : d.target.x;
        const ty = isNaN(d.target.y) ? 0 : d.target.y;
        const sr = this.getNodeRadius(d.source) + 2; // slight padding from source node
        const tr = this.getNodeRadius(d.target) + 6; // extra space for arrow glyph
        let dx = tx - sx;
        let dy = ty - sy;
        let dist = Math.sqrt(dx*dx + dy*dy) || 1;
        // If nodes are extremely close, skip shortening to avoid inversion
        if (dist < sr + tr + 4) {
          d._sx = sx; d._sy = sy; d._tx = tx; d._ty = ty;
        } else {
          const ratioS = sr / dist;
          const ratioT = tr / dist;
            d._sx = sx + dx * ratioS;
            d._sy = sy + dy * ratioS;
            d._tx = tx - dx * ratioT;
            d._ty = ty - dy * ratioT;
        }
        
        d3.select(nodes[i])
          .attr('x1', d._sx)
          .attr('y1', d._sy)
          .attr('x2', d._tx)
          .attr('y2', d._ty);
      });

      node
        .attr('cx', d => isNaN(d.x) ? this.width / 2 : d.x)
        .attr('cy', d => isNaN(d.y) ? this.height / 2 : d.y);

      label
        .attr('x', d => isNaN(d.x) ? this.width / 2 : d.x)
        .attr('y', d => isNaN(d.y) ? this.height / 2 : d.y + 4);

      // Update link similarity labels - calculate midpoint from actual link positions
      if (this.linkLabelSelection) {
        const shouldShow = (d) => d.similarity && d.similarity > 0.1 && this.currentScale >= 1.2;
        
        // Position text labels
        this.linkLabelSelection
          .attr('x', d => {
            const sx = isNaN(d.source.x) ? 0 : d.source.x;
            const tx = isNaN(d.target.x) ? 0 : d.target.x;
            return (sx + tx) / 2;
          })
          .attr('y', d => {
            const sy = isNaN(d.source.y) ? 0 : d.source.y;
            const ty = isNaN(d.target.y) ? 0 : d.target.y;
            return (sy + ty) / 2;
          })
          .style('display', d => shouldShow(d) ? 'block' : 'none');
          
        // Position background rectangles
        if (this.linkLabelBgSelection) {
          this.linkLabelBgSelection
            .attr('x', d => {
              const sx = isNaN(d.source.x) ? 0 : d.source.x;
              const tx = isNaN(d.target.x) ? 0 : d.target.x;
              return (sx + tx) / 2 - 10; // Center the 20px wide rectangle
            })
            .attr('y', d => {
              const sy = isNaN(d.source.y) ? 0 : d.source.y;
              const ty = isNaN(d.target.y) ? 0 : d.target.y;
              return (sy + ty) / 2 - 6; // Center the 12px high rectangle
            })
            .attr('width', 20)
            .attr('height', 12)
            .style('display', d => shouldShow(d) ? 'block' : 'none');
        }
      }
    });

    // Initialize zoom display
    this.updateZoomDisplay(1);
  this.updateLevelOfDetail(1); // Initial LOD state
    
    // Auto-fit the graph after simulation settles - disabled temporarily to prevent NaN errors
    // setTimeout(() => {
    //   this.fitGraphToViewport();
    // }, 2000);
    
    // Update legend with dynamic clusters
    this.updateLegend();
  }

  // Map link recency (ms timestamp) to opacity (recent = brighter)
  linkRecencyOpacity(link) {
    const now = Date.now();
    const ageMs = Math.max(0, now - (link.lastTime || now));
    const ageHours = ageMs / 3600000;
  // Adjusted decay: keep more color presence while still signaling age
  // <2h 1.0, <24h 0.8, <7d 0.5, else 0.35 (never disappear into near-white)
  if (ageHours < 2) return 1.0;
  if (ageHours < 24) return 0.8;
  if (ageHours < 24 * 7) return 0.5;
  return 0.35;
  }

  // Node recency halo via stroke width
  nodeRecencyStrokeWidth(node) {
    const now = Date.now();
    const ageMs = Math.max(0, now - (node.lastVisit || now));
    const ageHours = ageMs / 3600000;
    if (ageHours < 2) return 3.5; // subtle emphasis
    if (ageHours < 24) return 2.5;
    return 2;
  }

  // Adjust visibility & thickness based on zoom scale
  updateLevelOfDetail(scale) {
    this.currentScale = scale;
    if (this.labelSelection) {
      const show = scale >= 0.9; // threshold for label visibility
      this.labelSelection.style('display', show ? 'block' : 'none');
    }
    if (this.linkLabelSelection) {
      const showLinkLabels = scale >= 1.2; // Show similarity scores when zoomed in
      const shouldShow = d => showLinkLabels && d.similarity && d.similarity > 0.1;
      
      this.linkLabelSelection.style('display', d => shouldShow(d) ? 'block' : 'none');
      if (this.linkLabelBgSelection) {
        this.linkLabelBgSelection.style('display', d => shouldShow(d) ? 'block' : 'none');
      }
      
      // Force position update when zoom changes
      this.linkLabelSelection
        .attr('x', d => {
          const sx = isNaN(d.source.x) ? 0 : d.source.x;
          const tx = isNaN(d.target.x) ? 0 : d.target.x;
          return (sx + tx) / 2;
        })
        .attr('y', d => {
          const sy = isNaN(d.source.y) ? 0 : d.source.y;
          const ty = isNaN(d.target.y) ? 0 : d.target.y;
          return (sy + ty) / 2;
        });
        
      if (this.linkLabelBgSelection) {
        this.linkLabelBgSelection
          .attr('x', d => {
            const sx = isNaN(d.source.x) ? 0 : d.source.x;
            const tx = isNaN(d.target.x) ? 0 : d.target.x;
            return (sx + tx) / 2 - 10;
          })
          .attr('y', d => {
            const sy = isNaN(d.source.y) ? 0 : d.source.y;
            const ty = isNaN(d.target.y) ? 0 : d.target.y;
            return (sy + ty) / 2 - 6;
          });
      }
    }
    if (this.linkSelection) {
      this.linkSelection
        .attr('stroke-width', d => {
          const base = d._baseWidth || 2;
          const adjusted = scale < 1 ? Math.max(0.6, base * (0.75 + scale * 0.25)) : base; // gentle thinning
          return adjusted;
        })
  .attr('marker-end', 'url(#arrowhead-thin)'); // always keep refined arrow
    }
  }

  // Highlight ego network of node d
  applyFocusHighlight(d) {
    if (!this.linkSelection || !this.nodeSelection) return;
    const domain = d.domain;
    // Determine neighbors
    const neighborSet = new Set([domain]);
    this.linkSelection.each(l => {
      const s = (l.source.domain || l.source);
      const t = (l.target.domain || l.target);
      if (s === domain || t === domain) {
        neighborSet.add(s); neighborSet.add(t);
      }
    });
    // Update nodes
    this.nodeSelection.style('opacity', n => neighborSet.has(n.domain) ? 1 : 0.15);
    // Update links (full opacity for incident, very low for others)
    this.linkSelection.style('opacity', l => {
      const s = (l.source.domain || l.source);
      const t = (l.target.domain || l.target);
      if (s === domain || t === domain) return 1;
      return 0.05;
    });
    // Update link labels opacity to match links
    if (this.linkLabelSelection) {
      this.linkLabelSelection.style('opacity', l => {
        const s = (l.source.domain || l.source);
        const t = (l.target.domain || l.target);
        if (s === domain || t === domain) return 1;
        return 0.05;
      });
      
      if (this.linkLabelBgSelection) {
        this.linkLabelBgSelection.style('opacity', l => {
          const s = (l.source.domain || l.source);
          const t = (l.target.domain || l.target);
          if (s === domain || t === domain) return 1;
          return 0.05;
        });
      }
    }
  }

  // Restore default opacities (links reflect recency fading)
  clearFocusHighlight() {
    if (this.nodeSelection) this.nodeSelection.style('opacity', 1);
    if (this.linkSelection) this.linkSelection.style('opacity', d => this.linkRecencyOpacity(d));
    if (this.linkLabelSelection) this.linkLabelSelection.style('opacity', 1);
    if (this.linkLabelBgSelection) this.linkLabelBgSelection.style('opacity', 1);
    if (this.linkSelection) this.linkSelection.attr('marker-end', 'url(#arrowhead-thin)');
  }

  getNodeRadius(d) {
    // Increase minimum and maximum radius for better visibility
    return Math.max(8, Math.min(35, Math.sqrt(d.visitCount) * 4 + 5));
  }

  fitGraphToViewport() {
    if (this.nodes.length === 0) return;

    // Filter out nodes with invalid positions
    const validNodes = this.nodes.filter(d => 
      !isNaN(d.x) && !isNaN(d.y) && isFinite(d.x) && isFinite(d.y)
    );
    
    if (validNodes.length === 0) {
      console.warn('No valid node positions for viewport fitting');
      return;
    }

    // Get the bounds of all valid nodes
    const xExtent = d3.extent(validNodes, d => d.x);
    const yExtent = d3.extent(validNodes, d => d.y);
    
    // Validate extents
    if (!xExtent[0] || !xExtent[1] || !yExtent[0] || !yExtent[1] ||
        isNaN(xExtent[0]) || isNaN(xExtent[1]) || isNaN(yExtent[0]) || isNaN(yExtent[1])) {
      console.warn('Invalid node extents, skipping viewport fit');
      return;
    }
    
    // Add some padding
    const padding = 50;
    const bounds = {
      x: xExtent[0] - padding,
      y: yExtent[0] - padding,
      width: (xExtent[1] - xExtent[0]) + (2 * padding),
      height: (yExtent[1] - yExtent[0]) + (2 * padding)
    };

    // Validate bounds
    if (bounds.width <= 0 || bounds.height <= 0) {
      console.warn('Invalid bounds for viewport fitting');
      return;
    }

    // Calculate scale to fit
    const scale = Math.min(
      this.width / bounds.width,
      this.height / bounds.height,
      1.5 // Don't zoom in too much
    );

    // Validate scale
    if (isNaN(scale) || scale <= 0 || !isFinite(scale)) {
      console.warn('Invalid scale calculated, using default');
      return;
    }

    // Calculate translation to center
    const translate = [
      (this.width / 2) - (bounds.x + bounds.width / 2) * scale,
      (this.height / 2) - (bounds.y + bounds.height / 2) * scale
    ];

    // Validate translation
    if (isNaN(translate[0]) || isNaN(translate[1]) || !isFinite(translate[0]) || !isFinite(translate[1])) {
      console.warn('Invalid translation calculated, using default');
      return;
    }

    // Apply the transform
    const transform = d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale);
    this.svg.transition().duration(1000).call(this.zoom.transform, transform);
  }



  updateLegend() {
    // Remove old legend
    const oldLegend = document.querySelector('.legend');
    if (oldLegend) {
      oldLegend.remove();
    }
    
    // Create new legend based on transition types
    const legend = document.createElement('div');
    legend.className = 'legend';
    
    // Add transition type legend items
    const transitionTypes = [
      { 
        type: 'related', 
        label: 'Related Flow', 
        description: 'Quick transitions between similar content (similarity > 0.70)' 
      },
      { 
        type: 'topic_shift', 
        label: 'Topic Shift', 
        description: 'Moderate cognitive jumps to related areas (similarity 0.40-0.70)' 
      },
      { 
        type: 'context_switch', 
        label: 'Context Switch', 
        description: 'Major mental gear changes to different topics (similarity < 0.40)' 
      }
    ];
    
    transitionTypes.forEach(({ type, label, description }) => {
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      
      const colorDiv = document.createElement('div');
      colorDiv.style.cssText = `width: 10px; height: 10px; border-radius: 50%; background-color: ${TRANSITION_COLORS[type]};`;
      
      const labelSpan = document.createElement('span');
      labelSpan.textContent = label;
      labelSpan.title = description;
      
      // Add count if transitions data is available
      if (this.transitions && this.transitions[type] !== undefined) {
        const count = this.transitions[type];
        const percentage = this.transitions.total > 0 ? Math.round((count / this.transitions.total) * 100) : 0;
        labelSpan.textContent += ` (${count} - ${percentage}%)`;
      }
      
      legendItem.appendChild(colorDiv);
      legendItem.appendChild(labelSpan);
      legend.appendChild(legendItem);
    });
    
    // Add similarity score explanation
    const similarityNote = document.createElement('div');
    similarityNote.style.cssText = 'font-size: 11px; color: #666; margin-top: 8px; font-style: italic;';
    similarityNote.textContent = 'Zoom in (>120%) to see similarity scores on connection lines';
    legend.appendChild(similarityNote);
    
    // Insert the new legend
    const header = document.querySelector('header');
    header.appendChild(legend);
  }

  dragStarted(event, d) {
    if (!event.active) this.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  dragEnded(event, d) {
    if (!event.active) this.simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

// Initialize the visualizer when the popup loads
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're in a Chrome extension context
  if (typeof chrome === 'undefined' || !chrome.history) {
    console.log('Not in Chrome extension context, loading test data');
    try {
      const visualizer = new HistoryGraphVisualizer();
      visualizer.loadTestData();
    } catch (error) {
      console.error('Failed to initialize test visualizer:', error);
      document.getElementById('loading').textContent = `Test error: ${error.message}`;
      document.getElementById('loading').style.color = '#d93025';
    }
    return;
  }
  
  // Check if D3.js is available
  if (typeof d3 === 'undefined') {
    document.getElementById('loading').textContent = 'D3.js library not loaded. Please reload the extension.';
    document.getElementById('loading').style.color = '#d93025';
    return;
  }
  
  try {
    new HistoryGraphVisualizer();
    if (window.__SEMANTIC_DEV__?.testHarness) {
      console.log('[SemanticTest] Harness active: will sample consecutive pairs after 5s');
      setTimeout(async ()=>{
        if(!semanticWorker) return;
        const history = await chrome.history.search({ text:'', maxResults:120, startTime: Date.now()-24*3600*1000 });
        history.sort((a,b)=> a.lastVisitTime - b.lastVisitTime);
        const samples = [];
        for(let i=0;i<history.length-1 && samples.length<25;i++){
          const a=history[i], b=history[i+1];
          const jac = (function(){
            const ta=(a.title||'').toLowerCase().match(/\b\w+\b/g)||[]; const tb=(b.title||'').toLowerCase().match(/\b\w+\b/g)||[]; const sa=new Set(ta), sb=new Set(tb); let inter=0; sa.forEach(t=>{ if(sb.has(t)) inter++; }); const uni=new Set([...sa,...sb]); return uni.size? inter/uni.size:0; })();
          try { const res = await callSemantic('similarityForPair',{ a:{url:a.url,title:a.title}, b:{url:b.url,title:b.title} }); samples.push({ jac: +jac.toFixed(3), emb: +res.sim.toFixed(3), a:a.title?.slice(0,40)||'', b:b.title?.slice(0,40)||'' }); } catch{}
        }
        console.table(samples);
      }, 5000);
    }
  } catch (error) {
    console.error('Failed to initialize visualizer:', error);
    document.getElementById('loading').textContent = `Initialization error: ${error.message}`;
    document.getElementById('loading').style.color = '#d93025';
  }
});
