import sgMail from '@sendgrid/mail';

const required = ['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL'];

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

function buildHtml(data) {
  const customerName = escapeHtml(data.customerName || 'Customer');
  const customerId = escapeHtml(data.customerId || '');
  const creditAmount = money(data.creditAmount);
  return `
  <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5;max-width:680px">
    <p>Hi ${customerName},</p>
    <p>Our records show your Paramount Liquor account currently has a credit balance of <strong>${creditAmount}</strong>${customerId ? ` for account <strong>${customerId}</strong>` : ''}.</p>
    <p>Please reply to this email confirming whether you would like this credit applied to future invoices, or if you require this to be reviewed further by our Accounts team.</p>
    <p>If this has already been discussed or resolved, please disregard this message.</p>
    <p>Kind regards,<br/>Paramount Liquor Accounts</p>
  </div>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  for (const key of required) {
    if (!process.env[key]) return res.status(500).json({ error: `Missing environment variable: ${key}` });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { to, customerName, customerId, creditAmount, subject, previewOnly } = body || {};

    if (!to) return res.status(400).json({ error: 'Missing recipient email' });
    if (creditAmount === undefined || creditAmount === null || Number.isNaN(Number(creditAmount))) {
      return res.status(400).json({ error: 'Missing or invalid credit amount' });
    }

    const msg = {
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME || 'Paramount Liquor Accounts'
      },
      replyTo: process.env.SENDGRID_REPLY_TO || process.env.SENDGRID_FROM_EMAIL,
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
        rawCreditAmount: creditAmount
      };
    } else {
      msg.html = buildHtml({ customerName, customerId, creditAmount });
      msg.text = `Hi ${customerName || 'Customer'},\n\nOur records show your Paramount Liquor account currently has a credit balance of ${money(creditAmount)}${customerId ? ` for account ${customerId}` : ''}.\n\nPlease reply confirming whether you would like this credit applied to future invoices, or if this requires review by our Accounts team.\n\nKind regards,\nParamount Liquor Accounts`;
    }

    if (previewOnly) return res.status(200).json({ ok: true, message: msg });

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send(msg);
    return res.status(200).json({ ok: true });
  } catch (error) {
    const detail = error?.response?.body || error.message;
    return res.status(500).json({ error: 'SendGrid send failed', detail });
  }
}
