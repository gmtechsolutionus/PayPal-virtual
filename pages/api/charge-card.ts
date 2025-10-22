import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    clientId, 
    clientSecret, 
    environment,
    amount,
    currency,
    cardNumber,
    expMonth,
    expYear,
    cvv,
    firstName,
    lastName,
    addressLine1,
    city,
    state,
    postalCode,
    countryCode
  } = req.body;

  if (!clientId || !clientSecret || !environment || !amount || !cardNumber || !expMonth || !expYear || !cvv) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required fields' 
    });
  }

  try {
    const baseUrl = environment === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';

    // Step 1: Get Access Token
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(200).json({ 
        success: false,
        error: 'Authentication failed',
        details: tokenData
      });
    }

    // Step 2: Create Order with Card Details
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency || 'USD',
          value: parseFloat(amount).toFixed(2)
        }
      }],
      payment_source: {
        card: {
          number: cardNumber.replace(/\s/g, ''),
          expiry: `${expYear}-${String(expMonth).padStart(2, '0')}`,
          security_code: cvv,
          name: `${firstName || 'John'} ${lastName || 'Doe'}`,
          billing_address: {
            address_line_1: addressLine1 || '123 Main St',
            admin_area_2: city || 'San Jose',
            admin_area_1: state || 'CA',
            postal_code: postalCode || '95131',
            country_code: countryCode || 'US'
          }
        }
      }
    };

    // Generate unique request ID for idempotency
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
        'PayPal-Request-Id': requestId,
      },
      body: JSON.stringify(orderData),
    });

    const orderResult = await orderResponse.json();

    if (!orderResponse.ok) {
      return res.status(200).json({ 
        success: false,
        error: 'Order creation failed',
        details: orderResult
      });
    }

    // Step 3: Capture Payment
    const captureResponse = await fetch(
      `${baseUrl}/v2/checkout/orders/${orderResult.id}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const captureResult = await captureResponse.json();

    if (captureResponse.ok && captureResult.status === 'COMPLETED') {
      return res.status(200).json({ 
        success: true,
        message: 'Payment captured successfully',
        orderId: captureResult.id,
        status: captureResult.status,
        details: captureResult
      });
    } else {
      return res.status(200).json({ 
        success: false,
        error: 'Payment capture failed',
        details: captureResult
      });
    }
  } catch (error: any) {
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Payment processing failed',
      details: error
    });
  }
}
