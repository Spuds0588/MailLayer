// MailLayer Service Worker
importScripts('config.js');
importScripts('gmail_service.js');
importScripts('outlook_service.js');

const DEFAULT_SETTINGS = {
  preferredEditor: 'modal', // 'sidebar' or 'modal'
  preferredProvider: 'gmail_web' // 'gmail_web', 'outlook_web'
};

let settings = DEFAULT_SETTINGS;

// Initialize settings on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[MailLayer Background] Extension installed/updated.');
  
  chrome.contextMenus.create({
    id: "maillayer-email-selection",
    title: "Send Email",
    contexts: ["selection"]
  });

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

// Context Menu Click Handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "maillayer-email-selection") {
    const selectedText = info.selectionText ? info.selectionText.trim() : '';
    const mailtoData = { to: '', cc: '', bcc: '', subject: '', body: '' };

    // Extract all emails from selection using regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = selectedText.match(emailRegex);
    
    if (matches && matches.length > 0) {
      // Deduplicate and join with semicolon
      const uniqueEmails = [...new Set(matches)];
      mailtoData.to = uniqueEmails.join('; ');

      if (settings.preferredEditor === 'sidebar') {
        chrome.sidePanel.open({ tabId: tab.id }).catch(err => {
          console.error('[MailLayer Background] sidePanel.open failed from context menu:', err);
        });
      }

      handleMessage({ action: 'intercept_mailto', data: mailtoData }, { tab: tab })
        .catch(err => console.error('[MailLayer Background] Context Menu Error:', err));
    } else {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => alert("MailLayer: Could not find a valid email address in the selected text.")
      }).catch(err => console.error('[MailLayer Background] Script execution failed:', err));
    }
  }
});

// Standardized response helper
function sendStandardResponse(sendResponse, success, data = null, error = null) {
  try {
    sendResponse({
      success: success,
      action: success ? 'send_success' : 'send_error', // Legacy support for action checks
      data: data,
      error: error
    });
  } catch (e) {
    console.warn('[MailLayer Background] Could not send response (channel likely closed):', e);
  }
}

// Main message router
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[MailLayer Background] onMessage:', message);

  // CRITICAL: sidePanel.open() must be called in response to a user gesture.
  // We handle it synchronously here before any async 'await' breaks the gesture context.
  if (message.action === 'intercept_mailto' && !message.data?.sendDirectly) {
    if (message.data?.openSidebar || settings.preferredEditor === 'sidebar') {
      console.log('[MailLayer Background] Opening side panel (gesture preserved).');
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch(err => {
        console.error('[MailLayer Background] sidePanel.open failed:', err);
      });
    }
  }

  handleMessage(message, sender)

    .then(result => {
      console.log('[MailLayer Background] handleMessage success:', result);
      sendStandardResponse(sendResponse, true, result);
      
      // If it was a send action, also broadcast success to other parts of the extension
      if (message.data?.sendDirectly || message.action === 'send_email') {
        const successMsg = { action: 'send_success', success: true };
        console.log('[MailLayer Background] Broadcasting success...');
        
        // Tab broadcast
        if (sender.tab) {
          chrome.tabs.sendMessage(sender.tab.id, successMsg, () => {
            if (chrome.runtime.lastError) { /* Ignore - tab may have closed */ }
          });
        }
        
        // Internal extension broadcast
        chrome.runtime.sendMessage(successMsg, () => {
          if (chrome.runtime.lastError) {
            // Ignore - this happens if no other extension pages (options/sidebar) are open
          }
        });
      }

    })
    .catch(err => {
      console.error('[MailLayer Background] handleMessage error:', err);
      sendStandardResponse(sendResponse, false, null, err.message || err.toString());
    });


  return true; // Keep channel open for async response
});

/**
 * Core logic for handling messages.
 * Returns a promise that resolves with the data to be sent back.
 */
async function handleMessage(message, sender) {
  // Use the global 'settings' which is kept in sync via storage.onChanged
  const currentSettings = settings;


  // 1. Direct Send Request (Prioritize this even if action is intercept_mailto)
  if (message.data?.sendDirectly || message.action === 'send_email') {
    const data = message.data || message;
    const provider = currentSettings.preferredProvider;
    const senderService = provider === 'outlook_web' ? OutlookService : GmailService;
    
    console.log(`[MailLayer Background] Starting ${provider} send process...`);
    try {
      const sendResult = await senderService.sendEmail(data);
      console.log(`[MailLayer Background] ${provider} send result:`, sendResult);
      return { status: 'sent', provider, details: sendResult };
    } catch (sendErr) {
      console.error(`[MailLayer Background] ${provider} send operation failed:`, sendErr);
      throw sendErr;
    }
  }


  // 2. Intercept Mailto (Initial trigger from page)
  if (message.action === 'intercept_mailto') {
    const data = message.data;
    
    if (currentSettings.signature && data.body !== undefined) {
      const sigMarker = 'class="ml-signature-block"';
      if (!data.body.includes(sigMarker)) {
        const signatureHtml = `<br><br><div class="ml-signature-block" contenteditable="false" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: 20px;">${currentSettings.signature}</div>`;
        data.body = (data.body || '') + signatureHtml;
      }
    }
    
    await chrome.storage.local.set({ currentDraft: data });

    if (data.openSidebar || currentSettings.preferredEditor === 'sidebar') {
      // Note: sidePanel.open is already called synchronously in the listener for gesture support
      return { action: 'sidebar_opening' };
    } else {
      chrome.tabs.sendMessage(sender.tab.id, { action: 'open_modal', data: data });
      return { action: 'modal_opening' };
    }

  }


  // 3. Outlook Auth Trigger
  if (message.action === 'trigger_outlook_auth') {
    const token = await OutlookService.getAccessToken();
    await chrome.storage.local.set({ outlook_token: token });
    return { authenticated: true };
  }

  // 4. Modal Ready Notification
  if (message.action === 'modal_ready') {
    return { acknowledged: true };
  }

  return { status: 'ignored' };
}


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
