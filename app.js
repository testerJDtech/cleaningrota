const PEOPLE = ['John', 'Chris', 'Awesome', 'Rodney', 'Byron'];
const AREAS = [
  { name: 'Kitchen',                icon: '🍳' },
  { name: 'Hallways & living room', icon: '🚪' },
  { name: 'Bathroom (downstairs)', icon: '🚿' },
  { name: 'Bathroom (upstairs)',   icon: '🛁' },
];
const PERSON_COLORS = {
  'John':    { bg: '#DBEAFE', color: '#1E40AF' },
  'Chris':   { bg: '#FEF3C7', color: '#92400E' },
  'Awesome': { bg: '#EDE9FE', color: '#5B21B6' },
  'Rodney':  { bg: '#CCFBF1', color: '#0F766E' },
  'Byron':   { bg: '#FCE7F3', color: '#9D174D' },
};
const SCRIPTURES = {
  onTime: [
    { quote: 'Well done, good and faithful servant! You have been faithful with a few things; I will put you in charge of many things.', ref: 'Matthew 25:23' },
    { quote: 'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.', ref: 'Colossians 3:23' },
    { quote: 'The plans of the diligent lead to profit as surely as haste leads to poverty.', ref: 'Proverbs 21:5' },
    { quote: 'A faithful person will be richly blessed.', ref: 'Proverbs 28:20' },
    { quote: 'Commit to the Lord whatever you do, and he will establish your plans.', ref: 'Proverbs 16:3' },
  ],
  late: [
    { quote: 'Let your yes be yes and your no be no.', ref: 'Matthew 5:37' },
    { quote: 'The integrity of the upright guides them.', ref: 'Proverbs 11:3' },
    { quote: 'Whoever can be trusted with very little can also be trusted with much.', ref: 'Luke 16:10' },
    { quote: 'Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.', ref: 'Galatians 6:9' },
    { quote: 'Whatever you do, do it all for the glory of God.', ref: '1 Corinthians 10:31' },
  ],
};

const LOCK_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

const STORE_KEY = 'house_rota_v2';
const DB_URL    = 'https://cleaning-rota-ccf7d-default-rtdb.europe-west1.firebasedatabase.app/rota.json';
let state       = { months: {} };
let curMonth    = new Date().getMonth();
let curYear     = new Date().getFullYear();
let currentView = 'monthly';
const today     = new Date(); today.setHours(0, 0, 0, 0);

// ─── State ───────────────────────────────────────────────────────────────────

function mKey() {
  return `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
}

async function loadState() {
  try {
    const res  = await fetch(DB_URL);
    const data = await res.json();
    if (data) { state = data; return; }
  } catch (e) {}
  // fall back to local cache if Firebase unreachable
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) {}
}

function setStatus(msg, color) {
  document.getElementById('saveStatus').innerHTML =
    `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};margin-right:5px;vertical-align:middle"></span>${msg}`;
}

async function saveState() {
  const body = JSON.stringify(state);
  try { localStorage.setItem(STORE_KEY, body); } catch (e) {}
  setStatus('saving…', '#C9860A');
  try {
    await fetch(DB_URL, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    setStatus('saved', '#4A7C2F');
  } catch (e) {
    setStatus('save failed ⚠', '#8B3A0F');
  }
}

function connectLive() {
  setStatus('connecting…', '#A8A59E');
  const es = new EventSource(DB_URL);

  es.addEventListener('put', (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.data !== null && msg.data !== undefined) {
        state = msg.data;
        try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {}
        render();
      }
      setStatus('live', '#4A7C2F');
    } catch {}
  });

  es.onerror = () => setStatus('reconnecting…', '#C9860A');
}

function getMonthData() {
  const k = mKey();
  if (!state.months[k]) {
    state.months[k] = {
      rows: AREAS.map(a => ({ area: a.name, person: '', planned: '', actual: '', notes: '' })),
    };
  }
  return state.months[k];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthName() {
  return new Date(curYear, curMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getStatus(row) {
  if (!row.person) return 'unset';
  if (row.actual)  return 'done';
  if (row.planned) {
    const d = new Date(row.planned + 'T00:00:00');
    if (d < today) return 'late';
  }
  return 'pending';
}

function badgeHTML(s) {
  return {
    done:    '<span class="badge badge-done">Done ✓</span>',
    pending: '<span class="badge badge-pending">Planned</span>',
    late:    '<span class="badge badge-late">Overdue!</span>',
    unset:   '<span class="badge badge-unset">Unassigned</span>',
  }[s];
}

function pickScripture(type) {
  const arr = SCRIPTURES[type];
  return arr[Math.floor(Math.random() * arr.length)];
}

function scriptureBlock(s) {
  return `<blockquote class="scripture">"${s.quote}"<cite>— ${s.ref}</cite></blockquote>`;
}

function lockedDate(iso) {
  return `<span class="locked-date">${LOCK_SVG}${fmtDate(iso)}</span>`;
}

function lateNoteHTML(row) {
  return row.lateReason
    ? `<div class="late-reason" title="${row.lateReason.replace(/"/g, '&quot;')}">⚠ ${row.lateReason}</div>`
    : '';
}

// ─── View switching ──────────────────────────────────────────────────────────

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  render();
}

// ─── Modal ───────────────────────────────────────────────────────────────────

let _modal        = null;
let _calendarData = null;

function showModal({ title, body, hasInput, inputPlaceholder, confirmText, cancelText, onConfirm, onCancel, noCancelBtn }) {
  _modal = { onConfirm, onCancel, hasInput, noCancelBtn };
  document.getElementById('modalTitle').textContent    = title;
  document.getElementById('modalBody').innerHTML       = body;
  const ta         = document.getElementById('modalTextarea');
  const confirmBtn = document.getElementById('modalConfirmBtn');
  const cancelBtn  = document.getElementById('modalCancelBtn');
  if (hasInput) {
    ta.style.display    = 'block';
    ta.placeholder      = inputPlaceholder || '';
    ta.value            = '';
    confirmBtn.disabled = true;
    ta.oninput = () => { confirmBtn.disabled = ta.value.trim() === ''; };
    setTimeout(() => ta.focus(), 50);
  } else {
    ta.style.display    = 'none';
    confirmBtn.disabled = false;
  }
  confirmBtn.textContent      = confirmText  || 'Confirm';
  cancelBtn.textContent       = cancelText   || 'Cancel';
  cancelBtn.style.display     = noCancelBtn  ? 'none' : '';
  document.getElementById('modalOverlay').classList.add('show');
}

function modalConfirm() {
  const reason = _modal?.hasInput ? document.getElementById('modalTextarea').value.trim() : null;
  if (_modal?.hasInput && !reason) return;
  const cb = _modal?.onConfirm;
  _modal = null;
  document.getElementById('modalOverlay').classList.remove('show');
  cb?.(reason);
}

function modalCancel() {
  if (_modal?.noCancelBtn) return;
  document.getElementById('modalOverlay').classList.remove('show');
  _modal?.onCancel?.();
  _modal = null;
}

function modalClickOutside(e) {
  if (e.target === document.getElementById('modalOverlay')) {
    if (_modal?.noCancelBtn) modalConfirm();
    else modalCancel();
  }
}

// ─── Row updates ─────────────────────────────────────────────────────────────

function updateRow(i, field, val, inputEl) {
  const md  = getMonthData();
  const row = md.rows[i];

  if (field === 'planned') {
    if (row.plannedLocked) return;
    if (!val) { row.planned = ''; row.plannedLocked = false; saveState(); render(); return; }
    showModal({
      title:       'Lock in this date?',
      body:        `Set the planned date for <b>${row.area}</b> to <b>${fmtDate(val)}</b>?<br><br>Once confirmed you won't be able to change it.`,
      confirmText: 'Yes, lock it in',
      cancelText:  'Go back',
      onConfirm: () => {
        row.planned = val; row.plannedLocked = true; saveState();
        _calendarData = { person: row.person, area: row.area, planned: val };
        showModal({
          title:       'Add to your calendar? 📅',
          body:        `<b>${row.area}</b> is locked in for <b>${fmtDate(val)}</b>.<br><br>Add it to your calendar with alerts 2 days before and on the day itself.${calendarBtnsHTML()}`,
          confirmText: 'Done',
          noCancelBtn: true,
          onConfirm:   () => render(),
        });
      },
      onCancel:    () => { if (inputEl) inputEl.value = row.planned || ''; },
    });
    return;
  }

  if (field === 'actual') {
    if (row.actualLocked) return;
    if (!val) { row.actual = ''; saveState(); render(); return; }

    const isLate = row.planned && new Date(val + 'T00:00:00') > new Date(row.planned + 'T00:00:00');

    if (isLate) {
      showModal({
        title:            'Completed after planned date',
        body:             `This was planned for <b>${fmtDate(row.planned)}</b> but you're marking it done on <b>${fmtDate(val)}</b>.<br><br>Please give a reason for the delay.`,
        hasInput:         true,
        inputPlaceholder: 'e.g. Was away that week…',
        confirmText:      'Submit',
        cancelText:       'Cancel',
        onConfirm: (reason) => {
          row.actual       = val;
          row.lateReason   = reason;
          row.actualLocked = true;
          saveState();
          const s = pickScripture('late');
          showModal({
            title:       'Well done for getting it done! 🙏',
            body:        `Better late than never — every act of faithfulness counts.<br>${scriptureBlock(s)}Keep your word going forward. You've got this! 💪`,
            confirmText: "I'll do better! 💪",
            noCancelBtn: true,
            onConfirm:   () => render(),
          });
        },
        onCancel: () => { if (inputEl) inputEl.value = row.actual || ''; },
      });
    } else {
      const s = pickScripture('onTime');
      showModal({
        title:       `Well done${row.person ? ', ' + row.person : ''}! 🎉`,
        body:        `<b>${row.area}</b> cleaned on time — brilliant work!<br>${scriptureBlock(s)}Keep it up! 🌟`,
        confirmText: 'Thanks! 🙌',
        noCancelBtn: true,
        onConfirm: () => {
          row.actual       = val;
          row.actualLocked = true;
          saveState();
          render();
        },
      });
    }
    return;
  }

  row[field] = val;
  saveState();
  render();
}

// ─── Render dispatcher ───────────────────────────────────────────────────────

function render() {
  document.getElementById('monthLabel').textContent = monthName();
  const rows = getMonthData().rows;
  if (currentView === 'monthly') renderMonthly(rows);
  if (currentView === 'weekly')  renderWeekly(rows);
  if (currentView === 'stats')   renderStats(rows);
}

// ─── Monthly view ────────────────────────────────────────────────────────────

function renderMonthly(rows) {
  const counts = { done: 0, pending: 0, late: 0, unset: 0 };
  rows.forEach(r => counts[getStatus(r)]++);
  document.getElementById('summary').innerHTML = `
    <div class="chip"><span class="dot dot-done"></span><b>${counts.done}</b> done</div>
    <div class="chip"><span class="dot dot-pending"></span><b>${counts.pending}</b> planned</div>
    <div class="chip"><span class="dot dot-late"></span><b>${counts.late}</b> overdue</div>
    <div class="chip"><span class="dot dot-none"></span><b>${counts.unset}</b> unassigned</div>
  `;

  const tb = document.getElementById('tbody');
  tb.innerHTML = '';
  rows.forEach((row, i) => {
    const tr   = document.createElement('tr');
    const icon = AREAS.find(a => a.name === row.area)?.icon || '🧹';

    const plannedCell = row.plannedLocked
      ? `<span class="locked-date-wrap">${lockedDate(row.planned)}<button class="cal-mini-btn" onclick="showCalendarOptions(${i})" title="Add to calendar">📅</button></span>`
      : `<input type="date" value="${row.planned}" onchange="updateRow(${i},'planned',this.value,this)" />`;

    const actualCell = row.actualLocked
      ? lockedDate(row.actual)
      : `<input type="date" value="${row.actual}" onchange="updateRow(${i},'actual',this.value,this)" />`;

    tr.innerHTML = `
      <td><span class="area-icon">${icon}</span><span class="area-cell">${row.area}</span></td>
      <td>
        <select onchange="updateRow(${i},'person',this.value)">
          <option value="">— unassigned —</option>
          ${PEOPLE.map(p => `<option value="${p}"${row.person === p ? ' selected' : ''}>${p}</option>`).join('')}
        </select>
      </td>
      <td>${plannedCell}</td>
      <td>${actualCell}</td>
      <td>${badgeHTML(getStatus(row))}${lateNoteHTML(row)}</td>
      <td><input type="text" value="${row.notes}" placeholder="Add note…" onchange="updateRow(${i},'notes',this.value)" /></td>
    `;
    tb.appendChild(tr);
  });

  renderCalendar(rows);
}

// ─── Calendar ────────────────────────────────────────────────────────────────

function renderCalendar(rows) {
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const firstDow    = new Date(curYear, curMonth, 1).getDay();
  const startOffset = (firstDow + 6) % 7;

  // Build events keyed by day number
  const plannedByDay = {};
  const actualByDay  = {};
  rows.forEach(row => {
    if (row.planned) {
      const d = new Date(row.planned + 'T00:00:00');
      if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
        const day = d.getDate();
        if (!plannedByDay[day]) plannedByDay[day] = [];
        const isLateCompletion = row.actual && new Date(row.actual + 'T00:00:00') > d;
        const isOnTime         = row.actual && !isLateCompletion;
        plannedByDay[day].push({ ...row, icon: AREAS.find(a => a.name === row.area)?.icon || '🧹', isLateCompletion, isOnTime });
      }
    }
    // Show a completion dot on the actual day if it differs from planned
    if (row.actual && row.actual !== row.planned) {
      const d = new Date(row.actual + 'T00:00:00');
      if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
        const day = d.getDate();
        if (!actualByDay[day]) actualByDay[day] = [];
        actualByDay[day].push({ ...row, icon: AREAS.find(a => a.name === row.area)?.icon || '🧹' });
      }
    }
  });

  const activePeople = [...new Set(rows.filter(r => r.planned && r.person).map(r => r.person))];
  document.getElementById('calLegend').innerHTML = activePeople.length
    ? activePeople.map(p => {
        const c = PERSON_COLORS[p] || { color: '#374151' };
        return `<span class="cal-legend-item"><span class="cal-legend-dot" style="background:${c.color}"></span>${p}</span>`;
      }).join('')
    : '<span style="font-size:11px;color:var(--ink3)">Assign planned dates to see them here.</span>';

  const isCurrentMonth = curMonth === today.getMonth() && curYear === today.getFullYear();
  const todayDate      = today.getDate();

  let html = '';
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(d => { html += `<div class="cal-head">${d}</div>`; });
  for (let i = 0; i < startOffset; i++) html += `<div class="cal-cell cal-empty"></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = isCurrentMonth && day === todayDate;
    const pEvents = plannedByDay[day] || [];
    const aEvents = actualByDay[day]  || [];

    html += `<div class="cal-cell${isToday ? ' cal-today' : ''}">
      <span class="cal-day-num">${day}</span>
      ${pEvents.map(e => {
        const c   = PERSON_COLORS[e.person] || { bg: '#F3F4F6', color: '#374151' };
        const cls = e.isOnTime ? ' cal-event-ontime' : e.isLateCompletion ? ' cal-event-late' : '';
        const pre = e.isOnTime ? '✓ ' : e.isLateCompletion ? '⚠ ' : '';
        const tip = `${e.person}: ${e.area}${e.isOnTime ? ' (on time)' : e.isLateCompletion ? ' (completed late)' : ''}`;
        return `<div class="cal-event${cls}" style="background:${c.bg};color:${c.color}" title="${tip}">${pre}${e.icon} ${e.person}</div>`;
      }).join('')}
      ${aEvents.map(e => {
        const c = PERSON_COLORS[e.person] || { bg: '#F3F4F6', color: '#374151' };
        return `<div class="cal-event cal-event-actual" style="background:${c.bg};color:${c.color}" title="Completed late: ${e.person} – ${e.area}">✓ ${e.icon}</div>`;
      }).join('')}
    </div>`;
  }

  document.getElementById('calGrid').innerHTML = html;
}

// ─── Weekly view ─────────────────────────────────────────────────────────────

function getMonthWeeks() {
  const firstDay = new Date(curYear, curMonth, 1);
  const lastDay  = new Date(curYear, curMonth + 1, 0);
  const weeks    = [];
  let weekStart  = new Date(firstDay);
  weekStart.setDate(weekStart.getDate() - ((firstDay.getDay() + 6) % 7));
  while (weekStart <= lastDay) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeks.push({ start: new Date(weekStart), end: new Date(weekEnd) });
    weekStart.setDate(weekStart.getDate() + 7);
  }
  return weeks;
}

function fmtWeekRange(week) {
  const o = { day: 'numeric', month: 'short' };
  return `${week.start.toLocaleDateString('en-GB', o)} – ${week.end.toLocaleDateString('en-GB', o)}`;
}

function renderWeekly(rows) {
  const weeks        = getMonthWeeks();
  const isThisMonth  = curMonth === today.getMonth() && curYear === today.getFullYear();

  let html = '';
  weeks.forEach((week, wi) => {
    const weekRows     = rows.filter(r => {
      if (!r.planned) return false;
      const d = new Date(r.planned + 'T00:00:00');
      return d >= week.start && d <= week.end;
    });
    const isCurrentWeek = isThisMonth && today >= week.start && today <= week.end;
    const done          = weekRows.filter(r => r.actual).length;

    html += `<div class="week-card${isCurrentWeek ? ' week-current' : ''}">
      <div class="week-header">
        <div>
          <div class="week-label">Week ${wi + 1}${isCurrentWeek ? ' <span class="week-now">this week</span>' : ''}</div>
          <div class="week-range">${fmtWeekRange(week)}</div>
        </div>
        <span class="week-count">${done}/${weekRows.length} done</span>
      </div>
      ${weekRows.length
        ? `<div class="week-table">${weekRows.map(row => renderWeekRow(row, rows.indexOf(row))).join('')}</div>`
        : '<div class="week-empty">No tasks planned for this week</div>'
      }
    </div>`;
  });

  const unscheduled = rows.filter(r => !r.planned);
  if (unscheduled.length) {
    html += `<div class="week-card week-unscheduled">
      <div class="week-header">
        <div>
          <div class="week-label">Unscheduled</div>
          <div class="week-range">No planned date set yet</div>
        </div>
        <span class="week-count">${unscheduled.length} task${unscheduled.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="week-table">${unscheduled.map(row => renderWeekRow(row, rows.indexOf(row))).join('')}</div>
    </div>`;
  }

  document.getElementById('weeklyContent').innerHTML = html;
}

function renderWeekRow(row, i) {
  const icon        = AREAS.find(a => a.name === row.area)?.icon || '🧹';
  const plannedCell = row.plannedLocked
    ? `<span class="locked-date-wrap">${lockedDate(row.planned)}<button class="cal-mini-btn" onclick="showCalendarOptions(${i})" title="Add to calendar">📅</button></span>`
    : `<input type="date" value="${row.planned}" onchange="updateRow(${i},'planned',this.value,this)" />`;
  const actualCell  = row.actualLocked
    ? lockedDate(row.actual)
    : `<input type="date" value="${row.actual}" onchange="updateRow(${i},'actual',this.value,this)" />`;

  return `<div class="week-row">
    <div class="week-area-col">
      <span class="area-icon">${icon}</span>
      <span class="area-cell">${row.area}</span>
    </div>
    <div class="week-person-col">
      <select onchange="updateRow(${i},'person',this.value)">
        <option value="">— assign —</option>
        ${PEOPLE.map(p => `<option value="${p}"${row.person === p ? ' selected' : ''}>${p}</option>`).join('')}
      </select>
    </div>
    <div class="week-date-col">
      <span class="week-date-label">Planned</span>
      ${plannedCell}
    </div>
    <div class="week-date-col">
      <span class="week-date-label">Done</span>
      ${actualCell}
    </div>
    <div class="week-status-col">
      ${badgeHTML(getStatus(row))}${lateNoteHTML(row)}
    </div>
  </div>`;
}

// ─── Stats view ──────────────────────────────────────────────────────────────

function renderStats(rows) {
  const pd = {};
  PEOPLE.forEach(p => { pd[p] = { assigned: 0, onTime: 0, late: 0, overdue: 0, pending: 0 }; });

  rows.forEach(r => {
    if (!r.person || !pd[r.person]) return;
    pd[r.person].assigned++;
    if (r.actual) {
      r.lateReason ? pd[r.person].late++ : pd[r.person].onTime++;
    } else if (r.planned && new Date(r.planned + 'T00:00:00') < today) {
      pd[r.person].overdue++;
    } else {
      pd[r.person].pending++;
    }
  });

  const totalDone  = rows.filter(r => r.actual).length;
  const onTimeDone = rows.filter(r => r.actual && !r.lateReason).length;
  const lateDone   = rows.filter(r => r.actual &&  r.lateReason).length;
  const overdueN   = rows.filter(r => !r.actual && r.planned && new Date(r.planned + 'T00:00:00') < today).length;

  const assignedPeople = PEOPLE.filter(p => pd[p].assigned > 0);
  const ranked = [...assignedPeople].sort((a, b) =>
    (pd[b].onTime * 2 - pd[b].overdue) - (pd[a].onTime * 2 - pd[a].overdue)
  );

  const html = `
    <div class="stats-summary">
      <div class="stats-chip"><span class="stats-num">${totalDone}/${rows.length}</span><span class="stats-lbl">Completed</span></div>
      <div class="stats-chip"><span class="stats-num" style="color:var(--accent)">${onTimeDone}</span><span class="stats-lbl">On time</span></div>
      <div class="stats-chip"><span class="stats-num" style="color:var(--warn)">${lateDone}</span><span class="stats-lbl">Late</span></div>
      <div class="stats-chip"><span class="stats-num" style="color:var(--accent2)">${overdueN}</span><span class="stats-lbl">Overdue</span></div>
    </div>

    ${ranked.length >= 2 ? `
    <div class="stats-highlights">
      <div class="highlight-card highlight-star">
        <div class="highlight-label">⭐ Most reliable this month</div>
        <div class="highlight-name">${ranked[0]}</div>
      </div>
      <div class="highlight-card highlight-work">
        <div class="highlight-label">💪 Keep pushing</div>
        <div class="highlight-name">${ranked[ranked.length - 1]}</div>
      </div>
    </div>` : ''}

    <div class="stats-grid">
      ${assignedPeople.map(p => {
        const d  = pd[p];
        const c  = PERSON_COLORS[p] || { bg: '#F3F4F6', color: '#374151' };
        const onTimePct = d.assigned ? Math.round((d.onTime / d.assigned) * 100) : 0;
        const latePct   = d.assigned ? Math.round((d.late   / d.assigned) * 100) : 0;
        return `
          <div class="person-stat-card">
            <div class="person-stat-header">
              <span class="person-stat-name" style="color:${c.color}">${p}</span>
              <span class="person-stat-rate">${onTimePct}% on time</span>
            </div>
            <div class="stat-bar-track">
              <div class="stat-bar-fill stat-bar-ontime" style="width:${onTimePct}%"></div>
              <div class="stat-bar-fill stat-bar-late"   style="width:${latePct}%"></div>
            </div>
            <div class="person-stat-details">
              ${d.onTime   ? `<span class="stat-det stat-det-ontime">✓ ${d.onTime} on time</span>` : ''}
              ${d.late     ? `<span class="stat-det stat-det-late">⚠ ${d.late} late</span>` : ''}
              ${d.overdue  ? `<span class="stat-det stat-det-over">✗ ${d.overdue} overdue</span>` : ''}
              ${d.pending  ? `<span class="stat-det">⏳ ${d.pending} pending</span>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>

    ${assignedPeople.length === 0 ? '<p class="stats-empty">No assignments yet this month.</p>' : ''}
  `;

  document.getElementById('statsContent').innerHTML = html;
}

// ─── Google Calendar / ICS ───────────────────────────────────────────────────

function nextIsoDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function createICS() {
  const { person, area, planned } = _calendarData;
  const icon  = AREAS.find(a => a.name === area)?.icon || '';
  const title = `${icon} ${person}: clean ${area}`.trim();
  const start = planned.replace(/-/g, '');
  const end   = nextIsoDate(planned);
  const uid   = `cleaning-${start}-${area.replace(/\s+/g, '-')}-${Date.now()}@houseroota`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//House Rota//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${title}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${title} in 2 days`,
    'TRIGGER:-P2D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:Today: ${title}`,
    'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadICS() {
  if (!_calendarData) return;
  const blob = new Blob([createICS()], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `cleaning-${_calendarData.planned}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Calendar file downloaded!');
}

function openGoogleCalendar() {
  if (!_calendarData) return;
  const { person, area, planned } = _calendarData;
  const icon  = AREAS.find(a => a.name === area)?.icon || '';
  const title = encodeURIComponent(`${icon} ${person}: clean ${area}`.trim());
  const start = planned.replace(/-/g, '');
  const end   = nextIsoDate(planned);
  const url   = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${encodeURIComponent('House cleaning rota reminder')}`;
  window.open(url, '_blank');
}

function showCalendarOptions(i) {
  const row = getMonthData().rows[i];
  if (!row.planned) return;
  _calendarData = { person: row.person, area: row.area, planned: row.planned };
  showModal({
    title:       'Add to your calendar 📅',
    body:        `<b>${row.area}</b> is planned for <b>${fmtDate(row.planned)}</b>.${calendarBtnsHTML()}`,
    confirmText: 'Done',
    noCancelBtn: true,
    onConfirm:   () => {},
  });
}

function calendarBtnsHTML() {
  return `<div class="cal-add-section">
    <div class="cal-add-btns">
      <button class="cal-btn cal-btn-gcal" onclick="openGoogleCalendar()">Open in Google Calendar</button>
      <button class="cal-btn cal-btn-ics"  onclick="downloadICS()">Download .ics file</button>
    </div>
    <div class="cal-add-note">The .ics file includes 2-day and same-day alerts — works with Apple Calendar, Outlook &amp; more.</div>
  </div>`;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function changeMonth(dir) {
  curMonth += dir;
  if (curMonth < 0)  { curMonth = 11; curYear--; }
  if (curMonth > 11) { curMonth = 0;  curYear++; }
  render();
}

function resetMonth() {
  if (!confirm(`Reset all data for ${monthName()}?`)) return;
  delete state.months[mKey()];
  saveState();
  render();
  toast('Month reset.');
}

function copyText() {
  const rows = getMonthData().rows;
  let out = `Cleaning Rota — ${monthName()}\n${'='.repeat(40)}\n`;
  rows.forEach(r => {
    out += `\n${r.area}\n  Person:    ${r.person || 'Unassigned'}\n  Planned:   ${r.planned || '—'}\n  Completed: ${r.actual || '—'}\n  Status:    ${getStatus(r)}\n  Notes:     ${r.notes || '—'}\n`;
  });
  navigator.clipboard.writeText(out)
    .then(() => toast('Schedule copied!'))
    .catch(() => toast('Copy failed — try selecting manually'));
}

function printPage() { window.print(); }

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── Init ────────────────────────────────────────────────────────────────────

(async () => {
  document.getElementById('saveStatus').textContent = 'loading…';
  await loadState();
  render();
  connectLive();
})();
