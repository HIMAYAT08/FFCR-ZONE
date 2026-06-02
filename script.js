let currentJoinMatchId = null;
let activeCategory = 'Solo';
let globalMatches = [];
let globalTransactions = [];
let globalAddCoinRequests = [];
let currentUserData = null;

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBlNH4tC-Mgd8nznfcCe4mu2NIgMnmHICU",
  authDomain: "crx-esports-86e77.firebaseapp.com",
  databaseURL: "https://crx-esports-86e77-default-rtdb.firebaseio.com",
  projectId: "crx-esports-86e77",
  storageBucket: "crx-esports-86e77.firebasestorage.app",
  messagingSenderId: "427366605356",
  appId: "1:427366605356:web:cbf876df3ea74e0bede789",
  measurementId: "G-08XLZ7ZD7D"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();

// --- USER AUTH LOGIC ---
function initApp() {
  const authScreen = document.getElementById('authScreen');
  const mainApp = document.getElementById('mainApp');
  
  auth.onAuthStateChanged(user => {
    if (user) {
      // Attach live listener to User's Database Document
      db.ref('users/' + user.uid).on('value', snapshot => {
        if (snapshot.exists()) {
          currentUserData = { ...currentUserData, uid: user.uid, ...snapshot.val() };
          if (document.getElementById('walletUserName')) initWalletPage();
          if (document.getElementById('editProfileName')) initProfilePage();
        }
      });
      // Listen to wallet coins separately
      db.ref('wallets/' + user.uid + '/coins').on('value', snapshot => {
        const bal = snapshot.val() || 0;
        if (currentUserData) currentUserData.walletBalance = bal;
        else currentUserData = { uid: user.uid, walletBalance: bal };
        
        const hBal = document.getElementById('headerWalletBalance');
        if (hBal) hBal.innerText = bal;
        const wBal = document.getElementById('walletPageBalance');
        if (wBal) wBal.innerText = bal;
      });
      // Listen to wallet transactions
      db.ref('wallets/' + user.uid + '/transactions').on('value', snapshot => {
        if (document.getElementById('transactionHistory')) renderUserTransactions(snapshot);
      });
      if (authScreen && mainApp) {
        authScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
      }
    } else {
      currentUserData = null;
      if (authScreen && mainApp) {
        authScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
      } else if (document.getElementById('walletUserName') || document.getElementById('editProfileName') || document.getElementById('paymentScreen')) {
        window.location.href = 'index.html'; // Kick out of protected pages
      }
    }
  });
}

function toggleAuthMode(mode) {
  if (mode === 'signup') {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.remove('hidden');
  } else {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('signupForm').classList.add('hidden');
  }
}

function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;

  if (pass !== confirm) {
    alert("Passwords do not match!");
    return;
  }

  auth.createUserWithEmailAndPassword(email, pass).then(cred => {
    db.ref('wallets/' + cred.user.uid + '/coins').set(0);
    return db.ref('users/' + cred.user.uid).set({
      name: name,
      email: email,
    });
  }).catch(err => alert(err.message));
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value;

  auth.signInWithEmailAndPassword(email, pass).catch(err => alert(err.message));
}

function initProfilePage() {
  if (!currentUserData) return;
  
  // Pre-fill the edit name input only if it's empty
  if (document.getElementById('editProfileName').value === '') {
    document.getElementById('editProfileName').value = currentUserData.name || '';
  }
}

function initWalletPage() {
  const nameEl = document.getElementById('walletUserName');
  const emailEl = document.getElementById('walletUserEmail');
  if (nameEl) nameEl.innerText = currentUserData.name || 'User';
  if (emailEl) emailEl.innerText = currentUserData.email || '';
}

function updateProfileName() {
  if (!currentUserData) return;
  const newName = document.getElementById('editProfileName').value.trim();
  if (!newName) return alert('Name cannot be empty.');
  db.ref('users/' + currentUserData.uid).update({ name: newName })
    .then(() => alert('Name updated successfully!'))
    .catch(err => alert(err.message));
}

function updateProfilePassword() {
  const newPass = document.getElementById('editProfilePassword').value;
  if (!newPass) return alert('Password cannot be empty.');
  auth.currentUser.updatePassword(newPass)
    .then(() => {
      alert('Password changed successfully!');
      document.getElementById('editProfilePassword').value = '';
    })
    .catch(err => alert(err.message));
}

function showWalletWithdraw() {
  document.getElementById('walletWithdrawSection').classList.remove('hidden');
}

let selectedCoinPackage = 0;

function selectCoinPackage(amount) {
  selectedCoinPackage = amount;
  document.querySelectorAll('.coin-package').forEach(el => el.classList.remove('active'));
  const selectedEl = document.getElementById('pkg-' + amount);
  if(selectedEl) selectedEl.classList.add('active');
}

function processRazorpayPayment() {
  if (!currentUserData) {
    alert("Please log in first.");
    return;
  }
  if (!selectedCoinPackage || selectedCoinPackage <= 0) {
    alert("Please select a coin package first.");
    return;
  }

  const amountInPaise = selectedCoinPackage * 100;
  
  const options = {
    "key": "rzp_test_YOUR_TEST_KEY", // Note: Replace with actual Razorpay Key ID
    "amount": amountInPaise.toString(),
    "currency": "INR",
    "name": "FFCR ZONE",
    "description": "Add Coins to Wallet",
    "handler": function (response) {
      const amount = selectedCoinPackage;
      const currentBal = currentUserData.walletBalance || 0;
      db.ref('wallets/' + currentUserData.uid + '/coins').set(currentBal + amount);
      db.ref('wallets/' + currentUserData.uid + '/transactions').push({
        type: 'Deposit', amount: amount, desc: `${amount} Coins added via Razorpay`, date: new Date().toISOString()
      }).then(() => {
        alert("Payment successful! Coins added to your wallet.");
        window.location.href = 'wallet.html';
      });
    },
    "prefill": { "name": currentUserData.name || "User", "email": currentUserData.email || "" },
    "theme": { "color": "#ff8800" }
  };
  
  const rzp1 = new Razorpay(options);
  rzp1.on('payment.failed', function (response){
    alert("Payment failed. Please try again.\nReason: " + response.error.description);
  });
  rzp1.open();
}

function processWithdraw() {
  if (!currentUserData) return alert("Please log in");
  const amount = parseInt(document.getElementById('withdrawAmount').value);
  const upi = document.getElementById('withdrawUpi').value.trim();
  if (!amount || amount <= 0) return alert("Please enter a valid amount");
  if (!upi) return alert("Please enter a valid UPI ID");
  
  if ((currentUserData.walletBalance || 0) < amount) return alert("Insufficient coins for withdrawal.");
  
  db.ref('wallets/' + currentUserData.uid + '/coins').set(currentUserData.walletBalance - amount);
  const reqRef = db.ref('transactions').push();
  reqRef.set({ uid: currentUserData.uid, email: currentUserData.email, type: 'Withdrawal', amount: amount, upi: upi, status: 'Pending', date: new Date().toISOString() })
  .then(() => {
    alert("Withdrawal request submitted.");
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawUpi').value = '';
  });
}

function userLogout() {
  auth.signOut().then(() => { window.location.href = 'index.html'; });
}

// --- HOME PAGE LOGIC ---
function openCategory(cat) {
  activeCategory = cat;
  document.getElementById('homeScreen').classList.add('hidden');
  document.getElementById('matchesScreen').classList.remove('hidden');
  document.getElementById('catTitle').innerText = `${cat} Matches`;
  renderCategoryMatches(cat);
}

function showHome() {
  document.getElementById('matchesScreen').classList.add('hidden');
  document.getElementById('homeScreen').classList.remove('hidden');
}

function renderCategoryMatches(cat) {
  const container = document.getElementById('matchesGrid');
  if (!container) return;
  const matches = globalMatches.filter(m => m.type === cat);
  
  if (matches.length === 0) {
    container.innerHTML = `<p style="text-align:center; color: #8a9bb8; margin-top:20px;">No upcoming matches in this category.</p>`;
    return;
  }
  container.innerHTML = matches.map(m => {
    const joinedCount = m.players && m.players.length > 0 ? m.players.length : Number(m.joinedPlayers) || 0;
    const isFull = joinedCount >= Number(m.totalPlayers);
    return `
    <div class="match-app-card">
      <div class="match-banner" style="background: url('https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=500&q=80') center/cover;">
        <div class="match-banner-overlay"></div>
        <div class="match-app-header">
          <div>
            <h3>${m.name}</h3>
            <p class="match-app-time">⏰ ${new Date(m.timing).toLocaleString()}</p>
          </div>
          <div class="wallet-box" style="background: rgba(0,0,0,0.7); border-color: var(--primary); color: #fff;">
            🎮 ${joinedCount}/${m.totalPlayers}
          </div>
        </div>
      </div>
      <div class="match-app-body">
        <div class="stats-grid">
          <div class="stat-box stat-prize"><span>Prize Pool</span><strong>${m.prize}</strong></div>
          <div class="stat-box"><span>Per Kill</span><strong>${m.perKill || '-'}</strong></div>
          <div class="stat-box"><span>Entry Fee</span><strong style="color:var(--primary);">${m.entryFeeCoins > 0 ? m.entryFeeCoins + ' Coins' : 'Free'}</strong></div>
        </div>
        <div class="match-info-grid">
          <div>Type <strong>${m.type}</strong></div>
          <div>Version <strong>${m.version || 'Mobile'}</strong></div>
          <div>Map <strong>${m.map}</strong></div>
        </div>
        <div class="players-list-box">
          <h4>Joined Players (${joinedCount}/${m.totalPlayers})</h4>
          ${m.players && m.players.length > 0 ? 
            `<ol class="player-ol">${m.players.map(p => `<li>${p}</li>`).join('')}</ol>` : 
            `<p class="no-players">No players joined yet.</p>`
          }
        </div>
        ${isFull ? 
          `<button class="btn-primary btn-full" onclick="alert('This match is full. You cannot join now.')">MATCH FULL</button>` : 
          `<button class="btn-primary" onclick="openJoinModal('${m.id}')">JOIN NOW</button>`
        }
        <button class="btn-secondary" onclick="openRoomDetailsModal('${m.id}')" style="margin-top: 10px;">ROOM DETAILS</button>
      </div>
    </div>
  `}).join('');
}

function openJoinModal(id) {
  if (!currentUserData) {
    alert("Please log in first to join a match.");
    return;
  }
  
  const match = globalMatches.find(m => m.id === id);
  if (!match) return;

  const registeredUids = match.registeredUids || [];
  const registeredEmails = match.registeredEmails || [];
  const players = match.players || [];
  if (registeredUids.includes(currentUserData.uid) || registeredEmails.includes(currentUserData.email) || players.includes(currentUserData.name)) {
    alert("You already joined this match.");
    return;
  }

  const joinedCount = match.players && match.players.length > 0 ? match.players.length : Number(match.joinedPlayers) || 0;
  if (joinedCount >= Number(match.totalPlayers)) {
    alert('This match is full. You cannot join now.');
    return;
  }
  currentJoinMatchId = id;
  document.getElementById('joinModal').style.display = 'flex';
  document.getElementById('nameInputSection').classList.remove('hidden');
  document.getElementById('roomDetailsSection').classList.add('hidden');
  document.getElementById('gameNameInput').value = '';
}

function closeModal() {
  document.getElementById('joinModal').style.display = 'none';
  currentJoinMatchId = null;
}

function openRoomDetailsModal(id) {
  if (!currentUserData) {
    alert("Please log in first.");
    return;
  }

  const match = globalMatches.find(m => m.id === id);
  if (!match) return;

  const registeredUids = match.registeredUids || [];
  const registeredEmails = match.registeredEmails || [];
  const players = match.players || [];
  
  const hasJoined = registeredUids.includes(currentUserData.uid) || 
                    registeredEmails.includes(currentUserData.email) || 
                    players.includes(currentUserData.name);

  if (!hasJoined) {
    alert("Please join this match first to view room details.");
    return;
  }

  const hasRoomDetails = (match.roomId && match.roomId.trim() !== '') || (match.password && match.password.trim() !== '');

  if (hasRoomDetails) {
    document.getElementById('roomDetailsModalMatchName').innerText = match.name;
    document.getElementById('roomDetailsModalTiming').innerText = new Date(match.timing).toLocaleString();
    document.getElementById('roomDetailsModalId').innerText = match.roomId || '-';
    document.getElementById('roomDetailsModalPassword').innerText = match.password || '-';
    document.getElementById('roomDetailsModal').style.display = 'flex';
  } else {
    alert("Room details are not available yet.");
  }
}

function closeRoomDetailsModal() {
  document.getElementById('roomDetailsModal').style.display = 'none';
}

function submitGameName() {
  const name = document.getElementById('gameNameInput').value.trim();
  if (!name) {
    alert("Please enter your game name.");
    return;
  }
  
  const matchRef = db.ref('matches/' + currentJoinMatchId);
  
  matchRef.once('value').then(snapshot => {
    if (!snapshot.exists()) return;
    const m = snapshot.val();
    let players = m.players || [];
    let registeredUids = m.registeredUids || [];
    let registeredEmails = m.registeredEmails || [];
    const joinedCount = players.length > 0 ? players.length : (m.joinedPlayers || 0);
    
    if (joinedCount >= Number(m.totalPlayers)) {
      alert("This match is full!");
      return;
    }
    
    if (players.includes(name) || registeredUids.includes(currentUserData.uid) || registeredEmails.includes(currentUserData.email)) {
      alert("You already joined this match.");
      return;
    }

    const fee = parseInt(m.entryFeeCoins) || 0;
    if (fee > 0) {
      if ((currentUserData.walletBalance || 0) < fee) {
        alert("Insufficient coins. Please add coins to join this match.");
        return;
      }
      // Deduct coins & Save Transaction
      const currentBal = currentUserData.walletBalance || 0;
      db.ref('wallets/' + currentUserData.uid + '/coins').set(currentBal - fee);
      db.ref('wallets/' + currentUserData.uid + '/transactions').push({
        type: 'Match Join',
        amount: fee,
        desc: `${fee} Coins deducted for joining ${m.name}`,
        date: new Date().toISOString()
      });
    }

    players.push(name);
    registeredUids.push(currentUserData.uid);
    registeredEmails.push(currentUserData.email);

    // Save joined player globally
    db.ref(`joinedPlayers/${currentJoinMatchId}/${currentUserData.uid}`).set({ gameName: name, joinedAt: new Date().toISOString() });

    // Atomically add player to Database Array
    matchRef.update({
      players: players,
      registeredUids: registeredUids,
      registeredEmails: registeredEmails,
      joinedPlayers: players.length
    }).then(() => {
      document.getElementById('nameInputSection').classList.add('hidden');
      document.getElementById('roomDetailsSection').classList.remove('hidden');
      document.getElementById('modalMatchName').innerText = m.name;
      document.getElementById('modalMatchTiming').innerText = new Date(m.timing).toLocaleString();
      
      const credsBox = document.getElementById('modalCredentials');
      if (m.roomId && m.password) credsBox.innerHTML = `<p><strong>Room ID:</strong> <span>${m.roomId}</span></p><p><strong>Password:</strong> <span>${m.password}</span></p>`;
      else credsBox.innerHTML = `<p class="alert-text">Room details are not available yet.</p>`;
    });
  }).catch(err => alert(err.message));
}

// --- ADMIN PAGE LOGIC ---
function renderAdminMatches() {
  const container = document.getElementById('adminMatchesList');
  if (!container) return;
  container.innerHTML = globalMatches.map(m => `
    <div class="admin-match-item">
      <div class="admin-match-info">
        <h4>${m.name} <span style="font-size: 0.8rem; color:#888;">(${m.type})</span></h4>
        <p>${new Date(m.timing).toLocaleString()} | Map: ${m.map} | Fee: ${m.entryFeeCoins > 0 ? m.entryFeeCoins + ' Coins' : 'Free'}</p>
      </div>
      <div class="admin-actions">
        <button class="btn-edit" onclick="editMatch('${m.id}')">Edit</button>
        <button class="btn-delete" onclick="deleteMatch('${m.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function handleAdminSubmit(e) {
  e.preventDefault();
  const editId = document.getElementById('editMatchId').value;
  
  const matchData = {
    name: document.getElementById('matchName').value,
    type: document.getElementById('matchType').value,
    version: document.getElementById('matchVersion').value,
    perKill: document.getElementById('perKill').value,
    entryFeeCoins: parseInt(document.getElementById('entryFee').value) || 0,
    prize: document.getElementById('prizePool').value,
    timing: document.getElementById('matchTiming').value,
    map: document.getElementById('mapName').value,
    totalPlayers: document.getElementById('totalPlayers').value,
    joinedPlayers: document.getElementById('joinedPlayers').value,
    roomId: document.getElementById('roomId').value,
    password: document.getElementById('password').value,
  };

  if (editId) {
    db.ref('matches/' + editId).update(matchData)
      .then(() => { alert("Match updated live on all devices!"); cancelEdit(); })
      .catch(err => alert(err.message));
  } else {
    matchData.players = [];
    db.ref('matches').push(matchData)
      .then(() => { alert("New match created live!"); cancelEdit(); })
      .catch(err => alert(err.message));
  }
}

function editMatch(id) {
  const match = globalMatches.find(m => m.id === id);
  if (!match) return;

  document.getElementById('formTitle').innerText = "✏️ Edit Match";
  document.getElementById('editMatchId').value = match.id;
  document.getElementById('matchName').value = match.name;
  document.getElementById('matchType').value = match.type;
  document.getElementById('matchVersion').value = match.version || '';
  document.getElementById('perKill').value = match.perKill || '';
  document.getElementById('entryFee').value = match.entryFeeCoins || 0;
  document.getElementById('prizePool').value = match.prize;
  document.getElementById('matchTiming').value = match.timing;
  document.getElementById('mapName').value = match.map;
  document.getElementById('totalPlayers').value = match.totalPlayers;
  document.getElementById('joinedPlayers').value = match.joinedPlayers;
  document.getElementById('roomId').value = match.roomId;
  document.getElementById('password').value = match.password;
  
  document.getElementById('cancelEditBtn').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  const form = document.getElementById('adminForm');
  if(!form) return;
  
  document.getElementById('formTitle').innerText = "🔧 Add New Match";
  document.getElementById('editMatchId').value = '';
  form.reset();
  document.getElementById('cancelEditBtn').classList.add('hidden');
}

function deleteMatch(id) {
  if (!confirm("Are you sure you want to delete this match?")) return;
  db.ref('matches/' + id).remove()
    .then(() => console.log("Match deleted live!"))
    .catch(err => alert(err.message));
}

// --- ADMIN AUTH LOGIC ---
function adminLogin() {
  const user = document.getElementById('adminUser').value;
  const pass = document.getElementById('adminPass').value;
  if (user === 'HIMAYAT' && pass === 'HIMAYAT@1234') {
    sessionStorage.setItem('adminLoggedIn', 'true');
    showAdminDashboard();
  } else {
    alert('Invalid credentials!');
  }
}

function adminLogout() {
  sessionStorage.removeItem('adminLoggedIn');
  window.location.reload();
}

function showAdminDashboard() {
  document.getElementById('adminLoginSection').classList.add('hidden');
  document.getElementById('adminDashboardSection').classList.remove('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');
}

function renderAdminAddCoinRequests() {
  const container = document.getElementById('adminAddCoinRequests');
  if (!container) return;
  let pendingReqs = globalAddCoinRequests.filter(r => r.status === 'Pending').sort((a,b) => new Date(a.date) - new Date(b.date));
  if (pendingReqs.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-style:italic;">No pending requests.</p>';
    return;
  }
  container.innerHTML = pendingReqs.map(r => `
    <div style="background: var(--card-bg); padding: 10px; border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--primary); display: flex; justify-content: space-between; align-items: center;">
      <div><strong>${r.email}</strong><div style="font-size: 0.8rem; color: var(--text-muted);">${r.amount} Coins Requested</div></div>
      <div style="display: flex; gap: 5px;">
        <button onclick="approveAddCoin('${r.id}', '${r.uid}', ${r.amount})" style="background:#00ff9d; color:#000; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-weight:bold; font-size: 0.8rem;">✓</button>
        <button onclick="rejectAddCoin('${r.id}')" style="background:#ff4444; color:#fff; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-weight:bold; font-size: 0.8rem;">✗</button>
      </div>
    </div>
  `).join('');
}

function renderAdminWithdrawRequests() {
  const container = document.getElementById('adminWithdrawRequests');
  if (!container) return;
  let pendingTxs = globalTransactions.filter(t => t.status === 'Pending').sort((a,b) => new Date(a.date) - new Date(b.date));
  
  if (pendingTxs.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-style:italic;">No pending requests.</p>';
    return;
  }
  container.innerHTML = pendingTxs.map(t => `
    <div style="background: var(--card-bg); padding: 10px; border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--primary); display: flex; justify-content: space-between; align-items: center;">
      <div><strong>${t.email}</strong><div style="font-size: 0.8rem; color: var(--text-muted);">${t.amount} Coins | UPI: <span style="color:var(--text);">${t.upi}</span></div></div>
      <div style="display: flex; gap: 5px;">
        <button onclick="approveWithdraw('${t.id}')" style="background:#00ff9d; color:#000; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-weight:bold; font-size: 0.8rem;">✓</button>
        <button onclick="rejectWithdraw('${t.id}')" style="background:#ff4444; color:#fff; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-weight:bold; font-size: 0.8rem;">✗</button>
      </div>
    </div>
  `).join('');
}

function approveWithdraw(id) {
  db.ref('transactions/' + id).update({ status: 'Approved' });
}

function approveAddCoin(reqId, uid, amount) {
  db.ref('wallets/' + uid + '/coins').once('value').then(snap => {
    const currentBal = snap.val() || 0;
    db.ref('wallets/' + uid + '/coins').set(currentBal + amount);
    db.ref('wallets/' + uid + '/transactions').push({
      type: 'Admin Add',
      amount: amount,
      desc: `${amount} Coins added via request`,
      date: new Date().toISOString()
    });
    db.ref('addCoinRequests/' + reqId).update({ status: 'Approved' });
  });
}

function rejectAddCoin(reqId) {
  db.ref('addCoinRequests/' + reqId).update({ status: 'Rejected' });
}

function rejectWithdraw(id) {
  db.ref('transactions/' + id).once('value').then(snap => {
    if (!snap.exists()) return;
    const tx = snap.val();
    if (tx.uid) {
      db.ref('wallets/' + tx.uid + '/coins').once('value').then(balSnap => {
        const currentBal = balSnap.val() || 0;
        db.ref('wallets/' + tx.uid + '/coins').set(currentBal + tx.amount);
        db.ref('wallets/' + tx.uid + '/transactions').push({
          type: 'Refund', amount: tx.amount, desc: `Refund: Withdrawal Rejected`, date: new Date().toISOString()
        });
      });
    }
    return db.ref('transactions/' + id).update({ status: 'Rejected' });
  }).catch(err => alert(err.message));
}

function adminAddMoney() {
  const email = document.getElementById('adminWalletEmail').value.trim();
  const amount = parseInt(document.getElementById('adminWalletAmount').value);
  if (!email || !amount || amount <= 0) { alert('Enter valid details.'); return; }

  db.ref('users').orderByChild('email').equalTo(email).once('value').then(snap => {
    if (!snap.exists()) { alert("User not found."); return; }
    let updates = [];
    snap.forEach(childSnap => {
      const uid = childSnap.key;
      updates.push(db.ref('wallets/' + uid + '/coins').once('value').then(balSnap => {
        const currentBal = balSnap.val() || 0;
        db.ref('wallets/' + uid + '/coins').set(currentBal + amount);
        db.ref('wallets/' + uid + '/transactions').push({
          type: 'Admin Add', amount: amount, desc: `${amount} Coins added manually by Admin`, date: new Date().toISOString()
        });
      }));
    });
    return Promise.all(updates);
  }).then(() => {
    alert('Coins added live!'); document.getElementById('adminWalletAmount').value = ''; 
  }).catch(err => alert(err.message));
}

function adminDeductMoney() {
  const email = document.getElementById('adminWalletEmail').value.trim();
  const amount = parseInt(document.getElementById('adminWalletAmount').value);
  if (!email || !amount || amount <= 0) { alert('Enter valid details.'); return; }

  db.ref('users').orderByChild('email').equalTo(email).once('value').then(snap => {
    if (!snap.exists()) { alert("User not found."); return; }
    let updates = [];
    snap.forEach(childSnap => {
      const uid = childSnap.key;
      updates.push(db.ref('wallets/' + uid + '/coins').once('value').then(balSnap => {
        const currentBal = balSnap.val() || 0;
        db.ref('wallets/' + uid + '/coins').set(currentBal - amount);
        db.ref('wallets/' + uid + '/transactions').push({
          type: 'Admin Deduct', amount: amount, desc: `${amount} Coins deducted manually by Admin`, date: new Date().toISOString()
        });
      }));
    });
    return Promise.all(updates);
  }).then(() => {
    alert('Coins deducted live!'); document.getElementById('adminWalletAmount').value = ''; 
  }).catch(err => alert(err.message));
}

function renderUserTransactions(snapshot) {
  const container = document.getElementById('transactionHistory');
  if (!container) return;
  const txs = [];
  snapshot.forEach(child => txs.push(child.val()));
  txs.sort((a, b) => new Date(b.date) - new Date(a.date));
  if(txs.length === 0) { container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:10px;">No transactions yet.</p>'; return; }
  container.innerHTML = txs.map(t => `
    <div style="background: rgba(0,0,0,0.2); padding: 10px; margin-bottom: 8px; border-radius: 6px; border-left: 3px solid var(--primary);">
      <p style="margin: 0; font-size: 0.9rem; color: var(--text);">${t.desc || t.type}</p>
      <div style="display: flex; justify-content: space-between; margin-top: 5px;">
        <span style="font-size: 0.8rem; color: var(--text-muted);">${new Date(t.date).toLocaleString()}</span>
        <strong style="color: ${['Match Join', 'Withdrawal', 'Admin Deduct'].includes(t.type) ? '#ff4444' : '#00ff9d'};">${['Match Join', 'Withdrawal', 'Admin Deduct'].includes(t.type) ? '-' : '+'}${t.amount} Coins</strong>
      </div>
    </div>
  `).join('');
}

// --- INIT ---
window.onload = () => {
  initApp();
  
  // Setup Real-Time Listeners
  db.ref('matches').on('value', snapshot => {
    globalMatches = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const match = child.val();
        if (['Clash Squad', 'eSports', 'Fantasy'].includes(match.type)) {
          child.ref.remove().catch(() => {}); // Automatically clean up deprecated categories from DB
        } else {
          globalMatches.push({ id: child.key, ...match });
        }
      });
    }
    renderCategoryMatches(activeCategory);
    renderAdminMatches();
  });
  
  db.ref('addCoinRequests').on('value', snapshot => {
    globalAddCoinRequests = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => globalAddCoinRequests.push({ id: child.key, ...child.val() }));
    }
    renderAdminAddCoinRequests();
  });

  db.ref('transactions').on('value', snapshot => {
    globalTransactions = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        globalTransactions.push({ id: child.key, ...child.val() });
      });
    }
    renderAdminWithdrawRequests();
  });

  const adminDashboard = document.getElementById('adminDashboardSection');
  if (adminDashboard) {
    if (sessionStorage.getItem('adminLoggedIn') === 'true') {
      showAdminDashboard();
    }
    renderAdminWithdrawRequests();
    renderAdminMatches();
    const adminForm = document.getElementById('adminForm');
    if (adminForm) adminForm.addEventListener('submit', handleAdminSubmit);
  }

  // --- BOTTOM NAVIGATION EVENT LISTENERS ---
  const walletBtn = document.getElementById('walletBtn');
  if (walletBtn) walletBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'wallet.html';
  });

  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) profileBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'profile.html';
  });

  const playBtn = document.getElementById('playBtn');
  if (playBtn) playBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showHome();
  });

  const chatBtn = document.getElementById('chatBtn');
  if (chatBtn) chatBtn.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Chat feature is coming soon!');
  });
};