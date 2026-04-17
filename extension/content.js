// MailLayer Content Script

console.log('[MailLayer Content] Active.');

// Event Delegation for mailto links
document.documentElement.addEventListener('click', (event) => {
  const mailtoLink = event.target.closest('a[href^="mailto:"]');
  if (mailtoLink) {
    event.preventDefault();
    event.stopPropagation();

    const parsedData = parseMailtoUrl(mailtoLink.href);
    console.log('[MailLayer Content] Intercepted link:', parsedData);

    // Send to background for processing with Context Validation
    try {
      chrome.runtime.sendMessage({
        action: 'intercept_mailto',
        data: parsedData
      });
    } catch (e) {
      if (e.message.includes('Extension context invalidated')) {
        console.error('[MailLayer] Extension context invalidated. Please refresh the page.');
        alert('MailLayer has been updated. Please refresh the page to continue using it.');
      } else {
        console.error('[MailLayer] Message failed:', e);
      }
    }
  }
}, true);

/**
 * Parses a mailto URL into its component parts.
 */
function parseMailtoUrl(url) {
  const cleanUrl = url.replace(/^mailto:/i, '');
  const [toPart, queryPart] = cleanUrl.split('?');
  
  const result = {
    to: decodeURIComponent(toPart || ''),
    cc: '',
    bcc: '',
    subject: '',
    body: ''
  };

  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    result.cc = params.get('cc') || '';
    result.bcc = params.get('bcc') || '';
    result.subject = params.get('subject') || '';
    result.body = params.get('body') || '';
  }

  return result;
}

// Listener for background messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'open_modal') {
    openModal(message.data);
  } else if (message.action === 'modal_failed') {
    showFallbackTrigger();
  }
  return true;
});

/**
 * Helper to escape HTML to prevent XSS and broken attributes
 */
function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

/**
 * Implementation of the "Ghost Injection Pattern" for the in-page modal.
 */
function openModal(data) {
  if (document.getElementById('maillayer-root')) return;

  const host = document.createElement('div');
  host.id = 'maillayer-root';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('modal.css');
  shadow.appendChild(styleLink);

  const overlay = document.createElement('div');
  overlay.className = 'maillayer-modal-overlay';
  
  const container = document.createElement('div');
  container.className = 'maillayer-modal-container';
  
  container.innerHTML = `
    <div class="maillayer-header" id="maillayer-drag-handle">
        <div style="display:flex; align-items:center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#e03616" style="margin-right:10px;">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
          <h2 style="margin:0; font-size:16px; color: white;">MailLayer Compose</h2>
        </div>
        <button class="maillayer-close-btn">&times;</button>
    </div>
    <div class="maillayer-body">
        <div class="maillayer-field">
            <label>To</label>
            <input type="text" id="ml-to" value="${escapeHTML(data.to)}">
        </div>
        ${data.cc ? `
        <div class="maillayer-field">
            <label>CC</label>
            <input type="text" id="ml-cc" value="${escapeHTML(data.cc)}">
        </div>` : ''}
        ${data.bcc ? `
        <div class="maillayer-field">
            <label>BCC</label>
            <input type="text" id="ml-bcc" value="${escapeHTML(data.bcc)}">
        </div>` : ''}
        <div class="maillayer-field">
            <label>Subject</label>
            <input type="text" id="ml-subject" value="${escapeHTML(data.subject)}">
        </div>
        <div class="maillayer-field">
            <label>Message</label>
            <textarea id="ml-body">${escapeHTML(data.body)}</textarea>
        </div>
    </div>
    <div class="maillayer-footer">
        <button class="maillayer-btn maillayer-btn-secondary close-action">Discard</button>
        <button class="maillayer-btn maillayer-btn-primary">Send Email</button>
    </div>
  `;

  overlay.appendChild(container);
  shadow.appendChild(overlay);

  const closeModal = () => host.remove();
  shadow.querySelector('.maillayer-close-btn').onclick = closeModal;
  shadow.querySelector('.close-action').onclick = closeModal;

  // Drag Logic
  const handle = shadow.getElementById('maillayer-drag-handle');
  let isDragging = false;
  let offsetX, offsetY;

  handle.onmousedown = (e) => {
    isDragging = true;
    offsetX = e.clientX - container.getBoundingClientRect().left;
    offsetY = e.clientY - container.getBoundingClientRect().top;
    container.style.position = 'absolute';
    container.style.margin = '0';
  };

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    container.style.left = (e.clientX - offsetX) + 'px';
    container.style.top = (e.clientY - offsetY) + 'px';
  });

  document.addEventListener('mouseup', () => isDragging = false);

  const sendBtn = shadow.querySelector('.maillayer-btn-primary');
  sendBtn.onclick = () => {
    sendBtn.innerText = 'Sending...';
    sendBtn.disabled = true;
    
    const updatedData = {
        to: shadow.getElementById('ml-to').value,
        cc: shadow.getElementById('ml-cc')?.value || '',
        bcc: shadow.getElementById('ml-bcc')?.value || '',
        subject: shadow.getElementById('ml-subject').value,
        body: shadow.getElementById('ml-body').value,
        sendDirectly: true
    };

    chrome.runtime.sendMessage({ action: 'intercept_mailto', data: updatedData }, (response) => {
        // Handle response if needed
    });
    
    // Auto-close after a short delay for UX
    setTimeout(closeModal, 1500);
  };

  chrome.runtime.sendMessage({ action: 'modal_ready' }); 
}

/**
 * Show a fallback trigger if modal fails
 */
function showFallbackTrigger() {
    if (document.getElementById('mail-layer-fallback')) return;
    const btn = document.createElement('div');
    btn.id = 'mail-layer-fallback';
    btn.innerHTML = `
      <div style="position: fixed; bottom: 30px; right: 30px; z-index: 2147483647; 
                  background: #e03616; color: white; padding: 12px 20px; border-radius: 12px;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.3); cursor: pointer; font-family: sans-serif;
                  font-weight: bold; border: 1px solid rgba(255,255,255,0.2);">
          📧 Open MailLayer Sidebar
      </div>
    `;
    btn.onclick = () => {
        chrome.runtime.sendMessage({ action: 'intercept_mailto', data: { openSidebar: true } });
        btn.remove();
    };
    document.documentElement.appendChild(btn);
}
