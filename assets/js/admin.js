// ============ AGRIMINDVEST - ADMIN LOGIC ============

const ADMIN_CREDENTIALS = {
    email: 'agrimindvest@gmail.com',
    pass: 'LEGALCHECKVERSION1.0'
};

let isAdminLoggedIn = false;

function adminLogin() {
    const email = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value;
    if (email === ADMIN_CREDENTIALS.email && pass === ADMIN_CREDENTIALS.pass) {
        isAdminLoggedIn = true;
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('sidebar').style.display = 'block';
        document.getElementById('mainContent').style.display = 'block';
        loadDashboard();
        toast('Welcome Admin');
    } else { toast('Access Denied'); }
}

function adminLogout() {
    isAdminLoggedIn = false;
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
}

function switchSection(section) {
    document.querySelectorAll('.admin-sidebar .nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.admin-sidebar .nav-item[data-section="${section}"]`)?.classList.add('active');
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById('sec-' + section).classList.add('active');
    document.getElementById('sectionTitle').textContent = document.querySelector(`.admin-sidebar .nav-item[data-section="${section}"]`)?.textContent.trim() || '';
    if (section === 'dashboard') loadDashboard();
    if (section === 'users') loadUsers();
    if (section === 'deposits') loadDeposits();
    if (section === 'withdrawals') loadWithdrawals();
    if (section === 'content') loadContent();
    if (section === 'referrals') loadReferrals();
    if (section === 'plans') loadPlansAdmin();
    if (section === 'notices') loadNotices();
    if (section === 'settings') loadSettingsData();
}

document.querySelectorAll('.admin-sidebar .nav-item[data-section]').forEach(item => {
    item.addEventListener('click', function() { switchSection(this.dataset.section); });
});

async function loadDashboard() {
    const users = await getCollection('users');
    const payments = await db.collection('payments').where('status', '==', 'approved').get();
    const withdrawals = await db.collection('withdrawals').where('status', '==', 'approved').get();
    const pendingDep = await db.collection('deposits').where('status', '==', 'pending').get();
    const pendingWth = await db.collection('withdrawals').where('status', '==', 'pending').get();
    document.getElementById('sUsers').textContent = users.length;
    document.getElementById('sActive').textContent = users.filter(u => u.plan && u.plan !== 'none').length;
    document.getElementById('sInvested').textContent = fmt(payments.docs.reduce((s, d) => s + (d.data().amount || 0), 0));
    document.getElementById('sPaid').textContent = fmt(withdrawals.docs.reduce((s, d) => s + (d.data().amount || 0), 0));
    document.getElementById('sPendingDep').textContent = pendingDep.size;
    document.getElementById('sPendingWth').textContent = pendingWth.size;
}

async function loadUsers() {
    const users = await getCollection('users');
    const search = (document.getElementById('userSearch')?.value || '').toLowerCase();
    let html = '';
    users.forEach(u => {
        if (search && !u.name?.toLowerCase().includes(search) && !u.email?.includes(search)) return;
        html += `<tr><td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.phone}</td><td>${u.plan||'None'}</td><td>${fmt(u.balance||0)}</td><td><span class="badge badge-${u.status==='active'?'success':'danger'}">${u.status||'active'}</span></td><td><button class="btn btn-primary btn-sm" onclick="editUser('${u.id}')">Edit</button><button class="btn btn-success btn-sm" onclick="quickAdd('${u.id}','${u.name}')">+₦</button></td></tr>`;
    });
    document.getElementById('usersTable').innerHTML = html || '<tr><td colspan="8">No users</td></tr>';
}

async function quickAdd(id, name) {
    const amount = prompt('Add balance to ' + name + '\n\nAmount (₦):', '500');
    if (!amount) return;
    const amt = parseInt(amount);
    if (!amt || amt <= 0) return toast('Invalid amount');
    if (!confirm('Add ₦' + amt.toLocaleString() + ' to ' + name + '?')) return;
    await updateDoc('users', id, { balance: firebase.firestore.FieldValue.increment(amt) });
    await db.collection('deposits').add({ userId: id, userName: name, amount: amt, channel: 'admin', date: new Date().toISOString(), status: 'approved', ref: 'ADMIN-BONUS' });
    toast('✅ Added ₦' + amt.toLocaleString());
    loadUsers(); loadDashboard();
}

async function editUser(id) {
    const u = await getDoc('users', id);
    if (!u) return toast('User not found');
    const action = prompt(`Edit: ${u.name}\nBalance: ${fmt(u.balance)}\nPlan: ${u.plan||'None'}\nStatus: ${u.status}\n\n"status active/suspended"\n"add 5000"\n"remove 2000"\n"plan pro/none"`);
    if (!action) return;
    const parts = action.trim().split(' ');
    const cmd = parts[0].toLowerCase();
    const val = parts[1];
    if (cmd === 'status' && ['active','suspended'].includes(val)) { await updateDoc('users', id, { status: val }); toast('✅ Status: ' + val); }
    else if (cmd === 'add' && parseInt(val) > 0) { await updateDoc('users', id, { balance: firebase.firestore.FieldValue.increment(parseInt(val)) }); toast('✅ Added ₦' + parseInt(val).toLocaleString()); }
    else if (cmd === 'remove' && parseInt(val) > 0) { await updateDoc('users', id, { balance: firebase.firestore.FieldValue.increment(-parseInt(val)) }); toast('✅ Removed ₦' + parseInt(val).toLocaleString()); }
    else if (cmd === 'plan') {
        if (val === 'none') { await updateDoc('users', id, { plan: 'none', invested: false }); toast('✅ Plan removed'); }
        else { const plans = await getDoc('settings', 'plans') || {}; if (plans[val]) { const exp = new Date(); exp.setDate(exp.getDate() + 60); await updateDoc('users', id, { plan: val, expiryDate: exp.toISOString(), invested: true }); toast('✅ Plan: ' + plans[val].name); } else { toast('❌ Plan not found'); } }
    }
    loadUsers(); loadDashboard();
}

async function loadDeposits() {
    const snapshot = await db.collection('deposits').orderBy('date', 'desc').limit(50).get();
    let html = '';
    snapshot.forEach(d => {
        const dep = d.data();
        html += `<tr><td>${dep.userName||dep.userId}</td><td>${fmt(dep.amount)}</td><td>${dep.ref||'-'}</td><td>${dep.payerName||'-'}</td><td>${dep.payerAccount||'-'}</td><td>${new Date(dep.date).toLocaleDateString()}</td><td><span class="badge badge-${dep.status==='approved'?'success':dep.status==='pending'?'warning':'danger'}">${dep.status}</span></td><td>${dep.status==='pending'?`<button class="btn btn-success btn-sm" onclick="approveDeposit('${d.id}')">Approve</button><button class="btn btn-danger btn-sm" onclick="rejectDeposit('${d.id}')">Reject</button>`:'Processed'}</td></tr>`;
    });
    document.getElementById('depositsTable').innerHTML = html || '<tr><td colspan="8">No deposits</td></tr>';
}

async function approveDeposit(id) {
    const dep = await getDoc('deposits', id);
    if (!dep) return;
    await updateDoc('deposits', id, { status: 'approved' });
    await updateDoc('users', dep.userId, { balance: firebase.firestore.FieldValue.increment(dep.amount) });
    toast('✅ Deposit approved!');
    loadDeposits(); loadDashboard();
}

async function rejectDeposit(id) {
    await updateDoc('deposits', id, { status: 'rejected' });
    toast('❌ Deposit rejected');
    loadDeposits();
}

async function loadWithdrawals() {
    const snapshot = await db.collection('withdrawals').orderBy('date', 'desc').limit(50).get();
    let html = '';
    snapshot.forEach(d => {
        const w = d.data();
        html += `<tr><td>${w.userName||w.userId}</td><td>${fmt(w.amount)}</td><td>${fmt(w.fee)}</td><td>${fmt(w.net)}</td><td>${w.bankName||'-'}<br><small>${w.acctNo||''}</small></td><td>${new Date(w.date).toLocaleDateString()}</td><td><span class="badge badge-${w.status==='approved'?'success':w.status==='pending'?'warning':'danger'}">${w.status}</span></td><td>${w.status==='pending'?`<button class="btn btn-success btn-sm" onclick="approveWithdrawal('${d.id}')">Approve</button><button class="btn btn-danger btn-sm" onclick="rejectWithdrawal('${d.id}')">Reject</button>`:'Processed'}</td></tr>`;
    });
    document.getElementById('withdrawalsTable').innerHTML = html || '<tr><td colspan="8">No withdrawals</td></tr>';
}

async function approveWithdrawal(id) {
    await updateDoc('withdrawals', id, { status: 'approved' });
    toast('✅ Withdrawal approved!');
    loadWithdrawals(); loadDashboard();
}

async function rejectWithdrawal(id) {
    const w = await getDoc('withdrawals', id);
    if (w) { await updateDoc('withdrawals', id, { status: 'rejected' }); await updateDoc('users', w.userId, { balance: firebase.firestore.FieldValue.increment(w.amount) }); }
    toast('❌ Rejected - Refunded');
    loadWithdrawals();
}

async function loadContent() {
    const snapshot = await db.collection('articles').get();
    let html = '<p style="color:var(--text-dim);">Built-in: 5 articles</p>';
    snapshot.forEach(d => { const a = d.data(); html += `<div class="card" style="margin-bottom:8px;"><strong>${a.title}</strong><button class="btn btn-danger btn-sm" style="float:right;" onclick="deleteArticle('${d.id}')">Delete</button></div>`; });
    document.getElementById('articlesAdminList').innerHTML = html || '<p>No custom articles</p>';
}

function showAddArticle() {
    document.getElementById('addArticleForm').style.display = 'block';
    document.getElementById('aTitle').value = ''; document.getElementById('aContent').value = '';
    let qHTML = '';
    for (let i = 1; i <= 5; i++) {
        qHTML += `<div class="card" style="margin-bottom:10px;"><strong>Q${i}</strong><input type="text" class="form-input" id="q${i}q" placeholder="Question" style="margin-bottom:5px;"><input type="text" class="form-input" placeholder="Option A" id="q${i}a" style="margin-bottom:3px;"><input type="text" class="form-input" placeholder="Option B" id="q${i}b" style="margin-bottom:3px;"><input type="text" class="form-input" placeholder="Option C" id="q${i}c" style="margin-bottom:5px;"><label>Correct: <select class="form-select" id="q${i}ans"><option value="0">A</option><option value="1">B</option><option value="2">C</option></select></label></div>`;
    }
    document.getElementById('questionsContainer').innerHTML = qHTML;
}

async function saveArticle() {
    const t = document.getElementById('aTitle').value;
    const c = document.getElementById('aContent').value;
    if (!t || !c) return toast('Fill title and content');
    const qs = [];
    for (let i = 1; i <= 5; i++) { qs.push({ q: document.getElementById('q' + i + 'q').value, o: [document.getElementById('q' + i + 'a').value, document.getElementById('q' + i + 'b').value, document.getElementById('q' + i + 'c').value], a: parseInt(document.getElementById('q' + i + 'ans').value) }); }
    await db.collection('articles').add({ title: t, content: c, qs, date: new Date().toISOString() });
    toast('✅ Article saved!');
    document.getElementById('addArticleForm').style.display = 'none';
    loadContent();
}

async function deleteArticle(id) { if (confirm('Delete?')) { await deleteDoc('articles', id); toast('Deleted'); loadContent(); } }

async function loadReferrals() {
    const snapshot = await db.collection('referrals').orderBy('date', 'desc').limit(50).get();
    let html = '';
    snapshot.forEach(d => { const r = d.data(); html += `<tr><td>${r.referrerId}</td><td>${r.refereeName||r.refereeId}</td><td>${r.package||'-'}</td><td>${fmt(r.earned||0)}</td><td>${new Date(r.date).toLocaleDateString()}</td></tr>`; });
    document.getElementById('refTable').innerHTML = html || '<tr><td colspan="5">No referrals</td></tr>';
}

const defaultPlans = {
    sprout: { name: 'AGV Sprout', price: 3000, perQ: 27, daily: 135, status: 'active' },
    sproutplus: { name: 'AGV Sprout Plus', price: 5000, perQ: 45, daily: 225, status: 'active' },
    sapling: { name: 'AGV Sapling', price: 7500, perQ: 67.5, daily: 337.5, status: 'disabled' },
    growth: { name: 'AGV Growth', price: 10000, perQ: 90, daily: 450, status: 'active' },
    harvest: { name: 'AGV Harvest', price: 15000, perQ: 135, daily: 675, status: 'disabled' },
    farmer: { name: 'AGV Farmer', price: 20000, perQ: 180, daily: 900, status: 'disabled' },
    pro: { name: 'AGV Pro', price: 30000, perQ: 270, daily: 1350, status: 'active' },
    elite: { name: 'AGV Elite', price: 50000, perQ: 450, daily: 2250, status: 'disabled' },
    premier: { name: 'AGV Premier', price: 75000, perQ: 675, daily: 3375, status: 'disabled' },
    executive: { name: 'AGV Executive', price: 100000, perQ: 900, daily: 4500, status: 'disabled' },
    investor: { name: 'AGV Investor', price: 125000, perQ: 1125, daily: 5625, status: 'disabled' },
    legend: { name: 'AGV Legend', price: 200000, perQ: 1800, daily: 9000, status: 'disabled' }
};

async function loadPlansAdmin() {
    const snap = await db.collection('settings').doc('plans').get();
    if (!snap.exists) await setDoc('settings', 'plans', defaultPlans);
    const plans = (await db.collection('settings').doc('plans').get()).data();
    let html = '';
    Object.keys(plans).sort((a,b) => (plans[a].price||0) - (plans[b].price||0)).forEach(key => {
        const p = plans[key];
        const icon = p.status === 'active' ? '🟢' : p.status === 'disabled' ? '🔒' : '🔴';
        html += `<div class="card" style="opacity:${p.status==='active'?'1':'0.6'}"><div style="display:flex;justify-content:space-between;align-items:center;"><div><strong>${icon} ${p.name}</strong><br><small>${fmt(p.price)} | Q: ${fmt(p.perQ)} | Day: ${fmt(p.daily)}</small></div><div>${p.status==='active'?`<button class="btn btn-warning btn-sm" onclick="togglePlan('${key}','disabled')">Disable</button>`:`<button class="btn btn-success btn-sm" onclick="togglePlan('${key}','active')">Enable</button>`}<button class="btn btn-sm" style="background:var(--danger);color:white;" onclick="togglePlan('${key}','soldout')">Sold Out</button></div></div></div>`;
    });
    document.getElementById('plansAdminList').innerHTML = html || '<p>No plans</p>';
}

async function togglePlan(key, status) { const plans = (await db.collection('settings').doc('plans').get()).data(); if (plans[key]) { plans[key].status = status; await setDoc('settings', 'plans', plans); loadPlansAdmin(); } }

function showAddPlan() {
    const key = prompt('Plan key (e.g. "vip"):'); if (!key) return;
    const name = prompt('Plan name:'); const price = parseInt(prompt('Price (₦):'));
    const perQ = parseInt(prompt('Per Question (₦):')); const daily = parseInt(prompt('Daily (₦):'));
    if (!name || !price) return;
    db.collection('settings').doc('plans').get().then(snap => { const plans = snap.data() || {}; plans[key.toLowerCase()] = { name, price, perQ, daily, status: 'disabled' }; setDoc('settings', 'plans', plans); loadPlansAdmin(); toast('✅ Plan added!'); });
}

async function loadNotices() { const n = await db.collection('settings').doc('notices').get(); if (n.exists) { const d = n.data(); document.getElementById('noticeDeposit').value = d.deposit || ''; document.getElementById('noticeWithdrawal').value = d.withdrawal || ''; document.getElementById('noticeHome').value = d.home || ''; document.getElementById('noticeTasks').value = d.tasks || ''; } }
async function saveNotices() { await setDoc('settings', 'notices', { deposit: document.getElementById('noticeDeposit').value, withdrawal: document.getElementById('noticeWithdrawal').value, home: document.getElementById('noticeHome').value, tasks: document.getElementById('noticeTasks').value }); toast('✅ Notices saved!'); }
async function sendBroadcast() { const msg = document.getElementById('broadMsg').value; if (!msg) return toast('Enter message'); const dur = parseInt(document.getElementById('broadDuration').value) || 24; await setDoc('settings', 'broadcast', { message: msg, expiry: Date.now() + dur * 3600000, date: new Date().toISOString() }); toast('✅ Broadcast sent!'); document.getElementById('broadMsg').value = ''; }

async function loadSettingsData() {
    const s = await db.collection('settings').doc('siteSettings').get();
    if (s.exists) { document.getElementById('setTelegram').value = s.data().telegramLink || ''; document.getElementById('setSupportEmail').value = s.data().supportEmail || ''; }
    const p = await db.collection('settings').doc('site').get();
    if (p.exists) { document.getElementById('setBonus').value = p.data().bonus || 300; document.getElementById('setCycle').value = p.data().cycle || 60; document.getElementById('setRef1').value = p.data().ref1 || 10; document.getElementById('setRef2').value = p.data().ref2 || 3; document.getElementById('setRef3').value = p.data().ref3 || 1; }
}

async function saveSettings() {
    await setDoc('settings', 'siteSettings', { telegramLink: document.getElementById('setTelegram').value, supportEmail: document.getElementById('setSupportEmail').value });
    await setDoc('settings', 'site', { bonus: parseInt(document.getElementById('setBonus').value) || 300, cycle: parseInt(document.getElementById('setCycle').value) || 60, ref1: parseInt(document.getElementById('setRef1').value) || 10, ref2: parseInt(document.getElementById('setRef2').value) || 3, ref3: parseInt(document.getElementById('setRef3').value) || 1 });
    toast('✅ Settings saved!');
}

document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active'); });
