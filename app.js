const STORAGE_USERS_KEY = 'rb_users';
const STORAGE_CURRENT_USER_KEY = 'rb_current_user';

let pinValue = '';
let cryptoChart = null;

function getUsers() {
  return JSON.parse(localStorage.getItem(STORAGE_USERS_KEY) || '{}');
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
}

function getCurrentUsername() {
  return localStorage.getItem(STORAGE_CURRENT_USER_KEY);
}

function setCurrentUsername(username) {
  localStorage.setItem(STORAGE_CURRENT_USER_KEY, username);
}

function clearCurrentUsername() {
  localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
}

function createDefaultUser(pin) {
  return {
    pin,
    profile: {
      username: '',
      createdAt: Date.now()
    },
    game: {
      balance: 0,
      clickValue: 1,
      clickLevel: 1,
      lastDailyBonus: 0,
      loans: [],
      activeAccount: 'Principal',
      accounts: {
        Principal: 0
      },
      history: []
    },
    banking: {
      contacts: [
        { name: 'Lina Popelin', iban: 'FR76 1111 1111 1111 1111 1111 111' },
        { name: 'Thibaut Escoffier', iban: 'FR76 2222 2222 2222 2222 2222 222' },
        { name: 'Aglaé', iban: 'FR76 3333 3333 3333 3333 3333 333' },
        { name: 'Gabriel Rattela', iban: 'FR76 4444 4444 4444 4444 4444 444' },
        { name: 'Laura Loreau', iban: 'FR76 5555 5555 5555 5555 5555 555' },
      ]
    },
    crypto: {
      currentAsset: 'BTC',
      assets: {
        BTC: { price: 30000, owned: 0, avgBuyPrice: 0, history: [30000, 30120, 30050], transactions: [] },
        ETH: { price: 2000, owned: 0, avgBuyPrice: 0, history: [2000, 2015, 1998], transactions: [] },
        AAPL: { price: 180, owned: 0, avgBuyPrice: 0, history: [180, 181, 179], transactions: [] },
        TSLA: { price: 250, owned: 0, avgBuyPrice: 0, history: [250, 248, 252], transactions: [] },
        NVDA: { price: 500, owned: 0, avgBuyPrice: 0, history: [500, 506, 503], transactions: [] },
        RCOP: { price: 5000, owned: 0, avgBuyPrice: 0, history: [5000, 5035, 4990], transactions: [] }
      }
    },
    card: {
      blocked: false,
      revealed: false,
      type: 'classic'
    }
  };
}

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

const cardData = {
  numberMasked: '**** **** **** 4821',
  numberFull: '1234 5678 9012 4821',
  expiryMasked: '••/••',
  expiryFull: '12/28',
  cvvMasked: '***',
  cvvFull: '123',
  iban: 'FR76 0612 0000 0000 0000 0000 001'
};

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

function getCurrentUser() {
  const username = getCurrentUsername();
  if (!username) return null;
  const users = getUsers();
  return users[username] || null;
}

function saveCurrentUser(user) {
  const username = getCurrentUsername();
  if (!username) return;
  const users = getUsers();
  users[username] = user;
  saveUsers(users);
}

function formatMoney(value) {
  return Number(value).toFixed(2) + ' €';
}

function getBalance() {
  const user = getCurrentUser();
  return user ? user.game.accounts[user.game.activeAccount] : 0;
}

function setBalance(value) {
  const user = getCurrentUser();
  if (!user) return;
  user.game.accounts[user.game.activeAccount] = value;
  saveCurrentUser(user);
}

function addHistory(line) {
  const user = getCurrentUser();
  if (!user) return;
  user.game.history.unshift(line);
  saveCurrentUser(user);
}

function getNextUpgrade(level) {
  const upgrades = {
    1: { cost: 500, value: 10, nextLevel: 2 },
    2: { cost: 10000, value: 50, nextLevel: 3 },
    3: { cost: 100000, value: 250, nextLevel: 4 }
  };
  return upgrades[level] || null;
}

function updateHomeUI() {
  const user = getCurrentUser();
  if (!user) return;

  const balanceEl = document.getElementById('balance');
  const historyEl = document.getElementById('history');
  const welcomeEl = document.getElementById('welcomeUser');
  const clickLevelText = document.getElementById('clickLevelText');
  const clickUpgradeInfo = document.getElementById('clickUpgradeInfo');
  const loanInfo = document.getElementById('loanInfo');
  const loanList = document.getElementById('loanList');
  const accountsList = document.getElementById('accountsList');
  const paymentBalanceEl = document.getElementById('paymentBalance');

  if (balanceEl) {
    balanceEl.innerText = formatMoney(getBalance());
  }

  if (paymentBalanceEl) {
    paymentBalanceEl.innerText = formatMoney(getBalance());
  } 

  if (welcomeEl) {
    welcomeEl.innerText = `Bienvenue ${getCurrentUsername()} • Compte actif : ${user.game.activeAccount}`;
  }

  if (clickLevelText) {
    clickLevelText.innerText = `Gain par clic : ${user.game.clickValue} €`;
  }

  if (clickUpgradeInfo) {
    const next = getNextUpgrade(user.game.clickLevel);
    clickUpgradeInfo.innerText = next
      ? `Niveau actuel : ${user.game.clickLevel} • Prochaine amélioration : ${next.cost} € pour passer à ${next.value} €/clic`
      : `Niveau maximal atteint`;
  }

  if (loanInfo) {
    const totalLoans = user.game.loans.reduce((sum, loan) => sum + loan.amountRemaining, 0);
    loanInfo.innerText = `Dette totale : ${formatMoney(totalLoans)}`;
  }

  if (loanList) {
    loanList.innerHTML = user.game.loans.length
      ? user.game.loans.map((loan, index) => `
          <div class="list-item">
            Crédit #${index + 1} — restant : ${formatMoney(loan.amountRemaining)}
          </div>
        `).join('')
      : '<div class="list-item">Aucun crédit en cours.</div>';
  }

  if (accountsList) {
    accountsList.innerHTML = Object.entries(user.game.accounts)
      .map(([name, amount]) => `
        <div class="list-item">
          <strong>${name}</strong> — ${formatMoney(amount)}
          ${name === user.game.activeAccount ? '<span class="small"> (actif)</span>' : ''}
        </div>
      `).join('');
  }

  if (historyEl) {
    historyEl.innerHTML = user.game.history.length
      ? user.game.history.map(item => `<div class="list-item">${item}</div>`).join('')
      : '<div class="list-item">Aucune transaction pour le moment.</div>';
  }
}

function getNextUpgrade(level) {
  const upgrades = {
    1: { cost: 500, value: 10, nextLevel: 2 },
    2: { cost: 10000, value: 50, nextLevel: 3 },
    3: { cost: 100000, value: 250, nextLevel: 4 }
  };
  return upgrades[level] || null;
}

function updateCryptoUI() {
  const user = getCurrentUser();
  if (!user) return;

  const assetKey = user.crypto.currentAsset;
  const asset = user.crypto.assets[assetKey];
  if (!asset) return;

  const assetSelect = document.getElementById('assetSelect');
  const portfolioEl = document.getElementById('portfolio');
  const cashBalanceEl = document.getElementById('cashBalance');
  const priceEl = document.getElementById('price');
  const holdingEl = document.getElementById('holding');
  const pnlEl = document.getElementById('pnl');
  const cryptoHistoryEl = document.getElementById('cryptoHistory');

  if (assetSelect) assetSelect.value = assetKey;

  if (portfolioEl) {
    let total = 0;
    Object.values(user.crypto.assets).forEach(a => {
      total += a.owned * a.price;
    });
    portfolioEl.innerText = 'Valeur totale du portefeuille : ' + formatMoney(total);
  }

  if (cashBalanceEl) {
    cashBalanceEl.innerText = 'Solde disponible : ' + formatMoney(getBalance());
  }

  if (priceEl) {
    priceEl.innerText = `${assetKey} : ${formatMoney(asset.price)}`;
  }

  if (holdingEl) {
    holdingEl.innerText = `Possédé : ${asset.owned.toFixed(6)} unité(s) • Valeur : ${formatMoney(asset.owned * asset.price)}`;
  }

  if (pnlEl) {
    const pnl = asset.owned > 0 ? (asset.price - asset.avgBuyPrice) * asset.owned : 0;
    pnlEl.innerHTML = `P/L latent : <span class="${pnl >= 0 ? 'positive' : 'negative'}">${pnl >= 0 ? '+' : ''}${formatMoney(pnl)}</span>`;
  }

  if (cryptoHistoryEl) {
    cryptoHistoryEl.innerHTML = asset.transactions.length
      ? asset.transactions.map(item => `<div class="list-item">${item}</div>`).join('')
      : '<div class="list-item">Aucune transaction pour le moment.</div>';
  }

  renderCryptoChart();
}

function renderCryptoChart() {
  const user = getCurrentUser();
  if (!user) return;

  const canvas = document.getElementById('cryptoChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const asset = user.crypto.assets[user.crypto.currentAsset];
  if (!asset) return;

  let data = Array.isArray(asset.history) ? [...asset.history] : [];
  if (data.length < 2) {
    data = [asset.price, asset.price];
  }

  const isUp = data[data.length - 1] >= data[0];
  const borderColor = isUp ? '#22c55e' : '#ef4444';
  const backgroundColor = isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';

  if (cryptoChart) cryptoChart.destroy();

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

function clickMoney() {
  const user = getCurrentUser();
  if (!user) return;

  user.game.accounts[user.game.activeAccount] += user.game.clickValue;
  user.game.history.unshift(`Clic manuel +${user.game.clickValue.toFixed(2)} €`);
  saveCurrentUser(user);
  updateHomeUI();
  updateCryptoUI();
}

function claimDailyBonus() {
  const user = getCurrentUser();
  if (!user) return;

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (now - user.game.lastDailyBonus < oneDay) {
    alert('Bonus journalier déjà récupéré.');
    return;
  }

  const bonus = 250;
  user.game.lastDailyBonus = now;
  user.game.accounts[user.game.activeAccount] += bonus;
  user.game.history.unshift(`Bonus journalier +${bonus.toFixed(2)} €`);
  saveCurrentUser(user);
  updateHomeUI();
  updateCryptoUI();
}

function upgradeClickIncome() {
  const user = getCurrentUser();
  if (!user) return;

  const next = getNextUpgrade(user.game.clickLevel);
  if (!next) return alert('Niveau maximal atteint.');

  if (getBalance() < next.cost) {
    return alert(`Pas assez d'argent. Il faut ${next.cost} €.`);
  }

  user.game.accounts[user.game.activeAccount] -= next.cost;
  user.game.clickValue = next.value;
  user.game.clickLevel = next.nextLevel;
  user.game.history.unshift(`Amélioration du clic -${next.cost.toFixed(2)} € → ${next.value} €/clic`);
  saveCurrentUser(user);
  updateHomeUI();
  updateCryptoUI();
}

function takeLoan(amount) {
  const user = getCurrentUser();
  if (!user) return;

  const repayment = amount * 1.2;
  user.game.accounts[user.game.activeAccount] += amount;
  user.game.loans.push({
    id: Date.now(),
    principal: amount,
    amountRemaining: repayment
  });
  user.game.history.unshift(`Crédit obtenu +${amount.toFixed(2)} € (remboursement ${repayment.toFixed(2)} €)`);
  saveCurrentUser(user);
  updateHomeUI();
  updateCryptoUI();
}

function repayLoanManual() {
  const user = getCurrentUser();
  if (!user) return;
  processLoanPayment(user, 100, true);
}

function processLoanPayment(user, amount, manual = false) {
  if (!user.game.loans.length) {
    if (manual) alert('Aucun crédit à rembourser.');
    return;
  }

  let available = user.game.accounts[user.game.activeAccount];
  if (available <= 0) {
    if (manual) alert("Pas assez d'argent sur le compte actif.");
    return;
  }

  let remainingPayment = Math.min(amount, available);
  let paidTotal = 0;

  while (remainingPayment > 0 && user.game.loans.length > 0) {
    const loan = user.game.loans[0];
    const payment = Math.min(loan.amountRemaining, remainingPayment);

    loan.amountRemaining -= payment;
    remainingPayment -= payment;
    paidTotal += payment;
    user.game.accounts[user.game.activeAccount] -= payment;

    if (loan.amountRemaining <= 0.001) {
      user.game.loans.shift();
    }
  }

  if (paidTotal > 0) {
    user.game.history.unshift(`Remboursement crédit -${paidTotal.toFixed(2)} €`);
    saveCurrentUser(user);
    updateHomeUI();
    updateCryptoUI();
  }
}

function autoLoanPaymentTick() {
  const user = getCurrentUser();
  if (!user) return;

  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (now - user.game.lastLoanAutoPayment < fiveMinutes) return;
  if (!user.game.loans.length) return;

  user.game.lastLoanAutoPayment = now;
  processLoanPayment(user, 100, false);
  saveCurrentUser(user);
}

function addSubAccount() {
  const user = getCurrentUser();
  if (!user) return;

  const name = prompt('Nom du nouveau compte ?');
  if (!name || !name.trim()) return;

  if (user.game.accounts[name]) {
    alert('Ce compte existe déjà.');
    return;
  }

  user.game.accounts[name] = 0;
  user.game.history.unshift(`Nouveau compte créé : ${name}`);
  saveCurrentUser(user);
  updateHomeUI();
}

function switchSubAccount() {
  const user = getCurrentUser();
  if (!user) return;

  const names = Object.keys(user.game.accounts);
  const chosen = prompt(`Choisis un compte : ${names.join(', ')}`);
  if (!chosen) return;

  if (!user.game.accounts.hasOwnProperty(chosen)) {
    alert('Compte introuvable.');
    return;
  }

  user.game.activeAccount = chosen;
  saveCurrentUser(user);
  updateHomeUI();
  updateCryptoUI();
}

function pressPin(n) {
  pinValue += String(n);
  const dots = document.getElementById('pinDots');

  if (dots) {
    const shown = pinValue.split('').map(() => '•').join(' ');
    dots.innerText = shown || '• • • •';
  }
}

function clearPin() {
  pinValue = '';
  const dots = document.getElementById('pinDots');
  if (dots) dots.innerText = '• • • •';
}

function loginUser() {
  const usernameInput = document.getElementById('loginUsername');
  if (!usernameInput) return;

  const username = usernameInput.value.trim();
  if (!username) return alert("Entre un nom d'utilisateur.");
  if (pinValue.length !== 4) return alert('Entre un code PIN à 4 chiffres.');

  const users = getUsers();
  const user = users[username];

  if (!user) return alert("Ce compte n'existe pas.");
  if (user.pin !== pinValue) {
    alert('Code PIN incorrect.');
    clearPin();
    return;
  }

  setCurrentUsername(username);
  clearPin();
  window.location.href = 'home.html';
}

function startCreateAccount() {
  const usernameInput = document.getElementById('loginUsername');
  if (!usernameInput) return;

  const username = usernameInput.value.trim();
  if (!username) return alert("Entre d'abord un nom d'utilisateur.");
  if (pinValue.length !== 4) return alert('Entre un code PIN à 4 chiffres.');

  const users = getUsers();
  if (users[username]) {
    alert('Ce nom existe déjà.');
    return;
  }

  const newUser = createDefaultUser(pinValue);
  newUser.profile.username = username;

  users[username] = newUser;
  saveUsers(users);
  setCurrentUsername(username);
  clearPin();
  window.location.href = 'home.html';
}

function logout() {
  clearPin();
  clearCurrentUsername();
}

function transfer() {
  const user = getCurrentUser();
  if (!user) return;

  const nameInput = document.getElementById('paymentName');
  const amountInput = document.getElementById('amount');

  if (!nameInput || !amountInput) return;

  const beneficiary = nameInput.value.trim();
  const amount = Number(amountInput.value);

  if (!beneficiary) return alert('Entre un bénéficiaire.');
  if (!amount || amount <= 0) return alert('Entre un montant valide.');
  if (amount > getBalance()) return alert("Pas assez d'argent.");

  user.game.accounts[user.game.activeAccount] -= amount;
  user.game.history.unshift(`Virement ${beneficiary} -${amount.toFixed(2)} €`);
  saveCurrentUser(user);

  amountInput.value = '';
  updateHomeUI();
  syncLegacyPages();
}

function fillContact(name, ibanValue) {
  const nameInput = document.getElementById('paymentName');
  const ibanInput = document.getElementById('iban');
  if (nameInput) nameInput.value = name;
  if (ibanInput) ibanInput.value = ibanValue;
}

function renderContacts() {
  const user = getCurrentUser();
  if (!user) return;

  const contactsList = document.getElementById('contactsList');
  if (!contactsList) return;

  const contacts = user.banking.contacts || [];
  contactsList.innerHTML = contacts.length
    ? contacts.map((contact, index) => `
      <div class="list-item">
        <strong>${contact.name}</strong><br>
        <span class="small">${contact.iban}</span><br>
        <div class="row" style="margin-top:8px;">
          <button onclick="fillContact('${contact.name}', '${contact.iban}')">Utiliser</button>
          <button class="secondary" onclick="deleteContact(${index})">Supprimer</button>
        </div>
      </div>
    `).join('')
    : '<div class="list-item">Aucun contact enregistré.</div>';
}

function addContact() {
  const user = getCurrentUser();
  if (!user) return;

  const name = prompt('Nom du contact ?');
  if (!name || !name.trim()) return;

  const iban = prompt('IBAN du contact ?');
  if (!iban || !iban.trim()) return;

  user.banking.contacts.push({ name: name.trim(), iban: iban.trim() });
  saveCurrentUser(user);
  renderContacts();
}

function deleteContact(index) {
  const user = getCurrentUser();
  if (!user) return;

  user.banking.contacts.splice(index, 1);
  saveCurrentUser(user);
  renderContacts();
}

function selectAsset(assetKey) {
  const user = getCurrentUser();
  if (!user || !user.crypto.assets[assetKey]) return;
  user.crypto.currentAsset = assetKey;
  saveCurrentUser(user);
  syncLegacyPages();
}

function buy() {
  const user = getCurrentUser();
  if (!user) return;

  const input = document.getElementById('investAmount');
  if (!input) return;

  const amount = Number(input.value);
  if (!amount || amount <= 0) return alert('Entre un montant valide.');
  if (amount > getBalance()) return alert("Pas assez d'argent.");

  const asset = user.crypto.assets[user.crypto.currentAsset];
  const qty = amount / asset.price;
  const oldQty = asset.owned;
  const oldCost = oldQty * asset.avgBuyPrice;

  asset.owned += qty;
  asset.avgBuyPrice = (oldCost + amount) / asset.owned;
  user.game.accounts[user.game.activeAccount] -= amount;

  const line = `Achat ${user.crypto.currentAsset} • ${formatMoney(amount)} • ${qty.toFixed(6)} unité(s)`;
  asset.transactions.unshift(line);
  user.game.history.unshift(line);

  saveCurrentUser(user);
  input.value = '';
  updateHomeUI();
  syncLegacyPages();
}

function sellPartial() {
  const user = getCurrentUser();
  if (!user) return;

  const input = document.getElementById('sellAmount');
  if (!input) return;

  const qty = Number(input.value);
  const asset = user.crypto.assets[user.crypto.currentAsset];

  if (!qty || qty <= 0) return alert('Quantité invalide.');
  if (qty > asset.owned) return alert('Pas assez d’unités.');

  const saleValue = qty * asset.price;
  const costBasis = qty * asset.avgBuyPrice;
  const pnl = saleValue - costBasis;

  asset.owned -= qty;
  if (asset.owned <= 0.0000001) {
    asset.owned = 0;
    asset.avgBuyPrice = 0;
  }

  user.game.accounts[user.game.activeAccount] += saleValue;

  const line = `Vente partielle ${user.crypto.currentAsset} • ${formatMoney(saleValue)} • ${pnl >= 0 ? 'Gain' : 'Perte'} ${formatMoney(pnl)}`;
  asset.transactions.unshift(line);
  user.game.history.unshift(line);

  saveCurrentUser(user);
  input.value = '';
  updateHomeUI();
  syncLegacyPages();
}

function sellAll() {
  const user = getCurrentUser();
  if (!user) return;

  const asset = user.crypto.assets[user.crypto.currentAsset];
  if (asset.owned <= 0) return alert('Rien à vendre.');

  const qty = asset.owned;
  const saleValue = qty * asset.price;
  const costBasis = qty * asset.avgBuyPrice;
  const pnl = saleValue - costBasis;

  user.game.accounts[user.game.activeAccount] += saleValue;

  const line = `Vente ${user.crypto.currentAsset} • ${formatMoney(saleValue)} • ${pnl >= 0 ? 'Gain' : 'Perte'} ${formatMoney(pnl)}`;
  asset.transactions.unshift(line);
  user.game.history.unshift(line);

  asset.owned = 0;
  asset.avgBuyPrice = 0;

  saveCurrentUser(user);
  updateHomeUI();
  syncLegacyPages();
}

function tickCryptoPrices() {
  const user = getCurrentUser();
  if (!user) return;

  Object.keys(user.crypto.assets).forEach(key => {
    const asset = user.crypto.assets[key];
    const change = (Math.random() * 2 - 1) * asset.price * 0.02;
    asset.price = Math.max(0.01, asset.price + change);
    asset.history.push(asset.price);
    if (asset.history.length > 30) asset.history.shift();
  });

  saveCurrentUser(user);
  updateCryptoUI();
}

window.onload = () => {
  const currentPage = window.location.pathname.split('/').pop();

  if (currentPage !== 'login.html' && !getCurrentUser()) {
    window.location.href = 'login.html';
    return;
  }

  updateHomeUI();
  syncLegacyPages();
  renderContacts();

  setInterval(() => {
    tickCryptoPrices();
    autoLoanPaymentTick();
  }, 2000);
};