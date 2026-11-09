import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification, reload, sendPasswordResetEmail, getMultiFactorResolver, multiFactor, TotpMultiFactorGenerator } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, runTransaction, collection, addDoc, getDocs, query, orderBy, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const EXTRA_KEY = 'stap-client-extra-v1';
const SESSION_UID = 'stap-suite-hydrated-uid';
const advice = {
  green: 'Je voelt je rustig. Fijn. Je kunt doorgaan met wat je doet. Je mag ook even pauze nemen.',
  orange: 'Het wordt wat druk. Doe een stapje terug. Zoek een rustigere plek, zet je koptelefoon op of vraag iemand om hulp.',
  red: 'Het is nu te veel. Stop even als dat kan. Ga naar een rustige plek en vraag iemand die je vertrouwt om bij je te komen.'
};
const help = {
  rust: 'Zoek een rustige plek. Neem rustig de tijd.',
  koptelefoon: 'Zet je koptelefoon op als dat prettig voelt.',
  hulp: 'Je kunt zeggen: “Het is te druk in mijn hoofd. Wil je mij helpen?”',
  pauze: 'Neem een pauze. Je hoeft nu niet alles af te maken.'
};
let auth = null, db = null, user = null, mode = 'login', totpSecret = null, group = null;
let plannerSaveTimer = null, extra = readExtra(), mindfulTimer = null, mindfulStart = 0;

function readExtra() {
  try {
    const v = JSON.parse(localStorage.getItem(EXTRA_KEY) || '{}');
    return { reminders: Array.isArray(v.reminders) ? v.reminders : [], sensoryHistory: Array.isArray(v.sensoryHistory) ? v.sensoryHistory : [], groupId: v.groupId || '', mindfulSessions: Number(v.mindfulSessions) || 0 };
  } catch { return { reminders: [], sensoryHistory: [], groupId: '', mindfulSessions: 0 }; }
}
function saveExtra() {
  localStorage.setItem(EXTRA_KEY, JSON.stringify(extra));
  queueCloudSave();
}
function showMessage(text, error = false) {
  $('authMessage').textContent = text;
  $('authMessage').hidden = !text;
  $('authMessage').classList.toggle('error', error);
}
function status(text, state = '') {
  const node = $('cloudSyncStatus');
  if (node) { node.textContent = text; node.classList.toggle('ok', state === 'ok'); node.classList.toggle('error', state === 'error'); }
}
function authText(error) {
  const messages = {
    'auth/email-already-in-use': 'Dit e-mailadres heeft al een account. Log in.',
    'auth/invalid-email': 'Controleer je e-mailadres.',
    'auth/invalid-credential': 'Je e-mailadres of wachtwoord klopt niet.',
    'auth/weak-password': 'Kies een sterker wachtwoord van minimaal 10 tekens.',
    'auth/too-many-requests': 'Er is te vaak geprobeerd in te loggen. Probeer het later opnieuw.',
    'auth/network-request-failed': 'Geen internetverbinding. Controleer je verbinding.',
    'auth/invalid-verification-code': 'Deze code klopt niet. Probeer de nieuwste code.',
    'auth/second-factor-already-in-use': 'Deze Authenticator is al gekoppeld.'
  };
  return messages[error?.code] || error?.message || 'Er ging iets mis. Probeer het opnieuw.';
}
function setMode(next) {
  mode = next;
  const signup = mode === 'signup';
  $('authTitle').textContent = signup ? 'Maak jouw account' : 'Welkom terug';
  $('authIntro').textContent = signup ? 'Kies een gebruikersnaam. Je hebt een e-mailadres en wachtwoord nodig.' : 'Log in met je e-mailadres en wachtwoord.';
  $('authUsernameWrap').hidden = !signup;
  $('authConfirmWrap').hidden = !signup;
  $('authSubmit').textContent = signup ? 'Account maken' : 'Inloggen';
  $('authModeSwitch').textContent = signup ? 'Ik heb al een account' : 'Ik wil een account maken';
  $('authForgotPassword').hidden = signup;
  $('authPassword').autocomplete = signup ? 'new-password' : 'current-password';
  $('authExtra').hidden = true;
  $('authExtra').innerHTML = '';
  showMessage('');
}
function extraPanel(html) { $('authExtra').innerHTML = html; $('authExtra').hidden = false; }
function validUsername(value) { return /^[a-zA-Z0-9_]{3,20}$/.test(value); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function claimUsername(account, name) {
  const lower = name.toLowerCase();
  const usernameRef = doc(db, 'usernames', lower);
  const profileRef = doc(db, 'users', account.uid, 'private', 'profile');
  await runTransaction(db, async tx => {
    const found = await tx.get(usernameRef);
    if (found.exists() && found.data().uid !== account.uid) throw new Error('Deze gebruikersnaam is al gekozen. Kies een andere naam.');
    tx.set(usernameRef, { uid: account.uid, username: name, usernameLower: lower, updatedAt: serverTimestamp() });
    tx.set(profileRef, { uid: account.uid, username: name, email: account.email, updatedAt: serverTimestamp() }, { merge: true });
  });
}
async function ensureUsername(account) {
  const profileRef = doc(db, 'users', account.uid, 'private', 'profile');
  const profile = await getDoc(profileRef);
  if (profile.exists() && profile.data().username) return;
  const pending = sessionStorage.getItem('stap-pending-username:' + account.uid);
  if (pending) {
    try { await claimUsername(account, pending); sessionStorage.removeItem('stap-pending-username:' + account.uid); return; }
    catch (e) { if (!String(e.message).includes('al gekozen')) throw e; }
  }
  extraPanel('<div class="client-panel" style="margin-top:18px"><h2>Kies een gebruikersnaam</h2><p>Je e-mailadres is bevestigd. Kies een naam die nog niemand anders gebruikt.</p><form id="usernameSetupForm" class="auth-form"><label>Gebruikersnaam<input id="usernameSetup" minlength="3" maxlength="20" required></label><button class="button button-primary" type="submit">Gebruikersnaam opslaan</button></form></div>');
  $('usernameSetupForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const name = $('usernameSetup').value.trim();
    if (!validUsername(name)) { showMessage('Gebruik 3 tot 20 letters, cijfers of een laag streepje.', true); return; }
    try { await claimUsername(account, name); await nextMfa(account); }
    catch (e) { showMessage(authText(e), true); }
  });
  throw new Error('USERNAME_SETUP_REQUIRED');
}
async function showVerify(account) {
  $('authTitle').textContent = 'Bevestig je e-mailadres';
  $('authIntro').textContent = 'We hebben een e-mail gestuurd naar ' + account.email + '. Open die e-mail en klik op de bevestigingslink.';
  extraPanel('<div class="client-panel" style="margin-top:18px"><h2>Nog niet bevestigd?</h2><p>Controleer ook je map met ongewenste e-mail.</p><div class="client-buttons"><button id="checkVerified" class="client-button primary" type="button">Ik heb bevestigd</button><button id="resendVerification" class="client-button" type="button">Stuur de e-mail opnieuw</button><button id="verifyLogout" class="client-button" type="button">Uitloggen</button></div></div>');
  $('checkVerified').onclick = async () => { try { await reload(account); if (!auth.currentUser.emailVerified) { showMessage('Je e-mailadres is nog niet bevestigd.', true); return; } await authenticated(auth.currentUser); } catch(e) { showMessage(authText(e), true); } };
  $('resendVerification').onclick = async () => { try { await sendEmailVerification(account); showMessage('De bevestigingsmail is opnieuw verstuurd.'); } catch(e) { showMessage(authText(e), true); } };
  $('verifyLogout').onclick = () => signOut(auth);
}
async function authenticated(account) {
  user = account;
  if (!account.emailVerified) { await showVerify(account); return; }
  try { await ensureUsername(account); }
  catch(e) { if (e.message === 'USERNAME_SETUP_REQUIRED') return; throw e; }
  await nextMfa(account);
}
async function nextMfa(account) {
  if (!account.emailVerified) { await showVerify(account); return; }
  const enrolled = multiFactor(account).enrolledFactors.some(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!enrolled) { await enrollTotp(account); return; }
  await enterApp(account);
}
function showMfaChallenge(resolver) {
  extraPanel('<div class="client-panel" style="margin-top:18px"><h2>Google Authenticator</h2><p>Open Google Authenticator. Typ de nieuwste code van 6 cijfers in.</p><form id="totpSignInForm" class="auth-form"><label>Code van 6 cijfers<input id="totpSignInCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></label><button class="button button-primary" type="submit">Controleren</button></form></div>');
  $('totpSignInForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const code = $('totpSignInCode').value.trim();
    if (!/^\d{6}$/.test(code)) { showMessage('Vul de code van 6 cijfers in.', true); return; }
    try {
      const hint = resolver.hints.find(item => item.factorId === TotpMultiFactorGenerator.FACTOR_ID);
      if (!hint) throw new Error('Er is geen Google Authenticator gekoppeld.');
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code);
      const result = await resolver.resolveSignIn(assertion);
      await authenticated(result.user);
    } catch(e) { showMessage(authText(e), true); }
  });
}
async function enrollTotp(account) {
  try {
    totpSecret = await TotpMultiFactorGenerator.generateSecret(multiFactor(account).getSession());
    const key = totpSecret.secretKey;
    extraPanel('<div class="client-panel" style="margin-top:18px"><h2>Google Authenticator instellen</h2><p>Voeg Stap voor Stap toe in Google Authenticator.</p><ol><li>Open Google Authenticator.</li><li>Tik op het plusje.</li><li>Kies Instelsleutel invoeren.</li><li>Vul deze sleutel in.</li><li>Typ daarna de code van 6 cijfers hieronder.</li></ol><span class="auth-secret">' + escapeHtml(key) + '</span><button id="copyTotpKey" class="client-button" type="button">Kopieer instelsleutel</button><form id="totpEnrollForm" class="auth-form"><label>Code uit Google Authenticator<input id="totpEnrollCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></label><button class="button button-primary" type="submit">Authenticator koppelen</button></form><p class="auth-help">Bewaar deze sleutel niet in een bericht of screenshot. Deel hem met niemand.</p></div>');
    $('copyTotpKey').onclick = async () => { try { await navigator.clipboard.writeText(key); showMessage('De sleutel is gekopieerd.'); } catch { showMessage('Kopiëren lukt niet. Voer de sleutel handmatig in.'); } };
    $('totpEnrollForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const code = $('totpEnrollCode').value.trim();
      if (!/^\d{6}$/.test(code)) { showMessage('Vul de code van 6 cijfers in.', true); return; }
      try {
        await multiFactor(account).enroll(TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, code), 'Google Authenticator');
        totpSecret = null;
        await enterApp(account);
      } catch(e) { showMessage(authText(e), true); }
    });
  } catch(e) { showMessage('Google Authenticator instellen is niet gelukt: ' + authText(e), true); }
}

async function enterApp(account) {
  user = account;
  const marker = sessionStorage.getItem(SESSION_UID);
  if (marker !== account.uid) {
    const snap = await getDoc(doc(db, 'users', account.uid, 'data', 'app'));
    if (snap.exists()) {
      const value = snap.data();
      if (value.planner) localStorage.setItem('stap-voor-stap-v1', JSON.stringify(value.planner));
      else localStorage.removeItem('stap-voor-stap-v1');
      if (value.extras) localStorage.setItem(EXTRA_KEY, JSON.stringify(value.extras));
      else localStorage.removeItem(EXTRA_KEY);
    } else {
      // Nieuw account: geen lokale gegevens van een ander account meenemen.
      localStorage.removeItem('stap-voor-stap-v1');
      localStorage.removeItem(EXTRA_KEY);
    }
    sessionStorage.setItem(SESSION_UID, account.uid);
    location.reload();
    return;
  }
  extra = readExtra();
  const profile = await getDoc(doc(db, 'users', account.uid, 'private', 'profile'));
  const name = profile.exists() ? profile.data().username : 'Mijn account';
  $('accountName').textContent = name;
  $('settingsAccountName').textContent = name;
  $('authGate').hidden = true;
  $('appContent').hidden = false;
  status('Alles is gekoppeld aan jouw account.', 'ok');
  renderExtras();
  await refreshReminders();
  await refreshGroup();
}
function queueCloudSave() {
  if (!user || !db) return;
  clearTimeout(plannerSaveTimer);
  plannerSaveTimer = setTimeout(() => saveCloud().catch(e => { console.warn(e); status('Synchroniseren is niet gelukt. Controleer je internet.', 'error'); }), 900);
}
async function saveCloud() {
  if (!user || !db) return;
  let planner = null, extras = extra;
  try { planner = JSON.parse(localStorage.getItem('stap-voor-stap-v1') || 'null'); extras = JSON.parse(localStorage.getItem(EXTRA_KEY) || 'null') || extra; } catch {}
  await setDoc(doc(db, 'users', user.uid, 'data', 'app'), { planner, extras, updatedAt: serverTimestamp() }, { merge: true });
  status('Alles is opgeslagen bij jouw account.', 'ok');
}
async function logout() {
  try { await saveCloud(); } catch(e) { console.warn(e); }
  sessionStorage.removeItem(SESSION_UID);
  localStorage.removeItem('stap-voor-stap-v1');
  localStorage.removeItem(EXTRA_KEY);
  await signOut(auth);
}

function reminderId(id, day) {
  const text = id + day.getFullYear() + '-' + (day.getMonth()+1) + '-' + day.getDate();
  let hash = 0; for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return 100000 + hash % 1900000000;
}
async function refreshReminders() {
  const plugin = window.StapNotifications;
  if (!plugin?.isNative) { renderReminders(); return; }
  for (const item of extra.reminders) {
    item.notificationIds = [];
    for (let n = 0; n < 8; n++) {
      const day = new Date(); day.setHours(0,0,0,0); day.setDate(day.getDate() + n);
      const wd = day.getDay();
      const allowed = item.repeat === 'daily' || (item.repeat === 'weekdays' && wd >= 1 && wd <= 5) || (item.repeat === 'weekend' && (wd === 0 || wd === 6));
      if (!allowed) continue;
      const parts = item.time.split(':').map(Number);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), parts[0], parts[1]);
      if (at <= new Date()) continue;
      const id = reminderId(item.id, day);
      const result = await plugin.schedule({ id, title: 'Stap voor Stap herinnering', body: item.title, at: at.toISOString() });
      if (result.status === 'scheduled') item.notificationIds.push(id);
    }
  }
  saveExtra(); renderReminders();
}
function renderReminders() {
  const root = $('clientReminderList');
  if (!root) return;
  if (!extra.reminders.length) { root.innerHTML = '<p class="client-muted">Je hebt nog geen herinneringen ingesteld.</p>'; return; }
  const labels = { daily: 'Elke dag', weekdays: 'Maandag tot en met vrijdag', weekend: 'In het weekend' };
  root.innerHTML = extra.reminders.map(item => '<div class="community-item"><h3>🔔 ' + escapeHtml(item.title) + '</h3><p><strong>' + escapeHtml(item.time) + '</strong> · ' + labels[item.repeat] + '</p><button class="client-button" type="button" data-delete-reminder="' + escapeHtml(item.id) + '">Verwijderen</button></div>').join('');
}
function renderSensory() {
  const latest = extra.sensoryHistory[0];
  $('sensoryAdvice').textContent = latest ? advice[latest.level] : 'Je hebt nog niets gekozen. Neem rustig de tijd.';
  document.querySelectorAll('[data-sensory]').forEach(b => b.setAttribute('aria-pressed', String(Boolean(latest && b.dataset.sensory === latest.level))));
  $('sensoryHistory').innerHTML = extra.sensoryHistory.slice(0, 8).map(item => '<p>' + new Date(item.at).toLocaleString('nl-NL') + ' · <strong>' + ({green:'Groen',orange:'Oranje',red:'Rood'}[item.level]) + '</strong></p>').join('') || 'Je hebt nog geen keuzes opgeslagen.';
}
function renderExtras() { renderReminders(); renderSensory(); }

async function refreshGroup() {
  if (!user || !extra.groupId) { group = null; showGroupState(); return; }
  try {
    const g = await getDoc(doc(db, 'groups', extra.groupId));
    if (!g.exists()) { extra.groupId = ''; saveExtra(); group = null; showGroupState(); return; }
    group = { id: g.id, ...g.data() };
    showGroupState();
    const [p, c, s] = await Promise.all([
      getDocs(query(collection(db,'groups',group.id,'polls'),orderBy('createdAt','desc'))),
      getDocs(query(collection(db,'groups',group.id,'chores'),orderBy('createdAt','desc'))),
      getDocs(query(collection(db,'groups',group.id,'shifts'),orderBy('date','asc')))
    ]);
    const polls = await Promise.all(p.docs.map(async d => {
      const v = await getDocs(collection(db,'groups',group.id,'polls',d.id,'votes'));
      return { id:d.id, ...d.data(), votes:v.docs.map(x => x.data()) };
    }));
    renderPolls(polls);
    renderChores(c.docs.map(d=>({id:d.id,...d.data()})));
    renderShifts(s.docs.map(d=>({id:d.id,...d.data()})));
  } catch(e) { console.warn(e); status('De groepsinformatie kan niet worden geladen.', 'error'); }
}
function showGroupState() {
  $('groupAccessPanel').hidden = Boolean(group);
  $('groupDashboard').hidden = !group;
  if (group) { $('groupNameHeading').textContent = group.name; $('groupCodeDisplay').textContent = group.groupCode; }
}
function renderPolls(polls) {
  const root = $('pollList');
  if (!polls.length) { root.innerHTML = '<p class="client-muted">Er is nog geen stemming.</p>'; return; }
  root.innerHTML = polls.map(p => {
    const mine = p.votes.find(v=>v.uid===user.uid)?.option;
    const choices = p.options.map(option => {
      const count = p.votes.filter(v=>v.option===option).length;
      return '<button class="poll-option ' + (mine===option?'selected':'') + '" type="button" data-vote-poll="' + p.id + '" data-vote-option="' + escapeHtml(option) + '">' + escapeHtml(option) + '<span class="poll-count">' + count + ' stemmen</span></button>';
    }).join('');
    return '<article class="community-item"><h3>' + escapeHtml(p.question) + '</h3><p class="poll-meta">Iedereen in de groep kan stemmen.</p>' + choices + '<p class="poll-meta">' + (mine ? 'Jouw stem: '+escapeHtml(mine) : 'Je hebt nog niet gestemd.') + '</p></article>';
  }).join('');
}
function renderChores(list) {
  const mine = list.filter(x=>x.doneBy===user.uid).reduce((n,x)=>n+Number(x.points||0),0);
  $('choreList').innerHTML = '<p class="reward-points">Mijn punten: ' + mine + '</p>' + (list.length ? list.map(x=>'<div class="reward-row"><div><strong>'+escapeHtml(x.title)+'</strong><p class="poll-meta">'+Number(x.points||0)+' punten · '+(x.done?'Klaar':'Nog te doen')+'</p></div>'+(x.done?'<span class="poll-meta">'+(x.doneBy===user.uid?'Door jou gedaan':'Afgerond')+'</span>':'<button class="client-button primary" type="button" data-complete-chore="'+x.id+'">Ik heb dit gedaan</button>')+'</div>').join('') : '<p class="client-muted">Er zijn nog geen klusjes.</p>');
}
function renderShifts(list) {
  $('shiftList').innerHTML = list.length ? list.map(x=>'<div class="shift-row"><div class="shift-time">'+escapeHtml(x.date)+'<br>'+escapeHtml(x.start)+'–'+escapeHtml(x.end)+'</div><div><strong>'+escapeHtml(x.name)+'</strong><span class="shift-proof">Toegevoegd door een groepslid</span></div></div>').join('') : '<p class="client-muted">Er staan nog geen werktijden in.</p>';
}
function makeCode() {
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', bytes=new Uint8Array(6); crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>chars[b%chars.length]).join('');
}
async function createGroup(name) {
  const id = crypto.randomUUID(); let code = makeCode();
  while ((await getDoc(doc(db,'groupInvites',code))).exists()) code = makeCode();
  await setDoc(doc(db,'groups',id),{name,groupCode:code,ownerUid:user.uid,createdAt:serverTimestamp()});
  await setDoc(doc(db,'groupInvites',code),{groupId:id,ownerUid:user.uid,createdAt:serverTimestamp()});
  await setDoc(doc(db,'groups',id,'members',user.uid),{uid:user.uid,inviteCode:code,joinedAt:serverTimestamp()});
  await setDoc(doc(db,'users',user.uid,'private','profile'),{groupId:id},{merge:true});
  extra.groupId=id; saveExtra(); await refreshGroup();
}
async function joinGroup(code) {
  const invite = await getDoc(doc(db,'groupInvites',code));
  if (!invite.exists()) throw new Error('Deze groepscode bestaat niet.');
  const id=invite.data().groupId;
  await setDoc(doc(db,'groups',id,'members',user.uid),{uid:user.uid,inviteCode:code,joinedAt:serverTimestamp()});
  await setDoc(doc(db,'users',user.uid,'private','profile'),{groupId:id},{merge:true});
  extra.groupId=id; saveExtra(); await refreshGroup();
}
async function addPoll(question, options) { await addDoc(collection(db,'groups',group.id,'polls'),{question,options,createdBy:user.uid,createdAt:serverTimestamp()}); await refreshGroup(); }
async function vote(poll, option) { await setDoc(doc(db,'groups',group.id,'polls',poll,'votes',user.uid),{uid:user.uid,option,updatedAt:serverTimestamp()}); await refreshGroup(); }
async function addChore(title, points) { await addDoc(collection(db,'groups',group.id,'chores'),{title,points,done:false,doneBy:'',createdBy:user.uid,createdAt:serverTimestamp()}); await refreshGroup(); }
async function completeChore(id) { await updateDoc(doc(db,'groups',group.id,'chores',id),{done:true,doneBy:user.uid,doneAt:serverTimestamp(),updatedAt:serverTimestamp()}); await refreshGroup(); }
async function addShift(name,date,start,end) { await addDoc(collection(db,'groups',group.id,'shifts'),{name,date,start,end,createdBy:user.uid,createdAt:serverTimestamp()}); await refreshGroup(); }

$('authModeSwitch').addEventListener('click',()=>setMode(mode==='login'?'signup':'login'));
$('clientAuthForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  if (!auth) { showMessage('De accountfunctie is nog niet gekoppeld. Volg FIREBASE-INSTELLEN.md.',true); return; }
  const email=$('authEmail').value.trim(), password=$('authPassword').value;
  try {
    if (mode==='signup') {
      const username=$('authUsername').value.trim();
      if (!validUsername(username)) { showMessage('Gebruik 3 tot 20 letters, cijfers of een laag streepje.',true); return; }
      if (password!==$('authConfirm').value) { showMessage('De wachtwoorden zijn niet hetzelfde.',true); return; }
      const result=await createUserWithEmailAndPassword(auth,email,password);
      sessionStorage.setItem('stap-pending-username:'+result.user.uid,username);
      await sendEmailVerification(result.user); await signOut(auth);
      setMode('login'); showMessage('Je account is gemaakt. Open de bevestigingsmail en log daarna in. Dan stel je Google Authenticator in.');
    } else {
      try { const result=await signInWithEmailAndPassword(auth,email,password); await authenticated(result.user); }
      catch(error) { if (error.code==='auth/multi-factor-auth-required') showMfaChallenge(getMultiFactorResolver(auth,error)); else throw error; }
    }
  } catch(error) { showMessage(authText(error),true); }
});
$('authForgotPassword').addEventListener('click',async()=>{
  const email=$('authEmail').value.trim(); if(!email){showMessage('Vul eerst je e-mailadres in.',true);return;}
  try{await sendPasswordResetEmail(auth,email);showMessage('We hebben een link gestuurd om je wachtwoord opnieuw in te stellen.');}
  catch(e){showMessage(authText(e),true);}
});
$('accountLogout').onclick = logout;
$('settingsLogout').onclick = logout;
document.querySelectorAll('.nav-button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.view==='groep')refreshGroup();if(b.dataset.view==='herinneringen')renderReminders();}));
document.querySelectorAll('[data-sensory]').forEach(b=>b.addEventListener('click',()=>{
  extra.sensoryHistory.unshift({level:b.dataset.sensory,at:new Date().toISOString()});
  extra.sensoryHistory=extra.sensoryHistory.slice(0,40);saveExtra();renderSensory();
}));
document.querySelectorAll('[data-sensory-help]').forEach(b=>b.addEventListener('click',()=>{
  $('sensoryHelpStatus').textContent=help[b.dataset.sensoryHelp]||'';
  if(b.dataset.sensoryHelp==='hulp') speak(help.hulp);
}));
function speak(text) {
  if(!('speechSynthesis'in window)){ $('mindfulStatus').textContent='Voorlezen is niet beschikbaar op dit apparaat.'; return; }
  speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text);u.lang='nl-NL';u.rate=.76;u.pitch=.92;
  const v=speechSynthesis.getVoices().find(x=>/^nl([-_]|$)/i.test(x.lang));if(v)u.voice=v;speechSynthesis.speak(u);
}
function clock(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function stopMindful() { if(mindfulTimer)clearInterval(mindfulTimer);mindfulTimer=null;$('mindfulStart').disabled=false;$('breathCircle').classList.remove('breath-in','breath-out');$('breathCircle').textContent='Adem rustig';$('mindfulClock').textContent='02:00';$('mindfulProgress').style.width='0%'; }
function startMindful() {
  stopMindful();mindfulStart=Date.now();$('mindfulStart').disabled=true;
  const tick=()=>{
    const elapsed=Math.floor((Date.now()-mindfulStart)/1000), remain=Math.max(0,120-elapsed), inhale=elapsed%10<4;
    $('mindfulClock').textContent=clock(remain);$('mindfulProgress').style.width=(elapsed/120*100)+'%';
    $('breathCircle').classList.toggle('breath-in',inhale);$('breathCircle').classList.toggle('breath-out',!inhale);$('breathCircle').textContent=inhale?'Adem in':'Adem uit';
    if(!remain){stopMindful();extra.mindfulSessions++;saveExtra();$('mindfulProgress').style.width='100%';$('mindfulStatus').textContent='Goed gedaan. Je hebt even tijd voor jezelf genomen.';}
  };tick();mindfulTimer=setInterval(tick,500);
}
$('mindfulStart').onclick=startMindful;
$('mindfulStop').onclick=()=>{stopMindful();$('mindfulStatus').textContent='Je hebt de oefening gestopt. Dat is goed.';};
$('mindfulVoice').onclick=()=>speak('Zoek een fijne houding. Laat je schouders zacht worden. Adem rustig in. Adem langzaam uit. Je hoeft nu niets op te lossen. Neem de tijd.');
document.querySelectorAll('[data-mindful]').forEach(b=>b.addEventListener('click',()=>{
  const phrases={breathing:'Adem rustig in. Adem langzaam uit. Volg de cirkel met je aandacht.',body:'Voel je voeten op de grond. Merk op hoe de vloer je voeten draagt. Je hoeft niets te veranderen.',thoughts:'Merk op welke gedachten er zijn. Je hoeft ze niet op te lossen. Laat ze rustig voorbijgaan als wolken aan de lucht.'};
  $('mindfulDescription').textContent=phrases[b.dataset.mindful];speak(phrases[b.dataset.mindful]);
}));
$('clientReminderForm').addEventListener('submit',async ev=>{
  ev.preventDefault();const title=$('clientReminderTitle').value.trim(),time=$('clientReminderTime').value;
  if(!title||!time)return;
  extra.reminders.push({id:crypto.randomUUID(),title,time,repeat:$('clientReminderType').value,notificationIds:[]});
  saveExtra();ev.target.reset();renderReminders();await refreshReminders();
});
$('clientReminderList').addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-delete-reminder]');if(!b)return;
  const item=extra.reminders.find(x=>x.id===b.dataset.deleteReminder);
  if(item?.notificationIds?.length&&window.StapNotifications?.isNative)for(const id of item.notificationIds)await window.StapNotifications.cancel(id).catch(()=>{});
  extra.reminders=extra.reminders.filter(x=>x.id!==b.dataset.deleteReminder);saveExtra();renderReminders();
});
$('requestNotifications').onclick=async()=>{
  if(!window.StapNotifications?.isNative){$('notificationPermissionStatus').textContent='Installeer de Android-app om echte telefoonmeldingen te gebruiken.';return;}
  const ok=await window.StapNotifications.requestPermission();$('notificationPermissionStatus').textContent=ok?'Meldingen staan aan.':'Meldingen staan uit. Zet ze aan bij Android-instellingen.';if(ok)await refreshReminders();
};
$('createGroupForm').addEventListener('submit',async ev=>{ev.preventDefault();try{await createGroup($('createGroupName').value.trim());ev.target.reset();}catch(e){status(e.message||'Groep maken is niet gelukt.','error');}});
$('joinGroupForm').addEventListener('submit',async ev=>{ev.preventDefault();try{await joinGroup($('joinGroupCode').value.trim().toUpperCase());ev.target.reset();}catch(e){status(e.message||'Meedoen met de groep is niet gelukt.','error');}});
$('createPollForm').addEventListener('submit',async ev=>{
  ev.preventDefault();if(!group)return;const options=$('pollOptions').value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,6);
  if(options.length<2||new Set(options).size!==options.length){status('Vul minstens twee verschillende keuzes in.','error');return;}
  try{await addPoll($('pollQuestion').value.trim(),options);ev.target.reset();}catch(e){status(e.message,'error');}
});
$('pollList').addEventListener('click',async ev=>{const b=ev.target.closest('[data-vote-poll]');if(!b)return;try{await vote(b.dataset.votePoll,b.dataset.voteOption);}catch(e){status(e.message,'error');}});
$('createChoreForm').addEventListener('submit',async ev=>{ev.preventDefault();if(!group)return;try{await addChore($('choreTitle').value.trim(),Number($('chorePoints').value));ev.target.reset();}catch(e){status(e.message,'error');}});
$('choreList').addEventListener('click',async ev=>{const b=ev.target.closest('[data-complete-chore]');if(!b)return;try{await completeChore(b.dataset.completeChore);}catch(e){status(e.message,'error');}});
$('createShiftForm').addEventListener('submit',async ev=>{
  ev.preventDefault();if(!group)return;const start=$('shiftStart').value,end=$('shiftEnd').value;
  if(end<=start){status('De eindtijd moet later zijn dan de begintijd.','error');return;}
  try{await addShift($('shiftName').value.trim(),$('shiftDate').value,start,end);ev.target.reset();}catch(e){status(e.message,'error');}
});
$('copyGroupCode').onclick=async()=>{try{await navigator.clipboard.writeText(group.groupCode);status('De groepscode is gekopieerd.','ok');}catch{status('Kopiëren is niet beschikbaar. Schrijf de code over.','error');}};

window.ClientSuite = { savePlannerSnapshot: queueCloudSave, saveExtras: saveExtra, get uid(){return user?.uid||'';} };

async function boot() {
  const valid=firebaseConfig&&firebaseConfig.apiKey&&firebaseConfig.projectId&&!String(firebaseConfig.apiKey).includes('VUL_HIER')&&!String(firebaseConfig.projectId).includes('VUL_HIER');
  if(!valid){$('authConfigWarning').hidden=false;$('authSubmit').disabled=true;showMessage('Firebase is nog niet ingesteld. De app blijft gesloten totdat veilige accounttoegang is geconfigureerd.',true);return;}
  try{
    const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
    onAuthStateChanged(auth,async account=>{
      if(!account){user=null;group=null;sessionStorage.removeItem(SESSION_UID);$('appContent').hidden=true;$('authGate').hidden=false;setMode('login');return;}
      user=account;try{await authenticated(account);}catch(e){if(e.message!=='USERNAME_SETUP_REQUIRED')showMessage(authText(e),true);}
    });
  }catch(e){$('authConfigWarning').hidden=false;showMessage('Firebase kan niet worden gestart: '+authText(e),true);}
}
setMode('login');boot();
