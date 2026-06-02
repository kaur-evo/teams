// Shared mock data for operators & teams prototypes
// Used by: setup-proto.html, index.html

const DATA_VERSION = 19; // bump to wipe stale localStorage

// Tags are setup-only descriptive labels (not used in Shift View role pick).
const MOCK_TAGS = ['Night-shift', 'Trainer', 'Newcomer', 'Bilingual'];

// Roles are picked per operator (single-select). Supervisor is available on
// the Pro tier; the rest are Enterprise-flagged in the UI (greyed + pill).
const MOCK_ROLES = ['Supervisor', 'Quality', 'Maintenance', 'External'];

const MOCK_STATIONS = [
  'Filling Line 1', 'Filling Line 2', 'Packaging A', 'Packaging B',
  'Warehouse', 'Quality Lab'
];

const MOCK_FACTORIES = [
  { id: 1, name: 'Athens Plant' },
  { id: 2, name: 'Warsaw Packaging' },
  { id: 3, name: 'Casablanca Production' },
];

// Operator groups. "Operators" is the mandatory fallback bucket for operators
// who don't fit into any named group. Always present.
// Teams (operator groups). `isGlobal: true` → visible across all factories
// (factoryIds ignored). Otherwise `factoryIds: number[]` lists which factories
// the group is scoped to.
const MOCK_TEAMS = [
  { id: 1, name: 'Operators', color: '#9e9e9e', isGlobal: true, factoryIds: [], tags: [] },
];

// Operators all sit in the Operators group out of the box — Kaur creates named
// groups if/when needed. `canLead` (Leader mode) is granted to a couple of
// operators so the leader-select demo works.
const MOCK_OPERATORS = [
  { id: 1, firstName: 'Vasilis',  lastName: 'Mavroeidis',   role: null, tags: ['Night-shift'], teamId: 1, canLead: true, stations: ['Filling Line 1', 'Filling Line 2', 'Packaging A', 'Packaging B'] },
  { id: 2, firstName: 'Nikos',    lastName: 'Papadopoulos', role: null, tags: ['Trainer'],     teamId: 1, canLead: true, stations: ['Filling Line 1', 'Filling Line 2', 'Warehouse'] },
  { id: 3, firstName: 'Maria',    lastName: 'Kostopoulou',  role: null, tags: [],              teamId: 1,                stations: ['Filling Line 1', 'Packaging A', 'Packaging B'] },
  { id: 4, firstName: 'Giorgos',  lastName: 'Antoniou',     role: null, tags: [],              teamId: 1,                stations: ['Packaging A', 'Packaging B', 'Warehouse'] },
  { id: 5, firstName: 'Elena',    lastName: 'Christodoulou',role: null, tags: ['Newcomer'],    teamId: 1,                stations: ['Filling Line 2', 'Packaging A', 'Quality Lab'] },
  { id: 6, firstName: 'Dimitris', lastName: 'Ekonomou',     role: null, tags: [],              teamId: 1,                stations: ['Packaging A', 'Packaging B', 'Warehouse'] },
  { id: 7, firstName: 'Stavros',  lastName: 'Nikolaou',     role: null, tags: [],              teamId: 1,                stations: ['Filling Line 1', 'Warehouse', 'Quality Lab'] },
  { id: 8, firstName: 'Sofia',    lastName: 'Panagiotou',   role: null, tags: ['Night-shift'], teamId: 1,                stations: ['Quality Lab', 'Packaging B'] },
];

// Per-station feature toggles. Off by default — Spiros constraint: "must be optional".
const MOCK_STATION_SETTINGS = MOCK_STATIONS.map(name => ({
  name,
  enableShiftLeader: false,
}));

// The station currently shown in the Shift View prototype. Toggling its
// `enableShiftLeader` flag governs whether the bottom-bar chip elevates the leader.
const SHIFT_VIEW_STATION = MOCK_STATIONS[0]; // 'Filling Line 1'

// ── Shared persistence layer (localStorage) ──
// Both setup-proto and shift-view use this to stay in sync.
// _checkVersion() wipes stale data whenever DATA_VERSION is bumped.
const SharedData = {
  _KEY_TEAMS:    'evocon_teams',
  _KEY_OPS:      'evocon_operators',
  _KEY_STATIONS: 'evocon_stations',
  _KEY_VERSION:  'evocon_data_version',

  _checkVersion() {
    if (localStorage.getItem(this._KEY_VERSION) !== String(DATA_VERSION)) {
      localStorage.removeItem(this._KEY_TEAMS);
      localStorage.removeItem(this._KEY_OPS);
      localStorage.removeItem(this._KEY_STATIONS);
      localStorage.setItem(this._KEY_VERSION, String(DATA_VERSION));
    }
  },

  getTeams() {
    this._checkVersion();
    const s = localStorage.getItem(this._KEY_TEAMS);
    return s ? JSON.parse(s) : JSON.parse(JSON.stringify(MOCK_TEAMS));
  },
  getOperators() {
    this._checkVersion();
    const s = localStorage.getItem(this._KEY_OPS);
    return s ? JSON.parse(s) : JSON.parse(JSON.stringify(MOCK_OPERATORS));
  },
  getStations() {
    this._checkVersion();
    const s = localStorage.getItem(this._KEY_STATIONS);
    return s ? JSON.parse(s) : JSON.parse(JSON.stringify(MOCK_STATION_SETTINGS));
  },
  saveTeams(teams) {
    localStorage.setItem(this._KEY_TEAMS, JSON.stringify(teams));
  },
  saveOperators(operators) {
    localStorage.setItem(this._KEY_OPS, JSON.stringify(operators));
  },
  saveStations(stations) {
    localStorage.setItem(this._KEY_STATIONS, JSON.stringify(stations));
  },
  reset() {
    localStorage.removeItem(this._KEY_TEAMS);
    localStorage.removeItem(this._KEY_OPS);
    localStorage.removeItem(this._KEY_STATIONS);
    localStorage.removeItem(this._KEY_VERSION);
  },
};
