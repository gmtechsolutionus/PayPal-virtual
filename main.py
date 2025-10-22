from flask import Flask, render_template_string, request, jsonify
import requests
import json
import uuid
import time

app = Flask(__name__)

# PayPal Sandbox Config - Replace with your live creds
PAYPAL_CLIENT_ID = 'YOUR_SANDBOX_CLIENT_ID'
PAYPAL_SECRET = 'YOUR_SANDBOX_SECRET'
PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com'  # Use 'https://api-m.paypal.com' for live

# Access Token Fetch
def get_paypal_access_token():
    auth = (PAYPAL_CLIENT_ID, PAYPAL_SECRET)
    response = requests.post(
        f'{PAYPAL_BASE_URL}/v1/oauth2/token',
        auth=auth,
        headers={'Accept': 'application/json'},
        data={'grant_type': 'client_credentials'}
    )
    return response.json().get('access_token')

# Charge Card via REST API
def charge_card(amount, currency='USD', card_number=None, exp_month=None, exp_year=None, cvv=None, first_name='Test', last_name='User'):
    token = get_paypal_access_token()
    # Generate unique request ID for idempotency
    request_id = f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}',
        'PayPal-Request-Id': request_id  # Prevent dupes
    }
    
    # Step 1: Create Order
    order_data = {
        "intent": "CAPTURE",
        "purchase_units": [{
            "amount": {"currency_code": currency, "value": f'{amount:.2f}'},
            "payee": {"email_address": "your-business@example.com"}  # Your PayPal email
        }],
        "payment_source": {
            "card": {
                "number": card_number,
                "expire_month": exp_month,
                "expire_year": exp_year,
                "security_code": cvv,
                "name": {"given_name": first_name, "surname": last_name},
                "billing_address": {
                    "address_line_1": "123 Main St",
                    "admin_area_2": "San Jose",
                    "admin_area_1": "CA",
                    "postal_code": "95131",
                    "country_code": "US"
                }
            }
        }
    }
    
    order_response = requests.post(
        f'{PAYPAL_BASE_URL}/v2/checkout/orders',
        headers=headers,
        data=json.dumps(order_data)
    )
    
    if order_response.status_code == 201:
        order = order_response.json()
        # Step 2: Capture Payment
        capture_data = {"order_id": order['id']}
        capture_response = requests.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders/{order["id"]}/capture',
            headers=headers,
            data=json.dumps(capture_data)
        )
        if capture_response.status_code == 201:
            return capture_response.json()
    return {"error": "Payment failed", "details": order_response.text if 'order' in locals() else "Token fetch failed"}

# Frontend HTML Template
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head><title>PayPal Virtual Terminal</title></head>
<body>
    <h1>Charge Card</h1>
    <form id="chargeForm">
        Amount: <input type="number" step="0.01" id="amount" required><br>
        Card Number: <input type="text" id="card_number" required><br>
        Expiry Month: <input type="number" min="1" max="12" id="exp_month" required><br>
        Expiry Year: <input type="number" min="2025" id="exp_year" required><br>
        CVV: <input type="text" id="cvv" required><br>
        First Name: <input type="text" id="first_name" value="Test"><br>
        Last Name: <input type="text" id="last_name" value="User"><br>
        <button type="button" onclick="charge()">Charge</button>
    </form>
    <div id="result"></div>
    <script>
        function charge() {
            const data = {
                amount: document.getElementById('amount').value,
                card_number: document.getElementById('card_number').value,
                exp_month: parseInt(document.getElementById('exp_month').value),
                exp_year: parseInt(document.getElementById('exp_year').value),
                cvv: document.getElementById('cvv').value,
                first_name: document.getElementById('first_name').value,
                last_name: document.getElementById('last_name').value
            };
            fetch('/charge', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            })
            .then(res => res.json())
            .then(result => {
                document.getElementById('result').innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            });
        }
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/charge', methods=['POST'])
def charge_endpoint():
    data = request.json
    result = charge_card(
        data['amount'],
        card_number=data['card_number'],
        exp_month=data['exp_month'],
        exp_year=data['exp_year'],
        cvv=data['cvv'],
        first_name=data['first_name'],
        last_name=data['last_name']
    )
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
