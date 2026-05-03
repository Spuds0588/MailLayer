# MailLayer

Integrated Email for the Modern Web.

MailLayer is a Chrome extension that creates a **universal email layer** over your entire web experience. It intercepts `mailto:` links and auto-detects plain-text email addresses, providing an integrated composition experience via an In-Page Modal or the Chrome Side Panel. No more context switching or clunky desktop mail clients.

## 🔗 Links

- [Home Page](https://spuds0588.github.io/MailLayer/index.html)
- [Privacy Policy](https://spuds0588.github.io/MailLayer/privacy.html)
- [Terms of Service](https://spuds0588.github.io/MailLayer/terms.html)
- [Chrome Web Store](https://chrome.google.com/webstore/detail/cdkbfdlipmopkdfjbceadindobfpajma)

## 🚀 Key Features

-   **Zero Context Switching:** Click an email, send your message, and stay exactly where you are.
-   **Universal Email Detection:** Automatically transforms plain-text email addresses on any webpage into clickable links.
-   **Smart Mailto Interception:** Stops disruptive browser redirects and clunky desktop app launches.
-   **API-Powered Sending:** Secure integration with Gmail and Outlook APIs for background sending.
-   **Keyboard Optimized:** Use `Ctrl+Enter` (or `Cmd+Enter`) to send instantly and `Esc` to discard.
-   **Rich Text Editor:** Fully featured WYSIWYG editor (Quill.js) for professional formatting.
-   **Email Templates:** Save and apply full templates (Subject, CC, BCC, Body) with a single click.
-   **Global Signatures:** Automated rich-text signatures appended to every outgoing message.
-   **Site Exclusion:** Easily blocklist specific domains where you want to disable auto-detection.
-   **Flexible UI:** Choose between a shadow-DOM isolated in-page modal or the native Chrome Side Panel.

## 🛠️ Technical Overview

MailLayer uses a sophisticated injection pattern to ensure a seamless experience:
1.  **Event Delegation:** Efficiently catches all email interactions at the document level.
2.  **Shadow DOM Encapsulation:** Protects the modal UI from host site style bleed.
3.  **OAuth Integration:** Uses `chrome.identity` and MSAL for secure, direct API access.
4.  **Auto-Detect Engine:** Scans and linkifies text-based email addresses without affecting page performance.
5.  **Exclusion Logic:** Respects per-site user preferences to resolve DOM conflicts.

## 📦 Installation

1.  Clone this repository.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode**.
4.  Click **Load unpacked** and select the `extension` folder.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
