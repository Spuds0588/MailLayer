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
  if (document.getElementById('maillayer-modal-root')) return;

  const container = document.createElement('div');
  container.id = 'maillayer-modal-root';
  document.body.appendChild(container);

  container.innerHTML = `
    <div class="maillayer-modal-overlay">
      <div class="maillayer-modal-container">
        <div class="maillayer-header" id="maillayer-drag-handle">
          <div style="display:flex; align-items:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff" style="margin-right:10px;">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
            <h2 style="margin:0; font-size:16px; color: white;">MailLayer Compose</h2>
          </div>
          <button class="maillayer-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="maillayer-body">
            <div class="maillayer-field">
                <label>Recipient</label>
                <input type="text" id="ml-to" value="${escapeHTML(data.to)}">
            </div>
            <div class="maillayer-field">
                <label>CC</label>
                <input type="text" id="ml-cc" value="${escapeHTML(data.cc || '')}">
            </div>
            <div class="maillayer-field">
                <label>BCC</label>
                <input type="text" id="ml-bcc" value="${escapeHTML(data.bcc || '')}">
            </div>
            <div class="maillayer-field">
                <label>Subject</label>
                <input type="text" id="ml-subject" value="${escapeHTML(data.subject)}">
            </div>
            <div class="maillayer-field">
                <label>Message</label>
                <div id="ml-editor-container" style="min-height: 250px;"></div>
            </div>
        </div>
        <div class="maillayer-footer">
            <button class="maillayer-btn maillayer-btn-secondary close-action">Discard</button>
            <button class="maillayer-btn maillayer-btn-primary">Send Email</button>
        </div>
      </div>
    </div>
  `;

  // Inject Styles into Head
  if (!document.getElementById('maillayer-styles')) {
    const modalStyle = document.createElement('link');
    modalStyle.id = 'maillayer-styles';
    modalStyle.rel = 'stylesheet';
    modalStyle.href = chrome.runtime.getURL('modal.css');
    document.head.appendChild(modalStyle);
  }

  if (!document.getElementById('quill-styles')) {
    const quillStyle = document.createElement('link');
    quillStyle.id = 'quill-styles';
    quillStyle.rel = 'stylesheet';
    quillStyle.href = chrome.runtime.getURL('vendor/quill/quill.snow.css');
    document.head.appendChild(quillStyle);
  }

  const closeModal = () => container.remove();
  container.querySelector('.maillayer-close-btn').onclick = closeModal;
  container.querySelector('.close-action').onclick = closeModal;

  // Initialize Quill
  const quill = new Quill(container.querySelector('#ml-editor-container'), {
    theme: 'snow',
    placeholder: 'Write your message...',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'clean']
      ]
    }
  });
  
  // Set initial content if any
  if (data.body) {
    quill.clipboard.dangerouslyPasteHTML(data.body);
  }

  container._mlQuill = quill;

  // Drag Logic
  const handle = container.querySelector('#maillayer-drag-handle');
  const modalBox = container.querySelector('.maillayer-modal-container');
  let isDragging = false;
  let offsetX, offsetY;

  handle.onmousedown = (e) => {
    isDragging = true;
    offsetX = e.clientX - modalBox.getBoundingClientRect().left;
    offsetY = e.clientY - modalBox.getBoundingClientRect().top;
  };

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    modalBox.style.left = (e.clientX - offsetX + modalBox.offsetWidth/2) + 'px';
    modalBox.style.top = (e.clientY - offsetY + modalBox.offsetHeight/2) + 'px';
  });

  document.addEventListener('mouseup', () => isDragging = false);

  const sendBtn = container.querySelector('.maillayer-btn-primary');
  sendBtn.onclick = () => {
    const originalText = sendBtn.innerText;
    sendBtn.innerText = 'Sending...';
    sendBtn.disabled = true;
    
    // Get HTML from Quill
    const htmlBody = container._mlQuill.root.innerHTML;

    const updatedData = {
        to: container.querySelector('#ml-to').value,
        cc: container.querySelector('#ml-cc')?.value || '',
        bcc: container.querySelector('#ml-bcc')?.value || '',
        subject: container.querySelector('#ml-subject').value,
        body: htmlBody,
        sendDirectly: true
    };

    console.log('[MailLayer] Sending message to background...', updatedData);

    try {
        chrome.runtime.sendMessage({ action: 'intercept_mailto', data: updatedData }, (response) => {
            console.log('[MailLayer] Received response from background:', response);
            
            if (chrome.runtime.lastError) {
                console.error('[MailLayer] Send failed (lastError):', chrome.runtime.lastError);
                sendBtn.innerText = 'Error: Reload Page';
                alert('Connection to extension lost. Please refresh the page.');
                setTimeout(() => { sendBtn.innerText = originalText; sendBtn.disabled = false; }, 3000);
                return;
            }

            if (response && response.action === 'send_success') {
                console.log('[MailLayer] Send successful reported by background.');
                sendBtn.innerText = '✅ Sent!';
                setTimeout(closeModal, 1000);
            } else {
                console.error('[MailLayer] Send failed reported by background:', response?.error);
                sendBtn.innerText = '❌ Failed';
                alert('Send failed: ' + (response?.error || 'Unknown error'));
                sendBtn.innerText = originalText;
                sendBtn.disabled = false;
            }
        });
    } catch (e) {
        console.error('[MailLayer] Critical error sending message:', e);
        alert('Extension context invalidated. Please refresh the page.');
        sendBtn.innerText = 'Error: Refresh Page';
    }
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
