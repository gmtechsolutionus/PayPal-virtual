import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientId, clientSecret, environment } = req.body;

  if (!clientId || !clientSecret || !environment) {
    return res.status(400).json({ 
      valid: false, 
      error: 'Missing credentials' 
    });
  }

  try {
    const baseUrl = environment === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const data = await response.json();

    if (response.ok && data.access_token) {
      return res.status(200).json({ 
        valid: true, 
        message: 'Credentials validated successfully',
        token: data.access_token 
      });
    } else {
      return res.status(200).json({ 
        valid: false, 
        error: data.error_description || 'Invalid credentials' 
      });
    }
  } catch (error: any) {
    return res.status(500).json({ 
      valid: false, 
      error: error.message || 'Validation failed' 
    });
  }
}
