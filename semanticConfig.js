// Semantic similarity configuration & thresholds
// Allows dev overrides via window.__SEMANTIC_DEV__ before popup loads

export const SEMANTIC_CONFIG = {
  shortlistSize: 10,
  batchSize: 12,
  lruSize: 200,
  model: {
    name: 'e5-small', // placeholder identifier
    dim: 384 // expected embedding dimension for small models; adjusted at runtime when model loads
  },
  thresholds: {
    related: 0.50,      // Much lower for testing - if pseudoEncode is being used
    topicShift: 0.25    // Much lower for testing
  },
  calibration: {
    window: 500,        // rolling similarity sample size
    adjustEvery: 100,   // recompute thresholds after this many new samples
    targetTopFraction: 0.33 // place related threshold near top third percentile
  }
};

// Attach to global (window or self in worker) for legacy access
const __global = (typeof self !== 'undefined') ? self : (typeof window !== 'undefined' ? window : {});
if (!__global.SEMANTIC_CONFIG) {
  __global.SEMANTIC_CONFIG = Object.assign({}, SEMANTIC_CONFIG, __global.__SEMANTIC_DEV__ || {});
}
