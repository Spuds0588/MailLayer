// MailLayer Sidebar Logic
// Handles API-driven sending from the Chrome Side Panel

const statusEl = document.getElementById('status');
const sendBtn = document.getElementById('send-btn');
const discardBtn = document.getElementById('discard-btn');

/**
 * Updates the sidebar form with draft data
 */
async function updateSidebar() {
    const { currentDraft } = await chrome.storage.local.get(['currentDraft']);
    
    // Clear first if no draft
    if (!currentDraft) {
        document.getElementById('ml-to').value = '';
        document.getElementById('ml-subject').value = '';
        document.getElementById('ml-body').value = '';
        document.getElementById('cc-field').classList.remove('visible');
        document.getElementById('bcc-field').classList.remove('visible');
        return;
    }

    document.getElementById('ml-to').value = currentDraft.to || '';
    document.getElementById('ml-subject').value = currentDraft.subject || '';
    document.getElementById('ml-body').value = currentDraft.body || '';
    
    if (currentDraft.cc) {
        document.getElementById('cc-field').classList.add('visible');
        document.getElementById('ml-cc').value = currentDraft.cc;
    } else {
        document.getElementById('cc-field').classList.remove('visible');
    }

    if (currentDraft.bcc) {
        document.getElementById('bcc-field').classList.add('visible');
        document.getElementById('ml-bcc').value = currentDraft.bcc;
    } else {
        document.getElementById('bcc-field').classList.remove('visible');
    }
}

/**
 * Discards the current draft
 */
const discardDraft = async () => {
    await chrome.storage.local.remove('currentDraft');
    updateSidebar();
    statusEl.innerText = 'Draft Discarded';
    setTimeout(() => { statusEl.innerText = ''; }, 2000);
};

/**
 * Sends the email via background worker
 */
const sendEmail = async () => {
    sendBtn.innerText = 'Sending...';
    sendBtn.disabled = true;
    discardBtn.disabled = true;

    const data = {
        to: document.getElementById('ml-to').value,
        cc: document.getElementById('ml-cc')?.value || '',
        bcc: document.getElementById('ml-bcc')?.value || '',
        subject: document.getElementById('ml-subject').value,
        body: document.getElementById('ml-body').value,
        sendDirectly: true
    };

    chrome.runtime.sendMessage({ action: 'intercept_mailto', data });
};

// Listen for success/error from background
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'send_success') {
        statusEl.innerText = '🚀 Email Sent Successfully!';
        statusEl.style.color = '#cfffb0';
        chrome.storage.local.remove('currentDraft');
        setTimeout(() => {
            statusEl.innerText = '';
            sendBtn.innerText = 'Send';
            sendBtn.disabled = false;
            discardBtn.disabled = false;
            updateSidebar();
        }, 3000);
    } else if (message.action === 'send_error') {
        statusEl.innerText = '❌ Error: ' + message.error;
        statusEl.style.color = '#e03616';
        sendBtn.disabled = false;
        discardBtn.disabled = false;
        sendBtn.innerText = 'Try Again';
    }
});

sendBtn.onclick = sendEmail;
discardBtn.onclick = discardDraft;

// Listen for storage changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes.currentDraft) {
        updateSidebar();
    }
});

// Initial load
document.addEventListener('DOMContentLoaded', updateSidebar);
