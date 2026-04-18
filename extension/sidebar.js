// Global State
let quill;
let attachments = [];
let protectedSignature = '';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initEditor();
    loadDraft();
    setupListeners();
    setupAttachmentLogic();
    setupTemplateGallery();
});


// Setup Attachment Logic
function setupAttachmentLogic() {
    const attachBtn = document.getElementById('ml-attach-btn');
    const fileInput = document.getElementById('ml-file-input');
    const attachList = document.getElementById('ml-attachments-list');

    attachBtn.onclick = () => fileInput.click();

    fileInput.onchange = async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64Data = event.target.result.split(',')[1];
                attachments.push({
                    name: file.name,
                    contentType: file.type || 'application/octet-stream',
                    content: base64Data,
                    size: file.size
                });
                renderAttachments();
            };
            reader.readAsDataURL(file);
        }
        fileInput.value = '';
    };

    function renderAttachments() {
        attachList.innerHTML = '';
        attachments.forEach((att, index) => {
            const chip = document.createElement('div');
            chip.className = 'ml-attachment-chip'; // Use same class as modal
            chip.style.cssText = "background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 4px 12px; display: flex; align-items: center; gap: 8px; font-size: 12px; color: #eee;";
            chip.innerHTML = `
                <span>${att.name}</span>
                <span class="ml-attachment-remove" style="cursor:pointer; color:#e03616;">&times;</span>
            `;
            chip.querySelector('.ml-attachment-remove').onclick = () => {
                attachments.splice(index, 1);
                renderAttachments();
            };
            attachList.appendChild(chip);
        });
    }

    attachList.addEventListener('renderAttachments', renderAttachments);
}

// Initialize Quill
function initEditor() {
    quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Compose your email...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'clean']
            ]
        }
    });
}

// Load draft from storage
async function loadDraft() {
    const { currentDraft } = await chrome.storage.local.get(['currentDraft']);
    if (currentDraft) {
        document.getElementById('ml-to').value = currentDraft.to || '';
        document.getElementById('ml-cc').value = currentDraft.cc || '';
        document.getElementById('ml-bcc').value = currentDraft.bcc || '';
        document.getElementById('ml-subject').value = currentDraft.subject || '';
        quill.clipboard.dangerouslyPasteHTML(currentDraft.body || '');
    }
}

// Event Listeners
function setupListeners() {
    const sendBtn = document.getElementById('send-btn');
    const discardBtn = document.getElementById('discard-btn');
    const statusDiv = document.getElementById('status');

    sendBtn.addEventListener('click', () => {
        const originalText = sendBtn.innerText;
        sendBtn.innerText = 'Sending...';
        sendBtn.disabled = true;
        statusDiv.innerText = '';

        const updatedData = {
            to: document.getElementById('ml-to').value,
            cc: document.getElementById('ml-cc').value,
            bcc: document.getElementById('ml-bcc').value,
            subject: document.getElementById('ml-subject').value,
            body: quill.root.innerHTML,
            attachments: attachments,
            sendDirectly: true
        };

        chrome.runtime.sendMessage({ action: 'intercept_mailto', data: updatedData }, (response) => {
            if (chrome.runtime.lastError) {
                statusDiv.innerText = 'Error: Connection lost. Refresh page.';
                sendBtn.innerText = originalText;
                sendBtn.disabled = false;
                return;
            }

            if (response && response.success) {
                statusDiv.innerText = '✅ Message sent successfully!';
                sendBtn.innerText = 'Sent!';
                setTimeout(() => window.close(), 1500);
            } else {
                statusDiv.innerText = '❌ ' + (response?.error || 'Unknown error');
                sendBtn.innerText = originalText;
                sendBtn.disabled = false;
            }
        });
    });

    discardBtn.addEventListener('click', async () => {
        if (confirm('Discard this draft?')) {
            await chrome.storage.local.remove('currentDraft');
            window.close();
        }
    });
}

// Template Gallery Logic
function setupTemplateGallery() {
    const gallery = document.getElementById('ml-template-gallery');
    const galleryTrigger = document.getElementById('ml-gallery-trigger');

    const toggleGallery = async () => {
        const isActive = gallery.classList.toggle('active');
        galleryTrigger.classList.toggle('active');
        
        if (isActive) {
            galleryTrigger.innerHTML = 'Close Gallery';
            renderGallery();
        } else {
            galleryTrigger.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg> Templates`;
        }
    };

    const renderGallery = async () => {
        const { settings } = await chrome.storage.local.get(['settings']);
        const templates = settings?.templates || [];
        
        if (templates.length === 0) {
            gallery.innerHTML = '<div style="color:#9ca3af; text-align:center; padding:40px;">No templates found. Create some in the extension options!</div>';
            return;
        }

        gallery.innerHTML = templates.map((tpl, idx) => `
            <div class="maillayer-template-card" data-index="${idx}">
                <h4>${tpl.name}</h4>
                <p>${tpl.subject || 'No Subject'}</p>
            </div>
        `).join('');

        gallery.querySelectorAll('.maillayer-template-card').forEach(card => {
            card.onclick = () => {
                applyTemplate(templates[card.dataset.index], settings?.signature);
                toggleGallery();
            };
        });
    };

    const applyTemplate = (tpl, signatureHtml) => {
        if (tpl.subject) document.getElementById('ml-subject').value = tpl.subject;
        if (tpl.cc) document.getElementById('ml-cc').value = tpl.cc;
        if (tpl.bcc) document.getElementById('ml-bcc').value = tpl.bcc;
        if (tpl.body) {
            let newBody = tpl.body;
            if (signatureHtml) {
                const formattedSignature = `<br><br><div class="ml-signature-block" contenteditable="false" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: 20px;">${signatureHtml}</div>`;
                newBody += formattedSignature;
            }
            quill.clipboard.dangerouslyPasteHTML(newBody);
        }
        if (tpl.attachments && tpl.attachments.length > 0) {
            attachments = [...attachments, ...tpl.attachments];
            // Re-render attachments logic is inside setupAttachmentLogic, 
            // but we need a global reference or just trigger a re-render.
            // A quick fix is to dispatch an event or expose the render function.
            // Since this is all in the same scope via global attachments array, we'll need to trigger the render manually.
            // I'll dispatch a custom event on the attachList to handle this cleanly.
            const event = new CustomEvent('renderAttachments');
            document.getElementById('ml-attachments-list').dispatchEvent(event);
        }
    };

    galleryTrigger.onclick = toggleGallery;
}

// Listen for storage changes to sync draft if sidebar is open
chrome.storage.onChanged.addListener((changes) => {
    if (changes.currentDraft && !changes.currentDraft.newValue) {
        // Draft was removed
        document.getElementById('ml-to').value = '';
        document.getElementById('ml-subject').value = '';
        quill.setText('');
    }
});
