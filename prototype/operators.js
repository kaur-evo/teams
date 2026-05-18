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
            <div v-if="entries.length === 0" class="op-empty">
              No operators or helpers assigned yet.
            </div>

            <!-- Unified entry cards. Each card has up to two badges (operators,
                 helpers), the team-color swatches, the operator name list,
                 and the action icons. Helper-only entries omit the operator
                 badge and show "Helpers" as the name. -->
            <div v-for="entry in entries" :key="entry.id" class="op-card">
              <div class="op-card-top">
                <div class="op-card-left">
                  <span v-if="entry.operatorIds.length > 0"
                        class="op-card-badge"
                        @mouseenter="showTooltip($event, 'Operators: ' + getOperatorFirstNames(entry))"
                        @mouseleave="hideTooltip">
                    <v-icon size="18" color="#757575">mdi-account-hard-hat</v-icon> {{ entry.operatorIds.length }}
                  </span>
                  <span v-if="entry.helperCount > 0"
                        class="op-card-badge"
                        @mouseenter="showTooltip($event, 'Helpers')"
                        @mouseleave="hideTooltip">
                    <v-icon size="18" color="#757575">mdi-account-group</v-icon> {{ entry.helperCount }}
                  </span>
                  <span v-for="color in getEntryTeamColors(entry)" :key="color"
                        class="op-card-team-swatch"
                        :style="{ background: color }"></span>
                  <span class="op-card-names"
                        @mouseenter="showTooltip($event, entry.operatorIds.length > 0 ? getOperatorNames(entry) : 'Helpers')"
                        @mouseleave="hideTooltip">{{ entry.operatorIds.length > 0 ? getOperatorNames(entry) : 'Helpers: ' + entry.helperCount }}</span>
                </div>
                <div class="op-card-icons">
                  <button class="op-icon-btn" @click="deleteEntry(entry.id)" title="Delete"><v-icon size="24" color="#757575">mdi-delete</v-icon></button>
                  <button class="op-icon-btn" @click="duplicateEntry(entry.id)" title="Duplicate"><v-icon size="24" color="#757575">mdi-content-copy</v-icon></button>
                  <button class="op-icon-btn" @click="editEntry(entry.id)" title="Edit"><v-icon size="24" color="#757575">mdi-pencil</v-icon></button>
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
                  <span class="op-team-swatch" :style="{ background: team.color }"></span>
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

              <!-- Operators with no team — flat list under the team groups -->
              <div v-if="noTeamOperators.length > 0" class="op-team-group">
                <div class="op-check-row op-team-row op-team-row-noteam">
                  <span class="op-team-label">No team</span>
                </div>
                <div v-for="op in noTeamOperators" :key="op.id" class="op-check-row op-op-row op-op-row-flush"
                  @mouseenter="hoveredOpId = op.id"
                  @mouseleave="handleRowMouseleave(op.id)">
                  <label class="op-check-row-inner">
                    <span class="op-check-box" :class="{ checked: formSelectedOps.includes(op.id) }" @click.prevent="toggleOperator(op.id)">
                      <v-icon v-if="formSelectedOps.includes(op.id)" size="18" color="white">mdi-check</v-icon>
                    </span>
                    <span class="op-op-name">{{ op.firstName }} {{ op.lastName }}</span>
                  </label>
                  <div class="op-tag-area" style="position:relative" @click.stop>
                    <span v-if="op.tags && op.tags.length > 0"
                      class="op-tag-chip-readonly op-tag-chip-editable"
                      @click="openTagDropdown(op.id, $event)"
                      @mouseenter="op.tags.length > 1 ? showTooltip($event, op.tags.join(', ')) : null"
                      @mouseleave="op.tags.length > 1 ? hideTooltip() : null">
                      <v-icon size="18" color="#2ecc71">mdi-tag</v-icon>
                      {{ getTagLabel(op) }}
                    </span>
                    <span v-else-if="hoveredOpId === op.id || tagDropdownOpId === op.id"
                      class="op-tag-chip-ghost"
                      @click="openTagDropdown(op.id, $event)">
                      <v-icon size="18" color="#757575">mdi-tag</v-icon>
                      Tag
                      <v-icon size="18" color="#757575">mdi-menu-down</v-icon>
                    </span>
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
            <button class="op-btn op-btn-save" :disabled="formSelectedOps.length === 0 && (!formHelperCount || formHelperCount < 1)" @click="saveOperators">SAVE</button>
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
    // entries: a single unified array of shift assignments. Each entry has
    //   { id, operatorIds: number[], helperCount: number, startTime, endTime }
    // A helper-only entry has operatorIds = []. There is never more than one
    // entry covering any given moment in time — overlaps merge on save.
    const currentView = ref('overview');
    let _nextId = 10;

    const entries = ref([]);

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

    // Operators with no team — shown as a flat list under the team groups.
    const noTeamOperators = computed(() => {
      const q = searchQuery.value.toLowerCase().trim();
      let ops = allOperators.filter(o => !o.teamId);
      if (q) {
        ops = ops.filter(o =>
          o.firstName.toLowerCase().includes(q) || o.lastName.toLowerCase().includes(q)
        );
      }
      return ops;
    });

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

    function getEntryTeamColors(entry) {
      const seen = new Set();
      const colors = [];
      entry.operatorIds.forEach(id => {
        const op = allOperators.find(o => o.id === id);
        const team = op && op.teamId ? allTeams.find(t => t.id === op.teamId) : null;
        if (team && team.color && !seen.has(team.id)) {
          seen.add(team.id);
          colors.push(team.color);
        }
      });
      return colors;
    }

    function getOperatorFirstNames(entry) {
      return entry.operatorIds
        .map(id => allOperators.find(o => o.id === id))
        .filter(Boolean)
        .map(op => op.firstName)
        .join(', ');
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
          parts.push(g.teamName + ': ' + g.names.join(', '));
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

    function rangesOverlap(aStart, aEnd, bStart, bEnd) {
      // Any overlap — touching ends don't count (back-to-back shifts are distinct).
      const as = timeToMinutes(aStart), ae = timeToMinutes(aEnd);
      const bs = timeToMinutes(bStart), be = timeToMinutes(bEnd);
      return as < be && bs < ae;
    }

    function minTime(a, b) {
      return timeToMinutes(a) <= timeToMinutes(b) ? a : b;
    }
    function maxTime(a, b) {
      return timeToMinutes(a) >= timeToMinutes(b) ? a : b;
    }

    function saveOperators() {
      const hasOps = formSelectedOps.value.length > 0;
      const hasHelpers = formHelperCount.value && formHelperCount.value > 0;
      if (!hasOps && !hasHelpers) return;

      // Editing: update the entry in place; helperCount = the new form value (may be 0).
      if (editingEntryId.value) {
        const entry = entries.value.find(e => e.id === editingEntryId.value);
        if (entry) {
          entry.operatorIds = [...formSelectedOps.value];
          entry.startTime = formStartTime.value;
          entry.endTime = formEndTime.value;
          entry.helperCount = hasHelpers ? formHelperCount.value : 0;
        }
        editingEntryId.value = null;
        currentView.value = 'overview';
        emitSummary();
        return;
      }

      // New entry — merge into any overlapping entries (operator-only, helper-only,
      // or mixed all use the same logic). Touching ends (e.g. 06:00–14:00 and
      // 14:00–22:00) stay distinct because rangesOverlap is strict (<).
      const overlapping = entries.value.filter(e =>
        rangesOverlap(e.startTime, e.endTime, formStartTime.value, formEndTime.value)
      );

      if (overlapping.length > 0) {
        const base = overlapping[0];
        const allOpIds = new Set(base.operatorIds);
        let mergedHelpers = base.helperCount || 0;
        let start = base.startTime, end = base.endTime;
        // Absorb additional overlapping entries
        for (let i = 1; i < overlapping.length; i++) {
          const e = overlapping[i];
          e.operatorIds.forEach(id => allOpIds.add(id));
          mergedHelpers += (e.helperCount || 0);
          start = minTime(start, e.startTime);
          end   = maxTime(end,   e.endTime);
        }
        // Absorb the new submission
        formSelectedOps.value.forEach(id => allOpIds.add(id));
        if (hasHelpers) mergedHelpers += formHelperCount.value;
        start = minTime(start, formStartTime.value);
        end   = maxTime(end,   formEndTime.value);
        base.operatorIds = [...allOpIds];
        base.helperCount = mergedHelpers;
        base.startTime = start;
        base.endTime = end;
        if (overlapping.length > 1) {
          const removeIds = new Set(overlapping.slice(1).map(e => e.id));
          entries.value = entries.value.filter(e => !removeIds.has(e.id));
        }
      } else {
        entries.value.push({
          id: _nextId++,
          operatorIds: [...formSelectedOps.value],
          helperCount: hasHelpers ? formHelperCount.value : 0,
          startTime: formStartTime.value,
          endTime: formEndTime.value,
        });
      }

      editingEntryId.value = null;
      currentView.value = 'overview';
      emitSummary();
    }

    function saveHelpers() {
      // Helpers-only view delegates to the unified save path so we apply the
      // same overlap-merge logic. formSelectedOps is empty when this is called.
      if (!formHelperCount.value || formHelperCount.value < 1) return;
      saveOperators();
    }

    // ── CRUD (all operate on the unified entries array) ──
    function deleteEntry(id) {
      entries.value = entries.value.filter(e => e.id !== id);
      emitSummary();
    }

    function duplicateEntry(id) {
      const entry = entries.value.find(e => e.id === id);
      if (!entry) return;
      formSelectedOps.value = [...entry.operatorIds];
      formStartTime.value = entry.startTime;
      formEndTime.value = entry.endTime;
      formHelperCount.value = entry.helperCount || null;
      searchQuery.value = '';
      editingEntryId.value = null;
      currentView.value = 'add-operators';
    }

    function editEntry(id) {
      // Always open the full add-operators modal — works for operator-only,
      // helper-only, and mixed entries. A helper-only entry's edit lets the
      // user attach operators/teams to it too.
      const entry = entries.value.find(e => e.id === id);
      if (!entry) return;
      formSelectedOps.value = [...entry.operatorIds];
      formStartTime.value = entry.startTime;
      formEndTime.value = entry.endTime;
      formHelperCount.value = entry.helperCount || null;
      searchQuery.value = '';
      editingEntryId.value = id;
      currentView.value = 'add-operators';
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
      const totalOps = entries.value.reduce((s, e) => s + e.operatorIds.length, 0);
      const totalHelpers = entries.value.reduce((s, e) => s + (e.helperCount || 0), 0);
      const totalPeople = totalOps + totalHelpers;

      // Collect all unique operator IDs across entries
      const allOpIds = new Set();
      entries.value.forEach(e => e.operatorIds.forEach(id => allOpIds.add(id)));

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
      let primaryTeamColor = '';
      let primaryTeamCount = 0;
      let extraCount = 0;

      if (teamCounts.size > 0) {
        let primaryTeamId = null;
        let maxCount = 0;
        teamCounts.forEach((count, teamId) => {
          if (count > maxCount) { maxCount = count; primaryTeamId = teamId; }
        });
        const team = allTeams.find(t => t.id === primaryTeamId);
        if (team) {
          primaryTeamName = team.name;
          primaryTeamColor = team.color || '';
        }
        primaryTeamCount = maxCount;
        // Extras = everything not in the primary team: other-team ops + no-team ops + helpers
        extraCount = (totalOps - primaryTeamCount) + totalHelpers;
      }

      // First operator's name — used when totalPeople === 1
      let firstName = '';
      const firstWithOps = entries.value.find(e => e.operatorIds.length > 0);
      if (firstWithOps) {
        const op = allOperators.find(o => o.id === firstWithOps.operatorIds[0]);
        if (op) firstName = op.firstName;
      }

      // Find shift leader — first operator across all entries with the "Supervisor" tag.
      // Gated by the per-station "Enable shift leader selection" toggle (Spiros: must be optional).
      const stationSettings = SharedData.getStations().find(s => s.name === SHIFT_VIEW_STATION);
      const leaderEnabled = stationSettings ? stationSettings.enableShiftLeader : false;
      let leaderName = '';
      if (leaderEnabled) {
        for (const entry of entries.value) {
          const leader = entry.operatorIds
            .map(id => allOperators.find(o => o.id === id))
            .find(op => op && (op.tags || []).includes('Supervisor'));
          if (leader) { leaderName = leader.firstName; break; }
        }
      }
      // Leader extras = everyone else (ops + helpers)
      const leaderExtras = leaderName ? Math.max(0, totalPeople - 1) : 0;

      emit('update:summary', {
        primaryTeamName,
        primaryTeamColor,
        primaryTeamCount,
        extraCount,
        firstName,
        leaderName,
        leaderExtras,
        totalPeople,
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
      entries,
      searchQuery,
      formSelectedOps,
      formStartTime,
      formEndTime,
      formHelperCount,
      filteredTeams,
      getFilteredTeamOperators,
      noTeamOperators,
      isTeamFullySelected,
      isTeamPartiallySelected,
      toggleTeam,
      toggleOperator,
      getEntryTeamColors,
      getOperatorNames,
      getOperatorFirstNames,
      openAddOperators,
      openAddHelpers,
      cancelForm,
      saveOperators,
      saveHelpers,
      deleteEntry,
      duplicateEntry,
      editEntry,
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
