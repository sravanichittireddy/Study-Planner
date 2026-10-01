/* ============================================================
   StudyFlow — app.js
   ============================================================ */

// ─── STATE ───────────────────────────────────────────────────
const COLORS = ['#6c63ff','#38bdf8','#4ade80','#fb923c','#f472b6','#2dd4bf','#facc15','#f87171'];

let state = {
  subjects: [],     // { id, name, color, priority, examDate }
  topics: [],       // { id, subjectId, name, difficulty, estMins, notes, done, studiedMins }
  plan: [],         // { id, topicId, date }
  sessions: [],     // { id, topicId, date, mins, mode }
  streak: 0,
  lastStudyDate: null,
};

function load() {
  try {
    const s = localStorage.getItem('studyflow_v2');
    if (s) state = { ...state, ...JSON.parse(s) };
  } catch {}
}
function save() {
  try { localStorage.setItem('studyflow_v2', JSON.stringify(state)); } catch {}
}
function uid() { return Math.random().toString(36).slice(2, 10); }

// ─── ROUTING ─────────────────────────────────────────────────
let currentView = 'dashboard';

function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + view)?.classList.add('active');
  document.querySelector(`.nav-btn[data-view="${view}"]`)?.classList.add('active');
  document.getElementById('pageTitle').textContent = {
    dashboard: 'Dashboard', subjects: 'Subjects',
    planner: 'Planner', timer: 'Focus Timer', progress: 'Progress'
  }[view] || view;
  currentView = view;
  renderView(view);
}

function renderView(view) {
  if (view === 'dashboard') renderDashboard();
  if (view === 'subjects') renderSubjects();
  if (view === 'planner') renderPlanner();
  if (view === 'timer') renderTimerSubjects();
  if (view === 'progress') renderProgress();
}

// ─── DASHBOARD ───────────────────────────────────────────────
function renderDashboard() {
  const today = todayStr();
  const todayPlans = state.plan.filter(p => p.date === today);

  // greeting
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('heroGreeting').textContent = `${greet}, Scholar.`;
  document.getElementById('todayCount').textContent = todayPlans.length;

  // ring
  const done = todayPlans.filter(p => {
    const t = state.topics.find(x => x.id === p.topicId);
    return t?.done;
  }).length;
  const pct = todayPlans.length ? Math.round((done / todayPlans.length) * 100) : 0;
  const circ = 327;
  document.getElementById('ringFill').style.strokeDashoffset = circ - (circ * pct / 100);
  document.getElementById('ringPercent').textContent = pct + '%';

  // today list
  const list = document.getElementById('todayList');
  if (todayPlans.length === 0) {
    list.innerHTML = `<div class="empty-state"><span>◫</span><p>No topics scheduled today. Go to <strong>Planner</strong> to add some!</p></div>`;
  } else {
    list.innerHTML = todayPlans.map(p => {
      const t = state.topics.find(x => x.id === p.topicId);
      const s = state.subjects.find(x => x.id === t?.subjectId);
      if (!t) return '';
      return `<div class="today-item ${t.done ? 'done' : ''}" data-plan="${p.id}">
        <button class="today-check ${t.done ? 'checked' : ''}" onclick="toggleTopicDone('${t.id}')">${t.done ? '✓' : ''}</button>
        <div class="today-info">
          <div class="today-topic">${t.name}</div>
          <div class="today-subject">${s?.name || ''}</div>
        </div>
        <div class="today-time">${t.estMins} min</div>
      </div>`;
    }).join('');
  }

  // subjects grid
  const grid = document.getElementById('dashSubjectsGrid');
  if (state.subjects.length === 0) {
    grid.innerHTML = `<div class="empty-state"><span>◧</span><p>No subjects yet.</p></div>`;
    return;
  }
  grid.innerHTML = state.subjects.map(s => {
    const topics = state.topics.filter(t => t.subjectId === s.id);
    const doneCnt = topics.filter(t => t.done).length;
    const pct = topics.length ? Math.round(doneCnt / topics.length * 100) : 0;
    return `<div class="dash-subject-card" style="--c:${s.color}">
      <div class="dash-subj-name">${s.name}</div>
      <div class="dash-subj-meta">${doneCnt}/${topics.length} topics · ${pct}%</div>
      <div class="dash-subj-bar"><div class="dash-subj-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

// ─── SUBJECTS ────────────────────────────────────────────────
function renderSubjects() {
  const list = document.getElementById('subjectsList');
  if (state.subjects.length === 0) {
    list.innerHTML = `<div class="empty-state large"><span>◧</span><h3>No subjects yet</h3><p>Click <strong>+ New Subject</strong> to get started.</p></div>`;
    return;
  }
  list.innerHTML = state.subjects.map(s => subjectCard(s)).join('');
  // reattach open state
  document.querySelectorAll('.subject-card').forEach(card => {
    const id = card.dataset.id;
    card.querySelector('.subject-card-header').addEventListener('click', (e) => {
      if (e.target.closest('button:not(.collapse-arrow)') && !e.target.classList.contains('collapse-arrow')) return;
      card.classList.toggle('open');
      card.querySelector('.topic-list').classList.toggle('hidden');
    });
  });
}

function subjectCard(s) {
  const topics = state.topics.filter(t => t.subjectId === s.id);
  const doneCnt = topics.filter(t => t.done).length;
  return `<div class="subject-card" data-id="${s.id}">
    <div class="subject-card-header">
      <div class="subj-left">
        <div class="subj-dot" style="background:${s.color}"></div>
        <div>
          <div class="subj-title">${s.name}</div>
          <div class="subj-meta">${doneCnt}/${topics.length} topics · <span class="priority-badge ${s.priority}">${s.priority}</span></div>
        </div>
      </div>
      <div class="subj-right">
        ${s.examDate ? `<span class="chip time">📅 ${fmtDate(s.examDate)}</span>` : ''}
        <div class="subj-actions">
          <button class="icon-btn" title="Edit subject" onclick="editSubject('${s.id}')">✏️</button>
          <button class="icon-btn danger" title="Delete subject" onclick="deleteSubject('${s.id}')">🗑</button>
        </div>
        <span class="collapse-arrow">▼</span>
      </div>
    </div>
    <div class="topic-list hidden">
      ${topics.length === 0 ? '<p class="muted" style="padding:.5rem 0">No topics yet.</p>' : topics.map(t => topicRow(t)).join('')}
    </div>
    <div class="add-topic-row">
      <button class="add-topic-btn" onclick="openAddTopic('${s.id}')">+ Add Topic</button>
    </div>
  </div>`;
}

function topicRow(t) {
  return `<div class="topic-item" data-topic="${t.id}">
    <button class="topic-check ${t.done ? 'checked' : ''}" onclick="toggleTopicDone('${t.id}')">${t.done ? '✓' : ''}</button>
    <div class="topic-info">
      <div class="topic-name ${t.done ? 'done-text' : ''}">${t.name}</div>
      <div class="topic-chips">
        <span class="chip ${t.difficulty.toLowerCase()}">${t.difficulty}</span>
        <span class="chip time">⏱ ${t.estMins} min</span>
        ${t.done ? '<span class="chip done">✓ Done</span>' : ''}
        ${t.studiedMins > 0 ? `<span class="chip studied">📚 ${t.studiedMins} min studied</span>` : ''}
      </div>
      ${t.notes ? `<div class="muted" style="font-size:.76rem;margin-top:.3rem">${t.notes}</div>` : ''}
    </div>
    <div class="topic-actions">
      <button class="icon-btn" title="Edit" onclick="editTopic('${t.id}')">✏️</button>
      <button class="icon-btn danger" title="Delete" onclick="deleteTopic('${t.id}')">🗑</button>
    </div>
  </div>`;
}

// ─── PLANNER ─────────────────────────────────────────────────
function renderPlanner() {
  const board = document.getElementById('plannerBoard');
  if (state.plan.length === 0) {
    board.innerHTML = `<div class="empty-state large"><span>◫</span><h3>Nothing scheduled</h3><p>Add subjects first, then schedule topics here.</p></div>`;
    return;
  }

  // group by date, sort
  const byDate = {};
  state.plan.forEach(p => {
    if (!byDate[p.date]) byDate[p.date] = [];
    byDate[p.date].push(p);
  });

  const sorted = Object.keys(byDate).sort();
  const today = todayStr();

  board.innerHTML = sorted.map(date => {
    const plans = byDate[date];
    const isToday = date === today;
    const label = isToday ? 'Today' : fmtDate(date);
    const items = plans.map(p => {
      const t = state.topics.find(x => x.id === p.topicId);
      const s = state.subjects.find(x => x.id === t?.subjectId);
      if (!t) return '';
      return `<div class="plan-item" style="--c:${s?.color || '#6c63ff'}">
        <div class="plan-item-info">
          <div class="plan-item-topic">${t.name}</div>
          <div class="plan-item-subject">${s?.name || ''} · ${t.estMins} min</div>
        </div>
        ${t.done ? '<span class="chip done">✓</span>' : ''}
        <button class="plan-remove" title="Remove from plan" onclick="removePlan('${p.id}')">✕</button>
      </div>`;
    }).join('');

    return `<div class="plan-day">
      <div class="plan-day-header">
        <div class="plan-day-title ${isToday ? 'plan-day-today' : ''}">${label}<span>${plans.length} topic${plans.length !== 1 ? 's' : ''}</span></div>
      </div>
      <div class="plan-items">${items}</div>
    </div>`;
  }).join('');
}

// ─── TIMER ───────────────────────────────────────────────────
let timerInterval = null;
let timerSecsLeft = 25 * 60;
let timerTotal = 25 * 60;
let timerRunning = false;

function renderTimerSubjects() {
  const sel = document.getElementById('timerSubjectSelect');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— pick a subject —</option>' +
    state.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  if (cur) sel.value = cur;
  updateTimerTopics();
  renderSessionLog();
}

function updateTimerTopics() {
  const sId = document.getElementById('timerSubjectSelect').value;
  const sel = document.getElementById('timerTopicSelect');
  if (!sId) { sel.innerHTML = '<option value="">— pick a topic —</option>'; return; }
  const topics = state.topics.filter(t => t.subjectId === sId && !t.done);
  sel.innerHTML = '<option value="">— pick a topic —</option>' +
    topics.map(t => `<option value="${t.id}">${t.name} (${t.estMins}m)</option>`).join('');
}

function renderSessionLog() {
  const el = document.getElementById('sessionLogList');
  const recent = [...state.sessions].reverse().slice(0, 8);
  if (recent.length === 0) { el.innerHTML = '<p class="muted">No sessions yet.</p>'; return; }
  el.innerHTML = recent.map(sess => {
    const t = state.topics.find(x => x.id === sess.topicId);
    const s = state.subjects.find(x => x.id === t?.subjectId);
    return `<div class="log-item">
      <div><div class="log-item-name">${t?.name || 'Unknown'}</div>
      <div class="log-item-meta">${s?.name || ''} · ${fmtDate(sess.date)}</div></div>
      <span class="log-duration">${sess.mins}m</span>
    </div>`;
  }).join('');
}

function setTimerPreset(mins) {
  if (timerRunning) return;
  timerTotal = mins * 60;
  timerSecsLeft = timerTotal;
  renderTimerDisplay();
  updateTimerArc();
}

function renderTimerDisplay() {
  const m = Math.floor(timerSecsLeft / 60).toString().padStart(2, '0');
  const s = (timerSecsLeft % 60).toString().padStart(2, '0');
  document.getElementById('timerDisplay').textContent = `${m}:${s}`;
}

function updateTimerArc() {
  const arc = document.getElementById('timerArc');
  const total = 2 * Math.PI * 126; // 792
  const fill = total * (timerSecsLeft / timerTotal);
  arc.style.strokeDashoffset = total - fill;
}

function startTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timerStart').textContent = '▶';
    return;
  }
  timerRunning = true;
  document.getElementById('timerStart').textContent = '⏸';
  timerInterval = setInterval(() => {
    if (timerSecsLeft <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      document.getElementById('timerStart').textContent = '▶';
      logSession();
      showToast('⏰ Session complete!');
      return;
    }
    timerSecsLeft--;
    renderTimerDisplay();
    updateTimerArc();
  }, 1000);
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSecsLeft = timerTotal;
  renderTimerDisplay();
  updateTimerArc();
  document.getElementById('timerStart').textContent = '▶';
}

function skipTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  const mins = Math.round((timerTotal - timerSecsLeft) / 60);
  if (mins > 0) logSession(mins);
  timerSecsLeft = timerTotal;
  renderTimerDisplay();
  updateTimerArc();
  document.getElementById('timerStart').textContent = '▶';
  showToast('✓ Session logged!');
}

function logSession(minsOverride) {
  const topicId = document.getElementById('timerTopicSelect').value;
  if (!topicId) return;
  const mins = minsOverride ?? Math.round(timerTotal / 60);
  const sess = { id: uid(), topicId, date: todayStr(), mins };
  state.sessions.push(sess);
  // update topic studied mins
  const t = state.topics.find(x => x.id === topicId);
  if (t) t.studiedMins = (t.studiedMins || 0) + mins;
  // streak
  updateStreak();
  save();
  renderSessionLog();
}

function updateStreak() {
  const today = todayStr();
  if (state.lastStudyDate === today) return;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];
  if (state.lastStudyDate === yStr) { state.streak = (state.streak || 0) + 1; }
  else { state.streak = 1; }
  state.lastStudyDate = today;
}

// ─── PROGRESS ────────────────────────────────────────────────
function renderProgress() {
  const total = state.topics.length;
  const done = state.topics.filter(t => t.done).length;
  const totalMins = state.sessions.reduce((a, s) => a + s.mins, 0);
  const hours = (totalMins / 60).toFixed(1);

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statDone').textContent = done;
  document.getElementById('statHours').textContent = hours + 'h';
  document.getElementById('statStreak').textContent = state.streak || 0;

  const el = document.getElementById('subjectProgress');
  if (state.subjects.length === 0) { el.innerHTML = '<p class="muted">No subjects yet.</p>'; return; }
  el.innerHTML = state.subjects.map(s => {
    const topics = state.topics.filter(t => t.subjectId === s.id);
    const doneCnt = topics.filter(t => t.done).length;
    const pct = topics.length ? Math.round(doneCnt / topics.length * 100) : 0;
    const studied = state.sessions
      .filter(sess => topics.find(t => t.id === sess.topicId))
      .reduce((a, sess) => a + sess.mins, 0);
    return `<div class="subject-prog">
      <div class="subject-prog-header">
        <div class="subject-prog-name">
          <div class="subj-dot" style="background:${s.color}"></div>${s.name}
        </div>
        <div class="subject-prog-pct">${pct}%</div>
      </div>
      <div class="prog-bar"><div class="prog-bar-fill" style="width:${pct}%;background:${s.color}"></div></div>
      <div class="subject-prog-meta">
        <span>${doneCnt}/${topics.length} topics done</span>
        <span>${(studied/60).toFixed(1)}h studied</span>
        ${s.examDate ? `<span>📅 Exam: ${fmtDate(s.examDate)}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ─── MODALS ──────────────────────────────────────────────────
let editingSubjectId = null;
let editingTopicId = null;
let preselectedSubjectId = null;
let selectedColor = COLORS[0];
let selectedPriority = 'High';
let selectedDiff = 'Medium';

function openModal(id) {
  document.getElementById('modalOverlay').classList.add('open');
  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  document.getElementById(id).style.display = 'block';
}
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
  if (!document.querySelector('.modal[style*="block"]')) {
    document.getElementById('modalOverlay').classList.remove('open');
  }
}

// ── Color picker build ──
function buildColorPicker() {
  const el = document.getElementById('colorPicker');
  el.innerHTML = COLORS.map(c =>
    `<div class="color-swatch ${c === selectedColor ? 'selected' : ''}" style="background:${c}" data-color="${c}" onclick="selectColor('${c}')"></div>`
  ).join('');
}
function selectColor(c) {
  selectedColor = c;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('selected', s.dataset.color === c));
}

// ── Subject modal ──
function openAddSubject() {
  editingSubjectId = null;
  selectedColor = COLORS[0];
  selectedPriority = 'High';
  document.getElementById('subjectModalTitle').textContent = 'New Subject';
  document.getElementById('subjectName').value = '';
  document.getElementById('subjectExamDate').value = '';
  setPriBtn(selectedPriority);
  buildColorPicker();
  openModal('subjectModal');
}
function editSubject(id) {
  const s = state.subjects.find(x => x.id === id);
  if (!s) return;
  editingSubjectId = id;
  selectedColor = s.color;
  selectedPriority = s.priority;
  document.getElementById('subjectModalTitle').textContent = 'Edit Subject';
  document.getElementById('subjectName').value = s.name;
  document.getElementById('subjectExamDate').value = s.examDate || '';
  setPriBtn(selectedPriority);
  buildColorPicker();
  openModal('subjectModal');
}
function saveSubject() {
  const name = document.getElementById('subjectName').value.trim();
  if (!name) { showToast('⚠ Please enter a subject name.'); return; }
  if (editingSubjectId) {
    const s = state.subjects.find(x => x.id === editingSubjectId);
    Object.assign(s, { name, color: selectedColor, priority: selectedPriority, examDate: document.getElementById('subjectExamDate').value });
  } else {
    state.subjects.push({ id: uid(), name, color: selectedColor, priority: selectedPriority, examDate: document.getElementById('subjectExamDate').value });
  }
  save();
  closeModal('subjectModal');
  renderSubjects();
  showToast(editingSubjectId ? '✓ Subject updated!' : '✓ Subject added!');
  editingSubjectId = null;
}
function deleteSubject(id) {
  if (!confirm('Delete this subject and all its topics?')) return;
  state.subjects = state.subjects.filter(s => s.id !== id);
  state.topics = state.topics.filter(t => t.subjectId !== id);
  state.plan = state.plan.filter(p => {
    const t = state.topics.find(x => x.id === p.topicId);
    return !!t;
  });
  save(); renderSubjects(); showToast('🗑 Subject deleted.');
}

function setPriBtn(pri) {
  document.querySelectorAll('.priority-picker .pri-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.pri === pri || b.dataset.pri === undefined);
  });
  selectedPriority = pri;
}

// ── Topic modal ──
function openAddTopic(subjectId) {
  editingTopicId = null;
  preselectedSubjectId = subjectId || null;
  selectedDiff = 'Medium';
  document.getElementById('topicModalTitle').textContent = 'New Topic';
  document.getElementById('topicName').value = '';
  document.getElementById('topicNotes').value = '';
  document.getElementById('topicTime').value = 30;
  populateTopicSubjectSelect(subjectId);
  setDiffBtn('Medium');
  openModal('topicModal');
}
function editTopic(id) {
  const t = state.topics.find(x => x.id === id);
  if (!t) return;
  editingTopicId = id;
  selectedDiff = t.difficulty;
  document.getElementById('topicModalTitle').textContent = 'Edit Topic';
  document.getElementById('topicName').value = t.name;
  document.getElementById('topicNotes').value = t.notes || '';
  document.getElementById('topicTime').value = t.estMins;
  populateTopicSubjectSelect(t.subjectId);
  setDiffBtn(t.difficulty);
  openModal('topicModal');
}
function populateTopicSubjectSelect(selected) {
  const sel = document.getElementById('topicSubjectSelect');
  sel.innerHTML = state.subjects.map(s => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${s.name}</option>`).join('');
}
function saveTopic() {
  const name = document.getElementById('topicName').value.trim();
  const subjectId = document.getElementById('topicSubjectSelect').value;
  const estMins = parseInt(document.getElementById('topicTime').value) || 30;
  const notes = document.getElementById('topicNotes').value.trim();
  if (!name) { showToast('⚠ Please enter a topic name.'); return; }
  if (!subjectId) { showToast('⚠ Please select a subject.'); return; }
  if (editingTopicId) {
    const t = state.topics.find(x => x.id === editingTopicId);
    Object.assign(t, { name, subjectId, difficulty: selectedDiff, estMins, notes });
  } else {
    state.topics.push({ id: uid(), subjectId, name, difficulty: selectedDiff, estMins, notes, done: false, studiedMins: 0 });
  }
  save();
  closeModal('topicModal');
  renderSubjects();
  showToast(editingTopicId ? '✓ Topic updated!' : '✓ Topic added!');
  editingTopicId = null;
}
function deleteTopic(id) {
  if (!confirm('Delete this topic?')) return;
  state.topics = state.topics.filter(t => t.id !== id);
  state.plan = state.plan.filter(p => p.topicId !== id);
  save(); renderSubjects(); showToast('🗑 Topic deleted.');
}
function toggleTopicDone(id) {
  const t = state.topics.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  save();
  renderView(currentView);
  if (t.done) showToast('🎉 Topic marked done!');
}

function setDiffBtn(diff) {
  selectedDiff = diff;
  document.querySelectorAll('#diffPicker .pri-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === diff);
  });
}

// ── Plan modal ──
function openSchedule() {
  document.getElementById('planDate').value = todayStr();
  const sel = document.getElementById('planSubjectSelect');
  sel.innerHTML = state.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  updatePlanTopics();
  openModal('planModal');
}
function updatePlanTopics() {
  const sId = document.getElementById('planSubjectSelect').value;
  const sel = document.getElementById('planTopicSelect');
  const topics = sId ? state.topics.filter(t => t.subjectId === sId && !t.done) : [];
  sel.innerHTML = topics.length
    ? topics.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
    : '<option value="">No topics available</option>';
}
function savePlan() {
  const topicId = document.getElementById('planTopicSelect').value;
  const date = document.getElementById('planDate').value;
  if (!topicId || !date) { showToast('⚠ Select a topic and date.'); return; }
  const exists = state.plan.find(p => p.topicId === topicId && p.date === date);
  if (exists) { showToast('⚠ Already scheduled for this date.'); return; }
  state.plan.push({ id: uid(), topicId, date });
  save(); closeModal('planModal'); renderPlanner(); showToast('✓ Topic scheduled!');
}
function removePlan(id) {
  state.plan = state.plan.filter(p => p.id !== id);
  save(); renderPlanner();
}

// ─── HELPERS ─────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function fmtDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${parseInt(d)}, ${y}`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── DATE BADGE ───────────────────────────────────────────────
function setDateBadge() {
  const now = new Date();
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  document.getElementById('dateBadge').textContent = now.toLocaleDateString('en-US', opts);
}

// ─── EVENT WIRING ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  load();
  setDateBadge();
  renderView('dashboard');

  // nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  // sidebar toggle
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });

  // modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) {
      document.getElementById('modalOverlay').classList.remove('open');
    }
  });

  // subject modal
  document.getElementById('addSubjectBtn').addEventListener('click', openAddSubject);
  document.getElementById('saveSubjectBtn').addEventListener('click', saveSubject);
  document.querySelectorAll('.priority-picker .pri-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.priority-picker .pri-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      selectedPriority = b.dataset.pri;
    });
  });

  // diff picker (topic modal)
  document.querySelectorAll('#diffPicker .pri-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#diffPicker .pri-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      selectedDiff = b.dataset.diff;
    });
  });

  // topic modal
  document.getElementById('saveTopicBtn').addEventListener('click', saveTopic);

  // plan modal
  document.getElementById('addPlanBtn').addEventListener('click', openSchedule);
  document.getElementById('savePlanBtn').addEventListener('click', savePlan);
  document.getElementById('planSubjectSelect').addEventListener('change', updatePlanTopics);

  // quick add
  document.getElementById('quickAddBtn').addEventListener('click', () => {
    if (state.subjects.length === 0) openAddSubject();
    else openAddTopic(null);
  });

  // timer
  document.getElementById('timerStart').addEventListener('click', startTimer);
  document.getElementById('timerReset').addEventListener('click', resetTimer);
  document.getElementById('timerSkip').addEventListener('click', skipTimer);
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setTimerPreset(parseInt(btn.dataset.mins));
    });
  });
  document.getElementById('timerSubjectSelect').addEventListener('change', updateTimerTopics);
  renderTimerDisplay();
  updateTimerArc();

  // clear data
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (!confirm('Reset ALL data? This cannot be undone.')) return;
    state = { subjects: [], topics: [], plan: [], sessions: [], streak: 0, lastStudyDate: null };
    save(); renderView(currentView); showToast('🗑 All data cleared.');
  });
});
