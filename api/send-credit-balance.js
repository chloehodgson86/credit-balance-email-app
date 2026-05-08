import sgMail from '@sendgrid/mail';

const required = ['SENDGRID_API_KEY'];

function money(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Math.abs(n));
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
  <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5;max-width:760px">
    <p>Hi ${customerName},</p>
    <p>Our records show your Paramount Liquor account currently has a credit balance of <strong>${creditAmount}</strong>${customerId ? ` for account <strong>${customerId}</strong>` : ''}.</p>
    ${credits.length ? `
      <p>Please see the credit details below:</p>
      <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;margin:14px 0">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px;text-align:left;border-bottom:1px solid #d1d5db">Date</th>
            <th style="padding:8px;text-align:left;border-bottom:1px solid #d1d5db">Invoice ID</th>
            <th style="padding:8px;text-align:left;border-bottom:1px solid #d1d5db">PO Num</th>
            <th style="padding:8px;text-align:right;border-bottom:1px solid #d1d5db">Credit Amount</th>
          </tr>
        </thead>
        <tbody>${buildCreditRows(credits)}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding:8px;text-align:right"><strong>Total Credit</strong></td>
            <td style="padding:8px;text-align:right"><strong>${creditAmount}</strong></td>
          </tr>
        </tfoot>
      </table>
    ` : ''}
    <p>Please reply to this email confirming whether you would like this credit applied to future invoices, or if you require this to be reviewed further by our Accounts team.</p>
    <p>If this has already been discussed or resolved, please disregard this message.</p>
    <p>Kind regards,<br/>Paramount Liquor Accounts</p>
  </div>`;
}

function buildText(data) {
  const credits = Array.isArray(data.credits) ? data.credits : [];
  const creditLines = credits.map(c => `${c.date || ''} | ${c.invoiceId || ''} | ${c.poNum || ''} | ${money(c.creditAmount)}`).join('\n');
  return `Hi ${data.customerName || 'Customer'},

Our records show your Paramount Liquor account currently has a credit balance of ${money(data.creditAmount)}${data.customerId ? ` for account ${data.customerId}` : ''}.

${creditLines ? `Credit details:\nDate | Invoice ID | PO Num | Credit Amount\n${creditLines}\n\n` : ''}Please reply confirming whether you would like this credit applied to future invoices, or if this requires review by our Accounts team.

Kind regards,
Paramount Liquor Accounts`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  for (const key of required) {
    if (!process.env[key]) return res.status(500).json({ error: `Missing environment variable: ${key}` });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { to, customerName, customerId, creditAmount, credits, subject, previewOnly } = body || {};

    if (!to) return res.status(400).json({ error: 'Missing recipient email' });
    if (creditAmount === undefined || creditAmount === null || Number.isNaN(Number(creditAmount))) {
      return res.status(400).json({ error: 'Missing or invalid credit amount' });
    }

    const safeCredits = Array.isArray(credits) ? credits : [];

    const msg = {
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME || 'Paramount Liquor Accounts'
      },
      replyTo: process.env.SENDGRID_REPLY_TO || process.env.SENDGRID_FROM_EMAIL,
      subject: subject || `Paramount Liquor – Credit Balance – ${customerId || customerName || 'Account'}`,
      customArgs: { app: 'credit-balance-email-app', customerId: String(customerId || '') }
    };

    if (process.env.SENDGRID_CREDIT_TEMPLATE_ID) {
      msg.templateId = process.env.SENDGRID_CREDIT_TEMPLATE_ID;
      msg.dynamicTemplateData = {
        customerName,
        customerId,
        creditAmount: money(creditAmount),
        rawCreditAmount: creditAmount,
        credits: safeCredits.map(c => ({ ...c, creditAmount: money(c.creditAmount) }))
      };
    } else {
      msg.html = buildHtml({ customerName, customerId, creditAmount, credits: safeCredits });
      msg.text = buildText({ customerName, customerId, creditAmount, credits: safeCredits });
    }

    if (previewOnly) return res.status(200).json({ ok: true, message: msg });

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send(msg);
    return res.status(200).json({ ok: true });
  } catch (error) {
const errorBody = await response.text();
throw new Error(`SendGrid failed: ${response.status} ${errorBody}`);
  }
}
