import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [environment, setEnvironment] = useState('sandbox');
  const [isValidated, setIsValidated] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [countryCode, setCountryCode] = useState('US');

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationMessage('');
    setResult(null);

    try {
      const response = await fetch('/api/validate-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret, environment }),
      });

      const data = await response.json();

      if (data.valid) {
        setIsValidated(true);
        setValidationMessage('✓ Credentials validated successfully!');
      } else {
        setIsValidated(false);
        setValidationMessage(`✗ ${data.error || 'Validation failed'}`);
      }
    } catch (error: any) {
      setIsValidated(false);
      setValidationMessage(`✗ Error: ${error.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setResult(null);

    try {
      const response = await fetch('/api/charge-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          countryCode,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ success: false, error: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Head>
        <title>PayPal Virtual Terminal</title>
        <meta name="description" content="PayPal Virtual Terminal for card payments" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>💳 PayPal Virtual Terminal</h1>
          <p style={styles.subtitle}>Accept card payments using PayPal API</p>

          {/* API Credentials Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>API Credentials</h2>
            <div style={styles.formGroup}>
              <label style={styles.label}>Environment</label>
              <select
                value={environment}
                onChange={(e) => {
                  setEnvironment(e.target.value);
                  setIsValidated(false);
                  setValidationMessage('');
                }}
                style={styles.select}
              >
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="live">Live (Production)</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setIsValidated(false);
                  setValidationMessage('');
                }}
                placeholder="Enter your PayPal Client ID"
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Client Secret</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => {
                  setClientSecret(e.target.value);
                  setIsValidated(false);
                  setValidationMessage('');
                }}
                placeholder="Enter your PayPal Client Secret"
                style={styles.input}
              />
            </div>

            <button
              onClick={handleValidate}
              disabled={isValidating || !clientId || !clientSecret}
              style={{
                ...styles.button,
                ...styles.validateButton,
                ...(isValidating || !clientId || !clientSecret ? styles.buttonDisabled : {}),
              }}
            >
              {isValidating ? 'Validating...' : 'Validate Credentials'}
            </button>

            {validationMessage && (
              <div
                style={{
                  ...styles.message,
                  ...(isValidated ? styles.successMessage : styles.errorMessage),
                }}
              >
                {validationMessage}
              </div>
            )}
          </div>

          {/* Payment Form Section */}
          {isValidated && (
            <form onSubmit={handleCharge} style={styles.section}>
              <h2 style={styles.sectionTitle}>Payment Details</h2>

              <div style={styles.row}>
                <div style={{ ...styles.formGroup, flex: 2 }}>
                  <label style={styles.label}>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100.00"
                    required
                    style={styles.input}
                  />
                </div>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    style={styles.select}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Card Number</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4111 1111 1111 1111"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Exp Month</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={expMonth}
                    onChange={(e) => setExpMonth(e.target.value)}
                    placeholder="12"
                    required
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Exp Year</label>
                  <input
                    type="number"
                    min="2025"
                    value={expYear}
                    onChange={(e) => setExpYear(e.target.value)}
                    placeholder="2025"
                    required
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>CVV</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    placeholder="123"
                    required
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    style={styles.input}
                  />
                </div>
              </div>

              <h3 style={styles.subsectionTitle}>Billing Address (Optional)</h3>

              <div style={styles.formGroup}>
                <label style={styles.label}>Address Line 1</label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="123 Main St"
                  style={styles.input}
                />
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="San Jose"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="CA"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="95131"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Country Code</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                    placeholder="US"
                    style={styles.input}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                style={{
                  ...styles.button,
                  ...styles.chargeButton,
                  ...(isProcessing ? styles.buttonDisabled : {}),
                }}
              >
                {isProcessing ? 'Processing...' : '💰 Charge Card'}
              </button>
            </form>
          )}

          {/* Result Section */}
          {result && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Result</h2>
              <div
                style={{
                  ...styles.resultBox,
                  ...(result.success ? styles.successBox : styles.errorBox),
                }}
              >
                <pre style={styles.resultPre}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Test Card Info */}
          <div style={styles.testInfo}>
            <h3 style={styles.subsectionTitle}>🧪 Test Cards (Sandbox)</h3>
            <p style={styles.testInfoText}>
              <strong>Visa:</strong> 4111 1111 1111 1111<br />
              <strong>Mastercard:</strong> 5555 5555 5555 4444<br />
              <strong>Exp:</strong> Any future date | <strong>CVV:</strong> Any 3 digits
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    maxWidth: '800px',
    margin: '0 auto',
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  title: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: '10px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '16px',
    color: '#718096',
    textAlign: 'center',
    marginBottom: '40px',
  },
  section: {
    marginBottom: '40px',
    paddingBottom: '40px',
    borderBottom: '2px solid #e2e8f0',
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '20px',
  },
  subsectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#4a5568',
    marginTop: '20px',
    marginBottom: '15px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.3s',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    outline: 'none',
    backgroundColor: 'white',
    boxSizing: 'border-box',
  },
  row: {
    display: 'flex',
    gap: '15px',
  },
  button: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s',
  },
  validateButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
  },
  chargeButton: {
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: 'white',
    marginTop: '20px',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  message: {
    marginTop: '15px',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
  },
  successMessage: {
    background: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb',
  },
  errorMessage: {
    background: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb',
  },
  resultBox: {
    padding: '20px',
    borderRadius: '8px',
    maxHeight: '400px',
    overflow: 'auto',
  },
  successBox: {
    background: '#d4edda',
    border: '2px solid #28a745',
  },
  errorBox: {
    background: '#f8d7da',
    border: '2px solid #dc3545',
  },
  resultPre: {
    margin: 0,
    fontSize: '13px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  },
  testInfo: {
    background: '#f7fafc',
    padding: '20px',
    borderRadius: '8px',
    marginTop: '20px',
  },
  testInfoText: {
    fontSize: '14px',
    color: '#4a5568',
    lineHeight: '1.8',
    margin: '10px 0 0 0',
  },
};
