// Shared mock data for operators & teams prototypes
// Used by: setup-proto.html, index.html

const DATA_VERSION = 8; // bump to wipe stale localStorage

const MOCK_TAGS = ['Supervisor', 'Quality', 'Maintenance'];

const MOCK_STATIONS = [
  'Filling Line 1', 'Filling Line 2', 'Packaging A', 'Packaging B',
  'Warehouse', 'Quality Lab'
];

const MOCK_FACTORIES = [
  { id: 1, name: 'Athens Plant' },
  { id: 2, name: 'Warsaw Packaging' },
  { id: 3, name: 'Casablanca Production' },
];

// Team colors come from the Evocon Design System "Chart colors" palette
// (Figma node 178:218 / --chart-* tokens in evocon-ui.css).
const MOCK_TEAMS = [
  { id: 1, name: 'Team Green', color: '#2ecc71', factoryId: 1 }, // --chart-green
  { id: 2, name: 'Team Red',   color: '#800808', factoryId: 2 }, // --chart-red
];

// First operator in each team carries ['Supervisor']. All others have no tags.
const MOCK_OPERATORS = [
  // ── Team Green ──
  { id: 1,  firstName: 'Vasilis',   lastName: 'Mavroeidis',    tags: ['Supervisor'], teamId: 1, stations: ['Filling Line 1', 'Filling Line 2'] },
  { id: 2,  firstName: 'Nikos',     lastName: 'Papadopoulos',  tags: [],             teamId: 1, stations: ['Filling Line 1'] },
  { id: 3,  firstName: 'Maria',     lastName: 'Kostopoulou',   tags: [],             teamId: 1, stations: ['Filling Line 1'] },
  { id: 4,  firstName: 'Giorgos',   lastName: 'Antoniou',      tags: [],             teamId: 1, stations: ['Packaging A'] },
  { id: 5,  firstName: 'Elena',     lastName: 'Christodoulou', tags: [],             teamId: 1, stations: ['Packaging A', 'Packaging B'] },
  { id: 6,  firstName: 'Dimitris',  lastName: 'Ekonomou',      tags: [],             teamId: 1, stations: ['Packaging B'] },
  { id: 7,  firstName: 'Stavros',   lastName: 'Nikolaou',      tags: [],             teamId: 1, stations: ['Warehouse'] },
  { id: 8,  firstName: 'Katerina',  lastName: 'Georgiou',      tags: [],             teamId: null, stations: ['Filling Line 2'] },
  { id: 9,  firstName: 'Andreas',   lastName: 'Karagiannis',   tags: [],             teamId: null, stations: ['Warehouse'] },
  { id: 10, firstName: 'Sofia',     lastName: 'Panagiotou',    tags: [],             teamId: null, stations: ['Quality Lab'] },

  // ── Team Red ──
  { id: 11, firstName: 'Jonas',     lastName: 'Hermansen',     tags: ['Supervisor'], teamId: 2, stations: ['Filling Line 2', 'Packaging B'] },
  { id: 12, firstName: 'Pawel',     lastName: 'Herchel',       tags: [],             teamId: 2, stations: ['Filling Line 2'] },
  { id: 13, firstName: 'Rafal',     lastName: 'Cebula',        tags: [],             teamId: 2, stations: ['Filling Line 1'] },
  { id: 14, firstName: 'Łukasz',    lastName: 'Biłas',         tags: [],             teamId: 2, stations: ['Filling Line 1', 'Warehouse'] },
  { id: 15, firstName: 'Marta',     lastName: 'Kowalska',      tags: [],             teamId: 2, stations: ['Packaging A'] },
  { id: 16, firstName: 'Tomasz',    lastName: 'Wiśniewski',    tags: [],             teamId: 2, stations: ['Packaging A', 'Packaging B'] },
  { id: 17, firstName: 'Anna',      lastName: 'Nowak',         tags: [],             teamId: 2, stations: ['Packaging B'] },
  { id: 18, firstName: 'Piotr',     lastName: 'Kamiński',      tags: [],             teamId: 2, stations: ['Filling Line 2'] },
  { id: 19, firstName: 'Agnieszka', lastName: 'Zielińska',     tags: [],             teamId: null, stations: ['Warehouse'] },
  { id: 20, firstName: 'Marek',     lastName: 'Lewandowski',   tags: [],             teamId: null, stations: ['Quality Lab'] },
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
