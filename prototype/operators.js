/**
 * operators.js — Operators Panel component for Shift View
 * Manages operator/helper entries during a shift.
 * Depends on: mock-data.js (MOCK_OPERATORS, MOCK_TEAMS, MOCK_TAGS)
 */
const OperatorsPanel = {
  props: {
    visible: Boolean,
  },
  emits: ['close', 'update:summary'],
  template: `
    <div v-if="visible" class="op-overlay" @click.self="handleOverlayClick">
      <div class="op-modal" :class="{ 'op-modal-tall': currentView === 'add-operators' }">

        <!-- ═══════════ OVERVIEW ═══════════ -->
        <template v-if="currentView === 'overview'">
          <div class="op-header">
            <v-icon size="24" color="#212121">mdi-account-hard-hat</v-icon>
            <span class="op-header-title">Operators</span>
          </div>

          <div class="op-body">
            <div v-if="operatorEntries.length === 0 && helperEntries.length === 0" class="op-empty">
              No operators or helpers assigned yet.
            </div>

            <!-- Operator entry cards -->
            <div v-for="entry in operatorEntries" :key="'op-' + entry.id" class="op-card">
              <div class="op-card-top">
                <div class="op-card-left">
                  <span class="op-card-badge"
                        @mouseenter="showTooltip($event, getOperatorNames(entry))"
                        @mouseleave="hideTooltip">
                    <v-icon size="18" color="#757575">mdi-account-hard-hat</v-icon> {{ entry.operatorIds.length }}
                  </span>
                  <span v-if="entry.helperCount > 0" class="op-card-badge"
                        @mouseenter="showTooltip($event, 'Helpers - ' + entry.helperCount)"
                        @mouseleave="hideTooltip">
                    <v-icon size="18" color="#757575">mdi-account-group</v-icon> {{ entry.helperCount }}
                  </span>
                  <span class="op-card-names"
                        @mouseenter="showTooltip($event, getOperatorNames(entry))"
                        @mouseleave="hideTooltip">{{ getOperatorNames(entry) }}</span>
                </div>
                <div class="op-card-icons">
                  <button class="op-icon-btn" @click="deleteOperatorEntry(entry.id)" title="Delete"><v-icon size="24" color="#757575">mdi-delete</v-icon></button>
                  <button class="op-icon-btn" @click="duplicateOperatorEntry(entry.id)" title="Duplicate"><v-icon size="24" color="#757575">mdi-content-copy</v-icon></button>
                  <button class="op-icon-btn" @click="editOperatorEntry(entry.id)" title="Edit"><v-icon size="24" color="#757575">mdi-pencil</v-icon></button>
                </div>
              </div>
              <div class="op-card-bottom">
                <v-icon size="16" color="#212121">mdi-clock-outline</v-icon>
                <span>{{ entry.startTime }} - {{ entry.endTime }}</span>
              </div>
            </div>

            <!-- Helper entry cards -->
            <div v-for="entry in helperEntries" :key="'hlp-' + entry.id" class="op-card">
              <div class="op-card-top">
                <div class="op-card-left">
                  <span class="op-card-badge"
                        @mouseenter="showTooltip($event, 'Helpers - ' + entry.count)"
                        @mouseleave="hideTooltip">
                    <v-icon size="18" color="#757575">mdi-account-group</v-icon> {{ entry.count }}
                  </span>
                  <span class="op-card-names"
                        @mouseenter="showTooltip($event, 'Helpers - ' + entry.count)"
                        @mouseleave="hideTooltip">Helpers</span>
                </div>
                <div class="op-card-icons">
                  <button class="op-icon-btn" @click="deleteHelperEntry(entry.id)" title="Delete"><v-icon size="24" color="#757575">mdi-delete</v-icon></button>
                  <button class="op-icon-btn" @click="editHelperEntry(entry.id)" title="Edit"><v-icon size="24" color="#757575">mdi-pencil</v-icon></button>
                </div>
              </div>
              <div class="op-card-bottom">
                <v-icon size="16" color="#212121">mdi-clock-outline</v-icon>
                <span>{{ entry.startTime }} - {{ entry.endTime }}</span>
              </div>
            </div>
          </div>

          <div class="op-footer">
            <div class="op-footer-left">
              <button class="op-btn op-btn-green" @click="openAddOperators">
                <v-icon size="24" color="#2ecc71">mdi-plus</v-icon>
                <span>OPERATORS</span>
              </button>
            </div>
            <button class="op-btn op-btn-text" @click="$emit('close')">CLOSE</button>
          </div>
        </template>

        <!-- ═══════════ ADD OPERATORS ═══════════ -->
        <template v-if="currentView === 'add-operators'">
          <div class="op-header">
            <v-icon size="24" color="#212121">mdi-account-hard-hat</v-icon>
            <span class="op-header-title">Operators</span>
          </div>

          <div class="op-body op-body-scroll">
            <!-- Search -->
            <div class="op-search">
              <v-icon size="24" color="#9e9e9e">mdi-magnify</v-icon>
              <input type="text" v-model="searchQuery" placeholder="Search" class="op-search-input" />
            </div>

            <!-- Team-grouped checkboxes -->
            <div class="op-team-list">
              <div v-for="team in filteredTeams" :key="team.id" class="op-team-group">
                <!-- Team header -->
                <label class="op-check-row op-team-row" @click="toggleTeamCollapse(team.id)">
                  <span class="op-check-box" :class="{ checked: isTeamFullySelected(team.id), partial: isTeamPartiallySelected(team.id) }" @click.stop="toggleTeam(team.id)">
                    <v-icon v-if="isTeamFullySelected(team.id)" size="18" color="white">mdi-check</v-icon>
                    <v-icon v-else-if="isTeamPartiallySelected(team.id)" size="18" color="white">mdi-minus</v-icon>
                  </span>
                  <span class="op-team-label">{{ team.name }}</span>
                  <span style="margin-left:auto;display:flex;align-items:center;">
                    <v-icon size="24" color="#757575" :style="{ transform: collapsedTeams.has(team.id) ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }">mdi-chevron-down</v-icon>
                  </span>
                </label>

                <!-- Operator rows -->
                <div v-if="!collapsedTeams.has(team.id)" v-for="op in getFilteredTeamOperators(team.id)" :key="op.id" class="op-check-row op-op-row"
                  @mouseenter="hoveredOpId = op.id"
                  @mouseleave="handleRowMouseleave(op.id)">
                  <label class="op-check-row-inner">
                    <span class="op-check-box" :class="{ checked: formSelectedOps.includes(op.id) }" @click.prevent="toggleOperator(op.id)">
                      <v-icon v-if="formSelectedOps.includes(op.id)" size="18" color="white">mdi-check</v-icon>
                    </span>
                    <span class="op-op-name">{{ op.firstName }} {{ op.lastName }}</span>
                  </label>
                  <div class="op-tag-area" style="position:relative" @click.stop>
                    <!-- Has tags: always visible, click to open dropdown -->
                    <span v-if="op.tags && op.tags.length > 0"
                      class="op-tag-chip-readonly op-tag-chip-editable"
                      @click="openTagDropdown(op.id, $event)"
                      @mouseenter="op.tags.length > 1 ? showTooltip($event, op.tags.join(', ')) : null"
                      @mouseleave="op.tags.length > 1 ? hideTooltip() : null">
                      <v-icon size="18" color="#2ecc71">mdi-tag</v-icon>
                      {{ getTagLabel(op) }}
                    </span>
                    <!-- No tags: ghost chip appears on row hover -->
                    <span v-else-if="hoveredOpId === op.id || tagDropdownOpId === op.id"
                      class="op-tag-chip-ghost"
                      @click="openTagDropdown(op.id, $event)">
                      <v-icon size="18" color="#757575">mdi-tag</v-icon>
                      Tag
                      <v-icon size="18" color="#757575">mdi-menu-down</v-icon>
                    </span>
                    <!-- Dropdown — multi-select checkboxes. Teleported to <body>
                         and positioned via fixed coords so it escapes the
                         scroll container's overflow clipping. -->
                    <teleport to="body">
                      <div v-if="tagDropdownOpId === op.id"
                           class="op-tag-dropdown"
                           :style="{ top: tagDropdownPos.top + 'px', left: tagDropdownPos.left + 'px' }"
                           @click.stop>
                        <div v-for="tag in allTags" :key="tag" class="op-tag-dropdown-item" @click="toggleOperatorTag(op, tag, $event)">
                          <span class="op-check-box" :class="{ checked: op.tags && op.tags.includes(tag) }" style="width:18px;height:18px;flex-shrink:0;">
                            <v-icon v-if="op.tags && op.tags.includes(tag)" size="14" color="white">mdi-check</v-icon>
                          </span>
                          {{ tag }}
                        </div>
                      </div>
                    </teleport>
                  </div>
                </div>
              </div>
            </div>

            <!-- Helpers (full width, above time inputs) -->
            <div class="op-time-row">
              <div class="op-time-field" style="position:relative;">
                <v-icon size="24" color="#757575" style="position:absolute;left:16px;top:16px;pointer-events:none;">mdi-account-group</v-icon>
                <input type="number" v-model.number="formHelperCount" min="0" placeholder="Number of helpers" class="op-time-input op-helpers-input" style="padding-left:56px;" />
                <span class="op-time-label">Add here any additional helpers on shift (optional)</span>
              </div>
            </div>
            <!-- Time inputs (side by side) -->
            <div class="op-time-row">
              <div class="op-time-field">
                <input type="time" v-model="formStartTime" class="op-time-input" />
                <span class="op-time-label">Start time</span>
              </div>
              <div class="op-time-field">
                <input type="time" v-model="formEndTime" class="op-time-input" />
                <span class="op-time-label">End time</span>
              </div>
            </div>
          </div>

          <div class="op-footer op-footer-right-only">
            <button class="op-btn op-btn-text" @click="cancelForm">CANCEL</button>
            <button class="op-btn op-btn-save" :disabled="formSelectedOps.length === 0" @click="saveOperators">SAVE</button>
          </div>
        </template>

        <!-- ═══════════ ADD HELPERS ═══════════ -->
        <template v-if="currentView === 'add-helpers'">
          <div class="op-header">
            <v-icon size="24" color="#212121">mdi-account-group</v-icon>
            <span class="op-header-title">Helpers</span>
          </div>

          <div class="op-body">
            <div class="op-helper-field">
              <input type="number" v-model.number="formHelperCount" min="1" placeholder="Number of helpers" class="op-number-input" />
              <span class="op-helper-hint">How many helpers are assisting during this shift?</span>
            </div>
            <div class="op-time-row">
              <div class="op-time-field">
                <input type="time" v-model="formStartTime" class="op-time-input" />
                <span class="op-time-label">Start time</span>
              </div>
              <div class="op-time-field">
                <input type="time" v-model="formEndTime" class="op-time-input" />
                <span class="op-time-label">End time</span>
              </div>
            </div>
          </div>

          <div class="op-footer op-footer-right-only">
            <button class="op-btn op-btn-text" @click="cancelForm">CANCEL</button>
            <button class="op-btn op-btn-save" :disabled="!formHelperCount || formHelperCount < 1" @click="saveHelpers">SAVE</button>
          </div>
        </template>

      </div>
    </div>
  `,
  setup(props, { emit }) {
    const { ref, computed, watch, onMounted } = Vue;

    // ── Core state ──
    const currentView = ref('overview');
    let _nextId = 10;

    const operatorEntries = ref([]);
    const helperEntries = ref([]);

    // ── Form state ──
    const searchQuery = ref('');
    const formSelectedOps = ref([]);
    const formStartTime = ref('06:00');
    const formEndTime = ref('14:00');
    const formHelperCount = ref(null);
    const editingEntryId = ref(null);

    // ── Data refs (from shared localStorage) ──
    const allOperators = Vue.reactive(SharedData.getOperators());
    const allTeams = SharedData.getTeams();
    const allTags = MOCK_TAGS;

    // ── Collapsible teams (collapsed by default) ──
    const collapsedTeams = Vue.reactive(new Set(allTeams.map(t => t.id)));
    function toggleTeamCollapse(teamId) {
      collapsedTeams.has(teamId) ? collapsedTeams.delete(teamId) : collapsedTeams.add(teamId);
    }

    // ── Tag editing state ──
    const hoveredOpId = ref(null);
    const tagDropdownOpId = ref(null);
    // Fixed-position coords for the open tag dropdown — recomputed from the
    // trigger's bounding rect so the dropdown escapes the scroll container.
    const tagDropdownPos = ref({ top: 0, left: 0 });
    let _tagAnchorEl = null;

    function handleRowMouseleave(opId) {
      if (tagDropdownOpId.value !== opId) hoveredOpId.value = null;
    }

    function positionTagDropdown(triggerEl) {
      if (!triggerEl) return;
      const r = triggerEl.getBoundingClientRect();
      const menuW = 200;
      const menuH = 200;
      // Default: open below + right-aligned to the trigger.
      let top  = r.bottom + 4;
      let left = r.right - menuW;
      // Flip up if it would overflow the viewport.
      if (top + menuH > window.innerHeight - 8) top = r.top - menuH - 4;
      if (left < 8) left = 8;
      tagDropdownPos.value = { top, left };
    }

    function openTagDropdown(opId, event) {
      event.stopPropagation();
      if (tagDropdownOpId.value === opId) {
        tagDropdownOpId.value = null;
        _tagAnchorEl = null;
      } else {
        tagDropdownOpId.value = opId;
        _tagAnchorEl = event.currentTarget;
        positionTagDropdown(_tagAnchorEl);
      }
    }

    function repositionTagDropdown() {
      if (tagDropdownOpId.value != null) positionTagDropdown(_tagAnchorEl);
    }

    function toggleOperatorTag(op, tag, event) {
      event.stopPropagation();
      const tags = op.tags || [];
      op.tags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
      SharedData.saveOperators(allOperators);
    }

    function closeTagDropdown() { tagDropdownOpId.value = null; }

    // ── Read-only tag label ──
    function getTagLabel(op) {
      const tags = op.tags || [];
      if (tags.length === 0) return '';
      if (tags.length === 1) return tags[0];
      return tags[0] + ' + ' + (tags.length - 1);
    }

    // ── Filtered teams for search ──
    const filteredTeams = computed(() => {
      const q = searchQuery.value.toLowerCase().trim();
      if (!q) return allTeams;
      return allTeams.filter(team => {
        if (team.name.toLowerCase().includes(q)) return true;
        return allOperators.some(o =>
          o.teamId === team.id &&
          (o.firstName.toLowerCase().includes(q) || o.lastName.toLowerCase().includes(q))
        );
      });
    });

    function getFilteredTeamOperators(teamId) {
      const q = searchQuery.value.toLowerCase().trim();
      let ops = allOperators.filter(o => o.teamId === teamId);
      if (q) {
        // If full team matches by name, show all ops; otherwise filter ops
        const team = allTeams.find(t => t.id === teamId);
        if (team && team.name.toLowerCase().includes(q)) return ops;
        ops = ops.filter(o =>
          o.firstName.toLowerCase().includes(q) || o.lastName.toLowerCase().includes(q)
        );
      }
      return ops;
    }

    function isTeamFullySelected(teamId) {
      const ops = allOperators.filter(o => o.teamId === teamId);
      return ops.length > 0 && ops.every(o => formSelectedOps.value.includes(o.id));
    }

    function isTeamPartiallySelected(teamId) {
      const ops = allOperators.filter(o => o.teamId === teamId);
      const count = ops.filter(o => formSelectedOps.value.includes(o.id)).length;
      return count > 0 && count < ops.length;
    }

    function toggleTeam(teamId) {
      const ops = allOperators.filter(o => o.teamId === teamId);
      if (isTeamFullySelected(teamId)) {
        const removeIds = new Set(ops.map(o => o.id));
        formSelectedOps.value = formSelectedOps.value.filter(id => !removeIds.has(id));
      } else {
        const addIds = ops.map(o => o.id).filter(id => !formSelectedOps.value.includes(id));
        formSelectedOps.value = [...formSelectedOps.value, ...addIds];
        // Auto-expand the team group so the new selections are visible.
        collapsedTeams.delete(teamId);
      }
    }

    function toggleOperator(opId) {
      if (formSelectedOps.value.includes(opId)) {
        formSelectedOps.value = formSelectedOps.value.filter(id => id !== opId);
      } else {
        formSelectedOps.value = [...formSelectedOps.value, opId];
      }
    }

    function getOperatorNames(entry) {
      const ops = entry.operatorIds
        .map(id => allOperators.find(o => o.id === id))
        .filter(Boolean);
      // Group by team
      const grouped = new Map();
      ops.forEach(op => {
        const team = op.teamId ? allTeams.find(t => t.id === op.teamId) : null;
        const key = team ? team.id : 0;
        if (!grouped.has(key)) grouped.set(key, { teamName: team ? team.name : null, names: [] });
        grouped.get(key).names.push(op.firstName);
      });
      const parts = [];
      grouped.forEach(g => {
        if (g.teamName) {
          parts.push(g.teamName + ' \u2013 ' + g.names.join(', '));
        } else {
          parts.push(g.names.join(', '));
        }
      });
      return parts.join(', ');
    }

    // ── Navigation ──
    function openAddOperators() {
      formSelectedOps.value = [];
      formStartTime.value = '06:00';
      formEndTime.value = '14:00';
      formHelperCount.value = null;
      searchQuery.value = '';
      editingEntryId.value = null;
      currentView.value = 'add-operators';
    }

    function openAddHelpers() {
      formHelperCount.value = null;
      formStartTime.value = '06:00';
      formEndTime.value = '14:00';
      editingEntryId.value = null;
      currentView.value = 'add-helpers';
    }

    function cancelForm() {
      currentView.value = 'overview';
      editingEntryId.value = null;
    }

    // ── Save ──
    function timeToMinutes(t) {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    }

    function rangeContains(outerStart, outerEnd, innerStart, innerEnd) {
      // Check if outer range fully contains inner range
      const os = timeToMinutes(outerStart), oe = timeToMinutes(outerEnd);
      const is = timeToMinutes(innerStart), ie = timeToMinutes(innerEnd);
      return os <= is && oe >= ie;
    }

    function saveOperators() {
      const hasOps = formSelectedOps.value.length > 0;
      const hasHelpers = formHelperCount.value && formHelperCount.value > 0;
      if (!hasOps && !hasHelpers) return;

      // Editing an existing operator entry: just update it (incl. merged helperCount).
      if (editingEntryId.value && hasOps) {
        const entry = operatorEntries.value.find(e => e.id === editingEntryId.value);
        if (entry) {
          entry.operatorIds = [...formSelectedOps.value];
          entry.startTime = formStartTime.value;
          entry.endTime = formEndTime.value;
          entry.helperCount = hasHelpers ? formHelperCount.value : (entry.helperCount || 0);
        }
        editingEntryId.value = null;
        currentView.value = 'overview';
        emitSummary();
        return;
      }

      // Helpers-only path (no operators selected) — keep standalone helper entry behaviour.
      if (!hasOps && hasHelpers) {
        helperEntries.value.push({
          id: _nextId++,
          count: formHelperCount.value,
          startTime: formStartTime.value,
          endTime: formEndTime.value,
        });
        editingEntryId.value = null;
        currentView.value = 'overview';
        emitSummary();
        return;
      }

      // Operators (+ optional helpers) — merge into a containing entry if its time range covers ours.
      const match = operatorEntries.value.find(e =>
        rangeContains(e.startTime, e.endTime, formStartTime.value, formEndTime.value)
      );
      if (match) {
        const existing = new Set(match.operatorIds);
        formSelectedOps.value.forEach(id => existing.add(id));
        match.operatorIds = [...existing];
        if (hasHelpers) match.helperCount = (match.helperCount || 0) + formHelperCount.value;
      } else {
        operatorEntries.value.push({
          id: _nextId++,
          operatorIds: [...formSelectedOps.value],
          startTime: formStartTime.value,
          endTime: formEndTime.value,
          helperCount: hasHelpers ? formHelperCount.value : 0,
        });
      }

      editingEntryId.value = null;
      currentView.value = 'overview';
      emitSummary();
    }

    function saveHelpers() {
      if (!formHelperCount.value || formHelperCount.value < 1) return;
      if (editingEntryId.value) {
        const entry = helperEntries.value.find(e => e.id === editingEntryId.value);
        if (entry) {
          entry.count = formHelperCount.value;
          entry.startTime = formStartTime.value;
          entry.endTime = formEndTime.value;
        }
      } else {
        helperEntries.value.push({
          id: _nextId++,
          count: formHelperCount.value,
          startTime: formStartTime.value,
          endTime: formEndTime.value,
        });
      }
      editingEntryId.value = null;
      currentView.value = 'overview';
      emitSummary();
    }

    // ── CRUD ──
    function deleteOperatorEntry(id) {
      operatorEntries.value = operatorEntries.value.filter(e => e.id !== id);
      emitSummary();
    }

    function deleteHelperEntry(id) {
      helperEntries.value = helperEntries.value.filter(e => e.id !== id);
      emitSummary();
    }

    function duplicateOperatorEntry(id) {
      const entry = operatorEntries.value.find(e => e.id === id);
      if (entry) {
        formSelectedOps.value = [...entry.operatorIds];
        formStartTime.value = entry.startTime;
        formEndTime.value = entry.endTime;
        formHelperCount.value = entry.helperCount || null;
        searchQuery.value = '';
        editingEntryId.value = null;
        currentView.value = 'add-operators';
      }
    }

    function editOperatorEntry(id) {
      const entry = operatorEntries.value.find(e => e.id === id);
      if (entry) {
        formSelectedOps.value = [...entry.operatorIds];
        formStartTime.value = entry.startTime;
        formEndTime.value = entry.endTime;
        formHelperCount.value = entry.helperCount || null;
        searchQuery.value = '';
        editingEntryId.value = id;
        currentView.value = 'add-operators';
      }
    }

    function editHelperEntry(id) {
      const entry = helperEntries.value.find(e => e.id === id);
      if (entry) {
        formHelperCount.value = entry.count;
        formStartTime.value = entry.startTime;
        formEndTime.value = entry.endTime;
        editingEntryId.value = id;
        currentView.value = 'add-helpers';
      }
    }

    function handleOverlayClick() {
      if (currentView.value === 'overview') {
        emit('close');
      }
    }

    // ── Tooltip ──
    let _tooltipEl = null;
    function showTooltip(event, text) {
      hideTooltip();
      const el = document.createElement('div');
      el.className = 'op-tooltip';
      el.textContent = text;
      document.body.appendChild(el);
      _tooltipEl = el;
      const rect = event.currentTarget.getBoundingClientRect();
      el.style.left = rect.left + 'px';
      el.style.top = (rect.top - el.offsetHeight - 6) + 'px';
    }
    function hideTooltip() {
      if (_tooltipEl) { _tooltipEl.remove(); _tooltipEl = null; }
    }

    // ── Summary calculation for bottom bar ──
    function timeToHours(start, end) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let h = (eh - sh) + (em - sm) / 60;
      if (h < 0) h += 24; // overnight shift
      return h;
    }

    function emitSummary() {
      const totalOps = operatorEntries.value.reduce((s, e) => s + e.operatorIds.length, 0);
      // Helpers = standalone helper entries + helpers merged onto operator entries
      const totalHelpers =
        helperEntries.value.reduce((s, e) => s + e.count, 0) +
        operatorEntries.value.reduce((s, e) => s + (e.helperCount || 0), 0);
      const totalPeople = totalOps + totalHelpers;

      let totalHours = 0;
      operatorEntries.value.forEach(e => {
        const span = timeToHours(e.startTime, e.endTime);
        totalHours += e.operatorIds.length * span;
        totalHours += (e.helperCount || 0) * span;
      });
      helperEntries.value.forEach(e => {
        totalHours += e.count * timeToHours(e.startTime, e.endTime);
      });

      // Collect all unique operator IDs across entries
      const allOpIds = new Set();
      operatorEntries.value.forEach(e => e.operatorIds.forEach(id => allOpIds.add(id)));

      // Count operators per team
      const teamCounts = new Map(); // teamId → count
      let noTeamCount = 0;
      allOpIds.forEach(id => {
        const op = allOperators.find(o => o.id === id);
        if (op && op.teamId) {
          teamCounts.set(op.teamId, (teamCounts.get(op.teamId) || 0) + 1);
        } else {
          noTeamCount++;
        }
      });

      // Find the primary team (most operators)
      let primaryTeamName = '';
      let primaryTeamCount = 0;
      let extraCount = 0;

      if (teamCounts.size > 0) {
        let primaryTeamId = null;
        let maxCount = 0;
        teamCounts.forEach((count, teamId) => {
          if (count > maxCount) { maxCount = count; primaryTeamId = teamId; }
        });
        const team = allTeams.find(t => t.id === primaryTeamId);
        if (team) primaryTeamName = team.name;
        primaryTeamCount = maxCount;
        // Extras = operators from other teams only. Helpers shown separately.
        extraCount = (totalOps - primaryTeamCount);
      }

      // First operator's name — used when totalPeople === 1
      let firstName = '';
      const firstEntry = operatorEntries.value[0];
      if (firstEntry && firstEntry.operatorIds.length > 0) {
        const op = allOperators.find(o => o.id === firstEntry.operatorIds[0]);
        if (op) firstName = op.firstName;
      }

      // Find shift leader — first operator across all entries with the "Supervisor" tag.
      // Gated by the per-station "Enable shift leader selection" toggle (Spiros: must be optional).
      const stationSettings = SharedData.getStations().find(s => s.name === SHIFT_VIEW_STATION);
      const leaderEnabled = stationSettings ? stationSettings.enableShiftLeader : false;
      let leaderName = '';
      if (leaderEnabled) {
        for (const entry of operatorEntries.value) {
          const leader = entry.operatorIds
            .map(id => allOperators.find(o => o.id === id))
            .find(op => op && (op.tags || []).includes('Supervisor'));
          if (leader) { leaderName = leader.firstName; break; }
        }
      }
      // Leader extras = other operators (excludes helpers — those get their own chip)
      const leaderExtras = leaderName ? Math.max(0, totalOps - 1) : 0;

      emit('update:summary', {
        primaryTeamName,
        primaryTeamCount,
        extraCount,
        helperCount: totalHelpers,
        firstName,
        leaderName,
        leaderExtras,
        totalPeople,
        totalHours: Math.round(totalHours),
        hasEntries: totalPeople > 0,
      });
    }

    onMounted(() => {
      emitSummary();
      document.addEventListener('click', closeTagDropdown);
      // Scroll capture catches the inner scroll containers (.op-body-scroll)
      // so the dropdown follows the anchor on scroll.
      window.addEventListener('scroll', repositionTagDropdown, true);
      window.addEventListener('resize', closeTagDropdown);
    });

    const { onUnmounted } = Vue;
    onUnmounted(() => {
      document.removeEventListener('click', closeTagDropdown);
      window.removeEventListener('scroll', repositionTagDropdown, true);
      window.removeEventListener('resize', closeTagDropdown);
    });

    return {
      currentView,
      operatorEntries,
      helperEntries,
      searchQuery,
      formSelectedOps,
      formStartTime,
      formEndTime,
      formHelperCount,
      filteredTeams,
      getFilteredTeamOperators,
      isTeamFullySelected,
      isTeamPartiallySelected,
      toggleTeam,
      toggleOperator,
      getOperatorNames,
      openAddOperators,
      openAddHelpers,
      cancelForm,
      saveOperators,
      saveHelpers,
      deleteOperatorEntry,
      deleteHelperEntry,
      duplicateOperatorEntry,
      editOperatorEntry,
      editHelperEntry,
      handleOverlayClick,
      showTooltip,
      hideTooltip,
      getTagLabel,
      collapsedTeams,
      toggleTeamCollapse,
      hoveredOpId,
      tagDropdownOpId,
      tagDropdownPos,
      handleRowMouseleave,
      openTagDropdown,
      toggleOperatorTag,
      allTags,
    };
  }
};
