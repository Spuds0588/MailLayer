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

// Listen for storage changes to sync draft if sidebar is open
chrome.storage.onChanged.addListener((changes) => {
    if (changes.currentDraft && !changes.currentDraft.newValue) {
        // Draft was removed
        document.getElementById('ml-to').value = '';
        document.getElementById('ml-subject').value = '';
        quill.setText('');
    }
});
