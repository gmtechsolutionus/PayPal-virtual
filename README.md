# PayPal Virtual Terminal

A modern web application for accepting card payments using PayPal's API.

## Features

- ✅ User-input API credentials (Client ID & Secret)
- ✅ Credential validation
- ✅ Card payment processing
- ✅ Real-time result display
- ✅ Support for Sandbox and Live environments
- ✅ Beautiful, modern UI

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PayPal Developer Account ([https://developer.paypal.com](https://developer.paypal.com))

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## PayPal Setup

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Create an app in the Sandbox (for testing) or Live environment
3. Copy your Client ID and Secret
4. Use these credentials in the application

## Test Cards (Sandbox)

- **Visa**: 4111 1111 1111 1111
- **Mastercard**: 5555 5555 5555 4444
- **Exp**: Any future date
- **CVV**: Any 3 digits

## Deployment

This application is configured for deployment on Vercel.

```bash
vercel --token YOUR_VERCEL_TOKEN
```

## Security Note

Never commit your PayPal credentials to version control. This application allows users to input their credentials at runtime for security.
