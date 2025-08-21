# Browser History Topic Graph - Chrome Extension

A Chrome extension that visualizes your browser history as an interactive graph in a full browser tab, grouping websites by topics and showing connections between frequently visited domains.

## Features

- **Topic-based Clustering**: Automatically categorizes websites into topics using semantic analysis
- **Interactive Graph**: Force-directed graph visualization using D3.js with pan and zoom
- **Session Connections**: Shows links between domains visited within the same session (1 hour window)
- **Full Tab Interface**: Opens in a dedicated browser tab for maximum viewing space
- **Visual Indicators**: 
  - Node size represents visit frequency
  - Color coding by topic category
  - Hover tooltips with detailed information
  - Dynamic legend showing all categories
- **Enhanced Semantic Clustering**: Uses multi-factor analysis including URL patterns, keywords, and content classification

## Installation

1. **Download the Extension**
   - Clone this repository or download all files to a folder

2. **Load in Chrome Developer Mode**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top-right corner
   - Click "Load unpacked" button
   - Select the folder containing the extension files
   - The extension icon should appear in your Chrome toolbar

3. **Grant Permissions**
   - Click on the extension icon
   - Chrome will open a new tab and may prompt for history access permissions
   - Click "Allow" to grant necessary permissions

## Usage

1. **View Your History Graph**
   - Click the extension icon in the Chrome toolbar
   - A new browser tab will open with the history graph interface
   - The app will analyze your browser history and create topic clusters
   - Wait for the graph to render (may take a few seconds for large datasets)

2. **Interact with the Graph**
   - **Pan and Zoom**: Use mouse wheel to zoom, click and drag to pan
   - **Drag nodes** to reposition them manually
   - **Hover over nodes** to see detailed information (domain, visit count, cluster, last visit date)
   - **Use zoom controls** in the bottom-right corner for precise navigation
   - **Click refresh** to reload with updated history data

3. **Understanding the Visualization**
   - **Node Colors**: Each color represents a different topic cluster
   - **Node Sizes**: Larger nodes = more visits to that domain
   - **Connections**: Lines show domains visited in the same browsing session
   - **Legend**: Dynamic legend showing all discovered topic categories
   - **Auto-fitting**: Graph automatically centers and scales after loading

## Technical Details

### File Structure
```
browser-graph-extension/
├── manifest.json        # Extension configuration
├── popup.html           # Main UI layout
├── popup.css            # Styling
├── popup.js             # Core functionality with enhanced semantic clustering
├── d3.min.js            # D3.js library (local copy)
├── icon16.png           # Extension icon (16x16)
├── icon48.png           # Extension icon (48x48)
├── icon128.png          # Extension icon (128x128)
├── README.md            # Documentation
└── DEBUGGING.md         # Troubleshooting guide
```

### Topic Classification
Websites are automatically categorized using **enhanced semantic clustering** with intelligent content analysis:

- **Multi-Factor Analysis**: Combines domain matching, URL path analysis, and title content understanding
- **Weighted Topic Recognition**: Enhanced categories including Programming, Social, E-commerce, News, Entertainment, and Education
- **Path Intelligence**: Analyzes URL structures (e.g., `/docs/`, `/tutorial/`, `/api/`) for better context
- **Content Similarity**: Uses Jaccard similarity and word overlap for grouping related content
- **Smart Filtering**: Automatically filters out search engines (Google, Bing, DuckDuckGo) to eliminate hub problems
- **Dynamic Clustering**: Groups similar content even across different domains

**Examples:**
- `github.com/react/hooks` + "React Hooks Tutorial" → "React JavaScript Development" cluster
- `stackoverflow.com/questions/react-hooks` → same cluster (content similarity)  
- `medium.com/javascript-react-tutorial` → same cluster (semantic understanding)
- `coursera.org/learn/react` → "Education" cluster (learning context)

**Enhanced Topic Categories:**
- **Programming**: Development tools, documentation, code repositories
- **Social**: Social media, messaging, community platforms  
- **E-commerce**: Online shopping, product pages, marketplaces
- **News**: News articles, journalism, current events
- **Entertainment**: Streaming, gaming, music, videos
- **Education**: Courses, tutorials, learning platforms
- **Miscellaneous**: Everything else

This approach provides much more accurate categorization than simple keyword matching while remaining fast and lightweight without external dependencies.

### Privacy & Permissions

- **History Permission**: Required to access browser history data
- **Local Processing**: All data processing happens locally in your browser
- **No External Requests**: No data is sent to external servers
- **Temporary Storage**: History data is only processed in memory, not stored

## Browser Compatibility

- **Chrome**: Manifest V3 (Chrome 88+)
- **Edge**: Compatible with Chromium-based Edge
- **Other Chromium browsers**: Should work with most Chromium-based browsers

## Troubleshooting

**Extension not loading:**
- Make sure all files are in the same folder
- Check that Developer Mode is enabled in Chrome
- Try reloading the extension from `chrome://extensions/`

**No graph showing:**
- Ensure you've granted history access permissions
- Check that you have sufficient browser history (last 30 days)
- Try clicking the Refresh button

**Performance issues:**
- The extension processes up to 500 recent history entries
- For very active browsing, the graph may take a few seconds to render
- Close and reopen the popup if it becomes unresponsive

## Development

Built with:
- Vanilla JavaScript (ES6+)
- D3.js v7 for graph visualization
- Chrome Extensions API (Manifest V3)
- SVG/CSS for styling

## Future Enhancements

- Time-based filtering options
- Export graph as image
- Custom topic definitions
- Search/filter functionality
- Performance optimizations for large datasets
