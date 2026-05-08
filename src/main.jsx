import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Papa from 'papaparse';
import './styles.css';

const aliases = {
  customerId: ['customerid', 'customer id', 'ar account id', 'account id', 'id'],
  customerName: ['customername', 'customer name', 'name', 'account name'],
  email: ['email', 'email address', 'accounts email', 'contact email'],
  balance: ['balance', 'total', 'amount', 'total amount', 'credit balance', 'current balance'],
  collectionAgent: ['collection agent', 'agent', 'collectionagent'],
  chain: ['chain', 'group account - chain', 'group account chain']
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
function defaultSubject(row) {
  return `Paramount Liquor – Credit Balance – ${row.customerId || row.customerName || 'Account'}`;
}

function App() {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [map, setMap] = useState({});
  const [onlyMissingEmail, setOnlyMissingEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState([]);

  const mappedRows = useMemo(() => rows.map((r, idx) => {
    const balance = parseMoney(r[map.balance]);
    const creditAmount = balance < 0 ? Math.abs(balance) : balance;
    return {
      id: idx,
      raw: r,
      customerId: r[map.customerId] || '',
      customerName: r[map.customerName] || '',
      email: r[map.email] || '',
      collectionAgent: r[map.collectionAgent] || '',
      chain: r[map.chain] || '',
      sourceBalance: balance,
      creditAmount,
      selected: true
    };
  }).filter(r => r.sourceBalance < 0 || normaliseHeader(map.balance).includes('credit')), [rows, map]);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const visibleRows = mappedRows.filter(r => onlyMissingEmail ? !r.email : true);
  const selectedRows = visibleRows.filter(r => selectedIds.has(r.id));
  const totalCredit = visibleRows.reduce((sum, r) => sum + Number(r.creditAmount || 0), 0);

  function loadCsv(file) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields || [];
        const autoMap = {
          customerId: findHeader(fields, 'customerId'),
          customerName: findHeader(fields, 'customerName'),
          email: findHeader(fields, 'email'),
          balance: findHeader(fields, 'balance'),
          collectionAgent: findHeader(fields, 'collectionAgent'),
          chain: findHeader(fields, 'chain')
        };
        setHeaders(fields);
        setMap(autoMap);
        setRows(results.data);
        const ids = new Set(results.data.map((_, i) => i));
        setSelectedIds(ids);
        setLog([`Loaded ${results.data.length} rows from ${file.name}`]);
      }
    });
  }

  function toggle(id) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  }

  async function sendEmails() {
    setSending(true);
    setLog(prev => [`Starting send for ${selectedRows.length} customers...`, ...prev]);
    for (const row of selectedRows) {
      if (!row.email) {
        setLog(prev => [`Skipped ${row.customerName || row.customerId}: missing email`, ...prev]);
        continue;
      }
      try {
        const res = await fetch('/api/send-credit-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: row.email,
            customerName: row.customerName,
            customerId: row.customerId,
            creditAmount: row.creditAmount,
            subject: defaultSubject(row)
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Send failed');
        setLog(prev => [`Sent to ${row.customerName || row.customerId} (${row.email})`, ...prev]);
      } catch (err) {
        setLog(prev => [`FAILED ${row.customerName || row.customerId}: ${err.message}`, ...prev]);
      }
    }
    setSending(false);
  }

  return <main>
    <section className="hero">
      <div>
        <p className="eyebrow">Paramount Liquor</p>
        <h1>Credit Balance Email Sender</h1>
        <p>Upload an ATB/export, detect credit balance customers, preview the email list, then send selected customers through SendGrid.</p>
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
      <div><strong>{visibleRows.length}</strong><span>credit balance customers</span></div>
      <div><strong>{fmt(totalCredit)}</strong><span>total credit value</span></div>
      <div><strong>{selectedRows.length}</strong><span>selected to send</span></div>
    </section>

    {visibleRows.length > 0 && <section className="card">
      <div className="toolbar">
        <h2>Customers</h2>
        <div>
          <label className="check"><input type="checkbox" checked={onlyMissingEmail} onChange={e => setOnlyMissingEmail(e.target.checked)} /> Show missing emails only</label>
          <button onClick={() => setSelectedIds(new Set(visibleRows.map(r => r.id)))}>Select visible</button>
          <button onClick={() => setSelectedIds(new Set())}>Clear</button>
          <button className="primary" disabled={sending || selectedRows.length === 0} onClick={sendEmails}>{sending ? 'Sending...' : 'Send selected'}</button>
        </div>
      </div>
      <div className="tableWrap">
        <table>
          <thead><tr><th></th><th>Customer ID</th><th>Customer</th><th>Email</th><th>Credit</th><th>Subject</th></tr></thead>
          <tbody>{visibleRows.map(row => <tr key={row.id} className={!row.email ? 'warn' : ''}>
            <td><input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggle(row.id)} /></td>
            <td>{row.customerId}</td><td>{row.customerName}</td><td>{row.email || 'Missing email'}</td><td>{fmt(row.creditAmount)}</td><td>{defaultSubject(row)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>}

    <section className="card preview">
      <h2>Email wording</h2>
      <p>Hi Customer,</p>
      <p>Our records show your Paramount Liquor account currently has a credit balance.</p>
      <p>Please reply confirming whether you would like this credit applied to future invoices, or if you require this to be reviewed further by our Accounts team.</p>
      <p>Kind regards,<br/>Paramount Liquor Accounts</p>
    </section>

    {log.length > 0 && <section className="card log"><h2>Send log</h2>{log.map((l, i) => <p key={i}>{l}</p>)}</section>}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
