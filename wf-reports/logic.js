// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  logic.js — Controller                                                       ║
// ║  App state, event handlers, business logic, and DOM rendering.               ║
// ║  Depends on data.js being loaded first.                                      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ── App state ─────────────────────────────────────────────────────────────────

let _chartBaseData = [];           // working copy of STOP_REASONS_DATA; stays at stop-reason level
let currentXAxis   = 'Stop reasons';
let _dtColLabel    = 'Stop reasons';
let currentY2      = null;         // null = off, or one of the Y2_METRICS keys
let _dtFixedWidth  = 200;          // first column width, px — resizable via drag
let currentReport  = 'downtime';   // 'downtime' | 'oee'

const Y2_METRICS = {
  'Duration':     { main: d => d.mainDur,   cmp: d => d.cmpDur,   unit: ' min' },
  'Count':        { main: d => d.mainCount, cmp: d => d.cmpCount, unit: '' },
  'Avg Duration': { main: d => d.mainAvg,   cmp: d => d.cmpAvg,   unit: ' min' },
  '% of Planned': { main: d => d.mainPct,   cmp: d => d.cmpPct,   unit: '%' },
};

const _today = new Date(); _today.setHours(0,0,0,0);
let rangeEnd   = new Date(_today);
let rangeStart = new Date(_today); rangeStart.setDate(_today.getDate() - 6);
let leftMonth  = { year: 0, month: 0 };
let rightMonth = { year: 0, month: 0 };

let picking          = false;      // true while user is picking the first calendar day
let currentPreset    = 'last7';

let updateChartCompare = null;     // set by drawChartWith(); called on Apply and removeCompare()
let _pickerSnapshot  = null;       // snapshot saved on picker-open so Close can revert
let _appliedCompareOn = false;     // reflects the last-applied compare state (not the in-picker state)

// ── Compare state ─────────────────────────────────────────────────────────────

let compareMode  = 'previous_period';
let matchDow     = false;
let compareStart = null;
let compareEnd   = null;

// ── Data table state ──────────────────────────────────────────────────────────

let _dtData = [];
let _dtPage = 0;

// ── Compare chip dropdown (CDD) state ─────────────────────────────────────────

let cddSelectedMode = null;          // null = no compare active; one of the 4 mode keys
let cddLeftMonth    = { year: 0, month: 0 };
let cddRightMonth   = { year: 0, month: 0 };
let cddPicking      = false;         // true while user is selecting the first custom date
let cddPickFirst    = null;          // first day clicked for custom range
let _cddSnapshot    = null;          // snapshot saved on dropdown-open so Cancel can revert

// ── Calendar: display-month helpers ──────────────────────────────────────────

// True if d is strictly between rangeStart and rangeEnd
function inRange(d) {
  if (!rangeStart || !rangeEnd) return false;
  return d > rangeStart && d < rangeEnd;
}

// Set leftMonth / rightMonth so that both endpoints are visible, clamped to current month
function setDisplayMonths(start, end) {
  const now = new Date();
  let lm = { year: start.getFullYear(), month: start.getMonth() };
  let rm = { year: (end || start).getFullYear(), month: (end || start).getMonth() };

  // If same month, push left one back
  if (lm.year === rm.year && lm.month === rm.month) {
    lm = { year: rm.year, month: rm.month - 1 };
    if (lm.month < 0) { lm.month = 11; lm.year--; }
  }

  // Clamp right to current month
  if (rm.year > now.getFullYear() || (rm.year === now.getFullYear() && rm.month > now.getMonth())) {
    rm = { year: now.getFullYear(), month: now.getMonth() };
    lm = { year: rm.year, month: rm.month - 1 };
    if (lm.month < 0) { lm.month = 11; lm.year--; }
  }

  leftMonth  = lm;
  rightMonth = rm;
}

// ── Calendar rendering ────────────────────────────────────────────────────────

function renderCalendar(titleId, gridId, year, month) {
  document.getElementById(titleId).textContent = `${MONTHS[month]} ${year}`;

  const firstDay    = new Date(year, month, 1);
  const lastDay     = new Date(year, month + 1, 0);
  const startDow    = mondayDow(firstDay);
  const daysInMonth = lastDay.getDate();

  // Leading empty slots + this month's days (no trailing overflow)
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });

  // Split into rows of 7
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  let html = '';

  // Day-of-week headers
  html += '<div class="cal-grid">';
  DOW.forEach(d => { html += `<div class="cal-header-cell">${d}</div>`; });
  html += '</div>';

  rows.forEach(row => {
    // Classify each cell: main range state
    const states = row.map(cell => {
      if (!cell) return 'empty';
      const d = new Date(year, month, cell.day);
      if (sameDay(d, rangeStart)) return 'start';
      if (sameDay(d, rangeEnd))   return 'end';
      if (inRange(d))             return 'range';
      return 'normal';
    });

    // Main band span indices
    const bandIndices = states.map((s, i) => (s === 'start' || s === 'range' || s === 'end') ? i : -1).filter(i => i !== -1);
    const firstBand = bandIndices.length ? bandIndices[0] : -1;
    const lastBand  = bandIndices.length ? bandIndices[bandIndices.length - 1] : -1;

    html += '<div class="cal-grid" style="margin-top:0;">';
    row.forEach((cell, col) => {
      const state    = states[col];
      const isInBand = col >= firstBand && col <= lastBand && firstBand !== -1;

      let wrapClass = 'cal-cell-wrap';
      if (isInBand) {
        if (firstBand === lastBand)    wrapClass += ' band-single';
        else if (col === firstBand)    wrapClass += ' band-left';
        else if (col === lastBand)     wrapClass += ' band-right';
        else                           wrapClass += ' band-full';
      }

      if (!cell) { html += `<div class="${wrapClass}"></div>`; return; }

      const cellDate = new Date(year, month, cell.day);
      const isFuture = cellDate > _today;
      let dayClass = 'cal-day';
      if (isFuture)                                 dayClass += ' disabled';
      else if (state === 'start' || state === 'end') dayClass += ' range-dot';

      html += `<div class="${wrapClass}">`;
      html += `<div class="${dayClass}"${isFuture ? '' : ` onclick="handleDayClick(${year},${month},${cell.day})"`}>${cell.day}</div>`;
      html += `</div>`;
    });
    html += '</div>';
  });

  document.getElementById(gridId).innerHTML = html;
}

function renderCalendars() {
  renderCalendar('cal-left-title',  'cal-left-grid',  leftMonth.year,  leftMonth.month);
  renderCalendar('cal-right-title', 'cal-right-grid', rightMonth.year, rightMonth.month);
  updateNavButtons();
}

function updateNavButtons() {
  const now = new Date();
  const atMax = rightMonth.year > now.getFullYear() ||
                (rightMonth.year === now.getFullYear() && rightMonth.month >= now.getMonth());
  const btn1 = document.getElementById('nav-next-single');
  const btn2 = document.getElementById('nav-next-double');
  btn1.disabled = atMax; btn1.style.opacity = atMax ? '0.2' : '1';   btn1.style.cursor = atMax ? 'default' : 'pointer';
  btn2.disabled = atMax; btn2.style.opacity = atMax ? '0.1' : '0.5'; btn2.style.cursor = atMax ? 'default' : 'pointer';
}

// ── Calendar navigation ───────────────────────────────────────────────────────

function navigate(dir) {
  const steps = dir === 2 ? 2 : (dir === -1 ? -1 : 1);
  if (steps > 0) {
    const now = new Date();
    const nextRight = { year: rightMonth.year, month: rightMonth.month + steps };
    while (nextRight.month > 11) { nextRight.month -= 12; nextRight.year++; }
    if (nextRight.year > now.getFullYear() ||
        (nextRight.year === now.getFullYear() && nextRight.month > now.getMonth())) return;
  }
  [leftMonth, rightMonth].forEach(m => {
    m.month += steps;
    while (m.month > 11) { m.month -= 12; m.year++; }
    while (m.month < 0)  { m.month += 12; m.year--; }
  });
  renderCalendars();
}

// ── Calendar day click ────────────────────────────────────────────────────────

function handleDayClick(year, month, day) {
  const d = new Date(year, month, day);

  // Main range picking
  if (!picking) {
    rangeStart = d; rangeEnd = null; picking = true;
    clearChips();
  } else {
    if (d < rangeStart) { rangeEnd = rangeStart; rangeStart = d; }
    else                { rangeEnd = d; }
    picking = false;
    currentPreset = 'custom';
    selectChipByPreset('custom');
  }
  renderCalendars();
}

// ── Preset chips ──────────────────────────────────────────────────────────────

function clearChips() {
  document.querySelectorAll('#chips-primary .chip').forEach(c => c.classList.remove('selected'));
}

function selectChipByPreset(preset) {
  clearChips();
  const chip = document.querySelector(`[data-preset="${preset}"]`);
  if (chip) chip.classList.add('selected');
}

function selectPreset(el) {
  const preset = el.dataset.preset;
  currentPreset = preset;
  clearChips();
  el.classList.add('selected');

  const today = new Date(); today.setHours(0,0,0,0);
  const dow   = mondayDow(today);

  switch (preset) {
    case 'today':
      rangeStart = new Date(today); rangeEnd = new Date(today); break;
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      rangeStart = y; rangeEnd = new Date(y); break;
    }
    case 'this_week':
      rangeStart = new Date(today); rangeStart.setDate(today.getDate() - dow);
      rangeEnd   = new Date(today); break;
    case 'last_week':
      rangeStart = new Date(today); rangeStart.setDate(today.getDate() - dow - 7);
      rangeEnd   = new Date(today); rangeEnd.setDate(today.getDate() - dow - 1); break;
    case 'last7':
      rangeEnd   = new Date(today);
      rangeStart = new Date(today); rangeStart.setDate(today.getDate() - 6); break;
    case 'this_month':
      rangeStart = new Date(today.getFullYear(), today.getMonth(), 1);
      rangeEnd   = new Date(today); break;
    case 'last_month':
      rangeStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      rangeEnd   = new Date(today.getFullYear(), today.getMonth(), 0); break;
    case 'last30':
      rangeEnd   = new Date(today);
      rangeStart = new Date(today); rangeStart.setDate(today.getDate() - 29); break;
    case 'this_quarter': {
      const q = Math.floor(today.getMonth() / 3);
      rangeStart = new Date(today.getFullYear(), q * 3, 1);
      rangeEnd   = new Date(today); break;
    }
    case 'last_quarter': {
      const q  = Math.floor(today.getMonth() / 3);
      const lq = q === 0 ? 3 : q - 1;
      const ly = q === 0 ? today.getFullYear() - 1 : today.getFullYear();
      rangeStart = new Date(ly, lq * 3, 1);
      rangeEnd   = new Date(ly, lq * 3 + 3, 0); break;
    }
    case 'last4q':
      rangeEnd   = new Date(today);
      rangeStart = new Date(today); rangeStart.setMonth(today.getMonth() - 12); break;
    case 'this_year':
      rangeStart = new Date(today.getFullYear(), 0, 1);
      rangeEnd   = new Date(today); break;
    case 'last_year':
      rangeStart = new Date(today.getFullYear() - 1, 0, 1);
      rangeEnd   = new Date(today.getFullYear() - 1, 11, 31); break;
    case 'custom':
      rangeStart = null; rangeEnd = null; picking = false;
      renderCalendars();
      return; // handled via calendar clicks
    default: return;
  }

  picking = false;
  if (rangeStart) setDisplayMonths(rangeStart, rangeEnd);
  renderCalendars();
}

// ── Filter-bar button label ───────────────────────────────────────────────────

function updateFilterBtn() {
  if (!rangeStart) return;
  const btn   = document.getElementById('date-btn');
  const label = PRESET_LABELS[currentPreset];
  if (label) {
    btn.textContent = `← ${label} →`;
  } else {
    const fmt = d => fmtDMslashM(d);
    if (rangeEnd && !sameDay(rangeStart, rangeEnd)) {
      btn.textContent = `← ${fmt(rangeStart)} – ${fmt(rangeEnd)} →`;
    } else {
      btn.textContent = `← ${fmt(rangeStart)} →`;
    }
  }
}

// ── Date picker: open / close / apply ────────────────────────────────────────

function toggleDatePicker() {
  const dp     = document.getElementById('date-picker');
  const isOpen = dp.style.display !== 'none' && dp.style.display !== '';
  if (isOpen) {
    closeDatePicker();
  } else {
    // Snapshot current state so Close can revert
    _pickerSnapshot = {
      rangeStart:   rangeStart ? new Date(rangeStart) : null,
      rangeEnd:     rangeEnd   ? new Date(rangeEnd)   : null,
      currentPreset,
      leftMonth:    { ...leftMonth },
      rightMonth:   { ...rightMonth },
    };
    dp.style.display = 'flex';
  }
}

function closeDatePicker() {
  if (_pickerSnapshot) {
    const s = _pickerSnapshot;
    rangeStart    = s.rangeStart;
    rangeEnd      = s.rangeEnd;
    currentPreset = s.currentPreset;
    leftMonth     = s.leftMonth;
    rightMonth    = s.rightMonth;
    picking       = false;
    selectChipByPreset(currentPreset);
    renderCalendars();
  }
  document.getElementById('date-picker').style.display = 'none';
}

function applyDatePicker() {
  _pickerSnapshot = null; // commit — nothing to revert
  updateFilterBtn();

  // If compare is active with an auto mode, recompute compare range for the new main range
  if (_appliedCompareOn && cddSelectedMode && cddSelectedMode !== 'custom_compare') {
    const r = computeRangeForMode(cddSelectedMode, rangeStart, rangeEnd, currentPreset, false);
    if (r) { compareStart = r.cs; compareEnd = r.ce; }
  }

  if (currentReport === 'oee') drawOeeChart();
  else if (updateChartCompare) updateChartCompare(_appliedCompareOn);
  updateCddDescriptions();
  updateCompareBtnLabel();
  document.getElementById('date-picker').style.display = 'none';
}

// ── Compare chip in the filter bar ────────────────────────────────────────────

function updateCompareChip() {
  updateCompareBtnLabel();
}

function removeCompare() {
  _appliedCompareOn = false;
  cddSelectedMode   = null;
  cddPicking        = false;
  cddPickFirst      = null;
  compareStart      = null;
  compareEnd        = null;

  if (currentReport === 'oee') drawOeeChart();
  else if (updateChartCompare) updateChartCompare(false);
  updateCompareBtnLabel();
  updateCddOptionStyles();
  renderCalendars();
}


// ── Compare chip dropdown (CDD) functions ─────────────────────────────────────

const CDD_LABELS = {
  previous_period: 'Preceding period',
  previous_year:   'Same period, previous year',
  custom_compare:  'Custom',
};

function updateCompareBtnLabel() {
  const btn     = document.getElementById('compare-btn');
  const label   = document.getElementById('compare-btn-label');
  const remove  = document.getElementById('compare-btn-remove');
  const chevron = document.getElementById('compare-btn-chevron');
  if (!cddSelectedMode) {
    btn.classList.remove('active');
    label.textContent = 'Compare to:';
    remove.style.display  = 'none';
    if (chevron) chevron.style.display = '';
  } else {
    btn.classList.add('active');
    const dateRange = compareStart && compareEnd
      ? `${fmtDMslashM(compareStart)} – ${fmtDMslashM(compareEnd)}`
      : '';
    label.textContent = `Compare to:${dateRange ? ' ' + dateRange : ''}`;
    remove.style.display  = 'inline-flex';
    if (chevron) chevron.style.display = 'none';
  }
}

function updateCddOptionStyles() {
  const noneOpt   = document.getElementById('cdd-opt-none');
  const noneRadio = document.getElementById('cdd-radio-none');
  if (noneOpt) {
    const on = cddSelectedMode === null;
    noneOpt.classList.toggle('cdd-selected', on);
    noneRadio.classList.toggle('radio-on', on);
  }
  ['previous_period','previous_year','custom_compare'].forEach(mode => {
    const opt   = document.getElementById('cdd-opt-' + mode);
    const radio = document.getElementById('cdd-radio-' + mode);
    const on    = mode === cddSelectedMode;
    opt.classList.toggle('cdd-selected', on);
    radio.classList.toggle('radio-on', on);
  });
}

function updateCddDescriptions() {
  ['previous_period', 'previous_year'].forEach(mode => {
    const r  = computeRangeForMode(mode, rangeStart, rangeEnd, currentPreset, false);
    const el = document.getElementById('cdd-desc-' + mode);
    if (el && r && r.cs && r.ce) el.textContent = `${fmtDMslashM(r.cs)} – ${fmtDMslashM(r.ce)}`;
  });
  // Custom: show selected range or empty
  const customDesc = document.getElementById('cdd-desc-custom_compare');
  if (customDesc) customDesc.textContent = (cddSelectedMode === 'custom_compare' && compareStart && compareEnd)
    ? `${fmtDMslashM(compareStart)} – ${fmtDMslashM(compareEnd)}`
    : '';
}

function toggleCompareDropdown(event) {
  event.stopPropagation();
  const dd = document.getElementById('compare-dropdown');
  const opening = !dd.classList.contains('open');
  // Close other dropdowns
  document.getElementById('xaxis-dropdown').classList.remove('open');
  document.getElementById('date-picker').style.display = 'none';
  if (opening) {
    // Snapshot so Cancel can revert
    _cddSnapshot = {
      cddSelectedMode,
      compareStart: compareStart ? new Date(compareStart) : null,
      compareEnd:   compareEnd   ? new Date(compareEnd)   : null,
      _appliedCompareOn,
    };
    cddPicking   = false;
    cddPickFirst = null;
    // Initialise calendar months; right side is capped at the current month
    const today = new Date();
    const ref   = compareStart || rangeStart || today;
    let lDate = new Date(ref.getFullYear(), ref.getMonth(), 1);
    let rDate = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    // Cap right at current month
    const capDate = new Date(today.getFullYear(), today.getMonth(), 1);
    if (rDate > capDate) {
      rDate = capDate;
      lDate = new Date(capDate.getFullYear(), capDate.getMonth() - 1, 1);
    }
    cddLeftMonth  = { year: lDate.getFullYear(), month: lDate.getMonth() };
    cddRightMonth = { year: rDate.getFullYear(), month: rDate.getMonth() };
    updateCddDescriptions();
    updateCddOptionStyles();
    renderCddCalendars();
    updateCddNavButtons();
  }
  dd.classList.toggle('open', opening);
}

function cancelCdd() {
  if (_cddSnapshot) {
    cddSelectedMode   = _cddSnapshot.cddSelectedMode;
    compareStart      = _cddSnapshot.compareStart;
    compareEnd        = _cddSnapshot.compareEnd;
    _appliedCompareOn = _cddSnapshot._appliedCompareOn;
    _cddSnapshot      = null;
  }
  cddPicking   = false;
  cddPickFirst = null;
  document.getElementById('compare-dropdown').classList.remove('open');
}

function applyCdd() {
  _appliedCompareOn = cddSelectedMode !== null && compareStart !== null && compareEnd !== null;
  _cddSnapshot      = null;
  cddPicking        = false;
  cddPickFirst      = null;
  if (currentReport === 'oee') drawOeeChart();
  else if (updateChartCompare) updateChartCompare(_appliedCompareOn);
  updateCompareBtnLabel();
  renderCalendars(); // refresh date-picker calendar compare band
  document.getElementById('compare-dropdown').classList.remove('open');
}

function selectCompareOption(mode) {
  if (mode === 'none') {
    removeCompare();
    document.getElementById('compare-dropdown').classList.remove('open');
    return;
  }
  cddSelectedMode  = mode;
  cddPicking       = false;
  cddPickFirst     = null;
  updateCddOptionStyles();

  if (mode === 'custom_compare') {
    // Enter picking mode with no pre-selection
    compareStart = null;
    compareEnd   = null;
    cddPicking   = true;
    renderCddCalendars();
    return;
  }

  const r = computeRangeForMode(mode, rangeStart, rangeEnd, currentPreset, false);
  compareStart = r.cs;
  compareEnd   = r.ce;
  matchDow     = false;
  compareMode  = mode;

  updateCddDescriptions();
  renderCddCalendars();
  applyCdd(); // apply immediately for non-custom options
}

// ── CDD calendar helpers ──────────────────────────────────────────────────────

function inCddRange(d) {
  if (!compareStart || !compareEnd) return false;
  return d > compareStart && d < compareEnd;
}

function renderCddCalendar(titleId, gridId, year, month) {
  const title = document.getElementById(titleId);
  const grid  = document.getElementById(gridId);
  if (!title || !grid) return;
  title.textContent = `${MONTHS[month]} ${year}`;
  grid.innerHTML = '';

  // Day-of-week headers
  ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-header-cell'; h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay = new Date(year, month, 1);
  const startDow = mondayDow(firstDay); // 0=Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  for (let i = 0; i < startDow; i++) {
    const prev = new Date(year, month, 1 - (startDow - i));
    const wrap = document.createElement('div'); wrap.className = 'cal-cell-wrap';
    const day  = document.createElement('div'); day.className = 'cal-day out-of-month';
    day.textContent = prev.getDate();
    wrap.appendChild(day); grid.appendChild(wrap);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);

    // Compare period (green)
    const isCmpStart = compareStart && sameDay(date, compareStart);
    const isCmpEnd   = compareEnd   && sameDay(date, compareEnd);
    const isCmpMid   = inCddRange(date);

    const isFuture = date > today;

    const wrap = document.createElement('div');
    wrap.className = 'cal-cell-wrap';

    // Green band for compare period
    if (isCmpStart && isCmpEnd)       wrap.classList.add('band-single');
    else if (isCmpStart)              wrap.classList.add('band-left');
    else if (isCmpEnd)                wrap.classList.add('band-right');
    else if (isCmpMid)                wrap.classList.add('band-full');

    const dayEl = document.createElement('div');
    dayEl.className = 'cal-day';
    dayEl.textContent = d;

    // Green dot on compare endpoints (matches main date picker style)
    if ((isCmpStart || isCmpEnd) && compareStart && compareEnd)
      dayEl.classList.add('range-dot');

    if (isFuture) { dayEl.classList.add('disabled'); }
    else { dayEl.addEventListener('click', () => handleCddDayClick(year, month, d)); }

    wrap.appendChild(dayEl); grid.appendChild(wrap);
  }
}

function renderCddCalendars() {
  renderCddCalendar('cdd-cal-left-title',  'cdd-cal-left-grid',  cddLeftMonth.year,  cddLeftMonth.month);
  renderCddCalendar('cdd-cal-right-title', 'cdd-cal-right-grid', cddRightMonth.year, cddRightMonth.month);
  const isCustom = cddSelectedMode === 'custom_compare';
  const calArea  = document.getElementById('cdd-cal-area');
  const footer   = document.getElementById('cdd-footer');
  const dd       = document.getElementById('compare-dropdown');
  if (calArea) calArea.style.display = isCustom ? '' : 'none';
  if (footer)  footer.style.display  = isCustom ? 'flex' : 'none';
  if (dd)      dd.style.width        = isCustom ? '600px' : '400px';
}

function updateCddNavButtons() {
  const today = new Date();
  const rightIsCurrentOrFuture =
    cddRightMonth.year > today.getFullYear() ||
    (cddRightMonth.year === today.getFullYear() && cddRightMonth.month >= today.getMonth());
  const nextSingle = document.getElementById('cdd-nav-next-single');
  const nextDouble = document.getElementById('cdd-nav-next-double');
  if (nextSingle) nextSingle.disabled = rightIsCurrentOrFuture;
  if (nextDouble) nextDouble.disabled = rightIsCurrentOrFuture;
}

function navigateCdd(dir) {
  const advance = (m, delta) => {
    let d = new Date(m.year, m.month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  };
  cddLeftMonth  = advance(cddLeftMonth,  dir);
  cddRightMonth = advance(cddRightMonth, dir);
  renderCddCalendars();
  updateCddNavButtons();
}

function handleCddDayClick(year, month, day) {
  const clicked = new Date(year, month, day);

  // Any calendar click switches to custom mode
  if (cddSelectedMode !== 'custom_compare') {
    cddSelectedMode = 'custom_compare';
    cddPicking      = true;
    cddPickFirst    = null;
    updateCddOptionStyles();
  }

  if (!cddPickFirst) {
    // First click — anchor start
    cddPickFirst = clicked;
    compareStart = clicked;
    compareEnd   = null;
  } else {
    // Second click — finish range
    const [s, e] = clicked < cddPickFirst
      ? [clicked, cddPickFirst]
      : [cddPickFirst, clicked];
    compareStart = s;
    compareEnd   = e;
    cddPickFirst = null;
    updateCddDescriptions();
  }
  renderCddCalendars();
}

// ── Data table ────────────────────────────────────────────────────────────────

function initTable(data) {
  _dtData = data;
  _dtPage = 0;
  renderTable();
}

function initTableEvents() {
  const scrollEl = document.getElementById('dt-scroll');
  const tipEl    = document.getElementById('chart-tooltip');
  scrollEl.addEventListener('mousemove', function(e) {
    const showTip = (text) => {
      tipEl.innerHTML = `<span style="font-family:'Open Sans',sans-serif;font-size:14px;font-weight:600;color:white;white-space:nowrap;">${text}</span>`;
      tipEl.style.display = 'block';
      let x = e.clientX + 14, y = e.clientY - 10;
      if (x + tipEl.offsetWidth  > window.innerWidth  - 8) x = e.clientX - tipEl.offsetWidth  - 14;
      if (y + tipEl.offsetHeight > window.innerHeight - 8) y = e.clientY - tipEl.offsetHeight + 10;
      tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    };

    // First column (compare mode): show name only, no dates, only when truncated
    const tipTrigger = e.target.closest('.dt-row-tip-trigger');
    if (tipTrigger) {
      if (tipTrigger.scrollWidth > tipTrigger.offsetWidth) showTip(tipTrigger.dataset.tipName);
      else tipEl.style.display = 'none';
      return;
    }

    // Text cells: show full text only when truncated
    const txtDiv = e.target.closest('[data-txt-row]');
    if (txtDiv) {
      if (txtDiv.scrollWidth > txtDiv.offsetWidth) showTip(txtDiv.textContent.trim());
      else tipEl.style.display = 'none';
      return;
    }

    tipEl.style.display = 'none';
  });
  scrollEl.addEventListener('mouseleave', () => tipEl.style.display = 'none');

  // ── First column resize ───────────────────────────────────────────────────
  let _resizing = false, _resizeStartX = 0, _resizeStartW = 0;

  document.addEventListener('mousedown', function(e) {
    if (!e.target.classList.contains('dt-col-resize')) return;
    _resizing     = true;
    _resizeStartX = e.clientX;
    _resizeStartW = _dtFixedWidth;
    e.target.classList.add('active');
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!_resizing) return;
    _dtFixedWidth = Math.max(120, _resizeStartW + (e.clientX - _resizeStartX));
    document.querySelectorAll('.dt-fixed').forEach(el => {
      el.style.width    = _dtFixedWidth + 'px';
      el.style.minWidth = _dtFixedWidth + 'px';
    });
  });

  document.addEventListener('mouseup', function() {
    if (!_resizing) return;
    _resizing = false;
    document.querySelectorAll('.dt-col-resize').forEach(el => el.classList.remove('active'));
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
  });

}

function renderTable() {
  const activeCols = DT_COLS;
  const start = _dtPage * DT_PER_PAGE;
  const end   = Math.min(start + DT_PER_PAGE, _dtData.length);
  const page  = _dtData.slice(start, end);

  // Totals row
  const n = _dtData.length;
  const tot = {
    group:'', station:'', stationGroup:'', stopType:'', location:'',
    productGroup:'', product:'', productCode:'', shift:'', operator:'',
    mainCount:      _dtData.reduce((s,d) => s + d.mainCount,      0),
    cmpCount:       _dtData.reduce((s,d) => s + d.cmpCount,       0),
    notes:          _dtData.reduce((s,d) => s + d.notes,          0),
    cmpNotes:       _dtData.reduce((s,d) => s + d.cmpNotes,       0),
    loss:           _dtData.reduce((s,d) => s + d.loss,           0),
    cmpLoss:        _dtData.reduce((s,d) => s + d.cmpLoss,        0),
    mainDur:        _dtData.reduce((s,d) => s + d.mainDur,        0),
    cmpDur:         _dtData.reduce((s,d) => s + d.cmpDur,         0),
    mainAvg:        Math.round(_dtData.reduce((s,d) => s + d.mainAvg, 0) / n),
    cmpAvg:         Math.round(_dtData.reduce((s,d) => s + d.cmpAvg,  0) / n),
    durOee:         _dtData.reduce((s,d) => s + d.durOee,         0),
    cmpDurOee:      _dtData.reduce((s,d) => s + d.cmpDurOee,      0),
    plannedTime:    _dtData.reduce((s,d) => s + d.plannedTime,    0),
    cmpPlannedTime: _dtData.reduce((s,d) => s + d.cmpPlannedTime, 0),
    mainManhours:   _dtData.reduce((s,d) => s + (d.mainManhours || 0), 0),
    cmpManhours:    _dtData.reduce((s,d) => s + (d.cmpManhours  || 0), 0),
    mainPct:        Math.round(_dtData.reduce((s,d) => s + d.mainPct, 0) / n),
    cmpPct:         Math.round(_dtData.reduce((s,d) => s + d.cmpPct,  0) / n),
  };

  const cellVal = (d, col) => {
    switch(col.key) {
      case 'group': return d.group; case 'station': return d.station;
      case 'stationGroup': return d.stationGroup; case 'stopType': return d.stopType;
      case 'location': return d.location; case 'productGroup': return d.productGroup;
      case 'product': return d.product; case 'productCode': return d.productCode;
      case 'shift': return d.shift; case 'operator': return d.operator;
      case 'operatorRole': return d.operatorRole;
      case 'operatorGroupName': return d.operatorGroupName;
      case 'count': return d.mainCount; case 'notes': return d.notes;
      case 'loss': return d.loss; case 'dur': return d.mainDur;
      case 'avg': return d.mainAvg; case 'durOee': return d.durOee;
      case 'plannedTime': return d.plannedTime; case 'pct': return d.mainPct;
      case 'manhours': return d.mainManhours;
      default: return null;
    }
  };

  const cellCmpVal = (d, col) => {
    switch(col.key) {
      // Text columns that may differ between periods
      case 'station': return d.cmpStation; case 'stationGroup': return d.cmpStationGroup;
      case 'location': return d.cmpLocation; case 'productGroup': return d.cmpProductGroup;
      case 'product': return d.cmpProduct; case 'productCode': return d.cmpProductCode;
      case 'shift': return d.cmpShift; case 'operator': return d.cmpOperator;
      case 'operatorRole': return d.cmpOperatorRole;
      case 'operatorGroupName': return d.cmpOperatorGroupName;
      // Numeric columns
      case 'count': return d.cmpCount; case 'notes': return d.cmpNotes;
      case 'loss': return d.cmpLoss; case 'dur': return d.cmpDur;
      case 'avg': return d.cmpAvg; case 'durOee': return d.cmpDurOee;
      case 'plannedTime': return d.cmpPlannedTime; case 'pct': return d.cmpPct;
      case 'manhours': return d.cmpManhours;
      default: return null; // stop group, stop type — fixed by definition
    }
  };

  const DASH = `<span style="color:#bdbdbd;">—</span>`;
  const fmtCell = (val, col, isTotal) => {
    if (val === null || val === undefined) return isTotal ? '' : DASH;
    if (val === '' && isTotal) return '';
    if (val === '') return DASH;
    const unit = col.unit || '';
    let txt = `${val}${unit}`;
    if (col.hasNote && val > 0) txt += `&nbsp;${ICON_OPEN}`;
    return txt;
  };

  // Delta row for numeric cells: red/green/grey with same logic as tooltip
  const fmtDelta = (mainVal, cmpVal, col, hasCmpData) => {
    if (mainVal === null || mainVal === undefined || typeof mainVal !== 'number') return '';
    const eff  = hasCmpData ? (cmpVal || 0) : mainVal; // force 0 diff when no compare data
    const diff = mainVal - eff;
    const pct  = eff !== 0 ? Math.abs(Math.round(diff / eff * 100)) : 0;
    const sign  = diff >= 0 ? '+' : '−';
    const arrow = diff > 0 ? '↑' : (diff < 0 ? '↓' : '');
    const tri  = diff > 0 ? '\u25b4' : (diff < 0 ? '\u25be' : '');
    const clr  = col.neutral ? '#9e9e9e' : (diff > 0 ? '#f44336' : (diff < 0 ? '#4caf50' : '#9e9e9e'));
    return `<div style="font-family:'Roboto Mono',monospace;font-size:14px;line-height:20px;color:${clr};white-space:nowrap;">${sign}${Math.abs(diff)}${col.unit||''} (${tri}${pct}%)</div>`;
  };

  // Header
  let headHtml = `<tr style="height:32px;">`;
  headHtml += `<th class="dt-fixed" style="width:${_dtFixedWidth}px;min-width:${_dtFixedWidth}px;text-align:left;padding:0 12px;font-family:'Open Sans',sans-serif;font-size:13px;font-weight:600;color:#424242;position:sticky;left:0;overflow:visible;">
    <div class="dt-th-inner">${ICON_Y_INLINE}&nbsp;${_dtColLabel}</div>
    <div class="dt-col-resize"></div></th>`;
  activeCols.forEach(col => {
    const inner = `<div class="dt-th-inner ${col.align === 'right' ? 'right' : ''}">${col.iconY ? ICON_Y_INLINE+'&nbsp;' : ''}${col.label}</div>`;
    const wStyle = col.mono ? `white-space:nowrap;` : `width:${col.width}px;min-width:${col.width}px;`;
    headHtml += `<th style="${wStyle}text-align:${col.align};font-family:'Open Sans',sans-serif;font-size:12px;font-weight:600;color:#424242;">${inner}</th>`;
  });
  headHtml += `</tr>`;
  document.getElementById('dt-head').innerHTML = headHtml;

  // Body rows
  const compareOn   = _appliedCompareOn;
  const mainDateStr = compareOn ? fmtDMY(rangeStart) + ' \u2013 ' + fmtDMY(rangeEnd) : '';
  const cmpDateStr  = compareOn ? fmtDMY(compareStart || rangeStart) + ' \u2013 ' + fmtDMY(compareEnd || rangeEnd) : '';

  // Single-value cell for options 2 & 3 (compare-period row)
  const singleCell = (val, col, bold) => {
    const html = fmtCell(val, col, false);
    const ff   = col.mono ? "'Roboto Mono',monospace" : "'Open Sans',sans-serif";
    const fw   = bold ? 'font-weight:600;' : '';
    return `<td style="font-family:${ff};font-size:14px;${fw}color:#212121;text-align:${col.align};vertical-align:middle;padding:6px 16px 6px 8px;"><div data-txt-row="cmp" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${html}</div></td>`;
  };

  // Main-period cell with delta below (options 2 & 3)
  const singleCellWithDelta = (mainVal, cmpVal, col, hasCmpData, bold) => {
    const mainHtml  = fmtCell(mainVal, col, false);
    const deltaHtml = fmtDelta(mainVal, cmpVal, col, hasCmpData);
    const content   = deltaHtml
      ? `<div data-txt-row="main" style="line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${mainHtml}</div>${deltaHtml}`
      : `<div data-txt-row="main" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${mainHtml}</div>`;
    const ff  = col.mono ? "'Roboto Mono',monospace" : "'Open Sans',sans-serif";
    const fw  = bold ? 'font-weight:600;' : '';
    return `<td style="font-family:${ff};font-size:14px;${fw}color:#212121;text-align:${col.align};vertical-align:middle;padding:6px 16px 6px 8px;">${content}</td>`;
  };

  // Compare-period value, falling back to main for fixed columns (group, stopType, …)
  const cmpOrMain = (d, col) => { const v = cellCmpVal(d, col); return (v !== null && v !== undefined) ? v : cellVal(d, col); };

  // Reusable: stacked-compare cell (option 1)
  const stackedCell = (d, col, hasCmpData) => {
    const mainVal  = cellVal(d, col);
    const mainHtml = fmtCell(mainVal, col, false);
    const ff = col.mono ? "'Roboto Mono',monospace" : "'Open Sans',sans-serif";
    let cellContent;
    if (compareOn) {
      const cmpVal  = cellCmpVal(d, col);
      const hasCmp  = cmpVal !== null && cmpVal !== undefined;
      const cmpHtml = hasCmp ? fmtCell(cmpVal, col, false) : '';
      if (col.mono && hasCmp) {
        // Numeric: main 14/20 #212121 · compare 14/20 #707070 · delta 14/20 colored
        cellContent = `<div style="font-size:14px;line-height:20px;color:#212121;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${mainHtml}</div>`
                    + `<div style="font-size:14px;line-height:20px;color:#707070;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cmpHtml}</div>`
                    + fmtDelta(mainVal, cmpVal, col, hasCmpData);
      } else {
        // Text: main 14/20 #212121 · compare 12/16 #707070
        const maxW = `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:${col.width - 24}px;`;
        cellContent = (hasCmp && cmpHtml !== '')
          ? `<div data-txt-row="main" style="${maxW}font-size:14px;line-height:20px;color:#212121;">${mainHtml}</div>`
          + `<div data-txt-row="cmp"  style="${maxW}font-size:12px;line-height:16px;color:#707070;">${cmpHtml}</div>`
          : `<div style="${maxW}font-size:14px;line-height:20px;color:#212121;">${mainHtml}</div>`;
      }
    } else {
      cellContent = `<div style="font-size:14px;line-height:20px;color:#212121;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${mainHtml}</div>`;
    }
    const vAlign = compareOn ? 'vertical-align:top;' : 'vertical-align:middle;';
    const cmpValForTip = compareOn && col.mono ? cellCmpVal(d, col) : null;
    const tipAttrs = (cmpValForTip !== null && cmpValForTip !== undefined && mainVal !== null)
      ? ` data-main="${mainVal}" data-cmp="${cmpValForTip}" data-unit="${col.unit || ''}"${col.neutral ? ' data-neutral="true"' : ''}`
      : '';
    const wStyle = col.mono ? 'white-space:nowrap;' : `width:${col.width}px;min-width:${col.width}px;`;
    return `<td${tipAttrs} style="font-family:${ff};font-size:14px;color:#212121;text-align:${col.align};${vAlign}${wStyle}padding:4px 16px 4px 8px;">${cellContent}</td>`;
  };

  const fixedBase = `font-family:'Open Sans',sans-serif;font-size:14px;`;

  let bodyHtml = '';
  page.forEach((d, i) => {
    const rowClass   = (start + i) % 2 === 0 ? 'dt-row-even' : 'dt-row-odd';
    const hasCmpData = d.cmpCount > 0 || d.cmpDur > 0;

    // ── Single row, first cell stacks name+dates ──
    const rowH = compareOn ? 'height:68px;' : 'height:48px;';
    bodyHtml += `<tr class="${rowClass}" style="${rowH}">`;
    if (compareOn) {
      bodyHtml += `<td class="dt-fixed" style="${fixedBase}color:#212121;vertical-align:top;padding:4px 16px;">
        <div class="dt-row-tip-trigger" data-tip-dates="${mainDateStr}" data-tip-name="${d.name}" data-tip-cmp="false" style="font-size:14px;font-weight:600;line-height:20px;color:#212121;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.name} (${mainDateStr})</div>
        <div class="dt-row-tip-trigger" data-tip-dates="${cmpDateStr}" data-tip-name="${d.cmpName || d.name}" data-tip-cmp="true" style="font-size:12px;font-weight:400;line-height:16px;color:#707070;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="#9e9e9e" style="flex-shrink:0;"><path d="M9 14H2V16H9V19L13 15L9 11V14M15 13V10H22V8H15V5L11 9L15 13Z"/></svg><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.cmpName || d.name} (${cmpDateStr})</span></div>
      </td>`;
    } else {
      bodyHtml += `<td class="dt-fixed" style="${fixedBase}font-weight:600;color:#212121;vertical-align:middle;padding:4px 16px;"><div data-txt-row="main" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.name}</div></td>`;
    }
    activeCols.forEach(col => { bodyHtml += stackedCell(d, col, hasCmpData); });
    bodyHtml += `</tr>`;
  });

  // Total row
  const totHasCmpData = tot.cmpCount > 0 || tot.cmpDur > 0;

  const totH = compareOn ? 'height:68px;' : 'height:40px;';
  bodyHtml += `<tr class="dt-row-total" style="${totH}">`;
  if (compareOn) {
    bodyHtml += `<td class="dt-fixed" style="${fixedBase}color:#212121;vertical-align:top;padding:4px 16px;">
      <div class="dt-row-tip-trigger" data-tip-dates="${mainDateStr}" data-tip-name="Total" data-tip-cmp="false" style="font-size:14px;font-weight:600;line-height:20px;color:#212121;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Total (${mainDateStr})</div>
      <div class="dt-row-tip-trigger" data-tip-dates="${cmpDateStr}" data-tip-name="Total" data-tip-cmp="true" style="font-size:12px;font-weight:400;line-height:16px;color:#707070;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="#9e9e9e" style="flex-shrink:0;"><path d="M9 14H2V16H9V19L13 15L9 11V14M15 13V10H22V8H15V5L11 9L15 13Z"/></svg><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Total (${cmpDateStr})</span></div>
    </td>`;
  } else {
    bodyHtml += `<td class="dt-fixed" style="${fixedBase}font-weight:600;color:#212121;vertical-align:middle;padding:4px 16px;"><div data-txt-row="main" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Total</div></td>`;
  }
  activeCols.forEach(col => {
    const mainVal  = cellVal(tot, col);
    const mainHtml = fmtCell(mainVal, col, true);
    const ff = col.mono ? "'Roboto Mono',monospace" : "'Open Sans',sans-serif";
    let cellContent;
    if (compareOn && col.mono) {
      const cmpVal  = cellCmpVal(tot, col);
      const cmpHtml = cmpVal !== null && cmpVal !== undefined ? fmtCell(cmpVal, col, true) : '';
      if (cmpHtml) {
        cellContent = `<div style="font-size:14px;line-height:20px;color:#212121;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${mainHtml}</div>`
                    + `<div style="font-size:14px;line-height:20px;color:#707070;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cmpHtml}</div>`
                    + fmtDelta(mainVal, cmpVal, col, totHasCmpData);
      } else {
        cellContent = `<div style="font-size:14px;line-height:20px;color:#212121;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${mainHtml}</div>`;
      }
    } else if (compareOn) {
      const maxW = `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
      const cmpVal  = cellCmpVal(tot, col);
      const cmpHtml = cmpVal !== null && cmpVal !== undefined ? fmtCell(cmpVal, col, true) : '';
      cellContent = `<div style="${maxW}font-size:14px;line-height:20px;color:#212121;">${mainHtml}</div>`
                  + (cmpHtml ? `<div style="${maxW}font-size:12px;line-height:16px;color:#707070;">${cmpHtml}</div>` : '');
    } else {
      cellContent = `<div style="font-size:14px;line-height:20px;color:#212121;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${mainHtml}</div>`;
    }
    const vAlign = compareOn ? 'vertical-align:top;' : 'vertical-align:middle;';
    const wStyleTot = col.mono ? 'white-space:nowrap;' : `width:${col.width}px;min-width:${col.width}px;`;
    const cmpValTot = compareOn && col.mono ? cellCmpVal(tot, col) : null;
    const tipAttrsTot = (cmpValTot !== null && cmpValTot !== undefined && mainVal !== null)
      ? ` data-main="${mainVal}" data-cmp="${cmpValTot}" data-unit="${col.unit || ''}"${col.neutral ? ' data-neutral="true"' : ''}`
      : '';
    bodyHtml += `<td${tipAttrsTot} style="font-family:${ff};font-size:14px;font-weight:600;color:#212121;text-align:${col.align};${vAlign}${wStyleTot}padding:4px 16px 4px 8px;">${cellContent}</td>`;
  });
  bodyHtml += `</tr>`;

  document.getElementById('dt-body').innerHTML = bodyHtml;

  // Pagination
  const total = _dtData.length;
  document.getElementById('dt-page-info').textContent = `${start + 1}–${end} / ${total}`;
  document.getElementById('dt-prev').disabled = _dtPage === 0;
  document.getElementById('dt-next').disabled = end >= total;
}

function dtPrev() { if (_dtPage > 0) { _dtPage--; renderTable(); } }
function dtNext() { if ((_dtPage + 1) * DT_PER_PAGE < _dtData.length) { _dtPage++; renderTable(); } }

// ── Chart ─────────────────────────────────────────────────────────────────────

function initChart() {
  _chartBaseData = STOP_REASONS_DATA.map(d => ({...d})); // fresh copy from data.js
  drawChartWith(_chartBaseData);
}

// Renders the D3 bar chart. Handles both flat bars (Stop reasons) and
// stacked bars (all other axes where items have a .segments array).
function drawChartWith(items) {
  // Build a color map: group name → hex. Falls back to CHART_PALETTE for unknown groups.
  let uniqueGroups;
  const isStacked = items.length > 0 && Array.isArray(items[0].segments);
  if (isStacked) {
    const allGroups = new Set();
    items.forEach(d => d.segments.forEach(s => allGroups.add(s.group)));
    uniqueGroups = [...allGroups];
  } else {
    uniqueGroups = [...new Set(items.map(d => d.group))];
  }
  const colorMap = Object.fromEntries(
    uniqueGroups.map((g, i) => [g, STOP_GROUP_COLORS[g] || CHART_PALETTE[i % CHART_PALETTE.length]])
  );

  // Sort descending by duration for categorical axes; keep chronological for time axes
  if (!TIME_AXES.has(currentXAxis)) items.sort((a, b) => b.mainDur - a.mainDur);
  initTable(items);

  // Legend
  const legendEl = document.getElementById('chart-legend');
  legendEl.innerHTML = '';
  uniqueGroups.forEach(g => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:6px;';
    item.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${colorMap[g]};flex-shrink:0;"></span><span style="font-family:Inter,sans-serif;font-size:12px;color:#424242;">${g}</span>`;
    legendEl.appendChild(item);
  });

  // Dimensions
  const container = document.getElementById('chart-container');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const margin = { top: 16, right: currentY2 ? 68 : 24, bottom: 88, left: 68 };
  const width  = W - margin.left - margin.right;
  const height = H - margin.top  - margin.bottom;

  d3.select('#chart-container').selectAll('svg').remove();
  const svg   = d3.select('#chart-container').append('svg').attr('width', W).attr('height', H);
  const chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const x0 = d3.scaleBand().domain(items.map(d => d.name)).range([0, width]).paddingInner(0.28).paddingOuter(0.05);
  const x1 = d3.scaleBand().domain(['main']).range([0, x0.bandwidth()]).padding(0.06);
  const yMax = d3.max(items, d => Math.max(d.mainDur, d.cmpDur)) * 1.15;
  const y    = d3.scaleLinear().domain([0, yMax]).nice().range([height, 0]);

  // Grid lines
  chart.append('g')
    .call(d3.axisLeft(y).tickSize(-width).tickFormat(''))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('line').style('stroke', '#eeeeee'));

  // One <g> per item, positioned by x0
  const barGroups = chart.selectAll('.bar-group')
    .data(items).join('g')
    .attr('class', 'bar-group')
    .attr('transform', d => `translate(${x0(d.name)},0)`);

  // Column hover background — full step width so no gaps between hover zones
  const colBgOffset = -x0.step() * x0.paddingInner() / 2;
  barGroups.append('rect').attr('class', 'col-bg')
    .attr('x', colBgOffset).attr('y', 0)
    .attr('width', x0.step()).attr('height', height)
    .attr('fill', 'transparent');

  // ── Bar rendering: stacked (aggregated axes) vs flat (Stop reasons) ─────────
  if (isStacked) {
    barGroups.each(function(d) {
      const g = d3.select(this);
      // Main stack — draw segments bottom-to-top
      let accMain = 0;
      d.segments.forEach((seg, si) => {
        const segH = Math.max(0, y(accMain) - y(accMain + seg.mainDur));
        g.append('rect').attr('class', 'seg-main')
          .attr('data-group', seg.group)
          .attr('data-name', seg.name)
          .attr('x', x1('main')).attr('y', y(accMain + seg.mainDur))
          .attr('width', x1.bandwidth()).attr('height', segH)
          .attr('fill', colorMap[seg.group] || '#bbb')
          .attr('rx', si === d.segments.length - 1 ? 2 : 0);
        accMain += seg.mainDur;
      });
      // Cmp stack — initially hidden (width 0), animated in by updateChartCompare
      let accCmp = 0;
      d.segments.forEach((seg, si) => {
        const segH = Math.max(0, y(accCmp) - y(accCmp + seg.cmpDur));
        g.append('rect').attr('class', 'seg-cmp')
          .attr('data-group', seg.group)
          .attr('data-name', seg.name)
          .attr('x', x1('main')).attr('y', y(accCmp + seg.cmpDur))
          .attr('width', 0).attr('height', segH)
          .attr('fill', colorMap[seg.group] || '#bbb').attr('opacity', 0.4)
          .attr('rx', si === d.segments.length - 1 ? 2 : 0);
        accCmp += seg.cmpDur;
      });
    });
  } else {
    // Flat bars — one bar per stop reason, coloured by its group.
    // If mainDur=0 (compare-only) or cmpDur=0 (main-only), a 3 px placeholder
    // is rendered at the baseline; opacity is managed by updateChartCompare.
    barGroups.append('rect').attr('class', 'bar-main')
      .attr('x', x1('main'))
      .attr('y',      d => d.mainDur > 0 ? y(d.mainDur)          : height - 3)
      .attr('width',  x1.bandwidth())
      .attr('height', d => d.mainDur > 0 ? height - y(d.mainDur) : 3)
      .attr('fill',   d => colorMap[d.group]).attr('rx', 2);

    barGroups.append('rect').attr('class', 'bar-cmp')
      .attr('x', x1('main'))
      .attr('y',      d => d.cmpDur > 0 ? y(d.cmpDur)           : height - 3)
      .attr('width',  0)
      .attr('height', d => d.cmpDur > 0 ? height - y(d.cmpDur)  : 3)
      .attr('fill',   d => colorMap[d.group]).attr('opacity', 0.4).attr('rx', 2);
  }

  // X axis
  const xAxisG = chart.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x0).tickSize(0));
  xAxisG.select('.domain').style('stroke', '#e0e0e0');
  xAxisG.selectAll('text')
    .style('font-family', 'Inter, sans-serif').style('font-size', '11px').style('fill', '#616161')
    .attr('transform', 'rotate(-38)').attr('text-anchor', 'end').attr('dx', '-0.4em').attr('dy', '0.25em');

  // Y axis
  const yAxisG = chart.append('g').call(d3.axisLeft(y).ticks(6).tickFormat(d => d + ' min').tickSize(0));
  yAxisG.select('.domain').remove();
  yAxisG.selectAll('text').style('font-family', 'Inter, sans-serif').style('font-size', '11px').style('fill', '#616161');

  // Y axis label
  svg.append('text')
    .attr('transform', 'rotate(-90)').attr('x', -(margin.top + height / 2)).attr('y', 14)
    .attr('text-anchor', 'middle').style('font-family', 'Inter, sans-serif').style('font-size', '11px').style('fill', '#9e9e9e')
    .text('Duration (min)');

  // ── 2nd Y-axis (right axis + curve) ─────────────────────────────────────────
  if (currentY2 && Y2_METRICS[currentY2]) {
    const m2  = Y2_METRICS[currentY2];

    const y2Max = d3.max(items, d => m2.main(d)) * 1.2;
    const y2   = d3.scaleLinear().domain([0, y2Max]).nice().range([height, 0]);

    const y2AxisG = chart.append('g').attr('transform', `translate(${width},0)`)
      .call(d3.axisRight(y2).ticks(6).tickFormat(d => d + m2.unit).tickSize(0));
    y2AxisG.select('.domain').remove();
    y2AxisG.selectAll('text').style('font-family','Inter,sans-serif').style('font-size','11px').style('fill','#616161');

    svg.append('text').attr('transform','rotate(-90)').attr('x', -(margin.top + height/2)).attr('y', W - 12)
      .attr('text-anchor','middle').style('font-family','Inter,sans-serif').style('font-size','11px').style('fill','#9e9e9e')
      .text(currentY2);

    const cx = d => x0(d.name) + x0.bandwidth() / 2;
    const lineMain = d3.line().x(cx).y(d => y2(m2.main(d))).curve(d3.curveMonotoneX);

    chart.append('path').attr('class','line-main').datum(items)
      .attr('fill','none').attr('stroke','#111').attr('stroke-width',2).attr('d', lineMain);
  }

  // ── Compare toggle handler (called by applyDatePicker / removeCompare) ───────
  updateChartCompare = function(isOn) {
    renderTable();
    const t = svg.transition().duration(320).ease(d3.easeCubicOut);
    x1.domain(isOn ? ['main', 'cmp'] : ['main']);

    // Flat main bars: dim or hide depending on whether the item has matching data
    chart.selectAll('.bar-main').transition(t)
      .attr('x', x1('main')).attr('width', x1.bandwidth())
      .attr('opacity', d => {
        if (!isOn) return d.mainDur > 0 ? 1 : 0;   // hide compare-only when off
        if (d.mainDur === 0) return 0.2;             // compare-only: faint placeholder
        if (d.cmpDur  === 0) return 0.55;            // main-only: dimmed bar
        return 1;
      });
    // Stacked segment main bars always stay at full opacity
    chart.selectAll('.seg-main').transition(t).attr('x', x1('main')).attr('width', x1.bandwidth());

    // Flat compare bars: placeholder opacity for main-only rows
    chart.selectAll('.bar-cmp').transition(t)
      .attr('x', isOn ? x1('cmp') : x1('main'))
      .attr('width', isOn ? x1.bandwidth() : 0)
      .attr('opacity', d => (isOn && d.cmpDur === 0) ? 0.2 : 0.4);
    chart.selectAll('.seg-cmp').transition(t)
      .attr('x', isOn ? x1('cmp') : x1('main'))
      .attr('width', isOn ? x1.bandwidth() : 0);
  };

  // ── Chart tooltip ─────────────────────────────────────────────────────────
  const tooltipEl = document.getElementById('chart-tooltip');

  const XAXIS_SINGULAR = {
    'Stop reasons':'Stop reason', 'Stop groups':'Stop group',
    'Machine locations':'Machine location', 'Stations':'Station',
    'Station groups':'Station group', 'Factories':'Factory',
    'Operators':'Operator', 'Products':'Product',
    'Product groups':'Product group', 'Orders':'Order', 'Shifts':'Shift',
  };
  const singularXLabel = (label) => XAXIS_SINGULAR[label] || label;

  // ── Tooltip helpers (Figma spec) ──────────────────────────────────────────
  // Overline: 10px / 600 / white / uppercase / ls:0.8px
  const _ol = (t) =>
    `<span style="font-family:'Open Sans',sans-serif;font-size:10px;font-weight:600;color:white;letter-spacing:0.8px;text-transform:uppercase;line-height:16px;white-space:nowrap;">${t}</span>`;

  // Caption label: same but #ccc (detail row labels)
  const lbl = (text) =>
    `<span style="font-family:'Open Sans',sans-serif;font-size:10px;font-weight:600;color:#cccccc;letter-spacing:0.8px;text-transform:uppercase;white-space:nowrap;line-height:16px;">${text}:&nbsp;</span>`;

  const tipIcon = (svgHtml) => svgHtml
    ? `<span style="display:inline-flex;align-items:center;flex-shrink:0;margin-right:6px;">${svgHtml}</span>`
    : `<span style="width:18px;flex-shrink:0;display:inline-block;"></span>`;

  // Single value row (no delta)
  const tipRowSimple = (iconSrc, label, value) =>
    `<div style="display:flex;align-items:center;line-height:16px;">${tipIcon(iconSrc)}${lbl(label)}<span style="font-family:'Open Sans',sans-serif;font-size:12px;font-weight:400;color:white;">${value}</span></div>`;

  // Dual value row with coloured delta (Figma: ▴/▾, #f44336/#2ecc71)
  const tipRowDelta = (iconSrc, label, main, cmp, unit, neutral = false) => {
    const diff = main - cmp;
    const pct  = cmp !== 0 ? Math.abs(Math.round(diff / cmp * 100)) : 0;
    const sign = diff > 0 ? '+' : (diff < 0 ? '\u2212' : '');
    const tri  = diff > 0 ? '\u25b4' : (diff < 0 ? '\u25be' : '');
    const clr  = neutral ? '#cccccc' : (diff > 0 ? '#f44336' : (diff < 0 ? '#2ecc71' : '#cccccc'));
    const deltaStr = diff !== 0
      ? `<span style="font-family:'Open Sans',sans-serif;font-size:12px;color:${clr};white-space:nowrap;">&nbsp;${sign}${Math.abs(diff)}${unit} ( ${tri}${pct}%)</span>`
      : `<span style="font-family:'Open Sans',sans-serif;font-size:12px;color:#cccccc;white-space:nowrap;">&nbsp;+0${unit} (0%)</span>`;
    return `<div style="display:flex;align-items:center;line-height:16px;">${tipIcon(iconSrc)}${lbl(label)}<span style="font-family:'Open Sans',sans-serif;font-size:12px;font-weight:400;color:white;">${main}${unit}</span>${deltaStr}</div>`;
  };

  // Detail rows wrapper (gap:2px between rows)
  const tipDetails = (rowsHtml) =>
    `<div style="display:flex;flex-direction:column;gap:2px;">${rowsHtml}</div>`;

  // X-axis heading + name title (replaces tipGroupHeader)
  const tipHeading = (iconSvg, xLabel, name) =>
    `<div style="display:flex;align-items:center;gap:4px;">${tipIcon(iconSvg)}${_ol(xLabel)}</div>`
    + `<div style="font-family:'Open Sans',sans-serif;font-size:16px;font-weight:600;color:white;line-height:24px;margin-bottom:4px;">${name}</div>`;

  function moveTooltip(event) {
    const tw = tooltipEl.offsetWidth, th = tooltipEl.offsetHeight;
    let tx = event.clientX + 14, ty = event.clientY - 10;
    if (tx + tw > window.innerWidth  - 8) tx = event.clientX - tw - 14;
    if (ty + th > window.innerHeight - 8) ty = event.clientY - th + 10;
    tooltipEl.style.left = tx + 'px'; tooltipEl.style.top = ty + 'px';
  }

  // Column background hover → delta when compare on, simple when compare off
  function showTooltipDelta(event, d) {
    if (!_appliedCompareOn) {
      tooltipEl.innerHTML = tipHeading(ICON_X_URL, singularXLabel(currentXAxis), d.name) +
        tipDetails(
          tipRowSimple(ICON_Y_URL, 'Duration',            d.mainDur   + ' min') +
          tipRowSimple(null,       'Average Duration',    d.mainAvg   + ' min') +
          tipRowSimple(null,       'Count',               '' + d.mainCount) +
          tipRowSimple(null,       'Notes Count',         '' + d.notes) +
          tipRowSimple(null,       '% of Planned Time',   d.mainPct   + '%')
        );
      tooltipEl.style.display = 'block';
      moveTooltip(event);
      return;
    }
    const cmpS = compareStart || rangeStart;
    const cmpE = compareEnd   || rangeEnd;
    // Two dates inline with compare-arrows icon between them
    const CMP_ARR = `<svg width="12" height="12" viewBox="0 0 24 24" fill="white" style="flex-shrink:0;margin:0 4px;vertical-align:middle;"><path d="M9 14H2V16H9V19L13 15L9 11V14M15 13V10H22V8H15V5L11 9L15 13Z"/></svg>`;
    const hdr = `<div style="display:flex;align-items:center;padding-bottom:8px;">`
      + _ol(`${fmtDMY(rangeStart)} \u2013 ${fmtDMY(rangeEnd)}`) + CMP_ARR
      + _ol(`${fmtDMY(cmpS)} \u2013 ${fmtDMY(cmpE)}`) + `</div>`;
    // If this item has no compare data substitute main values so deltas show 0.
    const hasCmp   = d.cmpCount > 0 || d.cmpDur > 0;
    const cmpDur   = hasCmp ? d.cmpDur   : d.mainDur;
    const cmpAvg   = hasCmp ? d.cmpAvg   : d.mainAvg;
    const cmpCount = hasCmp ? d.cmpCount : d.mainCount;
    const cmpPct   = hasCmp ? d.cmpPct   : d.mainPct;
    tooltipEl.innerHTML = hdr
      + tipHeading(ICON_X_URL, singularXLabel(currentXAxis), d.name)
      + tipDetails(
          tipRowDelta (ICON_Y_URL, 'Duration',            d.mainDur,   cmpDur,   ' min') +
          tipRowDelta (null,       'Average Duration',    d.mainAvg,   cmpAvg,   ' min') +
          tipRowDelta (null,       'Count',               d.mainCount, cmpCount, ''    ) +
          tipRowDelta (null,       'Notes Count',         d.notes,     d.notes,  '',     true) +
          tipRowDelta (null,       '% of Planned Time',   d.mainPct,   cmpPct,   '%'       )
        );
    tooltipEl.style.display = 'block';
    moveTooltip(event);
  }

  // Colored dot + overline label + title
  const tipStopGroupHeading = (color, groupName, label = 'Stop Group') =>
    `<div style="display:flex;align-items:center;gap:4px;">`
    + `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>`
    + `<span style="font-family:'Open Sans',sans-serif;font-size:10px;font-weight:600;color:white;letter-spacing:0.8px;text-transform:uppercase;line-height:16px;">${label}</span>`
    + `</div>`
    + `<div style="font-family:'Open Sans',sans-serif;font-size:16px;font-weight:600;color:white;line-height:24px;">${groupName}</div>`;

  // Main (bright) bar hover → date header only when compare is on, then stop-group heading
  function showTooltipMain(event, d) {
    const hdr = _appliedCompareOn
      ? `<div style="padding-bottom:8px;">${_ol(`${fmtDMY(rangeStart)} \u2013 ${fmtDMY(rangeEnd)}`)}</div>`
      : '';
    const group = event.target.dataset.group || d.group;
    tooltipEl.innerHTML = hdr
      + tipStopGroupHeading(colorMap[group], group)
      + tipDetails(
          tipRowSimple(ICON_X_URL, 'Stop Reason', event.target.dataset.name || d.name) +
          tipRowSimple(ICON_Y_URL, 'Duration',            d.mainDur   + ' min') +
          tipRowSimple(null,       'Average Duration',    d.mainAvg   + ' min') +
          tipRowSimple(null,       'Count',               '' + d.mainCount) +
          tipRowSimple(null,       'Notes Count',         '' + d.notes) +
          tipRowSimple(null,       '% of Planned Time',   d.mainPct   + '%')
        );
    tooltipEl.style.display = 'block';
    moveTooltip(event);
  }

  // Compare (faded) bar hover → single compare date header with compare icon, same structure
  function showTooltipCmp(event, d) {
    const cmpS = compareStart || rangeStart;
    const cmpE = compareEnd   || rangeEnd;
    const CMP_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="white" style="flex-shrink:0;margin-right:4px;"><path d="M9 14H2V16H9V19L13 15L9 11V14M15 13V10H22V8H15V5L11 9L15 13Z"/></svg>`;
    const hdr = `<div style="display:flex;align-items:center;gap:4px;padding-bottom:8px;">${CMP_ICON}${_ol(`${fmtDMY(cmpS)} \u2013 ${fmtDMY(cmpE)}`)}</div>`;
    const group = event.target.dataset.group || d.group;
    tooltipEl.innerHTML = hdr
      + tipStopGroupHeading(colorMap[group], group)
      + tipDetails(
          tipRowSimple(ICON_X_URL, 'Stop Reason', event.target.dataset.name || d.name) +
          tipRowSimple(ICON_Y_URL, 'Duration',            d.cmpDur   + ' min') +
          tipRowSimple(null,       'Average Duration',    d.cmpAvg   + ' min') +
          tipRowSimple(null,       'Count',               '' + d.cmpCount) +
          tipRowSimple(null,       'Notes Count',         '' + d.notes) +
          tipRowSimple(null,       '% of Planned Time',   d.cmpPct   + '%')
        );
    tooltipEl.style.display = 'block';
    moveTooltip(event);
  }

  // ── Column hover: green background + tooltip routing ──────────────────────
  barGroups
    .on('mouseenter', function() {
      d3.select(this).select('.col-bg').attr('fill', 'rgba(46,204,113,0.08)');
    })
    .on('mouseleave', function() {
      d3.select(this).select('.col-bg').attr('fill', 'transparent');
      tooltipEl.style.display = 'none';
    })
    .on('mousemove', function(event, d) {
      const cls = event.target.getAttribute('class') || '';
      if      (cls.includes('bar-main') || cls.includes('seg-main')) showTooltipMain (event, d);
      else if (cls.includes('bar-cmp')  || cls.includes('seg-cmp'))  showTooltipCmp  (event, d);
      else                                                            showTooltipDelta(event, d);
    });
}

// ── 2nd Y-axis selection ──────────────────────────────────────────────────────

function toggleY2Dropdown(event) {
  event.stopPropagation();
  document.getElementById('y2axis-dropdown').classList.toggle('open');
}

function selectY2(option) {
  document.getElementById('y2axis-dropdown').classList.remove('open');
  const newY2 = option === '–' ? null : option;
  if (newY2 === currentY2) return;
  currentY2 = newY2;
  document.getElementById('y2axis-btn').textContent = '2nd Y-axis: ' + (currentY2 || '–') + ' ▾';
  buildY2Dropdown();
  redrawChart(currentXAxis);
}

function buildY2Dropdown() {
  const dd = document.getElementById('y2axis-dropdown');
  dd.innerHTML = '';
  ['–', ...Object.keys(Y2_METRICS)].forEach(opt => {
    const el = document.createElement('div');
    el.className = 'xaxis-opt' + (opt === (currentY2 || '–') ? ' selected' : '');
    el.textContent = opt;
    el.addEventListener('click', () => selectY2(opt));
    dd.appendChild(el);
  });
}

// ── X-axis selection ──────────────────────────────────────────────────────────

function redrawChart(xAxis) {
  currentXAxis = xAxis;
  _dtColLabel  = xAxis;
  const wasCompareOn = _appliedCompareOn;
  const items = getAxisData(xAxis, _chartBaseData);
  if (!TIME_AXES.has(xAxis)) items.sort((a, b) => b.mainDur - a.mainDur);
  // When returning to Stop reasons, refresh base data from the sorted items
  if (xAxis === 'Stop reasons') _chartBaseData = items;
  drawChartWith(items);
  // updateChartCompare is set fresh inside drawChartWith; restore compare state
  if (wasCompareOn) updateChartCompare(true);
  document.getElementById('xaxis-btn').textContent = 'X-axis: ' + xAxis + ' ▾';
}

function toggleXAxisDropdown(event) {
  event.stopPropagation();
  document.getElementById('xaxis-dropdown').classList.toggle('open');
}

function selectXAxis(option) {
  document.getElementById('xaxis-dropdown').classList.remove('open');
  if (option === currentXAxis) return;
  redrawChart(option);
  document.querySelectorAll('.xaxis-opt').forEach(el => {
    el.classList.toggle('selected', el.dataset.val === option);
  });
}

function buildXAxisDropdown() {
  const dd = document.getElementById('xaxis-dropdown');
  dd.innerHTML = '';
  XAXIS_OPTIONS.forEach(opt => {
    if (opt === '──') {
      const sep = document.createElement('div'); sep.className = 'xaxis-sep'; dd.appendChild(sep);
    } else {
      const el = document.createElement('div');
      el.className = 'xaxis-opt' + (opt === currentXAxis ? ' selected' : '');
      el.dataset.val = opt;
      el.textContent = opt;
      el.addEventListener('click', () => selectXAxis(opt));
      dd.appendChild(el);
    }
  });
}

// Close dropdowns when clicking outside them
document.addEventListener('click', () => {
  document.getElementById('xaxis-dropdown').classList.remove('open');
  document.getElementById('y2axis-dropdown').classList.remove('open');
  document.getElementById('compare-dropdown').classList.remove('open');
  ['opfilter-dropdown', 'grpfilter-dropdown', 'rolefilter-dropdown']
    .forEach(id => document.getElementById(id)?.classList.remove('open'));
});

// ── Multi-select filter chips: Operators, Operator group, Role ───────────────
// All three follow the same pattern: a Set of selected values, a dropdown
// built from a master list, and a filter pass on the base chart data when any
// selection changes. The Role chip is only "armed" (label switches from
// "All" to selected count) when at least one operator has been picked.

const filterState = {
  operators: new Set(),
  roles:     new Set(),
  // Tracks which group sections are visually collapsed in the dropdown.
  // Persisted across re-renders so checking a member doesn't re-expand all.
  _opCollapsed: new Set(),
};

// Master option lists
function getAllOperators() { return Object.keys(OPERATOR_DIRECTORY).sort(); }
function getAllGroups()    { return OPERATOR_GROUPS.slice(); }
function getAllRoles()     { return OPERATOR_ROLES.slice(); }

// Group an operator list by its directory group (Group A / Group B / Default).
function getOperatorsByGroup() {
  const grouped = new Map(); // groupName → operator[]
  OPERATOR_GROUPS.forEach(g => grouped.set(g, []));
  Object.entries(OPERATOR_DIRECTORY).forEach(([name, info]) => {
    const g = info.group || 'Default';
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g).push(name);
  });
  grouped.forEach(arr => arr.sort());
  return grouped;
}

// Group-level checkbox state derived from the canonical operators Set.
function getGroupCheckState(members) {
  const checked = members.filter(m => filterState.operators.has(m)).length;
  if (checked === 0) return 'empty';
  if (checked === members.length) return 'full';
  return 'partial';
}

// Map our logical kind names to the DOM-id prefixes used in index.html.
const FILTER_DD_ID = { operators: 'opfilter-dropdown', roles: 'rolefilter-dropdown' };

function toggleFilterDropdown(event, kind) {
  event.stopPropagation();
  const dd = document.getElementById(FILTER_DD_ID[kind]);
  if (!dd) return;
  const wasOpen = dd.classList.contains('open');
  // Close every dropdown first
  document.querySelectorAll('.filter-dropdown').forEach(el => el.classList.remove('open'));
  document.getElementById('xaxis-dropdown').classList.remove('open');
  document.getElementById('y2axis-dropdown').classList.remove('open');
  document.getElementById('compare-dropdown').classList.remove('open');
  if (!wasOpen) {
    buildFilterDropdown(kind);
    dd.classList.add('open');
  }
}

function buildFilterDropdown(kind) {
  const dd = document.getElementById(FILTER_DD_ID[kind]);
  if (!dd) return;
  dd.innerHTML = '';
  dd.onclick = e => e.stopPropagation();

  if (kind === 'operators') {
    // Two-level picker: group header row, then collapsible operator rows.
    const grouped = getOperatorsByGroup();
    grouped.forEach((members, groupName) => {
      if (members.length === 0) return;
      const state = getGroupCheckState(members);
      const collapsed = filterState._opCollapsed.has(groupName);

      // Group header row
      const header = document.createElement('div');
      header.className = 'filter-opt filter-opt-group';
      header.innerHTML = `
        <span class="filter-opt-check ${state === 'full' ? 'is-full' : state === 'partial' ? 'is-partial' : ''}"
              data-group="${groupName}"></span>
        <span class="filter-opt-label" style="font-weight:600;">${groupName}</span>
        <span class="filter-opt-caret" style="opacity:0.6;transform:${collapsed ? 'rotate(-90deg)' : 'rotate(0deg)'};transition:transform 0.15s;">▾</span>
      `;
      // Click on caret/label → toggle collapse. Click on check → toggle group.
      header.querySelector('.filter-opt-check').addEventListener('click', e => {
        e.stopPropagation();
        toggleGroupSelection(groupName, members);
      });
      header.addEventListener('click', () => toggleGroupCollapse(groupName));
      dd.appendChild(header);

      // Operator rows (rendered only when expanded)
      if (!collapsed) {
        members.forEach(name => {
          const el = document.createElement('div');
          el.className = 'filter-opt filter-opt-member' +
                         (filterState.operators.has(name) ? ' selected' : '');
          el.innerHTML = `<span class="filter-opt-check"></span><span class="filter-opt-label">${name}</span>`;
          el.addEventListener('click', () => toggleFilterValue('operators', name));
          dd.appendChild(el);
        });
      }
    });
  } else if (kind === 'roles') {
    getAllRoles().forEach(r => {
      const isDisabled = r.enterprise === true; // Enterprise-only roles greyed in Pro
      const isSelected = filterState.roles.has(r.name);
      const el = document.createElement('div');
      el.className = 'filter-opt' + (isSelected ? ' selected' : '') + (isDisabled ? ' disabled' : '');
      el.innerHTML = `<span class="filter-opt-check"></span>` +
                     `<span class="filter-opt-label">${r.name}</span>` +
                     (isDisabled ? `<span class="filter-opt-pill">ENTERPRISE</span>` : '');
      if (!isDisabled) el.addEventListener('click', () => toggleFilterValue('roles', r.name));
      dd.appendChild(el);
    });
  }
}

function toggleFilterValue(kind, value) {
  const set = filterState[kind];
  if (set.has(value)) set.delete(value); else set.add(value);
  buildFilterDropdown(kind);
  updateFilterChipLabels();
  applyOperatorFilters();
}

// Two-level helpers for the Operators picker.
function toggleGroupSelection(groupName, members) {
  const state = getGroupCheckState(members);
  if (state === 'full') {
    members.forEach(m => filterState.operators.delete(m));
  } else {
    members.forEach(m => filterState.operators.add(m));
  }
  buildFilterDropdown('operators');
  updateFilterChipLabels();
  applyOperatorFilters();
}
function toggleGroupCollapse(groupName) {
  if (filterState._opCollapsed.has(groupName)) {
    filterState._opCollapsed.delete(groupName);
  } else {
    filterState._opCollapsed.add(groupName);
  }
  buildFilterDropdown('operators');
}

function updateFilterChipLabels() {
  const opCount   = filterState.operators.size;
  const roleCount = filterState.roles.size;

  // Operators chip — also summarises by group when the whole group is selected:
  //   "Operators: Group A"        when only group A's members are selected
  //   "Operators: Group A, Mati"  when group A + individuals from elsewhere
  //   "Operators: 3 selected"     when too many to fit
  let opLabel = 'Operators: All';
  if (opCount > 0) {
    const grouped = getOperatorsByGroup();
    const summary = [];
    const accountedFor = new Set();
    grouped.forEach((members, groupName) => {
      if (members.length === 0) return;
      if (getGroupCheckState(members) === 'full') {
        summary.push(groupName);
        members.forEach(m => accountedFor.add(m));
      }
    });
    const loose = [...filterState.operators].filter(m => !accountedFor.has(m));
    summary.push(...loose);
    if (summary.length === 1) opLabel = 'Operators: ' + summary[0];
    else if (summary.length <= 2) opLabel = 'Operators: ' + summary.join(', ');
    else opLabel = `Operators: ${opCount} selected`;
  }
  document.getElementById('opfilter-label').textContent = opLabel;

  document.getElementById('rolefilter-label').textContent =
    roleCount === 0 ? 'Role: All' :
    roleCount === 1 ? 'Role: ' + [...filterState.roles][0] :
    `Role: ${roleCount} selected`;
}

// Filter STOP_REASONS_DATA by the current operator + role selections, then
// re-feed the chart + table through the normal pipeline. The two-level
// Operators picker resolves into a flat Set of operator names — selecting a
// group is just a shortcut for selecting all its members.
function applyOperatorFilters() {
  const opSel   = filterState.operators;
  const roleSel = filterState.roles;
  if (opSel.size === 0 && roleSel.size === 0) {
    _chartBaseData = STOP_REASONS_DATA.map(d => ({ ...d }));
  } else {
    _chartBaseData = STOP_REASONS_DATA.filter(d => {
      if (opSel.size) {
        const names = (d.operator || '').split(',').map(s => s.trim());
        if (![...opSel].some(n => names.includes(n))) return false;
      }
      if (roleSel.size) {
        const roles = (d.operatorRole || '').split(',').map(s => s.trim());
        if (![...roleSel].some(r => roles.includes(r))) return false;
      }
      return true;
    }).map(d => ({ ...d }));
  }
  const items = getAxisData(currentXAxis, _chartBaseData);
  drawChartWith(items);
  initTable(items);
}

// Init: ensure Role chip is hidden by default (no operators picked).
window.addEventListener('DOMContentLoaded', updateFilterChipLabels);


// ── Report switching ──────────────────────────────────────────────────────────

function switchReport(type) {
  if (type === currentReport) return;
  currentReport = type;

  document.getElementById('page-title').textContent = type === 'oee' ? 'OEE' : 'Downtime';
  document.getElementById('rnav-downtime').classList.toggle('active', type === 'downtime');
  document.getElementById('rnav-oee').classList.toggle('active', type === 'oee');
  document.getElementById('downtime-chart-section').style.display = type === 'downtime' ? '' : 'none';
  document.getElementById('downtime-table-section').style.display  = type === 'downtime' ? '' : 'none';
  document.getElementById('oee-chart-section').style.display       = type === 'oee'      ? '' : 'none';

  if (type === 'oee') drawOeeChart();
}

function drawOeeChart() {
  const container = document.getElementById('oee-chart-container');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const margin = { top: 16, right: 24, bottom: 40, left: 56 };
  const width  = W - margin.left - margin.right;
  const height = H - margin.top  - margin.bottom;

  d3.select('#oee-chart-container').selectAll('svg').remove();
  const svg   = d3.select('#oee-chart-container').append('svg').attr('width', W).attr('height', H);
  const chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([1, OEE_DATA.length]).range([0, width]);
  const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);

  // Horizontal gridlines
  chart.append('g')
    .call(d3.axisLeft(y).ticks(10).tickSize(-width).tickFormat(''))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('line').style('stroke', '#eeeeee'));

  // ── Compare visualization (drawn first, below main lines) ───────────────
  const compareOn = _appliedCompareOn;

  if (compareOn) {
    OEE_LINES.forEach(line => {
      const cmpLineGen = d3.line()
        .x(d => x(d.day))
        .y(d => y(d[line.cmpKey]))
        .curve(d3.curveMonotoneX);

      chart.append('path').datum(OEE_DATA)
        .attr('class', `oee-line-cmp line-cmp-${line.key}`)
        .attr('fill', 'none')
        .attr('stroke', line.color)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,3')
        .attr('opacity', 0.75)
        .attr('d', cmpLineGen);
    });
  }

  // ── Main solid lines ──────────────────────────────────────────────────────
  OEE_LINES.forEach(line => {
    const lineGen = d3.line()
      .x(d => x(d.day))
      .y(d => y(d[line.key]))
      .curve(d3.curveMonotoneX);

    chart.append('path').datum(OEE_DATA)
      .attr('class', `oee-line-main line-main-${line.key}`)
      .attr('fill', 'none').attr('stroke', line.color).attr('stroke-width', 2)
      .attr('d', lineGen);
  });

  // ── Compare dots ──────────────────────────────────────────────────────────
  if (compareOn) {
    OEE_LINES.forEach(line => {
      chart.selectAll(`.cmp-dot-${line.key}`).data(OEE_DATA).join('circle')
        .attr('class', `cmp-dot-${line.key}`)
        .attr('cx', d => x(d.day)).attr('cy', d => y(d[line.cmpKey]))
        .attr('r', 3.5).attr('fill', line.color).attr('opacity', 0.5)
        .attr('stroke', 'white').attr('stroke-width', 1.5);
    });
  }

  // ── Main dots ─────────────────────────────────────────────────────────────
  OEE_LINES.forEach(line => {
    chart.selectAll(`.dot-${line.key}`).data(OEE_DATA).join('circle')
      .attr('class', `dot-${line.key}`)
      .attr('cx', d => x(d.day)).attr('cy', d => y(d[line.key]))
      .attr('r', 4).attr('fill', line.color).attr('stroke', 'white').attr('stroke-width', 1.5);
  });


  // X axis
  const xAxisG = chart.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(OEE_DATA.length).tickFormat(d => d).tickSize(0));
  xAxisG.select('.domain').style('stroke', '#e0e0e0');
  xAxisG.selectAll('text').style('font-family','Inter,sans-serif').style('font-size','11px').style('fill','#616161').attr('dy','1.4em');

  // Y axis
  const yAxisG = chart.append('g')
    .call(d3.axisLeft(y).ticks(10).tickFormat(d => d + '%').tickSize(0));
  yAxisG.select('.domain').remove();
  yAxisG.selectAll('text').style('font-family','Inter,sans-serif').style('font-size','11px').style('fill','#616161');

  // ── Column background rects (visual highlight, pointer-events:none) ───────
  const gapHalf = (x(2) - x(1)) / 2;
  chart.selectAll('.oee-col-bg').data(OEE_DATA).join('rect')
    .attr('class', 'oee-col-bg')
    .attr('x', (d, i) => i === 0 ? 0 : x(d.day) - gapHalf)
    .attr('y', 0)
    .attr('width', (d, i) => {
      const left  = i === 0 ? 0 : x(d.day) - gapHalf;
      const right = i === OEE_DATA.length - 1 ? width : x(d.day) + gapHalf;
      return right - left;
    })
    .attr('height', height)
    .attr('fill', 'transparent')
    .style('pointer-events', 'none');

  // ── Tooltip helpers ───────────────────────────────────────────────────────
  const tooltipEl = document.getElementById('chart-tooltip');
  const fmtPct = v => v.toFixed(2).replace('.', ',') + '%';
  const fmtDelta = (main, cmp) => {
    const diff  = main - cmp;
    const rel   = cmp !== 0 ? (diff / cmp * 100) : 0;
    const sign  = diff >= 0 ? '+' : '';
    const color = diff >= 0 ? '#2ecc71' : '#f44336';
    const tri   = diff >= 0 ? '▴' : '▾';
    return `<span style="font-family:'Open Sans',sans-serif;color:${color};font-size:12px;font-weight:400;line-height:16px;white-space:nowrap;">${sign}${Math.round(diff)}% ( ${tri} ${Math.abs(Math.round(rel))}%)</span>`;
  };
  const icoDot = (color, dashed) => {
    if (dashed) return `<svg width="18" height="10" viewBox="0 0 18 10" style="flex-shrink:0"><line x1="0" y1="5" x2="18" y2="5" stroke="${color}" stroke-width="2" stroke-dasharray="4,3"/></svg>`;
    return color
      ? `<svg width="8" height="8" viewBox="0 0 8 8" style="flex-shrink:0"><circle cx="4" cy="4" r="4" fill="${color}"/></svg>`
      : `<svg width="8" height="8" viewBox="0 0 8 8" style="flex-shrink:0"><circle cx="4" cy="4" r="3" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/></svg>`;
  };
  const oeeDayIcon = `<svg width="12" height="12" viewBox="0 0 16 13" fill="rgba(255,255,255,0.55)" style="flex-shrink:0"><rect x="0" y="5" width="3" height="8" rx="1"/><rect x="4.5" y="2" width="3" height="11" rx="1"/><rect x="9" y="0" width="3" height="13" rx="1"/><rect x="13.5" y="4" width="2.5" height="9" rx="1"/></svg>`;

  function moveTooltip(event) {
    const tw = tooltipEl.offsetWidth, th = tooltipEl.offsetHeight;
    let tx = event.clientX + 14, ty = event.clientY - 10;
    if (tx + tw > window.innerWidth  - 8) tx = event.clientX - tw - 14;
    if (ty + th > window.innerHeight - 8) ty = event.clientY - th + 10;
    tooltipEl.style.left = tx + 'px'; tooltipEl.style.top = ty + 'px';
  }

  const tipRow = (dot, label, value, extra) =>
    `<div style="display:flex;align-items:center;gap:2px;">`
    + `<div style="display:flex;align-items:center;padding-right:4px;padding-top:2px;padding-bottom:2px;flex-shrink:0;">${dot}</div>`
    + `<span style="font-family:'Open Sans',sans-serif;font-size:10px;font-weight:600;color:#cccccc;letter-spacing:0.8px;text-transform:uppercase;line-height:16px;white-space:nowrap;">${label}:</span>`
    + `<span style="font-family:'Open Sans',sans-serif;font-size:12px;font-weight:400;color:white;line-height:16px;white-space:nowrap;">${value}</span>`
    + `${extra || ''}`
    + `</div>`;

  function showDayTooltip(event, d) {
    const date = addDays(rangeStart, d.day - 1);
    let html = '';

    if (compareOn) {
      const cmpS = compareStart || rangeStart;
      const cmpE = compareEnd   || rangeEnd;
      const olStyle = `font-family:'Open Sans',sans-serif;font-size:10px;font-weight:600;color:white;letter-spacing:0.8px;text-transform:uppercase;line-height:16px;white-space:nowrap;`;
      const CMP_ARROWS = `<svg width="12" height="12" viewBox="0 0 24 24" fill="white" style="flex-shrink:0;"><path d="M9 14H2V16H9V19L13 15L9 11V14M15 13V10H22V8H15V5L11 9L15 13Z"/></svg>`;
      html += `<div style="display:flex;align-items:center;gap:4px;padding-bottom:8px;"><span style="${olStyle}">${fmtDMY(rangeStart)} - ${fmtDMY(rangeEnd)}</span>${CMP_ARROWS}<span style="${olStyle}">${fmtDMY(cmpS)} - ${fmtDMY(cmpE)}</span></div>`;
    }

    html += `<div style="display:flex;align-items:center;gap:4px;font-family:'Open Sans',sans-serif;font-size:10px;font-weight:600;color:white;letter-spacing:0.8px;text-transform:uppercase;line-height:16px;">`
          + `<div style="display:flex;align-items:center;padding-right:4px;flex-shrink:0;">${oeeDayIcon}</div>`
          + `<span>DAY</span>`
          + `</div>`
          + `<div style="font-family:'Open Sans',sans-serif;font-size:16px;font-weight:600;color:white;line-height:24px;">${fmtDMY(date)}</div>`;

    if (compareOn) {
      // All 3 options: show metrics with delta + % change
      OEE_LINES.slice().reverse().forEach(line => {
        html += tipRow(icoDot(line.color), line.label.toUpperCase(), fmtPct(d[line.key]), fmtDelta(d[line.key], d[line.cmpKey]));
      });
    } else {
      html += tipRow(icoDot(null),      'OEE',          fmtPct(d.oee));
      html += tipRow(icoDot('#2ecc71'), 'AVAILABILITY', fmtPct(d.availability));
      html += tipRow(icoDot('#fdd835'), 'PERFORMANCE',  fmtPct(d.performance));
      html += tipRow(icoDot('#ff9800'), 'QUALITY',      fmtPct(d.quality));
    }
    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';
    moveTooltip(event);
  }

  // isCompare=true → show compare period dates + compare value
  function showMetricTooltip(event, d, line, isCompare) {
    const pStart = isCompare && compareStart ? compareStart : rangeStart;
    const pEnd   = isCompare && compareEnd   ? compareEnd   : rangeEnd;
    const value  = isCompare ? d[line.cmpKey] : d[line.key];
    const date   = addDays(pStart, d.day - 1);
    const smallLbl = (t) => `<span style="font-family:'Open Sans',sans-serif;font-size:10px;font-weight:600;color:#cccccc;letter-spacing:0.8px;text-transform:uppercase;line-height:16px;">${t}</span>`;

    const html =
      `<div style="margin-bottom:6px;white-space:nowrap;"><span style="font-family:'Open Sans',sans-serif;font-size:10px;font-weight:600;color:white;letter-spacing:0.8px;text-transform:uppercase;line-height:16px;">${fmtDMY(pStart)} \u2013 ${fmtDMY(pEnd)}</span></div>` +
      `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">${icoDot(line.color)}${smallLbl(line.label)}</div>` +
      `<div style="font-family:'Open Sans',sans-serif;font-size:16px;font-weight:600;color:white;line-height:24px;margin-bottom:4px;">${Math.round(value)}%</div>` +
      `<div style="display:flex;align-items:center;gap:6px;">${oeeDayIcon}${smallLbl('Day:')}&nbsp;<span style="font-family:'Open Sans',sans-serif;font-size:12px;font-weight:400;color:white;">${fmtDMY(date)}</span></div>`;

    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';
    moveTooltip(event);
  }

  // ── Transparent overlay for unified mouse handling ────────────────────────
  const overlay = chart.append('rect')
    .attr('width', width).attr('height', height)
    .attr('fill', 'transparent');

  let _hoveredColIdx = -1;
  let _dotHovered = false;

  overlay
    .on('mousemove', function(event) {
      const [mx, my] = d3.pointer(event);

      // Find column index
      let colIdx = -1;
      for (let i = 0; i < OEE_DATA.length; i++) {
        const cx = x(OEE_DATA[i].day);
        const left  = i === 0 ? 0 : (cx + x(OEE_DATA[i-1].day)) / 2;
        const right = i === OEE_DATA.length - 1 ? width : (cx + x(OEE_DATA[i+1].day)) / 2;
        if (mx >= left && mx <= right) { colIdx = i; break; }
      }

      // Highlight column
      if (colIdx !== _hoveredColIdx) {
        _hoveredColIdx = colIdx;
        chart.selectAll('.oee-col-bg')
          .attr('fill', (d, i) => i === colIdx ? 'rgba(46,204,113,0.08)' : 'transparent');
      }

      if (colIdx === -1) {
        tooltipEl.style.display = 'none';
        return;
      }

      const d = OEE_DATA[colIdx];

      // Option 1 / no compare: just day tooltip
      showDayTooltip(event, d);
      moveTooltip(event);
    })
    .on('mouseleave', function() {
      _hoveredColIdx = -1;
      _dotHovered = false;
      chart.selectAll('.oee-col-bg').attr('fill', 'transparent');
      tooltipEl.style.display = 'none';
    });

  // Legend
  const legendEl = document.getElementById('oee-chart-legend');
  legendEl.innerHTML = '';
  OEE_LINES.forEach(line => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:6px;';
    item.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${line.color};flex-shrink:0;"></span><span style="font-family:Inter,sans-serif;font-size:12px;color:#424242;">${line.label}</span>`;
    legendEl.appendChild(item);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

setDisplayMonths(rangeStart, rangeEnd);
selectChipByPreset('last7');
renderCalendars();
buildY2Dropdown();
initChart();
buildXAxisDropdown();
initTableEvents();
updateCddOptionStyles();   // initialise radio images to RADIO_OFF
updateCompareBtnLabel();   // initialise compare button label
updateFilterChipLabels();  // hide Role chip until an operator is picked
