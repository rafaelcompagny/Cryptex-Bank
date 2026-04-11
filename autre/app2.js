let balance = Number(localStorage.getItem('balance') || 2000);
let history = JSON.parse(localStorage.getItem('history') || '[]');
let pinValue = '';
let homeChart = null;
let cryptoChart = null;

let appState = JSON.parse(localStorage.getItem('appState') || JSON.stringify({
  currentAsset: 'BTC',
  cardBlocked: false,
  cardRevealed: false
}));

let assets = JSON.parse(localStorage.getItem('assets') || JSON.stringify({
  BTC: { price: 30000, owned: 0, avgBuyPrice: 0, history: [30000, 30120, 30050], transactions: [] },
  ETH: { price: 2000, owned: 0, avgBuyPrice: 0, history: [2000, 2015, 1998], transactions: [] },
  AAPL: { price: 180, owned: 0, avgBuyPrice: 0, history: [180, 181, 179], transactions: [] },
  TSLA: { price: 250, owned: 0, avgBuyPrice: 0, history: [250, 248, 252], transactions: [] },
  NVDA: { price: 5000, owned: 0, avgBuyPrice: 0, history: [500, 506, 503], transactions: [] },
  RCOP: { price: 5000, owned: 0, avgBuyPrice: 0, history: [5000,5035], transactions:[]},
}));

let currentAsset = appState.currentAsset || 'BTC';

const cardData = {
  numberMasked: '**** **** **** 4821',
  numberFull: '1234 5678 9012 4821',
  expiryMasked: '\u2022\u2022/\u2022\u2022',
  expiryFull: '12/28',
  cvvMasked: '***',
  cvvFull: '123',
  iban: 'FR76 1234 5678 9012 3456 7890 123'
};

function save() {
  appState.currentAsset = currentAsset;
  localStorage.setItem('balance', balance);
  localStorage.setItem('history', JSON.stringify(history));
  localStorage.setItem('assets', JSON.stringify(assets));
  localStorage.setItem('appState', JSON.stringify(appState));
}

function formatMoney(value) {
  return Number(value).toFixed(2) + ' \u20ac';
}

function getHoldingValue(assetKey) {
  return assets[assetKey].owned * assets[assetKey].price;
}

function getPnL(assetKey) {
  const asset = assets[assetKey];
  if (asset.owned <= 0 || asset.avgBuyPrice <= 0) return 0;
  return (asset.price - asset.avgBuyPrice) * asset.owned;
}

function update() {
  const balanceEl = document.getElementById('balance');
  if (balanceEl) {
    balanceEl.innerText = formatMoney(balance);
  }

  const paymentBalanceEl = document.getElementById('paymentBalance');
  if (paymentBalanceEl) {
    paymentBalanceEl.innerText = formatMoney(balance);
  }

  const historyEl = document.getElementById('history');
  if (historyEl) {
    historyEl.innerHTML = history.length
      ? history.map(item => `<div class="list-item">${item}</div>`).join('')
      : '<div class="list-item">Aucune transaction pour le moment.</div>';
  }

  const portfolioEl = document.getElementById('portfolio');
  if (portfolioEl) {
    let total = 0;
    Object.keys(assets).forEach(key => {
      total += getHoldingValue(key);
    });
    portfolioEl.innerText = 'Valeur totale du portefeuille : ' + formatMoney(total);
  }

  const cashEl = document.getElementById('cashBalance');
  if (cashEl) {
    cashEl.innerText = 'Solde disponible : ' + formatMoney(balance);
  }

  const priceEl = document.getElementById('price');
  if (priceEl) {
    priceEl.innerText = currentAsset + ' : ' + formatMoney(assets[currentAsset].price);
  }

  const holdingEl = document.getElementById('holding');
  if (holdingEl) {
    const qty = assets[currentAsset].owned;
    const value = getHoldingValue(currentAsset);
    holdingEl.innerText = 'Poss\u00e9d\u00e9 : ' + qty.toFixed(6) + ' unit\u00e9(s) \u2022 Valeur : ' + formatMoney(value);
  }

  const pnlEl = document.getElementById('pnl');
  if (pnlEl) {
    const pnl = getPnL(currentAsset);
    pnlEl.innerHTML = `P/L latent : <span class="${pnl >= 0 ? 'positive' : 'negative'}">${pnl >= 0 ? '+' : ''}${formatMoney(pnl)}</span>`;
  }

  const cryptoHistoryEl = document.getElementById('cryptoHistory');
  if (cryptoHistoryEl) {
    const txs = assets[currentAsset].transactions;
    cryptoHistoryEl.innerHTML = txs.length
      ? txs.map(item => `<div class="list-item">${item}</div>`).join('')
      : '<div class="list-item">Aucune transaction pour le moment.</div>';
  }

  const assetSelect = document.getElementById('assetSelect');
  if (assetSelect) {
    assetSelect.value = currentAsset;
  }

  updateCardUI();
  save();
}

function renderHomeChart() {
  const canvas = document.getElementById('chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const values = [];
  let running = balance;
  const recent = history.slice(0, 8).reverse();

  if (recent.length === 0) {
    values.push(balance);
  } else {
    for (let i = recent.length - 1; i >= 0; i--) {
      values.unshift(running);
      const text = recent[i];
      const match = text.match(/([+-]?\d+(?:\.\d+)?)\s*\u20ac/);
      if (match) {
        const amount = Number(match[1]);
        running -= amount;
      }
    }
    values.push(balance);
  }

  if (homeChart) {
    homeChart.destroy();
  }

  homeChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: values.map((_, i) => 'T' + (i + 1)),
      datasets: [{
        data: values,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56,189,248,0.12)',
        fill: true,
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } }
      }
    }
  });
}

function renderCryptoChart() {
  const canvas = document.getElementById('cryptoChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const asset = assets[currentAsset];
  let data = Array.isArray(asset.history) ? [...asset.history] : [];

  if (data.length < 2) {
    data = [asset.price, asset.price];
  }

  const isUp = data[data.length - 1] >= data[0];
  const borderColor = isUp ? '#22c55e' : '#ef4444';
  const backgroundColor = isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';

  if (cryptoChart) {
    cryptoChart.destroy();
  }

  cryptoChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map((_, i) => i + 1),
      datasets: [{
        data,
        borderColor,
        backgroundColor,
        fill: true,
        borderWidth: 3,
        pointRadius: 2,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      animation: { duration: 450 },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } }
      }
    }
  });
}

function addMoney() {
  const name = prompt('Nom du revenu ?');
  if (name === null) return;

  const amount = Number(prompt('Montant ?'));
  if (!amount || amount <= 0) {
    alert('Montant invalide.');
    return;
  }

  balance += amount;
  history.unshift(`${name} +${amount.toFixed(2)} \u20ac`);
  update();
  renderHomeChart();
}

function addExpense() {
  const name = prompt('Nom de la d\u00e9pense ?');
  if (name === null) return;

  const amount = Number(prompt('Montant ?'));
  if (!amount || amount <= 0) {
    alert('Montant invalide.');
    return;
  }

  balance -= amount;
  history.unshift(`${name} -${amount.toFixed(2)} \u20ac`);
  update();
  renderHomeChart();
}

function fillContact(name, ibanValue) {
  const nameInput = document.getElementById('paymentName');
  const ibanInput = document.getElementById('iban');

  if (nameInput) nameInput.value = name;
  if (ibanInput) ibanInput.value = ibanValue;
}

function transfer() {
  const nameInput = document.getElementById('paymentName');
  const ibanInput = document.getElementById('iban');
  const amountInput = document.getElementById('amount');

  if (!nameInput || !ibanInput || !amountInput) return;

  const beneficiary = nameInput.value.trim();
  const iban = ibanInput.value.trim();
  const amount = Number(amountInput.value);

  if (!beneficiary) return alert('Entre un nom de b\u00e9n\u00e9ficiaire.');
  if (!iban) return alert('Entre un IBAN.');
  if (!amount || amount <= 0) return alert('Entre un montant valide.');
  if (amount > balance) return alert("Pas assez d'argent sur le compte.");

  const ok = confirm(`Confirmer le virement de ${formatMoney(amount)} \u00e0 ${beneficiary} ?`);
  if (!ok) return;

  balance -= amount;
  history.unshift(`Virement ${beneficiary} -${amount.toFixed(2)} \u20ac`);
  update();
  renderHomeChart();

  amountInput.value = '';
}

function selectAsset(assetKey) {
  currentAsset = assetKey;
  update();
  renderCryptoChart();
}

function buy() {
  const input = document.getElementById('investAmount');
  if (!input) return;

  const amount = Number(input.value);
  if (!amount || amount <= 0) return alert('Entre un montant valide.');
  if (amount > balance) return alert("Pas assez d'argent sur le compte.");

  const asset = assets[currentAsset];
  const qty = amount / asset.price;
  const oldQty = asset.owned;
  const oldCost = oldQty * asset.avgBuyPrice;

  asset.owned += qty;
  asset.avgBuyPrice = (oldCost + amount) / asset.owned;
  balance -= amount;

  const line = `Achat ${currentAsset} \u2022 ${formatMoney(amount)} \u2022 ${qty.toFixed(6)} unit\u00e9(s) \u00e0 ${formatMoney(asset.price)}`;
  asset.transactions.unshift(line);
  history.unshift(line);

  input.value = '';
  update();
  renderHomeChart();
  renderCryptoChart();
}

function sellPartial() {
  const input = document.getElementById('sellAmount');
  if (!input) return;

  const qty = Number(input.value);
  const asset = assets[currentAsset];

  if (!qty || qty <= 0) return alert('Entre une quantit\u00e9 valide \u00e0 vendre.');
  if (qty > asset.owned) return alert('Tu ne poss\u00e8des pas autant de cette valeur.');

  const saleValue = qty * asset.price;
  const costBasis = qty * asset.avgBuyPrice;
  const pnl = saleValue - costBasis;

  balance += saleValue;
  asset.owned -= qty;

  if (asset.owned <= 0.0000001) {
    asset.owned = 0;
    asset.avgBuyPrice = 0;
  }

  const line = `Vente partielle ${currentAsset} \u2022 ${formatMoney(saleValue)} \u2022 ${qty.toFixed(6)} unit\u00e9(s) \u2022 ${pnl >= 0 ? 'Gain' : 'Perte'} ${formatMoney(pnl)}`;
  asset.transactions.unshift(line);
  history.unshift(line);

  input.value = '';
  update();
  renderHomeChart();
  renderCryptoChart();
}

function sellAll() {
  const asset = assets[currentAsset];
  if (asset.owned <= 0) return alert('Tu ne poss\u00e8des rien \u00e0 vendre sur cet actif.');

  const qty = asset.owned;
  const saleValue = qty * asset.price;
  const costBasis = qty * asset.avgBuyPrice;
  const pnl = saleValue - costBasis;

  balance += saleValue;

  const line = `Vente ${currentAsset} \u2022 ${formatMoney(saleValue)} \u2022 ${qty.toFixed(6)} unit\u00e9(s) \u2022 ${pnl >= 0 ? 'Gain' : 'Perte'} ${formatMoney(pnl)}`;
  asset.transactions.unshift(line);
  history.unshift(line);

  asset.owned = 0;
  asset.avgBuyPrice = 0;

  update();
  renderHomeChart();
  renderCryptoChart();
}

function pressPin(n) {
  pinValue += String(n);
  const dots = document.getElementById('pinDots');

  if (dots) {
    const shown = pinValue.split('').map(() => '\u2022').join(' ');
    dots.innerText = shown || '\u2022 \u2022 \u2022 \u2022';
  }

  if (pinValue.length === 4) {
    if (pinValue === '0206') {
      window.location.href = 'home.html';
    } else {
      alert('Code incorrect');
      pinValue = '';
      if (dots) dots.innerText = '\u2022 \u2022 \u2022 \u2022';
    }
  }
}

function clearPin() {
  pinValue = '';
  const dots = document.getElementById('pinDots');
  if (dots) dots.innerText = '\u2022 \u2022 \u2022 \u2022';
}

function logout() {
  pinValue = '';
  window.location.href = 'login.html';
}

function flipCard() {
  const cardInner = document.getElementById('cardInner');
  if (cardInner) {
    cardInner.classList.toggle('flip');
  }
}

function showFullCard() {
  const entered = prompt('Entre le code PIN pour afficher les informations de la carte :');
  if (entered !== '0206') {
    alert('Code incorrect');
    return;
  }

  appState.cardRevealed = !appState.cardRevealed;
  updateCardUI();
  save();
}

function toggleCardBlock() {
  appState.cardBlocked = !appState.cardBlocked;
  updateCardUI();
  save();
}

function updateCardUI() {
  const numberEl = document.getElementById('maskedCardNumber');
  const expiryEl = document.getElementById('maskedExpiry');
  const cvvEl = document.getElementById('maskedCvv');
  const ibanEl = document.getElementById('cardIban');
  const statusEl = document.getElementById('cardStatusText');

  if (numberEl) {
    numberEl.innerText = appState.cardRevealed ? cardData.numberFull : cardData.numberMasked;
  }

  if (expiryEl) {
    expiryEl.innerText = appState.cardRevealed ? cardData.expiryFull : cardData.expiryMasked;
  }

  if (cvvEl) {
    cvvEl.innerText = appState.cardRevealed ? cardData.cvvFull : cardData.cvvMasked;
  }

  if (ibanEl) {
    ibanEl.innerText = cardData.iban;
  }

  if (statusEl) {
    statusEl.innerText = appState.cardBlocked ? 'Carte bloqu\u00e9e' : 'Carte active';
    statusEl.className = 'status-pill ' + (appState.cardBlocked ? 'negative' : 'positive');
  }
}

setInterval(() => {
  Object.keys(assets).forEach(key => {
    const asset = assets[key];
    const change = (Math.random() * 2 - 1) * asset.price * 0.02;
    asset.price = Math.max(0.01, asset.price + change);

    if (!Array.isArray(asset.history)) {
      asset.history = [asset.price];
    }

    asset.history.push(asset.price);

    if (asset.history.length > 30) {
      asset.history.shift();
    }
  });

  update();
  renderCryptoChart();
}, 2000);

window.onload = () => {
  update();
  renderHomeChart();
  renderCryptoChart();
};