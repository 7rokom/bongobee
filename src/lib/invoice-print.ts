interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
}

interface InvoiceOrder {
  id: string;
  customer: string;
  phone: string;
  address: string;
  items: InvoiceItem[];
  deliveryCharge: number;
  total: number;
  status: string;
  date: string;
}

interface InvoiceSettings {
  siteName?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
}

export const printOrderInvoice = (order: InvoiceOrder, settings: InvoiceSettings = {}) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const { siteName, address: shopAddress, phone: shopPhone, logoUrl } = settings;

  const itemRows = order.items
    .map(
      (item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="pname">${item.name}</td>
        <td class="center">${item.qty}</td>
        <td class="right">৳${item.price}</td>
        <td class="right">৳${item.price * item.qty}</td>
      </tr>`
    )
    .join('');

  const subtotal = Math.max(0, (order.total || 0) - (order.deliveryCharge || 0));

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${siteName || 'Logo'}" style="max-height:60px;max-width:180px;object-fit:contain;" />`
    : `<div class="logo-text">${siteName || 'BongoBe'}<span>Multi Online Shop</span></div>`;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Invoice - ${order.id}</title>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hind Siliguri', Arial, sans-serif; color: #1f2937; background: #f4f6fa; padding: 24px; }
    .invoice { max-width: 820px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,141,14,0.08); border: 1px solid #e5e7eb; }
    .ribbon { height: 8px; background: linear-gradient(90deg,#008D0E 0%,#22c55e 50%,#008D0E 100%); }
    .header { display: flex; justify-content: space-between; align-items: center; padding: 28px 36px 18px; border-bottom: 2px dashed #d1fae5; }
    .logo-text { font-size: 26px; font-weight: 700; color: #008D0E; line-height:1.1; }
    .logo-text span { font-size: 11px; display: block; color: #6b7280; font-weight: 400; margin-top:4px; letter-spacing:.5px; }
    .invoice-title { text-align: right; }
    .invoice-title h2 { font-size: 22px; color: #008D0E; letter-spacing: 1px; font-weight: 700; }
    .invoice-title .badge { display:inline-block; margin-top:6px; padding:4px 10px; background:#ecfdf5; color:#008D0E; border-radius:999px; font-size:12px; font-weight:600; }
    .invoice-title p { font-size: 12px; color: #6b7280; margin-top:6px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 22px 36px; }
    .info-box { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; }
    .info-box h4 { font-size: 11px; color: #008D0E; text-transform: uppercase; margin-bottom: 8px; font-weight: 700; letter-spacing:1px; }
    .info-box p { font-size: 13.5px; line-height: 1.6; color:#111827; }
    .info-box p strong { color:#0f172a; }
    .items-wrap { padding: 0 36px; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; border-radius:10px; overflow:hidden; box-shadow:0 0 0 1px #e5e7eb; }
    th { background: linear-gradient(180deg,#008D0E,#047a14); color: white; padding: 11px 12px; text-align: left; font-size: 13px; font-weight:600; }
    th.center, td.center { text-align: center; }
    th.right, td.right { text-align: right; }
    td { font-size: 13.5px; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; background:#fff; }
    td.pname { font-weight:500; color:#111827; }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr:nth-child(even) td { background:#fafbfc; }
    .totals { display:flex; justify-content:flex-end; padding: 18px 36px 8px; }
    .totals .box { min-width: 280px; }
    .totals .row { display:flex; justify-content:space-between; padding: 6px 0; font-size: 14px; color:#374151; }
    .totals .row.grand { font-size: 17px; font-weight: 700; color: #008D0E; border-top: 2px dashed #008D0E; padding-top: 10px; margin-top: 6px; }
    .badges { display:flex; flex-wrap:wrap; gap:8px; padding: 14px 36px 0; }
    .badges span { font-size:11.5px; padding:5px 10px; background:#f0fdf4; color:#047857; border:1px solid #bbf7d0; border-radius:999px; font-weight:600; }
    .trust { margin: 18px 36px 0; padding: 14px 16px; border-radius:10px; background: linear-gradient(135deg,#ecfdf5,#f0fdf4); border:1px dashed #008D0E; }
    .trust h5 { color:#008D0E; font-size:13px; font-weight:700; margin-bottom:6px; }
    .trust p { font-size: 12.5px; color:#065f46; line-height:1.6; }
    .footer { margin-top: 18px; padding: 16px 36px 26px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12.5px; color: #6b7280; background:#fafbfc; }
    .footer .thanks { font-size: 14px; color:#008D0E; font-weight:700; margin-bottom:4px; }
    @media print { body { padding: 0; background:#fff; } .invoice { box-shadow:none; border:0; border-radius:0; } }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="ribbon"></div>
    <div class="header">
      <div>${logoHtml}</div>
      <div class="invoice-title">
        <h2>ইনভয়েস</h2>
        <div class="badge">${order.status}</div>
        <p>অর্ডার: <strong>${order.id}</strong></p>
        <p>তারিখ: ${order.date}</p>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-box">
        <h4>গ্রাহকের তথ্য</h4>
        <p><strong>${order.customer}</strong></p>
        <p>📞 ${order.phone}</p>
        <p>📍 ${order.address}</p>
      </div>
      <div class="info-box">
        <h4>বিক্রেতার তথ্য</h4>
        <p><strong>${siteName || 'BongoBe'}</strong></p>
        ${shopAddress ? `<p>📍 ${shopAddress}</p>` : ''}
        ${shopPhone ? `<p>📞 ${shopPhone}</p>` : ''}
      </div>
    </div>
    <div class="items-wrap">
      <table>
        <thead><tr><th>#</th><th>পণ্যের নাম</th><th class="center">পরিমাণ</th><th class="right">একক মূল্য</th><th class="right">মোট</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>
    <div class="totals">
      <div class="box">
        <div class="row"><span>সাবটোটাল</span><span>৳${subtotal}</span></div>
        <div class="row"><span>ডেলিভারি চার্জ</span><span>৳${order.deliveryCharge}</span></div>
        <div class="row grand"><span>সর্বমোট</span><span>৳${order.total}</span></div>
      </div>
    </div>
    <div class="badges">
      <span>✅ ১০০% অরিজিনাল পণ্য</span>
      <span>🚚 দ্রুত ডেলিভারি</span>
      <span>🔁 ৭ দিনের রিটার্ন পলিসি</span>
      <span>💬 ২৪/৭ কাস্টমার সাপোর্ট</span>
    </div>
    <div class="trust">
      <h5>🛡️ ভেরিফাইড অনলাইন ইনভয়েস</h5>
      <p>এটি একটি অনলাইন ইনভয়েস হলেও এটি <strong>১০০% গ্যারান্টেড</strong> এবং আমাদের সিস্টেম থেকে স্বয়ংক্রিয়ভাবে জেনারেট করা হয়েছে। যেকোনো অর্ডার যাচাই করতে আমাদের ওয়েবসাইটে গিয়ে ফোন নম্বর দিয়ে ট্র্যাক করতে পারবেন।</p>
    </div>
    <div class="footer">
      <p class="thanks">ধন্যবাদ আমাদের সাথে কেনাকাটার জন্য! ❤️</p>
      <p>${siteName || 'BongoBe'}${shopPhone ? ' • ' + shopPhone : ''}${shopAddress ? ' • ' + shopAddress : ''}</p>
      <p style="margin-top:4px;font-size:11px;">এই ইনভয়েসটি কম্পিউটার-জেনারেটেড, কোনো স্বাক্ষরের প্রয়োজন নেই।</p>
    </div>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
  printWindow.document.close();
};
