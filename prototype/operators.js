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

            <!-- ── CLASSIC CARD ── single-row card (badges + flat name list) -->
            <template v-if="cardLayout !== 'twoRow'">
            <div v-for="entry in entries" :key="entry.id" class="op-card">
              <div class="op-card-top">
                <div class="op-card-left">
                  <span v-if="entry.helperCount > 0"
                        class="op-card-badge"
                        @mouseenter="showTooltip($event, 'Additional workforce')"
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
                        @mouseenter="showTooltip($event, entry.operatorIds.length > 0 ? getOperatorNames(entry) : 'Additional workforce')"
                        @mouseleave="hideTooltip">{{ entry.operatorIds.length > 0 ? getEntryFlatNames(entry) : 'Additional workforce: ' + entry.helperCount }}</span>
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
            </template>

            <!-- ── ALTERNATIVE CARD ── (Figma 32084:89233). Layout:
                 Row 1: single bold name line — supervisors first (with a star
                        icon inline after each supervisor's name), then the
                        rest, separated by commas.
                 Row 2: helper chip only (if any). No operators chip.
                 Row 3: clock + time range (12px caption).
                 Right side: kebab menu only. Whole card is clickable. -->
            <template v-else>
            <div v-for="entry in entries" :key="entry.id" class="op-card op-card--alt"
                 @click="editEntry(entry.id)">
              <div class="op-card-alt-content">
                <!-- Row 1: names (single line, truncated). Supervisors first,
                     each with an inline star after the name, then the rest. -->
                <div v-if="entry.operatorIds.length > 0" class="op-card-alt-row">
                  <span class="op-card-alt-names"
                        @mouseenter="showTooltip($event, getOperatorNames(entry))"
                        @mouseleave="hideTooltip">
                    <template v-for="(part, i) in getEntryNameParts(entry)" :key="i">
                      <template v-if="i > 0">, </template><!--
                      --><v-icon v-if="part.supervisor" class="op-card-alt-star" size="18" color="#707070">mdi-flag</v-icon><!--
                      --><span>{{ part.name }}</span>
                    </template>
                  </span>
                </div>

                <!-- Row 2: single people-count chip (Figma 32124:11673). Operators
                     + additional workforce combined. Hover surfaces the
                     additional-workforce breakdown when present. -->
                <div v-if="entry.operatorIds.length > 0 || entry.helperCount > 0" class="op-card-alt-row">
                  <span class="op-card-alt-chip"
                        @mouseenter="showTooltip($event, getEntryPeopleTooltip(entry))"
                        @mouseleave="hideTooltip">
                    <img src="icn/operators%20%28account-hard-hat%29.svg" alt="" width="18" height="18" class="op-card-alt-chip-icn">
                    {{ entry.operatorIds.length + (entry.helperCount || 0) }}
                  </span>
                </div>

                <!-- Time row at the bottom. -->
                <div class="op-card-alt-time">
                  <v-icon size="16" color="#212121">mdi-clock-outline</v-icon>
                  <span>{{ entry.startTime }} - {{ entry.endTime }}</span>
                </div>
              </div>
              <!-- Kebab menu — Edit / Duplicate / Delete. stopPropagation so
                   opening the menu doesn't also fire the card-level edit. -->
              <div class="op-card-alt-actions" @click.stop>
                <button class="op-icon-btn" :class="{ 'is-open': kebabEntryId === entry.id }"
                        @click.stop="toggleKebab(entry.id, $event)" title="More">
                  <v-icon size="24" color="#757575">mdi-dots-vertical</v-icon>
                </button>
                <teleport to="body">
                  <div v-if="kebabEntryId === entry.id" class="op-kebab-menu"
                       :style="{ top: kebabPos.top + 'px', left: kebabPos.left + 'px' }"
                       @click.stop>
                    <button class="op-kebab-item" @click="closeKebab(); editEntry(entry.id)">
                      <v-icon size="24" color="#757575">mdi-pencil</v-icon>
                      Edit
                    </button>
                    <button class="op-kebab-item" @click="closeKebab(); duplicateEntry(entry.id)">
                      <v-icon size="24" color="#757575">mdi-content-copy</v-icon>
                      Duplicate
                    </button>
                    <button class="op-kebab-item" @click="closeKebab(); deleteEntry(entry.id)">
                      <v-icon size="24" color="#757575">mdi-delete</v-icon>
                      Delete
                    </button>
                  </div>
                </teleport>
              </div>
            </div>
            </template>
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
        <!-- ═══════════ ADD/EDIT OPERATORS — Figma 32083:88708 ═══════════
             700px modal. Header has profile icon + "Operators" title (no
             "Add:"/"Edit:" prefix). Search input. Group sections with one
             collapsible level: group checkbox + name + caret. Operators are
             14px rows with a left checkbox + name (and a 12px caption line
             showing the operator's role when toggle is OFF, or a role chip
             on the right when the toggle is ON). Helpers row matches the
             same checkbox shape with an inline "N people" chip. Footer holds
             a toggle "Adjust operator roles" + Start/End time inputs. -->
        <template v-if="currentView === 'add-operators'">
          <div class="op-header op-header--centered">
            <v-icon size="24" color="#212121">mdi-account</v-icon>
            <span class="op-header-title">Operators</span>
          </div>

          <div class="op-body op-body-scroll">
            <!-- Search -->
            <div class="op-search">
              <v-icon size="24" color="#9e9e9e">mdi-magnify</v-icon>
              <input type="text" v-model="searchQuery" placeholder="Search" class="op-search-input" />
            </div>

            <!-- Group + operator + helpers checkbox list -->
            <div class="op-team-list">
              <template v-if="opList === 'grouped'">
              <div v-for="team in filteredTeams" :key="team.id" class="op-team-group">
                <!-- Group header row (48px tall, full-width) -->
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

                <!-- Operator rows: 32px tall, 14px label, left-indented 16px -->
                <div v-if="!collapsedTeams.has(team.id)" v-for="op in getFilteredTeamOperators(team.id)" :key="op.id" class="op-check-row op-op-row">
                  <label class="op-check-row-inner">
                    <span class="op-check-box" :class="{ checked: formSelectedOps.includes(op.id) }" @click.prevent="toggleOperator(op.id)">
                      <v-icon v-if="formSelectedOps.includes(op.id)" size="18" color="white">mdi-check</v-icon>
                    </span>
                    <span class="op-op-text">
                      <span class="op-op-name-line">
                        <span class="op-op-name">{{ op.firstName }} {{ op.lastName }}</span>
                        <!-- Star marks Supervisor inline AFTER the name — single
                             mode only. Multi uses the chip; leader has no pre-
                             assigned star in the picker list. -->
                        <img v-if="rolesMode === 'single' && op.role === 'Supervisor'" src="icn/save-report.svg" alt="" width="18" height="18" class="op-op-star">
                      </span>
                      <!-- Role caption on the 2nd line — single mode, toggle OFF only.
                           Multi uses the chip; leader uses the Shift leader select. -->
                      <span v-if="rolesMode === 'single' && !adjustRolesOn && op.role" class="op-op-role-desc">{{ op.role }}</span>
                    </span>
                  </label>
                  <!-- Role chip on the right. Single mode: shown only when the
                       "Adjust operator roles" toggle is ON. Multi mode: always
                       shown for any operator that has ≥1 allowed role. -->
                  <div v-if="showRoleChip(op)" class="op-tag-area" @click.stop>
                    <!-- Chip always shows the operator icon (the star lives only
                         in the dropdown + on the saved card). -->
                    <button class="op-rolechip" :class="{ 'is-selected': effectiveRoles(op).length > 0 }" @click="openTagDropdown(op.id, $event)">
                      <img src="icn/operators%20%28account-hard-hat%29.svg" alt="" width="18" height="18" class="op-rolechip-icn">
                      <span>{{ effectiveRoles(op)[0] || '-' }}</span>
                      <v-icon size="18" color="#757575">mdi-menu-down</v-icon>
                    </button>
                    <!-- Picker dropdown — single-select, matches the Settings
                         single-select role list (Figma 32091:15259): radio
                         marker + role icon (star for Supervisor, operator icon
                         otherwise, dimmed when unselected) + 16px label.
                         A "No role" row at the top clears the selection (MUI
                         <MenuItem value=""><em>None</em></MenuItem> pattern). -->
                    <teleport to="body">
                      <div v-if="tagDropdownOpId === op.id"
                           class="op-tag-dropdown op-role-dropdown"
                           :style="{ top: tagDropdownPos.top + 'px', left: tagDropdownPos.left + 'px' }"
                           @click.stop>
                        <div v-for="role in roleOptionsFor(op)" :key="role.name"
                             class="op-role-row" :class="{ 'is-selected': effectiveRoles(op).includes(role.name) }"
                             @click="pickOperatorRole(op, role, $event)">
                          <v-icon v-if="effectiveRoles(op).includes(role.name)" class="op-role-marker" size="24" color="#2ecc71">mdi-check-circle</v-icon>
                          <span v-else class="op-role-marker"></span>
                          <!-- Role icon hidden for now — bring back later.
                          <img v-if="role.name === 'Supervisor'" src="icn/save-report.svg" alt="" width="24" height="24" class="op-role-icn">
                          <img v-else src="icn/operators%20%28account-hard-hat%29.svg" alt="" width="24" height="24" class="op-role-icn">
                          -->
                          <span class="op-role-label">{{ role.name }}</span>
                        </div>
                        <div class="op-role-row op-role-row--none" :class="{ 'is-selected': effectiveRoles(op).length === 0 }"
                             @click="clearOperatorRole(op, $event)">
                          <v-icon v-if="effectiveRoles(op).length === 0" class="op-role-marker" size="24" color="#2ecc71">mdi-check-circle</v-icon>
                          <span v-else class="op-role-marker"></span>
                          <!-- Icon spacer hidden along with role icons — bring back later.
                          <span class="op-role-icn"></span>
                          -->
                          <span class="op-role-label">-</span>
                        </div>
                      </div>
                    </teleport>
                  </div>
                </div>
              </div>
              </template>

              <!-- Flat list (proto: opList === 'flat') — all operators, no group
                   separation. Mirrors the live Evocon picker. Same row markup
                   as the grouped block so role chips / leader behaviour match. -->
              <template v-else>
                <div v-for="op in flatOperators" :key="op.id" class="op-check-row op-op-row op-op-row--flat">
                  <label class="op-check-row-inner">
                    <span class="op-check-box" :class="{ checked: formSelectedOps.includes(op.id) }" @click.prevent="toggleOperator(op.id)">
                      <v-icon v-if="formSelectedOps.includes(op.id)" size="18" color="white">mdi-check</v-icon>
                    </span>
                    <span class="op-op-text">
                      <span class="op-op-name-line">
                        <span class="op-op-name">{{ op.firstName }} {{ op.lastName }}</span>
                        <img v-if="rolesMode === 'single' && op.role === 'Supervisor'" src="icn/save-report.svg" alt="" width="18" height="18" class="op-op-star">
                      </span>
                      <span v-if="rolesMode === 'single' && !adjustRolesOn && op.role" class="op-op-role-desc">{{ op.role }}</span>
                    </span>
                  </label>
                  <div v-if="showRoleChip(op)" class="op-tag-area" @click.stop>
                    <button class="op-rolechip" :class="{ 'is-selected': effectiveRoles(op).length > 0 }" @click="openTagDropdown(op.id, $event)">
                      <img src="icn/operators%20%28account-hard-hat%29.svg" alt="" width="18" height="18" class="op-rolechip-icn">
                      <span>{{ effectiveRoles(op)[0] || '-' }}</span>
                      <v-icon size="18" color="#757575">mdi-menu-down</v-icon>
                    </button>
                    <teleport to="body">
                      <div v-if="tagDropdownOpId === op.id"
                           class="op-tag-dropdown op-role-dropdown"
                           :style="{ top: tagDropdownPos.top + 'px', left: tagDropdownPos.left + 'px' }"
                           @click.stop>
                        <div v-for="role in roleOptionsFor(op)" :key="role.name"
                             class="op-role-row" :class="{ 'is-selected': effectiveRoles(op).includes(role.name) }"
                             @click="pickOperatorRole(op, role, $event)">
                          <v-icon v-if="effectiveRoles(op).includes(role.name)" class="op-role-marker" size="24" color="#2ecc71">mdi-check-circle</v-icon>
                          <span v-else class="op-role-marker"></span>
                          <span class="op-role-label">{{ role.name }}</span>
                        </div>
                      </div>
                    </teleport>
                  </div>
                </div>
              </template>

              <!-- Helpers row: checkbox + "Helpers" label + inline number chip.
                   Chip sits right next to the label (not pushed to the right
                   like the operator role chip). Active state: green tinted bg
                   + green border once the user enters a number. -->
              <div class="op-check-row op-op-row"
                   :class="{ 'op-op-row-helpers': opList === 'grouped', 'op-op-row--flat': opList === 'flat' }">
                <label class="op-check-row-inner">
                  <span class="op-check-box" :class="{ checked: helpersOn }" @click.prevent.stop="toggleHelpersOn">
                    <v-icon v-if="helpersOn" size="18" color="white">mdi-check</v-icon>
                  </span>
                  <span class="op-op-text">
                    <span class="op-op-name-line">
                      <!-- Users icon before the label, per Figma 32106:13541. -->
                      <v-icon class="op-helpers-icn" size="18" color="#757575">mdi-account-hard-hat</v-icon>
                      <span class="op-op-name">Additional workforce</span>
                      <span class="op-helpers-chip" :class="{ 'is-active': helpersOn }" @click.prevent.stop>
                        <input type="number" min="1"
                               v-model.number="formHelperCount"
                               @focus="helpersOn = true; if (!formHelperCount) formHelperCount = 1"
                               class="op-helpers-chip-input" />
                        <span>people</span>
                      </span>
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <!-- 'Adjust operator roles' toggle (Figma standard switch).
                 Single mode only — multi uses always-on chips, leader uses the
                 Shift leader select below. -->
            <div v-if="rolesMode === 'single'" class="op-toggle-row">
              <span class="op-toggle-label">Adjust operator roles</span>
              <button class="op-switch" :class="{ 'is-on': adjustRolesOn }"
                      @click="adjustRolesOn = !adjustRolesOn"
                      aria-label="Adjust operator roles">
                <span class="op-switch-knob"></span>
              </button>
            </div>

            <!-- Leader mode: "Shift leader" select (Figma 32105:12291). Options
                 are operators who can lead AND are checked into the shift.
                 Disabled (0.5 opacity whole field) until ≥1 eligible is picked. -->
            <div v-if="rolesMode === 'leader' && anyCanLead" class="op-leader-field" :class="{ 'is-disabled': !leaderEnabled }"
                 @mouseenter="!leaderEnabled && showTooltip($event, 'No leading operators selected')"
                 @mouseleave="hideTooltip">
              <button type="button" class="op-leader-select" :disabled="!leaderEnabled" @click.stop="toggleLeaderDropdown">
                <v-icon class="op-leader-icn" size="24" color="#707070">mdi-flag</v-icon>
                <span class="op-leader-value" :class="{ 'is-placeholder': !leaderName }">{{ leaderName || 'Shift leader' }}</span>
                <v-icon size="24" color="#757575">mdi-menu-down</v-icon>
              </button>
              <span class="op-leader-caption">Leading operator who leads the shift</span>
              <teleport to="body">
                <div v-if="leaderDropdownOpen" class="op-tag-dropdown op-role-dropdown"
                     :style="{ top: leaderDropdownPos.top + 'px', left: leaderDropdownPos.left + 'px', width: leaderDropdownPos.width + 'px' }"
                     @click.stop>
                  <div v-for="op in leaderOptions" :key="op.id"
                       class="op-role-row" :class="{ 'is-selected': formLeaderId === op.id }"
                       @click="pickLeader(op)">
                    <v-icon v-if="formLeaderId === op.id" class="op-role-marker" size="24" color="#2ecc71">mdi-check-circle</v-icon>
                    <span v-else class="op-role-marker"></span>
                    <span class="op-role-label">{{ op.firstName }} {{ op.lastName }}</span>
                  </div>
                </div>
              </teleport>
            </div>

            <!-- Time inputs (start / end side by side) -->
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
            <button class="op-btn op-btn-save" :disabled="formSelectedOps.length === 0 && !helpersOn" @click="saveOperators">SAVE</button>
          </div>
        </template>

        <!-- ═══════════ ADD HELPERS ═══════════ -->
        <template v-if="currentView === 'add-helpers'">
          <div class="op-header">
            <v-icon size="24" color="#212121">mdi-account-group</v-icon>
            <span class="op-header-title">Additional workforce</span>
          </div>

          <div class="op-body">
            <div class="op-helper-field">
              <input type="number" v-model.number="formHelperCount" min="1" placeholder="Number of people" class="op-number-input" />
              <span class="op-helper-hint">How many additional people are working during this shift?</span>
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

    // ── Prototype: operator-card layout switch (toggled via H-key panel). ──
    const cardLayout = ref(window.__protoCardLayout || 'twoRow');
    window.addEventListener('proto:cardLayout', (e) => { cardLayout.value = e.detail; });

    // Roles mode: 'single' (legacy — Settings role caption + "Adjust operator
    // Leader mode is now the committed design (Single/Multi were prototype A/B
    // variants that have been dropped). Kept as a ref so the template branches
    // still resolve cleanly, but it's effectively a constant.
    const rolesMode = ref('leader');

    // Plan tier — 'pro' or 'enterprise'. On Pro the Enterprise-locked roles
    // (Quality, Maintenance) are hidden in the picker entirely, leaving just
    // Supervisor; on Enterprise they're listed but disabled + tooltip.
    const tier = ref(window.__protoTier || 'pro');
    window.addEventListener('proto:tier', (e) => { tier.value = e.detail; });

    // SV operator list mode: 'grouped' (by operator group, current proto) or
    // 'flat' (all ops in one flat list — like Evocon today). Set via H-key.
    const opList = ref(window.__protoOpList || 'grouped');
    window.addEventListener('proto:opList', (e) => { opList.value = e.detail; });

    // ── Kebab menu (alternative card): one open at a time. ──
    // Teleported to <body> + position: fixed so the menu escapes the modal's
    // overflow:auto scroll container.
    const kebabEntryId = ref(null);
    const kebabPos = ref({ top: 0, left: 0 });
    function toggleKebab(id, event) {
      if (kebabEntryId.value === id) { kebabEntryId.value = null; return; }
      kebabEntryId.value = id;
      if (event && event.currentTarget) {
        const r = event.currentTarget.getBoundingClientRect();
        // Anchor below + right-aligned to the kebab button. Flip up if it would
        // overflow the viewport bottom.
        const menuW = 180;
        const menuH = 156;
        let top = r.bottom + 4;
        let left = r.right - menuW;
        if (top + menuH > window.innerHeight - 8) top = r.top - menuH - 4;
        if (left < 8) left = 8;
        kebabPos.value = { top, left };
      }
    }
    function closeKebab() { kebabEntryId.value = null; }

    // "Adjust operator roles" toggle in the picker. OFF (default): role is
    // shown as a 12px caption under each operator's name; chips are hidden.
    // ON: role chip appears on the right of every operator row and is
    // clickable to change the role for this entry.
    const adjustRolesOn = ref(false);
    // Helpers checkbox/chip state — replaces the old standalone helper count
    // input. When OFF, the chip is greyed and helperCount is ignored on save.
    const helpersOn = ref(false);
    function toggleHelpersOn() {
      helpersOn.value = !helpersOn.value;
      if (helpersOn.value && (!formHelperCount.value || formHelperCount.value < 1)) {
        formHelperCount.value = 1;
      }
    }

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
      const menuW = 240;
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

    // Pick / unpick a role for THIS form's entry. SINGLE-select against the
    // operator's available tags. Clicking the active tag again clears it.
    // Closing on pick keeps the interaction snappy. Picking a tag does NOT
    // change the operator's checked state — those are independent.
    function pickOperatorRole(op, role, event) {
      event.stopPropagation();
      // Accept either a plain role name (legacy callers) or a { name, disabled }
      // row from roleOptionsFor. Disabled (Enterprise-locked) rows are ignored
      // and keep the dropdown open so the tooltip stays readable.
      const name = typeof role === 'string' ? role : role.name;
      if (role && typeof role === 'object' && role.disabled) return;
      const current = effectiveRoles(op);
      const isActive = current.length === 1 && current[0] === name;
      formOperatorRoles[op.id] = isActive ? [] : [name];
      tagDropdownOpId.value = null;
    }

    // Explicit "No role" clear (MUI None pattern) — empties the picked role for
    // this operator regardless of what was selected.
    function clearOperatorRole(op, event) {
      event.stopPropagation();
      formOperatorRoles[op.id] = [];
      tagDropdownOpId.value = null;
    }

    function closeTagDropdown() { tagDropdownOpId.value = null; }

    // The roles currently in effect for this operator in the picker. Priority:
    //   1. Roles the user has picked in this form session (formOperatorRoles).
    //   2. The operator's Settings `role` (single role per the new data model)
    //      when nothing has been picked yet — shown even before the operator
    //      is checked.
    // Both the chip and the dropdown checkboxes read from here, so the
    // Settings role appears ticked in the dropdown by default.
    function effectiveRoles(op) {
      if (op.id in formOperatorRoles) {
        const v = formOperatorRoles[op.id];
        return Array.isArray(v) ? v : (v ? [v] : []);
      }
      // Back-compat: old data carried op.defaultTag; the new model uses op.role.
      const def = op.role || op.defaultTag || null;
      return def ? [def] : [];
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

    // Whether to show the role chip for this operator row.
    //  • leader → never (leader mode uses a single "Shift leader" select, not
    //             per-operator chips)
    //  • multi  → any operator that carries ≥1 allowed role (always on, no toggle)
    //  • single → only when the "Adjust operator roles" toggle is ON
    function showRoleChip(op) {
      if (rolesMode.value === 'leader') return false;
      if (rolesMode.value === 'multi') {
        return Array.isArray(op.allowedRoles) && op.allowedRoles.length > 0;
      }
      return adjustRolesOn.value;
    }

    // ── Leader mode (single "Shift leader" select) ──
    // The leader is chosen from operators who (a) have canLead enabled AND
    // (b) are checked into this shift. Field is disabled until ≥1 eligible
    // operator is selected.
    const formLeaderId = ref(null);
    const leaderDropdownOpen = ref(false);
    const leaderDropdownPos = ref({ top: 0, left: 0 });
    let _leaderAnchorEl = null;
    const leaderOptions = computed(() =>
      allOperators.filter(o => o.canLead && formSelectedOps.value.includes(o.id))
    );
    // No operator in the org can lead → hide the whole field (nothing to pick,
    // ever). Different from leaderEnabled, which gates the disabled state when
    // operators *could* lead but none are checked into this shift yet.
    const anyCanLead = computed(() => allOperators.some(o => o.canLead));
    const leaderEnabled = computed(() => leaderOptions.value.length > 0);
    const leaderName = computed(() => {
      const op = allOperators.find(o => o.id === formLeaderId.value);
      return op ? `${op.firstName} ${op.lastName}`.trim() : '';
    });
    function positionLeaderDropdown(triggerEl) {
      if (!triggerEl) return;
      const r = triggerEl.getBoundingClientRect();
      const menuH = 240;
      let top = r.bottom + 4;
      if (top + menuH > window.innerHeight - 8) top = Math.max(8, r.top - menuH - 4);
      leaderDropdownPos.value = { top, left: r.left, width: r.width };
    }
    function toggleLeaderDropdown(event) {
      if (!leaderEnabled.value) return;
      if (leaderDropdownOpen.value) { leaderDropdownOpen.value = false; return; }
      leaderDropdownOpen.value = true;
      _leaderAnchorEl = event && event.currentTarget;
      positionLeaderDropdown(_leaderAnchorEl);
    }
    function closeLeaderDropdown() { leaderDropdownOpen.value = false; }
    function pickLeader(op) {
      formLeaderId.value = formLeaderId.value === op.id ? null : op.id;
      leaderDropdownOpen.value = false;
    }
    // If the chosen leader gets unchecked from the shift, drop the selection.
    watch(formSelectedOps, (ids) => {
      if (formLeaderId.value != null && !ids.includes(formLeaderId.value)) {
        formLeaderId.value = null;
      }
    });
    // Option B: as soon as ANY eligible operator is checked into the shift and
    // no leader is set yet, auto-pick the first one. The "-" clear option was
    // removed, so the leader is either one of the eligible operators or null
    // (only when zero eligibles are checked in → field is disabled).
    watch(leaderOptions, (opts) => {
      if (opts.length > 0 && formLeaderId.value == null) {
        formLeaderId.value = opts[0].id;
      }
    });

    // Role catalog (mirrors setup-proto's OPERATOR_ROLES). Order matters for
    // the dropdown. `enterprise: true` rows are gated by the plan tier.
    const ROLE_CATALOG = [
      { name: 'Supervisor',  enterprise: false },
      { name: 'Quality',     enterprise: true  },
      { name: 'Maintenance', enterprise: true  },
    ];
    function isEnterpriseRole(name) {
      const r = ROLE_CATALOG.find(x => x.name === name);
      return !!(r && r.enterprise);
    }

    // The role rows listed in the dropdown for this operator, as objects
    // { name, disabled }. Tier-gated:
    //  • multi  → the operator's allowedRoles ("possible roles")
    //  • single → all roles (the Settings default is just a starting point)
    // On Pro, Enterprise-locked roles are dropped entirely; on Enterprise they
    // are plain, pickable rows (no badge, no disabled state). So `disabled` is
    // always false here — the gate is purely "show or hide".
    function roleOptionsFor(op) {
      let names;
      if (rolesMode.value === 'multi') {
        names = Array.isArray(op.allowedRoles) ? op.allowedRoles : [];
      } else {
        names = ROLE_CATALOG.map(r => r.name);
      }
      const rows = [];
      names.forEach(name => {
        if (isEnterpriseRole(name) && tier.value !== 'enterprise') return; // Pro: hide locked roles
        rows.push({ name, disabled: false });
      });
      return rows;
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

    // Flat list of ALL operators (proto: "Flat" opList mode) — search-filtered,
    // no group separation. Mirrors the live Evocon experience today.
    const flatOperators = computed(() => {
      const q = searchQuery.value.toLowerCase().trim();
      let ops = [...allOperators];
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

    // Initialize this operator's role-in-this-form to their Settings role.
    // Only runs if the user hasn't already picked a role for this operator —
    // we don't want to overwrite a manual choice when they later check the box.
    function seedRoleForOp(opId) {
      if (opId in formOperatorRoles) return;
      const op = allOperators.find(o => o.id === opId);
      if (!op) return;
      // New model uses op.role (single string). Fall back to op.defaultTag for
      // legacy data that hasn't migrated.
      const def = op.role || op.defaultTag || null;
      if (def) {
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

    // For the alternative card (Figma 32042:7348): one row per tag present
    // in the entry, naming the FIRST operator carrying that tag. Multi-tag
    // operators surface on every applicable row. Order follows MOCK_TAGS.
    function getEntryTagRows(entry) {
      const rows = [];
      const roles = entry.roles || {};
      MOCK_TAGS.forEach(tag => {
        const ids = entry.operatorIds.filter(id => {
          const r = roles[id];
          const list = Array.isArray(r) ? r : (r ? [r] : []);
          return list.includes(tag);
        });
        if (ids.length === 0) return;
        const ops = ids
          .map(id => allOperators.find(o => o.id === id))
          .filter(Boolean);
        if (ops.length === 0) return;
        const names = ops.map(op => `${op.firstName} ${op.lastName}`.trim());
        rows.push({
          tag,
          name: names[0],
          // Surface remaining same-tag people via "+N" suffix if more than one.
          extras: ops.length - 1,
          allNames: names.join(', '),
        });
      });
      return rows;
    }

    // For the alternative card: the bolded line of all operator names.
    // Supervisors first, full names, no role parens (those are on tag rows).
    function getEntryAllNames(entry) {
      const ops = entry.operatorIds
        .map(id => allOperators.find(o => o.id === id))
        .filter(Boolean);
      const sups = ops.filter(op => entryHasRole(entry, op.id, 'Supervisor'));
      const rest = ops.filter(op => !entryHasRole(entry, op.id, 'Supervisor'));
      return [...sups, ...rest]
        .map(op => `${op.firstName} ${op.lastName}`.trim())
        .join(', ');
    }

    // Returns the operators that DON'T have any tag — they belong on the
    // generic "operators" row (tagged people surface in their own tag rows).
    function getEntryUntaggedOps(entry) {
      const roles = entry.roles || {};
      const isTagged = (id) => {
        const r = roles[id];
        const list = Array.isArray(r) ? r : (r ? [r] : []);
        return list.length > 0;
      };
      return entry.operatorIds
        .map(id => allOperators.find(o => o.id === id))
        .filter(op => op && !isTagged(op.id));
    }
    function getEntryUntaggedNames(entry) {
      return getEntryUntaggedOps(entry)
        .map(op => `${op.firstName} ${op.lastName}`.trim())
        .join(', ');
    }
    function getEntryUntaggedCount(entry) {
      return getEntryUntaggedOps(entry).length;
    }
    function getEntryTotal(entry) {
      return entry.operatorIds.length + (entry.helperCount || 0);
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

    // Same as getEntryFlatNames but returns parts so the template can render
    // a star icon inline after each supervisor name (Figma 32084:89233).
    function getEntryNameParts(entry) {
      const ops = entry.operatorIds
        .map(id => allOperators.find(o => o.id === id))
        .filter(Boolean);
      // The star marks the ACTIVE shift leader for this entry only.
      const isLeader = (op) => entry.leaderId === op.id;
      const leader = ops.filter(isLeader);
      const rest   = ops.filter(op => !isLeader(op));
      return [
        ...leader.map(op => ({ name: `${op.firstName} ${op.lastName}`.trim(), supervisor: true  })),
        ...rest.map(  op => ({ name: `${op.firstName} ${op.lastName}`.trim(), supervisor: false })),
      ];
    }

    // Saved-card people-chip hover tooltip. Shows the operator + additional-
    // workforce split when both are present; one line otherwise.
    function getEntryPeopleTooltip(entry) {
      const ops = entry.operatorIds.length;
      const aw  = entry.helperCount || 0;
      const lines = [];
      if (ops > 0) lines.push(`Operators: ${ops}`);
      if (aw  > 0) lines.push(`Additional workforce: ${aw}`);
      return lines.join(' · ');
    }

    // Saved-card name list: everyone who has ANY role comes first (entry order
    // preserved), then the people without a role. Full names, comma-joined.
    // No star — a set role is not treated as visually special here.
    function getEntryRoleFirstNames(entry) {
      const ops = entry.operatorIds
        .map(id => allOperators.find(o => o.id === id))
        .filter(Boolean);
      const hasRole = (op) => {
        const r = entry && entry.roles ? entry.roles[op.id] : null;
        const list = Array.isArray(r) ? r : (r ? [r] : []);
        return list.length > 0;
      };
      const withRole = ops.filter(hasRole);
      const without  = ops.filter(op => !hasRole(op));
      return [...withRole, ...without]
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
      helpersOn.value = false;
      adjustRolesOn.value = false;
      formLeaderId.value = null;
      leaderDropdownOpen.value = false;
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
      // Only honour helperCount when the helpers checkbox is on. This makes
      // the chip's "people" number a no-op until the user opts in.
      const hasHelpers = helpersOn.value && formHelperCount.value && formHelperCount.value > 0;
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
          entry.leaderId = formLeaderId.value;
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
        // New pick wins; otherwise keep whatever the base entry had.
        if (formLeaderId.value != null) base.leaderId = formLeaderId.value;
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
          leaderId: formLeaderId.value,
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
      // Helper toggle reflects whether the entry actually had helpers attached.
      helpersOn.value = !!entry.helperCount;
      // Role-adjust toggle defaults to OFF when editing; user can flip it.
      adjustRolesOn.value = false;
      // Leader mode: restore the picked shift leader. If the entry has no
      // saved leader, the auto-pick watcher will fill in the first eligible.
      formLeaderId.value = entry.leaderId != null ? entry.leaderId : null;
      leaderDropdownOpen.value = false;
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
        if (totalHelpers > 0) lines.push(`Additional workforce: ${totalHelpers}`);
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
      document.addEventListener('click', closeKebab);
      document.addEventListener('click', closeLeaderDropdown);
      // Scroll capture catches the inner scroll containers (.op-body-scroll)
      // so the dropdown follows the anchor on scroll.
      window.addEventListener('scroll', repositionTagDropdown, true);
      window.addEventListener('scroll', closeLeaderDropdown, true);
      window.addEventListener('resize', closeTagDropdown);
      window.addEventListener('resize', closeLeaderDropdown);
    });

    const { onUnmounted } = Vue;
    onUnmounted(() => {
      document.removeEventListener('click', closeTagDropdown);
      document.removeEventListener('click', closeLeaderDropdown);
      window.removeEventListener('scroll', repositionTagDropdown, true);
      window.removeEventListener('scroll', closeLeaderDropdown, true);
      window.removeEventListener('resize', closeTagDropdown);
      window.removeEventListener('resize', closeLeaderDropdown);
    });

    return {
      currentView,
      editingEntryId,
      cardLayout,
      rolesMode,
      tier,
      showRoleChip,
      roleOptionsFor,
      formLeaderId,
      leaderDropdownOpen,
      leaderDropdownPos,
      leaderOptions,
      leaderEnabled,
      anyCanLead,
      leaderName,
      toggleLeaderDropdown,
      pickLeader,
      getEntryTagRows,
      getEntryAllNames,
      getEntryUntaggedNames,
      getEntryUntaggedCount,
      getEntryTotal,
      kebabEntryId,
      kebabPos,
      toggleKebab,
      closeKebab,
      entries,
      searchQuery,
      formSelectedOps,
      formStartTime,
      formEndTime,
      formHelperCount,
      adjustRolesOn,
      helpersOn,
      toggleHelpersOn,
      filteredTeams,
      getFilteredTeamOperators,
      noTeamOperators,
      opList,
      flatOperators,
      isTeamFullySelected,
      isTeamPartiallySelected,
      toggleTeam,
      toggleOperator,
      getEntryTeamColors,
      getOperatorNames,
      getOperatorFirstNames,
      getEntryFlatNames,
      getEntryNameParts,
      getEntryRoleFirstNames,
      getEntryPeopleTooltip,
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
      clearOperatorRole,
      effectiveRole,
      effectiveRoles,
      formOperatorRoles,
      allTags,
    };
  }
};
