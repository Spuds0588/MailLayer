# MailLayer

Integrated Email for the Modern Web.

MailLayer is a Chrome extension that intercepts `mailto:` links across the web and provides an integrated email composition experience via a premium In-Page Modal or the Chrome Side Panel. No more context switching or clunky desktop mail clients.

## 🚀 Key Features

-   **Zero Context Switching:** Compose emails without leaving your current tab.
-   **API-Powered Sending:** Direct integration with Gmail and Outlook APIs for fast, reliable sending in the background.
-   **Rich Text Editor:** Fully featured editor (powered by Quill.js) for composing your messages.
-   **File Attachments:** Easily attach files to your outgoing emails directly from the composer.
-   **Email Templates:** Save and apply full templates (Subject, CC, BCC, Body, Attachments) with a single click from the gallery view.
-   **Global Signatures:** Configure a rich-text signature that automatically appends to all outgoing messages.
-   **Side Panel Integration:** Choose between an elegant, shadow-DOM isolated in-page modal, or the native Chrome Side Panel.

## 🛠️ Technical Overview

MailLayer uses a sophisticated injection pattern to ensure compatibility with 99.9% of the web:
1.  **Event Delegation:** Efficiently catches `mailto:` clicks at the document level.
2.  **Shadow DOM Encapsulation:** Protects the modal UI from host site style bleed.
3.  **OAuth Integration:** Uses `chrome.identity` and MSAL for secure API access.
4.  **Fallback Logic:** Defaults to the in-page modal, falling back to the Side Panel if injection is blocked or fails.

## 📦 Installation

1.  Clone this repository.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode**.
4.  Click **Load unpacked** and select the `extension` folder.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
