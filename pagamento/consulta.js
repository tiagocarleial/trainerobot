const box = document.getElementById('content');
const money = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));
const num = n => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(Number(n));
const dt = s => s ? new Date(s).toLocaleString('pt-BR') : '—';
const statusName = { aguardando: 'Aguardando confirmação do USDC', recebido: 'USDC recebido; PIX pendente', pix_enviado: 'PIX enviado' };

function line(container, label, value) {
  const div = document.createElement('div'); div.className = 'info-line';
  const a = document.createElement('span'); a.textContent = label;
  const b = document.createElement('strong'); b.textContent = value;
  div.append(a, b); container.append(div);
}

function transaction(payment, proofs) {
  const card = document.createElement('article'); card.className = 'history-card';
  const heading = document.createElement('div'); heading.className = 'row-heading';
  const title = document.createElement('h3'); title.textContent = `${num(payment.usdc_amount)} USDC · ${dt(payment.created_at)}`;
  const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = statusName[payment.status];
  heading.append(title, badge); card.append(heading);
  line(card, 'Cotação registrada', `${money(payment.rate_brl)} por USDC`);
  line(card, 'Data e hora da cotação', dt(payment.exchange_at));
  line(card, payment.pix_manual ? 'Valor do PIX ajustado pelo responsável' : 'Desconto aplicado', payment.pix_manual ? 'Sim' : `${num(payment.fee_percent)}%`);
  line(card, 'Valor do PIX', money(payment.pix_amount));
  line(card, 'USDC confirmado em', dt(payment.received_at));
  line(card, 'PIX enviado em', dt(payment.paid_at));
  if (payment.wallet_address) line(card, 'Carteira de recebimento · Base', payment.wallet_address);
  if (payment.crypto_tx_hash) {
    const hash = payment.crypto_tx_hash;
    if (/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      const div = document.createElement('div'); div.className = 'info-line';
      const label = document.createElement('span'); label.textContent = 'Transação na Base';
      const link = document.createElement('a'); link.href = `https://basescan.org/tx/${hash}`;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Ver no BaseScan';
      div.append(label, link); card.append(div);
    } else line(card, 'Hash da transação', hash);
  }
  for (const [field, label] of [['crypto_proof', 'Comprovante de USDC'], ['pix_proof', 'Comprovante do PIX']]) {
    if (!proofs?.[field]) continue;
    const div = document.createElement('div'); div.className = 'proof';
    const title = document.createElement('h3'); title.textContent = label;
    const img = document.createElement('img'); img.src = proofs[field]; img.alt = label; img.loading = 'lazy';
    div.append(title, img); card.append(div);
  }
  return card;
}

async function start() {
  const params = new URLSearchParams(location.search);
  const key = params.has('client') ? 'client' : 'token';
  const token = params.get(key);
  if (!token) { box.textContent = 'Link de consulta inválido.'; return; }
  try {
    const response = await fetch(`/api/transactions?${key}=${encodeURIComponent(token)}`, { cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('Histórico não encontrado.');
    const { payments, proofs } = await response.json();
    box.replaceChildren();
    const title = document.createElement('h2'); title.textContent = payments[0].client_name; box.append(title);
    if (payments[0].telegram_handle) { const handle = document.createElement('p'); handle.className = 'history-count'; handle.textContent = payments[0].telegram_handle; box.append(handle); }
    const count = document.createElement('p'); count.className = 'history-count';
    count.textContent = `${payments.length} ${payments.length === 1 ? 'transação' : 'transações'} neste histórico`;
    box.append(count);
    for (const payment of payments) box.append(transaction(payment, proofs[payment.id]));
    const foot = document.createElement('p'); foot.className = 'footnote';
    foot.textContent = 'Guarde este link para acompanhar novas transações. Depósitos na Base podem ser detectados automaticamente; o PIX é enviado e registrado pelo responsável.';
    box.append(foot);
  } catch (error) { box.textContent = error.message; }
}
start();
