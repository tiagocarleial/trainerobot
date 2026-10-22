const rows = document.getElementById('rows');
const summary = document.getElementById('summary');
const money = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));
const num = n => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(Number(n));
const dt = s => s ? new Date(s).toLocaleString('pt-BR') : '—';
const statusName = { aguardando: 'Aguardando USDC', recebido: 'USDC recebido', pix_enviado: 'PIX enviado' };

function cell(text) { const td = document.createElement('td'); td.textContent = text; return td; }

async function load() {
  summary.textContent = 'Atualizando transações...';
  try {
    const response = await fetch('/api/transactions?all=1', { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível carregar as transações.');
    const { payments } = await response.json();
    rows.replaceChildren();
    for (const payment of payments) {
      const tr = document.createElement('tr');
      tr.append(cell(dt(payment.created_at)), cell(payment.telegram_handle ? `${payment.client_name} · ${payment.telegram_handle}` : payment.client_name), cell(`#${payment.id.slice(0, 8)}`), cell(`${num(payment.usdc_amount)} USDC`), cell(`${money(payment.rate_brl)}/USDC`), cell(money(payment.pix_amount)), cell(statusName[payment.status] || payment.status));
      const linkCell = document.createElement('td');
      if (/^0x[a-fA-F0-9]{64}$/.test(payment.crypto_tx_hash || '')) {
        const link = document.createElement('a'); link.href = `https://basescan.org/tx/${payment.crypto_tx_hash}`;
        link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Ver transação'; linkCell.append(link);
      } else linkCell.textContent = '—';
      tr.append(linkCell); rows.append(tr);
    }
    summary.textContent = `${payments.length} ${payments.length === 1 ? 'transação registrada' : 'transações registradas'}`;
  } catch (error) { summary.textContent = error.message; }
}
document.getElementById('refresh').onclick = load;
load();
