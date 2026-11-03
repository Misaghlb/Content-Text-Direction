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
      /* Elements with hardcoded dir=ltr that contain RTL text (anywhere on page) */
      [data-rtl-fixed],
      [data-rtl-fixed] *:not(pre):not(code):not(pre *):not(code *):not(.katex):not(.katex *):not(svg):not(svg *) {
        direction: rtl !important;
        text-align: right !important;
      }
      [data-rtl-fixed] pre,
      [data-rtl-fixed] pre *,
      [data-rtl-fixed] code,
      [data-rtl-fixed] .katex {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: isolate;
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

  // --- Fix hardcoded dir="ltr" elements that contain Persian/Arabic/Hebrew text,
  // even if they are outside the selected root. Also mirror blockquote/list
  // side borders & paddings so they don't look broken in RTL. ---
  const RTL_CHARS = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

  function mirrorSides(el) {
    if (el.hasAttribute('data-rtl-mirrored')) return;
    const cs = getComputedStyle(el);
    const bl = parseFloat(cs.borderLeftWidth) || 0;
    const pl = parseFloat(cs.paddingLeft) || 0;
    const ml = parseFloat(cs.marginLeft) || 0;
    if (bl > 0) {
      el.style.setProperty('border-right', `${cs.borderLeftWidth} ${cs.borderLeftStyle} ${cs.borderLeftColor}`, 'important');
      el.style.setProperty('border-left', 'none', 'important');
    }
    if (pl > 0) {
      el.style.setProperty('padding-right', cs.paddingLeft, 'important');
      el.style.setProperty('padding-left', '0', 'important');
    }
    if (ml > 0) {
      el.style.setProperty('margin-right', cs.marginLeft, 'important');
      el.style.setProperty('margin-left', '0', 'important');
    }
    el.setAttribute('data-rtl-mirrored', '1');
  }

  function fixHardcodedLTR() {
    try {
      ensureOverrideStyle();
      document.querySelectorAll('[dir="ltr"]').forEach(el => {
        if (el.closest('pre, code')) return;
        if (el.hasAttribute('data-rtl-fixed')) return;
        // Only touch elements whose own text contains RTL characters
        if (!RTL_CHARS.test(el.textContent || '')) return;
        // Skip if it is an ancestor-level container (e.g. whole page); only
        // fix reasonably local blocks
        if (el === document.body || el === document.documentElement) return;
        el.setAttribute('data-rtl-fixed', '1');
      });
      // Mirror borders/paddings for blockquotes and lists in RTL scope
      document.querySelectorAll(
        `[${RTL_ATTR}] blockquote, [${RTL_ATTR}] ul, [${RTL_ATTR}] ol, ` +
        `[data-rtl-fixed] blockquote, [data-rtl-fixed] ul, [data-rtl-fixed] ol, ` +
        `blockquote[data-rtl-fixed], ul[data-rtl-fixed], ol[data-rtl-fixed]`
      ).forEach(mirrorSides);
    } catch (e) {
      console.error('[Content Text Direction] fixHardcodedLTR error:', e);
    }
  }

  function clearFixedLTR() {
    document.querySelectorAll('[data-rtl-fixed]').forEach(el => el.removeAttribute('data-rtl-fixed'));
    document.querySelectorAll('[data-rtl-mirrored]').forEach(el => {
      ['border-left', 'border-right', 'padding-left', 'padding-right', 'margin-left', 'margin-right']
        .forEach(p => el.style.removeProperty(p));
      el.removeAttribute('data-rtl-mirrored');
    });
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
            debounceTimer = setTimeout(() => {
              applyRTLIfFound();
              fixHardcodedLTR();
            }, 100);
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
          fixHardcodedLTR();
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
          clearFixedLTR();
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