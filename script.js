let currentJoinMatchId = null;
let activeCategory = 'Solo';
let globalMatches = [];
let globalTransactions = [];
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
          currentUserData = { uid: user.uid, ...snapshot.val() };
          const hBal = document.getElementById('headerWalletBalance');
          if (hBal) hBal.innerText = currentUserData.walletBalance || 0;
          if (document.getElementById('walletUserName')) initWalletPage();
          if (document.getElementById('editProfileName')) initProfilePage();
        }
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
      } else if (document.getElementById('walletUserName') || document.getElementById('editProfileName')) {
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
    // Create user document in real-time database
    return db.ref('users/' + cred.user.uid).set({
      name: name,
      email: email,
      walletBalance: 0
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
          <div class="stat-box"><span>Entry Fee</span><strong style="color:var(--primary);">${m.fee}</strong></div>
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
  const match = globalMatches.find(m => m.id === id);
  if (!match) return;
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
  const match = globalMatches.find(m => m.id === id);
  if (!match) return;

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
    const joinedCount = players.length > 0 ? players.length : (m.joinedPlayers || 0);
    
    if (joinedCount >= Number(m.totalPlayers)) {
      alert("This match is full!");
      return;
    }
    
    if (players.includes(name)) {
      alert("You already joined this match.");
      return;
    }

    players.push(name);

    // Atomically add player to Database Array
    matchRef.update({
      players: players,
      joinedPlayers: players.length
    }).then(() => {
      document.getElementById('nameInputSection').classList.add('hidden');
      document.getElementById('roomDetailsSection').classList.remove('hidden');
      document.getElementById('modalMatchName').innerText = m.name;
      document.getElementById('modalMatchTiming').innerText = new Date(m.timing).toLocaleString();
      
      const credsBox = document.getElementById('modalCredentials');
      if (m.roomId && m.password) credsBox.innerHTML = `<p><strong>Room ID:</strong> <span>${m.roomId}</span></p><p><strong>Password:</strong> <span>${m.password}</span></p>`;
      else credsBox.innerHTML = `<p class="alert-text">Room ID and Password will be available before match time.</p>`;
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
        <p>${new Date(m.timing).toLocaleString()} | Map: ${m.map} | Prize: ${m.prize}</p>
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
    fee: document.getElementById('entryFee').value,
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
  document.getElementById('entryFee').value = match.fee;
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
      <div><strong>${t.email}</strong><div style="font-size: 0.8rem; color: var(--text-muted);">₹${t.amount} | UPI: <span style="color:var(--text);">${t.upi}</span></div></div>
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

function rejectWithdraw(id) {
  db.ref('transactions/' + id).once('value').then(snap => {
    if (!snap.exists()) return;
    const tx = snap.val();
    return db.ref('users').orderByChild('email').equalTo(tx.email).once('value').then(userSnap => {
      if (userSnap.exists()) {
        userSnap.forEach(childSnap => {
          const currentBal = childSnap.val().walletBalance || 0;
          childSnap.ref.update({ walletBalance: currentBal + tx.amount });
        });
      }
      return db.ref('transactions/' + id).update({ status: 'Rejected' });
    });
  }).catch(err => alert(err.message));
}

function adminAddMoney() {
  const email = document.getElementById('adminWalletEmail').value.trim();
  const amount = document.getElementById('adminWalletAmount').value;
  if (!email || !amount || amount <= 0) { alert('Enter valid details.'); return; }

  db.ref('users').orderByChild('email').equalTo(email).once('value').then(snap => {
    if (!snap.exists()) { alert("User not found in Firebase Database."); return; }
    let updates = [];
    snap.forEach(childSnap => {
      const currentBal = childSnap.val().walletBalance || 0;
      updates.push(childSnap.ref.update({ walletBalance: currentBal + Number(amount) }));
    });
    return Promise.all(updates);
  }).then(() => {
    return db.ref('transactions').push({ email: email, type: 'Added by Admin', amount: Number(amount), upi: '-', status: 'Approved', date: new Date().toISOString() });
  }).then(() => { alert('Balance added live!'); document.getElementById('adminWalletAmount').value = ''; }).catch(err => alert(err.message));
}

function adminDeductMoney() {
  const email = document.getElementById('adminWalletEmail').value.trim();
  const amount = document.getElementById('adminWalletAmount').value;
  if (!email || !amount || amount <= 0) { alert('Enter valid details.'); return; }

  db.ref('users').orderByChild('email').equalTo(email).once('value').then(snap => {
    if (!snap.exists()) { alert("User not found in Firebase Database."); return; }
    let updates = [];
    snap.forEach(childSnap => {
      const currentBal = childSnap.val().walletBalance || 0;
      updates.push(childSnap.ref.update({ walletBalance: currentBal - Number(amount) }));
    });
    return Promise.all(updates);
  }).then(() => {
    return db.ref('transactions').push({ email: email, type: 'Deducted by Admin', amount: Number(amount), upi: '-', status: 'Approved', date: new Date().toISOString() });
  }).then(() => { alert('Balance deducted live!'); document.getElementById('adminWalletAmount').value = ''; }).catch(err => alert(err.message));
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
  
  db.ref('transactions').on('value', snapshot => {
    globalTransactions = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        globalTransactions.push({ id: child.key, ...child.val() });
      });
    }
    try { if (currentUserData) renderTransactionHistory(currentUserData.email); } catch(e) {}
    renderAdminWithdrawRequests();
    try { if (currentUserData && document.getElementById('walletUserName')) updateWalletPageData(currentUserData.email); } catch(e) {}
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