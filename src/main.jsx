import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Papa from 'papaparse';
import './styles.css';

const aliases = {
  customerId: ['customerid', 'customer id', 'ar account id', 'account id', 'id'],
  customerName: ['customername', 'customer name', 'name', 'account name'],
  date: ['date', 'invoice date', 'credit date'],
  invoiceId: ['invoice', 'invoice id', 'invoice number', 'invoice no'],
  poNum: ['po num', 'po number', 'po', 'customer po'],
  totalAmount: ['total amount', 'total', 'amount', 'balance', 'credit balance', 'current balance'],
  email: ['email', 'email address', 'accounts email', 'contact email']
};

function normaliseHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}
function findHeader(headers, key) {
  const set = aliases[key] || [];
  return headers.find(h => set.includes(normaliseHeader(h))) || '';
}
function parseMoney(value) {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  const isBracketNegative = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[,$\s]/g, '').replace(/[()]/g, '');
  const number = Number(cleaned);
  if (Number.isNaN(number)) return 0;
  return isBracketNegative ? -Math.abs(number) : number;
}
function fmt(value) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Math.abs(Number(value || 0)));
}
function defaultSubject(group) {
  return `Paramount Liquor – Credit Balance – ${group.customerId || group.customerName || 'Account'}`;
}
function customerKey(row) {
  return String(row.customerId || row.customerName || row.email || '').trim().toLowerCase();
}

function App() {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [map, setMap] = useState({});
  const [onlyMissingEmail, setOnlyMissingEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  const creditRows = useMemo(() => rows.map((r, idx) => {
    const totalAmount = parseMoney(r[map.totalAmount]);
    return {
      id: idx,
      customerId: r[map.customerId] || '',
      customerName: r[map.customerName] || '',
      date: r[map.date] || '',
      invoiceId: r[map.invoiceId] || '',
      poNum: r[map.poNum] || '',
      email: r[map.email] || '',
      sourceAmount: totalAmount,
      creditAmount: Math.abs(totalAmount)
    };
  }).filter(r => r.sourceAmount < 0), [rows, map]);

  const groupedCustomers = useMemo(() => {
    const grouped = new Map();
    for (const row of creditRows) {
      const key = customerKey(row);
      if (!key) continue;
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          customerId: row.customerId,
          customerName: row.customerName,
          email: row.email,
          credits: [],
          totalCredit: 0
        });
      }
      const group = grouped.get(key);
      if (!group.email && row.email) group.email = row.email;
      group.credits.push({
        date: row.date,
        invoiceId: row.invoiceId,
        poNum: row.poNum,
        creditAmount: row.creditAmount
      });
      group.totalCredit += Number(row.creditAmount || 0);
    }
    return Array.from(grouped.values()).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [creditRows]);

  const visibleGroups = groupedCustomers.filter(g => onlyMissingEmail ? !g.email : true);
  const selectedGroups = visibleGroups.filter(g => selectedKeys.has(g.key));
  const totalCredit = visibleGroups.reduce((sum, g) => sum + Number(g.totalCredit || 0), 0);

  function loadCsv(file) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields || [];
        const autoMap = {
          customerId: findHeader(fields, 'customerId'),
          customerName: findHeader(fields, 'customerName'),
          date: findHeader(fields, 'date'),
          invoiceId: findHeader(fields, 'invoiceId'),
          poNum: findHeader(fields, 'poNum'),
          totalAmount: findHeader(fields, 'totalAmount'),
          email: findHeader(fields, 'email')
        };
        const parsedRows = results.data;
        setHeaders(fields);
        setMap(autoMap);
        setRows(parsedRows);

        const tempRows = parsedRows.map((r, idx) => {
          const totalAmount = parseMoney(r[autoMap.totalAmount]);
          return {
            id: idx,
            customerId: r[autoMap.customerId] || '',
            customerName: r[autoMap.customerName] || '',
            email: r[autoMap.email] || '',
            sourceAmount: totalAmount
          };
        }).filter(r => r.sourceAmount < 0);
        setSelectedKeys(new Set(tempRows.map(customerKey).filter(Boolean)));
        setLog([`Loaded ${parsedRows.length} rows from ${file.name}`]);
      }
    });
  }

  function toggle(key) {
    const next = new Set(selectedKeys);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelectedKeys(next);
  }

  async function sendEmails() {
    setSending(true);
    setLog(prev => [`Starting send for ${selectedGroups.length} customers...`, ...prev]);
    for (const group of selectedGroups) {
      if (!group.email) {
        setLog(prev => [`Skipped ${group.customerName || group.customerId}: missing email`, ...prev]);
        continue;
      }
      try {
        const res = await fetch('/api/send-credit-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: group.email,
            customerName: group.customerName,
            customerId: group.customerId,
            creditAmount: group.totalCredit,
            credits: group.credits,
            subject: defaultSubject(group)
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Send failed');
        setLog(prev => [`Sent 1 email to ${group.customerName || group.customerId} with ${group.credits.length} credit line(s)`, ...prev]);
      } catch (err) {
        setLog(prev => [`FAILED ${group.customerName || group.customerId}: ${err.message}`, ...prev]);
      }
    }
    setSending(false);
  }

  return <main>
    <section className="hero">
      <div>
        <p className="eyebrow">Paramount Liquor</p>
        <h1>Credit Balance Email Sender</h1>
        <p>Upload your CSV, group multiple credit rows by customer, preview the credit lines, then send one email per customer through SendGrid.</p>
      </div>
      <label className="upload">
        Upload CSV
        <input type="file" accept=".csv" onChange={e => e.target.files?.[0] && loadCsv(e.target.files[0])} />
      </label>
    </section>

    {headers.length > 0 && <section className="card">
      <h2>Column mapping</h2>
      <div className="grid">
        {Object.keys(aliases).map(key => <label key={key}>{key}
          <select value={map[key] || ''} onChange={e => setMap({ ...map, [key]: e.target.value })}>
            <option value="">Not used</option>
            {headers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>)}
      </div>
    </section>}

    <section className="stats">
      <div><strong>{visibleGroups.length}</strong><span>customers with credits</span></div>
      <div><strong>{fmt(totalCredit)}</strong><span>total credit value</span></div>
      <div><strong>{selectedGroups.length}</strong><span>emails to send</span></div>
    </section>

    {visibleGroups.length > 0 && <section className="card">
      <div className="toolbar">
        <h2>Customers</h2>
        <div>
          <label className="check"><input type="checkbox" checked={onlyMissingEmail} onChange={e => setOnlyMissingEmail(e.target.checked)} /> Show missing emails only</label>
          <button onClick={() => setSelectedKeys(new Set(visibleGroups.map(g => g.key)))}>Select visible</button>
          <button onClick={() => setSelectedKeys(new Set())}>Clear</button>
          <button className="primary" disabled={sending || selectedGroups.length === 0} onClick={sendEmails}>{sending ? 'Sending...' : 'Send selected'}</button>
        </div>
      </div>
      <div className="tableWrap">
        <table>
          <thead><tr><th></th><th>Customer ID</th><th>Customer</th><th>Email</th><th>Credit lines</th><th>Total Credit</th><th>Subject</th></tr></thead>
          <tbody>{visibleGroups.map(group => <tr key={group.key} className={!group.email ? 'warn' : ''}>
            <td><input type="checkbox" checked={selectedKeys.has(group.key)} onChange={() => toggle(group.key)} /></td>
            <td>{group.customerId}</td>
            <td>{group.customerName}</td>
            <td>{group.email || 'Missing email'}</td>
            <td>{group.credits.length}</td>
            <td>{fmt(group.totalCredit)}</td>
            <td>{defaultSubject(group)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>}

    {visibleGroups.length > 0 && <section className="card preview">
      <h2>Credit breakdown preview</h2>
      {visibleGroups.slice(0, 3).map(group => <div key={group.key} className="miniPreview">
        <h3>{group.customerName || group.customerId} — {fmt(group.totalCredit)}</h3>
        <table>
          <thead><tr><th>Date</th><th>Invoice ID</th><th>PO Num</th><th>Credit Amount</th></tr></thead>
          <tbody>{group.credits.map((credit, i) => <tr key={i}>
            <td>{credit.date}</td><td>{credit.invoiceId}</td><td>{credit.poNum}</td><td>{fmt(credit.creditAmount)}</td>
          </tr>)}</tbody>
        </table>
      </div>)}
    </section>}

    <section className="card preview">
      <h2>Email wording</h2>
      <p>Hi Customer,</p>
      <p>Our records show your Paramount Liquor account currently has a credit balance. Please see the credit details below.</p>
      <p>Please reply confirming whether you would like this credit applied to future invoices, or if you require this to be reviewed further by our Accounts team.</p>
      <p>Kind regards,<br/>Paramount Liquor Accounts</p>
    </section>

    {log.length > 0 && <section className="card log"><h2>Send log</h2>{log.map((l, i) => <p key={i}>{l}</p>)}</section>}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
