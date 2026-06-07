// /verify-email/ - bootstrap : Vanta birds + OTP flow.
// Externalisé depuis l'inline pour permettre une CSP sans 'unsafe-inline'.
import { onAuthStateChanged, signOut, reload } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ── Vanta bootstrap ──────────────────────────────────────────────────────────
function bootVanta() {
  try {
    if (window.VANTA && window.VANTA.BIRDS) {
      window.VANTA.BIRDS({ el: '#vanta-birds-bg', mouseControls: true, touchControls: true, backgroundColor: 0x07192f, color1: 0x7192ff, color2: 0xd1ff, quantity: 3.0 });
    } else {
      setTimeout(bootVanta, 80);
    }
  } catch (e) { /* ignore */ }
}
bootVanta();

if (!window._cyfFirebase) { await import('/js/firebase.js'); }
const { app, auth } = window._cyfFirebase;

// ── DOM refs ───────────────────────────────────────────────────────────────
const emailDisplay  = document.getElementById('user-email-display');
const verifyBtn     = document.getElementById('verify-btn');
const resendBtn     = document.getElementById('resend-btn');
const cooldownMsg   = document.getElementById('cooldown-msg');
const errorMsg      = document.getElementById('error-msg');
const otpHint       = document.getElementById('otp-hint');
const signoutBtn    = document.getElementById('signout-btn');
const notif         = document.getElementById('notification');
const otpBoxes      = Array.from(document.querySelectorAll('.otp-box'));

let currentUser = null;
let resendCooldown = 0;
let cooldownTimer = null;

// ── Notification helper ────────────────────────────────────────────────────
function showNotif(msg, type = 'success') {
  notif.textContent = msg;
  notif.className = `notification show ${type}`;
  setTimeout(() => notif.classList.remove('show'), 4000);
}

// ── OTP logic ──────────────────────────────────────────────────────────────
function getOtpValue() { return otpBoxes.map(b => b.value).join(''); }

function setOtpState(state) {
  otpBoxes.forEach(b => {
    b.classList.remove('error', 'success');
    if (state) b.classList.add(state);
  });
}

otpBoxes.forEach((box, i) => {
  box.addEventListener('input', (e) => {
    // Accept only digits
    box.value = box.value.replace(/\D/g, '').slice(-1);
    box.classList.toggle('filled', !!box.value);
    errorMsg.textContent = '';
    if (box.value && i < 5) otpBoxes[i + 1].focus();
    verifyBtn.disabled = getOtpValue().length !== 6;
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !box.value && i > 0) {
      otpBoxes[i - 1].value = '';
      otpBoxes[i - 1].classList.remove('filled');
      otpBoxes[i - 1].focus();
      verifyBtn.disabled = true;
    }
    if (e.key === 'Enter' && getOtpValue().length === 6) verifyCode();
  });

  // Handle paste on any box
  box.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
    pasted.split('').forEach((ch, j) => {
      if (otpBoxes[j]) { otpBoxes[j].value = ch; otpBoxes[j].classList.add('filled'); }
    });
    if (pasted.length === 6) { otpBoxes[5].focus(); verifyBtn.disabled = false; }
    else if (pasted.length > 0) otpBoxes[pasted.length - 1].focus();
  });
});

// ── Cooldown ───────────────────────────────────────────────────────────────
function startResendCooldown(seconds = 60) {
  resendCooldown = seconds;
  resendBtn.disabled = true;
  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    resendCooldown--;
    if (resendCooldown <= 0) {
      clearInterval(cooldownTimer);
      resendBtn.disabled = false;
      cooldownMsg.textContent = '';
    } else {
      cooldownMsg.textContent = `Renvoyer dans ${resendCooldown}s`;
    }
  }, 1000);
  cooldownMsg.textContent = `Renvoyer dans ${seconds}s`;
}

// ── Send/Resend OTP ────────────────────────────────────────────────────────
async function sendOtp(user) {
  otpHint.innerHTML = '<span class="status-dot"></span> Envoi du code…';
  otpHint.style.color = '';
  try {
    const idToken = await user.getIdToken(true);
    const res = await fetch('/api/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    // Try to parse JSON - if it fails, the API returned HTML (crash)
    let data;
    try {
      data = await res.json();
    } catch (jsonErr) {
      const statusText = `HTTP ${res.status}`;
      console.error('sendOtp: API returned non-JSON', statusText);
      otpHint.innerHTML = `⚠️ Erreur serveur (${statusText}) - contactez le support`;
      otpHint.style.color = '#ef4444';
      showNotif(`Erreur serveur ${statusText}`, 'error');
      return;
    }

    if (!res.ok) {
      if (res.status === 429) {
        startResendCooldown(data.retryAfter || 60);
        otpHint.innerHTML = '<span class="status-dot"></span> Entrez le code déjà envoyé par email';
        otpBoxes[0].focus();
      } else {
        console.error('sendOtp API error:', data);
        otpHint.innerHTML = `⚠️ ${data.error || 'Impossible d\'envoyer le code'}`;
        otpHint.style.color = '#ef4444';
        showNotif(data.error || 'Impossible d\'envoyer le code', 'error');
      }
      return;
    }
    showNotif('Code envoyé ! Vérifiez votre boîte mail 📧', 'info');
    startResendCooldown(60);
    otpHint.style.color = '';
    otpHint.innerHTML = '<span class="status-dot"></span> Code envoyé - vérifiez vos spams si besoin';
    otpBoxes[0].focus();
  } catch (err) {
    console.error('sendOtp fetch error', err);
    otpHint.innerHTML = '⚠️ Erreur réseau - vérifiez votre connexion internet';
    otpHint.style.color = '#ef4444';
    showNotif('Erreur réseau. Réessayez.', 'error');
  }
}

// ── Verify code ───────────────────────────────────────────────────────────
async function verifyCode() {
  const code = getOtpValue();
  if (code.length !== 6) return;
  if (!currentUser) return;

  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Vérification…';
  errorMsg.textContent = '';

  try {
    const idToken = await currentUser.getIdToken(true);
    const res = await fetch('/api/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, code }),
    });
    const data = await res.json();

    if (!res.ok) {
      setOtpState('error');
      errorMsg.textContent = data.error || 'Code incorrect';
      verifyBtn.textContent = 'Vérifier mon email';
      verifyBtn.disabled = false;
      // Clear boxes if too many attempts
      if (data.attemptsLeft === 0 || !data.attemptsLeft) {
        otpBoxes.forEach(b => { b.value = ''; b.classList.remove('filled', 'error'); });
        verifyBtn.disabled = true;
      }
      return;
    }

    // ✅ Success
    setOtpState('success');
    showNotif('Email vérifié ! Bienvenue 🎉', 'success');
    verifyBtn.textContent = 'Vérifié ✓ Redirection…';
    otpHint.textContent = '✅ Email confirmé';

    // Force Firebase client to reload the user token so emailVerified = true
    await reload(currentUser);
    setTimeout(() => window.location.replace('/app'), 1800);

  } catch (err) {
    console.error('verifyCode error', err);
    setOtpState('error');
    errorMsg.textContent = 'Erreur réseau. Réessayez.';
    verifyBtn.textContent = 'Vérifier mon email';
    verifyBtn.disabled = false;
  }
}

verifyBtn.addEventListener('click', verifyCode);

// ── Resend ────────────────────────────────────────────────────────────────
resendBtn.addEventListener('click', () => {
  if (!currentUser) return;
  otpBoxes.forEach(b => { b.value = ''; b.classList.remove('filled', 'error', 'success'); });
  verifyBtn.disabled = true;
  errorMsg.textContent = '';
  sendOtp(currentUser);
});

// ── Sign out ───────────────────────────────────────────────────────────────
signoutBtn.addEventListener('click', async () => {
  try { await signOut(auth); } catch(e) {}
  window.location.replace('/login');
});

// ── Auth state ────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace('/login'); return; }
  if (user.emailVerified) { window.location.replace('/app'); return; }

  currentUser = user;
  emailDisplay.textContent = user.email || '';

  // Auto-send on first visit this session
  const autoSentKey = 'cyf_verify_autosent_' + user.uid;
  if (!sessionStorage.getItem(autoSentKey)) {
    sessionStorage.setItem(autoSentKey, '1');
    await sendOtp(user);
  } else {
    otpHint.innerHTML = '<span class="status-dot"></span> Entrez le code reçu par email';
    otpBoxes[0].focus();
  }
});
