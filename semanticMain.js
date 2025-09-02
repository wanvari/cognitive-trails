// Main thread E5 implementation - Web Workers have issues with Transformers.js in extensions
class E5SemanticAnalyzer {
  constructor() {
    this.pipeline = null;
    this.modelLoaded = false;
    this.cache = new Map();
  }

  async initialize() {
    if (this.modelLoaded) return true;
    
    try {
      console.log('=== E5 INITIALIZATION DEBUG ===');
      console.log('Attempting to load E5 model in main thread...');
      
      // Load Transformers.js in main thread
      console.log('Loading Transformers.js library...');
      const transformersModule = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
      console.log('Transformers.js loaded:', !!transformersModule);
      console.log('Pipeline function available:', !!transformersModule.pipeline);
      
      const { pipeline } = transformersModule;
      
      // Load E5-small model
      console.log('Loading E5-small-v2 model...');
      this.pipeline = await pipeline('feature-extraction', 'Xenova/e5-small-v2', {
        quantized: true,
        pooling: 'mean',
        normalize: true
      });
      
      console.log('E5 pipeline created:', !!this.pipeline);
      
      // Test the model with a simple example
      console.log('Testing E5 model with sample text...');
      const testEmbedding = await this.getEmbedding('test passage');
      console.log('Test embedding generated:', {
        length: testEmbedding.length,
        sample: testEmbedding.slice(0, 5),
        isValidArray: Array.isArray(testEmbedding),
        allNumbers: testEmbedding.slice(0, 5).every(x => typeof x === 'number')
      });
      
      this.modelLoaded = true;
      console.log('✅ E5 model fully loaded and tested successfully');
      console.log('================================');
      return true;
      
    } catch (error) {
      console.error('❌ E5 model loading failed:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n')[0]
      });
      console.log('Will fall back to basic similarity');
      console.log('================================');
      return false;
    }
  }

  async getEmbedding(text) {
    if (!this.modelLoaded) {
      throw new Error('E5 model not initialized');
    }

    // Cache check
    const cacheKey = this.hashString(text);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // E5 expects "passage:" prefix for optimal performance
      const prefixedText = text.startsWith('passage:') ? text : `passage: ${text}`;
      
      // Get embedding
      const result = await this.pipeline(prefixedText);
      
      // Handle different result formats
      let embedding;
      if (result.data) {
        embedding = Array.from(result.data);
      } else if (Array.isArray(result)) {
        embedding = result;
      } else if (result.tensor) {
        embedding = Array.from(result.tensor.data);
      } else {
        throw new Error('Unexpected embedding format');
      }

      // Cache result
      this.cache.set(cacheKey, embedding);
      
      return embedding;
      
    } catch (error) {
      console.error('E5 embedding generation failed:', error);
      throw error;
    }
  }

  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator ? dotProduct / denominator : 0;
  }

  async calculateSimilarity(textA, textB) {
    try {
      console.log('E5 Analyzer: Getting embeddings for:', {
        textA: textA.substring(0, 50) + '...',
        textB: textB.substring(0, 50) + '...'
      });
      
      const [embeddingA, embeddingB] = await Promise.all([
        this.getEmbedding(textA),
        this.getEmbedding(textB)
      ]);
      
      console.log('E5 Analyzer: Embeddings generated:', {
        embeddingALength: embeddingA.length,
        embeddingBLength: embeddingB.length,
        embeddingASample: embeddingA.slice(0, 3).map(x => x.toFixed(4)),
        embeddingBSample: embeddingB.slice(0, 3).map(x => x.toFixed(4))
      });
      
      const similarity = this.cosineSimilarity(embeddingA, embeddingB);
      
      console.log('E5 Analyzer: Cosine similarity calculated:', similarity.toFixed(6));
      
      return similarity;
      
    } catch (error) {
      console.error('E5 Analyzer: Similarity calculation failed:', error);
      return 0;
    }
  }

  // Simple hash function for caching
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  // Get meaningful content from history item
  extractContent(historyItem) {
    const { url, title } = historyItem;
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const pathname = urlObj.pathname;
      
      // Extract meaningful parts from URL path
      const pathParts = pathname
        .split('/')
        .filter(part => part && part.length > 2 && !/^\d+$/.test(part))
        .map(part => part.replace(/[-_]/g, ' '))
        .join(' ');
      
      // Build content string for E5
      let content = '';
      
      if (title && title.trim()) {
        content += title.trim();
      }
      
      if (pathParts) {
        content += ' ' + pathParts;
      }
      
      // Add domain for context (but let E5 figure out relationships)
      content += ` (${domain})`;
      
      return content.trim();
      
    } catch (error) {
      return title || url;
    }
  }
}

// Global instance
window.e5Analyzer = new E5SemanticAnalyzer();