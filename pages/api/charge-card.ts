import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';

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

    let tokenData: any = null;
    try {
      tokenData = await tokenResponse.json();
    } catch (_error) {
      tokenData = null;
    }

    if (!tokenResponse.ok || !tokenData?.access_token) {
      return res.status(tokenResponse.status || 502).json({
        success: false,
        error: 'Authentication failed',
        details: tokenData
      });
    }

    // Step 2: Create Order with Card Details
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

    type FetchOutcome = {
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

    const createOrder = async (): Promise<FetchOutcome> => {
      const requestId = randomUUID().replace(/-/g, '');

      const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`,
          'PayPal-Request-Id': requestId,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(orderData),
      });

      return {
        response,
        result: await parseJson(response)
      };
    };

    const captureOrder = async (orderId: string): Promise<FetchOutcome> => {
      const response = await fetch(
        `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${tokenData.access_token}`,
            'PayPal-Request-Id': randomUUID().replace(/-/g, ''),
            'Prefer': 'return=representation'
          },
        }
      );

      return {
        response,
        result: await parseJson(response)
      };
    };

    type PaymentAttempt =
      | { success: true; order: FetchOutcome; capture: FetchOutcome }
      | { success: false; stage: 'order'; order: FetchOutcome }
      | { success: false; stage: 'capture'; order: FetchOutcome; capture: FetchOutcome };

    const executePaymentAttempt = async (): Promise<PaymentAttempt> => {
      const order = await createOrder();

      if (!order.response.ok || !order.result?.id) {
        return {
          success: false,
          stage: 'order',
          order
        };
      }

      const capture = await captureOrder(order.result.id);

      if (capture.response.ok && capture.result?.status === 'COMPLETED') {
        return {
          success: true,
          order,
          capture
        };
      }

      return {
        success: false,
        stage: 'capture',
        order,
        capture
      };
    };

    const sendSuccessResponse = (attempt: Extract<PaymentAttempt, { success: true }>) => {
      const captureDetails = attempt.capture.result;
      return res.status(200).json({
        success: true,
        message: 'Payment captured successfully',
        orderId: attempt.order.result.id,
        captureId: captureDetails?.id,
        status: captureDetails?.status,
        details: captureDetails
      });
    };

    const firstAttempt = await executePaymentAttempt();

    if (firstAttempt.success) {
      return sendSuccessResponse(firstAttempt);
    }

    if (firstAttempt.stage === 'order') {
      const statusCode = firstAttempt.order.response.status || 502;
      return res.status(statusCode).json({
        success: false,
        error: 'Order creation failed',
        details: firstAttempt.order.result
      });
    }

    const extractIssueCodes = (details: any): string[] => {
      if (!Array.isArray(details)) {
        return [];
      }

      return details
        .map((detail) => (typeof detail?.issue === 'string' ? detail.issue : undefined))
        .filter((issue): issue is string => Boolean(issue));
    };

    const initialCaptureIssues = extractIssueCodes(firstAttempt.capture.result?.details);

    if (initialCaptureIssues.includes('ORDER_ALREADY_CAPTURED')) {
      const retryAttempt = await executePaymentAttempt();

      if (retryAttempt.success) {
        return sendSuccessResponse(retryAttempt);
      }

      if (retryAttempt.stage === 'order') {
        const statusCode = retryAttempt.order.response.status || 502;
        return res.status(statusCode).json({
          success: false,
          error: 'Order creation failed',
          details: retryAttempt.order.result,
          attempts: {
            initialCapture: firstAttempt.capture.result
          }
        });
      }

      const retryFailureStatus = retryAttempt.capture.response.status >= 400
        ? retryAttempt.capture.response.status
        : 502;

      return res.status(retryFailureStatus).json({
        success: false,
        error: 'Payment capture failed',
        details: retryAttempt.capture.result,
        attempts: {
          initialCapture: firstAttempt.capture.result,
          retryCapture: retryAttempt.capture.result
        }
      });
    }

    const failureStatus = firstAttempt.capture.response.status >= 400
      ? firstAttempt.capture.response.status
      : 502;

    return res.status(failureStatus).json({
      success: false,
      error: 'Payment capture failed',
      details: firstAttempt.capture.result
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Payment processing failed',
      details: error
    });
  }
}
