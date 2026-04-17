// MailLayer Service Worker
importScripts('config.js');
importScripts('gmail_service.js');
importScripts('outlook_service.js');

const DEFAULT_SETTINGS = {
  preferredEditor: 'modal', // 'sidebar' or 'modal'
  preferredProvider: 'gmail_web' // 'gmail_web', 'outlook_web', 'yahoo'
};

let settings = DEFAULT_SETTINGS;

// Initialize settings on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[MailLayer Background] Extension installed/updated.');
  
  chrome.storage.local.get(['settings'], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({ settings: DEFAULT_SETTINGS }, () => {
        chrome.runtime.openOptionsPage();
      });
    } else {
      settings = result.settings;
      // Also open on update for development visibility if needed
      // chrome.runtime.openOptionsPage(); 
    }
  });

  setupDNRLoader();
});

// Keep settings in sync
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    settings = changes.settings.newValue;
  }
});

// Load settings on startup
chrome.storage.local.get(['settings'], (result) => {
  if (result.settings) settings = result.settings;
});

// Listener for interception messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'intercept_mailto') {
    console.log('[MailLayer Background] Intercepted mailto:', message.data);
    
    // Save current draft data
    chrome.storage.local.set({ currentDraft: message.data });

    // API SENDING OR SIDEBAR FALLBACK
    if (message.data.sendDirectly) {
      console.log(`[MailLayer Background] Attempting direct API send via ${settings.preferredProvider}...`);
      
      const senderService = settings.preferredProvider === 'outlook_web' ? OutlookService : GmailService;
      
      senderService.sendEmail(message.data)
        .then(() => {
          const response = { action: 'send_success' };
          sendResponse(response);
          // Also broadcast to tabs if it originated from elsewhere
          if (sender.tab) chrome.tabs.sendMessage(sender.tab.id, response);
          chrome.runtime.sendMessage(response); 
        })
        .catch(err => {
          const response = { action: 'send_error', error: err.message };
          sendResponse(response);
          if (sender.tab) chrome.tabs.sendMessage(sender.tab.id, response);
          chrome.runtime.sendMessage(response);
        });
      return true; // Keep channel open
    }

    // MANUAL FALLBACK OR DEFAULT SIDEBAR
    if (message.data.openSidebar || settings.preferredEditor === 'sidebar') {
      console.log('[MailLayer Background] Opening Sidebar (Manual or Setting)');
      chrome.sidePanel.open({ tabId: sender.tab.id });
    } else {
      console.log('[MailLayer Background] Attempting Modal injection...');
      
      let modalConfirmed = false;
      const confirmationListener = (confirmMsg, confirmSender) => {
        if (confirmMsg.action === 'modal_ready' && confirmSender.tab && confirmSender.tab.id === sender.tab.id) {
          modalConfirmed = true;
          chrome.runtime.onMessage.removeListener(confirmationListener);
        }
      };
      chrome.runtime.onMessage.addListener(confirmationListener);

      // Trigger modal
      chrome.tabs.sendMessage(sender.tab.id, { action: 'open_modal', data: message.data });

      // Fallback Timeout
      setTimeout(() => {
        if (!modalConfirmed) {
          console.warn('[MailLayer Background] Modal injection failed. Signaling content script.');
          chrome.tabs.sendMessage(sender.tab.id, { action: 'modal_failed' });
          chrome.runtime.onMessage.removeListener(confirmationListener);
        }
      }, 750);
    }
    return true; // Keep channel open
  }

  // OUTLOOK AUTH TRIGGER
  if (message.action === 'trigger_outlook_auth') {
    OutlookService.getAccessToken()
      .then(token => {
        chrome.storage.local.set({ outlook_token: token }, () => {
          sendResponse({ success: true });
        });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open for async response
  }
});

/**
 * Setup declarativeNetRequest rules to strip frame blockers for external webmail.
 */
function setupDNRLoader() {
  const RULE_ID = 1;
  const extensionDomain = chrome.runtime.id;

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [{
      id: RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'X-Frame-Options', operation: 'remove' },
          { header: 'Content-Security-Policy', operation: 'remove' },
          { header: 'Frame-Options', operation: 'remove' }
        ]
      },
      condition: {
        resourceTypes: ['sub_frame'],
        initiatorDomains: [extensionDomain]
      }
    }]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('[MailLayer Background] DNR initialization failed:', chrome.runtime.lastError);
    } else {
      console.log('[MailLayer Background] DNR rules for iframe bypass configured.');
    }
  });
}

// Open settings on icon click
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
