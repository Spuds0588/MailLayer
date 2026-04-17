// MailLayer Sidebar Controller
// Handles API-driven sending from the Chrome Side Panel with Quill.js

let quill;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initEditor();
    loadDraft();
    setupListeners();
});

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
        if (currentDraft.body) {
            if (currentDraft.body.includes('<')) {
                quill.clipboard.dangerouslyPasteHTML(currentDraft.body);
            } else {
                quill.setText(currentDraft.body);
            }
        }
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
            body: quill.root.innerHTML, // Get HTML from Quill
            sendDirectly: true
        };

        chrome.runtime.sendMessage({ action: 'intercept_mailto', data: updatedData }, (response) => {
            if (chrome.runtime.lastError) {
                statusDiv.innerText = 'Error: Connection lost. Refresh page.';
                sendBtn.innerText = originalText;
                sendBtn.disabled = false;
                return;
            }

            if (response && response.action === 'send_success') {
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
