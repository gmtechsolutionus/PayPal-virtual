import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';

type PayPalResponse = {
  response: Response;
  result: any;
};

const parseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
};

const extractIssueCodes = (details: any): string[] => {
  if (!Array.isArray(details)) {
    return [];
  }

  return details
    .map((detail) => (typeof detail?.issue === 'string' ? detail.issue : undefined))
    .filter((issue): issue is string => Boolean(issue));
};

const findFirstCapture = (order: any) => {
  const purchaseUnits = Array.isArray(order?.purchase_units) ? order.purchase_units : [];

  for (const unit of purchaseUnits) {
    const captures = Array.isArray(unit?.payments?.captures) ? unit.payments.captures : [];

    if (captures.length > 0) {
      return captures[0];
    }
  }

  return undefined;
};

const buildSuccessPayload = (order: any, capture?: any) => {
  const captureDetails = capture ?? findFirstCapture(order);

  return {
    success: true,
    message: 'Payment captured successfully',
    orderId: order?.id,
    captureId: captureDetails?.id,
    status: captureDetails?.status ?? order?.status,
    details: captureDetails ?? order
  };
};

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

  const toOptionalString = (value: unknown): string | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }

    const stringValue = String(value).trim();
    return stringValue.length > 0 ? stringValue : undefined;
  };

  const normalizedAmountInput = toOptionalString(amount);
  const normalizedAmount = normalizedAmountInput
    ? Number.parseFloat(normalizedAmountInput)
    : Number.NaN;
  const sanitizedCardNumber = toOptionalString(cardNumber)?.replace(/\s+/g, '');
  const sanitizedExpMonthInput = toOptionalString(expMonth);
  const sanitizedExpYearInput = toOptionalString(expYear);
  const sanitizedCvv = toOptionalString(cvv);
  const normalizedCardNumber = sanitizedCardNumber
    ? sanitizedCardNumber.replace(/\D/g, '')
    : undefined;
  const normalizedExpMonth = sanitizedExpMonthInput
    ? sanitizedExpMonthInput.replace(/\D/g, '')
    : undefined;
  const normalizedExpYear = sanitizedExpYearInput
    ? sanitizedExpYearInput.replace(/\D/g, '')
    : undefined;
  const normalizedCvv = sanitizedCvv ? sanitizedCvv.replace(/\D/g, '') : undefined;
  const normalizedExpMonthNumber = normalizedExpMonth
    ? Number.parseInt(normalizedExpMonth, 10)
    : Number.NaN;
  const isValidExpYearLength = normalizedExpYear
    ? normalizedExpYear.length === 2 || normalizedExpYear.length === 4
    : false;
  const isValidCvvLength = normalizedCvv
    ? normalizedCvv.length >= 3 && normalizedCvv.length <= 4
    : false;
  const isValidCardNumberLength = normalizedCardNumber
    ? normalizedCardNumber.length >= 12 && normalizedCardNumber.length <= 19
    : false;

  if (
    !clientId ||
    !clientSecret ||
    !environment ||
    !normalizedAmountInput ||
    !normalizedCardNumber ||
    !normalizedExpMonth ||
    !normalizedExpYear ||
    !normalizedCvv ||
    Number.isNaN(normalizedAmount) ||
    normalizedAmount <= 0 ||
    Number.isNaN(normalizedExpMonthNumber) ||
    normalizedExpMonthNumber < 1 ||
    normalizedExpMonthNumber > 12 ||
    !isValidExpYearLength ||
    !isValidCvvLength ||
    !isValidCardNumberLength
  ) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields or invalid payment details'
    });
  }

  try {
    const baseUrl = environment === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

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

    const tokenData = await parseJson(tokenResponse);

    if (!tokenResponse.ok || !tokenData?.access_token) {
      return res.status(tokenResponse.status || 502).json({
        success: false,
        error: 'Authentication failed',
        details: tokenData
      });
    }

    const paddedExpMonth = normalizedExpMonth.padStart(2, '0');
    const expandedExpYear = normalizedExpYear.length === 2
      ? `20${normalizedExpYear}`
      : normalizedExpYear.padStart(4, '0');

    const cardPayload: Record<string, unknown> = {
      number: normalizedCardNumber,
      expiry: `${expandedExpYear}-${paddedExpMonth}`,
      security_code: normalizedCvv
    };

    if (firstName || lastName) {
      const normalizedFirstName = toOptionalString(firstName);
      const normalizedLastName = toOptionalString(lastName);
      const fullName = [normalizedFirstName, normalizedLastName]
        .filter((value): value is string => Boolean(value))
        .join(' ');

      if (fullName) {
        cardPayload.name = fullName;
      }
    }

    const billingAddressEntries: [string, string | undefined][] = [
      ['address_line_1', toOptionalString(addressLine1)],
      ['admin_area_2', toOptionalString(city)],
      ['admin_area_1', toOptionalString(state)],
      ['postal_code', toOptionalString(postalCode)],
      ['country_code', toOptionalString(countryCode)?.toUpperCase()]
    ];

    const billingAddress = Object.fromEntries(
      billingAddressEntries.filter(([, value]) => Boolean(value)) as [string, string][]
    );

    if (Object.keys(billingAddress).length > 0) {
      cardPayload.billing_address = billingAddress;
    }

    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: String(currency || 'USD').toUpperCase(),
          value: normalizedAmount.toFixed(2)
        }
      }],
      payment_source: {
        card: cardPayload
      }
    };

    const accessToken = tokenData.access_token as string;

    const createOrder = async (): Promise<PayPalResponse> => {
      const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': randomUUID().replace(/-/g, ''),
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(orderData)
      });

      return {
        response,
        result: await parseJson(response)
      };
    };

    const getOrder = async (orderId: string): Promise<PayPalResponse> => {
      const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'return=representation'
        }
      });

      return {
        response,
        result: await parseJson(response)
      };
    };

    const captureOrder = async (orderId: string, idempotencyKey: string): Promise<PayPalResponse> => {
      const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': idempotencyKey,
          'Prefer': 'return=representation'
        }
      });

      return {
        response,
        result: await parseJson(response)
      };
    };

    const orderCreation = await createOrder();

    if (!orderCreation.response.ok || !orderCreation.result?.id) {
      return res.status(orderCreation.response.status || 502).json({
        success: false,
        error: 'Order creation failed',
        details: orderCreation.result
      });
    }

    const orderId: string = orderCreation.result.id;
    const initialStatus: string | undefined = orderCreation.result.status;

    if (initialStatus === 'COMPLETED') {
      return res.status(200).json(buildSuccessPayload(orderCreation.result));
    }

    const preCaptureSnapshot = await getOrder(orderId);

    if (preCaptureSnapshot.response.ok && preCaptureSnapshot.result?.status === 'COMPLETED') {
      return res.status(200).json(buildSuccessPayload(preCaptureSnapshot.result));
    }

    const captureIdempotencyKey = randomUUID().replace(/-/g, '');
    const captureAttempt = await captureOrder(orderId, captureIdempotencyKey);

    if (captureAttempt.response.ok && captureAttempt.result?.status === 'COMPLETED') {
      return res.status(200).json(buildSuccessPayload(captureAttempt.result));
    }

    const captureIssues = extractIssueCodes(captureAttempt.result?.details);

    if (captureIssues.includes('ORDER_ALREADY_CAPTURED')) {
      const postCaptureSnapshot = await getOrder(orderId);

      if (postCaptureSnapshot.response.ok && postCaptureSnapshot.result?.status === 'COMPLETED') {
        return res.status(200).json(buildSuccessPayload(postCaptureSnapshot.result));
      }
    }

    const failureStatus = captureAttempt.response.status >= 400
      ? captureAttempt.response.status
      : 502;

    return res.status(failureStatus).json({
      success: false,
      error: 'Payment capture failed',
      details: captureAttempt.result,
      attempts: {
        order: orderCreation.result,
        capture: captureAttempt.result
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Payment processing failed',
      details: error
    });
  }
}
