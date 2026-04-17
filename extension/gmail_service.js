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
        throw new Error(errData.error.message || 'Failed to send email');
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
   * Supports HTML (Multipart/Alternative).
   */
  static createRawMessage(data) {
    const boundary = '----MailLayerBoundary' + Math.random().toString(16).slice(2);
    
    // Create MIME headers
    const headers = [
      `To: ${data.to}`,
      `Subject: ${data.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`
    ];

    if (data.cc) headers.push(`Cc: ${data.cc}`);
    if (data.bcc) headers.push(`Bcc: ${data.bcc}`);

    // Plain text fallback (strip HTML)
    const plainText = data.body.replace(/<[^>]*>/g, '');

    const email = [
      ...headers,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      plainText,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      data.body,
      '',
      `--${boundary}--`
    ].join('\r\n');

    // Robust Base64url safe encoding (TextEncoder handles UTF-8 correctly)
    const bytes = new TextEncoder().encode(email);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

// Global variable for background use
self.GmailService = GmailService;
