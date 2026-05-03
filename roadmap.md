# MailLayer: Future Roadmap & Monetization

This file is private and ignored by version control. It tracks sensitive future features and business logic.

## Planned Pro Features (Paid)
- [ ] **Enterprise Connectors:**
    - Zoho Mail API Support.
    - Salesforce/HubSpot BCC integration.
- [ ] **Advanced Templates:**
    - Liquid-based template engine for personalized cold outreach.
    - Shared template library for teams.
- [ ] **Analytics & Tracking:**
    - Open tracking (pixel based).
    - Link clicking tracking (redirect based).
    - *Requires backend proxy server.*

## Upcoming Improvements (MVP+)
- [ ] **Jodit integration:** Transition from simple textareas to a full WYSIWYG experience.
- [ ] **Drag & Drop Attachments:** Handle file uploads via API.
- [ ] **Signature Management:** Multiple signatures based on sender profile.

## Image Support Strategy
- pasted images will be converted to Base64 in Jodit.
- Implementation will use Multipart MIME for Gmail and the Attachments collection for MS Graph.
