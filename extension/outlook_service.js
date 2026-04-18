/**
 * Outlook (MS Graph) API Service
 * Handles OAuth2 via launchWebAuthFlow and message sending via Graph API.
 */
class OutlookService {
  static CLIENT_ID = (typeof MailLayerConfig !== 'undefined') ? MailLayerConfig.OUTLOOK_CLIENT_ID : '';
  static SCOPES = ['https://graph.microsoft.com/mail.send'];

  static async sendEmail(data) {
    try {
      const res = await chrome.storage.local.get(['outlook_token']);
      const token = res.outlook_token;
      
      if (!token) throw new Error('Outlook not connected. Please connect in settings.');
      
      const emailContent = {
        message: {
          subject: data.subject,
          body: {
            contentType: 'HTML',
            content: data.body
          },
          toRecipients: [
            { emailAddress: { address: data.to } }
          ],
          ccRecipients: data.cc ? data.cc.split(',').map(e => ({ emailAddress: { address: e.trim() } })) : [],
          bccRecipients: data.bcc ? data.bcc.split(',').map(e => ({ emailAddress: { address: e.trim() } })) : [],
          attachments: (data.attachments || []).map(att => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: att.name,
            contentType: att.contentType,
            contentBytes: att.content
          }))
        }
      };

      const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...emailContent,
          saveToSentItems: true
        })
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
      // Use a simpler auth URL without nonce if possible, or ensure it's handled
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${this.CLIENT_ID}&` +
        `response_type=token&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(this.SCOPES.join(' '))}`;

      console.log('[MailLayer OutlookService] Launching Auth Flow...', authUrl);

      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (responseUrl) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        
        if (!responseUrl) {
          return reject(new Error('No response URL from Microsoft'));
        }

        // More robust token extraction from fragment
        const fragment = responseUrl.split('#')[1];
        if (!fragment) return reject(new Error('No fragment in response URL'));

        const params = new URLSearchParams(fragment);
        const token = params.get('access_token');
        
        if (token) {
          console.log('[MailLayer OutlookService] Token acquired successfully.');
          resolve(token);
        } else {
          const error = params.get('error_description') || params.get('error') || 'Access token not found';
          reject(new Error(error));
        }
      });
    });
  }
}

self.OutlookService = OutlookService;
