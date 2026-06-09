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
  // Each option: which localStorage key + global + event it drives, plus the
  // radio choices. Add a new option here and it appears on every page.
  const OPTIONS = [
    {
      key: 'protoCardLayout', global: '__protoCardLayout', event: 'proto:cardLayout',
      label: 'Operator card layout', def: 'twoRow',
      choices: [
        { value: 'classic', label: 'Classic', hint: '(badge + flat name list)' },
        { value: 'twoRow',  label: 'Alternative', hint: '(time + roles + one row per tag)' },
      ],
    },
    {
      key: 'protoTier', global: '__protoTier', event: 'proto:tier',
      label: 'Plan tier', def: 'pro',
      choices: [
        { value: 'pro',        label: 'Pro',        hint: '(Supervisor only — locked roles hidden)' },
        { value: 'enterprise', label: 'Enterprise', hint: '(all roles available)' },
      ],
    },
    {
      key: 'protoOpList', global: '__protoOpList', event: 'proto:opList',
      label: 'Shift View operator list', def: 'grouped',
      choices: [
        { value: 'grouped', label: 'Grouped', hint: '(by operator group, current proto)' },
        { value: 'flat',    label: 'Flat',    hint: '(all ops in one list — like live today)' },
      ],
    },
    {
      key: 'protoLeaderStyle', global: '__protoLeaderStyle', event: 'proto:leaderStyle',
      label: 'Shift leader assignment', def: 'field',
      choices: [
        { value: 'field', label: 'Field',  hint: '(dropdown below the list)' },
        { value: 'chip',  label: 'Chip',   hint: '(flag chip on each operator row)' },
      ],
    },
  ];

  const RADIO_GROUP = 'proto_' + Math.random().toString(36).slice(2, 8);

  function get(opt) {
    return localStorage.getItem(opt.key) || opt.def;
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
      inp.checked = inp.value === value;
    });
  }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.className = 'proto-panel';
    panel.hidden = true;

    const groups = OPTIONS.map(opt => {
      const cur = get(opt);
      const opts = opt.choices.map(c => `
        <label class="proto-panel__opt">
          <input type="radio" name="${RADIO_GROUP}_${opt.key}" data-key="${opt.key}"
                 value="${c.value}" ${c.value === cur ? 'checked' : ''}>
          <span>${c.label} <small>${c.hint}</small></span>
        </label>
      `).join('');
      return `<div class="proto-panel__group">
                <div class="proto-panel__label">${opt.label}</div>
                ${opts}
              </div>`;
    }).join('');

    panel.innerHTML = `
      <div class="proto-panel__title">Prototype settings</div>
      <div class="proto-panel__hint">Press <kbd>H</kbd> to toggle</div>
      ${groups}
    `;

    panel.addEventListener('click', e => e.stopPropagation());
    panel.addEventListener('change', e => {
      const inp = e.target;
      if (inp.tagName !== 'INPUT') return;
      const opt = OPTIONS.find(o => o.key === inp.dataset.key);
      if (opt) set(opt, inp.value);
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
