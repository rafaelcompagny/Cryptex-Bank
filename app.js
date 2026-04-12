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

function normalizeName(name) {
  return String(name || '').trim();
}

function makeDisplayName(username) {
  const clean = normalizeName(username);
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Utilisateur';
}

function generateUniqueIban(users) {
  let iban = '';
  let exists = true;

  while (exists) {
    const randomPart = Array.from({ length: 23 }, () => Math.floor(Math.random() * 10)).join('');
    iban = 'FR76' + randomPart;
    exists = Object.values(users).some(user => user.profile && user.profile.iban === iban);
  }

  return iban;
}

function ensureAdminUser() {
  const users = getUsers();
  if (!users.admin) {
    users.admin = {
      pin: '0000',
      profile: {
        username: 'admin',
        displayName: 'Admin',
        iban: generateUniqueIban(users),
        createdAt: Date.now(),
        isAdmin: true
      },
      game: {
        clickValue: 100,
        clickLevel: 99,
        lastDailyBonus: 0,
        lastLoanAutoPayment: 0,
        loans: [],
        activeAccount: 'Principal',
        accounts: {
          Principal: 1000000000
        },
        history: ['Compte admin créé avec 1 000 000 000.00 €'],
        boost: {
          doubleMoneyUntil: 0
        },
      },
      banking: {
        contacts: []
      },
      crypto: {
        currentAsset: 'BTC',
        randomMode: true,
        assets: defaultAssets(),
      },
      card: {
        blocked: false,
        revealed: false,
        type: 'black'
      }
    };
    saveUsers(users);
  }
  
  syncAdminMarketToAllUsers();
}

function getTotalUserBalance(user) {
  return Object.values(user.game.accounts || {}).reduce((sum, value) => sum + value, 0);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderAdminDashboard() {
  const currentUser = getCurrentUser();
  const container = document.getElementById('adminUsersList');

  if (!container) return;
  if (!currentUser || !currentUser.profile.isAdmin) {
    container.innerHTML = '<div class="list-item">Accès refusé.</div>';
    return;
  }

  const users = getUsers();
  const entries = Object.entries(users);

  container.innerHTML = entries.map(([username, user], index) => {
    const totalBalance = getTotalUserBalance(user);
    const historyId = `historyPopup${index}`;
    const cryptoHistoryId = `cryptoHistoryPopup${index}`;

    const cryptoHistoryLines = Object.entries(user.crypto?.assets || {}).flatMap(([assetKey, asset]) => {
      const txs = Array.isArray(asset.transactions) ? asset.transactions : [];
      return txs.map(line => `${assetKey} — ${line}`);
    });

    return `
      <div class="card" style="margin-bottom:16px;">
        <h3>${escapeHtml(user.profile.displayName)}</h3>
        <p><strong>Nom d'utilisateur :</strong> ${escapeHtml(username)}</p>
        <p><strong>PIN :</strong> ${escapeHtml(user.pin || 'Aucun')}</p>
        <p><strong>IBAN :</strong> ${escapeHtml(user.profile.iban)}</p>
        <p><strong>Solde total :</strong> ${formatMoney(totalBalance)}</p>
        <p><strong>Compte admin :</strong> ${user.profile.isAdmin ? 'Oui' : 'Non'}</p>

        <div class="row">
          <button onclick="toggleHistoryPopup('${historyId}')">Historique banque</button>
          <button onclick="toggleHistoryPopup('${cryptoHistoryId}')">Historique crypto</button>
          <button onclick="adminChangeUserPin('${escapeHtml(username)}')">Modifier PIN</button>
          <button class="secondary" onclick="adminRemoveUserPin('${escapeHtml(username)}')">Supprimer PIN</button>
          <button onclick="adminToggleUserAdmin('${escapeHtml(username)}')">
            ${user.profile.isAdmin ? 'Retirer admin' : 'Mettre admin'}
          </button>
          <button class="secondary" onclick="adminRemoveMoney('${escapeHtml(username)}')">Retirer argent</button>
          <button class="secondary" onclick="adminDeleteUser('${escapeHtml(username)}')">Supprimer joueur</button>
        </div>

        <div id="${historyId}" class="history-popup" style="display:none; margin-top:12px;">
          <div class="list-item">
            ${
              user.game.history && user.game.history.length
                ? user.game.history.map(item => `<div style="margin-bottom:6px;">${escapeHtml(item)}</div>`).join('')
                : 'Aucun historique.'
            }
          </div>
        </div>

        <div id="${cryptoHistoryId}" class="history-popup" style="display:none; margin-top:12px;">
          <div class="list-item">
            ${
              cryptoHistoryLines.length
                ? cryptoHistoryLines.map(item => `<div style="margin-bottom:6px;">${escapeHtml(item)}</div>`).join('')
                : 'Aucun historique crypto.'
            }
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function adminDeleteUser(username) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.profile.isAdmin) return;

  if (username === 'admin') {
    alert("Impossible de supprimer le compte admin principal.");
    return;
  }

  if (username === currentUser.profile.username) {
    alert("Tu ne peux pas te supprimer toi-même.");
    return;
  }

  const users = getUsers();
  if (!users[username]) {
    alert('Utilisateur introuvable.');
    return;
  }

  const confirmed = confirm(`Supprimer définitivement le joueur ${username} ?`);
  if (!confirmed) return;

  delete users[username];
  saveUsers(users);
  renderAdminDashboard();
}

function adminRemoveMoney(username) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.profile.isAdmin) return;

  const users = getUsers();
  const targetUser = users[username];

  if (!targetUser) {
    alert('Utilisateur introuvable.');
    return;
  }

  const amount = Number(prompt(`Montant à retirer à ${username} ?`));
  if (!amount || amount <= 0) {
    alert('Montant invalide.');
    return;
  }

  const activeAccount = targetUser.game.activeAccount || 'Principal';
  if (!targetUser.game.accounts[activeAccount]) {
    targetUser.game.accounts[activeAccount] = 0;
  }

  const removable = Math.min(amount, targetUser.game.accounts[activeAccount]);
  targetUser.game.accounts[activeAccount] -= removable;

  if (!Array.isArray(targetUser.game.history)) {
    targetUser.game.history = [];
  }

  targetUser.game.history.unshift(`Retrait admin -${removable.toFixed(2)} €`);
  users[username] = targetUser;
  saveUsers(users);

  renderAdminDashboard();
}

function adminChangeUserPin(username) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.profile.isAdmin) return;

  const users = getUsers();
  if (!users[username]) return alert('Utilisateur introuvable.');

  const newPin = prompt(`Nouveau PIN pour ${username} ? (4 chiffres)`);
  if (!newPin) return;
  if (!/^\d{4}$/.test(newPin)) return alert('Le PIN doit contenir exactement 4 chiffres.');

  users[username].pin = newPin;
  if (users[username].game && users[username].game.history) {
    users[username].game.history.unshift('PIN modifié par admin');
  }

  saveUsers(users);
  renderAdminDashboard();
}

function adminRemoveUserPin(username) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.profile.isAdmin) return;

  const users = getUsers();
  if (!users[username]) return alert('Utilisateur introuvable.');

  users[username].pin = '';
  if (users[username].game && users[username].game.history) {
    users[username].game.history.unshift('PIN supprimé par admin');
  }

  saveUsers(users);
  renderAdminDashboard();
}

function adminToggleUserAdmin(username) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.profile.isAdmin) return;

  const users = getUsers();
  if (!users[username]) return alert('Utilisateur introuvable.');

  users[username].profile.isAdmin = !users[username].profile.isAdmin;

  if (users[username].game && users[username].game.history) {
    users[username].game.history.unshift(
      users[username].profile.isAdmin
        ? 'Compte promu admin'
        : 'Compte retiré du rôle admin'
    );
  }

  saveUsers(users);
  renderAdminDashboard();
}

function updateAdminNavVisibility() {
  const user = getCurrentUser();
  const adminNavLink = document.getElementById('adminNavLink');
  if (!adminNavLink) return;

  adminNavLink.style.display = user && user.profile.isAdmin ? 'block' : 'none';
}

function adminAddUnlimitedMoney() {
  const user = getCurrentUser();
  if (!user || !user.profile.isAdmin) return;

  const amount = Number(prompt("Montant à ajouter au compte actif ?"));
  if (!amount || amount <= 0) return alert('Montant invalide.');

  user.game.accounts[user.game.activeAccount] += amount;
  user.game.history.unshift(`Ajout admin +${amount.toFixed(2)} €`);
  saveCurrentUser(user);
  updateHomeUI();
  updateCryptoUI();
}

function toggleHistoryPopup(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function defaultAssets() {
  return {
    BTC: { price: 30000, owned: 0, avgBuyPrice: 0, history: [30000, 30120, 30050], transactions: [] },
    ETH: { price: 2000, owned: 0, avgBuyPrice: 0, history: [2000, 2015, 1998], transactions: [] },
    AAPL: { price: 180, owned: 0, avgBuyPrice: 0, history: [180, 181, 179], transactions: [] },
    TSLA: { price: 250, owned: 0, avgBuyPrice: 0, history: [250, 248, 252], transactions: [] },
    NVDA: { price: 500, owned: 0, avgBuyPrice: 0, history: [500, 506, 503], transactions: [] },
    RCOP: { price: 5000, owned: 0, avgBuyPrice: 0, history: [5000, 5035, 4990], transactions: [] }
  };
}

function createDefaultUser(pin, username, users) {
  return {
    pin,
    profile: {
      username,
      displayName: makeDisplayName(username),
      iban: generateUniqueIban(users),
      createdAt: Date.now(),
      isAdmin: false
    },
    game: {
      clickValue: 1,
      clickLevel: 1,
      lastDailyBonus: 0,
      lastLoanAutoPayment: 0,
      loans: [],
      activeAccount: 'Principal',
      accounts: {
        Principal: 0
      },
      history: ['Compte créé avec succès'],
      boost: {
        doubleMoneyUntil: 0
      }
    },
    banking: {
      contacts: []
    },
    crypto: {
      currentAsset: 'BTC',
      randomMode: true,
      assets: defaultAssets()
    },
    card: {
      blocked: false,
      revealed: false,
      type: 'classic'
    }
  };
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

function getNextUpgrade(level) {
  const upgrades = {
    1: { cost: 500, value: 10, nextLevel: 2 },
    2: { cost: 10000, value: 50, nextLevel: 3 },
    3: { cost: 100000, value: 250, nextLevel: 4 },
    4: { cost: 1000000, value: 1000, nextLevel: 5 },
  };
  return upgrades[level] || null;
}

function addHistory(line) {
  const user = getCurrentUser();
  if (!user) return;
  user.game.history.unshift(line);
  saveCurrentUser(user);
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
  const boostInfo = document.getElementById('boostInfo');
  const loanTimer = document.getElementById('loanTimer');
  const adminAddMoneyBtn = document.getElementById('adminAddMoneyBtn');
  const now = Date.now();
  const boostActive = now < user.game.boost.doubleMoneyUntil;
  const displayedClickValue = boostActive ? user.game.clickValue * 2 : user.game.clickValue;


  if (balanceEl) balanceEl.innerText = formatMoney(getBalance());
  if (paymentBalanceEl) paymentBalanceEl.innerText = formatMoney(getBalance());

  if (welcomeEl) {
    welcomeEl.innerText = `Bienvenue ${user.profile.displayName} • Compte actif : ${user.game.activeAccount}`;
  }

  if (!user.game.boost) {
    user.game.boost = { doubleMoneyUntil: 0 };
  }

  if (clickLevelText) {
    clickLevelText.innerText = boostActive
      ? `Gain par clic : ${displayedClickValue} € (x2 actif)`
      : `Gain par clic : ${displayedClickValue} €`;
  }

  if (clickUpgradeInfo) {
    const next = getNextUpgrade(user.game.clickLevel);
    clickUpgradeInfo.innerText = next
      ? `Niveau actuel : ${user.game.clickLevel} • Prochaine amélioration : ${next.cost} € pour passer à ${next.value} €/clic`
      : 'Niveau maximal atteint';
  }

  if (loanInfo) {
    const totalLoans = user.game.loans.reduce((sum, loan) => sum + loan.amountRemaining, 0);
    loanInfo.innerText = `Dette totale : ${formatMoney(totalLoans)}`;
  }

  if (loanList) {
    loanList.innerHTML = user.game.loans.length
      ? user.game.loans.map((loan, index) => `
        <div class="list-item">Crédit #${index + 1} — restant : ${formatMoney(loan.amountRemaining)}</div>
      `).join('')
      : '<div class="list-item">Aucun crédit en cours.</div>';
  }

  if (accountsList) {
    accountsList.innerHTML = Object.entries(user.game.accounts).map(([name, amount]) => `
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

    if (!user.game.boost) {
    user.game.boost = { doubleMoneyUntil: 0 };
  }

  if (boostInfo) {
    const now = Date.now();
    if (now < user.game.boost.doubleMoneyUntil) {
      const remainingMs = user.game.boost.doubleMoneyUntil - now;
      const seconds = Math.floor((remainingMs / 1000) % 60);
      const minutes = Math.floor(remainingMs / 60000);
      boostInfo.innerText = `Boost x2 actif pendant encore ${minutes} min ${seconds} s`;
    } else {
      boostInfo.innerText = 'Aucun boost actif';
    }
  }

  if (loanTimer) {
    if (user.game.loans.length === 0) {
      loanTimer.innerText = 'Aucun prélèvement automatique en attente.';
    } else {
      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;
      const nextTime = (user.game.lastLoanAutoPayment || 0) + twoMinutes;
      const remainingMs = Math.max(0, nextTime - now);
      const seconds = Math.floor((remainingMs / 1000) % 60);
      const minutes = Math.floor(remainingMs / 60000);
      loanTimer.innerText = `Prochain prélèvement auto de 100 € dans ${minutes} min ${seconds} s`;
    }
  }

  if (adminAddMoneyBtn) {
    adminAddMoneyBtn.style.display = user.profile.isAdmin ? 'inline-block' : 'none';
  }
}

function syncAdminMarketToAllUsers() {
  const users = getUsers();
  const adminUser = users.admin;

  if (!adminUser || !adminUser.crypto || !adminUser.crypto.assets) return;

  const adminAssets = adminUser.crypto.assets;
  const adminRandomMode = adminUser.crypto.randomMode;

  Object.keys(users).forEach(username => {
    const user = users[username];

    if (!user.crypto) {
      user.crypto = {
        currentAsset: 'BTC',
        randomMode: adminRandomMode,
        assets: {}
      };
    }

    if (!user.crypto.assets) {
      user.crypto.assets = {};
    }

    Object.keys(adminAssets).forEach(assetKey => {
      const adminAsset = adminAssets[assetKey];

      if (!user.crypto.assets[assetKey]) {
        user.crypto.assets[assetKey] = {
          price: adminAsset.price,
          owned: 0,
          avgBuyPrice: 0,
          history: [...adminAsset.history],
          transactions: []
        };
      } else {
        // On ne synchronise QUE le marché
        user.crypto.assets[assetKey].price = adminAsset.price;
        user.crypto.assets[assetKey].history = [...adminAsset.history];

        // On garde owned / avgBuyPrice / transactions propres au joueur
        if (typeof user.crypto.assets[assetKey].owned !== 'number') {
          user.crypto.assets[assetKey].owned = 0;
        }

        if (typeof user.crypto.assets[assetKey].avgBuyPrice !== 'number') {
          user.crypto.assets[assetKey].avgBuyPrice = 0;
        }

        if (!Array.isArray(user.crypto.assets[assetKey].transactions)) {
          user.crypto.assets[assetKey].transactions = [];
        }
      }
    });

    user.crypto.randomMode = adminRandomMode;

    if (!user.crypto.currentAsset) {
      user.crypto.currentAsset = 'BTC';
    }
  });

  saveUsers(users);
}

function pullMarketFromAdminForCurrentUser() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const users = getUsers();
  const adminUser = users.admin;
  if (!adminUser || !adminUser.crypto || !adminUser.crypto.assets) return;

  if (!currentUser.crypto) {
    currentUser.crypto = {
      currentAsset: 'BTC',
      randomMode: adminUser.crypto.randomMode,
      assets: {}
    };
  }

  if (!currentUser.crypto.assets) {
    currentUser.crypto.assets = {};
  }

  Object.keys(adminUser.crypto.assets).forEach(assetKey => {
    const adminAsset = adminUser.crypto.assets[assetKey];

    if (!currentUser.crypto.assets[assetKey]) {
      currentUser.crypto.assets[assetKey] = {
        price: adminAsset.price,
        owned: 0,
        avgBuyPrice: 0,
        history: [...adminAsset.history],
        transactions: []
      };
    } else {
      currentUser.crypto.assets[assetKey].price = adminAsset.price;
      currentUser.crypto.assets[assetKey].history = [...adminAsset.history];

      if (typeof currentUser.crypto.assets[assetKey].owned !== 'number') {
        currentUser.crypto.assets[assetKey].owned = 0;
      }

      if (typeof currentUser.crypto.assets[assetKey].avgBuyPrice !== 'number') {
        currentUser.crypto.assets[assetKey].avgBuyPrice = 0;
      }

      if (!Array.isArray(currentUser.crypto.assets[assetKey].transactions)) {
        currentUser.crypto.assets[assetKey].transactions = [];
      }
    }
  });

  currentUser.crypto.randomMode = adminUser.crypto.randomMode;

  if (!currentUser.crypto.currentAsset) {
    currentUser.crypto.currentAsset = 'BTC';
  }

  saveCurrentUser(currentUser);
}

function updateCryptoUI(forceRefreshAdminInputs = false) {
  const user = getCurrentUser();
  if (!user || !user.crypto || !user.crypto.assets) return;

  const assetKey = user.crypto.currentAsset || 'BTC';
  const asset = user.crypto.assets[assetKey];
  if (!asset) return;

  const assetSelect = document.getElementById('assetSelect');
  const portfolioEl = document.getElementById('portfolio');
  const cashBalanceEl = document.getElementById('cashBalance');
  const priceEl = document.getElementById('price');
  const holdingEl = document.getElementById('holding');
  const pnlEl = document.getElementById('pnl');
  const cryptoHistoryEl = document.getElementById('cryptoHistory');

  const adminCryptoPanel = document.getElementById('adminCryptoPanel');
  const toggleCryptoModeBtn = document.getElementById('toggleCryptoModeBtn');
  const cryptoModeInfo = document.getElementById('cryptoModeInfo');
  const adminAssetSelect = document.getElementById('adminAssetSelect');
  const adminAssetPrice = document.getElementById('adminAssetPrice');

  if (assetSelect) assetSelect.value = assetKey;

  if (portfolioEl) {
    let total = 0;
    Object.values(user.crypto.assets).forEach(a => total += a.owned * a.price);
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

  if (adminCryptoPanel) {
    adminCryptoPanel.style.display = user.profile.isAdmin ? 'block' : 'none';
  }

  if (toggleCryptoModeBtn) {
    toggleCryptoModeBtn.innerText = user.crypto.randomMode
      ? 'Passer en mode manuel'
      : 'Repasser en mode aléatoire';
  }

  if (cryptoModeInfo) {
    cryptoModeInfo.innerText = user.crypto.randomMode
      ? 'Mode actuel : aléatoire'
      : 'Mode actuel : manuel';
  }

  if (adminAssetSelect) {
    adminAssetSelect.value = assetKey;
  }

  // IMPORTANT :
  // en mode manuel, on ne réécrit pas le champ pendant que l'admin tape
  if (adminAssetPrice && (forceRefreshAdminInputs || user.crypto.randomMode)) {
    adminAssetPrice.value = asset.price.toFixed(2);
  }

  renderCryptoChart();
}

function toggleCryptoAdminMode() {
  const user = getCurrentUser();
  if (!user || !user.profile.isAdmin) return;

  user.crypto.randomMode = !user.crypto.randomMode;
  saveCurrentUser(user);

  syncAdminMarketToAllUsers();
  updateCryptoUI(true);
}

function syncAdminAssetSelection(assetKey) {
  const user = getCurrentUser();
  if (!user || !user.profile.isAdmin) return;

  user.crypto.currentAsset = assetKey;
  saveCurrentUser(user);

  // On force la mise à jour du prix affiché pour le nouvel actif
  updateCryptoUI(true);
}

function adminSetCryptoPrice() {
  const user = getCurrentUser();
  if (!user || !user.profile.isAdmin) return;

  const assetKey = user.crypto.currentAsset;
  const input = document.getElementById('adminAssetPrice');
  if (!input) return;

  const newPrice = Number(input.value.replace(',', '.'));
  if (!newPrice || newPrice <= 0) {
    alert('Prix invalide.');
    return;
  }

  const asset = user.crypto.assets[assetKey];
  if (!asset) return;

  asset.price = newPrice;

  if (!Array.isArray(asset.history)) {
    asset.history = [newPrice];
  }

  asset.history.push(newPrice);
  if (asset.history.length > 30) {
    asset.history.shift();
  }

  user.game.history.unshift(`Prix admin défini pour ${assetKey} : ${newPrice.toFixed(2)} €`);
  saveCurrentUser(user);

  syncAdminMarketToAllUsers();
  updateCryptoUI(true);
}

function renderCryptoChart() {
  const user = getCurrentUser();
  if (!user) return;

  const canvas = document.getElementById('cryptoChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const asset = user.crypto.assets[user.crypto.currentAsset];
  if (!asset) return;

  let data = Array.isArray(asset.history) ? [...asset.history] : [];
  if (data.length < 2) data = [asset.price, asset.price * 1.01];

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
      animation: { duration: 400 },
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

  if (!user.game.boost) {
    user.game.boost = { doubleMoneyUntil: 0 };
  }

  const now = Date.now();
  const isBoostActive = now < user.game.boost.doubleMoneyUntil;
  const gain = isBoostActive ? user.game.clickValue * 2 : user.game.clickValue;

  user.game.accounts[user.game.activeAccount] += gain;
  saveCurrentUser(user);
  updateHomeUI();
  updateCryptoUI();
}

function buyDoubleMoneyBoost() {
  const user = getCurrentUser();
  if (!user) return;

  if (!user.game.boost) {
    user.game.boost = { doubleMoneyUntil: 0 };
  }

  const boostPrice = 1000;
  const durationMs = 60 * 1000;
  const now = Date.now();

  if (getBalance() < boostPrice) {
    alert(`Pas assez d'argent. Il faut ${boostPrice} €.`);
    return;
  }

  if (now < user.game.boost.doubleMoneyUntil) {
    alert('Le boost x2 est déjà actif.');
    return;
  }

  user.game.accounts[user.game.activeAccount] -= boostPrice;
  user.game.boost.doubleMoneyUntil = now + durationMs;
  user.game.history.unshift(`Boost x2 acheté -${boostPrice.toFixed(2)} € (1 min)`);
  saveCurrentUser(user);
  updateHomeUI();
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
  if (getBalance() < next.cost) return alert(`Pas assez d'argent. Il faut ${next.cost} €.`);

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

function processLoanPayment(user, amount) {
  if (!user.game.loans.length) return 0;

  let available = user.game.accounts[user.game.activeAccount];
  if (available <= 0) return 0;

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

  return paidTotal;
}

function repayAllLoans() {
  const user = getCurrentUser();
  if (!user) return;

  if (!user.game.loans.length) {
    alert('Aucun crédit à rembourser.');
    return;
  }

  let totalDebt = user.game.loans.reduce((sum, loan) => sum + loan.amountRemaining, 0);
  let available = user.game.accounts[user.game.activeAccount];
  let amountToPay = Math.min(totalDebt, available);

  if (amountToPay <= 0) {
    alert("Pas assez d'argent sur le compte actif.");
    return;
  }

  const paid = processLoanPayment(user, amountToPay);

  if (paid > 0) {
    user.game.history.unshift(`Remboursement total/partiel crédit -${paid.toFixed(2)} €`);
    saveCurrentUser(user);
    updateHomeUI();
    updateCryptoUI();
  }
}

function autoLoanPaymentTick() {
  const user = getCurrentUser();
  if (!user) return;

  const now = Date.now();
  const twoMinutes = 2 * 60 * 1000;

  if (!user.game.loans.length) return;
  if (now - user.game.lastLoanAutoPayment < twoMinutes) return;

  user.game.lastLoanAutoPayment = now;

  const paid = processLoanPayment(user, 100);
  if (paid > 0) {
    user.game.history.unshift(`Prélèvement auto crédit -${paid.toFixed(2)} €`);
  }

  saveCurrentUser(user);
  updateHomeUI();
  updateCryptoUI();
}

function addSubAccount() {
  const user = getCurrentUser();
  if (!user) return;

  const name = prompt('Nom du nouveau compte ?');
  if (!name || !name.trim()) return;
  if (user.game.accounts[name]) return alert('Ce compte existe déjà.');

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
  if (!user.game.accounts.hasOwnProperty(chosen)) return alert('Compte introuvable.');

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

  const username = normalizeName(usernameInput.value);
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

  const username = normalizeName(usernameInput.value);
  if (!username) return alert("Entre d'abord un nom d'utilisateur.");
  if (pinValue.length !== 4) return alert('Entre un code PIN à 4 chiffres.');

  const users = getUsers();
  if (users[username]) return alert('Ce nom existe déjà.');

  const newUser = createDefaultUser(pinValue, username, users);
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

function renderContacts() {
  const user = getCurrentUser();
  if (!user) return;

  const contactsList = document.getElementById('contactsList');
  const myIban = document.getElementById('myIban');
  const adminPanel = document.getElementById('adminPanel');

  if (myIban) myIban.innerText = user.profile.iban;
  if (adminPanel) adminPanel.style.display = user.profile.isAdmin ? 'block' : 'none';
  if (!contactsList) return;

  const contacts = user.banking.contacts || [];
  contactsList.innerHTML = contacts.length
    ? contacts.map((contact, index) => `
      <div class="list-item">
        <strong>${contact.name}</strong><br>
        <span class="small">${contact.iban}</span><br>
        <div class="row" style="margin-top:8px;">
          <button onclick="fillContact('${contact.name.replace(/'/g, "\\'")}', '${contact.iban}')">Utiliser</button>
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

function renderAllUsersAsContacts() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const users = getUsers();
  currentUser.banking.contacts = Object.values(users)
    .filter(user => user.profile.username !== currentUser.profile.username)
    .map(user => ({
      name: user.profile.displayName,
      iban: user.profile.iban
    }));

  saveCurrentUser(currentUser);
  renderContacts();
}

function fillContact(name, ibanValue) {
  const nameInput = document.getElementById('paymentName');
  const ibanInput = document.getElementById('iban');
  if (nameInput) nameInput.value = name;
  if (ibanInput) ibanInput.value = ibanValue;
}

function findUserByIbanOrName(value) {
  const users = getUsers();
  const clean = normalizeName(value).toLowerCase();

  return Object.entries(users).find(([_, user]) => {
    const username = normalizeName(user.profile.username).toLowerCase();
    const displayName = normalizeName(user.profile.displayName).toLowerCase();
    const iban = normalizeName(user.profile.iban).toLowerCase();
    return clean === username || clean === displayName || clean === iban;
  });
}

function transfer() {
  const sender = getCurrentUser();
  if (!sender) return;

  const nameInput = document.getElementById('paymentName');
  const ibanInput = document.getElementById('iban');
  const amountInput = document.getElementById('amount');

  if (!nameInput || !ibanInput || !amountInput) return;

  const beneficiaryName = normalizeName(nameInput.value);
  const iban = normalizeName(ibanInput.value);
  const amount = Number(amountInput.value);

  if (!beneficiaryName && !iban) return alert('Entre un bénéficiaire ou un IBAN.');
  if (!amount || amount <= 0) return alert('Entre un montant valide.');
  if (amount > getBalance()) return alert("Pas assez d'argent.");

  const found = findUserByIbanOrName(iban || beneficiaryName);
  if (!found) return alert("Aucun compte Rafael Bank trouvé.");

  const [targetUsername, targetUser] = found;

  if (targetUsername === sender.profile.username) {
    return alert("Tu ne peux pas t'envoyer un virement à toi-même.");
  }

  sender.game.accounts[sender.game.activeAccount] -= amount;
  targetUser.game.accounts[targetUser.game.activeAccount] += amount;

  sender.game.history.unshift(`Virement envoyé à ${targetUser.profile.displayName} -${amount.toFixed(2)} €`);
  targetUser.game.history.unshift(`Virement reçu de ${sender.profile.displayName} +${amount.toFixed(2)} €`);

  const users = getUsers();
  users[sender.profile.username] = sender;
  users[targetUsername] = targetUser;
  saveUsers(users);

  amountInput.value = '';
  updateHomeUI();
  updateCryptoUI();
  renderContacts();
}

function adminSendMoney() {
  const admin = getCurrentUser();
  if (!admin || !admin.profile.isAdmin) return;

  const userInput = document.getElementById('adminTargetUser');
  const amountInput = document.getElementById('adminAmount');
  if (!userInput || !amountInput) return;

  const targetValue = normalizeName(userInput.value);
  const amount = Number(amountInput.value);

  if (!targetValue) return alert('Entre un joueur.');
  if (!amount || amount <= 0) return alert('Entre un montant valide.');

  const found = findUserByIbanOrName(targetValue);
  if (!found) return alert('Joueur introuvable.');

  const [targetUsername, targetUser] = found;
  if (targetUsername === admin.profile.username) return alert("Impossible d'envoyer à toi-même ici.");

  targetUser.game.accounts[targetUser.game.activeAccount] += amount;
  targetUser.game.history.unshift(`Cadeau admin +${amount.toFixed(2)} €`);
  admin.game.history.unshift(`Envoi admin vers ${targetUser.profile.displayName} -${amount.toFixed(2)} €`);

  const users = getUsers();
  users[admin.profile.username] = admin;
  users[targetUsername] = targetUser;
  saveUsers(users);

  userInput.value = '';
  amountInput.value = '';

  updateHomeUI();
  renderContacts();
  alert('Argent envoyé.');
}

function selectAsset(assetKey) {
  const user = getCurrentUser();
  if (!user || !user.crypto.assets[assetKey]) return;
  user.crypto.currentAsset = assetKey;
  saveCurrentUser(user);
  updateCryptoUI();
}

function buy() {
  const user = getCurrentUser();
  if (!user) return;

  const input = document.getElementById('investAmount');
  if (!input) return;

  const amount = Number(input.value);
  if (!amount || amount <= 0) return alert('Entre un montant valide.');
  if (amount > getBalance()) return alert("Pas assez d'argent.");

  const assetKey = user.crypto.currentAsset;
  const asset = user.crypto.assets[assetKey];
  const qty = amount / asset.price;
  const oldQty = asset.owned;
  const oldCost = oldQty * asset.avgBuyPrice;

  asset.owned += qty;
  asset.avgBuyPrice = (oldCost + amount) / asset.owned;
  user.game.accounts[user.game.activeAccount] -= amount;

  const line = `Achat ${assetKey} • ${formatMoney(amount)} • ${qty.toFixed(6)} unité(s) à ${formatMoney(asset.price)}`;
  asset.transactions.unshift(line);
  user.game.history.unshift(line);

  saveCurrentUser(user);
  input.value = '';
  updateHomeUI();
  updateCryptoUI();
}

function sellPartial() {
  const user = getCurrentUser();
  if (!user) return;

  const input = document.getElementById('sellAmount');
  if (!input) return;

  const qty = Number(input.value);
  const assetKey = user.crypto.currentAsset;
  const asset = user.crypto.assets[assetKey];

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

  const line = `Vente partielle ${assetKey} • ${formatMoney(saleValue)} • ${qty.toFixed(6)} unité(s) • ${pnl >= 0 ? 'Gain' : 'Perte'} ${formatMoney(pnl)}`;
  asset.transactions.unshift(line);
  user.game.history.unshift(line);

  saveCurrentUser(user);
  input.value = '';
  updateHomeUI();
  updateCryptoUI();
}

function sellAll() {
  const user = getCurrentUser();
  if (!user) return;

  const assetKey = user.crypto.currentAsset;
  const asset = user.crypto.assets[assetKey];
  if (asset.owned <= 0) return alert('Rien à vendre.');

  const qty = asset.owned;
  const saleValue = qty * asset.price;
  const costBasis = qty * asset.avgBuyPrice;
  const pnl = saleValue - costBasis;

  user.game.accounts[user.game.activeAccount] += saleValue;

  const line = `Vente ${assetKey} • ${formatMoney(saleValue)} • ${qty.toFixed(6)} unité(s) • ${pnl >= 0 ? 'Gain' : 'Perte'} ${formatMoney(pnl)}`;
  asset.transactions.unshift(line);
  user.game.history.unshift(line);

  asset.owned = 0;
  asset.avgBuyPrice = 0;

  saveCurrentUser(user);
  updateHomeUI();
  updateCryptoUI();
}

function tickCryptoPrices() {
  const user = getCurrentUser();
  if (!user) return;

  // Si non-admin : on récupère juste le marché global
  if (!user.profile.isAdmin) {
    pullMarketFromAdminForCurrentUser();
    updateCryptoUI();
    return;
  }

  // Admin en manuel : on synchronise le marché vers tout le monde sans toucher aux investissements perso
  if (user.crypto.randomMode === false) {
    syncAdminMarketToAllUsers();
    updateCryptoUI();
    return;
  }

  // Admin en aléatoire : il fait bouger le marché global
  Object.keys(user.crypto.assets).forEach(key => {
    const asset = user.crypto.assets[key];

    if (typeof asset.price !== 'number' || asset.price <= 0) {
      asset.price = 100;
    }

    if (!Array.isArray(asset.history)) {
      asset.history = [asset.price];
    }

    const changePercent = (Math.random() * 2 - 1) * 0.02;
    const newPrice = Math.max(0.01, asset.price * (1 + changePercent));

    asset.price = newPrice;
    asset.history.push(newPrice);

    if (asset.history.length > 30) {
      asset.history.shift();
    }
  });

  saveCurrentUser(user);
  syncAdminMarketToAllUsers();
  updateCryptoUI();
}

function flipCard() {
  const cardInner = document.getElementById('cardInner');
  if (cardInner) cardInner.classList.toggle('flip');
}

function showFullCard() {
  const user = getCurrentUser();
  if (!user) return;

  const entered = prompt('Entre le code PIN pour afficher les informations de la carte :');
  if (entered !== user.pin) {
    alert('Code incorrect');
    return;
  }

  user.card.revealed = !user.card.revealed;
  saveCurrentUser(user);
  updateCardUI();
}

function toggleCardBlock() {
  const user = getCurrentUser();
  if (!user) return;

  user.card.blocked = !user.card.blocked;
  saveCurrentUser(user);
  updateCardUI();
}

function changeCardType(type) {
  const user = getCurrentUser();
  if (!user) return;

  user.card.type = type;
  saveCurrentUser(user);
  updateCardUI();
}

function updateCardUI() {
  const user = getCurrentUser();
  if (!user) return;

  const numberEl = document.getElementById('maskedCardNumber');
  const expiryEl = document.getElementById('maskedExpiry');
  const cvvEl = document.getElementById('maskedCvv');
  const ibanEl = document.getElementById('cardIban');
  const statusEl = document.getElementById('cardStatusText');
  const cardFront = document.getElementById('cardFront');
  const cardBack = document.getElementById('cardBack');
  const cardTypeSelect = document.getElementById('cardTypeSelect');
  const cardOwnerName = document.getElementById('cardOwnerName');

  const cardData = {
    numberMasked: '**** **** **** 4821',
    numberFull: '1234 5678 9012 4821',
    expiryMasked: '••/••',
    expiryFull: '12/28',
    cvvMasked: '***',
    cvvFull: '123'
  };

  if (numberEl) {
    numberEl.innerText = user.card.revealed ? cardData.numberFull : cardData.numberMasked;
  }

  if (expiryEl) {
    expiryEl.innerText = user.card.revealed ? cardData.expiryFull : cardData.expiryMasked;
  }

  if (cvvEl) {
    cvvEl.innerText = user.card.revealed ? cardData.cvvFull : cardData.cvvMasked;
  }

  if (ibanEl) {
    ibanEl.innerText = user.profile.iban;
  }

  if (cardOwnerName) {
    cardOwnerName.innerText = (user.profile.username || user.profile.displayName || 'UTILISATEUR').toUpperCase();
  }

  if (statusEl) {
    statusEl.innerText = user.card.blocked ? 'Carte bloquée' : 'Carte active';
    statusEl.className = 'status-pill ' + (user.card.blocked ? 'negative' : 'positive');
  }

  const cardType = user.card.type || 'classic';

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

window.onload = () => {
  ensureAdminUser();

  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage !== 'login.html' && !getCurrentUser()) {
    window.location.href = 'login.html';
    return;
  }

  const currentUser = getCurrentUser();
  if (currentPage === 'admin.html' && (!currentUser || !currentUser.profile.isAdmin)) {
    window.location.href = 'home.html';
    return;
  }

  if (currentUser && !currentUser.profile.isAdmin) {
    pullMarketFromAdminForCurrentUser();
  }

  updateHomeUI();
  updateCryptoUI(true);
  updateCardUI();
  renderContacts();
  renderAdminDashboard();
  updateAdminNavVisibility();

  setInterval(() => {
    tickCryptoPrices();
    autoLoanPaymentTick();
    updateHomeUI();
    updateAdminNavVisibility();

    const user = getCurrentUser();
    if (user && user.crypto && user.crypto.randomMode) {
      updateCryptoUI();
    }
  }, 1000);
};