// Local semantic similarity using advanced NLP techniques
// No external dependencies, works within Chrome extension CSP
class LocalSemanticAnalyzer {
  constructor() {
    this.cache = new Map();
    this.stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 
      'to', 'was', 'will', 'with', 'www', 'com', 'org', 'net', 'html', 'php'
    ]);
    
    // Semantic word groups for better similarity
    this.semanticGroups = {
      'ai_tech': ['ai', 'artificial', 'intelligence', 'machine', 'learning', 'claude', 'anthropic', 'chatbot', 'assistant', 'bot', 'neural', 'model'],
      'programming': ['code', 'coding', 'programming', 'developer', 'development', 'software', 'engineer', 'engineering', 'github', 'stackoverflow', 'python', 'javascript', 'java'],
      'career': ['job', 'jobs', 'career', 'careers', 'employment', 'work', 'professional', 'linkedin', 'indeed', 'resume', 'hiring', 'salary'],
      'social': ['social', 'facebook', 'twitter', 'instagram', 'network', 'networking', 'community', 'discussion', 'forum', 'reddit'],
      'news': ['news', 'article', 'story', 'report', 'journalism', 'media', 'press', 'breaking', 'update', 'politics'],
      'shopping': ['shop', 'shopping', 'buy', 'purchase', 'store', 'retail', 'amazon', 'ebay', 'product', 'price'],
      'video': ['video', 'watch', 'streaming', 'youtube', 'netflix', 'movie', 'film', 'entertainment'],
      'education': ['learn', 'learning', 'education', 'course', 'tutorial', 'guide', 'university', 'school', 'wikipedia']
    };
    
    // Build reverse lookup
    this.wordToGroups = new Map();
    for (const [group, words] of Object.entries(this.semanticGroups)) {
      for (const word of words) {
        if (!this.wordToGroups.has(word)) {
          this.wordToGroups.set(word, []);
        }
        this.wordToGroups.get(word).push(group);
      }
    }
  }

  // Extract meaningful features from history item
  extractFeatures(item) {
    try {
      const { url, title = '' } = item;
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const path = urlObj.pathname;
      
      // Debug domain extraction for mercor domains
      if (url.includes('mercor')) {
        console.log('🔍 Mercor Domain Extraction:', {
          originalUrl: url,
          hostname: urlObj.hostname,
          domain: domain,
          path: path
        });
      }
      
      // Extract tokens from title
      const titleTokens = this.tokenize(title);
      
      // Extract meaningful path segments
      const pathTokens = path
        .split('/')
        .filter(seg => seg && seg.length > 2 && !/^\d+$/.test(seg))
        .flatMap(seg => this.tokenize(seg.replace(/[-_]/g, ' ')));
      
      // Domain tokens
      const domainTokens = this.tokenize(domain.replace(/\./g, ' '));
      
      // Combine all tokens
      const allTokens = [...titleTokens, ...pathTokens, ...domainTokens];
      
      // Remove stop words and short tokens
      const cleanTokens = allTokens
        .filter(token => token.length > 2 && !this.stopWords.has(token))
        .map(token => token.toLowerCase());
      
      // Get semantic groups for each token
      const semanticVector = this.getSemanticVector(cleanTokens);
      
      // Only show feature extraction for Anthropic domains
      if (url.includes('claude') || url.includes('anthropic')) {
        console.log('🔍 Anthropic Feature Extraction:', {
          url: url,
          title: title,
          domain: domain,
          cleanTokens: cleanTokens,
          semanticVectorKeys: Array.from(semanticVector.keys())
        });
      }
      
      return {
        tokens: cleanTokens,
        domain: domain,
        semanticVector: semanticVector,
        originalUrl: url,
        originalTitle: title
      };
      
    } catch (error) {
      console.error('Feature extraction failed:', error);
      return {
        tokens: [item.title || ''].filter(Boolean),
        domain: item.url || '',
        semanticVector: new Map(),
        originalUrl: item.url,
        originalTitle: item.title
      };
    }
  }
  
  tokenize(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }
  
  getSemanticVector(tokens) {
    const vector = new Map();
    
    for (const token of tokens) {
      // Direct token frequency (reduced weight to emphasize semantic groups)
      vector.set(token, (vector.get(token) || 0) + 0.3);
      
      // Semantic group contributions (increased weight)
      if (this.wordToGroups.has(token)) {
        const groups = this.wordToGroups.get(token);
        for (const group of groups) {
          const groupKey = `GROUP_${group}`;
          vector.set(groupKey, (vector.get(groupKey) || 0) + 2.0); // Much higher weight for semantic groups
        }
      }
    }
    
    // Normalize the vector for better cosine similarity
    const magnitude = Math.sqrt(Array.from(vector.values()).reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (const [key, value] of vector.entries()) {
        vector.set(key, value / magnitude);
      }
    }
    
    return vector;
  }
  
  calculateSimilarity(itemA, itemB) {
    const cacheKey = `${itemA.url}|||${itemB.url}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // Show detailed debugging for Anthropic and Mercor domains
    const isAnthropicComparison = 
      (itemA.url.includes('claude') || itemA.url.includes('anthropic')) &&
      (itemB.url.includes('claude') || itemB.url.includes('anthropic'));
    
    const isMercorComparison = 
      (itemA.url.includes('mercor')) || (itemB.url.includes('mercor'));
    
    const shouldDebug = isAnthropicComparison || isMercorComparison;
    
    if (shouldDebug) {
      console.log('🔍 DETAILED DOMAIN COMPARISON:', {
        urlA: itemA.url,
        urlB: itemB.url,
        titleA: itemA.title,
        titleB: itemB.title,
        comparison: isAnthropicComparison ? 'ANTHROPIC' : 'MERCOR'
      });
    }
    
    const featuresA = this.extractFeatures(itemA);
    const featuresB = this.extractFeatures(itemB);
    
    if (shouldDebug) {
      console.log('🔍 Feature Extraction:', {
        tokensA: featuresA.tokens,
        tokensB: featuresB.tokens,
        domainA: featuresA.domain,
        domainB: featuresB.domain,
        semanticVectorA: Array.from(featuresA.semanticVector.entries()).slice(0, 10),
        semanticVectorB: Array.from(featuresB.semanticVector.entries()).slice(0, 10)
      });
    }
    
    // Multiple similarity measures
    const similarities = {
      semantic: this.semanticVectorSimilarity(featuresA.semanticVector, featuresB.semanticVector),
      jaccard: this.jaccardSimilarity(featuresA.tokens, featuresB.tokens),
      domain: this.domainSimilarity(featuresA.domain, featuresB.domain),
      company: this.companySimilarity(featuresA.domain, featuresB.domain)
    };
    
    // Adaptive weighted combination based on domain relationship
    let finalSimilarity = 0;
    
    // If there's a strong domain relationship, prioritize it
    if (similarities.domain >= 0.6 || similarities.company >= 0.9) {
      // Strong domain/company relationship detected
      finalSimilarity += similarities.semantic * 0.2; // Semantic groups
      finalSimilarity += similarities.jaccard * 0.3;  // Token overlap  
      finalSimilarity += similarities.domain * 0.2;   // Domain similarity
      finalSimilarity += similarities.company * 0.3;  // Company relationship
      
      // Boost for strong domain relationships
      if (similarities.domain >= 0.6) {
        finalSimilarity += 0.4; // Strong boost for subdomain relationships
      }
      if (similarities.company >= 0.9) {
        finalSimilarity += 0.3; // Boost for same company
      }
    } else {
      // No strong domain relationship, use semantic analysis
      finalSimilarity += similarities.semantic * 0.4; // Semantic groups
      finalSimilarity += similarities.jaccard * 0.3;  // Token overlap
      finalSimilarity += similarities.domain * 0.2;   // Domain similarity
      finalSimilarity += similarities.company * 0.1;  // Company relationship
    }
    
    // Cap at 1.0
    finalSimilarity = Math.min(finalSimilarity, 1.0);
    
    if (shouldDebug) {
      const isDomainBoosted = similarities.domain >= 0.6 || similarities.company >= 0.9;
      console.log('🔍 Similarity Breakdown:', {
        semantic: similarities.semantic.toFixed(4),
        jaccard: similarities.jaccard.toFixed(4),
        domain: similarities.domain.toFixed(4),
        company: similarities.company.toFixed(4),
        final: finalSimilarity.toFixed(4),
        adaptiveMode: isDomainBoosted ? 'DOMAIN_BOOSTED' : 'SEMANTIC_MODE',
        boosts: {
          domainBoost: similarities.domain >= 0.6 ? 0.4 : 0,
          companyBoost: similarities.company >= 0.9 ? 0.3 : 0
        }
      });
    }
    
    this.cache.set(cacheKey, finalSimilarity);
    return finalSimilarity;
  }
  
  semanticVectorSimilarity(vectorA, vectorB) {
    const keysA = new Set(vectorA.keys());
    const keysB = new Set(vectorB.keys());
    const allKeys = new Set([...keysA, ...keysB]);
    
    if (allKeys.size === 0) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (const key of allKeys) {
      const valueA = vectorA.get(key) || 0;
      const valueB = vectorB.get(key) || 0;
      
      dotProduct += valueA * valueB;
      normA += valueA * valueA;
      normB += valueB * valueB;
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator ? dotProduct / denominator : 0;
  }
  
  jaccardSimilarity(tokensA, tokensB) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  domainSimilarity(domainA, domainB) {
    console.log('🌐 Domain Similarity Check:', { domainA, domainB });
    
    if (domainA === domainB) {
      console.log('✅ Exact domain match');
      return 1;
    }
    
    // Check TLD similarity
    const tldA = domainA.split('.').pop();
    const tldB = domainB.split('.').pop();
    if (tldA === tldB && (tldA === 'edu' || tldA === 'gov' || tldA === 'org')) {
      console.log('✅ Same institutional TLD');
      return 0.3; // Same institutional type
    }
    
    // Check subdomain relationship
    if (domainA.includes(domainB) || domainB.includes(domainA)) {
      console.log('✅ Subdomain relationship detected');
      return 0.6; // Subdomain relationship
    }
    
    console.log('❌ No domain relationship found');
    return 0;
  }
  
  companySimilarity(domainA, domainB) {
    console.log('🏢 Company Similarity Check:', { domainA, domainB });
    
    // Same company domains
    const companies = [
      ['anthropic.com', 'claude.ai', 'docs.anthropic.com', 'console.anthropic.com'],
      ['google.com', 'youtube.com', 'gmail.com', 'drive.google.com'],
      ['microsoft.com', 'outlook.com', 'office.com', 'github.com'],
      ['facebook.com', 'instagram.com', 'whatsapp.com', 'meta.com'],
      ['amazon.com', 'aws.amazon.com', 'prime.amazon.com'],
      ['linkedin.com', 'indeed.com', 'glassdoor.com'], // Job sites
      ['stackoverflow.com', 'stackexchange.com', 'serverfault.com']
    ];
    
    for (const companyDomains of companies) {
      const hasA = companyDomains.some(domain => domainA.includes(domain) || domain.includes(domainA));
      const hasB = companyDomains.some(domain => domainB.includes(domain) || domain.includes(domainB));
      
      console.log(`Checking company group [${companyDomains.join(', ')}]:`, { hasA, hasB });
      
      if (hasA && hasB) {
        console.log('✅ Same company detected!');
        return 1; // Same company
      }
    }
    
    console.log('❌ No company match found');
    return 0;
  }
}

// Global instance
window.localSemanticAnalyzer = new LocalSemanticAnalyzer();