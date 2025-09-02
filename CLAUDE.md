Semantic embedding pipeline (E5 scaffold) integrated on 2025-09-02.
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This is a Chrome extension using Manifest V3 - no build system, lint, or test commands are configured. Development is done with vanilla JavaScript, HTML, and CSS.

**Loading for Development:**
```bash
# Load extension in Chrome
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode" 
# 3. Click "Load unpacked" → Select this folder
# 4. Click extension icon to test
```

**Testing:**
- Use the "Test Mode" button in the extension popup for sample data testing
- Open Chrome DevTools (F12) in the popup window to debug
- Check `chrome://extensions/` for error logs

## Architecture Overview

**Core Components:**

- `popup.js` - Main graph visualization using D3.js with enhanced semantic clustering and cognitive transition analysis
- `analysis.js` - Cognitive dashboard with metrics for browsing patterns, focus sessions, and complexity analysis  
- `background.js` - Service worker that opens popup in new tab instead of popup window

**Key Architecture Patterns:**

**Semantic Clustering System:** Multi-factor analysis combining domain matching, URL path analysis, and title content. Uses Jaccard similarity and weighted topic recognition across categories (Programming, Social, E-commerce, News, Entertainment, Education). Filters out search engines to prevent hub problems.

**Cognitive Transition Analysis:** Analyzes browsing transitions with time-based and semantic thresholds:
- `related` (blue) - staying on topic within 5min or high semantic overlap  
- `topic_shift` (yellow) - moderate cognitive jump within 30min
- `context_switch` (red) - major mental gear change

**Data Flow:**
1. Chrome History API → fetch last 2000 entries (7 days for dashboard, 30 days for main graph)
2. Domain extraction and filtering (removes google.com, bing.com, etc.)
3. Semantic clustering with enhanced content analysis
4. D3.js force simulation with custom transition-based edge coloring
5. Interactive graph with pan/zoom, node focus, and tooltip system

**State Management:** Uses class-based architecture in `HistoryGraphVisualizer` with properties for:
- Graph data (`nodes`, `links`, `transitions`)
- Visualization state (`simulation`, `zoom`, `selectionFrozen`) 
- Cognitive analysis results (`temporalAnalysis`, `focusSessions`, `chains`)

**Permission Model:** Requires `history` permission only - all processing happens locally in browser, no external API calls.

## File Relationships

- `popup.html` → includes `popup.css`, `d3.min.js`, `popup.js`
- `analysis.html` → includes `popup.css`, `d3.min.js`, `analysis.js` 
- `analysis.js` reuses core algorithms from `popup.js` (calculateComplexity, jaccard similarity)
- `background.js` handles extension icon clicks to open full-tab interface
- `manifest.json` defines Manifest V3 structure with history permissions and CSP

## Extension-Specific Notes

**Chrome Extension Context:** Code runs in extension popup/tab context with access to `chrome.history` API. Always check for `chrome?.history` availability.

**Manifest V3 Requirements:** Uses service worker (`background.js`) instead of background pages. Content Security Policy restricts inline scripts.

**Local D3.js:** Uses local copy (`d3.min.js`) instead of CDN due to CSP restrictions in extension context.

**Full-Tab Interface:** Extension opens in full browser tab rather than popup window for better visualization space.