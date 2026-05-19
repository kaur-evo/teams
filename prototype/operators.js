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
                  <span v-if="entry.helperCount > 0"
                        class="op-card-badge"
                        @mouseenter="showTooltip($event, 'Helpers')"
                        @mouseleave="hideTooltip">
                    <v-icon size="18" color="#757575">mdi-account-group</v-icon> {{ entry.helperCount }}
                  </span>
                  <span v-if="entry.operatorIds.length > 0"
                        class="op-card-badge"
                        @mouseenter="showTooltip($event, 'Operators: ' + getOperatorFirstNames(entry))"
                        @mouseleave="hideTooltip">
                    <v-icon size="18" color="#757575">mdi-account-hard-hat</v-icon> {{ entry.operatorIds.length }}
                  </span>
                  <span class="op-card-names"
                        @mouseenter="showTooltip($event, entry.operatorIds.length > 0 ? getOperatorNames(entry) : 'Helpers')"
                        @mouseleave="hideTooltip">{{ entry.operatorIds.length > 0 ? getEntryFlatNames(entry) : 'Helpers: ' + entry.helperCount }}</span>
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
            <span class="op-header-title">{{ editingEntryId ? 'Edit: Operators' : 'Add: Operators' }}</span>
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
                    <!-- A role is set (form session) OR operator has a default
                         tag from Settings: solid chip with the role name. -->
                    <span v-if="op.tags && op.tags.length > 0 && getTagLabel(op)"
                      class="op-tag-chip-readonly op-tag-chip-editable"
                      @click="openTagDropdown(op.id, $event)">
                      <v-icon size="18" color="#2ecc71">mdi-tag</v-icon>
                      {{ getTagLabel(op) }}
                      <v-icon size="18" color="#757575">mdi-menu-down</v-icon>
                    </span>
                    <!-- Operator has tags available but no default + no pick yet: ghost chip. -->
                    <span v-else-if="op.tags && op.tags.length > 0"
                      class="op-tag-chip-ghost"
                      @click="openTagDropdown(op.id, $event)">
                      <v-icon size="18" color="#757575">mdi-tag</v-icon>
                      Tag
                      <v-icon size="18" color="#757575">mdi-menu-down</v-icon>
                    </span>
                    <!-- Operator with no available tags: no chip at all. -->
                    <!-- Single-select dropdown listing the operator's available tags. -->
                    <teleport to="body">
                      <div v-if="tagDropdownOpId === op.id"
                           class="op-tag-dropdown"
                           :style="{ top: tagDropdownPos.top + 'px', left: tagDropdownPos.left + 'px' }"
                           @click.stop>
                        <div v-for="tag in (op.tags || [])" :key="tag" class="op-tag-dropdown-item" @click="pickOperatorRole(op, tag, $event)">
                          <span class="op-check-box" :class="{ checked: effectiveRoles(op).includes(tag) }" style="width:18px;height:18px;flex-shrink:0;">
                            <v-icon v-if="effectiveRoles(op).includes(tag)" size="14" color="white">mdi-check</v-icon>
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
                    <span v-if="op.tags && op.tags.length > 0 && formOperatorRoles[op.id]"
                      class="op-tag-chip-readonly op-tag-chip-editable"
                      @click="openTagDropdown(op.id, $event)">
                      <v-icon size="18" color="#2ecc71">mdi-tag</v-icon>
                      {{ getTagLabel(op) }}
                    </span>
                    <span v-else-if="op.tags && op.tags.length > 0 && (hoveredOpId === op.id || tagDropdownOpId === op.id)"
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
                        <div v-for="tag in (op.tags || [])" :key="tag" class="op-tag-dropdown-item" @click="pickOperatorRole(op, tag, $event)">
                          <span class="op-check-box" :class="{ checked: effectiveRoles(op).includes(tag) }" style="width:18px;height:18px;flex-shrink:0;">
                            <v-icon v-if="effectiveRoles(op).includes(tag)" size="14" color="white">mdi-check</v-icon>
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
    //   { id, operatorIds: number[], roles: { [opId]: tag|null },
    //     helperCount: number, startTime, endTime }
    // A helper-only entry has operatorIds = []. There is never more than one
    // entry covering any given moment in time — overlaps merge on save.
    // Per-entry roles let the same person carry different roles on
    // non-overlapping entries (e.g. Supervisor 12-15, plain operator 15-18).
    const currentView = ref('overview');
    let _nextId = 10;

    const entries = ref([]);

    // ── Form state ──
    const searchQuery = ref('');
    const formSelectedOps = ref([]);
    // formOperatorRoles: per-operator role *for this form session*. Initialized
    // from the operator's defaultTag when checked, cleared when unchecked.
    // Persisted onto the entry as `roles` when the form saves.
    const formOperatorRoles = Vue.reactive({});
    const formStartTime = ref('06:00');
    const formEndTime = ref('14:00');
    const formHelperCount = ref(null);
    const editingEntryId = ref(null);

    // ── Data refs (from shared localStorage) ──
    const allOperators = Vue.reactive(SharedData.getOperators());
    const allTeams = SharedData.getTeams();
    const allTags = MOCK_TAGS;

    // ── Collapsible teams (collapsed by default) ──
    // Groups are expanded by default in the Shift View picker so operators
    // are immediately visible without an extra click.
    const collapsedTeams = Vue.reactive(new Set());
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

    // Pick / unpick a role for THIS form's entry. Multi-select against the
    // operator's available tags. Each row click toggles a tag on/off; the
    // dropdown stays open so the user can pick several. Picking a tag does
    // NOT change the operator's checked state — those are independent.
    function pickOperatorRole(op, tag, event) {
      event.stopPropagation();
      const current = effectiveRoles(op);
      const next = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag];
      formOperatorRoles[op.id] = next;
    }

    function closeTagDropdown() { tagDropdownOpId.value = null; }

    // The roles currently in effect for this operator in the picker. Priority:
    //   1. Roles the user has picked in this form session (formOperatorRoles).
    //   2. The operator's defaultTag from Settings (single tag) when nothing
    //      has been picked yet — shown even before the operator is checked.
    // Both the chip and the dropdown checkboxes read from here, so the
    // pre-selected default appears ticked in the dropdown.
    function effectiveRoles(op) {
      if (op.id in formOperatorRoles) {
        const v = formOperatorRoles[op.id];
        return Array.isArray(v) ? v : (v ? [v] : []);
      }
      return op.defaultTag ? [op.defaultTag] : [];
    }

    // Convenience helpers used by templates that still expect a single string
    // (chip label) or array (multi-check dropdown).
    function effectiveRole(op) {
      const roles = effectiveRoles(op);
      return roles.length === 0 ? '' : roles.join(', ');
    }

    function getTagLabel(op) {
      return effectiveRole(op) || '';
    }

    // ── Filtered teams for search ──
    const filteredTeams = computed(() => {
      const q = searchQuery.value.toLowerCase().trim();
      // Only show groups that have at least one operator assigned. Empty
      // groups still exist in Settings but don't clutter the Shift View picker.
      const teamsWithMembers = allTeams.filter(team =>
        allOperators.some(o => o.teamId === team.id)
      );
      if (!q) return teamsWithMembers;
      return teamsWithMembers.filter(team => {
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
        removeIds.forEach(id => { delete formOperatorRoles[id]; });
      } else {
        const addIds = ops.map(o => o.id).filter(id => !formSelectedOps.value.includes(id));
        formSelectedOps.value = [...formSelectedOps.value, ...addIds];
        addIds.forEach(id => seedRoleForOp(id));
        collapsedTeams.delete(teamId);
      }
    }

    function toggleOperator(opId) {
      if (formSelectedOps.value.includes(opId)) {
        formSelectedOps.value = formSelectedOps.value.filter(id => id !== opId);
        delete formOperatorRoles[opId];
      } else {
        formSelectedOps.value = [...formSelectedOps.value, opId];
        seedRoleForOp(opId);
      }
    }

    // Initialize this operator's role-in-this-form to their setup defaultTag.
    // Only runs if the user hasn't already picked a role for this operator —
    // we don't want to overwrite a manual choice when they later check the box.
    function seedRoleForOp(opId) {
      if (opId in formOperatorRoles) return;
      const op = allOperators.find(o => o.id === opId);
      if (!op) return;
      const def = op.defaultTag || null;
      if (def && (op.tags || []).includes(def)) {
        formOperatorRoles[opId] = [def];
      } else {
        formOperatorRoles[opId] = [];
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

    // Render a single operator's full name + entry-level roles. Tooltips
    // always carry the full data so users can identify people unambiguously.
    // E.g. "Vasilis Mavroeidis (Supervisor)" or "Pawel Herchel (Quality, Maintenance)".
    function nameWithRole(op, entry) {
      const r = entry && entry.roles ? entry.roles[op.id] : null;
      const list = Array.isArray(r) ? r : (r ? [r] : []);
      const name = `${op.firstName} ${op.lastName}`.trim();
      return list.length ? `${name} (${list.join(', ')})` : name;
    }

    function entryHasRole(entry, opId, role) {
      const r = entry && entry.roles ? entry.roles[opId] : null;
      const list = Array.isArray(r) ? r : (r ? [r] : []);
      return list.includes(role);
    }

    // Flat name list with supervisors first, then everyone else (entry order
    // preserved within each group). Used on the operator-modal card —
    // full names only, no role parentheses (those live in the tooltip).
    function getEntryFlatNames(entry) {
      const ops = entry.operatorIds
        .map(id => allOperators.find(o => o.id === id))
        .filter(Boolean);
      const sups = ops.filter(op => entryHasRole(entry, op.id, 'Supervisor'));
      const rest = ops.filter(op => !entryHasRole(entry, op.id, 'Supervisor'));
      return [...sups, ...rest]
        .map(op => `${op.firstName} ${op.lastName}`.trim())
        .join(', ');
    }

    function getOperatorFirstNames(entry) {
      return entry.operatorIds
        .map(id => allOperators.find(o => o.id === id))
        .filter(Boolean)
        .map(op => nameWithRole(op, entry))
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
        grouped.get(key).names.push(nameWithRole(op, entry));
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
      Object.keys(formOperatorRoles).forEach(k => delete formOperatorRoles[k]);
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

      // Snapshot the form-level role map for the operators being saved.
      // Each entry.roles[id] is always a string[] (may be empty).
      const newRoles = {};
      formSelectedOps.value.forEach(id => {
        const v = formOperatorRoles[id];
        newRoles[id] = Array.isArray(v) ? [...v] : (v ? [v] : []);
      });

      // Editing: update the entry in place; helperCount = the new form value (may be 0).
      if (editingEntryId.value) {
        const entry = entries.value.find(e => e.id === editingEntryId.value);
        if (entry) {
          entry.operatorIds = [...formSelectedOps.value];
          entry.roles = newRoles;
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

      // Helper: merge two role lists (string[]) into a union with no dups.
      const mergeRoleLists = (a, b) => {
        const set = new Set([...(Array.isArray(a) ? a : (a ? [a] : [])),
                             ...(Array.isArray(b) ? b : (b ? [b] : []))]);
        return [...set];
      };

      if (overlapping.length > 0) {
        const base = overlapping[0];
        const allOpIds = new Set(base.operatorIds);
        const mergedRoles = {};
        Object.entries(base.roles || {}).forEach(([id, r]) => {
          mergedRoles[id] = Array.isArray(r) ? [...r] : (r ? [r] : []);
        });
        let mergedHelpers = base.helperCount || 0;
        let start = base.startTime, end = base.endTime;
        // Absorb additional overlapping entries
        for (let i = 1; i < overlapping.length; i++) {
          const e = overlapping[i];
          e.operatorIds.forEach(id => allOpIds.add(id));
          Object.entries(e.roles || {}).forEach(([id, r]) => {
            mergedRoles[id] = mergeRoleLists(mergedRoles[id], r);
          });
          mergedHelpers += (e.helperCount || 0);
          start = minTime(start, e.startTime);
          end   = maxTime(end,   e.endTime);
        }
        // Absorb the new submission — new role values override existing ones
        // for that operator (the user's latest pick wins on conflict).
        formSelectedOps.value.forEach(id => allOpIds.add(id));
        Object.entries(newRoles).forEach(([id, r]) => {
          mergedRoles[id] = [...r]; // copy current picks verbatim
        });
        if (hasHelpers) mergedHelpers += formHelperCount.value;
        start = minTime(start, formStartTime.value);
        end   = maxTime(end,   formEndTime.value);
        base.operatorIds = [...allOpIds];
        base.roles = mergedRoles;
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
          roles: newRoles,
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

    function loadFormFromEntry(entry, opts) {
      formSelectedOps.value = [...entry.operatorIds];
      formStartTime.value = entry.startTime;
      formEndTime.value = entry.endTime;
      formHelperCount.value = entry.helperCount || null;
      // Wipe + restore per-operator roles as string[] (multi-tag model).
      Object.keys(formOperatorRoles).forEach(k => delete formOperatorRoles[k]);
      Object.entries(entry.roles || {}).forEach(([id, r]) => {
        formOperatorRoles[Number(id)] = Array.isArray(r) ? [...r] : (r ? [r] : []);
      });
      // For any selected op missing from roles, seed with their defaultTag.
      entry.operatorIds.forEach(id => {
        if (!(id in formOperatorRoles)) seedRoleForOp(id);
      });
      searchQuery.value = '';
      editingEntryId.value = opts && opts.editing ? entry.id : null;
      currentView.value = 'add-operators';
    }

    function duplicateEntry(id) {
      const entry = entries.value.find(e => e.id === id);
      if (entry) loadFormFromEntry(entry, { editing: false });
    }

    function editEntry(id) {
      // Always open the full add-operators modal — works for operator-only,
      // helper-only, and mixed entries. A helper-only entry's edit lets the
      // user attach operators/teams to it too.
      const entry = entries.value.find(e => e.id === id);
      if (entry) loadFormFromEntry(entry, { editing: true });
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

      // Find all shift leaders — every operator on any entry whose ENTRY-LEVEL
      // role is "Supervisor". Multiple supervisors render comma-separated; the
      // chip then shows "Alice, Bob + N" where N is everyone else (ops + helpers).
      // Supervisors always take precedence in the chip — no per-station gating.
      const leaderIds = new Set();
      const leaderFirstNames = [];
      {
        for (const entry of entries.value) {
          entry.operatorIds.forEach(id => {
            if (entryHasRole(entry, id, 'Supervisor') && !leaderIds.has(id)) {
              leaderIds.add(id);
              const op = allOperators.find(o => o.id === id);
              if (op) leaderFirstNames.push(op.firstName);
            }
          });
        }
      }
      const leaderName = leaderFirstNames.join(', ');
      // Leader extras = everyone who isn't already listed as a leader (ops + helpers).
      const leaderExtras = leaderName ? Math.max(0, totalPeople - leaderIds.size) : 0;

      // Full team-grouped operator+helper list (for chip hover tooltip).
      // Aggregates across all entries so the user sees the entire shift.
      const fullTooltip = (() => {
        const lines = [];
        // Group all unique operators by their team
        const byTeam = new Map(); // teamId|0 → { teamName, names[] }
        const seenOpIds = new Set();
        // Union all role lists across entries for each operator id.
        const allEntryRoles = {}; // opId → string[]
        entries.value.forEach(e => {
          Object.entries(e.roles || {}).forEach(([id, r]) => {
            const list = Array.isArray(r) ? r : (r ? [r] : []);
            const existing = allEntryRoles[id] || [];
            allEntryRoles[id] = [...new Set([...existing, ...list])];
          });
        });
        entries.value.forEach(e => {
          e.operatorIds.forEach(id => {
            if (seenOpIds.has(id)) return;
            seenOpIds.add(id);
            const op = allOperators.find(o => o.id === id);
            if (!op) return;
            const team = op.teamId ? allTeams.find(t => t.id === op.teamId) : null;
            const key = team ? team.id : 0;
            if (!byTeam.has(key)) byTeam.set(key, { teamName: team ? team.name : null, names: [] });
            const roles = allEntryRoles[id] || [];
            const fullName = `${op.firstName} ${op.lastName}`.trim();
            byTeam.get(key).names.push(roles.length ? `${fullName} (${roles.join(', ')})` : fullName);
          });
        });
        byTeam.forEach(g => {
          if (g.teamName) lines.push(`${g.teamName}: ${g.names.join(', ')}`);
          else if (g.names.length) lines.push(g.names.join(', '));
        });
        if (totalHelpers > 0) lines.push(`Helpers: ${totalHelpers}`);
        return lines.join(', ');
      })();

      emit('update:summary', {
        primaryTeamName,
        primaryTeamColor,
        primaryTeamCount,
        extraCount,
        firstName,
        leaderName,
        leaderExtras,
        totalPeople,
        fullTooltip,
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
      editingEntryId,
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
      getEntryFlatNames,
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
      pickOperatorRole,
      effectiveRole,
      effectiveRoles,
      formOperatorRoles,
      allTags,
    };
  }
};
