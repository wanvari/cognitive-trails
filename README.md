# Cognitive Trails

A Chrome extension that visualizes your browser history as an interactive graph, showing how your websites connect by topic.

## Installation

1. Download or clone this repository
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode" 
4. Click "Load unpacked" → Select the downloaded folder
5. Click the extension icon to open

## Features

- Interactive graph of your browsing history
- Automatic topic clustering (Programming, Social, News, etc.)
- Pan and zoom to explore connections
- Full browser tab interface

Built with D3.js

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
