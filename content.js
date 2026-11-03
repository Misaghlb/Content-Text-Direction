// content.js - Enables element selection and sets direction to RTL

if (!window.__rtl_content_script_initialized) {
  window.__rtl_content_script_initialized = true;

  let selectionModeActive = false;
  let lastHighlighted = null;
  let rtlObserver = null;
  let currentSelector = null;

  const RTL_ATTR = 'data-rtl-root';
  const RTL_STYLE_ID = '__rtl_override_style';

  // --- Override hardcoded dir="ltr" (and inline/CSS ltr) on descendants ---
  // Code blocks / math stay LTR on purpose.
  function ensureOverrideStyle() {
    if (document.getElementById(RTL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = RTL_STYLE_ID;
    style.textContent = `
      [${RTL_ATTR}],
      [${RTL_ATTR}] *:not(pre):not(code):not(pre *):not(code *):not(.katex):not(.katex *):not(svg):not(svg *) {
        direction: rtl !important;
        text-align: right !important;
      }
      /* Keep code blocks LTR */
      [${RTL_ATTR}] pre,
      [${RTL_ATTR}] pre *,
      [${RTL_ATTR}] code,
      [${RTL_ATTR}] .katex {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: isolate;
      }
      /* Inline code inside a sentence shouldn't break the line flow */
      [${RTL_ATTR}] :not(pre) > code {
        unicode-bidi: isolate;
        display: inline;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function removeOverrideStyle() {
    const s = document.getElementById(RTL_STYLE_ID);
    if (s) s.remove();
  }

  function markRTLRoot(el) {
    ensureOverrideStyle();
    el.setAttribute(RTL_ATTR, '1');
    el.setAttribute('dir', 'rtl');
    el.style.setProperty('direction', 'rtl', 'important');
    el.style.setProperty('text-align', 'right', 'important');
  }

  function unmarkRTLRoot(el) {
    el.removeAttribute(RTL_ATTR);
    if (el.getAttribute('dir') === 'rtl') el.removeAttribute('dir');
    el.style.removeProperty('direction');
    el.style.removeProperty('text-align');
    el.title = '';
  }

  function getElementByXPath(xpath) {
    try {
      return document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
    } catch (e) {
      console.error('[Content Text Direction] Invalid XPath:', xpath, e);
      return null;
    }
  }

  // --- SPA Robust RTL Application ---
  (function() {
    console.log('[Content Text Direction] RTL SPA logic initializing...');
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const domain = window.location.hostname;
      chrome.storage.local.get({ rtlSites: {} }, (data) => {
        let selector = data.rtlSites[domain];
        currentSelector = selector;
        console.log('[Content Text Direction] Loaded selector for', domain, ':', selector);
        if (selector) {
          setupRTLSPA(selector);
        } else {
          console.log('[Content Text Direction] No selector saved for', domain);
        }
      });

      // --- Main SPA-aware RTL logic ---
      function setupRTLSPA(selector) {
        try {
          if (!selector || typeof selector !== 'string' || selector.trim() === '') {
            console.warn('[Content Text Direction] Invalid or empty selector:', selector);
            return;
          }
          if (rtlObserver) {
            rtlObserver.disconnect();
          }
          let debounceTimer = null;

          // Apply RTL if element is found and not yet marked
          function applyRTLIfFound() {
            try {
              const el = getElementByXPath(selector);
              if (el) {
                if (!el.hasAttribute(RTL_ATTR) || el.style.direction !== 'rtl') {
                  markRTLRoot(el);
                  el.title = 'Direction set to RTL (auto)';
                  console.log('[Content Text Direction] RTL applied to element:', el);
                  return true;
                }
              }
            } catch (err) {
              console.error('[Content Text Direction] Error in applyRTLIfFound:', err);
            }
            return false;
          }

          function debouncedApply() {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(applyRTLIfFound, 100);
          }

          rtlObserver = new MutationObserver(() => {
            debouncedApply();
          });
          rtlObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['id', 'class']
          });

          function onSPARouteChange() {
            let elapsed = 0;
            const interval = 200;
            const maxTime = 5000;
            function retryApply() {
              if (applyRTLIfFound()) return;
              elapsed += interval;
              if (elapsed < maxTime) {
                setTimeout(retryApply, interval);
              }
            }
            retryApply();
          }

          ["pushState", "replaceState"].forEach(fn => {
            const orig = history[fn];
            history[fn] = function() {
              const rv = orig.apply(this, arguments);
              window.dispatchEvent(new Event("spa-navigation"));
              return rv;
            };
          });
          window.addEventListener("spa-navigation", onSPARouteChange);
          window.addEventListener("popstate", onSPARouteChange);

          // Initial application
          applyRTLIfFound();
        } catch (e) {
          console.error('[Content Text Direction] Error in setupRTLSPA:', e);
        }
      }
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

  // Returns an XPath for the given element
  function getUniqueXPath(el) {
    if (el.id) {
      return `//*[@id="${el.id}"]`;
    }
    let parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      let index = 1;
      let sibling = el.previousSibling;
      while (sibling) {
        if (sibling.nodeType === 1 && sibling.nodeName === el.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      parts.unshift(`${el.nodeName.toLowerCase()}[${index}]`);
      el = el.parentElement;
    }
    return '//' + parts.join('/');
  }

  function selectElement(e) {
    if (!selectionModeActive) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    // Remove highlight outline before disabling
    el.style.outline = '';
    markRTLRoot(el);
    el.title = 'Direction set to RTL';
    disableSelectionMode();
    if (window._selectionCallback) {
      const selector = getUniqueXPath(el);
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
      if (window.location.hostname === msg.domain) {
        try {
          // The selector is an XPath, so resolve it as XPath (and also
          // clean any element marked by this script).
          const roots = new Set(document.querySelectorAll(`[${RTL_ATTR}]`));
          if (msg.selector) {
            const el = getElementByXPath(msg.selector);
            if (el) roots.add(el);
          }
          roots.forEach(unmarkRTLRoot);
          removeOverrideStyle();

          if (rtlObserver) {
            rtlObserver.disconnect();
            rtlObserver = null;
            currentSelector = null;
          }
          console.log('[Content Text Direction] RTL reset done');
        } catch (e) {
          console.error('[Content Text Direction] Error resetting RTL:', e);
        }
      }
    }
  });
}