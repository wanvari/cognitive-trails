# Debugging Guide for Browser History Topic Graph

## Common Issues and Solutions

### 1. "Loading history data..." stuck indefinitely

**Possible Causes:**
- Extension not properly loaded in Chrome
- History permissions not granted
- Chrome history API not accessible

**Solutions:**

1. **Reload the Extension:**
   - Go to `chrome://extensions/`
   - Find "Browser History Topic Graph"
   - Click the reload button (circular arrow icon)
   - Try opening the popup again

2. **Check Permissions:**
   - Go to `chrome://extensions/`
   - Click "Details" on the extension
   - Scroll to "Site access" section
   - Make sure permissions are granted

3. **Manual Permission Grant:**
   - Open Chrome settings → Privacy and Security → Site Settings
   - Look for the extension in the list
   - Make sure it has access to browsing history

4. **Use Test Mode:**
   - Click the extension icon
   - Click the "Test Mode" button (green button next to Refresh)
   - This will load sample data to verify the visualization works

### 2. "Not running in Chrome extension context" error

**Solution:**
- Make sure you've loaded the extension as an unpacked extension
- Don't try to open popup.html directly in a browser tab

### 3. No graph appears even after loading

**Possible Causes:**
- No browsing history in the last 30 days
- All history entries are invalid URLs
- JavaScript errors

**Solutions:**
1. Check browser console (F12) for JavaScript errors
2. Try the Test Mode button
3. Make sure you have browsing history from the last 30 days

### 4. Performance Issues

**Solutions:**
- The extension processes up to 500 history entries
- If Chrome becomes slow, try:
  - Closing and reopening the popup
  - Reloading the extension
  - Clearing old browsing history

## Debug Commands

Open Chrome DevTools (F12) and run these in the console:

```javascript
// Check if Chrome APIs are available
console.log('Chrome available:', typeof chrome !== 'undefined');
console.log('History API:', typeof chrome?.history !== 'undefined');

// Test history access
chrome.history.search({text: '', maxResults: 10}, (results) => {
  console.log('History test results:', results?.length || 0, 'items');
});
```

## Manual Testing Steps

1. **Load Extension:**
   - `chrome://extensions/` → Enable Developer Mode → Load Unpacked
   - Select the extension folder
   - Should see extension icon in toolbar

2. **Test Popup:**
   - Click extension icon
   - Should see popup window open
   - Should see loading message, then graph or error

3. **Test Permissions:**
   - When first clicking the extension, Chrome should prompt for permissions
   - Grant access to browsing history

4. **Test with Sample Data:**
   - Use the "Test Mode" button to verify visualization works
   - If test mode works but real data doesn't, it's a history API issue

## Getting Help

If none of these solutions work:

1. Check the browser console for specific error messages
2. Try the test mode to isolate the issue
3. Make sure you're using Chrome version 88+ (required for Manifest V3)
4. Try creating a fresh extension folder with the files
