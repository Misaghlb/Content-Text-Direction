// content.js - Enables element selection and sets direction to RTL

if (!window.__rtl_content_script_initialized) {
  window.__rtl_content_script_initialized = true;

  let selectionModeActive = false;
  let lastHighlighted = null;

  // On page load, check storage for this domain and apply RTL if needed
  (function() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const domain = window.location.hostname;
      chrome.storage.local.get({ rtlSites: {} }, (data) => {
        const selector = data.rtlSites[domain];
        console.log('[Content Text Direction] Loaded selector for', domain, ':', selector);
        if (selector) {
          function applyRTLIfFound() {
            const el = document.querySelector(selector);
            if (el) {
              el.style.direction = 'rtl';
              el.style.textAlign = 'right';
              el.title = 'Direction set to RTL (auto)';
              console.log('[Content Text Direction] RTL applied to element:', el);
              return true;
            }
            return false;
          }

          // Try immediately, then poll for up to 10 seconds
          if (!applyRTLIfFound()) {
            let elapsed = 0;
            const interval = 200;
            const maxTime = 10000;
            const poller = setInterval(() => {
              elapsed += interval;
              if (applyRTLIfFound() || elapsed >= maxTime) {
                if (elapsed >= maxTime) {
                  console.warn('[Content Text Direction] Gave up waiting for element:', selector);
                }
                clearInterval(poller);
              }
            }, interval);
          }
        } else {
          console.log('[Content Text Direction] No selector saved for', domain);
        }
      });
    }
  })();

  function enableSelectionMode() {
    if (selectionModeActive) return;
    selectionModeActive = true;
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mouseover', highlightElement);
    document.addEventListener('mouseout', unhighlightElement);
    document.addEventListener('click', selectElement, true);
  }

  function disableSelectionMode() {
    selectionModeActive = false;
    document.body.style.cursor = '';
    if (lastHighlighted) {
      lastHighlighted.style.outline = '';
      lastHighlighted = null;
    }
    document.removeEventListener('mouseover', highlightElement);
    document.removeEventListener('mouseout', unhighlightElement);
    document.removeEventListener('click', selectElement, true);
  }

  function highlightElement(e) {
    if (!selectionModeActive) return;
    if (lastHighlighted) lastHighlighted.style.outline = '';
    lastHighlighted = e.target;
    e.target.style.outline = '2px solid #1976d2';
  }

  function unhighlightElement(e) {
    if (!selectionModeActive) return;
    e.target.style.outline = '';
  }

  function getUniqueSelector(el) {
    if (el.id) return `#${el.id}`;
    let path = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      let selector = el.nodeName.toLowerCase();
      if (el.className) selector += '.' + Array.from(el.classList).join('.');
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.length ? path.join(' > ') : null;
  }

  function selectElement(e) {
    if (!selectionModeActive) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    el.style.direction = 'rtl';
    el.style.textAlign = 'right';
    el.title = 'Direction set to RTL';
    disableSelectionMode();
    // Send the selector back to the popup
    if (window._selectionCallback) {
      const selector = getUniqueSelector(el);
      window._selectionCallback({ selector });
      window._selectionCallback = null;
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'enableSelectionAndReturnSelector') {
      window._selectionCallback = sendResponse;
      enableSelectionMode();
      return true; // keep the message channel open for async response
    }
    if (msg.action === 'enableSelection') {
      enableSelectionMode();
    }
    if (msg.action === 'resetRTL') {
      // Reset RTL settings for the removed domain
      if (msg.selector && window.location.hostname === msg.domain) {
        try {
          const elements = document.querySelectorAll(msg.selector);
          if (elements && elements.length > 0) {
            elements.forEach(el => {
              // Only reset if it was previously set to RTL
              if (el.style.direction === 'rtl') {
                el.style.direction = '';
                el.style.textAlign = '';
                el.title = '';
                console.log('[Content Text Direction] RTL settings removed from element:', el);
              }
            });
          }
        } catch (e) {
          console.error('[Content Text Direction] Error resetting RTL:', e);
        }
      }
    }
  });
}
