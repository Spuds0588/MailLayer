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
   * Includes To, Subject, and Body.
   */
  static createRawMessage(data) {
    const headers = [
      `To: ${data.to}`,
      `Subject: ${data.subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0'
    ];

    if (data.cc) headers.push(`Cc: ${data.cc}`);
    if (data.bcc) headers.push(`Bcc: ${data.bcc}`);

    const email = [
      ...headers,
      '',
      data.body
    ].join('\r\n');

    // Base64url safe encoding
    return btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

// Global variable for background use
self.GmailService = GmailService;
