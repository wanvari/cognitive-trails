// Enhanced semantic clustering configuration
const SIMILARITY_THRESHOLD = 0.6;
const MIN_CLUSTER_SIZE = 2;
const FILTERED_DOMAINS = ['google.com', 'www.google.com', 'bing.com', 'duckduckgo.com'];

// Enhanced topic keywords with weights and context
const ENHANCED_TOPICS = {
  'programming': {
    domains: ['github.com', 'stackoverflow.com', 'codepen.io', 'jsfiddle.net', 'replit.com', 'glitch.com'],
    keywords: ['javascript', 'python', 'react', 'vue', 'angular', 'node', 'api', 'code', 'programming', 'developer', 'tutorial', 'documentation', 'git', 'repository', 'function', 'class', 'method'],
    paths: ['docs', 'api', 'tutorial', 'guide', 'reference', 'dev', 'developer'],
    weight: 1.5
  },
  'social': {
    domains: ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'reddit.com', 'discord.com', 'telegram.org'],
    keywords: ['social', 'post', 'share', 'comment', 'like', 'follow', 'friend', 'message', 'chat', 'community'],
    paths: ['profile', 'posts', 'messages', 'feed'],
    weight: 1.3
  },
  'ecommerce': {
    domains: ['amazon.com', 'ebay.com', 'etsy.com', 'shopify.com', 'walmart.com', 'target.com'],
    keywords: ['buy', 'shop', 'cart', 'purchase', 'price', 'product', 'store', 'sale', 'deal', 'order'],
    paths: ['product', 'cart', 'checkout', 'shop', 'store'],
    weight: 1.4
  },
  'news': {
    domains: ['bbc.com', 'cnn.com', 'reuters.com', 'nytimes.com', 'guardian.com', 'techcrunch.com'],
    keywords: ['news', 'article', 'breaking', 'report', 'story', 'politics', 'world', 'business', 'technology'],
    paths: ['news', 'article', 'story', 'politics', 'world'],
    weight: 1.2
  },
  'entertainment': {
    domains: ['youtube.com', 'netflix.com', 'spotify.com', 'twitch.tv', 'hulu.com', 'disney.com'],
    keywords: ['video', 'music', 'movie', 'show', 'stream', 'watch', 'play', 'entertainment', 'game', 'gaming'],
    paths: ['watch', 'video', 'music', 'playlist', 'game'],
    weight: 1.1
  },
  'education': {
    domains: ['coursera.org', 'udemy.com', 'khan.academy', 'edx.org', 'codecademy.com', 'freecodecamp.org'],
    keywords: ['course', 'lesson', 'learn', 'education', 'tutorial', 'training', 'study', 'class', 'university'],
    paths: ['course', 'lesson', 'learn', 'tutorial', 'class'],
    weight: 1.3
  }
};

// Color palette for dynamic clusters
const CLUSTER_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', 
  '#dda0dd', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3',
  '#ff9f43', '#10ac84', '#ee5a24', '#0984e3', '#6c5ce7',
  '#a29bfe', '#fd79a8', '#e17055', '#00b894', '#fdcb6e'
];

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
    this.clusters = new Map();
    
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
    this.width = rect.width;
    this.height = rect.height;

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
        this.g.attr('transform', event.transform);
        // Update zoom level display
        this.updateZoomDisplay(event.transform.k);
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
      } catch (clusteringError) {
        console.warn('Enhanced clustering failed, using fallback:', clusteringError);
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
          maxResults: 500,
          startTime: Date.now() - (30 * 24 * 60 * 60 * 1000) // Last 30 days
        }, (results) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message || 'History API error'));
          } else {
            console.log(`Found ${results ? results.length : 0} history items`);
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
      
      console.log(`Starting to process ${historyItems.length} history items`);
      
      // Perform enhanced clustering with timeout
      const clusteringPromise = this.performEnhancedClustering(historyItems);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Clustering timeout')), 10000)
      );
      
      const { clusters } = await Promise.race([clusteringPromise, timeoutPromise]);
      
      // Create cluster color mapping
      const clusterColors = new Map();
      const clusterKeys = Array.from(clusters.keys());
      clusterKeys.forEach((clusterId, index) => {
        clusterColors.set(clusterId, CLUSTER_COLORS[index % CLUSTER_COLORS.length]);
      });
      
      document.getElementById('loading').textContent = 'Building domain graph...';
      console.log(`Building domain graph with ${clusterKeys.length} clusters`);
      
      // Group by domain and assign cluster information
      let processedItems = 0;
      for (const item of historyItems) {
        const domain = this.extractDomain(item.url);
        
        // Skip filtered domains
        if (FILTERED_DOMAINS.some(d => domain.includes(d))) {
          continue;
        }
        
        // Find which cluster this item belongs to
        let itemCluster = 'misc';
        let itemColor = CLUSTER_COLORS[CLUSTER_COLORS.length - 1];
        
        for (const [clusterId, cluster] of clusters) {
          if (cluster.items.some(clusterItem => {
            const clusterUrl = clusterItem.url || clusterItem.item?.url;
            return clusterUrl === item.url;
          })) {
            itemCluster = clusterId;
            itemColor = clusterColors.get(clusterId);
            break;
          }
        }
        
        if (!domainData.has(domain)) {
          domainData.set(domain, {
            domain,
            title: item.title,
            visitCount: 0,
            cluster: itemCluster,
            color: itemColor,
            lastVisit: item.lastVisitTime,
            urls: new Set()
          });
        }
        
        const data = domainData.get(domain);
        data.visitCount++;
        data.urls.add(item.url);
        data.lastVisit = Math.max(data.lastVisit, item.lastVisitTime);
        
        // Update cluster assignment
        if (itemCluster !== 'misc') {
          data.cluster = itemCluster;
          data.color = itemColor;
        }
        
        processedItems++;
        
        // Update progress occasionally
        if (processedItems % 50 === 0) {
          document.getElementById('loading').textContent = `Building graph... ${processedItems}/${historyItems.length}`;
          // Allow UI to update
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      document.getElementById('loading').textContent = 'Creating connections...';
      
      // Find connections between domains (visited within 1 hour)
      const sortedHistory = historyItems
        .filter(item => !FILTERED_DOMAINS.some(d => this.extractDomain(item.url).includes(d)))
        .sort((a, b) => a.lastVisitTime - b.lastVisitTime);
      
      for (let i = 0; i < sortedHistory.length - 1; i++) {
        const current = sortedHistory[i];
        const next = sortedHistory[i + 1];
        
        const timeDiff = next.lastVisitTime - current.lastVisitTime;
        const oneHour = 60 * 60 * 1000;
        
        if (timeDiff <= oneHour) {
          const sourceDomain = this.extractDomain(current.url);
          const targetDomain = this.extractDomain(next.url);
          
          if (sourceDomain !== targetDomain) {
            const key = `${sourceDomain}-${targetDomain}`;
            const reverseKey = `${targetDomain}-${sourceDomain}`;
            
            if (!connections.has(key) && !connections.has(reverseKey)) {
              connections.set(key, {
                source: sourceDomain,
                target: targetDomain,
                weight: 1
              });
            } else if (connections.has(key)) {
              connections.get(key).weight++;
            } else if (connections.has(reverseKey)) {
              connections.get(reverseKey).weight++;
            }
          }
        }
      }

      // Store clusters for legend generation
      this.clusters = clusters;
      
      console.log(`Completed processing: ${domainData.size} domains, ${connections.size} connections`);

      return {
        nodes: Array.from(domainData.values()),
        links: Array.from(connections.values())
      };
      
    } catch (error) {
      console.error('Error in processHistoryData:', error);
      throw error;
    }
  }

  async processHistoryDataFallback(historyItems) {
    console.log('Using fallback processing without clustering');
    const domainData = new Map();
    const connections = new Map();
    
    // Simple processing without clustering
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
          cluster: 'misc',
          color: CLUSTER_COLORS[CLUSTER_COLORS.length - 1], // Default color
          lastVisit: item.lastVisitTime,
          urls: new Set()
        });
      }
      
      const data = domainData.get(domain);
      data.visitCount++;
      data.urls.add(item.url);
      data.lastVisit = Math.max(data.lastVisit, item.lastVisitTime);
    });

    // Find connections between domains
    const sortedHistory = historyItems
      .filter(item => !FILTERED_DOMAINS.some(d => this.extractDomain(item.url).includes(d)))
      .sort((a, b) => a.lastVisitTime - b.lastVisitTime);
    
    for (let i = 0; i < sortedHistory.length - 1; i++) {
      const current = sortedHistory[i];
      const next = sortedHistory[i + 1];
      
      const timeDiff = next.lastVisitTime - current.lastVisitTime;
      const oneHour = 60 * 60 * 1000;
      
      if (timeDiff <= oneHour) {
        const sourceDomain = this.extractDomain(current.url);
        const targetDomain = this.extractDomain(next.url);
        
        if (sourceDomain !== targetDomain) {
          const key = `${sourceDomain}-${targetDomain}`;
          const reverseKey = `${targetDomain}-${sourceDomain}`;
          
          if (!connections.has(key) && !connections.has(reverseKey)) {
            connections.set(key, {
              source: sourceDomain,
              target: targetDomain,
              weight: 1
            });
          } else if (connections.has(key)) {
            connections.get(key).weight++;
          } else if (connections.has(reverseKey)) {
            connections.get(reverseKey).weight++;
          }
        }
      }
    }

    // Set up basic clusters for legend
    this.clusters = new Map([
      ['misc', {
        name: 'All Domains',
        color: CLUSTER_COLORS[CLUSTER_COLORS.length - 1],
        items: Array.from(domainData.values()),
        representative: 'All Domains'
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

  // Perform enhanced clustering (simplified and more robust)
  async performEnhancedClustering(historyItems) {
    try {
      document.getElementById('loading').textContent = 'Analyzing content...';
      
      // Filter out search engines and prepare semantic data
      const filteredItems = historyItems.filter(item => {
        const domain = this.extractDomain(item.url);
        return !FILTERED_DOMAINS.some(filteredDomain => domain.includes(filteredDomain));
      });
      
      if (filteredItems.length === 0) {
        return { clusters: new Map() };
      }
      
      console.log(`Processing ${filteredItems.length} filtered items`);
      
      // Group by enhanced topic
      const topicGroups = new Map();
      
      for (const item of filteredItems) {
        const semantic = this.createSemanticInput(item.url, item.title);
        const topic = this.classifyEnhancedTopic(semantic);
        
        if (!topicGroups.has(topic)) {
          topicGroups.set(topic, []);
        }
        topicGroups.get(topic).push({ ...item, semantic });
      }
      
      document.getElementById('loading').textContent = 'Creating clusters...';
      
      const clusters = new Map();
      let clusterIndex = 0;
      
      // Create simple clusters from topic groups
      for (const [topic, items] of topicGroups) {
        const clusterId = `${topic}_${clusterIndex++}`;
        clusters.set(clusterId, {
          id: clusterId,
          topic,
          items,
          representative: this.generateSimpleClusterName(topic, items)
        });
      }
      
      console.log(`Created ${clusters.size} clusters`);
      return { clusters };
      
    } catch (error) {
      console.error('Error in clustering:', error);
      // Return empty clusters on error to prevent hanging
      return { clusters: new Map() };
    }
  }

  // Simplified cluster name generation
  generateSimpleClusterName(topic, items) {
    const topicNames = {
      'programming': 'Programming & Development',
      'social': 'Social Media',
      'ecommerce': 'Online Shopping',
      'news': 'News & Articles',
      'entertainment': 'Entertainment',
      'education': 'Learning & Education',
      'misc': 'Miscellaneous'
    };
    
    return topicNames[topic] || 'Other Content';
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
      // Create simple test clusters without semantic analysis
      this.clusters = new Map([
        ['programming', { id: 'programming', items: [], representative: 'Programming Development' }],
        ['social', { id: 'social', items: [], representative: 'Social Media' }],
        ['shopping', { id: 'shopping', items: [], representative: 'Online Shopping' }],
        ['entertainment', { id: 'entertainment', items: [], representative: 'Entertainment Streaming' }],
        ['news', { id: 'news', items: [], representative: 'News Media' }]
      ]);
      
      // Create test nodes with cluster assignments
      const testNodes = sampleHistory.map((item, index) => {
        const domain = this.extractDomain(item.url);
        let cluster = 'misc';
        
        if (domain.includes('github') || domain.includes('stackoverflow')) cluster = 'programming';
        else if (domain.includes('facebook') || domain.includes('twitter') || domain.includes('youtube')) cluster = 'social';
        else if (domain.includes('amazon')) cluster = 'shopping';
        else if (domain.includes('netflix')) cluster = 'entertainment';
        else if (domain.includes('bbc')) cluster = 'news';
        
        return {
          domain,
          title: item.title,
          visitCount: item.visitCount || 1,
          cluster,
          color: CLUSTER_COLORS[index % CLUSTER_COLORS.length],
          lastVisit: item.lastVisitTime,
          urls: new Set([item.url])
        };
      });
      
      const testData = {
        nodes: testNodes,
        links: [] // No connections for test data
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
    
    this.nodes = data.nodes;
    this.links = data.links;
    
    // Create force simulation
    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links).id(d => d.domain).distance(120))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(d => this.getNodeRadius(d) + 8));

    // Create links
    const link = this.g.append('g')
      .selectAll('line')
      .data(this.links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke-width', d => Math.sqrt(d.weight));

    // Create nodes
    const node = this.g.append('g')
      .selectAll('circle')
      .data(this.nodes)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('r', d => this.getNodeRadius(d))
      .attr('fill', d => d.color) // Use cluster-based color
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
            Cluster: ${this.getClusterName(d.cluster)}<br/>
            Last visit: ${new Date(d.lastVisit).toLocaleDateString()}
          `);
      })
      .on('mouseout', () => {
        tooltip.style('opacity', 0);
      });

    // Update positions on simulation tick
    this.simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      label
        .attr('x', d => d.x)
        .attr('y', d => d.y + 4);
    });

    // Initialize zoom display
    this.updateZoomDisplay(1);
    
    // Auto-fit the graph after simulation settles
    setTimeout(() => {
      this.fitGraphToViewport();
    }, 2000);
    
    // Update legend with dynamic clusters
    this.updateLegend();
  }

  getNodeRadius(d) {
    // Increase minimum and maximum radius for better visibility
    return Math.max(8, Math.min(35, Math.sqrt(d.visitCount) * 4 + 5));
  }

  fitGraphToViewport() {
    if (this.nodes.length === 0) return;

    // Get the bounds of all nodes
    const xExtent = d3.extent(this.nodes, d => d.x);
    const yExtent = d3.extent(this.nodes, d => d.y);
    
    // Add some padding
    const padding = 50;
    const bounds = {
      x: xExtent[0] - padding,
      y: yExtent[0] - padding,
      width: (xExtent[1] - xExtent[0]) + (2 * padding),
      height: (yExtent[1] - yExtent[0]) + (2 * padding)
    };

    // Calculate scale to fit
    const scale = Math.min(
      this.width / bounds.width,
      this.height / bounds.height,
      1.5 // Don't zoom in too much
    );

    // Calculate translation to center
    const translate = [
      (this.width / 2) - (bounds.x + bounds.width / 2) * scale,
      (this.height / 2) - (bounds.y + bounds.height / 2) * scale
    ];

    // Apply the transform
    const transform = d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale);
    this.svg.transition().duration(1000).call(this.zoom.transform, transform);
  }

  getClusterName(clusterId) {
    if (clusterId === 'misc') return 'Miscellaneous';
    
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return 'Unknown';
    
    // Use the cluster name if available
    if (cluster.name) return cluster.name;
    
    // Create a readable name from the representative text
    if (cluster.representative) {
      const words = cluster.representative.split(' ').filter(word => word.length > 2);
      return words.slice(0, 3).join(' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Cluster';
    }
    
    return 'Cluster';
  }

  updateLegend() {
    // Remove old legend
    const oldLegend = document.querySelector('.legend');
    if (oldLegend) {
      oldLegend.remove();
    }
    
    // Create new dynamic legend based on clusters
    const legend = document.createElement('div');
    legend.className = 'legend';
    
    // Get all clusters except 'misc' first, then add 'misc' at the end
    const clusterEntries = Array.from(this.clusters.entries());
    const nonMiscClusters = clusterEntries.filter(([id]) => id !== 'misc');
    const miscCluster = clusterEntries.find(([id]) => id === 'misc');
    
    // Add non-misc clusters first
    nonMiscClusters.forEach(([clusterId, cluster], index) => {
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      
      const colorDiv = document.createElement('div');
      // Use the cluster's stored color if available, otherwise use index-based color
      const clusterColor = cluster.color || CLUSTER_COLORS[index % CLUSTER_COLORS.length];
      colorDiv.style.cssText = `width: 8px; height: 8px; border-radius: 50%; background-color: ${clusterColor};`;
      
      const labelSpan = document.createElement('span');
      labelSpan.textContent = this.getClusterName(clusterId);
      labelSpan.title = `${cluster.items.length} items`;
      
      legendItem.appendChild(colorDiv);
      legendItem.appendChild(labelSpan);
      legend.appendChild(legendItem);
    });
    
    // Add miscellaneous last if it exists
    if (miscCluster) {
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      
      const colorDiv = document.createElement('div');
      colorDiv.style.cssText = `width: 8px; height: 8px; border-radius: 50%; background-color: ${CLUSTER_COLORS[CLUSTER_COLORS.length - 1]};`;
      
      const labelSpan = document.createElement('span');
      labelSpan.textContent = 'Miscellaneous';
      labelSpan.title = `${miscCluster[1].items.length} items`;
      
      legendItem.appendChild(colorDiv);
      legendItem.appendChild(labelSpan);
      legend.appendChild(legendItem);
    }
    
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
    document.getElementById('loading').textContent = 'Not running in Chrome extension context. Load as unpacked extension.';
    document.getElementById('loading').style.color = '#d93025';
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
