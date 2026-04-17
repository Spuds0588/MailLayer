/**
 * Outlook (MS Graph) API Service
 * Handles OAuth2 via launchWebAuthFlow and message sending via Graph API.
 */
class OutlookService {
  static CLIENT_ID = (typeof MailLayerConfig !== 'undefined') ? MailLayerConfig.OUTLOOK_CLIENT_ID : '';
  static SCOPES = ['https://graph.microsoft.com/mail.send', 'https://graph.microsoft.com/user.read'];

  static async sendEmail(data) {
    try {
      const res = await chrome.storage.local.get(['outlook_token']);
      const token = res.outlook_token;
      
      if (!token) throw new Error('Outlook not connected. Please connect in settings.');
      
      const emailContent = {
        message: {
          subject: data.subject,
          body: {
            contentType: 'Text',
            content: data.body
          },
          toRecipients: [
            { emailAddress: { address: data.to } }
          ],
          ccRecipients: data.cc ? [{ emailAddress: { address: data.cc } }] : [],
          bccRecipients: data.bcc ? [{ emailAddress: { address: data.bcc } }] : []
        }
      };

      const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailContent)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Failed to send Outlook email');
      }

      return true;
    } catch (error) {
      console.error('[MailLayer OutlookService] Send Error:', error);
      throw error;
    }
  }

  static getAccessToken() {
    return new Promise((resolve, reject) => {
      const redirectUri = chrome.identity.getRedirectURL();
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
                      `client_id=${this.CLIENT_ID}&` +
                      `response_type=token&` +
                      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                      `scope=${encodeURIComponent(this.SCOPES.join(' '))}&` +
                      `response_mode=fragment`;

      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(chrome.runtime.lastError || new Error('Auth failed'));
          return;
        }

        const url = new URL(responseUrl.replace('#', '?'));
        const token = url.searchParams.get('access_token');
        if (token) {
          resolve(token);
        } else {
          reject(new Error('No token in response'));
        }
      });
    });
  }
}

self.OutlookService = OutlookService;
