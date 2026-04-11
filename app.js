let balance = Number(localStorage.getItem('balance') || 2000);
let history = JSON.parse(localStorage.getItem('history') || '[]');
let pinValue = '';
let homeChart = null;
let cryptoChart = null;

const defaultAssets = {
  BTC: { price: 30000, owned: 0, avgBuyPrice: 0, history: [30000, 30120, 30050], transactions: [] },
  ETH: { price: 2000, owned: 0, avgBuyPrice: 0, history: [2000, 2015, 1998], transactions: [] },
  AAPL: { price: 180, owned: 0, avgBuyPrice: 0, history: [180, 181, 179], transactions: [] },
  TSLA: { price: 250, owned: 0, avgBuyPrice: 0, history: [250, 248, 252], transactions: [] },
  NVDA: { price: 500, owned: 0, avgBuyPrice: 0, history: [500, 506, 503], transactions: [] },
  RCOP: { price: 5000, owned: 0, avgBuyPrice: 0, history: [5000, 5035, 4990], transactions: [] }
};

let assets = JSON.parse(localStorage.getItem('assets') || '{}');

let contacts = JSON.parse(localStorage.getItem('contacts') || JSON.stringify([
  { name: 'Lina Popelin', iban: 'FR76 1111 1111 1111 1111 1111 111' },
  { name: 'Thibaut Escoffier', iban: 'FR76 2222 2222 2222 2222 2222 222' },
  { name: 'Aglaé', iban: 'FR76 3333 3333 3333 3333 3333 333' },
  { name: 'Gabriel Rattela', iban: 'FR76 4444 4444 4444 4444 4444 444' },
  { name: 'Laura Loreau', iban: 'FR76 5555 5555 5555 5555 5555 555' },
]));

// Fusion pour ajouter automatiquement les nouveaux actifs manquants
assets = {
  ...defaultAssets,
  ...assets
};

// Vérifie chaque actif individuellement pour éviter les anciennes sauvegardes incomplètes
Object.keys(defaultAssets).forEach((key) => {
  if (!assets[key]) {
    assets[key] = { ...defaultAssets[key] };
  } else {
    assets[key] = {
      ...defaultAssets[key],
      ...assets[key]
    };

    if (!Array.isArray(assets[key].history) || assets[key].history.length < 2) {
      assets[key].history = [...defaultAssets[key].history];
    }

    if (!Array.isArray(assets[key].transactions)) {
      assets[key].transactions = [];
    }

    if (typeof assets[key].owned !== 'number') assets[key].owned = 0;
    if (typeof assets[key].avgBuyPrice !== 'number') assets[key].avgBuyPrice = 0;
    if (typeof assets[key].price !== 'number' || assets[key].price <= 0) {
      assets[key].price = defaultAssets[key].price;
    }
  }
});

let appState = JSON.parse(localStorage.getItem('appState') || JSON.stringify({
  currentAsset: 'BTC',
  cardBlocked: false,
  cardRevealed: false,
  cardType: 'classic'
}));

function changeCardType(type) {
  appState.cardType = type;
  updateCardUI();
  save();
}

let currentAsset = appState.currentAsset || 'BTC';

// Si l’actif sauvé n’existe pas, on revient sur BTC
if (!assets[currentAsset]) {
  currentAsset = 'BTC';
  appState.currentAsset = 'BTC';
}

const cardData = {
  numberMasked: '**** **** **** 4821',
  numberFull: '1234 5678 9012 4821',
  expiryMasked: '••/••',
  expiryFull: '12/28',
  cvvMasked: '***',
  cvvFull: '123',
  iban: 'FR76 0612 0206 0000 0000 0000 001'
};

function save() {
  appState.currentAsset = currentAsset;
  localStorage.setItem('balance', balance);
  localStorage.setItem('history', JSON.stringify(history));
  localStorage.setItem('assets', JSON.stringify(assets));
  localStorage.setItem('appState', JSON.stringify(appState));
  localStorage.setItem('contacts', JSON.stringify(contacts));
}

function formatMoney(value) {
  return Number(value).toFixed(2) + ' €';
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
  if (priceEl && assets[currentAsset]) {
    priceEl.innerText = currentAsset + ' : ' + formatMoney(assets[currentAsset].price);
  }

  const holdingEl = document.getElementById('holding');
  if (holdingEl && assets[currentAsset]) {
    const qty = assets[currentAsset].owned;
    const value = getHoldingValue(currentAsset);
    holdingEl.innerText = 'Possédé : ' + qty.toFixed(6) + ' unité(s) • Valeur : ' + formatMoney(value);
  }

  const pnlEl = document.getElementById('pnl');
  if (pnlEl && assets[currentAsset]) {
    const pnl = getPnL(currentAsset);
    pnlEl.innerHTML = `P/L latent : <span class="${pnl >= 0 ? 'positive' : 'negative'}">${pnl >= 0 ? '+' : ''}${formatMoney(pnl)}</span>`;
  }

  const cryptoHistoryEl = document.getElementById('cryptoHistory');
  if (cryptoHistoryEl && assets[currentAsset]) {
    const txs = assets[currentAsset].transactions;
    cryptoHistoryEl.innerHTML = txs.length
      ? txs.map(item => `<div class="list-item">${item}</div>`).join('')
      : '<div class="list-item">Aucune transaction pour le moment.</div>';
  }

  const assetSelect = document.getElementById('assetSelect');
  if (assetSelect && assets[currentAsset]) {
    assetSelect.value = currentAsset;
  }

  updateCardUI();
  renderContacts();
  save();
}

function renderContacts() {
  const contactsList = document.getElementById('contactsList');
  if (!contactsList) return;

  if (contacts.length === 0) {
    contactsList.innerHTML = '<div class="list-item">Aucun contact enregistré.</div>';
    return;
  }

  contactsList.innerHTML = contacts.map((contact, index) => `
    <div class="list-item">
      <strong>${contact.name}</strong><br>
      <span class="small">${contact.iban}</span><br>
      <div class="row" style="margin-top:8px;">
        <button onclick="fillContact('${contact.name}', '${contact.iban}')">Utiliser</button>
        <button class="secondary" onclick="deleteContact(${index})">Supprimer</button>
      </div>
    </div>
  `).join('');
}


function addContact() {
  const name = prompt('Nom du contact ?');
  if (name === null || !name.trim()) return;

  const iban = prompt('IBAN du contact ?');
  if (iban === null || !iban.trim()) return;

  contacts.push({
    name: name.trim(),
    iban: iban.trim()
  });

  save();
  renderContacts();
}

function deleteContact(index) {
  const confirmed = confirm('Supprimer ce contact ?');
  if (!confirmed) return;

  contacts.splice(index, 1);
  save();
  renderContacts();
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
      const match = text.match(/([+-]?\d+(?:\.\d+)?)\s*€/);
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
  if (!assets[currentAsset]) return;

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
  history.unshift(`${name} +${amount.toFixed(2)} €`);
  update();
  renderHomeChart();
}

function addExpense() {
  const name = prompt('Nom de la dépense ?');
  if (name === null) return;

  const amount = Number(prompt('Montant ?'));
  if (!amount || amount <= 0) {
    alert('Montant invalide.');
    return;
  }

  balance -= amount;
  history.unshift(`${name} -${amount.toFixed(2)} €`);
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

  if (!beneficiary) return alert('Entre un nom de bénéficiaire.');
  if (!iban) return alert('Entre un IBAN.');
  if (!amount || amount <= 0) return alert('Entre un montant valide.');
  if (amount > balance) return alert("Pas assez d'argent sur le compte.");

  const ok = confirm(`Confirmer le virement de ${formatMoney(amount)} à ${beneficiary} ?`);
  if (!ok) return;

  balance -= amount;
  history.unshift(`Virement ${beneficiary} -${amount.toFixed(2)} €`);
  update();
  renderHomeChart();

  amountInput.value = '';
}

function selectAsset(assetKey) {
  if (!assets[assetKey]) return;
  currentAsset = assetKey;
  appState.currentAsset = assetKey;
  save();
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

  const line = `Achat ${currentAsset} • ${formatMoney(amount)} • ${qty.toFixed(6)} unité(s) à ${formatMoney(asset.price)}`;
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

  if (!qty || qty <= 0) return alert('Entre une quantité valide à vendre.');
  if (qty > asset.owned) return alert('Tu ne possèdes pas autant de cette valeur.');

  const saleValue = qty * asset.price;
  const costBasis = qty * asset.avgBuyPrice;
  const pnl = saleValue - costBasis;

  balance += saleValue;
  asset.owned -= qty;

  if (asset.owned <= 0.0000001) {
    asset.owned = 0;
    asset.avgBuyPrice = 0;
  }

  const line = `Vente partielle ${currentAsset} • ${formatMoney(saleValue)} • ${qty.toFixed(6)} unité(s) • ${pnl >= 0 ? 'Gain' : 'Perte'} ${formatMoney(pnl)}`;
  asset.transactions.unshift(line);
  history.unshift(line);

  input.value = '';
  update();
  renderHomeChart();
  renderCryptoChart();
}

function sellAll() {
  const asset = assets[currentAsset];
  if (asset.owned <= 0) return alert('Tu ne possèdes rien à vendre sur cet actif.');

  const qty = asset.owned;
  const saleValue = qty * asset.price;
  const costBasis = qty * asset.avgBuyPrice;
  const pnl = saleValue - costBasis;

  balance += saleValue;

  const line = `Vente ${currentAsset} • ${formatMoney(saleValue)} • ${qty.toFixed(6)} unité(s) • ${pnl >= 0 ? 'Gain' : 'Perte'} ${formatMoney(pnl)}`;
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
    const shown = pinValue.split('').map(() => '•').join(' ');
    dots.innerText = shown || '• • • •';
  }

  if (pinValue.length === 4) {
    if (pinValue === '0206') {
      window.location.href = 'home.html';
    } else {
      alert('Code incorrect');
      pinValue = '';
      if (dots) dots.innerText = '• • • •';
    }
  }
}

function clearPin() {
  pinValue = '';
  const dots = document.getElementById('pinDots');
  if (dots) dots.innerText = '• • • •';
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
  const cardFront = document.getElementById('cardFront');
  const cardBack = document.getElementById('cardBack');
  const cardTypeSelect = document.getElementById('cardTypeSelect');

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
    statusEl.innerText = appState.cardBlocked ? 'Carte bloquée' : 'Carte active';
    statusEl.className = 'status-pill ' + (appState.cardBlocked ? 'negative' : 'positive');
  }

  const cardType = appState.cardType || 'classic';

  if (cardFront) {
    cardFront.classList.remove('classic', 'premium', 'black');
    cardFront.classList.add(cardType);
  }

  if (cardBack) {
    cardBack.classList.remove('classic', 'premium', 'black');
    cardBack.classList.add(cardType);
  }

  if (cardTypeSelect) {
    cardTypeSelect.value = cardType;
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