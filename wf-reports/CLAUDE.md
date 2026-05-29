# Wireframe – Reports Comparison Feature

## File map

| File | Role | Read when |
|------|------|-----------|
| `index.html` | View — HTML structure + CSS | changing layout or styles |
| `data.js` | Model — static config + mock data + pure functions | changing data shape, presets, column defs, date math |
| `logic.js` | Controller — app state + all event handlers + rendering | changing any behaviour or UI output |

Load order matters: `data.js` must execute before `logic.js` (both are `<script src>` tags at the bottom of `index.html`). All symbols are globals.

---

## data.js sections (347 lines)

| Line | Section | Key symbols |
|------|---------|-------------|
| 7 | Calendar constants | `MONTHS`, `DOW` |
| 13 | Preset labels | `PRESET_LABELS` — maps preset key → button text |
| 23 | X-axis options | `XAXIS_OPTIONS` (ordered list), `TIME_AXES` (Set) |
| 34 | Table columns | `DT_COLS` — column defs (key, label, width, align, mono, unit) |
| 61 | SVG icons | `ICON_Y_INLINE`, `ICON_OPEN` |
| 66 | Figma asset URLs | `RADIO_ON/OFF`, `CHECK_ON/OFF`, `ICON_X_URL`, `ICON_Y_URL` |
| 75 | Chart colors | `STOP_GROUP_COLORS` (named groups), `CHART_PALETTE` (fallback) |
| 85 | Mock dataset | `STOP_REASONS_DATA` — 15 rows, each with `mainDur/cmpDur`, `mainCount/cmpCount`, etc. |
| 122 | Date utilities | `sameDay`, `mondayDow`, `addDays`, `fmtDMY`, `fmtDMslashM` |
| 153 | Compare range | `computeRangeForMode(mode, rangeStart, rangeEnd, currentPreset, matchDow)` → `{cs,ce}` |
| 215 | Aggregation | `aggregateBy(nameKey, baseData)`, `mockTimeSeries(labels)`, `getAxisData(xAxis, baseData)` |

---

## logic.js sections (1032 lines)

| Line | Section | Key symbols |
|------|---------|-------------|
| 7 | App state | `rangeStart/End`, `leftMonth/rightMonth`, `picking`, `currentPreset`, `_appliedCompareOn`, `_pickerSnapshot` |
| 28 | Compare state | `compareMode`, `matchDow`, `compareStart/End`, `comparePicking` |
| 35 | Table state | `_dtData`, `_dtPage` |
| 40 | Display-month helpers | `inRange(d)`, `setDisplayMonths(start, end)` |
| 71 | Calendar rendering | `renderCalendar(titleId, gridId, year, month)`, `renderCalendars()`, `updateNavButtons()` |
| 179 | Navigation | `navigate(dir)` — dir: -1 / 1 / 2 |
| 198 | Day click | `handleDayClick(year, month, day)` — branches on `comparePicking` vs `picking` |
| 240 | Preset chips | `selectPreset(el)`, `clearChips()`, `selectChipByPreset(preset)` |
| 323 | Filter-bar label | `updateFilterBtn()` |
| 341 | Picker open/close | `toggleDatePicker()`, `closeDatePicker()` (reverts to `_pickerSnapshot`), `applyDatePicker()` |
| 413 | Compare chip | `updateCompareChip()`, `removeCompare()` |
| 453 | Match-DOW checkbox | `updateMatchDowVisibility()` |
| 468 | Compare panel | `toggleCompare()`, `selectCompareMode(btn, mode)`, `activateComparePicking()`, `toggleMatchDow()`, `updateCompareDescriptions()`, `updateCompareDates()` |
| 577 | Data table | `initTable(data)`, `renderTable()`, `initTableEvents()`, `dtPrev()`, `dtNext()` |
| 765 | Chart | `initChart()`, `drawChartWith(items)` — sets `updateChartCompare` closure |
| 972 | X-axis | `redrawChart(xAxis)`, `toggleXAxisDropdown()`, `selectXAxis(option)`, `buildXAxisDropdown()` |
| 1024 | Init | calls `setDisplayMonths`, `renderCalendars`, `initChart`, `buildXAxisDropdown`, `initTableEvents` |

---

## Key wiring

- **Compare on/off** — `applyDatePicker()` calls `updateChartCompare(isOn)` (a closure set by `drawChartWith`) and `updateCompareChip()`. Removing via the ✕ chip calls `removeCompare()`.
- **X-axis change** → `redrawChart(xAxis)` → `getAxisData(xAxis, _chartBaseData)` → `drawChartWith(items)` → `initTable(items)`.
- **`_chartBaseData`** always stays at the stop-reason level (15 rows). Aggregated views are computed on the fly from it; only `redrawChart('Stop reasons')` overwrites it.
- **Picker snapshot** — `toggleDatePicker()` saves all state to `_pickerSnapshot`; `closeDatePicker()` restores it. `applyDatePicker()` clears it (commit).
- **`_appliedCompareOn`** tracks the last *applied* compare state (not the in-picker state). Guards compare columns in `renderTable` and tooltip in `drawChartWith`.
