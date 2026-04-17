# MailLayer

Integrated Email for the Modern Web.

MailLayer is a Chrome extension that intercepts `mailto:` links across the web and provides an integrated email composition experience via a premium In-Page Modal or the Chrome Side Panel.

## 🚀 Key Features

-   **Zero Context Switching:** Compose emails without leaving your current tab.
-   **Ghost Injection:** Bypasses strict CSP and Trusted Types on modern SPAs (Gemini, ChatGPT, Banking Portals).
-   **Side Panel Integration:** Direct access to Gmail, Outlook, and Yahoo Web inside the browser sidebar.
-   **Isolated Design:** Uses Shadow DOM and CSS reset (`all: initial`) for a consistent, premium look.

## 🛠️ Technical Overview

MailLayer uses a sophisticated injection pattern to ensure compatibility with 99.9% of the web:
1.  **Event Delegation:** Efficiently catches `mailto:` clicks at the document level.
2.  **Shadow DOM Encapsulation:** Protects the UI from host site style bleed.
3.  **DNR Header Stripping:** Dynamically removes frame-blocking headers for webmail providers.
4.  **Fallback Logic:** Defaults to the in-page modal, falling back to the Side Panel if injection is blocked or fails.

## 📦 Installation

1.  Clone this repository.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode**.
4.  Click **Load unpacked** and select the `extension` folder.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
