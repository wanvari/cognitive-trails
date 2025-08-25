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
  TIME_RELATED: 5 * 60 * 1000,      // 5 minutes - related if within this time
  TIME_TOPIC_SHIFT: 30 * 60 * 1000, // 30 minutes - topic shift if within this time
  SEMANTIC_RELATED: 0.4,             // Word overlap threshold for related content
  SEMANTIC_TOPIC_SHIFT: 0.1          // Word overlap threshold for topic shift
};

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

    // Set up zoom behavior
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .wheelDelta((event) => {
        // Custom wheel delta for smoother scrolling
        return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
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
    
    document.getElementById('test-btn').addEventListener('click', () => {
      console.log('Loading test data...');
      this.loadTestData();
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
      }

      document.getElementById('loading').textContent = 'Analyzing attention flow patterns...';
      
      // Analyze transitions between consecutive visits
      for (let i = 0; i < sortedHistory.length - 1; i++) {
        const current = sortedHistory[i];
        const next = sortedHistory[i + 1];
        
        const currentDomain = this.extractDomain(current.url);
        const nextDomain = this.extractDomain(next.url);
        
        // Skip self-transitions
        if (currentDomain === nextDomain) continue;
        
        // Calculate transition type
        const transitionType = this.analyzeTransition(current, next);
        
        const connectionKey = `${currentDomain}-${nextDomain}`;
        
        if (!connections.has(connectionKey)) {
          const connection = {
            source: currentDomain,
            target: nextDomain,
            weight: 1,
            transitionType: transitionType,
            color: TRANSITION_COLORS[transitionType] || TRANSITION_COLORS.default
          };
          connections.set(connectionKey, connection);
          
          // Debug first few connections
          if (connections.size <= 10) {
            console.log(`Connection ${connections.size}:`, currentDomain, '->', nextDomain, 'Type:', transitionType, 'Color:', connection.color);
          }
        } else {
          connections.get(connectionKey).weight++;
        }
        
        // Update progress occasionally
        if (i % 50 === 0) {
          document.getElementById('loading').textContent = `Analyzing transitions... ${i}/${sortedHistory.length}`;
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      // Store transitions for legend generation
      this.transitions = this.calculateTransitionStats(connections);
      
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

  // Analyze the cognitive transition between two consecutive history items
  analyzeTransition(currentItem, nextItem) {
    const timeDiff = nextItem.lastVisitTime - currentItem.lastVisitTime;
    const semanticSimilarity = this.calculateSemanticSimilarity(currentItem, nextItem);
    
    let transitionType;
    
    // Quick transitions with similar content = related
    if (timeDiff <= TRANSITION_THRESHOLDS.TIME_RELATED && semanticSimilarity >= TRANSITION_THRESHOLDS.SEMANTIC_RELATED) {
      transitionType = 'related';
    }
    // Medium time gaps or some semantic overlap = topic shift
    else if (timeDiff <= TRANSITION_THRESHOLDS.TIME_TOPIC_SHIFT || semanticSimilarity >= TRANSITION_THRESHOLDS.SEMANTIC_TOPIC_SHIFT) {
      transitionType = 'topic_shift';
    }
    // Long gaps or no semantic connection = context switch
    else {
      transitionType = 'context_switch';
    }
    
    // Debug first few transitions
    if (Math.random() < 0.1) { // Log 10% of transitions
      console.log('Transition analysis:', {
        from: this.extractDomain(currentItem.url),
        to: this.extractDomain(nextItem.url),
        timeDiff: `${Math.round(timeDiff / 1000)}s`,
        semantic: semanticSimilarity.toFixed(3),
        type: transitionType
      });
    }
    
    return transitionType;
  }

  // Calculate semantic similarity between two history items using word overlap
  calculateSemanticSimilarity(item1, item2) {
    const text1 = `${item1.title || ''} ${this.extractDomain(item1.url)}`.toLowerCase();
    const text2 = `${item2.title || ''} ${this.extractDomain(item2.url)}`.toLowerCase();
    
    const words1 = new Set(text1.match(/\b\w+\b/g) || []);
    const words2 = new Set(text2.match(/\b\w+\b/g) || []);
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  // Calculate statistics about transitions for the legend
  calculateTransitionStats(connections) {
    const stats = {
      related: 0,
      topic_shift: 0,
      context_switch: 0,
      total: connections.size
    };
    
    for (const connection of connections.values()) {
      if (connection.transitionType in stats) {
        stats[connection.transitionType]++;
      }
    }
    
    return stats;
  }

  async processHistoryDataFallback(historyItems) {
    console.log('Using fallback processing with simple transition analysis');
    const domainData = new Map();
    const connections = new Map();
    
    // Simple processing - create nodes for each domain
    historyItems.forEach(item => {
      const domain = this.extractDomain(item.url);
      
      // Skip filtered domains
      if (FILTERED_DOMAINS.some(d => domain.includes(d))) {
        return;
      }
      
      if (!domainData.has(domain)) {
        domainData.set(domain, {
          domain,
          title: item.title,
          visitCount: 0,
          color: NODE_COLORS.default, // All nodes gray for transition focus
          lastVisit: item.lastVisitTime,
          urls: new Set()
        });
      }
      
      const data = domainData.get(domain);
      data.visitCount++;
      data.urls.add(item.url);
      data.lastVisit = Math.max(data.lastVisit, item.lastVisitTime);
    });

    // Simple fallback transition analysis - just use time-based connections
    const sortedHistory = historyItems
      .filter(item => !FILTERED_DOMAINS.some(d => this.extractDomain(item.url).includes(d)))
      .sort((a, b) => a.lastVisitTime - b.lastVisitTime);
    
    for (let i = 0; i < sortedHistory.length - 1; i++) {
      const current = sortedHistory[i];
      const next = sortedHistory[i + 1];
      
      const timeDiff = next.lastVisitTime - current.lastVisitTime;
      
      // Use simplified transition logic for fallback
      if (timeDiff <= TRANSITION_THRESHOLDS.TIME_TOPIC_SHIFT) {
        const sourceDomain = this.extractDomain(current.url);
        const targetDomain = this.extractDomain(next.url);
        
        if (sourceDomain !== targetDomain) {
          const key = `${sourceDomain}-${targetDomain}`;
          const reverseKey = `${targetDomain}-${sourceDomain}`;
          
          // Simple transition type based on time only
          let transitionType = 'related';
          if (timeDiff > TRANSITION_THRESHOLDS.TIME_RELATED) {
            transitionType = 'topic_shift';
          }
          
          if (!connections.has(key) && !connections.has(reverseKey)) {
            connections.set(key, {
              source: sourceDomain,
              target: targetDomain,
              weight: 1,
              transitionType: transitionType,
              color: TRANSITION_COLORS[transitionType]
            });
          } else if (connections.has(key)) {
            connections.get(key).weight++;
          } else if (connections.has(reverseKey)) {
            connections.get(reverseKey).weight++;
          }
        }
      }
    }

    // Set up transition-based clusters for legend
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

    return {
      nodes: Array.from(domainData.values()),
      links: Array.from(connections.values())
    };
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  // Create enhanced semantic input text from URL and title
  createSemanticInput(url, title = '') {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const path = urlObj.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      const pathParts = path.split('/').filter(part => part && !part.match(/^\d+$/));
      
      // Extract meaningful words from path
      const pathWords = pathParts.flatMap(part => 
        part.split(/[-_]/).filter(word => word.length > 2)
      );
      
      // Clean title
      const titleWords = title.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);
      
      return {
        domain,
        path: pathWords.join(' '),
        title: titleWords.join(' '),
        fullText: `${domain} ${pathWords.join(' ')} ${titleWords.join(' ')}`
      };
    } catch {
      return {
        domain: url,
        path: '',
        title: title.toLowerCase(),
        fullText: `${url} ${title}`.toLowerCase()
      };
    }
  }

  // Calculate enhanced similarity score
  calculateSimilarity(item1, item2) {
    let score = 0;
    
    // Domain similarity (exact match gets high score)
    if (item1.domain === item2.domain) {
      score += 0.8;
    }
    
    // Path similarity using Jaccard index
    const path1Words = new Set(item1.path.split(' ').filter(w => w));
    const path2Words = new Set(item2.path.split(' ').filter(w => w));
    if (path1Words.size > 0 && path2Words.size > 0) {
      const intersection = new Set([...path1Words].filter(x => path2Words.has(x)));
      const union = new Set([...path1Words, ...path2Words]);
      score += (intersection.size / union.size) * 0.3;
    }
    
    // Title similarity using word overlap
    const title1Words = new Set(item1.title.split(' ').filter(w => w.length > 2));
    const title2Words = new Set(item2.title.split(' ').filter(w => w.length > 2));
    if (title1Words.size > 0 && title2Words.size > 0) {
      const intersection = new Set([...title1Words].filter(x => title2Words.has(x)));
      const union = new Set([...title1Words, ...title2Words]);
      score += (intersection.size / union.size) * 0.4;
    }
    
    // Topic category similarity
    const topic1 = this.classifyEnhancedTopic(item1);
    const topic2 = this.classifyEnhancedTopic(item2);
    if (topic1 === topic2 && topic1 !== 'misc') {
      score += 0.3;
    }
    
    return score;
  }

  // Enhanced topic classification
  classifyEnhancedTopic(semanticInput) {
    const { domain, path, title, fullText } = semanticInput;
    let bestTopic = 'misc';
    let bestScore = 0;
    
    for (const [topicName, topicData] of Object.entries(ENHANCED_TOPICS)) {
      let score = 0;
      
      // Domain exact match
      if (topicData.domains.some(d => domain.includes(d) || d.includes(domain))) {
        score += 2.0 * topicData.weight;
      }
      
      // Path keyword matching
      const pathScore = topicData.paths.reduce((sum, pathKeyword) => {
        return sum + (path.includes(pathKeyword) ? 1 : 0);
      }, 0);
      score += (pathScore / topicData.paths.length) * topicData.weight;
      
      // Title and content keyword matching
      const keywordScore = topicData.keywords.reduce((sum, keyword) => {
        const titleMatches = (title.match(new RegExp(keyword, 'gi')) || []).length;
        const fullTextMatches = (fullText.match(new RegExp(keyword, 'gi')) || []).length;
        return sum + titleMatches * 0.5 + fullTextMatches * 0.2;
      }, 0);
      score += keywordScore * topicData.weight;
      
      if (score > bestScore) {
        bestScore = score;
        bestTopic = topicName;
      }
    }
    
    return bestScore > 0.5 ? bestTopic : 'misc';
  }



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
          color: TRANSITION_COLORS.related
        },
        {
          source: 'stackoverflow.com', 
          target: 'facebook.com',
          weight: 3,
          transitionType: 'topic_shift',
          color: TRANSITION_COLORS.topic_shift
        },
        {
          source: 'facebook.com',
          target: 'amazon.com',
          weight: 2,
          transitionType: 'context_switch',
          color: TRANSITION_COLORS.context_switch
        },
        {
          source: 'amazon.com',
          target: 'netflix.com',
          weight: 4,
          transitionType: 'related',
          color: TRANSITION_COLORS.related
        },
        {
          source: 'netflix.com',
          target: 'news.bbc.co.uk',
          weight: 2,
          transitionType: 'topic_shift',
          color: TRANSITION_COLORS.topic_shift
        },
        {
          source: 'youtube.com',
          target: 'github.com',
          weight: 1,
          transitionType: 'context_switch',
          color: TRANSITION_COLORS.context_switch
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
    // Clear existing visualization
    this.g.selectAll('*').remove();
    
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
      .attr('stroke-width', d => Math.max(4, Math.sqrt(d.weight) + 3)) // Thick lines for visibility
      .attr('stroke-opacity', 1.0); // Fully opaque

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
      .attr('stroke-width', 2)
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

    // Add tooltips
    const tooltip = d3.select('#tooltip');
    
    node
      .on('mouseover', (event, d) => {
        tooltip
          .style('opacity', 1)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
          .html(`
            <strong>${d.domain}</strong><br/>
            Visits: ${d.visitCount}<br/>
            Last visit: ${new Date(d.lastVisit).toLocaleDateString()}<br/>
            <em>Connections show attention flow patterns</em>
          `);
      })
      .on('mouseout', () => {
        tooltip.style('opacity', 0);
      });

    // Update positions on simulation tick
    this.simulation.on('tick', () => {
      link
        .attr('x1', d => isNaN(d.source.x) ? 0 : d.source.x)
        .attr('y1', d => isNaN(d.source.y) ? 0 : d.source.y)
        .attr('x2', d => isNaN(d.target.x) ? 0 : d.target.x)
        .attr('y2', d => isNaN(d.target.y) ? 0 : d.target.y);

      node
        .attr('cx', d => isNaN(d.x) ? this.width / 2 : d.x)
        .attr('cy', d => isNaN(d.y) ? this.height / 2 : d.y);

      label
        .attr('x', d => isNaN(d.x) ? this.width / 2 : d.x)
        .attr('y', d => isNaN(d.y) ? this.height / 2 : d.y + 4);
    });

    // Initialize zoom display
    this.updateZoomDisplay(1);
    
    // Auto-fit the graph after simulation settles - disabled temporarily to prevent NaN errors
    // setTimeout(() => {
    //   this.fitGraphToViewport();
    // }, 2000);
    
    // Update legend with dynamic clusters
    this.updateLegend();
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
        description: 'Quick transitions between similar content (staying focused)' 
      },
      { 
        type: 'topic_shift', 
        label: 'Topic Shift', 
        description: 'Moderate cognitive jumps to related areas' 
      },
      { 
        type: 'context_switch', 
        label: 'Context Switch', 
        description: 'Major mental gear changes to different topics' 
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
  } catch (error) {
    console.error('Failed to initialize visualizer:', error);
    document.getElementById('loading').textContent = `Initialization error: ${error.message}`;
    document.getElementById('loading').style.color = '#d93025';
  }
});
