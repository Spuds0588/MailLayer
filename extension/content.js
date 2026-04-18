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
    sendResponse({ status: 'modal_opening' });
  } else if (message.action === 'modal_failed') {
    showFallbackTrigger();
    sendResponse({ status: 'fallback_shown' });
  }
  // Removed return true to avoid "channel closed" errors when no response is sent
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
            <img src="${chrome.runtime.getURL('Icons/icon32.png')}" width="20" height="20" style="margin-right:10px;" alt="Logo">
          </div>
          <button class="maillayer-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="maillayer-body">
            <div class="maillayer-row">
                <div class="maillayer-label-cell">To</div>
                <div class="maillayer-input-cell">
                    <input type="text" id="ml-to" value="${escapeHTML(data.to)}">
                    <div class="maillayer-field-toggles">
                        <span id="ml-toggle-cc">CC</span>
                        <span id="ml-toggle-bcc">BCC</span>
                    </div>
                </div>
            </div>
            
            <div class="maillayer-row" id="ml-cc-row" style="${data.cc ? '' : 'display:none;'}">
                <div class="maillayer-label-cell">CC</div>
                <div class="maillayer-input-cell">
                    <input type="text" id="ml-cc" value="${escapeHTML(data.cc || '')}">
                </div>
            </div>

            <div class="maillayer-row" id="ml-bcc-row" style="${data.bcc ? '' : 'display:none;'}">
                <div class="maillayer-label-cell">BCC</div>
                <div class="maillayer-input-cell">
                    <input type="text" id="ml-bcc" value="${escapeHTML(data.bcc || '')}">
                </div>
            </div>

            <div class="maillayer-row">
                <div class="maillayer-label-cell">Subject</div>
                <div class="maillayer-input-cell">
                    <input type="text" id="ml-subject" value="${escapeHTML(data.subject)}">
                </div>
            </div>

            <div class="maillayer-editor-row">
                <div id="ml-editor-container" style="min-height: 250px;"></div>
            </div>
            <div id="ml-attachments-list" style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;"></div>
        </div>
        <div class="maillayer-footer">
            <div style="display:flex; gap: 8px; align-items:center;">
                <button class="maillayer-btn-icon" id="ml-attach-btn" title="Attach Files">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#eee">
                        <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.66 1.34 3 3 3s3-1.34 3-3V5c0-2.48-2.02-4.5-4.5-4.5S7 2.52 7 5v12.5c0 3.59 2.91 6.5 6.5 6.5s6.5-2.91 6.5-6.5V6h-1.5z"/>
                    </svg>
                </button>
                <input type="file" id="ml-file-input" multiple style="display:none;">
            </div>
            <div style="flex:1"></div>
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

  // CC/BCC Toggles
  const toggleCC = container.querySelector('#ml-toggle-cc');
  const toggleBCC = container.querySelector('#ml-toggle-bcc');
  const ccRow = container.querySelector('#ml-cc-row');
  const bccRow = container.querySelector('#ml-bcc-row');

  toggleCC.onclick = () => {
    ccRow.style.display = ccRow.style.display === 'none' ? 'flex' : 'none';
  };
  toggleBCC.onclick = () => {
    bccRow.style.display = bccRow.style.display === 'none' ? 'flex' : 'none';
  };

  // Initialize Quill
  const quill = new Quill(container.querySelector('#ml-editor-container'), {
    theme: 'snow',
    placeholder: 'Type your message...',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'clean']
      ]
    }
  });

  if (data.body) {
    quill.clipboard.dangerouslyPasteHTML(data.body);
  }

  container._mlQuill = quill;
  container._mlAttachments = [];

  // Attachment Logic
  const attachBtn = container.querySelector('#ml-attach-btn');
  const fileInput = container.querySelector('#ml-file-input');
  const attachList = container.querySelector('#ml-attachments-list');

  attachBtn.onclick = () => fileInput.click();

  fileInput.onchange = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      if (container._mlAttachments.length >= 10) {
        alert('Max 10 attachments allowed.');
        break;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result.split(',')[1];
        const attachment = {
          name: file.name,
          contentType: file.type || 'application/octet-stream',
          content: base64Data,
          size: file.size
        };
        
        container._mlAttachments.push(attachment);
        renderAttachments();
      };
      reader.readAsDataURL(file);
    }
    fileInput.value = ''; // Reset for same file selection
  };

  const renderAttachments = () => {
    attachList.innerHTML = '';
    container._mlAttachments.forEach((att, index) => {
      const chip = document.createElement('div');
      chip.className = 'ml-attachment-chip';
      chip.innerHTML = `
        <span>${att.name} (${(att.size/1024).toFixed(1)} KB)</span>
        <span class="ml-attachment-remove" data-index="${index}">&times;</span>
      `;
      chip.querySelector('.ml-attachment-remove').onclick = () => {
        container._mlAttachments.splice(index, 1);
        renderAttachments();
      };
      attachList.appendChild(chip);
    });
  };

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
        body: quill.root.innerHTML,
        attachments: container._mlAttachments,
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

            if (response && response.success) {
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
