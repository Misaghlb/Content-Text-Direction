// popup.js - Content Text Direction

function renderSavedList() {
  chrome.storage.local.get({ rtlSites: {} }, (data) => {
    const rtlSites = data.rtlSites;
    const savedList = document.getElementById('savedList');
    savedList.innerHTML = '';
    const domains = Object.keys(rtlSites);
    if (domains.length === 0) {
      savedList.innerHTML = '<div style="text-align:center;color:#888;padding:16px 0;">No saved elements</div>';
      return;
    }
    domains.forEach(domain => {
      const selector = rtlSites[domain];
      // Placeholder for user info (if you want to store user in the future)
      const user = '';
      const item = document.createElement('div');
      item.className = 'saved-item';
      const info = document.createElement('div');
      info.className = 'saved-info';
      const domainDiv = document.createElement('div');
      domainDiv.className = 'saved-domain';
      domainDiv.textContent = domain;
      info.appendChild(domainDiv);
      if (user) {
        const userDiv = document.createElement('div');
        userDiv.className = 'saved-user';
        userDiv.textContent = user;
        info.appendChild(userDiv);
      }
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.title = 'Remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', () => {
        chrome.storage.local.get({ rtlSites: {} }, (data2) => {
          const rtlSites2 = data2.rtlSites;
          const removedSelector = rtlSites2[domain];
          delete rtlSites2[domain];
          chrome.storage.local.set({ rtlSites: rtlSites2 }, renderSavedList);
          
          // Send message to active tab to reset RTL settings
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'resetRTL', 
                domain: domain,
                selector: removedSelector
              });
            }
          });
        });
      });
      item.appendChild(info);
      item.appendChild(removeBtn);
      savedList.appendChild(item);
    });
  });
}

document.getElementById('addBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    const url = new URL(tab.url);
    const domain = url.hostname;

    // Inject content.js and then trigger selection
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }, () => {
      setTimeout(() => {
        // Ask content.js to start selection and return the selector of the selected element
        chrome.tabs.sendMessage(tab.id, { action: 'enableSelectionAndReturnSelector' }, (response) => {
          if (response && response.selector) {
            // Save the selector for this domain in storage
            chrome.storage.local.get({ rtlSites: {} }, (data) => {
              const rtlSites = data.rtlSites;
              rtlSites[domain] = response.selector;
              console.log('[Content Text Direction] Saving selector for', domain, ':', response.selector);
              chrome.storage.local.set({ rtlSites }, renderSavedList);
            });
          }
        });
      }, 100);
    });
  });
});

document.addEventListener('DOMContentLoaded', renderSavedList);
