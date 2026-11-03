// background.js - Chrome Extension Base
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed.');
});

// Inject content.js on SPA navigation (history state updates)
chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
  // Only inject into the main frame
  if (details.frameId === 0) {
    chrome.scripting.executeScript({
      target: {tabId: details.tabId},
      files: ['content.js']
    });
    console.log('[Content Text Direction] content.js injected due to SPA navigation:', details.url);
  }
});
