/**
 * Gmail API Service
 * Handles base64 encoding and message sending via Google REST API.
 */
class GmailService {
  static async sendEmail(data) {
    try {
      const token = await this.getAuthToken();
      const rawMessage = this.createRawMessage(data);
      
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: rawMessage
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Failed to send Gmail email (API Error)');
      }

      return await response.json();
    } catch (error) {
      console.error('[MailLayer GmailService] Send Error:', error);
      throw error;
    }
  }

  static getAuthToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
  }

  /**
   * Encodes message into the "Raw" format required by Gmail API.
   * Supports HTML (Multipart/Alternative) and Attachments (Multipart/Mixed).
   */
  static createRawMessage(data) {
    const mainBoundary = '----MailLayerMainBoundary' + Math.random().toString(16).slice(2);
    const bodyBoundary = '----MailLayerBodyBoundary' + Math.random().toString(16).slice(2);
    
    // Create MIME headers
    let headers = [
      `To: ${data.to}`,
      `Subject: ${data.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${mainBoundary}"`
    ];

    if (data.cc) headers.push(`Cc: ${data.cc}`);
    if (data.bcc) headers.push(`Bcc: ${data.bcc}`);

    // Plain text fallback (strip HTML)
    const plainText = data.body.replace(/<[^>]*>/g, '');

    let emailParts = [
      ...headers,
      '',
      `--${mainBoundary}`,
      `Content-Type: multipart/alternative; boundary="${bodyBoundary}"`,
      '',
      `--${bodyBoundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      plainText,
      '',
      `--${bodyBoundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      data.body,
      '',
      `--${bodyBoundary}--`
    ];

    // Add Attachments
    if (data.attachments && data.attachments.length > 0) {
      data.attachments.forEach(att => {
        emailParts.push(`--${mainBoundary}`);
        emailParts.push(`Content-Type: ${att.contentType}; name="${att.name}"`);
        emailParts.push(`Content-Disposition: attachment; filename="${att.name}"`);
        emailParts.push('Content-Transfer-Encoding: base64');
        emailParts.push('');
        emailParts.push(att.content);
      });
    }

    emailParts.push(`--${mainBoundary}--`);

    const email = emailParts.join('\r\n');

    // Robust Base64url safe encoding
    const bytes = new TextEncoder().encode(email);
    // Efficient Base64url safe encoding
    const base64 = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

// Global variable for background use
self.GmailService = GmailService;
