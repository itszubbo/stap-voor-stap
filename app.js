'use strict';

const STORAGE_KEY = 'stap-voor-stap-v1';
const starterState = {
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
      stepTasks: Array.isArray(parsed.stepTasks) ? parsed.stepTasks : clone(starterState.stepTasks)
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
  renderDate(); renderToday(); renderStepChoices(); renderSelectedSteps(); renderSettings(); renderFeeling();
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
