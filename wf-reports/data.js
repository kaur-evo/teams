// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  data.js — Model                                                             ║
// ║  Static constants, asset URLs, mock dataset, and pure utility functions.     ║
// ║  No DOM access. No app state. Safe to read in isolation.                     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ── Calendar constants ────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DOW    = ['M','T','W','T','F','S','S'];

// ── Date-preset labels (shown on the filter-bar button) ───────────────────────

const PRESET_LABELS = {
  today: 'Today', yesterday: 'Yesterday', this_week: 'This week',
  last_week: 'Last week', last7: 'Last 7 days', this_month: 'This month',
  last_month: 'Last month', last30: 'Last 30 days', this_quarter: 'This quarter',
  last_quarter: 'Last quarter', last4quarters: 'Last 4 quarters',
  this_year: 'This year', last_year: 'Last year',
};

// ── X-axis options ────────────────────────────────────────────────────────────

const XAXIS_OPTIONS = [
  'Stop reasons', 'Stop groups', 'Machine locations', 'Stations',
  'Station groups', 'Factories', 'Operators', 'Operator group', 'Shift leaders',
  'Products', 'Product code', 'Orders', 'LOT/Batch', 'Product groups', 'Shifts',
  '──',
  'Day', 'Day of the week', 'Week', 'Month', 'Quarter', 'Year'
];
const TIME_AXES = new Set(['Day','Day of the week','Week','Month','Quarter','Year']);

// ── Operator directory (role + group lookup by name) ────────────────────────
// Mock data uses comma-separated operator name strings; this directory lets
// the role/group dimensions resolve those strings into structured values.
// Roles flagged `enterprise:true` are visually disabled in the picker
// (greyed + ENTERPRISE pill); Pro tier sees only Operator + Supervisor.

const OPERATOR_ROLES = [
  { name: 'Operator',    enterprise: false },
  { name: 'Supervisor',  enterprise: false },
  { name: 'Quality',     enterprise: true  },
  { name: 'Maintenance', enterprise: true  },
  { name: 'Other',       enterprise: true  },
];

// Operator groups. Mirrors the setup prototype (mock-data.js MOCK_TEAMS):
// two named teams (Blue / Red) plus the fallback "Operators" bucket. The
// group dimension / filter / Split-by all read from this list.
const OPERATOR_GROUPS = ['Blue Team', 'Red Team', 'Operators'];

// Static directory: every operator name appearing in mock data → its role + group.
//
// NAME SYNC: these are the SAME 8 operators as the setup prototype
// (mock-data.js MOCK_OPERATORS) — so moving from setup → reports shows familiar
// names. Short "V. Mavroeidis" form keeps the table compact; the mapping back to
// the setup full names is 1:1 by last name. Vasilis & Nikos are the two canLead
// operators (mirrors `canLead: true` in setup).
//
// `canLead`  — operator can be picked as shift leader (Settings "Allow as
//              shift leader"). Drives the Shift-leaders X-axis / split / filter.
// `hours`    — total hours this operator actually worked in the (main) period.
//              Manhours aggregations sum each DISTINCT operator's hours ONCE,
//              so a person spread across several stations is never double-counted
//              (operator-level dedup). `cmpHours` is the compare-period figure.
const OPERATOR_DIRECTORY = {
  // Blue Team
  'V. Mavroeidis':   { role: 'Supervisor',  group: 'Blue Team', canLead: true,  hours: 38, cmpHours: 40 },
  'M. Kostopoulou':  { role: 'Operator',    group: 'Blue Team', canLead: false, hours: 36, cmpHours: 38 },
  'G. Antoniou':     { role: 'Operator',    group: 'Blue Team', canLead: false, hours: 40, cmpHours: 40 },
  'P. Lambrou':      { role: 'Operator',    group: 'Blue Team', canLead: false, hours: 38, cmpHours: 36 },
  'A. Dimitriou':    { role: 'Operator',    group: 'Blue Team', canLead: false, hours: 34, cmpHours: 34 },
  // Red Team
  'N. Papadopoulos': { role: 'Supervisor',  group: 'Red Team',  canLead: true,  hours: 40, cmpHours: 38 },
  'E. Christodoulou':{ role: 'Operator',    group: 'Red Team',  canLead: false, hours: 32, cmpHours: 30 },
  'D. Ekonomou':     { role: 'Operator',    group: 'Red Team',  canLead: false, hours: 28, cmpHours: 26 },
  'K. Vlachos':      { role: 'Operator',    group: 'Red Team',  canLead: false, hours: 36, cmpHours: 38 },
  'D. Roussou':      { role: 'Operator',    group: 'Red Team',  canLead: false, hours: 30, cmpHours: 28 },
  // Operators (fallback group)
  'S. Nikolaou':     { role: 'Operator',    group: 'Operators', canLead: false, hours: 34, cmpHours: 36 },
  'S. Panagiotou':   { role: 'Operator',    group: 'Operators', canLead: false, hours: 30, cmpHours: 32 },
};

// Operators allowed to lead a shift (mirrors Settings "Allow as shift leader").
const CAN_LEAD_OPERATORS = Object.keys(OPERATOR_DIRECTORY).filter(n => OPERATOR_DIRECTORY[n].canLead);

// Per-row shift leader: which can-lead operator was leading the production that
// this row's stop occurred under, for the main and compare periods. Lets us
// aggregate / split by the leading supervisor (data attributes to the leader).
function deriveLeader(operatorStr) {
  if (!operatorStr) return '';
  const names = operatorStr.split(',').map(s => s.trim()).filter(Boolean);
  const leader = names.find(n => OPERATOR_DIRECTORY[n] && OPERATOR_DIRECTORY[n].canLead);
  return leader || '';
}

// Helper: derive role + group for an operator string (e.g. "M. Kostopoulou, G. Antoniou").
// Returns deduped, comma-joined lists matching the existing data shape.
function deriveOperatorRoles(operatorStr) {
  if (!operatorStr) return '';
  const seen = new Set();
  operatorStr.split(',').map(s => s.trim()).filter(Boolean).forEach(n => {
    const entry = OPERATOR_DIRECTORY[n];
    if (entry) seen.add(entry.role);
  });
  return [...seen].join(', ');
}
function deriveOperatorGroups(operatorStr) {
  if (!operatorStr) return '';
  const seen = new Set();
  operatorStr.split(',').map(s => s.trim()).filter(Boolean).forEach(n => {
    const entry = OPERATOR_DIRECTORY[n];
    seen.add(entry ? entry.group : 'Default');
  });
  return [...seen].join(', ');
}

// ── Table column definitions ──────────────────────────────────────────────────

const DT_PER_PAGE = 10;

const DT_COLS = [
  // Text columns (left-aligned, Open Sans)
  { key:'group',         label:'Stop groups',          width:130, align:'left',  mono:false },
  { key:'station',       label:'Stations',             width:130, align:'left',  mono:false },
  { key:'stationGroup',  label:'Station groups',       width:140, align:'left',  mono:false },
  { key:'stopType',      label:'Stop types',           width:120, align:'left',  mono:false },
  { key:'location',      label:'Machine locations',    width:160, align:'left',  mono:false },
  { key:'productGroup',  label:'Product groups',       width:140, align:'left',  mono:false },
  { key:'product',       label:'Products',             width:130, align:'left',  mono:false },
  { key:'productCode',   label:'Product code',         width:120, align:'left',  mono:false },
  { key:'shift',         label:'Shifts',               width:110, align:'left',  mono:false },
  { key:'operator',          label:'Operators',         width:130, align:'left',  mono:false },
  { key:'operatorRole',      label:'Operator role',     width:150, align:'left',  mono:false },
  { key:'operatorGroupName', label:'Operator group',    width:150, align:'left',  mono:false },
  // Numeric columns (right-aligned, Roboto Mono)
  { key:'count',         label:'Count',                width:71,  align:'right', mono:true  },
  { key:'notes',         label:'Notes',                width:70,  align:'right', mono:true,  hasNote:true, neutral:true },
  { key:'loss',          label:'Loss (primary unit)',  width:150, align:'right', mono:true,  unit:' min' },
  { key:'dur',           label:'Duration (All)',       width:133, align:'right', mono:true,  iconY:true, unit:' min' },
  { key:'avg',           label:'Average duration',     width:136, align:'right', mono:true,  unit:' min' },
  { key:'durOee',        label:'Duration (incl. OEE)', width:182, align:'right', mono:true,  iconY:true, unit:' min' },
  { key:'plannedTime',   label:'Planned time',         width:153, align:'right', mono:true,  unit:' min', neutral:true },
  { key:'manhours',      label:'Man-hours',            width:120, align:'right', mono:true,  unit:' h',   manhours:true },
  { key:'pct',           label:'% of planned time',   width:141, align:'right', mono:true,  unit:'%'    },
];

// ── Inline SVG icons used in the table ───────────────────────────────────────

const ICON_Y_INLINE = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9e9e9e" stroke-width="2" stroke-linecap="round" style="flex-shrink:0"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
const ICON_OPEN     = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

// ── Figma asset URLs (radio buttons, checkboxes, tooltip icons) ───────────────

const RADIO_ON  = 'https://www.figma.com/api/mcp/asset/3132cf61-779f-40d5-b153-e913470e1e8f';
const RADIO_OFF = 'https://www.figma.com/api/mcp/asset/b88f30eb-03ed-45c4-bcc9-979e6fb20c2d';
const CHECK_OFF = 'https://www.figma.com/api/mcp/asset/486213dd-790a-4987-bfe1-31cc1f69274e';
const CHECK_ON  = 'https://www.figma.com/api/mcp/asset/a177a0de-3d3d-4d1c-967b-344d561784bb';
const ICON_X_URL = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="17" y2="18"/></svg>`;
const ICON_Y_URL = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;

// ── Chart colors ──────────────────────────────────────────────────────────────

// Base colors keyed by stop-group name; fallback uses CHART_PALETTE by index.
const STOP_GROUP_COLORS = {
  'Uncommented':'#E01C21', 'Mechanical':'#3498DB', 'Planned':'#0066CC',
  'Material':'#2ECC71',    'Setup':'#F1C40F',       'Quality':'#1ABC9C',
  'Operator':'#A7D129',    'Other':'#FA8072'
};
const CHART_PALETTE = ['#E01C21','#3498DB','#0066CC','#2ECC71','#F1C40F','#1ABC9C','#A7D129','#FA8072','#9B59B6','#E67E22','#27AE60','#D35400'];

// ── Mock dataset ──────────────────────────────────────────────────────────────
// 15 stop-reason rows. Each row carries values for both the main period
// (mainDur, mainCount, …) and the compare period (cmpDur, cmpCount, …).

const STOP_REASONS_DATA = [
  { name:'Uncommented',   group:'Uncommented', mainDur:145, cmpDur:98,  mainCount:12, cmpCount:9,  mainAvg:12, cmpAvg:11, notes:3, cmpNotes:2, mainPct:18, cmpPct:12,
    station:'CNC-01, CNC-02, Press-01, Press-02, Assembly-01, Assembly-02', cmpStation:'CNC-01, CNC-03, Press-01, Press-03, Assembly-01, Assembly-03', stationGroup:'CNC, Press, Assembly', cmpStationGroup:'CNC, Press, Assembly', stopType:'Unplanned', location:'Hall A, Hall B, Hall C', cmpLocation:'Hall A, Hall B, Hall C', productGroup:'Electronics, Components, Assembly', cmpProductGroup:'Electronics, Components, Assembly', product:'Widget Pro, Gear Kit, Frame Set', cmpProduct:'Widget Pro, Circuit Bd., Frame Set', productCode:'PRD-001, PRD-002, PRD-003', cmpProductCode:'PRD-001, PRD-003, PRD-004', shift:'Morning, Afternoon, Night', cmpShift:'Morning, Afternoon, Night', operator:'M. Kostopoulou, G. Antoniou, E. Christodoulou, V. Mavroeidis, N. Papadopoulos', cmpOperator:'E. Christodoulou, V. Mavroeidis, M. Kostopoulou, D. Ekonomou', loss:145, cmpLoss:98,  durOee:145, cmpDurOee:98,  plannedTime:800, cmpPlannedTime:720 },
  { name:'Motor failure', group:'Mechanical',  mainDur:112, cmpDur:134, mainCount:5,  cmpCount:6,  mainAvg:22, cmpAvg:22, notes:2, cmpNotes:3, mainPct:14, cmpPct:17,
    station:'CNC-01, CNC-02, Press-01, Press-02', cmpStation:'CNC-02, CNC-03, Press-01, Press-03', stationGroup:'CNC, Press', cmpStationGroup:'CNC, Press', stopType:'Unplanned', location:'Hall A, Hall B', cmpLocation:'Hall A, Hall B', productGroup:'Electronics, Components', cmpProductGroup:'Electronics, Components', product:'Widget Pro, Gear Kit', cmpProduct:'Widget Pro, Circuit Bd., Bolt Pack', productCode:'PRD-001, PRD-002', cmpProductCode:'PRD-001, PRD-004, PRD-005', shift:'Morning, Afternoon', cmpShift:'Morning, Night', operator:'M. Kostopoulou, G. Antoniou, N. Papadopoulos', cmpOperator:'M. Kostopoulou, E. Christodoulou, S. Nikolaou', loss:112, cmpLoss:134, durOee:112, cmpDurOee:134, plannedTime:800, cmpPlannedTime:850 },
  { name:'Belt broken',   group:'Mechanical',  mainDur:78,  cmpDur:52,  mainCount:3,  cmpCount:2,  mainAvg:26, cmpAvg:26, notes:1, cmpNotes:1, mainPct:10, cmpPct:6,
    station:'Press-01, Press-02, Press-03', cmpStation:'Press-01, Press-02, Press-04', stationGroup:'Press', cmpStationGroup:'Press', stopType:'Unplanned', location:'Hall B', cmpLocation:'Hall B', productGroup:'Components', cmpProductGroup:'Components', product:'Gear Kit, Bolt Pack', cmpProduct:'Gear Kit, Bolt Pack', productCode:'PRD-002, PRD-005', cmpProductCode:'PRD-002, PRD-005', shift:'Morning, Afternoon', cmpShift:'Afternoon, Night', operator:'G. Antoniou, N. Papadopoulos, D. Ekonomou', cmpOperator:'N. Papadopoulos, S. Nikolaou, M. Kostopoulou', loss:78,  cmpLoss:52,  durOee:78,  cmpDurOee:52,  plannedTime:600, cmpPlannedTime:600 },
  { name:'Bearing worn',  group:'Mechanical',  mainDur:34,  cmpDur:41,  mainCount:4,  cmpCount:5,  mainAvg:9,  cmpAvg:8,  notes:0, cmpNotes:0, mainPct:4,  cmpPct:5,
    station:'Press-02, Press-03, CNC-02', cmpStation:'Press-01, Press-03, CNC-01', stationGroup:'Press, CNC', cmpStationGroup:'Press, CNC', stopType:'Unplanned', location:'Hall A, Hall B', cmpLocation:'Hall A, Hall B', productGroup:'Components, Electronics', cmpProductGroup:'Components, Electronics', product:'Gear Kit, Widget Pro', cmpProduct:'Bolt Pack, Widget Pro', productCode:'PRD-002, PRD-001', cmpProductCode:'PRD-005, PRD-001', shift:'Morning, Afternoon', cmpShift:'Morning, Night', operator:'G. Antoniou, V. Mavroeidis, N. Papadopoulos', cmpOperator:'V. Mavroeidis, M. Kostopoulou, G. Antoniou', loss:34,  cmpLoss:41,  durOee:34,  cmpDurOee:41,  plannedTime:600, cmpPlannedTime:750 },
  { name:'Planned maint.',group:'Planned',     mainDur:89,  cmpDur:89,  mainCount:2,  cmpCount:2,  mainAvg:45, cmpAvg:45, notes:1, cmpNotes:1, mainPct:11, cmpPct:11,
    station:'Assembly-01, CNC-01, CNC-02, Press-01, Press-02', cmpStation:'Assembly-01, Assembly-02, CNC-01, Press-01, Press-02', stationGroup:'Assembly, CNC, Press', cmpStationGroup:'Assembly, CNC, Press', stopType:'Planned', location:'Hall A, Hall B, Hall C', cmpLocation:'Hall A, Hall B, Hall C', productGroup:'Assembly, Electronics, Components', cmpProductGroup:'Assembly, Electronics, Components', product:'Frame Set, Widget Pro, Gear Kit', cmpProduct:'Frame Set, Panel Set, Widget Pro', productCode:'PRD-003, PRD-001, PRD-002', cmpProductCode:'PRD-003, PRD-006, PRD-001', shift:'Morning, Afternoon', cmpShift:'Morning, Afternoon', operator:'V. Mavroeidis, M. Kostopoulou, G. Antoniou, N. Papadopoulos', cmpOperator:'V. Mavroeidis, D. Ekonomou, E. Christodoulou', loss:0,   cmpLoss:0,   durOee:0,   cmpDurOee:0,   plannedTime:750, cmpPlannedTime:750 },
  { name:'Planned break', group:'Planned',     mainDur:45,  cmpDur:38,  mainCount:3,  cmpCount:3,  mainAvg:15, cmpAvg:13, notes:0, cmpNotes:0, mainPct:6,  cmpPct:5,
    station:'Assembly-01, Assembly-02, CNC-01, CNC-02, Press-01, Press-02', cmpStation:'Assembly-01, Assembly-02, Assembly-03, CNC-01, Press-01', stationGroup:'Assembly, CNC, Press', cmpStationGroup:'Assembly, CNC, Press', stopType:'Planned', location:'Hall A, Hall B, Hall C', cmpLocation:'Hall A, Hall B, Hall C', productGroup:'Assembly, Electronics, Components', cmpProductGroup:'Assembly, Electronics, Components', product:'Frame Set, Widget Pro, Gear Kit, Panel Set', cmpProduct:'Frame Set, Panel Set, Widget Pro', productCode:'PRD-003, PRD-001, PRD-002, PRD-006', cmpProductCode:'PRD-003, PRD-006, PRD-001', shift:'Morning, Afternoon, Night', cmpShift:'Morning, Afternoon, Night', operator:'V. Mavroeidis, D. Ekonomou, M. Kostopoulou, G. Antoniou, S. Nikolaou', cmpOperator:'D. Ekonomou, N. Papadopoulos, E. Christodoulou, V. Mavroeidis', loss:0,   cmpLoss:0,   durOee:0,   cmpDurOee:0,   plannedTime:750, cmpPlannedTime:750 },
  { name:'Mat. shortage', group:'Material',    mainDur:91,  cmpDur:67,  mainCount:7,  cmpCount:5,  mainAvg:13, cmpAvg:13, notes:4, cmpNotes:2, mainPct:11, cmpPct:8,
    station:'CNC-03, CNC-04, Press-01, Press-02, Assembly-01, Assembly-02', cmpStation:'CNC-01, CNC-04, Press-02, Press-03, Assembly-01', stationGroup:'CNC, Press, Assembly', cmpStationGroup:'CNC, Press, Assembly', stopType:'Unplanned', location:'Hall A, Hall B, Hall C', cmpLocation:'Hall A, Hall B, Hall C', productGroup:'Electronics, Components, Assembly', cmpProductGroup:'Electronics, Components, Assembly', product:'Circuit Bd., Widget Pro, Gear Kit, Frame Set', cmpProduct:'Widget Pro, Circuit Bd., Gear Kit', productCode:'PRD-004, PRD-001, PRD-002, PRD-003', cmpProductCode:'PRD-001, PRD-004, PRD-002', shift:'Morning, Night', cmpShift:'Morning, Afternoon, Night', operator:'E. Christodoulou, M. Kostopoulou, S. Nikolaou, G. Antoniou, V. Mavroeidis', cmpOperator:'E. Christodoulou, V. Mavroeidis, N. Papadopoulos', loss:91,  cmpLoss:67,  durOee:91,  cmpDurOee:67,  plannedTime:700, cmpPlannedTime:630 },
  { name:'Waiting parts', group:'Material',    mainDur:47,  cmpDur:73,  mainCount:4,  cmpCount:6,  mainAvg:12, cmpAvg:12, notes:2, cmpNotes:3, mainPct:6,  cmpPct:9,
    station:'Press-03, Press-04, Assembly-01, Assembly-02', cmpStation:'Press-03, Assembly-01, Assembly-02, Assembly-03', stationGroup:'Press, Assembly', cmpStationGroup:'Press, Assembly', stopType:'Unplanned', location:'Hall B, Hall C', cmpLocation:'Hall B, Hall C', productGroup:'Components, Assembly', cmpProductGroup:'Components, Assembly', product:'Bolt Pack, Gear Kit, Frame Set', cmpProduct:'Gear Kit, Frame Set, Panel Set', productCode:'PRD-005, PRD-002, PRD-003', cmpProductCode:'PRD-002, PRD-003, PRD-006', shift:'Morning, Afternoon', cmpShift:'Morning, Night', operator:'N. Papadopoulos, M. Kostopoulou, D. Ekonomou, V. Mavroeidis', cmpOperator:'M. Kostopoulou, D. Ekonomou, V. Mavroeidis', loss:47,  cmpLoss:73,  durOee:47,  cmpDurOee:73,  plannedTime:600, cmpPlannedTime:600 },
  { name:'Changeover',    group:'Setup',       mainDur:62,  cmpDur:55,  mainCount:4,  cmpCount:4,  mainAvg:16, cmpAvg:14, notes:0, cmpNotes:0, mainPct:8,  cmpPct:7,
    station:'Assembly-03, Assembly-01, CNC-01, CNC-02', cmpStation:'Assembly-03, Assembly-02, CNC-01, CNC-03', stationGroup:'Assembly, CNC', cmpStationGroup:'Assembly, CNC', stopType:'Semi-planned', location:'Hall A, Hall C', cmpLocation:'Hall A, Hall C', productGroup:'Assembly, Electronics', cmpProductGroup:'Assembly, Electronics', product:'Panel Set, Frame Set, Widget Pro', cmpProduct:'Frame Set, Panel Set, Widget Pro', productCode:'PRD-006, PRD-003, PRD-001', cmpProductCode:'PRD-003, PRD-006, PRD-001', shift:'Morning, Afternoon', cmpShift:'Morning, Afternoon', operator:'D. Ekonomou, V. Mavroeidis, M. Kostopoulou, G. Antoniou', cmpOperator:'D. Ekonomou, G. Antoniou, S. Nikolaou, M. Kostopoulou, E. Christodoulou', loss:0,   cmpLoss:0,   durOee:62,  cmpDurOee:55,  plannedTime:750, cmpPlannedTime:750 },
  { name:'Calibration',   group:'Setup',       mainDur:28,  cmpDur:19,  mainCount:2,  cmpCount:1,  mainAvg:14, cmpAvg:19, notes:1, cmpNotes:0, mainPct:4,  cmpPct:2,
    station:'CNC-04, CNC-01, CNC-02, CNC-03', cmpStation:'CNC-01, CNC-02, CNC-04', stationGroup:'CNC', cmpStationGroup:'CNC', stopType:'Planned', location:'Hall A', cmpLocation:'Hall A', productGroup:'Electronics', cmpProductGroup:'Electronics', product:'Widget Pro, Circuit Bd.', cmpProduct:'Widget Pro, Circuit Bd.', productCode:'PRD-001, PRD-004', cmpProductCode:'PRD-001, PRD-004', shift:'Morning, Night', cmpShift:'Morning, Afternoon', operator:'E. Christodoulou, G. Antoniou, M. Kostopoulou', cmpOperator:'M. Kostopoulou, E. Christodoulou', loss:0,   cmpLoss:0,   durOee:0,   cmpDurOee:0,   plannedTime:800, cmpPlannedTime:800 },
  { name:'Quality check', group:'Quality',     mainDur:56,  cmpDur:61,  mainCount:5,  cmpCount:5,  mainAvg:11, cmpAvg:12, notes:2, cmpNotes:2, mainPct:7,  cmpPct:8,
    station:'Press-04, Press-03, Assembly-01, CNC-01', cmpStation:'Press-04, Assembly-01, Assembly-02, CNC-02', stationGroup:'Press, Assembly, CNC', cmpStationGroup:'Press, Assembly, CNC', stopType:'Unplanned', location:'Hall A, Hall B, Hall C', cmpLocation:'Hall A, Hall B, Hall C', productGroup:'Components, Assembly, Electronics', cmpProductGroup:'Components, Assembly, Electronics', product:'Gear Kit, Frame Set, Widget Pro', cmpProduct:'Gear Kit, Frame Set, Widget Pro', productCode:'PRD-002, PRD-003, PRD-001', cmpProductCode:'PRD-002, PRD-003, PRD-001', shift:'Morning, Afternoon', cmpShift:'Afternoon, Night', operator:'G. Antoniou, N. Papadopoulos, V. Mavroeidis, E. Christodoulou', cmpOperator:'G. Antoniou, E. Christodoulou, D. Ekonomou', loss:56,  cmpLoss:61,  durOee:56,  cmpDurOee:61,  plannedTime:600, cmpPlannedTime:600 },
  { name:'Prod. defect',  group:'Quality',     mainDur:23,  cmpDur:31,  mainCount:3,  cmpCount:4,  mainAvg:8,  cmpAvg:8,  notes:1, cmpNotes:1, mainPct:3,  cmpPct:4,
    station:'Assembly-04, Assembly-01, Assembly-02', cmpStation:'Assembly-04, Assembly-03, Press-04', stationGroup:'Assembly', cmpStationGroup:'Assembly, Press', stopType:'Unplanned', location:'Hall C', cmpLocation:'Hall B, Hall C', productGroup:'Assembly, Components', cmpProductGroup:'Assembly, Components', product:'Frame Set, Panel Set', cmpProduct:'Bolt Pack, Frame Set', productCode:'PRD-003, PRD-006', cmpProductCode:'PRD-005, PRD-003', shift:'Morning, Afternoon', cmpShift:'Afternoon, Night', operator:'V. Mavroeidis, D. Ekonomou, N. Papadopoulos', cmpOperator:'N. Papadopoulos, M. Kostopoulou, E. Christodoulou', loss:23,  cmpLoss:31,  durOee:23,  cmpDurOee:31,  plannedTime:750, cmpPlannedTime:600 },
  { name:'Operator break',group:'Operator',    mainDur:38,  cmpDur:29,  mainCount:6,  cmpCount:5,  mainAvg:6,  cmpAvg:6,  notes:0, cmpNotes:0, mainPct:5,  cmpPct:4,
    station:'CNC-01, CNC-02, Press-01, Press-02, Assembly-01', cmpStation:'CNC-01, CNC-02, Press-01, Assembly-01, Assembly-02', stationGroup:'CNC, Press, Assembly', cmpStationGroup:'CNC, Press, Assembly', stopType:'Planned', location:'Hall A, Hall B, Hall C', cmpLocation:'Hall A, Hall B, Hall C', productGroup:'Electronics, Components, Assembly', cmpProductGroup:'Electronics, Components, Assembly', product:'Widget Pro, Gear Kit, Frame Set', cmpProduct:'Widget Pro, Gear Kit, Frame Set', productCode:'PRD-001, PRD-002, PRD-003', cmpProductCode:'PRD-001, PRD-002, PRD-003', shift:'Morning, Afternoon', cmpShift:'Morning, Afternoon', operator:'M. Kostopoulou, S. Nikolaou, D. Ekonomou, G. Antoniou, E. Christodoulou', cmpOperator:'M. Kostopoulou, V. Mavroeidis, N. Papadopoulos, D. Ekonomou', loss:0,   cmpLoss:0,   durOee:0,   cmpDurOee:0,   plannedTime:800, cmpPlannedTime:800 },
  { name:'Training',      group:'Operator',    mainDur:19,  cmpDur:24,  mainCount:2,  cmpCount:3,  mainAvg:10, cmpAvg:8,  notes:0, cmpNotes:0, mainPct:2,  cmpPct:3,
    station:'Press-01, CNC-01, Assembly-01, CNC-03', cmpStation:'Press-03, CNC-02, Assembly-02', stationGroup:'Press, CNC, Assembly', cmpStationGroup:'Press, CNC, Assembly', stopType:'Planned', location:'Hall A, Hall B, Hall C', cmpLocation:'Hall A, Hall B, Hall C', productGroup:'Components, Electronics, Assembly', cmpProductGroup:'Components, Electronics, Assembly', product:'Gear Kit, Widget Pro, Frame Set', cmpProduct:'Bolt Pack, Widget Pro, Frame Set', productCode:'PRD-002, PRD-001, PRD-003', cmpProductCode:'PRD-005, PRD-001, PRD-003', shift:'Morning, Night', cmpShift:'Afternoon, Night', operator:'S. Nikolaou, G. Antoniou, V. Mavroeidis, E. Christodoulou', cmpOperator:'N. Papadopoulos, E. Christodoulou, V. Mavroeidis, M. Kostopoulou', loss:0,   cmpLoss:0,   durOee:0,   cmpDurOee:0,   plannedTime:600, cmpPlannedTime:600 },
  { name:'Ext. factor',   group:'Other',       mainDur:15,  cmpDur:22,  mainCount:2,  cmpCount:3,  mainAvg:8,  cmpAvg:7,  notes:0, cmpNotes:0, mainPct:2,  cmpPct:3,
    station:'Assembly-01, CNC-01, Press-01, Press-02', cmpStation:'Assembly-01, CNC-02, Press-01, Press-03', stationGroup:'Assembly, CNC, Press', cmpStationGroup:'Assembly, CNC, Press', stopType:'Unplanned', location:'Hall A, Hall B, Hall C', cmpLocation:'Hall A, Hall B, Hall C', productGroup:'Assembly, Electronics, Components', cmpProductGroup:'Assembly, Electronics, Components', product:'Frame Set, Widget Pro, Gear Kit', cmpProduct:'Frame Set, Widget Pro', productCode:'PRD-003, PRD-001, PRD-002', cmpProductCode:'PRD-003, PRD-001', shift:'Morning, Afternoon', cmpShift:'Morning, Night', operator:'V. Mavroeidis, D. Ekonomou, S. Nikolaou, M. Kostopoulou', cmpOperator:'V. Mavroeidis, E. Christodoulou, G. Antoniou', loss:15,  cmpLoss:22,  durOee:15,  cmpDurOee:22,  plannedTime:750, cmpPlannedTime:750 },
  // main-only: occurred in current period, absent in compare period
  { name:'Power outage',  group:'Other',       mainDur:42,  cmpDur:0,   mainCount:1,  cmpCount:0,  mainAvg:42, cmpAvg:0,  notes:1, cmpNotes:0, mainPct:5,  cmpPct:0,
    station:'CNC-01, Press-01, Assembly-01', cmpStation:'', stationGroup:'CNC, Press, Assembly', cmpStationGroup:'', stopType:'Unplanned', location:'Hall A, Hall B', cmpLocation:'', productGroup:'Electronics, Components', cmpProductGroup:'', product:'Widget Pro, Gear Kit', cmpProduct:'', productCode:'PRD-001, PRD-002', cmpProductCode:'', shift:'Morning', cmpShift:'', operator:'M. Kostopoulou, G. Antoniou, E. Christodoulou', cmpOperator:'', loss:42, cmpLoss:0, durOee:42, cmpDurOee:0, plannedTime:800, cmpPlannedTime:0 },
  // compare-only: absent in current period, occurred in compare period
  { name:'Sensor error',  group:'Mechanical',  mainDur:0,   cmpDur:35,  mainCount:0,  cmpCount:2,  mainAvg:0,  cmpAvg:18, notes:0, cmpNotes:1, mainPct:0,  cmpPct:4,
    station:'', cmpStation:'CNC-02, CNC-03', stationGroup:'', cmpStationGroup:'CNC', stopType:'Unplanned', location:'', cmpLocation:'Hall A', productGroup:'', cmpProductGroup:'Electronics', product:'', cmpProduct:'Circuit Bd., Widget Pro', productCode:'', cmpProductCode:'PRD-004, PRD-001', shift:'', cmpShift:'Afternoon, Night', operator:'', cmpOperator:'E. Christodoulou, G. Antoniou', loss:0, cmpLoss:35, durOee:0, cmpDurOee:35, plannedTime:0, cmpPlannedTime:800 },
];

// Derive role + group from the operator names on each row. Adds:
//   .operatorRole    — comma-joined list of distinct roles on the main period
//   .operatorGroupName — comma-joined list of distinct groups on the main period
//   .cmpOperatorRole / .cmpOperatorGroupName — same for compare period
// Stored as named fields so aggregateBy('operatorRole') Just Works™.
STOP_REASONS_DATA.forEach(r => {
  r.operatorRole       = deriveOperatorRoles(r.operator);
  r.operatorGroupName  = deriveOperatorGroups(r.operator);
  r.cmpOperatorRole    = deriveOperatorRoles(r.cmpOperator);
  r.cmpOperatorGroupName = deriveOperatorGroups(r.cmpOperator);
  r.leader             = deriveLeader(r.operator);
  r.cmpLeader          = deriveLeader(r.cmpOperator);
});

// Manhours = SUM of each DISTINCT operator's worked hours.
// Operator-level dedup: even if a person appears on multiple station rows, their
// hours are counted once. So manhours never derives from a per-row product —
// it's computed from the distinct set of operators in scope. We store the raw
// operator string on each row and compute manhours from the distinct union at
// aggregation time (see manhoursFor). The per-row figures below are only used
// for the stop-reason (un-aggregated) view, where each row's operators are
// already its own scope.
function operatorList(operatorStr) {
  if (!operatorStr) return [];
  return operatorStr.split(',').map(s => s.trim()).filter(Boolean);
}
function manhoursFor(operatorStr, cmp) {
  // Σ distinct operators' hours. Unknown operators contribute 0.
  const seen = new Set();
  let total = 0;
  operatorList(operatorStr).forEach(n => {
    if (seen.has(n)) return;
    seen.add(n);
    const e = OPERATOR_DIRECTORY[n];
    if (e) total += (cmp ? e.cmpHours : e.hours) || 0;
  });
  return total;
}
STOP_REASONS_DATA.forEach(r => {
  r.mainManhours = manhoursFor(r.operator, false);
  r.cmpManhours  = manhoursFor(r.cmpOperator, true);
});

// ── OEE mock data ─────────────────────────────────────────────────────────────

const OEE_DATA = [
  { day:1, quality:94, performance:55, availability:61, oee:32, cmpQuality:99, cmpPerformance:53, cmpAvailability:70, cmpOee:37 },
  { day:2, quality:94, performance:54, availability:53, oee:27, cmpQuality:99, cmpPerformance:56, cmpAvailability:62, cmpOee:34 },
  { day:3, quality:94, performance:65, availability:46, oee:28, cmpQuality:99, cmpPerformance:59, cmpAvailability:65, cmpOee:38 },
  { day:4, quality:94, performance:53, availability:53, oee:26, cmpQuality:98, cmpPerformance:54, cmpAvailability:68, cmpOee:36 },
  { day:5, quality:94, performance:55, availability:55, oee:28, cmpQuality:99, cmpPerformance:60, cmpAvailability:67, cmpOee:40 },
  { day:6, quality:94, performance:50, availability:50, oee:24, cmpQuality:99, cmpPerformance:55, cmpAvailability:63, cmpOee:33 },
  { day:7, quality:95, performance:60, availability:47, oee:27, cmpQuality:98, cmpPerformance:58, cmpAvailability:66, cmpOee:38 },
];

const OEE_LINES = [
  { key:'quality',      cmpKey:'cmpQuality',      label:'Quality',      color:'#ff9800' },
  { key:'performance',  cmpKey:'cmpPerformance',   label:'Performance',  color:'#fdd835' },
  { key:'availability', cmpKey:'cmpAvailability',  label:'Availability', color:'#2ecc71' },
  { key:'oee',          cmpKey:'cmpOee',           label:'OEE',          color:'#212121' },
];

const SHIFT_LEADERS = CAN_LEAD_OPERATORS;

// ── Shift blocks — the single source of truth for OEE-by-people ───────────────
// A block is one stretch of production: a station, a time window, a shift
// leader, and the operators on it, plus raw production counters. EVERYTHING the
// OEE report shows about leaders / operators / groups is *derived* from these
// blocks by selecting a subset (filters) and rolling up — so all the views
// reconcile with each other and with the filters.
//
//   leaderId      — the operator leading this block (one of CAN_LEAD_OPERATORS)
//   operatorIds   — everyone who worked the block (includes the leader)
//   plannedMin    — planned production time (denominator of availability)
//   runMin        — operating time (green+yellow) ≤ plannedMin
//   idealQty      — qty achievable at ideal cycle time over runMin
//   totalQty      — qty actually produced
//   goodQty       — good qty (≤ totalQty); scrap = totalQty − goodQty
//
// OEE = Availability(runMin/plannedMin) × Performance(totalQty/idealQty)
//       × Quality(goodQty/totalQty).
// Crews are kept within one team per block so the group comparison is clean:
//   Blue Team  — led by V. Mavroeidis, runs a bit hotter (higher OEE)
//   Red Team   — led by N. Papadopoulos, runs a bit lower
//   Operators  — the fallback bucket (S. Nikolaou / S. Panagiotou), a couple shifts
// so each named group shows a distinct OEE / quantity profile in the report.
const SHIFT_BLOCKS = [
  // day, station, leader, operators, plannedMin, runMin, idealQty, totalQty, goodQty
  // ── Blue Team (stronger) ─────────────────────────────────────────────────
  blk(1, 'CNC-01',     'V. Mavroeidis', ['V. Mavroeidis','M. Kostopoulou','G. Antoniou'],  480, 320, 1000, 580, 562),
  blk(2, 'CNC-02',     'V. Mavroeidis', ['V. Mavroeidis','P. Lambrou','A. Dimitriou'],     480, 315, 1000, 575, 558),
  blk(3, 'CNC-01',     'V. Mavroeidis', ['V. Mavroeidis','M. Kostopoulou','P. Lambrou'],   480, 325, 1000, 590, 572),
  blk(4, 'Press-01',   'V. Mavroeidis', ['V. Mavroeidis','G. Antoniou','A. Dimitriou'],    480, 305,  900, 525, 508),
  blk(5, 'Assembly-02','V. Mavroeidis', ['V. Mavroeidis','P. Lambrou','M. Kostopoulou'],   480, 318,  850, 545, 528),
  blk(6, 'CNC-02',     'V. Mavroeidis', ['V. Mavroeidis','G. Antoniou','A. Dimitriou'],    480, 312, 1000, 568, 552),
  // ── Red Team (weaker) ────────────────────────────────────────────────────
  blk(1, 'Press-01',   'N. Papadopoulos', ['N. Papadopoulos','E. Christodoulou','D. Ekonomou'], 480, 250, 900, 455, 428),
  blk(2, 'Press-02',   'N. Papadopoulos', ['N. Papadopoulos','K. Vlachos','D. Roussou'],         480, 240, 900, 445, 416),
  blk(3, 'Assembly-01','N. Papadopoulos', ['N. Papadopoulos','E. Christodoulou','K. Vlachos'],   480, 255, 850, 450, 422),
  blk(4, 'CNC-03',     'N. Papadopoulos', ['N. Papadopoulos','D. Ekonomou','D. Roussou'],        480, 235, 1000, 430, 402),
  blk(5, 'Press-03',   'N. Papadopoulos', ['N. Papadopoulos','K. Vlachos','E. Christodoulou'],   480, 245, 900, 448, 420),
  blk(6, 'Press-02',   'N. Papadopoulos', ['N. Papadopoulos','D. Roussou','D. Ekonomou'],        480, 238, 900, 440, 412),
  // ── Operators (fallback group): mid performance ──────────────────────────
  blk(7, 'Warehouse',  'V. Mavroeidis',   ['S. Nikolaou','S. Panagiotou'],                 480, 280, 800, 470, 450),
  blk(7, 'Quality Lab','N. Papadopoulos', ['S. Panagiotou','S. Nikolaou'],                 480, 270, 800, 455, 436),
];
function blk(day, station, leaderId, operatorIds, plannedMin, runMin, idealQty, totalQty, goodQty) {
  // shiftMin: scheduled shift length (≥ planned). allMin: calendar time the
  // station could run (here a full day). techStopMin: unplanned technical-stop
  // minutes inside planned time (drives Technical availability). Defaults keep
  // the 14-row table terse — an 8h shift inside a 24h day, ~6% tech stops.
  const shiftMin = 480, allMin = 1440;
  const techStopMin = Math.round((plannedMin - runMin) * 0.4); // ~40% of downtime is technical
  // Demo product/order metadata, varied by station family so descr columns
  // aren't empty (real data would carry these per production run).
  const fam = station.split('-')[0];
  const META = {
    CNC:      { products:['Widget Pro'],  productCodes:['PRD-001'], lots:['LOT-A1'], orders:['ORD-1001'] },
    Press:    { products:['Gear Kit'],     productCodes:['PRD-002'], lots:['LOT-B1'], orders:['ORD-1002'] },
    Assembly: { products:['Frame Set'],    productCodes:['PRD-003'], lots:['LOT-C1'], orders:['ORD-1003'] },
  };
  const meta = META[fam] || { products:[], productCodes:[], lots:[], orders:[] };
  const shift = 'Day';
  return { day, station, leaderId, operatorIds, plannedMin, runMin, idealQty, totalQty, goodQty,
           shiftMin, allMin, techStopMin, shift, ...meta };
}

// OEE of a single block (components 0–100).
function blockOEE(b) {
  const a = b.plannedMin ? b.runMin   / b.plannedMin : 0;
  const p = b.idealQty   ? b.totalQty / b.idealQty   : 0;
  const q = b.totalQty   ? b.goodQty  / b.totalQty   : 0;
  return { availability: a*100, performance: p*100, quality: q*100, oee: a*p*q*100 };
}

// Weighted roll-up of many blocks (Evocon method: sum raw counters first, then
// apply the formulas — weighted by planned time). Returns the full OEE metric
// set (0–100) plus the raw time totals (minutes) and quantity. This is what the
// OEE report's data table rows are built from.
function rollupOEE(blocks) {
  let planned=0, run=0, ideal=0, total=0, good=0, shift=0, all=0, techStop=0;
  blocks.forEach(b => {
    planned+=b.plannedMin; run+=b.runMin; ideal+=b.idealQty; total+=b.totalQty;
    good+=b.goodQty; shift+=b.shiftMin; all+=b.allMin; techStop+=b.techStopMin;
  });
  const a = planned ? run/planned : 0;
  const p = ideal   ? total/ideal : 0;
  const q = total   ? good/total  : 0;
  const oeeR = a*p*q;
  return {
    availability: a*100, performance: p*100, quality: q*100, oee: oeeR*100,
    techAvailability: planned ? (planned - techStop)/planned*100 : 0,
    ooe:  shift ? (run/shift) * p * q * 100 : 0,
    teep: all   ? (run/all)   * p * q * 100 : 0,
    operatingMin: run, plannedMin: planned, shiftMin: shift, allMin: all,
    qty: total,
  };
}

// ── OEE report data-table columns (mirrors the real OEE.csv / screenshot) ─────
// The first column is dynamic (the current X-axis dimension); these are the
// fixed columns that follow. `descr` columns are comma-joined value lists for
// the row's blocks; `metric` columns are %; `time` columns are minute totals
// rendered as durations; `qty` is a number.
const OEE_TABLE_COLS = [
  { key:'stations',        label:'Stations',          et:'Töökeskused',          type:'descr' },
  { key:'stationGroups',   label:'Station groups',    et:'Töökeskuste grupid',   type:'descr' },
  { key:'factories',       label:'Factories',         et:'Tehased',              type:'descr' },
  { key:'products',        label:'Products',          et:'Tooted',               type:'descr' },
  { key:'productCodes',    label:'Product code',      et:'Tootekood',            type:'descr' },
  { key:'lots',            label:'LOT/Batch',         et:'LOT/Partii',           type:'descr' },
  { key:'orders',          label:'Orders',            et:'Tootmistellimused',    type:'descr' },
  { key:'shifts',          label:'Shifts',            et:'Vahetused',            type:'descr' },
  { key:'availability',    label:'Availability',      et:'Kasulik tööaeg',       type:'metric' },
  { key:'techAvailability',label:'Technical availability', et:'Tehniline valmidus', type:'metric' },
  { key:'performance',     label:'Performance',       et:'Tootmiskiirus',        type:'metric' },
  { key:'quality',         label:'Quality',           et:'Kvaliteet',            type:'metric' },
  { key:'oee',             label:'OEE',               et:'OEE',                  type:'metric' },
  { key:'ooe',             label:'OOE',               et:'OOE',                  type:'metric' },
  { key:'teep',            label:'TEEP',              et:'TEEP',                 type:'metric' },
  { key:'manhours',        label:'Man-hours',         et:'Inimtunnid',           type:'hours'  },
  { key:'operatingMin',    label:'Operating time',    et:'Tööaeg',               type:'time'   },
  { key:'plannedMin',      label:'Planned time',      et:'Planeeritud tööaeg',   type:'time'   },
  { key:'shiftMin',        label:'Shift time',        et:'Vahetuse aeg',         type:'time'   },
  { key:'allMin',          label:'All time',          et:'Kogu aeg',             type:'time'   },
  { key:'qty',             label:'Total quantity',    et:'Kogutoodang',          type:'qty'    },
];

// Descriptive (comma-joined distinct) values for a block set, per descr column.
function descrValues(blocks, key) {
  const set = new Set();
  blocks.forEach(b => {
    let vals = [];
    switch (key) {
      case 'stations':      vals = [b.station]; break;
      case 'stationGroups': vals = [STATION_GROUP_OF[b.station] || '—']; break;
      case 'factories':     vals = [FACTORY_OF[b.station] || '—']; break;
      case 'products':      vals = b.products || []; break;
      case 'productCodes':  vals = b.productCodes || []; break;
      case 'lots':          vals = b.lots || []; break;
      case 'orders':        vals = b.orders || []; break;
      case 'shifts':        vals = [b.shift || 'Day']; break;
    }
    vals.forEach(v => v && set.add(v));
  });
  return [...set].join(', ') || '—';
}

// Lightweight station → group / factory lookups for the descr columns.
const STATION_GROUP_OF = { 'CNC-01':'CNC','CNC-02':'CNC','CNC-03':'CNC','Press-01':'Press','Press-02':'Press','Press-03':'Press','Assembly-01':'Assembly','Assembly-02':'Assembly','Warehouse':'Logistics','Quality Lab':'Quality' };
const FACTORY_OF       = { 'CNC-01':'Factory 1','CNC-02':'Factory 1','CNC-03':'Factory 1','Press-01':'Factory 1','Press-02':'Factory 1','Press-03':'Factory 1','Assembly-01':'Factory 2','Assembly-02':'Factory 2','Warehouse':'Factory 2','Quality Lab':'Factory 2' };

// Build one OEE table row per value of the chosen X-axis dimension, from a
// (filtered) block set. Each row = the dynamic first cell + the full metric +
// descriptive + time/qty columns, derived (so it reconciles with the chart).
function oeeTableRows(blocks, dimKey) {
  const dim = OEE_DIMS[dimKey] || OEE_DIMS.operator;
  const bucket = {};
  blocks.forEach(b => dim.valsOf(b).forEach(v => (bucket[v] = bucket[v] || []).push(b)));
  const rows = dim.labels()
    .filter(v => bucket[v] && bucket[v].length)
    .map(v => {
      const bs = bucket[v];
      const r = rollupOEE(bs);
      r.name = v;
      r.manhours = dim.isPeople ? manhoursScoped(bs, dimKey, v) : blockManhours(bs);
      OEE_TABLE_COLS.filter(c => c.type === 'descr').forEach(c => { r[c.key] = descrValues(bs, c.key); });
      return r;
    });
  // "Kokku" (total) row — weighted roll-up over ALL blocks in scope.
  if (rows.length) {
    const tot = rollupOEE(blocks);
    tot.name = 'Total';
    tot.manhours = blockManhours(blocks);
    tot._total = true;
    OEE_TABLE_COLS.filter(c => c.type === 'descr').forEach(c => { tot[c.key] = ''; });
    rows.push(tot);
  }
  return rows;
}

// Distinct operators across a set of blocks → total worked hours (manhours).
// Each operator counted once; their hours = Σ block durations they were on.
function blockManhours(blocks) {
  const perOp = new Map();
  blocks.forEach(b => b.operatorIds.forEach(o => {
    perOp.set(o, (perOp.get(o) || 0) + b.plannedMin / 60);
  }));
  let total = 0; perOp.forEach(h => total += h);
  return total;
}

// Dimension descriptors. A dim maps a block → the value(s) it belongs to on
// that dimension, and provides the full label list + a header for the table.
//   operator → each operator present on the block
//   group    → each distinct operator-group present
//   leader   → the single shift leader of the block
const OEE_DIMS = {
  operator: {
    header: 'Operator',
    labels: () => Object.keys(OPERATOR_DIRECTORY),
    valsOf: (b) => b.operatorIds.slice(),
    isPeople: true,
  },
  group: {
    header: 'Operator group',
    labels: () => OPERATOR_GROUPS.slice(),
    valsOf: (b) => [...new Set(b.operatorIds.map(o => OPERATOR_DIRECTORY[o]?.group || 'Default'))],
    isPeople: true,
  },
  leader: {
    header: 'Shift leader',
    labels: () => SHIFT_LEADERS.slice(),
    valsOf: (b) => [b.leaderId],
    isPeople: false,
  },
};

// Generic nested OEE matrix: outer dimension × inner dimension. A block lands
// in cell [outerVal][innerVal] for every combination of values it represents.
// Each cell = rolled-up OEE components + deduped manhours scoped to whichever
// side is the "people" dimension (so the number means a real headcount-time).
function oeeMatrixFromBlocks(blocks, outerDim, innerDim) {
  const O = OEE_DIMS[outerDim] || OEE_DIMS.operator;
  const I = OEE_DIMS[innerDim] || OEE_DIMS.leader;
  const bucket = {}; // [outer][inner] = blocks[]
  blocks.forEach(b => {
    O.valsOf(b).forEach(ov => {
      I.valsOf(b).forEach(iv => {
        (bucket[ov] = bucket[ov] || {});
        (bucket[ov][iv] = bucket[ov][iv] || []).push(b);
      });
    });
  });
  // Manhours scope: prefer the people dimension. If the OUTER is people, scope
  // to the outer value (e.g. "Operator A's hours"); else if INNER is people,
  // scope to the inner value; else (leader×leader, unused) all operators.
  const data = {};
  O.labels().forEach(ov => {
    data[ov] = {};
    I.labels().forEach(iv => {
      const bs = bucket[ov] && bucket[ov][iv];
      if (bs && bs.length) {
        const cell = rollupOEE(bs);
        if (O.isPeople)      cell.manhours = manhoursScoped(bs, outerDim, ov);
        else if (I.isPeople) cell.manhours = manhoursScoped(bs, innerDim, iv);
        else                 cell.manhours = blockManhours(bs);
        data[ov][iv] = cell;
      } else {
        data[ov][iv] = null;
      }
    });
  });
  return { labels: O.labels(), innerLabels: I.labels(), data, outerHeader: O.header, innerHeader: I.header };
}

// Manhours attributable to a single dimension value within a block set —
// distinct operators that belong to that value, hours counted once.
function manhoursScoped(blocks, dim, val) {
  const inVal = (o) => dim === 'group'
    ? ((OPERATOR_DIRECTORY[o]?.group || 'Default') === val)
    : (o === val); // 'operator'
  const perOp = new Map();
  blocks.forEach(b => b.operatorIds.forEach(o => {
    if (inVal(o)) perOp.set(o, (perOp.get(o) || 0) + b.plannedMin / 60);
  }));
  let total = 0; perOp.forEach(h => total += h);
  return total;
}

// ── Quantities report ─────────────────────────────────────────────────────────
// The Quantities chart (Figma 2045-7344) is a STACKED bar per X-axis value:
//   Scrap        (orange, bottom) = totalQty − goodQty
//   Good quality (green)          = goodQty
//   Potential    (grey, top)      = idealQty − totalQty   (the gap to ideal speed)
// Stacked because they sum to the ideal output (unlike OEE's multiplicative
// components). Derived from the SAME SHIFT_BLOCKS as OEE, so the two reconcile
// and Split by operator / leader / group works for free.
const QTY_SEGMENTS = [
  { key:'potential', label:'Potential',    color:'#bdbdbd' },
  { key:'good',      label:'Good quality', color:'#2ecc71' },
  { key:'scrap',     label:'Scrap',        color:'#ff9800' },
];

// Roll up a block set into the three quantity buckets (+ totals for the table).
function rollupQty(blocks) {
  let ideal=0, total=0, good=0;
  blocks.forEach(b => { ideal+=b.idealQty; total+=b.totalQty; good+=b.goodQty; });
  return {
    good, scrap: total - good, potential: Math.max(0, ideal - total),
    totalQty: total, goodQty: good, idealQty: ideal,
  };
}

// Quantities data-table columns: a dynamic first column (the X-axis dimension),
// then descriptive context, then the quantity numbers. Mirrors the OEE table
// shape (descr columns reuse descrValues / the same station lookups).
const QTY_TABLE_COLS = [
  { key:'stations',      label:'Stations',       type:'descr' },
  { key:'stationGroups', label:'Station groups', type:'descr' },
  { key:'factories',     label:'Factories',      type:'descr' },
  { key:'products',      label:'Products',       type:'descr' },
  { key:'productCodes',  label:'Product code',   type:'descr' },
  { key:'shifts',        label:'Shifts',         type:'descr' },
  { key:'goodQty',       label:'Good quantity',  type:'qty'   },
  { key:'scrap',         label:'Scrap',          type:'qty'   },
  { key:'potential',     label:'Potential',      type:'qty'   },
  { key:'totalQty',      label:'Total quantity', type:'qty'   },
];

// One quantities table row per value of the chosen X-axis dimension, from a
// (filtered) block set, + a bold Total row. Reuses OEE_DIMS / descrValues.
function qtyTableRows(blocks, dimKey) {
  const dim = OEE_DIMS[dimKey] || OEE_DIMS.operator;
  const bucket = {};
  blocks.forEach(b => dim.valsOf(b).forEach(v => (bucket[v] = bucket[v] || []).push(b)));
  const rows = dim.labels()
    .filter(v => bucket[v] && bucket[v].length)
    .map(v => {
      const bs = bucket[v];
      const r = rollupQty(bs);
      r.name = v;
      QTY_TABLE_COLS.filter(c => c.type === 'descr').forEach(c => { r[c.key] = descrValues(bs, c.key); });
      return r;
    });
  if (rows.length) {
    const tot = rollupQty(blocks);
    tot.name = 'Total'; tot._total = true;
    QTY_TABLE_COLS.filter(c => c.type === 'descr').forEach(c => { tot[c.key] = ''; });
    rows.push(tot);
  }
  return rows;
}

// Stacked quantities per X-axis category, optionally split by an inner
// dimension. Returns { labels, innerLabels, data } where data[outer][inner] is a
// rollupQty cell (or null). Mirrors oeeMatrixFromBlocks but for the qty buckets.
function qtyMatrixFromBlocks(blocks, outerDim, innerDim) {
  const O = OEE_DIMS[outerDim] || OEE_DIMS.operator;
  const I = OEE_DIMS[innerDim] || OEE_DIMS.leader;
  const bucket = {};
  blocks.forEach(b => {
    O.valsOf(b).forEach(ov => {
      I.valsOf(b).forEach(iv => {
        (bucket[ov] = bucket[ov] || {});
        (bucket[ov][iv] = bucket[ov][iv] || []).push(b);
      });
    });
  });
  const data = {};
  O.labels().forEach(ov => {
    data[ov] = {};
    I.labels().forEach(iv => {
      const bs = bucket[ov] && bucket[ov][iv];
      data[ov][iv] = (bs && bs.length) ? rollupQty(bs) : null;
    });
  });
  return { labels: O.labels(), innerLabels: I.labels(), data, outerHeader: O.header, innerHeader: I.header };
}

// Per-day stacked quantities for the Day (time) X-axis. One entry per day in
// SHIFT_BLOCKS, summing that day's blocks. (The OEE Day view uses synthetic
// OEE_DATA; Quantities derives the Day view straight from the blocks so it
// reconciles with the categorical views.)
function qtyByDay(blocks) {
  const byDay = new Map();
  blocks.forEach(b => { (byDay.get(b.day) || byDay.set(b.day, []).get(b.day)).push(b); });
  return [...byDay.keys()].sort((a,b)=>a-b).map(day => {
    const r = rollupQty(byDay.get(day));
    r.day = day; r.name = day;
    return r;
  });
}

// ── Date utilities ────────────────────────────────────────────────────────────

// True if two Date objects represent the same calendar day
function sameDay(a, b) {
  return a && b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();
}

// Mon-first day-of-week index (0 = Mon … 6 = Sun)
function mondayDow(date) {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

// DST-safe day offset — always constructs midnight local time
function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

// DD.MM.YYYY — used in compare descriptions and tooltip headers
function fmtDMY(d) {
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

// DD.MM.YYYY — used for the filter-bar button label
function fmtDMslashM(d) {
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

// ── Compare range computation ─────────────────────────────────────────────────
// Returns { cs, ce } for 'previous_period' or 'previous_year'.
// Returns null for 'custom_compare' (user picks manually).
// All required state is passed as arguments so this stays a pure function.

function computeRangeForMode(mode, rangeStart, rangeEnd, currentPreset, matchDow) {
  if (!rangeStart || !rangeEnd || mode === 'custom_compare') return null;

  // Inclusive day count: e.g. Mar 30–Apr 5 = 7 days → len = 6
  const len = Math.round((
    Date.UTC(rangeEnd.getFullYear(),   rangeEnd.getMonth(),   rangeEnd.getDate()) -
    Date.UTC(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate())
  ) / 86400000);

  let cs, ce;

  if (mode === 'previous_period') {
    if (currentPreset === 'this_week' || currentPreset === 'last_week') {
      // Shift exactly 7 days back so weekdays align
      cs = addDays(rangeStart, -7);
      ce = addDays(rangeEnd,   -7);
    } else if (currentPreset === 'this_month') {
      // Full previous month (preceding period regardless of how far into current month we are)
      const prevMonth = rangeStart.getMonth() - 1;
      const prevYear  = prevMonth < 0 ? rangeStart.getFullYear() - 1 : rangeStart.getFullYear();
      const adjMonth  = (prevMonth + 12) % 12;
      cs = new Date(prevYear, adjMonth, 1);
      ce = new Date(prevYear, adjMonth + 1, 0); // last day of previous month
    } else if (currentPreset === 'this_quarter' || currentPreset === 'last_quarter') {
      const prevQMonth = rangeStart.getMonth() - 3;
      const prevQYear  = prevQMonth < 0 ? rangeStart.getFullYear() - 1 : rangeStart.getFullYear();
      cs = new Date(prevQYear, (prevQMonth + 12) % 12, 1);
      ce = currentPreset === 'last_quarter'
        ? addDays(rangeStart, -1)   // full previous quarter
        : addDays(cs, len);         // same days into previous quarter
    } else if (currentPreset === 'this_year') {
      cs = new Date(rangeStart.getFullYear() - 1, 0, 1);
      ce = addDays(cs, len);
    } else {
      ce = addDays(rangeStart, -1);
      cs = addDays(ce, -len);
    }
  } else if (mode === 'previous_year') {
    cs = new Date(rangeStart.getFullYear() - 1, rangeStart.getMonth(), rangeStart.getDate());
    ce = new Date(rangeEnd.getFullYear()   - 1, rangeEnd.getMonth(),   rangeEnd.getDate());
  }

  // Apply "Match day of week" shift (DST-safe)
  if (matchDow) {
    const mainDow = mondayDow(rangeStart);
    const cmpDow  = mondayDow(cs);
    let delta = mainDow - cmpDow;
    if (delta > 3)  delta -= 7;
    if (delta < -3) delta += 7;
    cs = addDays(cs, delta);
    ce = addDays(ce, delta);
  }

  return { cs, ce };
}

// ── Data aggregation ──────────────────────────────────────────────────────────
// Groups baseData rows by nameKey, totalling numeric fields and building a
// stacked `segments` array (one entry per stop group) for the chart.

function aggregateBy(nameKey, baseData) {
  const map    = new Map(); // nameKey value → aggregated row
  const segMap = new Map(); // nameKey value → Map(group → {mainDur, cmpDur})
  const opSet  = new Map(); // nameKey value → { main:Set, cmp:Set } distinct operators

  baseData.forEach(d => {
    // Split comma-separated multi-values so each individual item gets its own bar
    const rawVal = d[nameKey] || 'Unknown';
    const keys   = rawVal.split(',').map(k => k.trim()).filter(k => k);
    const n      = keys.length; // distribute numeric values evenly across keys

    keys.forEach(k => {
      if (!map.has(k)) {
        map.set(k, {
          name: k, group: k,
          mainDur:0, cmpDur:0, mainCount:0, cmpCount:0,
          mainAvg:0, cmpAvg:0, notes:0, cmpNotes:0,
          mainPct:0, cmpPct:0,
          station: d.station, cmpStation: d.cmpStation,
          stationGroup: d.stationGroup, cmpStationGroup: d.cmpStationGroup,
          stopType: d.stopType, location: d.location, cmpLocation: d.cmpLocation,
          productGroup: d.productGroup, cmpProductGroup: d.cmpProductGroup,
          product: d.product, cmpProduct: d.cmpProduct,
          productCode: d.productCode, cmpProductCode: d.cmpProductCode,
          shift: d.shift, cmpShift: d.cmpShift,
          operator: d.operator, cmpOperator: d.cmpOperator,
          operatorRole: d.operatorRole, cmpOperatorRole: d.cmpOperatorRole,
          operatorGroupName: d.operatorGroupName, cmpOperatorGroupName: d.cmpOperatorGroupName,
          loss: 0, cmpLoss: 0, durOee: 0, cmpDurOee: 0,
          plannedTime: d.plannedTime, cmpPlannedTime: d.cmpPlannedTime,
          mainManhours: 0, cmpManhours: 0,
          _n: 0
        });
        segMap.set(k, new Map());
        opSet.set(k, { main: new Set(), cmp: new Set() });
      }
      const row = map.get(k);
      const sg  = segMap.get(k);
      // Collect distinct operators feeding this key (for deduped manhours).
      const os = opSet.get(k);
      operatorList(d.operator).forEach(nm => os.main.add(nm));
      operatorList(d.cmpOperator).forEach(nm => os.cmp.add(nm));
      row.mainDur      += Math.round(d.mainDur      / n); row.cmpDur      += Math.round(d.cmpDur      / n);
      row.mainCount    += Math.round(d.mainCount    / n); row.cmpCount    += Math.round(d.cmpCount    / n);
      row.notes        += Math.round(d.notes        / n); row.cmpNotes    += Math.round(d.cmpNotes    / n);
      row.loss         += Math.round(d.loss         / n); row.cmpLoss     += Math.round(d.cmpLoss     / n);
      row.durOee       += Math.round(d.durOee       / n); row.cmpDurOee   += Math.round(d.cmpDurOee   / n);
      // mainManhours/cmpManhours intentionally NOT summed here — computed from
      // the distinct operator set after the loop (operator-level dedup).
      row.mainPct      += d.mainPct / n;                  row.cmpPct      += d.cmpPct   / n;
      row._n++;
      if (!sg.has(d.name)) sg.set(d.name, { name: d.name, group: d.group, mainDur: 0, cmpDur: 0 });
      sg.get(d.name).mainDur += Math.round(d.mainDur / n);
      sg.get(d.name).cmpDur  += Math.round(d.cmpDur  / n);
    });
  });

  map.forEach((row, k) => {
    if (row._n > 0) {
      row.mainAvg = Math.round(row.mainDur / row._n);
      row.cmpAvg  = Math.round(row.cmpDur  / row._n);
      row.mainPct = Math.round(row.mainPct / row._n);
      row.cmpPct  = Math.round(row.cmpPct  / row._n);
    }
    // Operator-level deduped manhours: Σ distinct operators' hours for this key.
    const os = opSet.get(k);
    row.mainManhours = [...os.main].reduce((s, nm) => s + ((OPERATOR_DIRECTORY[nm]?.hours)    || 0), 0);
    row.cmpManhours  = [...os.cmp ].reduce((s, nm) => s + ((OPERATOR_DIRECTORY[nm]?.cmpHours) || 0), 0);
    row.segments = [...segMap.get(k).entries()]
      .map(([, v]) => ({ name: v.name, group: v.group, mainDur: v.mainDur, cmpDur: v.cmpDur }))
      .sort((a, b) => b.mainDur - a.mainDur);
  });

  return [...map.values()];
}

// Generates synthetic time-series rows (stacked by stop group) for time-based axes.
// cmpCount:  how many leading labels have compare data (undefined = all).
// mainCount: how many leading labels have main-period data (undefined = all).
//   Slots beyond mainCount get mainDur=0 (placeholder bar for compare-only slots).
function mockTimeSeries(labels, cmpCount, mainCount, cmpLabels) {
  const nCmp  = (cmpCount  !== undefined) ? cmpCount  : labels.length;
  const nMain = (mainCount !== undefined) ? mainCount : labels.length;
  const MOCK_SEGS = [
    { name:'Uncommented',   group:'Uncommented', w:3.0 },
    { name:'Motor failure', group:'Mechanical',  w:2.0 },
    { name:'Planned maint.',group:'Planned',     w:1.5 },
    { name:'Mat. shortage', group:'Material',    w:1.0 },
    { name:'Changeover',    group:'Setup',       w:0.8 },
    { name:'Quality check', group:'Quality',     w:0.5 },
  ];
  const totalW = MOCK_SEGS.reduce((s, g) => s + g.w, 0);

  return labels.map((lbl, idx) => {
    const hasMain    = idx < nMain;
    const hasCompare = idx < nCmp;
    const totalMain = hasMain    ? 80  + Math.round(Math.random() * 240) : 0;
    const totalCmp  = hasCompare ? 60  + Math.round(Math.random() * 200) : 0;
    const cnt  = hasMain    ? 3  + Math.round(Math.random() * 15) : 0;
    const cCnt = hasCompare ? 2  + Math.round(Math.random() * 12) : 0;

    const segments = MOCK_SEGS.map(sg => ({
      name:    sg.name,
      group:   sg.group,
      mainDur: hasMain    ? Math.max(1, Math.round(totalMain * sg.w / totalW * (0.65 + Math.random() * 0.7))) : 0,
      cmpDur:  hasCompare ? Math.max(1, Math.round(totalCmp  * sg.w / totalW * (0.65 + Math.random() * 0.7))) : 0,
    })).sort((a, b) => b.mainDur - a.mainDur);

    const mainDur = segments.reduce((s, sg) => s + sg.mainDur, 0);
    const cmpDur  = segments.reduce((s, sg) => s + sg.cmpDur,  0);

    return {
      name: lbl, group: lbl,
      mainDur, cmpDur,
      mainCount: cnt,  cmpCount: cCnt,
      mainAvg: hasMain    ? Math.round(mainDur / Math.max(1, cnt)) : 0,
      cmpAvg:  hasCompare ? Math.round(cmpDur  / Math.max(1, cCnt)) : 0,
      notes: hasMain    ? Math.round(Math.random()*4) : 0,
      cmpNotes: hasCompare ? Math.round(Math.random()*3) : 0,
      mainPct: hasMain    ? 5 + Math.round(Math.random()*30) : 0,
      cmpPct:  hasCompare ? 5 + Math.round(Math.random()*25) : 0,
      station:'CNC-01', cmpStation:'CNC-02', stationGroup:'CNC', cmpStationGroup:'CNC',
      stopType:'Unplanned', location:'Hall A', cmpLocation:'Hall A',
      productGroup:'Electronics', cmpProductGroup:'Electronics',
      product:'Widget Pro', cmpProduct:'Circuit Bd.',
      productCode:'PRD-001', cmpProductCode:'PRD-004',
      shift:'Morning', cmpShift:'Night', operator:'M. Kostopoulou', cmpOperator:'E. Christodoulou',
      loss: mainDur, cmpLoss: cmpDur, durOee: mainDur, cmpDurOee: cmpDur,
      plannedTime: 800, cmpPlannedTime: 800,
      cmpName: (cmpLabels && cmpLabels[idx]) ? cmpLabels[idx] : undefined,
      segments
    };
  });
}

// Returns how many leading time-unit slots in the main period have a corresponding
// slot in the compare period. Used to zero out compare bars beyond the compare range.
function _cmpUnitCount(unit) {
  if (typeof _appliedCompareOn === 'undefined' || !_appliedCompareOn) return undefined;
  if (typeof compareStart === 'undefined' || !compareStart || !compareEnd) return undefined;
  const cs = compareStart, ce = compareEnd;
  if (unit === 'day')     return Math.round((ce - cs) / 86400000) + 1;
  if (unit === 'week')    return Math.ceil((Math.round((ce - cs) / 86400000) + 1) / 7);
  if (unit === 'month')   return (ce.getFullYear()-cs.getFullYear())*12 + (ce.getMonth()-cs.getMonth()) + 1;
  if (unit === 'quarter') return Math.floor(ce.getFullYear()*4+Math.floor(ce.getMonth()/3)) - Math.floor(cs.getFullYear()*4+Math.floor(cs.getMonth()/3)) + 1;
  if (unit === 'year')    return ce.getFullYear() - cs.getFullYear() + 1;
  return undefined;
}

// Generates the compare-period time-unit labels for a given unit type.
// Used to populate cmpName on each time-series item.
function _cmpLabels(unit) {
  if (typeof _appliedCompareOn === 'undefined' || !_appliedCompareOn) return [];
  if (typeof compareStart === 'undefined' || !compareStart) return [];
  const cs = compareStart;
  const ce = (typeof compareEnd !== 'undefined' && compareEnd) ? compareEnd : compareStart;
  const labels = [];
  if (unit === 'day') {
    const DOW3 = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const cur = new Date(cs); cur.setHours(0,0,0,0);
    const last = new Date(ce); last.setHours(0,0,0,0);
    while (cur <= last && labels.length < 60)
      { labels.push(`${DOW3[cur.getDay()]} ${cur.getDate()}`); cur.setDate(cur.getDate()+1); }
  } else if (unit === 'week') {
    const cur = new Date(cs); cur.setHours(0,0,0,0);
    cur.setDate(cur.getDate() - ((cur.getDay()+6)%7));
    const last = new Date(ce); last.setHours(0,0,0,0);
    while (cur <= last && labels.length < 53) {
      const jan1 = new Date(cur.getFullYear(), 0, 1);
      const wk = Math.ceil(((cur-jan1)/86400000 + ((jan1.getDay()+6)%7) + 1) / 7);
      labels.push(`W${String(wk).padStart(2,'0')}`);
      cur.setDate(cur.getDate() + 7);
    }
  } else if (unit === 'month') {
    const cur = new Date(cs.getFullYear(), cs.getMonth(), 1);
    const last = new Date(ce.getFullYear(), ce.getMonth(), 1);
    while (cur <= last)
      { labels.push(MONTHS[cur.getMonth()].slice(0,3)); cur.setMonth(cur.getMonth()+1); }
  } else if (unit === 'quarter') {
    let y = cs.getFullYear(), q = Math.floor(cs.getMonth()/3);
    const ey = ce.getFullYear(), eq = Math.floor(ce.getMonth()/3);
    const multiYear = ey > cs.getFullYear();
    while (y < ey || (y === ey && q <= eq)) {
      labels.push(multiYear ? `Q${q+1} ${y}` : `Q${q+1}`);
      if (++q > 3) { q=0; y++; }
    }
  } else if (unit === 'year') {
    for (let y = cs.getFullYear(); y <= ce.getFullYear(); y++) labels.push(String(y));
  }
  return labels;
}

// Returns the chart/table dataset for the given X-axis selection.
// baseData must be the current STOP_REASONS_DATA snapshot (from app state).
function getAxisData(xAxis, baseData) {
  switch (xAxis) {
    case 'Stop reasons':     return baseData.map(d => ({...d}));
    case 'Stop groups':      return aggregateBy('group',        baseData);
    case 'Machine locations':return aggregateBy('location',     baseData);
    case 'Stations':         return aggregateBy('station',      baseData);
    case 'Station groups':   return aggregateBy('stationGroup', baseData);
    case 'Factories':        return mockTimeSeries(['Factory A','Factory B','Factory C']);
    case 'Operators':        return aggregateBy('operator',          baseData);
    case 'Operator group':   return aggregateBy('operatorGroupName',  baseData);
    // One bar per leading supervisor. Rows with no leader are dropped (a leader
    // X-axis only makes sense for shifts that had one).
    case 'Shift leaders':    return aggregateBy('leader', baseData.filter(d => d.leader));
    case 'Products':         return aggregateBy('product',      baseData);
    case 'Product code':     return aggregateBy('productCode',  baseData);
    case 'Orders':           return mockTimeSeries(['ORD-1001','ORD-1002','ORD-1003','ORD-1004','ORD-1005']);
    case 'LOT/Batch':        return mockTimeSeries(['LOT-A1','LOT-A2','LOT-B1','LOT-B2','LOT-C1']);
    case 'Product groups':   return aggregateBy('productGroup', baseData);
    case 'Shifts':           return aggregateBy('shift',        baseData);
    case 'Day': {
      const rs = (typeof rangeStart !== 'undefined') ? rangeStart : null;
      const re = (typeof rangeEnd   !== 'undefined') ? rangeEnd   : null;
      if (rs && re) {
        const DOW3 = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const labels = []; const cur = new Date(rs); cur.setHours(0,0,0,0);
        const last = new Date(re); last.setHours(0,0,0,0);
        while (cur <= last && labels.length < 60)
          { labels.push(`${DOW3[cur.getDay()]} ${cur.getDate()}`); cur.setDate(cur.getDate()+1); }
        const mainLen = labels.length;
        const cmpLen  = _cmpUnitCount('day');
        const overflow = (cmpLen !== undefined) ? Math.max(0, cmpLen - mainLen) : 0;
        for (let i = 0; i < overflow && labels.length < 60; i++)
          { labels.push(`${DOW3[cur.getDay()]} ${cur.getDate()}`); cur.setDate(cur.getDate()+1); }
        return mockTimeSeries(labels, cmpLen, mainLen, _cmpLabels('day'));
      }
      return mockTimeSeries(['Mon 3','Tue 4','Wed 5','Thu 6','Fri 7','Sat 8','Sun 9']);
    }
    case 'Day of the week':  return mockTimeSeries(['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
    case 'Week': {
      const rs = (typeof rangeStart !== 'undefined') ? rangeStart : null;
      const re = (typeof rangeEnd   !== 'undefined') ? rangeEnd   : null;
      if (rs && re) {
        const labels = [];
        const cur = new Date(rs); cur.setHours(0,0,0,0);
        cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7)); // back to Monday
        const last = new Date(re); last.setHours(0,0,0,0);
        while (cur <= last && labels.length < 53) {
          const jan1 = new Date(cur.getFullYear(), 0, 1);
          const wk = Math.ceil(((cur - jan1) / 86400000 + ((jan1.getDay()+6)%7) + 1) / 7);
          labels.push(`W${String(wk).padStart(2,'0')}`);
          cur.setDate(cur.getDate() + 7);
        }
        const mainLen = labels.length;
        const cmpLen  = _cmpUnitCount('week');
        const overflow = (cmpLen !== undefined) ? Math.max(0, cmpLen - mainLen) : 0;
        for (let i = 0; i < overflow && labels.length < 53; i++) {
          const jan1 = new Date(cur.getFullYear(), 0, 1);
          const wk = Math.ceil(((cur - jan1) / 86400000 + ((jan1.getDay()+6)%7) + 1) / 7);
          labels.push(`W${String(wk).padStart(2,'0')}`);
          cur.setDate(cur.getDate() + 7);
        }
        return mockTimeSeries(labels, cmpLen, mainLen, _cmpLabels('week'));
      }
      return mockTimeSeries(['W01','W02','W03','W04','W05']);
    }
    case 'Month': {
      const rs = (typeof rangeStart !== 'undefined') ? rangeStart : null;
      const re = (typeof rangeEnd   !== 'undefined') ? rangeEnd   : null;
      if (rs && re) {
        const labels = [];
        const cur = new Date(rs.getFullYear(), rs.getMonth(), 1);
        const last = new Date(re.getFullYear(), re.getMonth(), 1);
        while (cur <= last)
          { labels.push(MONTHS[cur.getMonth()].slice(0,3)); cur.setMonth(cur.getMonth()+1); }
        const mainLen = labels.length;
        const cmpLen  = _cmpUnitCount('month');
        const overflow = (cmpLen !== undefined) ? Math.max(0, cmpLen - mainLen) : 0;
        for (let i = 0; i < overflow; i++)
          { labels.push(MONTHS[cur.getMonth()].slice(0,3)); cur.setMonth(cur.getMonth()+1); }
        return mockTimeSeries(labels, cmpLen, mainLen, _cmpLabels('month'));
      }
      return mockTimeSeries(['Jan','Feb','Mar','Apr','May','Jun']);
    }
    case 'Quarter': {
      const rs = (typeof rangeStart !== 'undefined') ? rangeStart : null;
      const re = (typeof rangeEnd   !== 'undefined') ? rangeEnd   : null;
      if (rs && re) {
        const labels = [];
        let y = rs.getFullYear(), q = Math.floor(rs.getMonth()/3);
        const ey = re.getFullYear(), eq = Math.floor(re.getMonth()/3);
        const multiYear = ey > rs.getFullYear();
        while (y < ey || (y === ey && q <= eq)) {
          labels.push(multiYear ? `Q${q+1} ${y}` : `Q${q+1}`);
          if (++q > 3) { q=0; y++; }
        }
        const mainLen = labels.length;
        const cmpLen  = _cmpUnitCount('quarter');
        const overflow = (cmpLen !== undefined) ? Math.max(0, cmpLen - mainLen) : 0;
        for (let i = 0; i < overflow; i++) {
          labels.push(`Q${q+1} ${y}`);
          if (++q > 3) { q=0; y++; }
        }
        return mockTimeSeries(labels, cmpLen, mainLen, _cmpLabels('quarter'));
      }
      return mockTimeSeries(['Q1','Q2','Q3','Q4']);
    }
    case 'Year': {
      const rs = (typeof rangeStart !== 'undefined') ? rangeStart : null;
      const re = (typeof rangeEnd   !== 'undefined') ? rangeEnd   : null;
      if (rs && re) {
        const labels = [];
        let y = rs.getFullYear();
        for (; y <= re.getFullYear(); y++) labels.push(String(y));
        const mainLen = labels.length;
        const cmpLen  = _cmpUnitCount('year');
        const overflow = (cmpLen !== undefined) ? Math.max(0, cmpLen - mainLen) : 0;
        for (let i = 0; i < overflow; i++) labels.push(String(y++));
        return mockTimeSeries(labels, cmpLen, mainLen, _cmpLabels('year'));
      }
      return mockTimeSeries(['2022','2023','2024','2025']);
    }
    default:                 return baseData.map(d => ({...d}));
  }
}
