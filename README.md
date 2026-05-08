# Credit Balance Email Sender

A small React + Vercel app for sending credit balance emails to customers through SendGrid.

## What it does

- Uploads a CSV export from your ATB/customer data.
- Auto-detects common columns: Customer ID, Customer Name, Email, Balance, Collection Agent and Chain.
- Filters likely credit balance customers where the balance is negative.
- Lets you review, select/clear customers, and identify missing emails.
- Sends selected emails via `/api/send-credit-balance` using SendGrid.
- Supports either built-in HTML wording or a SendGrid Dynamic Template.

## CSV columns it recognises

Recommended columns:

- CustomerID or Customer ID
- CustomerName or Customer Name
- Email
- Balance / Total / Total Amount / Credit Balance
- Collection Agent, optional
- Group Account - Chain, optional

Negative balances are treated as credit balances, for example `-125.50` or `($125.50)`.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add your values to `.env.local`:

```bash
SENDGRID_API_KEY=SG_xxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=accounts@paramountliquor.com.au
SENDGRID_FROM_NAME=Paramount Liquor Accounts
SENDGRID_REPLY_TO=accounts@paramountliquor.com.au
```

## Vercel setup

1. Push this folder to GitHub.
2. Import the repo into Vercel.
3. Add the same environment variables in Vercel Project Settings > Environment Variables.
4. Deploy.

## Optional SendGrid dynamic template

If you want to use a SendGrid Dynamic Template, add:

```bash
SENDGRID_CREDIT_TEMPLATE_ID=d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Suggested dynamic template fields:

- `{{customerName}}`
- `{{customerId}}`
- `{{creditAmount}}`
- `{{rawCreditAmount}}`

If no template ID is provided, the app uses the built-in HTML email.

## Safety notes

- Test with one internal email first.
- Make sure the sending address/domain is authenticated in SendGrid.
- Keep the API key in environment variables only. Do not put it in frontend code.
