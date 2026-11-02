'use strict';

const STORAGE_KEY = 'stap-voor-stap-v1';
const starterState = {
  agenda: [],
  tasks: [
    { id: 'task-1', title: 'Opstaan en aankleden', done: false },
    { id: 'task-2', title: 'Ontbijten', done: false },
    { id: 'task-3', title: 'Mijn spullen pakken', done: false }
  ],
  stepTasks: [
    { id: 'ready', title: 'Klaarmaken om weg te gaan', steps: [
      { id: 'ready-1', text: 'Mijn kleren aantrekken', done: false },
      { id: 'ready-2', text: 'Mijn tanden poetsen', done: false },
      { id: 'ready-3', text: 'Mijn tas pakken', done: false },
      { id: 'ready-4', text: 'Mijn jas en schoenen aantrekken', done: false }
    ] },
    { id: 'food', title: 'Een boterham maken', steps: [
      { id: 'food-1', text: 'Een bord pakken', done: false },
      { id: 'food-2', text: 'Brood op het bord leggen', done: false },
      { id: 'food-3', text: 'Beleg op het brood doen', done: false },
      { id: 'food-4', text: 'Alles opruimen', done: false }
    ] },
    { id: 'room', title: 'Mijn kamer opruimen', steps: [
      { id: 'room-1', text: 'Mijn vuile kleren in de wasmand doen', done: false },
      { id: 'room-2', text: 'Mijn spullen op hun plek leggen', done: false },
      { id: 'room-3', text: 'Mijn afval weggooien', done: false }
    ] }
  ],
  selectedStepTask: 'ready',
  calmMode: false,
  fontScale: 1,
  feeling: ''
};

let state = loadState();
let toastTimer;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return clone(starterState);
    const parsed = JSON.parse(saved);
    return {
      ...clone(starterState),
      ...parsed,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : clone(starterState.tasks),
      stepTasks: Array.isArray(parsed.stepTasks) ? parsed.stepTasks : clone(starterState.stepTasks),
      agenda: Array.isArray(parsed.agenda) ? parsed.agenda : [],
      weekOffset: Number.isInteger(parsed.weekOffset) ? parsed.weekOffset : 0
    };
  } catch (error) {
    console.warn('De opgeslagen gegevens konden niet worden gelezen.', error);
    return clone(starterState);
  }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (error) { showToast('Opslaan lukt niet. Controleer de instellingen van je browser.'); }
}
function makeId(prefix = 'item') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function notificationIdFor(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483647 || 1;
}
async function cancelAppointmentReminder(item) {
  if (!item?.notificationId || !window.StapNotifications?.isNative) return;
  try {
    await window.StapNotifications.cancel(item.notificationId);
  } catch (error) {
    console.warn('De herinnering kon niet worden verwijderd.', error);
  }
  delete item.notificationId;
}
async function scheduleAppointmentReminder(item) {
  if (!item.reminderMinutes || !item.time) return 'none';
  if (!window.StapNotifications?.isNative) return 'website';
  const at = new Date(`${item.date}T${item.time}:00`);
  at.setMinutes(at.getMinutes() - Number(item.reminderMinutes));
  if (Number.isNaN(at.getTime()) || at <= new Date()) return 'past';
  try {
    const notificationId = notificationIdFor(item.id);
    const result = await window.StapNotifications.schedule({
      id: notificationId,
      title: 'Je afspraak komt eraan',
      body: `Over ${item.reminderMinutes} minuten: ${item.title}`,
      at: at.toISOString()
    });
    item.reminderStatus = result.status;
    if (result.status === 'scheduled') {
      item.notificationId = notificationId;
      return 'scheduled';
    }
    return result.status || 'unavailable';
  } catch (error) {
    console.warn('De herinnering kon niet worden ingesteld.', error);
    item.reminderStatus = 'error';
    return 'error';
  }
}
function reminderStatusText(item) {
  if (item.reminderStatus === 'scheduled') return `🔔 Melding ${item.reminderMinutes} min. vooraf`;
  if (item.reminderStatus === 'denied') return 'Meldingen staan uit op je telefoon';
  if (item.reminderStatus === 'website') return 'Melding beschikbaar in de Android-app';
  if (item.reminderStatus === 'past') return 'Herinneringstijd is al voorbij';
  if (item.reminderStatus === 'cancelled') return 'Herinnering gepauzeerd';
  if (item.reminderStatus === 'error') return 'Herinnering kon niet worden ingesteld';
  return `Herinnering: ${item.reminderMinutes} min. vooraf`;
}
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function getSelectedStepTask() {
  return state.stepTasks.find(task => task.id === state.selectedStepTask) || state.stepTasks[0] || null;
}
function renderDate() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  document.getElementById('todayDate').textContent = date.toLocaleUpperCase('nl-NL');
  document.getElementById('dateChip').textContent = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(now);
  const hour = now.getHours();
  document.getElementById('todayTitle').textContent = hour < 12 ? 'Goedemorgen!' : hour < 18 ? 'Goedemiddag!' : 'Goedenavond!';
}
function renderToday() {
  const list = document.getElementById('todayTasks');
  list.innerHTML = state.tasks.map(task => `
    <li class="task-item ${task.done ? 'done' : ''}">
      <input type="checkbox" id="${escapeHtml(task.id)}" data-task-id="${escapeHtml(task.id)}" ${task.done ? 'checked' : ''}>
      <label for="${escapeHtml(task.id)}">${escapeHtml(task.title)}</label>
      <button class="delete-task" type="button" data-delete-task="${escapeHtml(task.id)}" aria-label="Verwijder taak: ${escapeHtml(task.title)}">×</button>
    </li>`).join('');
  const done = state.tasks.filter(task => task.done).length;
  const total = state.tasks.length;
  const percent = total ? Math.round(done / total * 100) : 0;
  document.getElementById('progressText').textContent = `${done} van ${total} taken klaar`;
  document.getElementById('progressPercent').textContent = `${percent}%`;
  document.getElementById('progressFill').style.width = `${percent}%`;
  document.getElementById('progressBar').setAttribute('aria-valuenow', String(percent));
  renderTodayAgenda();
}
function renderTodayAgenda() {
  const container = document.getElementById('todayAgendaPreview');
  const today = toLocalISO(new Date());
  const items = state.agenda
    .filter(item => item.date === today)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  if (!items.length) {
    container.innerHTML = '<li class="today-agenda-empty">Er staan nog geen afspraken in je agenda.</li>';
    return;
  }
  container.innerHTML = items.map(item => {
    const info = agendaTypeInfo(item.type);
    return `<li class="today-agenda-item ${item.done ? 'done' : ''}">
      <span class="today-agenda-icon" aria-hidden="true">${info.icon}</span>
      <span class="today-agenda-time">${item.time ? escapeHtml(item.time) : 'Hele dag'}</span>
      <span class="today-agenda-title">${escapeHtml(item.title)}</span>
      ${item.done ? '<span class="today-agenda-status">Klaar</span>' : ''}
    </li>`;
  }).join('');
}
function renderStepChoices() {
  const container = document.getElementById('stepTaskChoices');
  container.innerHTML = state.stepTasks.map(task => {
    const complete = task.steps.filter(step => step.done).length;
    return `<button class="choice-button" type="button" data-select-step-task="${escapeHtml(task.id)}" aria-pressed="${task.id === state.selectedStepTask}"><span>${escapeHtml(task.title)}</span><small>${complete}/${task.steps.length}</small></button>`;
  }).join('');
}
function renderSelectedSteps() {
  const task = getSelectedStepTask();
  const title = document.getElementById('selectedTaskTitle');
  const list = document.getElementById('selectedSteps');
  if (!task) {
    title.textContent = 'Nog geen taak gekozen';
    document.getElementById('selectedTaskHint').textContent = 'Maak links een nieuwe taak.';
    list.innerHTML = '';
    return;
  }
  title.textContent = task.title;
  const completed = task.steps.filter(step => step.done).length;
  document.getElementById('selectedTaskHint').textContent = `${completed} van ${task.steps.length} stappen klaar. Neem rustig de tijd.`;
  list.innerHTML = task.steps.map((step, index) => `
    <li class="step-item ${step.done ? 'done' : ''}">
      <input type="checkbox" id="${escapeHtml(step.id)}" data-step-id="${escapeHtml(step.id)}" ${step.done ? 'checked' : ''}>
      <label for="${escapeHtml(step.id)}"><span class="sr-only">Stap ${index + 1}: </span>${escapeHtml(step.text)}</label>
      <button type="button" data-delete-step="${escapeHtml(step.id)}" aria-label="Verwijder stap: ${escapeHtml(step.text)}">×</button>
    </li>`).join('');
}
function toLocalISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function getWeekStart(offset = 0) {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset + (offset * 7));
}
function formatAgendaDate(date) {
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}
function agendaTypeInfo(type) {
  const types = {
    home: { icon: '🏠', label: 'Thuis' },
    appointment: { icon: '🩺', label: 'Afspraak' },
    work: { icon: '💼', label: 'Werk of dagbesteding' },
    care: { icon: '❤️', label: 'Zorg of begeleiding' },
    fun: { icon: '🎨', label: 'Vrije tijd' },
    travel: { icon: '🚌', label: 'Reizen' }
  };
  return types[type] || types.appointment;
}
function renderAgenda() {
  const start = getWeekStart(state.weekOffset || 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: sameMonth ? undefined : 'long' }).format(start);
  const endText = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(end);
  document.getElementById('weekTitle').textContent = `${startText} t/m ${endText}`;
  const days = Array.from({ length: 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const todayISO = toLocalISO(new Date());
  document.getElementById('weekDays').innerHTML = days.map(day => {
    const dayISO = toLocalISO(day);
    const items = state.agenda
      .filter(item => item.date === dayISO)
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    const list = items.length ? items.map(item => {
      const info = agendaTypeInfo(item.type);
      return `
        <li class="agenda-item ${item.done ? 'done' : ''}">
          <span class="agenda-icon" aria-hidden="true">${info.icon}</span>
          <div class="agenda-item-copy">
            <span class="agenda-time">${item.time ? escapeHtml(item.time) : 'Hele dag'} · ${info.label}</span>
            <strong>${escapeHtml(item.title)}</strong>
            ${item.reminderMinutes ? `<span class="reminder-tag">${reminderStatusText(item)}</span>` : ''}
          </div>
          <label class="agenda-done-label">
            <input type="checkbox" data-agenda-done="${escapeHtml(item.id)}" ${item.done ? 'checked' : ''}>
            <span>Klaar</span>
          </label>
          <button class="agenda-delete" type="button" data-agenda-delete="${escapeHtml(item.id)}" aria-label="Verwijder afspraak: ${escapeHtml(item.title)}">×</button>
        </li>`;
    }).join('') : '<li class="agenda-empty">Nog niets gepland.</li>';
    return `
      <section class="agenda-day ${dayISO === todayISO ? 'is-today' : ''}" aria-label="${escapeHtml(formatAgendaDate(day))}">
        <div class="agenda-day-heading">
          <h3>${escapeHtml(formatAgendaDate(day))}</h3>
          ${dayISO === todayISO ? '<span class="today-label">Vandaag</span>' : ''}
        </div>
        <ul class="agenda-items">${list}</ul>
      </section>`;
  }).join('');
  const dateInput = document.getElementById('agendaDate');
  if (!dateInput.value) dateInput.value = todayISO;
}
function renderSettings() {
  document.body.classList.toggle('calm-mode', Boolean(state.calmMode));
  document.documentElement.style.setProperty('--base-font', `${17 * state.fontScale}px`);
  const topToggle = document.getElementById('calmToggle');
  const settingsToggle = document.getElementById('settingsCalmToggle');
  topToggle.setAttribute('aria-pressed', String(Boolean(state.calmMode)));
  settingsToggle.setAttribute('aria-checked', String(Boolean(state.calmMode)));
  settingsToggle.querySelector('.switch-label').textContent = state.calmMode ? 'Aan' : 'Uit';
}
function renderFeeling() {
  document.querySelectorAll('.feeling-option').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.feeling === state.feeling));
  });
  document.getElementById('feelingStatus').textContent = state.feeling
    ? `Je koos: ${state.feeling}. Je keuze wordt alleen op dit apparaat bewaard.`
    : 'Je keuze wordt alleen op dit apparaat bewaard.';
}
function renderAll() {
  renderDate(); renderToday(); renderStepChoices(); renderSelectedSteps(); renderAgenda(); renderSettings(); renderFeeling();
}
function showView(name) {
  document.querySelectorAll('.view').forEach(view => {
    const active = view.id === `view-${name}`;
    view.hidden = !active;
    view.classList.toggle('active', active);
  });
  document.querySelectorAll('.nav-button').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  const heading = document.querySelector(`#view-${name} h1`);
  if (heading) heading.focus?.({ preventScroll: true });
  document.getElementById('main').scrollIntoView({ behavior: 'auto', block: 'start' });
}

// Navigatie
for (const button of document.querySelectorAll('.nav-button')) button.addEventListener('click', () => showView(button.dataset.view));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => showView(button.dataset.go)));

// Weekplanner en persoonlijke agenda
document.getElementById('goToAgenda').addEventListener('click', () => showView('agenda'));
document.getElementById('previousWeek').addEventListener('click', () => {
  state.weekOffset = (state.weekOffset || 0) - 1;
  renderAgenda();
});
document.getElementById('nextWeek').addEventListener('click', () => {
  state.weekOffset = (state.weekOffset || 0) + 1;
  renderAgenda();
});
document.getElementById('currentWeek').addEventListener('click', () => {
  state.weekOffset = 0;
  renderAgenda();
});
document.getElementById('agendaForm').addEventListener('submit', async event => {
  event.preventDefault();
  const date = document.getElementById('agendaDate').value;
  const time = document.getElementById('agendaTime').value;
  const title = document.getElementById('agendaTitleInput').value.trim();
  const type = document.getElementById('agendaType').value;
  const reminderMinutes = Number(document.getElementById('agendaReminder').value || 0);
  if (!date || !title) {
    showToast('Vul een dag en een activiteit in.');
    return;
  }
  if (reminderMinutes && !time) {
    showToast('Vul ook een tijd in voor je herinnering.');
    document.getElementById('agendaTime').focus();
    return;
  }
  const item = { id: makeId('agenda'), date, time, title, type, reminderMinutes, done: false };
  state.agenda.push(item);
  const selectedDate = new Date(date + 'T12:00:00');
  const thisMonday = getWeekStart(0);
  const selectedMonday = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7));
  state.weekOffset = Math.round((selectedMonday - thisMonday) / (7 * 24 * 60 * 60 * 1000));
  document.getElementById('agendaTitleInput').value = '';
  document.getElementById('agendaTime').value = '';
  saveState();
  renderAgenda();
  renderToday();
  if (!reminderMinutes) {
    showToast('De afspraak staat in je agenda.');
    return;
  }
  const reminderStatus = await scheduleAppointmentReminder(item);
  saveState();
  renderAgenda();
  if (reminderStatus === 'scheduled') showToast(`Afspraak opgeslagen. Je krijgt ${reminderMinutes} min. vooraf een melding.`);
  else if (reminderStatus === 'website') showToast('Afspraak opgeslagen. Meldingen werken in de Android-app.');
  else if (reminderStatus === 'past') showToast('Afspraak opgeslagen. De gekozen herinneringstijd is al voorbij.');
  else if (reminderStatus === 'denied') showToast('Afspraak opgeslagen. Meldingen staan uit op je telefoon.');
  else showToast('Afspraak opgeslagen. De herinnering kon niet worden ingesteld.');
});
document.getElementById('weekDays').addEventListener('change', async event => {
  const id = event.target.dataset.agendaDone;
  if (!id) return;
  const item = state.agenda.find(entry => entry.id === id);
  if (item) {
    item.done = event.target.checked;
    if (item.done) {
      await cancelAppointmentReminder(item);
      item.reminderStatus = 'cancelled';
    } else if (item.reminderMinutes) {
      await scheduleAppointmentReminder(item);
    }
    saveState();
    renderAgenda();
    renderToday();
  }
});
document.getElementById('weekDays').addEventListener('click', async event => {
  const id = event.target.dataset.agendaDelete;
  if (!id) return;
  const item = state.agenda.find(entry => entry.id === id);
  if (item) await cancelAppointmentReminder(item);
  state.agenda = state.agenda.filter(entry => entry.id !== id);
  saveState();
  renderAgenda();
  renderToday();
  showToast('De afspraak is verwijderd.');
});

// Taken voor vandaag
document.getElementById('quickAddForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.getElementById('quickTask');
  const title = input.value.trim();
  if (!title) { input.focus(); showToast('Schrijf eerst een taak op.'); return; }
  state.tasks.push({ id: makeId('task'), title, done: false });
  input.value = '';
  saveState(); renderToday(); input.focus();
});
document.getElementById('todayTasks').addEventListener('change', event => {
  const id = event.target.dataset.taskId;
  if (!id) return;
  const task = state.tasks.find(item => item.id === id);
  if (task) { task.done = event.target.checked; saveState(); renderToday(); }
});
document.getElementById('todayTasks').addEventListener('click', event => {
  const id = event.target.dataset.deleteTask;
  if (!id) return;
  state.tasks = state.tasks.filter(task => task.id !== id);
  saveState(); renderToday(); showToast('Taak verwijderd.');
});

// Taken opdelen in stappen
document.getElementById('stepTaskChoices').addEventListener('click', event => {
  const button = event.target.closest('[data-select-step-task]');
  if (!button) return;
  state.selectedStepTask = button.dataset.selectStepTask;
  saveState(); renderStepChoices(); renderSelectedSteps();
});
document.getElementById('newStepTaskForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.getElementById('newStepTask');
  const title = input.value.trim();
  if (!title) { input.focus(); showToast('Geef je taak een naam.'); return; }
  const task = { id: makeId('steps'), title, steps: [] };
  state.stepTasks.push(task); state.selectedStepTask = task.id;
  input.value = ''; saveState(); renderStepChoices(); renderSelectedSteps();
  document.getElementById('newStep').focus();
});
document.getElementById('selectedSteps').addEventListener('change', event => {
  const id = event.target.dataset.stepId;
  const task = getSelectedStepTask();
  if (!id || !task) return;
  const step = task.steps.find(item => item.id === id);
  if (step) { step.done = event.target.checked; saveState(); renderStepChoices(); renderSelectedSteps(); }
});
document.getElementById('selectedSteps').addEventListener('click', event => {
  const id = event.target.dataset.deleteStep;
  const task = getSelectedStepTask();
  if (!id || !task) return;
  task.steps = task.steps.filter(step => step.id !== id);
  saveState(); renderStepChoices(); renderSelectedSteps(); showToast('Stap verwijderd.');
});
document.getElementById('addStepForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.getElementById('newStep');
  const text = input.value.trim();
  const task = getSelectedStepTask();
  if (!task) { showToast('Kies eerst een taak.'); return; }
  if (!text) { input.focus(); showToast('Schrijf eerst een stap op.'); return; }
  task.steps.push({ id: makeId('step'), text, done: false });
  input.value = ''; saveState(); renderStepChoices(); renderSelectedSteps(); input.focus();
});

// Rust, hulp en gevoel
document.getElementById('copyPhrase').addEventListener('click', async () => {
  const phrase = document.getElementById('helpPhrase').textContent.replace(/[“”]/g, '');
  try {
    await navigator.clipboard.writeText(phrase);
    document.getElementById('copyStatus').textContent = 'De zin is gekopieerd.';
  } catch {
    document.getElementById('copyStatus').textContent = 'Kopiëren lukt niet in deze browser. Je kunt de zin ook zelf overschrijven.';
  }
});
document.querySelectorAll('.feeling-option').forEach(button => button.addEventListener('click', () => {
  state.feeling = button.dataset.feeling;
  saveState(); renderFeeling();
}));

// Instellingen
function toggleCalmMode() { state.calmMode = !state.calmMode; saveState(); renderSettings(); }
document.getElementById('calmToggle').addEventListener('click', toggleCalmMode);
document.getElementById('settingsCalmToggle').addEventListener('click', toggleCalmMode);
document.getElementById('fontUp').addEventListener('click', () => {
  state.fontScale = Math.min(1.35, Math.round((state.fontScale + .1) * 100) / 100); saveState(); renderSettings();
});
document.getElementById('fontDown').addEventListener('click', () => {
  state.fontScale = Math.max(.9, Math.round((state.fontScale - .1) * 100) / 100); saveState(); renderSettings();
});
document.getElementById('resetData').addEventListener('click', () => {
  const confirmed = window.confirm('Wil je alle taken en instellingen wissen? Dit kan niet ongedaan worden gemaakt.');
  if (!confirmed) return;
  state = clone(starterState); saveState(); renderAll(); showView('vandaag'); showToast('Je gegevens zijn gewist.');
});

renderAll();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('Offline opslaan is niet beschikbaar.', error)));
}
