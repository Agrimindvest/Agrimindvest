// ============ AGRIMINDVEST - FIREBASE CONFIG & HELPERS ============

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAXV8tYVPflDCNnwO8GulVMU5_H7Zol6wo",
    authDomain: "agrimindvest.firebaseapp.com",
    projectId: "agrimindvest",
    storageBucket: "agrimindvest.firebasestorage.app",
    messagingSenderId: "360169224214",
    appId: "1:360169224214:web:4b9650ed0e9786771d9d37"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============ CONSTANTS ============
const ADMIN_EMAIL = 'agrimindvest@gmail.com';
const DEPOSIT_BANK = 'Safe Haven Microfinance Bank';
const DEPOSIT_ACCOUNT = '5012552807';
const DEPOSIT_NAME = 'PEERPURSETECHNO';
const WELCOME_BONUS = 300;
const WITHDRAWAL_FEE_PCT = 15;
const MIN_DEPOSIT = 5000;
const MIN_WITHDRAWAL = 500;

// ============ HELPER FUNCTIONS ============

// Format currency
function fmt(n) {
    return '₦' + Number(n || 0).toLocaleString();
}

// Toast notification with fade
function toast(message, duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) {
        existing.classList.add('fade-out');
        setTimeout(() => existing.remove(), 300);
    }
    
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    document.body.appendChild(t);
    
    setTimeout(() => {
        t.classList.add('fade-out');
        setTimeout(() => t.remove(), 300);
    }, duration);
}

// Generate random reference
function generateRef(prefix = 'AGV') {
    return prefix + '-' + Date.now().toString(36).toUpperCase().slice(-6);
}

// Generate unique user ID (AGV prefix)
function generateUserId() {
    return 'AGV-' + Date.now().toString(36).toUpperCase().slice(-8);
}

// ============ AUTH CHECK ============
function checkAuth() {
    const userData = localStorage.getItem('agv_u');
    if (!userData) {
        window.location.href = 'login.html';
        return null;
    }
    try {
        return JSON.parse(userData);
    } catch (e) {
        localStorage.removeItem('agv_u');
        window.location.href = 'login.html';
        return null;
    }
}

// Get current user from localStorage
function getCurrentUser() {
    const userData = localStorage.getItem('agv_u');
    if (!userData) return null;
    try {
        return JSON.parse(userData);
    } catch (e) {
        return null;
    }
}

// Refresh user data from Firestore
async function refreshUser() {
    const user = getCurrentUser();
    if (!user || !user.id) return null;
    
    const doc = await db.collection('users').doc(user.id).get();
    if (doc.exists) {
        const updatedUser = { id: doc.id, ...doc.data() };
        localStorage.setItem('agv_u', JSON.stringify(updatedUser));
        return updatedUser;
    }
    return user;
}

// Check if user has active plan
function hasActivePlan(user) {
    if (!user) return false;
    return user.plan && user.plan !== 'none' && user.ownedPlans && user.ownedPlans.length > 0;
}

// Check if user can withdraw today
async function canWithdrawToday(userId) {
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await db.collection('withdrawals')
        .where('userId', '==', userId)
        .where('date', '>=', today)
        .get();
    const w = await db.collection('settings').doc('withdrawalSettings').get();
    const maxPerDay = w.exists ? (w.data().maxPerDay || 1) : 1;
    return snapshot.size < maxPerDay;
}

// Check if withdrawal window is open
async function isWithdrawalWindowOpen() {
    const w = await db.collection('settings').doc('withdrawalSettings').get();
    if (!w.exists) {
        const d = new Date();
        return d.getDay() >= 1 && d.getDay() <= 5 && d.getHours() >= 9 && d.getHours() < 16;
    }
    const settings = w.data();
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    return settings.days?.includes(day) && 
           hour >= (settings.openHour || 9) && 
           hour < (settings.closeHour || 16);
}

// ============ FIREBASE HELPERS ============
async function getDoc(collection, docId) {
    const doc = await db.collection(collection).doc(docId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function setDoc(collection, docId, data) {
    await db.collection(collection).doc(docId).set({
        ...data,
        updatedAt: new Date().toISOString()
    });
}

async function updateDoc(collection, docId, data) {
    await db.collection(collection).doc(docId).update({
        ...data,
        updatedAt: new Date().toISOString()
    });
}

async function getCollection(collectionName) {
    const snapshot = await db.collection(collectionName).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function deleteDoc(collection, docId) {
    await db.collection(collection).doc(docId).delete();
}

// ============ EMAIL NOTIFICATION ============
async function sendAdminEmail(subject, message) {
    try {
        const formData = new FormData();
        formData.append('email', ADMIN_EMAIL);
        formData.append('_subject', subject);
        formData.append('_template', 'box');
        formData.append('message', message);
        await fetch('https://formsubmit.co/ajax/' + ADMIN_EMAIL, {
            method: 'POST',
            body: formData
        });
        return true;
    } catch (e) {
        console.log('Email notification failed:', e);
        return false;
    }
}

// ============ PLANS HELPERS ============
async function getActivePlans() {
    const snap = await db.collection('settings').doc('plans').get();
    if (!snap.exists) return {};
    const allPlans = snap.data();
    const active = {};
    Object.keys(allPlans).forEach(key => {
        if (allPlans[key].status === 'active') {
            active[key] = allPlans[key];
        }
    });
    return active;
}

async function getAllPlans() {
    const snap = await db.collection('settings').doc('plans').get();
    if (!snap.exists) return {};
    return snap.data();
}

// Calculate total per-question earnings from user's plans
function calculatePerQuestion(user, plans) {
    if (!user || !user.ownedPlans || !plans) return 0;
    let total = 0;
    const planCounts = {};
    (user.ownedPlans || []).forEach(p => {
        planCounts[p] = (planCounts[p] || 0) + 1;
    });
    Object.keys(planCounts).forEach(planKey => {
        if (plans[planKey]) {
            total += plans[planKey].perQ * planCounts[planKey];
        }
    });
    return total;
}

// ============ COUNT UP ANIMATION ============
function animateCountUp(element, target, duration = 800) {
    const start = 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + (target - start) * eased);
        element.textContent = fmt(current);
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// ============ STAGGER CARDS ============
function staggerCards(selector, baseDelay = 0.05) {
    const cards = document.querySelectorAll(selector);
    cards.forEach((card, i) => {
        card.style.animationDelay = (i * baseDelay) + 's';
        card.style.opacity = '1';
    });
}

console.log('🌱 Agrimindvest Firebase Ready');
