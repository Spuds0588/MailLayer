let signatureQuill;
let templateQuill;
let templates = [];


/**
 * Save settings to chrome.storage.local
 */
const saveOptions = () => {
    const activeEditor = document.querySelector('[data-id="preferredEditor"] .is-active');
    const activeProvider = document.querySelector('[data-id="preferredProvider"] .is-active');
    
    if (!activeEditor || !activeProvider) return;

    chrome.storage.local.get(['settings'], (result) => {
        const existingSettings = result.settings || {};
        const signature = signatureQuill ? signatureQuill.root.innerHTML : (existingSettings.signature || '');
        const preferredEditor = activeEditor.dataset.value;
        const preferredProvider = activeProvider.dataset.value;

        const newSettings = { 
            ...existingSettings,
            preferredEditor, 
            preferredProvider, 
            signature,
            templates // Ensure templates are preserved
        };

        chrome.storage.local.set({ settings: newSettings }, () => {
            statusEl.classList.add('visible');
            setTimeout(() => {
                statusEl.classList.remove('visible');
            }, 2000);
        });
    });
};


/**
 * Load settings and highlight active buttons
 */
const restoreOptions = () => {
    chrome.storage.local.get(['settings'], (result) => {
        if (result.settings) {
            templates = result.settings.templates || [];
            setGroupActive('preferredEditor', result.settings.preferredEditor || 'modal');
            setGroupActive('preferredProvider', result.settings.preferredProvider || 'gmail_web');
            if (signatureQuill && result.settings.signature) {
                signatureQuill.clipboard.dangerouslyPasteHTML(result.settings.signature);
            }
            renderTemplatesList();
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
 * Template Management Logic
 */
const initTemplateEditor = () => {
    templateQuill = new Quill('#tpl-body-editor', {
        theme: 'snow',
        placeholder: 'Write your template content here...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'clean']
            ]
        }
    });
};

const renderTemplatesList = () => {
    const list = document.getElementById('templates-list');
    if (!list) return;
    
    if (templates.length === 0) {
        list.innerHTML = '<p class="has-text-grey-light is-size-7">No templates saved yet.</p>';
        return;
    }

    list.innerHTML = templates.map((tpl, index) => `
        <div class="template-item mb-2" style="background: rgba(255,255,255,0.05); padding: 0.75rem 1rem; border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">
            <div>
                <span class="has-text-white is-size-6" style="font-weight:600;">${tpl.name}</span>
                <span class="has-text-grey is-size-7 ml-3">${tpl.subject || '(No subject)'}</span>
            </div>
            <div class="buttons is-marginless">
                <button class="button is-small is-dark edit-tpl" data-index="${index}">Edit</button>
                <button class="button is-small is-danger is-outlined delete-tpl" data-index="${index}">&times;</button>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.edit-tpl').forEach(btn => {
        btn.onclick = () => showTemplateEditor(parseInt(btn.dataset.index));
    });

    list.querySelectorAll('.delete-tpl').forEach(btn => {
        btn.onclick = () => {
            if (confirm('Delete this template?')) {
                templates.splice(parseInt(btn.dataset.index), 1);
                saveOptions();
                renderTemplatesList();
            }
        };
    });
};

const showTemplateEditor = (index = -1) => {
    document.getElementById('add-template-btn').style.display = 'none';
    document.getElementById('template-editor-container').style.display = 'block';
    
    const idInput = document.getElementById('tpl-id');
    const nameInput = document.getElementById('tpl-name');
    const subjectInput = document.getElementById('tpl-subject');
    const ccInput = document.getElementById('tpl-cc');
    const bccInput = document.getElementById('tpl-bcc');

    if (index >= 0) {
        const tpl = templates[index];
        idInput.value = index;
        nameInput.value = tpl.name;
        subjectInput.value = tpl.subject || '';
        ccInput.value = tpl.cc || '';
        bccInput.value = tpl.bcc || '';
        templateQuill.clipboard.dangerouslyPasteHTML(tpl.body || '');
    } else {
        idInput.value = '';
        nameInput.value = '';
        subjectInput.value = '';
        ccInput.value = '';
        bccInput.value = '';
        templateQuill.setText('');
    }
    nameInput.focus();
};

const hideTemplateEditor = () => {
    document.getElementById('add-template-btn').style.display = 'block';
    document.getElementById('template-editor-container').style.display = 'none';
};

const initTemplateActions = () => {
    document.getElementById('add-template-btn').onclick = () => showTemplateEditor();
    document.getElementById('cancel-template').onclick = hideTemplateEditor;
    document.getElementById('save-template').onclick = () => {
        const index = document.getElementById('tpl-id').value;
        const newTpl = {
            name: document.getElementById('tpl-name').value || 'Untitled Template',
            subject: document.getElementById('tpl-subject').value,
            cc: document.getElementById('tpl-cc').value,
            bcc: document.getElementById('tpl-bcc').value,
            body: templateQuill.root.innerHTML
        };

        if (index === '') {
            templates.push(newTpl);
        } else {
            templates[parseInt(index)] = newTpl;
        }

        saveOptions();
        renderTemplatesList();
        hideTemplateEditor();
    };
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
    initTemplateEditor();
    initTemplateActions();
    initButtonGroups();
    restoreOptions();
    updateAuthStatus();
});

