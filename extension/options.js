// Global State
let signatureQuill;

/**
 * Save settings to chrome.storage.local
 */
const saveOptions = () => {
    const activeEditor = document.querySelector('[data-id="preferredEditor"] .is-active');
    const activeProvider = document.querySelector('[data-id="preferredProvider"] .is-active');
    
    if (!activeEditor || !activeProvider) return;

    const signature = signatureQuill ? signatureQuill.root.innerHTML : '';
    const preferredEditor = activeEditor.dataset.value;
    const preferredProvider = activeProvider.dataset.value;

    chrome.storage.local.set(
        { settings: { preferredEditor, preferredProvider, signature } },
        () => {
            statusEl.classList.add('visible');
            setTimeout(() => {
                statusEl.classList.remove('visible');
            }, 2000);
        }
    );
};

/**
 * Load settings and highlight active buttons
 */
const restoreOptions = () => {
    chrome.storage.local.get(['settings'], (result) => {
        if (result.settings) {
            setGroupActive('preferredEditor', result.settings.preferredEditor || 'modal');
            setGroupActive('preferredProvider', result.settings.preferredProvider || 'gmail_web');
            if (signatureQuill && result.settings.signature) {
                signatureQuill.clipboard.dangerouslyPasteHTML(result.settings.signature);
            }
        }
    });
};

/**
 * Initialize Quill for Signature
 */
const initSignatureEditor = () => {
    signatureQuill = new Quill('#signature-editor', {
        theme: 'snow',
        placeholder: 'Enter your rich text signature...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                ['link', 'clean']
            ]
        }
    });

    // Auto-save signature on blur
    signatureQuill.on('selection-change', (range) => {
        if (!range) saveOptions();
    });
};

/**
 * Toggle active class in button group
 */
const setGroupActive = (groupId, value) => {
    const group = document.querySelector(`[data-id="${groupId}"]`);
    if (!group) return;
    group.querySelectorAll('.btn-option').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.value === value);
    });
};

/**
 * Initialize button group click listeners
 */
const initButtonGroups = () => {
    document.querySelectorAll('.button-group').forEach(group => {
        group.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-option');
            if (btn) {
                setGroupActive(group.dataset.id, btn.dataset.value);
                saveOptions(); // Auto-save on click
            }
        });
    });
};

/**
 * Handle Google Auth Trigger
 */
const handleAuth = () => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
            console.error('[MailLayer] Auth Error:', chrome.runtime.lastError);
        } else {
            updateAuthStatus();
        }
    });
};

/**
 * Poll and update Connection status
 */
const updateAuthStatus = () => {
    const authStatus = document.getElementById('auth-status');
    const googleBtn = document.getElementById('connect-google');
    const outlookBtn = document.getElementById('connect-outlook');

    // Check Google
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (token) {
            authStatus.innerText = 'Connected: Ready to send via API';
            authStatus.style.color = 'var(--tea-green)';
            googleBtn.innerText = 'Disconnect Google';
            googleBtn.onclick = () => {
                chrome.identity.removeCachedAuthToken({ token }, () => updateAuthStatus());
            };
        } else {
            googleBtn.innerText = 'Connect Google';
            googleBtn.onclick = handleAuth;
        }
    });

    // Check Outlook (storage based)
    chrome.storage.local.get(['outlook_token'], (res) => {
        if (res.outlook_token) {
            authStatus.innerText = 'Connected: Ready to send via API';
            authStatus.style.color = 'var(--tea-green)';
            outlookBtn.innerText = 'Disconnect Outlook';
            outlookBtn.onclick = () => {
                chrome.storage.local.remove('outlook_token', () => updateAuthStatus());
            };
        } else {
            outlookBtn.innerText = 'Connect Outlook';
            outlookBtn.onclick = handleOutlookAuth;
        }
    });
};

const handleOutlookAuth = () => {
    chrome.runtime.sendMessage({ action: 'trigger_outlook_auth' }, () => {
        updateAuthStatus();
    });
};

const statusEl = document.getElementById('status');

// Start
document.addEventListener('DOMContentLoaded', () => {
    initSignatureEditor();
    initButtonGroups();
    restoreOptions();
    updateAuthStatus();
});
