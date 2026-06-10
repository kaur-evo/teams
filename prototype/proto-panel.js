/**
 * proto-panel.js — shared "Prototype settings" panel (H-key toggle).
 *
 * Self-contained, framework-agnostic. Include it on any prototype page and it
 * injects a fixed panel into <body>, toggled with the H key. It is the single
 * source of truth for the prototype options: it reads/writes localStorage,
 * mirrors each value onto a window.__proto* global, and dispatches a
 * `proto:<key>` CustomEvent on change. Other code (Vue components, vanilla
 * renders) just listens for those events / reads the globals — no per-page
 * panel wiring. This keeps the settings working identically in Settings and
 * Shift View.
 */
(function () {
  // Each option is a boolean feature: a sentence + an on/off tickbox. The stored
  // value is still a string (`on` / `off` below) so consumer code keeps reading
  // the same values it always did (e.g. 'chip', 'flat'). `defOn` is the default
  // checked state. Add an option here and it appears on every page.
  const OPTIONS = [
    {
      key: 'protoCardLayout', global: '__protoCardLayout', event: 'proto:cardLayout',
      label: 'Alternative operator card layout (time + roles, one row per tag)',
      on: 'twoRow', off: 'classic', defOn: true,
    },
    {
      key: 'protoTier', global: '__protoTier', event: 'proto:tier',
      label: 'Enterprise plan (all roles available)',
      on: 'enterprise', off: 'pro', defOn: false,
    },
    {
      key: 'protoOpList', global: '__protoOpList', event: 'proto:opList',
      label: 'Flat operator list (all operators in one list, like live today)',
      on: 'flat', off: 'grouped', defOn: false,
    },
    {
      key: 'protoLeaderStyle', global: '__protoLeaderStyle', event: 'proto:leaderStyle',
      label: 'Chip-style shift-leader assignment (flag chip on each operator row)',
      on: 'chip', off: 'field', defOn: false,
    },
    {
      key: 'protoExcludeManhours', global: '__protoExcludeManhours', event: 'proto:excludeManhours',
      label: 'Show "Exclude from manhours" switch on operators',
      on: 'on', off: 'off', defOn: false,
    },
    {
      key: 'protoLeaderPrefill', global: '__protoLeaderPrefill', event: 'proto:leaderPrefill',
      label: 'Pre-fill the first eligible operator as shift leader',
      on: 'on', off: 'off', defOn: false,
    },
    {
      key: 'protoMultiLeader', global: '__protoMultiLeader', event: 'proto:multiLeader',
      label: 'Allow multiple shift leaders (multi-select / multiple chips)',
      on: 'on', off: 'off', defOn: false,
    },
  ];

  function get(opt) {
    return localStorage.getItem(opt.key) || (opt.defOn ? opt.on : opt.off);
  }
  function isOn(opt) {
    return get(opt) === opt.on;
  }
  function set(opt, value) {
    localStorage.setItem(opt.key, value);
    window[opt.global] = value;
    window.dispatchEvent(new CustomEvent(opt.event, { detail: value }));
    syncInputs(opt, value);
  }

  // Seed globals immediately (before DOM/panel) so components reading them at
  // construction time get the persisted value.
  OPTIONS.forEach(opt => { window[opt.global] = get(opt); });

  let panelEl = null;

  function syncInputs(opt, value) {
    if (!panelEl) return;
    panelEl.querySelectorAll('input[data-key="' + opt.key + '"]').forEach(inp => {
      inp.checked = value === opt.on;
    });
  }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.className = 'proto-panel';
    panel.hidden = true;

    const rows = OPTIONS.map(opt => `
      <label class="proto-panel__check">
        <input type="checkbox" data-key="${opt.key}" ${isOn(opt) ? 'checked' : ''}>
        <span>${opt.label}</span>
      </label>
    `).join('');

    panel.innerHTML = `
      <div class="proto-panel__title">Prototype settings</div>
      <div class="proto-panel__hint">Press <kbd>H</kbd> to toggle</div>
      ${rows}
    `;

    panel.addEventListener('click', e => e.stopPropagation());
    panel.addEventListener('change', e => {
      const inp = e.target;
      if (inp.tagName !== 'INPUT') return;
      const opt = OPTIONS.find(o => o.key === inp.dataset.key);
      if (opt) set(opt, inp.checked ? opt.on : opt.off);
    });
    return panel;
  }

  function toggle(force) {
    if (!panelEl) return;
    panelEl.hidden = force != null ? !force : !panelEl.hidden;
  }

  function onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'h' || e.key === 'H') toggle();
    else if (e.key === 'Escape' && panelEl && !panelEl.hidden) toggle(false);
  }

  function init() {
    if (document.querySelector('.proto-panel')) return; // guard against double-include
    panelEl = buildPanel();
    document.body.appendChild(panelEl);
    document.addEventListener('keydown', onKey);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose a tiny API for debugging / programmatic control.
  window.ProtoPanel = {
    get: (key) => { const o = OPTIONS.find(x => x.key === key); return o ? get(o) : undefined; },
    set: (key, v) => { const o = OPTIONS.find(x => x.key === key); if (o) set(o, v); },
    toggle,
  };
})();
