import sgMail from '@sendgrid/mail';

const required = ['SENDGRID_API_KEY'];

function money(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(Math.abs(n));
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildCreditRows(credits = []) {
  return credits.map(credit => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(credit.date || '')}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(credit.invoiceId || '')}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(credit.poNum || '')}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right"><strong>${money(credit.creditAmount)}</strong></td>
    </tr>
  `).join('');
}

function buildHtml(data) {
  const customerName = escapeHtml(data.customerName || 'Customer');
  const customerId = escapeHtml(data.customerId || '');
  const creditAmount = money(data.creditAmount);
  const credits = Array.isArray(data.credits) ? data.credits : [];

  return `
  <div style="
    background:#f3f4f6;
    padding:40px 20px;
    font-family:Arial,sans-serif;
  ">

    <div style="
      max-width:760px;
      margin:0 auto;
      background:#ffffff;
      border-radius:16px;
      overflow:hidden;
      border:1px solid #e5e7eb;
      box-shadow:0 4px 14px rgba(0,0,0,0.06);
    ">

<!-- Header -->
<!-- Header -->
<div style="
  background:#ffffff;
  padding:34px 32px;
  border-bottom:1px solid #e5e7eb;
  text-align:center;
">
  <div style="
    font-size:34px;
    font-weight:800;
    color:#24246b;
    line-height:1;
    letter-spacing:0.5px;
  ">
    PARAMOUNT<br/>LIQUOR
  </div>

  <div style="
    color:#6b7280;
    font-size:13px;
    margin-top:16px;
    letter-spacing:0.3px;
  ">
    Accounts Receivable
  </div>
</div>

<!-- Body -->
      <!-- Body -->
      <div style="
        padding:40px 32px;
        color:#111827;
        line-height:1.7;
      ">

        <p style="
          margin-top:0;
          font-size:15px;
        ">
          Hi ${customerName},
        </p>

        <p style="
          font-size:15px;
        ">
          Our records show your Paramount Liquor account currently has a credit balance of
          <strong style="color:#24246b">${creditAmount}</strong>
          ${customerId ? ` for account <strong>${customerId}</strong>` : ''}.
        </p>

        ${credits.length ? `
          <div style="margin:34px 0">

            <div style="
              background:#24246b;
              color:#ffffff;
              padding:14px 18px;
              font-weight:bold;
              border-radius:10px 10px 0 0;
              font-size:14px;
              letter-spacing:0.3px;
            ">
              CREDIT BREAKDOWN
            </div>

            <table style="
              border-collapse:collapse;
              width:100%;
              font-size:14px;
              border:1px solid #e5e7eb;
            ">

              <thead>
                <tr style="background:#f9fafb">
                  <th style="
                    padding:14px;
                    text-align:left;
                    border-bottom:1px solid #e5e7eb;
                    color:#374151;
                  ">
                    Date
                  </th>

                  <th style="
                    padding:14px;
                    text-align:left;
                    border-bottom:1px solid #e5e7eb;
                    color:#374151;
                  ">
                    Invoice ID
                  </th>

                  <th style="
                    padding:14px;
                    text-align:left;
                    border-bottom:1px solid #e5e7eb;
                    color:#374151;
                  ">
                    PO Num
                  </th>

                  <th style="
                    padding:14px;
                    text-align:right;
                    border-bottom:1px solid #e5e7eb;
                    color:#374151;
                  ">
                    Credit Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                ${buildCreditRows(credits)}
              </tbody>

              <tfoot>
                <tr style="background:#f9fafb">

                  <td colspan="3" style="
                    padding:16px;
                    text-align:right;
                    font-weight:bold;
                    border-top:2px solid #d1d5db;
                    color:#111827;
                  ">
                    Total Credit
                  </td>

                  <td style="
                    padding:16px;
                    text-align:right;
                    font-weight:bold;
                    border-top:2px solid #d1d5db;
                    color:#24246b;
                    font-size:15px;
                  ">
                    ${creditAmount}
                  </td>

                </tr>
              </tfoot>

            </table>

          </div>
        ` : ''}

        <div style="
          background:#f9fafb;
          border-left:4px solid #24246b;
          padding:18px 20px;
          margin:34px 0;
          border-radius:6px;
          font-size:14px;
          color:#374151;
        ">
          Please reply to this email confirming whether you would like this credit applied to future invoices, or if you require this to be reviewed further by our Accounts team.
        </div>

        <p style="
          font-size:14px;
          color:#4b5563;
        ">
          If this has already been discussed or resolved, please disregard this message.
        </p>

        <p style="
          margin-top:38px;
          font-size:15px;
        ">
          Kind regards,<br/>
          <strong style="color:#24246b">
            Paramount Liquor Accounts
          </strong>
        </p>

      </div>

      <!-- Footer -->
      <div style="
        background:#24246b;
        color:#d1d5db;
        padding:24px 32px;
        font-size:12px;
        line-height:1.6;
        text-align:center;
      ">

        <div style="
          font-weight:bold;
          color:#ffffff;
          margin-bottom:4px;
          letter-spacing:0.4px;
        ">
          PARAMOUNT LIQUOR
        </div>

        Accounts Receivable Team

      </div>

    </div>

  </div>
  `;
}
function buildText(data) {
  const credits = Array.isArray(data.credits) ? data.credits : [];
  const creditLines = credits
    .map(c => `${c.date || ''} | ${c.invoiceId || ''} | ${c.poNum || ''} | ${money(c.creditAmount)}`)
    .join('\n');

  return `Hi ${data.customerName || 'Customer'},

Our records show your Paramount Liquor account currently has a credit balance of ${money(data.creditAmount)}${data.customerId ? ` for account ${data.customerId}` : ''}.

${creditLines ? `Credit details:\nDate | Invoice ID | PO Num | Credit Amount\n${creditLines}\n\n` : ''}Please reply confirming whether you would like this credit applied to future invoices, or if this requires review by our Accounts team.

Kind regards,
Paramount Liquor Accounts`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  for (const key of required) {
    if (!process.env[key]) {
      return res.status(500).json({ error: `Missing environment variable: ${key}` });
    }
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const {
      to,
      customerName,
      customerId,
      creditAmount,
      credits,
      subject,
      previewOnly
    } = body || {};

    if (!to) {
      return res.status(400).json({ error: 'Missing recipient email' });
    }

    if (
      creditAmount === undefined ||
      creditAmount === null ||
      Number.isNaN(Number(creditAmount))
    ) {
      return res.status(400).json({ error: 'Missing or invalid credit amount' });
    }

    const safeCredits = Array.isArray(credits) ? credits : [];

    const msg = {
      to,
      from: {
email: 'accounts@paramountliquor.com.au',
        name: process.env.SENDGRID_FROM_NAME || 'Paramount Liquor Accounts'
      },
email: 'accounts@paramountliquor.com.au',
      subject: subject || `Paramount Liquor – Credit Balance – ${customerId || customerName || 'Account'}`,
      customArgs: {
        app: 'credit-balance-email-app',
        customerId: String(customerId || '')
      }
    };

if (process.env.SENDGRID_CREDIT_TEMPLATE_ID) {
  msg.templateId = process.env.SENDGRID_CREDIT_TEMPLATE_ID;
  msg.dynamicTemplateData = {
        customerName,
        customerId,
        creditAmount: money(creditAmount),
        rawCreditAmount: creditAmount,
        credits: safeCredits.map(c => ({
          ...c,
          creditAmount: money(c.creditAmount)
        }))
      };
    } else {
      msg.html = buildHtml({
        customerName,
        customerId,
        creditAmount,
        credits: safeCredits
      });

      msg.text = buildText({
        customerName,
        customerId,
        creditAmount,
        credits: safeCredits
      });
    }

    if (previewOnly) {
      return res.status(200).json({ ok: true, message: msg });
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send(msg);

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('SendGrid error:', error);

    const sendGridMessage =
      error?.response?.body?.errors?.map(e => e.message).join(' | ') ||
      error?.response?.body?.message ||
      error?.message ||
      'Unknown SendGrid error';

    const statusCode = error?.code || error?.response?.statusCode || 500;

    return res.status(500).json({
      error: `SendGrid failed: ${statusCode} - ${sendGridMessage}`
    });
  }
}
