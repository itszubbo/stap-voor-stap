'use strict';

const STORAGE_KEY = 'stap-voor-stap-v1';
const starterState = {
  agenda: [],
  dayBlocks: [],
  recurringActivities: [],
  recurringCompletions: [],
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
let selectedPlanDate = toLocalISO(new Date());

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
      dayBlocks: Array.isArray(parsed.dayBlocks) ? parsed.dayBlocks : [],
      recurringActivities: Array.isArray(parsed.recurringActivities) ? parsed.recurringActivities : [],
      recurringCompletions: Array.isArray(parsed.recurringCompletions) ? parsed.recurringCompletions : [],
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
  renderDayPlan();
}
function renderTodayAgenda() {
  const container = document.getElementById('todayAgendaPreview');
  const today = toLocalISO(new Date());
  const items = getAgendaEntriesForDate(today);
  if (!items.length) {
    container.innerHTML = '<li class="today-agenda-empty">Er staan nog geen afspraken in je agenda.</li>';
    return;
  }
  container.innerHTML = items.map(item => {
    const info = agendaTypeInfo(item.type);
    return `<li class="today-agenda-item ${item.done ? 'done' : ''}">
      <span class="today-agenda-icon" aria-hidden="true">${info.icon}</span>
      <span class="today-agenda-time">${item.startTime ? escapeHtml(item.startTime) : 'Hele dag'}</span>
      <span class="today-agenda-title">${escapeHtml(item.title)}</span>
      ${item.source === 'recurring' ? '<span class="today-agenda-status">Vast</span>' : ''}
      ${item.done ? '<span class="today-agenda-status">Klaar</span>' : ''}
    </li>`;
  }).join('');
}
function recurringOccurrenceKey(activityId, dateISO) {
  return `${activityId}|${dateISO}`;
}
function getRecurringEntries(dateISO) {
  const date = new Date(dateISO + 'T12:00:00');
  const weekday = date.getDay() || 7;
  return state.recurringActivities
    .filter(activity => activity.active !== false
      && Array.isArray(activity.weekdays)
      && activity.weekdays.includes(weekday)
      && (!activity.startsOn || dateISO >= activity.startsOn))
    .map(activity => ({
      ...activity,
      source: 'recurring',
      date: dateISO,
      startTime: activity.time || '',
      endTime: activity.endTime || '',
      done: state.recurringCompletions.includes(recurringOccurrenceKey(activity.id, dateISO))
    }));
}
function getAgendaEntriesForDate(dateISO) {
  const appointments = state.agenda
    .filter(item => item.date === dateISO)
    .map(item => ({ ...item, source: 'agenda', startTime: item.time || '', endTime: '' }));
  return [...appointments, ...getRecurringEntries(dateISO)].sort((a, b) => {
    const timeA = a.startTime || '00:00';
    const timeB = b.startTime || '00:00';
    return timeA.localeCompare(timeB) || a.title.localeCompare(b.title, 'nl');
  });
}
function getDayPlanEntries(dateISO) {
  const agendaEntries = getAgendaEntriesForDate(dateISO);
  const blocks = state.dayBlocks
    .filter(item => item.date === dateISO)
    .map(item => ({ ...item, source: 'block' }));
  return [...agendaEntries, ...blocks].sort((a, b) => {
    const timeA = a.startTime || '00:00';
    const timeB = b.startTime || '00:00';
    return timeA.localeCompare(timeB) || a.title.localeCompare(b.title, 'nl');
  });
}
function setRecurringOccurrenceDone(activityId, dateISO, done) {
  const key = recurringOccurrenceKey(activityId, dateISO);
  const alreadyDone = state.recurringCompletions.includes(key);
  if (done && !alreadyDone) state.recurringCompletions.push(key);
  if (!done && alreadyDone) {
    state.recurringCompletions = state.recurringCompletions.filter(item => item !== key);
  }
}
function recurringWeekdayNames(weekdays) {
  const names = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
  return (Array.isArray(weekdays) ? weekdays : [])
    .slice()
    .sort((a, b) => a - b)
    .map(day => names[day - 1])
    .join(', ');
}
function renderRecurringActivities() {
  const container = document.getElementById('recurringActivityList');
  if (!container) return;
  if (!state.recurringActivities.length) {
    container.innerHTML = '<p class="recurring-empty">Je hebt nog geen vaste activiteiten ingesteld.</p>';
    return;
  }
  container.innerHTML = state.recurringActivities.map(activity => {
    const info = agendaTypeInfo(activity.type);
    const time = activity.time
      ? `${escapeHtml(activity.time)}${activity.endTime ? ' – ' + escapeHtml(activity.endTime) : ''}`
      : 'Geen vaste tijd';
    return `<li class="recurring-item">
      <span class="recurring-icon" aria-hidden="true">${info.icon}</span>
      <div class="recurring-copy">
        <strong>${escapeHtml(activity.title)}</strong>
        <span>${escapeHtml(recurringWeekdayNames(activity.weekdays))}</span>
        <small>${time} · ${info.label}</small>
      </div>
      <button class="agenda-delete" type="button" data-recurring-delete="${escapeHtml(activity.id)}" aria-label="Verwijder vaste activiteit: ${escapeHtml(activity.title)}">×</button>
    </li>`;
  }).join('');
}
function dayPartFor(time) {
  if (!time) return 'all-day';
  const hour = Number(time.slice(0, 2));
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
function renderDayPlan() {
  const container = document.getElementById('dayPlanGroups');
  if (!container) return;
  const day = new Date(selectedPlanDate + 'T12:00:00');
  const isToday = selectedPlanDate === toLocalISO(new Date());
  document.getElementById('planDateTitle').textContent = isToday
    ? 'Vandaag'
    : formatAgendaDate(day);
  document.getElementById('planTodayButton').hidden = isToday;

  const entries = getDayPlanEntries(selectedPlanDate);
  const groups = [
    { id: 'all-day', title: 'Geen tijd ingevuld', icon: '📌' },
    { id: 'morning', title: 'Ochtend', icon: '🌅' },
    { id: 'afternoon', title: 'Middag', icon: '☀️' },
    { id: 'evening', title: 'Avond', icon: '🌙' }
  ];
  container.innerHTML = groups.map(group => {
    const items = entries.filter(item => dayPartFor(item.startTime) === group.id);
    if (!items.length) return '';
    const cards = items.map(item => {
      const info = agendaTypeInfo(item.type);
      const timeLabel = item.startTime
        ? `${escapeHtml(item.startTime)}${item.endTime ? ' – ' + escapeHtml(item.endTime) : ''}`
        : 'Hele dag';
      const isBlock = item.source === 'block';
      const isRecurring = item.source === 'recurring';
      const doneAttribute = isBlock
        ? `data-plan-block-done="${escapeHtml(item.id)}"`
        : isRecurring
          ? `data-plan-recurring-done="${escapeHtml(item.id)}" data-plan-recurring-date="${selectedPlanDate}"`
          : `data-plan-agenda-done="${escapeHtml(item.id)}"`;
      return `<li class="day-plan-card ${item.done ? 'done' : ''} ${isBlock ? 'user-block' : 'agenda-block'}">
        <span class="day-plan-icon" aria-hidden="true">${info.icon}</span>
        <div class="day-plan-copy">
          <span class="day-plan-time">${timeLabel}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <span class="day-plan-kind">${info.label}${isBlock ? ' · Mijn tijdblok' : isRecurring ? ' · Herhaalt elke week' : ' · Agenda'}</span>
          ${item.reminderMinutes && !isBlock && !isRecurring ? `<span class="reminder-tag">${reminderStatusText(item)}</span>` : ''}
        </div>
        <label class="day-plan-done">
          <input type="checkbox" ${doneAttribute} ${item.done ? 'checked' : ''}>
          <span>Klaar</span>
        </label>
        ${isBlock ? `<button class="agenda-delete" type="button" data-plan-block-delete="${escapeHtml(item.id)}" aria-label="Verwijder tijdblok: ${escapeHtml(item.title)}">×</button>` : ''}
      </li>`;
    }).join('');
    return `<section class="day-plan-part" aria-labelledby="day-part-${group.id}">
      <h3 id="day-part-${group.id}"><span aria-hidden="true">${group.icon}</span> ${group.title}</h3>
      <ul class="day-plan-list">${cards}</ul>
    </section>`;
  }).join('');

  if (!entries.length) {
    container.innerHTML = '<p class="day-plan-empty">Er staat nog niets in dit dagrooster. Voeg hieronder een tijdblok toe of plan een afspraak bij Week & agenda.</p>';
  }
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
    const items = getAgendaEntriesForDate(dayISO);
    const list = items.length ? items.map(item => {
      const info = agendaTypeInfo(item.type);
      const isRecurring = item.source === 'recurring';
      const doneInput = isRecurring
        ? `data-recurring-done="${escapeHtml(item.id)}" data-recurring-date="${dayISO}"`
        : `data-agenda-done="${escapeHtml(item.id)}"`;
      return `
        <li class="agenda-item ${item.done ? 'done' : ''}">
          <span class="agenda-icon" aria-hidden="true">${info.icon}</span>
          <div class="agenda-item-copy">
            <span class="agenda-time">${item.startTime ? escapeHtml(item.startTime) : 'Hele dag'} · ${info.label}</span>
            <strong>${escapeHtml(item.title)}</strong>
            ${isRecurring ? '<span class="recurring-tag">↻ Herhaalt elke week</span>' : ''}
            ${item.reminderMinutes && !isRecurring ? `<span class="reminder-tag">${reminderStatusText(item)}</span>` : ''}
          </div>
          <label class="agenda-done-label">
            <input type="checkbox" ${doneInput} ${item.done ? 'checked' : ''}>
            <span>Klaar</span>
          </label>
          ${isRecurring ? '' : `<button class="agenda-delete" type="button" data-agenda-delete="${escapeHtml(item.id)}" aria-label="Verwijder afspraak: ${escapeHtml(item.title)}">×</button>`}
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
  renderRecurringActivities();
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
  stopSpeech();
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
  const recurringId = event.target.dataset.recurringDone;
  const recurringDate = event.target.dataset.recurringDate;
  if (recurringId && recurringDate) {
    setRecurringOccurrenceDone(recurringId, recurringDate, event.target.checked);
    saveState();
    renderAgenda();
    renderToday();
    return;
  }

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

// Vaste activiteiten die iedere week terugkomen
document.getElementById('recurringForm').addEventListener('submit', event => {
  event.preventDefault();
  const title = document.getElementById('recurringActivityName').value.trim();
  const time = document.getElementById('recurringTime').value;
  const endTime = document.getElementById('recurringEndTime').value;
  const type = document.getElementById('recurringType').value;
  const weekdays = [...document.querySelectorAll('input[name="recurringDay"]:checked')]
    .map(input => Number(input.value))
    .filter(day => Number.isInteger(day) && day >= 1 && day <= 7)
    .sort((a, b) => a - b);

  if (!title) {
    showToast('Schrijf op wat je elke week wilt doen.');
    document.getElementById('recurringActivityName').focus();
    return;
  }
  if (!weekdays.length) {
    showToast('Kies minstens één dag.');
    return;
  }
  if (endTime && (!time || endTime <= time)) {
    showToast('De eindtijd moet na de begintijd zijn.');
    document.getElementById('recurringEndTime').focus();
    return;
  }

  state.recurringActivities.push({
    id: makeId('repeat'),
    title,
    time,
    endTime,
    type,
    weekdays,
    startsOn: toLocalISO(new Date()),
    active: true
  });
  saveState();
  renderAgenda();
  renderToday();
  document.getElementById('recurringActivityName').value = '';
  document.getElementById('recurringTime').value = '';
  document.getElementById('recurringEndTime').value = '';
  document.querySelectorAll('input[name="recurringDay"]').forEach(input => { input.checked = false; });
  showToast('Je vaste activiteit is opgeslagen.');
});
document.getElementById('recurringActivityList').addEventListener('click', event => {
  const id = event.target.closest('[data-recurring-delete]')?.dataset.recurringDelete;
  if (!id) return;
  const prefix = `${id}|`;
  state.recurringActivities = state.recurringActivities.filter(item => item.id !== id);
  state.recurringCompletions = state.recurringCompletions.filter(key => !key.startsWith(prefix));
  saveState();
  renderAgenda();
  renderToday();
  showToast('De vaste activiteit is verwijderd.');
});

// Visueel dagrooster
document.getElementById('previousPlanDay').addEventListener('click', () => {
  const day = new Date(selectedPlanDate + 'T12:00:00');
  day.setDate(day.getDate() - 1);
  selectedPlanDate = toLocalISO(day);
  renderDayPlan();
});
document.getElementById('nextPlanDay').addEventListener('click', () => {
  const day = new Date(selectedPlanDate + 'T12:00:00');
  day.setDate(day.getDate() + 1);
  selectedPlanDate = toLocalISO(day);
  renderDayPlan();
});
document.getElementById('planTodayButton').addEventListener('click', () => {
  selectedPlanDate = toLocalISO(new Date());
  renderDayPlan();
});
document.getElementById('dayBlockForm').addEventListener('submit', event => {
  event.preventDefault();
  const startTime = document.getElementById('dayBlockStart').value;
  const endTime = document.getElementById('dayBlockEnd').value;
  const title = document.getElementById('dayBlockTitle').value.trim();
  const type = document.getElementById('dayBlockType').value;
  if (!startTime || !title) {
    showToast('Vul een begintijd en activiteit in.');
    return;
  }
  if (endTime && endTime <= startTime) {
    showToast('De eindtijd moet na de begintijd zijn.');
    document.getElementById('dayBlockEnd').focus();
    return;
  }
  state.dayBlocks.push({
    id: makeId('block'),
    date: selectedPlanDate,
    startTime,
    endTime,
    title,
    type,
    done: false
  });
  saveState();
  renderDayPlan();
  document.getElementById('dayBlockTitle').value = '';
  document.getElementById('dayBlockStart').value = '';
  document.getElementById('dayBlockEnd').value = '';
  showToast('Je tijdblok staat in het dagrooster.');
});
document.getElementById('dayPlanGroups').addEventListener('change', async event => {
  const agendaId = event.target.dataset.planAgendaDone;
  const blockId = event.target.dataset.planBlockDone;
  const recurringId = event.target.dataset.planRecurringDone;
  const recurringDate = event.target.dataset.planRecurringDate;
  if (recurringId && recurringDate) {
    setRecurringOccurrenceDone(recurringId, recurringDate, event.target.checked);
  } else if (agendaId) {
    const item = state.agenda.find(entry => entry.id === agendaId);
    if (!item) return;
    item.done = event.target.checked;
    if (item.done) {
      await cancelAppointmentReminder(item);
      item.reminderStatus = 'cancelled';
    } else if (item.reminderMinutes) {
      await scheduleAppointmentReminder(item);
    }
  } else if (blockId) {
    const item = state.dayBlocks.find(entry => entry.id === blockId);
    if (!item) return;
    item.done = event.target.checked;
  } else {
    return;
  }
  saveState();
  renderAgenda();
  renderToday();
});
document.getElementById('dayPlanGroups').addEventListener('click', event => {
  const id = event.target.dataset.planBlockDelete;
  if (!id) return;
  state.dayBlocks = state.dayBlocks.filter(item => item.id !== id);
  saveState();
  renderDayPlan();
  showToast('Tijdblok verwijderd.');
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

// Voorlezen met de Nederlandse stem van het apparaat of de browser
let activeSpeechButton = null;
let speechRun = 0;

function makeSpeechText(section) {
  if (section === 'today') {
    const taskCount = state.tasks.length;
    const doneCount = state.tasks.filter(task => task.done).length;
    const lines = [
      document.getElementById('todayTitle').textContent,
      document.getElementById('todayDate').textContent,
      `Je hebt ${doneCount} van de ${taskCount} taken gedaan.`
    ];
    if (!taskCount) lines.push('Je hebt geen taken voor vandaag.');
    state.tasks.forEach((task, index) => {
      lines.push(`Taak ${index + 1}: ${task.title}. ${task.done ? 'Klaar.' : 'Nog te doen.'}`);
    });
    const today = toLocalISO(new Date());
    const appointments = getAgendaEntriesForDate(today);
    if (!appointments.length) {
      lines.push('Er staan vandaag geen afspraken in je agenda.');
    } else {
      lines.push('Je afspraken voor vandaag.');
      appointments.forEach(item => {
        lines.push(`${item.startTime ? 'Om ' + item.startTime : 'De hele dag'}: ${item.title}. ${item.source === 'recurring' ? 'Dit is een vaste activiteit.' : ''} ${item.done ? 'Klaar.' : 'Nog te doen.'}`);
      });
    }
    const todayBlocks = state.dayBlocks.filter(item => item.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (todayBlocks.length) {
      lines.push('Je eigen tijdblokken voor vandaag.');
      todayBlocks.forEach(item => lines.push(`Om ${item.startTime}${item.endTime ? ' tot ' + item.endTime : ''}: ${item.title}. ${item.done ? 'Klaar.' : 'Nog te doen.'}`));
    }
    return lines.join(' ');
  }

  if (section === 'dayplan') {
    const day = new Date(selectedPlanDate + 'T12:00:00');
    const entries = getDayPlanEntries(selectedPlanDate);
    const lines = [`Het dagrooster voor ${formatAgendaDate(day)}.`];
    if (!entries.length) lines.push('Er staat nog niets gepland.');
    entries.forEach(item => {
      const info = agendaTypeInfo(item.type);
      const time = item.startTime
        ? `Om ${item.startTime}${item.endTime ? ' tot ' + item.endTime : ''}`
        : 'De hele dag';
      lines.push(`${time}: ${item.title}. ${info.label}. ${item.done ? 'Klaar.' : 'Nog te doen.'}`);
    });
    return lines.join(' ');
  }

  if (section === 'steps') {
    const task = getSelectedStepTask();
    if (!task) return 'Je hebt nog geen taak gekozen.';
    const lines = [`De taak is: ${task.title}.`];
    if (!task.steps.length) lines.push('Er zijn nog geen stappen toegevoegd.');
    task.steps.forEach((step, index) => {
      lines.push(`Stap ${index + 1}: ${step.text}. ${step.done ? 'Klaar.' : 'Nog te doen.'}`);
    });
    return lines.join(' ');
  }

  if (section === 'agenda') {
    const start = getWeekStart(state.weekOffset || 0);
    const lines = ['Dit is jouw weekagenda.'];
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const dayISO = toLocalISO(day);
      const items = getAgendaEntriesForDate(dayISO);
      lines.push(`${formatAgendaDate(day)}.`);
      if (!items.length) {
        lines.push('Nog niets gepland.');
      } else {
        items.forEach(item => {
          const info = agendaTypeInfo(item.type);
          lines.push(`${item.startTime ? 'Om ' + item.startTime : 'De hele dag'}: ${item.title}. ${info.label}. ${item.source === 'recurring' ? 'Deze activiteit herhaalt elke week.' : ''} ${item.done ? 'Klaar.' : 'Nog te doen.'}`);
        });
      }
    }
    return lines.join(' ');
  }

  return '';
}

function resetSpeechButton(button) {
  if (!button) return;
  button.textContent = button.dataset.speechLabel || '🔊 Lees voor';
  button.setAttribute('aria-pressed', 'false');
}

function stopSpeech() {
  speechRun += 1;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  resetSpeechButton(activeSpeechButton);
  activeSpeechButton = null;
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-speak]');
  if (!button) return;

  if (activeSpeechButton === button) {
    stopSpeech();
    return;
  }

  stopSpeech();
  if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
    showToast('Voorlezen is niet beschikbaar op dit apparaat.');
    return;
  }

  const text = makeSpeechText(button.dataset.speak);
  if (!text) {
    showToast('Er is niets om voor te lezen.');
    return;
  }

  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = 'nl-NL';
  utterance.rate = 0.88;
  const dutchVoice = window.speechSynthesis.getVoices().find(voice => /^nl([_-]|$)/i.test(voice.lang));
  if (dutchVoice) utterance.voice = dutchVoice;

  const thisRun = ++speechRun;
  activeSpeechButton = button;
  button.dataset.speechLabel = button.textContent;
  button.textContent = '■ Stop voorlezen';
  button.setAttribute('aria-pressed', 'true');

  utterance.onend = () => {
    if (thisRun !== speechRun) return;
    resetSpeechButton(activeSpeechButton);
    activeSpeechButton = null;
  };
  utterance.onerror = event => {
    if (thisRun !== speechRun) return;
    resetSpeechButton(activeSpeechButton);
    activeSpeechButton = null;
    if (event.error !== 'canceled' && event.error !== 'interrupted') {
      showToast('Het voorlezen is niet gelukt. Controleer de steminstellingen van je apparaat.');
    }
  };

  window.speechSynthesis.speak(utterance);
});

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
