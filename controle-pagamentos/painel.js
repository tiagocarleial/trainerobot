const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
const num = n => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(Number(n) || 0);
const dt = s => s ? new Date(s).toLocaleString('pt-BR') : '—';
const receiveAddress = '0x8f362ECd2DF3FBa1F3Ffd74CE73F4325965767cB';
const fields = ['client_name','telegram_handle','pix_key','wallet_address','sender_address','usdc_amount','rate_brl','exchange_at','status','crypto_tx_hash','notes'];
let payments = [];
let deposits = [];

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erro de conexão.');
  return data;
}
const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function message(id, value) { $(id).textContent = value; }
function datetimeLocal(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0,16);
}
function reset() {
  $('payment-form').reset(); $('id').value = ''; $('exchange_at').value = datetimeLocal();
  $('wallet_address').value = receiveAddress;
  for (const id of ['sender_address','usdc_amount','crypto_tx_hash']) $(id).readOnly = false;
  $('status').options[0].disabled = false;
  $('client_token').disabled = false; $('client_token').value = ''; $('client_name').readOnly = false;
  $('form-title').textContent = 'Nova transação'; message('form-message', ''); preview();
}
function preview() {
  const override = $('pix_amount_override').value;
  $('preview').textContent = money(override === '' ? Math.round((Number($('usdc_amount').value) || 0) * (Number($('rate_brl').value) || 0) * 80) / 100 : Number(override));
}
function showApp() { $('login').hidden = true; $('app').hidden = false; $('logout').hidden = false; }
function showLogin() { $('login').hidden = false; $('app').hidden = true; $('logout').hidden = true; }
async function load() {
  const data = await api('/api/transactions'); payments = data.payments; $('demo-banner').hidden = !data.demo; renderClientOptions(); render();
  await loadDeposits();
}
async function loadDeposits() {
  if ($('demo-banner').hidden === false) {
    deposits = []; message('deposit-message', 'A detecção automática não funciona no modo demonstração.'); renderDeposits(); return;
  }
  try {
    const result = await api('/api/base-deposits'); deposits = result.deposits;
    message('deposit-message', result.configured ? '' : 'Integração ainda inativa: configure BASE_RPC_URL e ALCHEMY_WEBHOOK_SIGNING_KEY no Vercel.');
    renderDeposits();
  } catch (error) { message('deposit-message', error.message); }
}
function renderDeposits() {
  const container = $('deposits'); container.replaceChildren();
  if (!deposits.length) { const p = document.createElement('p'); p.textContent = 'Nenhum depósito detectado ainda.'; container.append(p); return; }
  for (const deposit of deposits) {
    const row = document.createElement('article'); row.className = 'payment-row';
    const heading = document.createElement('div'); heading.className = 'row-heading';
    const title = document.createElement('strong'); title.textContent = `${num(deposit.usdc_amount)} USDC · ${dt(deposit.block_time)}`;
    const badge = document.createElement('span'); badge.className = 'badge';
    const linked = payments.find(payment => payment.id === deposit.payment_id);
    badge.textContent = linked?.provisional ? 'A identificar' : linked ? `Associado a ${linked.client_name}` : deposit.payment_id ? 'Associado' : 'Sem associação';
    heading.append(title, badge);
    const detail = document.createElement('p');
    detail.textContent = `Origem: ${deposit.from_address} · Bloco ${deposit.block_number}`;
    const link = document.createElement('a'); link.className = 'action-link'; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.href = `https://basescan.org/tx/${deposit.tx_hash}`; link.textContent = 'Ver na BaseScan';
    const actions = document.createElement('div'); actions.className = 'actions'; actions.append(link);
    if (linked?.provisional) {
      const identify = document.createElement('button'); identify.type = 'button'; identify.textContent = 'Identificar e completar'; identify.onclick = () => edit(linked);
      actions.append(identify);
    }
    if (!deposit.payment_id) {
      const options = payments.filter(payment => payment.status === 'aguardando' &&
        Number(payment.usdc_amount) === Number(deposit.usdc_amount) &&
        payment.wallet_address.toLowerCase() === receiveAddress.toLowerCase());
      if (options.length) {
        const select = document.createElement('select'); select.setAttribute('aria-label', 'Transação para associar');
        select.add(new Option('Escolha a transação', ''));
        for (const option of options) select.add(new Option(`${option.client_name} · ${num(option.usdc_amount)} USDC`, option.id));
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Associar';
        button.onclick = async () => {
          if (!select.value) return;
          button.disabled = true;
          try { await post('/api/base-deposits', { deposit_id: deposit.id, payment_id: select.value }); await load(); }
          catch (error) { message('deposit-message', error.message); button.disabled = false; }
        };
        actions.append(select, button);
      }
    }
    row.append(heading, detail, actions); container.append(row);
  }
}
function renderClientOptions() {
  const select = $('client_token'); const chosen = select.value; select.replaceChildren(new Option('Novo usuário', ''));
  const clients = new Map(payments.filter(p => !p.provisional).map(p => [p.client_token, p.client_name]));
  for (const [token, name] of clients) select.add(new Option(`${name} · ${token.slice(0, 6)}`, token));
  select.value = chosen;
}
function chooseClient() {
  const row = payments.find(p => p.client_token === $('client_token').value);
  $('client_name').value = row ? row.client_name : '';
  $('telegram_handle').value = row ? row.telegram_handle || '' : '';
  $('client_name').readOnly = !!row;
}
function edit(row) {
  $('id').value = row.id;
  $('client_token').value = row.provisional ? '' : row.client_token; $('client_token').disabled = !row.provisional;
  for (const field of fields) $(field).value = field === 'exchange_at' ? row[field] ? datetimeLocal(new Date(row[field])) : '' : row[field] ?? '';
  $('wallet_address').value = receiveAddress;
  $('pix_amount_override').value = row.pix_manual ? row.pix_amount : '';
  $('client_name').value = row.provisional ? '' : row.client_name;
  $('client_name').readOnly = !row.provisional;
  const onchain = deposits.some(deposit => deposit.payment_id === row.id);
  for (const id of ['sender_address','usdc_amount','crypto_tx_hash']) $(id).readOnly = onchain;
  $('status').options[0].disabled = onchain;
  $('form-title').textContent = row.provisional ? 'Identificar depósito recebido' : `Editar · ${row.client_name}`; preview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function render() {
  $('total').textContent = payments.length;
  $('received').textContent = `${num(payments.filter(p => p.status !== 'aguardando').reduce((s,p) => s + Number(p.usdc_amount), 0))} USDC`;
  $('paid').textContent = money(payments.filter(p => p.status === 'pix_enviado').reduce((s,p) => s + Number(p.pix_amount), 0));
  const query = $('search').value.trim().toLocaleLowerCase('pt-BR');
  const container = $('rows'); container.replaceChildren();
  const filtered = payments.filter(p => `${p.client_name} ${p.telegram_handle || ''}`.toLocaleLowerCase('pt-BR').includes(query));
  if (!filtered.length) { const p = document.createElement('p'); p.textContent = 'Nenhuma transação encontrada.'; container.append(p); return; }
  for (const row of filtered) {
    const article = document.createElement('article'); article.className = 'payment-row';
    const heading = document.createElement('div'); heading.className = 'row-heading';
    const title = document.createElement('strong'); title.textContent = row.telegram_handle ? `${row.client_name} · ${row.telegram_handle}` : row.client_name;
    const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = row.provisional ? 'Identificar depósito' : { aguardando:'Aguardando USDC', recebido:'USDC recebido', pix_enviado:'PIX enviado' }[row.status];
    heading.append(title, badge);
    const detail = document.createElement('p'); detail.textContent = row.provisional
      ? `${num(row.usdc_amount)} USDC recebidos · Origem ${row.sender_address} · PIX e cotação pendentes`
      : `${num(row.usdc_amount)} USDC · ${money(row.rate_brl)}/USDC · PIX ${money(row.pix_amount)} · cotação ${dt(row.exchange_at)}`;
    const actions = document.createElement('div'); actions.className = 'actions';
    const editButton = document.createElement('button'); editButton.textContent = row.provisional ? 'Identificar e completar' : 'Editar'; editButton.className = 'quiet'; editButton.onclick = () => edit(row);
    const linkButton = document.createElement('button'); linkButton.textContent = 'Copiar link do usuário'; linkButton.className = 'quiet';
    linkButton.onclick = async () => { await navigator.clipboard.writeText(`${location.origin}/pagamento?client=${row.client_token}`); linkButton.textContent = 'Link copiado'; };
    const viewLink = document.createElement('a'); viewLink.className = 'action-link'; viewLink.href = `/pagamento?client=${row.client_token}`; viewLink.target = '_blank'; viewLink.rel = 'noopener noreferrer'; viewLink.textContent = 'Visualizar histórico';
    const deleteButton = document.createElement('button'); deleteButton.type = 'button'; deleteButton.className = 'danger'; deleteButton.textContent = 'Excluir';
    deleteButton.onclick = async () => {
      if (!confirm(`Excluir a transação de ${row.client_name} (${num(row.usdc_amount)} USDC)? Os comprovantes anexados também serão apagados.`)) return;
      deleteButton.disabled = true;
      try {
        const result = await api(`/api/transactions?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
        if ($('id').value === row.id) reset();
        await load();
        message('list-message', result.warning || 'Transação excluída.');
      } catch (error) { alert(error.message); deleteButton.disabled = false; }
    };
    actions.append(editButton);
    if (!row.provisional) actions.append(linkButton, viewLink);
    actions.append(deleteButton);
    for (const [kind, label] of [['crypto','Anexar comprovante USDC'],['pix','Anexar comprovante PIX']]) {
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.hidden = true;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'quiet'; button.textContent = row[`${kind}_proof`] ? `Trocar ${label.toLowerCase()}` : label; button.onclick = () => input.click();
      input.onchange = async () => { const file = input.files[0]; if (!file) return; if (file.size > 2000000) { alert('Imagem acima de 2 MB.'); return; }
        button.disabled = true; button.textContent = 'Enviando...';
        try { const bytes = await file.arrayBuffer(); const binary = Array.from(new Uint8Array(bytes), b => String.fromCharCode(b)).join(''); await post('/api/proof', { id: row.id, kind, mime: file.type, data: btoa(binary) }); await load(); }
        catch (error) { alert(error.message); button.disabled = false; button.textContent = label; }
      };
      actions.append(button, input);
    }
    article.append(heading, detail, actions); container.append(article);
  }
}
$('login-form').onsubmit = async event => { event.preventDefault(); try { await post('/api/auth', { password: $('password').value }); $('password').value = ''; showApp(); await load(); } catch (error) { message('login-message', error.message); } };
$('logout').onclick = async () => { await post('/api/auth', { action: 'logout' }); showLogin(); payments = []; };
$('payment-form').onsubmit = async event => { event.preventDefault();
  const body = Object.fromEntries(fields.map(field => [field, $(field).value]));
  body.pix_amount_override = $('pix_amount_override').value;
  body.client_token = $('client_token').value;
  if ($('id').value) body.id = $('id').value;
  try { body.exchange_at = new Date(body.exchange_at).toISOString(); await post('/api/transactions', body); message('form-message', 'Transação salva.'); await load(); reset(); }
  catch (error) { message('form-message', error.message); }
};
$('new').onclick = reset; $('search').oninput = render;
$('refresh-deposits').onclick = () => load().catch(error => message('deposit-message', error.message));
$('client_token').onchange = chooseClient;
$('usdc_amount').oninput = preview; $('rate_brl').oninput = preview;
$('pix_amount_override').oninput = preview;
reset();
api('/api/auth').then(data => { if (data.authenticated) { showApp(); load().catch(error => message('form-message', error.message)); } else showLogin(); }).catch(error => message('login-message', error.message));
setInterval(() => { if (!$('app').hidden && !document.hidden) load().catch(error => message('deposit-message', error.message)); }, 30000);
