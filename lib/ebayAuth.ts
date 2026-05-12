'use server';

type TokenCache = {
  token: string;
  expiresAt: number;
};

let cachedToken: TokenCache | null = null;

export async function getEbayToken(): Promise<string> {
  const now = Date.now();
  
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.token;
  }

  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;

  if (!appId || !certId) {
    throw new Error('eBay credentials not configured');
  }

  // Base64 encode AppID:CertID
  const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');

  const response = await fetch(
    'https://api.ebay.com/identity/v1/oauth2/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials' +
        '&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay token fetch failed: ${response.status} ${text}`);
  }

  const json = await response.json() as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    token: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };

  return cachedToken.token;
}