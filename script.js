
const els = {
  form: document.getElementById('converter-form'),
  amount: document.getElementById('amount'),
  from: document.getElementById('from'),
  to: document.getElementById('to'),
  swap: document.getElementById('swap'),
  status: document.getElementById('status'),
  result: document.getElementById('result'),
  meta: document.getElementById('meta-info'),
};

const STORAGE_KEYS = {
  from: 'cc_from',
  to: 'cc_to',
};

const numberFmt = new Intl.NumberFormat(navigator.language || 'pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function setStatus(msg) {
  els.status.textContent = msg ?? '';
}

function setResult(textHtml) {
  els.result.innerHTML = textHtml || '<span class="ghost">O resultado aparecerá aqui</span>';
}

async function fetchCurrencies() {
  try {
    const res = await fetch('https://api.frankfurter.app/currencies');
    if (!res.ok) throw new Error('Falha ao obter moedas');
    const data = await res.json();
    // data = { "USD": "United States Dollar", "BRL": "Brazilian Real", ... }
    return Object.entries(data)
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code));
  } catch (err) {
    console.error(err);
    // Fallback mínimo se API de moedas falhar
    return [
      { code: 'USD', name: 'United States Dollar' },
      { code: 'EUR', name: 'Euro' },
      { code: 'BRL', name: 'Brazilian Real' },
      { code: 'GBP', name: 'British Pound' },
      { code: 'JPY', name: 'Japanese Yen' },
      { code: 'ARS', name: 'Argentine Peso' },
    ];
  }
}

function populateSelect(select, currencies) {
  select.innerHTML = currencies
    .map(({ code, name }) => `<option value="${code}">${code} — ${name}</option>`)
    .join('');
}

function loadPrefs() {
  const from = localStorage.getItem(STORAGE_KEYS.from) || 'USD';
  const to = localStorage.getItem(STORAGE_KEYS.to) || 'BRL';
  return { from, to };
}

function savePrefs(from, to) {
  localStorage.setItem(STORAGE_KEYS.from, from);
  localStorage.setItem(STORAGE_KEYS.to, to);
}

async function convert(amount, from, to) {
  if (from === to) {
    return { amount, rate: 1, converted: amount, date: new Date().toISOString().slice(0,10) };
  }
  const url = new URL('https://api.frankfurter.app/latest');
  url.searchParams.set('amount', amount);
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);

  const res = await fetch(url);
  if (!res.ok) throw new Error('Não foi possível obter a cotação no momento.');
  const data = await res.json();
  // data = { amount, base, date, rates: { [to]: value } }
  const rate = data.rates?.[to];
  if (typeof rate !== 'number') throw new Error('Cotação indisponível para o par selecionado.');
  return { amount: data.amount, rate, converted: rate, date: data.date };
}

function attachEvents() {
  els.swap.addEventListener('click', () => {
    const a = els.from.value;
    const b = els.to.value;
    els.from.value = b;
    els.to.value = a;
    savePrefs(els.from.value, els.to.value);
  });

  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawAmount = parseFloat(els.amount.value.replace(',', '.'));
    const from = els.from.value;
    const to = els.to.value;

    if (!Number.isFinite(rawAmount) || rawAmount < 0) {
      setStatus('Informe um valor válido.');
      return;
    }

    setStatus('Convertendo...');
    els.result.style.opacity = '.6';

    try {
      const { converted, rate, date } = await convert(rawAmount, from, to);

      const out = `
        <div>
          <div><strong>${numberFmt.format(converted)}</strong> ${to}</div>
          <small>Taxa: 1 ${from} → ${numberFmt.format(rate / rawAmount)} ${to} (em ${date})</small>
        </div>
      `;
      setResult(out);
      els.meta.textContent = `Fonte: Frankfurter (ECB) • Última atualização: ${date}`;
      setStatus('');
      savePrefs(from, to);
    } catch (err) {
      console.error(err);
      setStatus('Não foi possível concluir a conversão. Tente novamente em instantes.');
    } finally {
      els.result.style.opacity = '1';
    }
  });
}

(async function init() {
  setStatus('Carregando moedas...');
  const currencies = await fetchCurrencies();
  populateSelect(els.from, currencies);
  populateSelect(els.to,  currencies);

  const { from, to } = loadPrefs();
  if ([...els.from.options].some(o => o.value === from)) els.from.value = from;
  if ([...els.to.options].some(o => o.value === to)) els.to.value = to;

  attachEvents();
  setStatus('Pronto para converter.');
})();
