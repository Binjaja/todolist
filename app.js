// app.js : affichage, interactions, démarrage.
(function () {
  'use strict';
  const S = Store.createStore(), P = Parser;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const HEX = { rouge: '#d93025', orange: '#e8710a', jaune: '#b38f00', vert: '#1e8e3e', bleu: '#1a73e8', violet: '#8430ce', rose: '#e056b0', gris: '#5f6368' };
  const now = () => new Date();
  const todayISO = () => P.logicalToday(now(), S.settings.rolloverHour);
  let editingId = null, sortables = [], shownDay = null;

  // Applique une modification en annulant/reprogrammant le rappel ntfy associé.
  function mutate(id, fn) {
    const snap = Notify.snapshot(S.tasks.find(x => x.id === id));
    const r = fn(); Notify.after(S, snap, id); return r;
  }

  // ---------- Affichage ----------
  function dayLabel(iso) {
    const t = todayISO();
    const prefix = iso === t ? "Aujourd'hui · " : iso === P.addDays(t, 1) ? 'Demain · ' : '';
    const d = P.toDate(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    return prefix + d.charAt(0).toUpperCase() + d.slice(1);
  }

  function taskRow(t) {
    const li = el('li', 'task' + (t.done ? ' done' : '') + (t.important ? ' important' : '') + (t.id === editingId ? ' editing' : ''));
    li.dataset.id = t.id;
    if (t.color) li.style.setProperty('--c', HEX[t.color]);
    li.append(el('button', 'chk'));
    li.lastChild.type = 'button'; li.lastChild.setAttribute('aria-label', t.done ? 'Rouvrir' : 'Terminer');
    if (t.overdue) { const d = el('span', 'dot'); d.title = 'Reportée'; li.append(d); }
    li.append(el('span', 'txt', t.title));
    if (t.time) li.append(el('span', 'meta', '⏰ ' + t.time));
    return li;
  }

  function makeSortable(ul) {
    if (typeof Sortable === 'undefined') return;
    sortables.push(new Sortable(ul, {
      animation: 150, delay: 250, delayOnTouchOnly: true, touchStartThreshold: 5, ghostClass: 'ghost',
      onEnd: () => S.reorder([...ul.children].map(li => li.dataset.id)),
    }));
  }

  function render() {
    sortables.forEach(s => s.destroy()); sortables = [];
    const ag = $('#agenda'); ag.replaceChildren();
    S.agenda(now()).forEach(g => {
      ag.append(el('div', 'sep' + (g.tasks.length ? '' : ' empty'), dayLabel(g.date)));
      const ul = el('ul', 'list'); ul.dataset.date = g.date;
      g.tasks.forEach(t => ul.append(taskRow(t)));
      ag.append(ul);
      if (g.tasks.length > 1) makeSortable(ul);
    });
    const un = $('#undated'); un.replaceChildren();
    const list = S.undated(now());
    list.forEach(t => un.append(taskRow(t)));
    if (list.length > 1) makeSortable(un);
    if (!list.length) un.append(el('li', 'empty-note', 'Aucune tâche sans date'));
    renderRoutine(); shownDay = todayISO();
  }

  // ---------- Routine ----------
  function renderRoutine() {
    const box = $('#routine'); box.replaceChildren();
    const items = S.routineItems(), today = todayISO();
    if (!items.length) { box.append(el('p', 'empty-note', 'Aucune habitude. Ajoute-en dans Menu → Routine.')); return; }
    const nDone = items.filter(i => S.routineDone(i.id, today)).length;
    box.append(el('div', 'sep', 'Aujourd’hui · ' + nDone + '/' + items.length));
    const ul = el('ul', 'list');
    items.forEach(i => {
      const li = el('li', 'task rtask' + (S.routineDone(i.id, today) ? ' done' : ''));
      li.dataset.rid = i.id; li.style.setProperty('--c', HEX[i.color]);
      const chk = el('button', 'chk'); chk.type = 'button'; chk.setAttribute('aria-label', 'Valider aujourd’hui');
      const txt = el('span', 'txt', i.name), total = S.routineTotal(i.id);
      txt.append(el('span', 'sub', total + (total > 1 ? ' jours validés' : ' jour validé')));
      li.append(chk, txt);
      const st = S.routineStreak(i.id, now());
      if (st > 0) li.append(el('span', 'meta', '🔥 ' + st));
      ul.append(li);
    });
    box.append(ul, gridEl(items));
  }

  function gridEl(items) {
    const g = el('div', 'grid'), hd = el('div', 'gh');
    'LMMJVSD'.split('').forEach(c => hd.append(el('span', '', c))); g.append(hd);
    S.routineGrid(now()).forEach(week => {
      const w = el('div', 'gw');
      week.forEach(c => {
        const b = el('button', 'gc' + (c.today ? ' today' : '') + (c.future ? ' future' : ''));
        b.type = 'button'; b.dataset.date = c.date; b.disabled = c.future;
        b.append(el('span', '', String(P.toDate(c.date).getDate())));
        const pts = el('div', 'pts');
        c.ids.forEach(id => { const p = el('i', 'pt'); p.style.background = HEX[items.find(i => i.id === id).color]; pts.append(p); });
        b.append(pts); w.append(b);
      });
      g.append(w);
    });
    return g;
  }

  $('#routine').addEventListener('click', e => {
    const li = e.target.closest('li[data-rid]');
    if (li) { S.toggleRoutine(li.dataset.rid, todayISO()); renderRoutine(); return; }
    const c = e.target.closest('.gc');
    if (c && !c.disabled) { showSheet('day', c.dataset.date); sheet.hidden = false; }
  });

  // ---------- Saisie / modification ----------
  const input = $('#in'), cancelBtn = $('#cancel');

  function startEdit(id) {
    editingId = id; input.value = S.textOf(id, now());
    cancelBtn.hidden = false; input.placeholder = 'Modifier la tâche…'; render(); input.focus();
  }
  function stopEdit() {
    editingId = null; input.value = ''; cancelBtn.hidden = true;
    input.placeholder = 'Nouvelle tâche…  demain &bleu !18:30 €'; render();
  }
  cancelBtn.addEventListener('click', stopEdit);

  // Rangée de touches rapides (& ! : €), visible pendant la saisie. On empêche la perte de focus pour garder le clavier.
  const keys = $('#keys');
  input.addEventListener('focus', () => { keys.hidden = false; });
  input.addEventListener('blur', () => { keys.hidden = true; });
  ['pointerdown', 'mousedown'].forEach(ev => keys.addEventListener(ev, e => e.preventDefault()));
  keys.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k === 'close') { input.blur(); return; }
    const ch = b.dataset.k, s = input.selectionStart, v = input.value;
    const space = ch !== ':' && s > 0 && !/\s/.test(v[s - 1]) ? ' ' : '';   // les codes doivent être séparés par un espace
    input.setRangeText(space + ch, s, input.selectionEnd, 'end'); input.focus();
  });

  $('#bar').addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim(); if (!text) return;
    const t = editingId ? mutate(editingId, () => S.updateFromText(editingId, text, now())) : S.addFromText(text, now());
    if (!t) return;
    Notify.sync(S);                                   // titre vide (que des codes) : on ne fait rien
    editingId = null; input.value = ''; cancelBtn.hidden = true; input.placeholder = 'Nouvelle tâche…  demain &bleu !18:30 €';
    render(); revealTask(t.id); goToPane(t.date ? 0 : 1);
  });

  document.addEventListener('click', e => {
    const li = e.target.closest('#panes li[data-id]'); if (!li) return;
    if (e.target.closest('.chk')) { mutate(li.dataset.id, () => S.toggleDone(li.dataset.id, now())); render(); } else startEdit(li.dataset.id);
  });

  // Fait défiler verticalement l'écran concerné jusqu'à la tâche, si elle n'est pas visible.
  function revealTask(id) {
    const li = document.querySelector('#panes li[data-id="' + id + '"]'); if (!li) return;
    const pane = li.closest('.pane');
    const top = li.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
    if (top < pane.scrollTop) pane.scrollTop = Math.max(0, top - 16);
    else if (top + li.offsetHeight > pane.scrollTop + pane.clientHeight) pane.scrollTop = top + li.offsetHeight - pane.clientHeight + 16;
  }

  // Clavier iOS : l'app prend exactement la taille de la zone visible. La liste se réduit au-dessus du
  // clavier et la barre reste collée dessus, sans que la page remonte.
  const vv = window.visualViewport;
  if (vv) {
    const fit = () => {
      document.body.style.setProperty('--vh', vv.height + 'px');
      document.body.style.transform = 'translateY(' + vv.offsetTop + 'px)';
      document.body.classList.toggle('kb', vv.height < window.innerHeight - 120);
    };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }

  // ---------- Deux écrans ----------
  const panes = $('#panes');
  const goToPane = i => panes.scrollTo({ left: i * panes.clientWidth, behavior: 'smooth' });
  panes.addEventListener('scroll', () => {
    const i = Math.round(panes.scrollLeft / panes.clientWidth);
    $('#title').textContent = ['Agenda', 'Sans date', 'Routine'][i] || 'Agenda';
    [...$('#dots').children].forEach((d, k) => d.classList.toggle('on', k === i));
  }, { passive: true });
  $('#dots').addEventListener('click', e => { const k = [...$('#dots').children].indexOf(e.target); if (k >= 0) goToPane(k); });

  // ---------- Menu ----------
  const sheet = $('#sheet'), card = $('#card');
  const close = () => { sheet.hidden = true; };
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
  $('#menuBtn').addEventListener('click', () => { showSheet('menu'); sheet.hidden = false; });

  function head(title, back) {
    const h = el('h2', '', title), b = el('button', '', back ? '‹ Retour' : 'Fermer');
    b.type = 'button'; b.onclick = back ? () => showSheet('menu') : close; h.append(b); card.append(h);
  }
  function button(cls, text, fn) { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; }

  function showSheet(view, arg) {
    card.replaceChildren();
    if (view === 'menu') {
      head('Menu');
      [['routine', 'Routine (habitudes)'], ['history', 'Historique'], ['settings', 'Réglages'], ['backup', 'Sauvegarde (export / import)']]
        .forEach(([v, l]) => card.append(button('item', l, () => showSheet(v))));
    } else if (view === 'history') {
      head('Historique', true);
      const h = S.history(now());
      if (!h.length) card.append(el('p', 'note', 'Aucune tâche terminée dans l’historique.'));
      h.forEach(t => {
        const r = el('div', 'row');
        r.append(el('span', 'txt', t.title), el('span', 'meta', P.toDate(t.doneAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })),
          button('', 'Restaurer', () => { S.restore(t.id, now()); Notify.sync(S); render(); showSheet('history'); }),
          button('del', 'Suppr.', () => { mutate(t.id, () => S.remove(t.id)); showSheet('history'); }));
        card.append(r);
      });
    } else if (view === 'settings') {
      head('Réglages', true);
      card.append(el('label', '', 'Heure de changement de jour'));
      const sel = el('select');
      for (let h = 0; h <= 6; h++) sel.append(new Option(h + ' h', h, false, h === S.settings.rolloverHour));
      sel.onchange = () => { S.setSetting('rolloverHour', +sel.value); S.rollover(now()); render(); };
      card.append(sel, el('label', '', 'Canal ntfy (nom secret pour les rappels)'));
      const topic = el('input'); topic.type = 'text'; topic.value = S.settings.ntfyTopic; topic.placeholder = 'ex. mes-taches-x7k2q9';
      topic.autocapitalize = 'none'; topic.onchange = () => { S.setSetting('ntfyTopic', topic.value.trim()); Notify.sync(S); };
      const status = el('p', 'note', 'Installe l’app ntfy sur l’iPhone et abonne-toi à ce même canal.');
      const b = el('div', 'btns');
      b.append(button('', 'Notification de test', async () => { status.textContent = (await Notify.test(S)) ? 'Envoyée : regarde ton téléphone.' : 'Échec : canal vide ou pas de connexion.'; }),
        button('', 'Test d’annulation', async () => {
          status.textContent = 'En cours…';
          status.textContent = (await Notify.testCancel(S)) ? 'Programmé puis annulé. Si rien n’arrive dans 2 minutes, l’annulation fonctionne.' : 'Échec : canal vide ou pas de connexion.';
        }));
      card.append(topic, b, status);
    } else if (view === 'routine') {
      head('Routine', true);
      const redo = () => { renderRoutine(); showSheet('routine'); };
      S.routineItems().forEach(it => {
        const r = el('div', 'row wrap'), sel = el('select');
        P.COLORS.forEach(c => sel.append(new Option(c, c, false, c === it.color)));
        sel.style.color = HEX[it.color]; sel.onchange = () => { S.updateRoutine(it.id, { color: sel.value }); redo(); };
        const nm = el('input'); nm.type = 'text'; nm.value = it.name; nm.onchange = () => { S.updateRoutine(it.id, { name: nm.value }); redo(); };
        r.append(sel, nm, button('', '↑', () => { S.moveRoutine(it.id, -1); redo(); }), button('', '↓', () => { S.moveRoutine(it.id, 1); redo(); }),
          button('del', 'Suppr.', () => { if (confirm('Retirer « ' + it.name + ' » ?')) { S.removeRoutine(it.id); redo(); } }));
        card.append(r);
      });
      const add = el('div', 'row'), nw = el('input'); nw.type = 'text'; nw.placeholder = 'Nouvelle habitude (ex. Étirements)';
      add.append(nw, button('', 'Ajouter', () => { if (S.addRoutine(nw.value, null, now())) redo(); }));
      card.append(add, el('p', 'note', 'Supprimer une habitude la retire de l’écran et de la grille ; ses données restent dans la sauvegarde.'));
    } else if (view === 'day') {
      head(dayLabel(arg));
      S.routineItems().forEach(it => {
        const r = el('div', 'row'), dot = el('span', 'dsw'); dot.style.background = HEX[it.color];
        const done = () => S.routineDone(it.id, arg), b = button('', done() ? '✔ Fait' : 'Pas fait', () => {
          S.toggleRoutine(it.id, arg); renderRoutine(); showSheet('day', arg);
        });
        r.append(dot, el('span', 'txt', it.name), b); card.append(r);
      });
      if (!S.routineItems().length) card.append(el('p', 'note', 'Aucune habitude.'));
    } else if (view === 'backup') {
      head('Sauvegarde', true);
      const ta = el('textarea'); ta.spellcheck = false;
      const msg = el('p', 'note', 'Exporter remplit la zone ci-dessus : copie-la dans un endroit sûr. Importer remplace tout par le contenu de la zone.');
      const b = el('div', 'btns');
      b.append(button('', 'Exporter', () => { ta.value = S.exportJSON(); ta.select(); msg.textContent = 'Export prêt : copie tout le texte.'; }),
        button('', 'Importer', () => {
          if (!ta.value.trim() || !confirm('Remplacer toutes les tâches actuelles ?')) return;
          if (S.importJSON(ta.value)) { render(); close(); } else msg.textContent = 'Texte invalide : import annulé.';
        }));
      card.append(ta, b, msg);
    }
  }

  // ---------- Démarrage et changement de jour ----------
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { S.rollover(now()); render(); Notify.sync(S); } });
  setInterval(() => { if (S.rollover(now()) || todayISO() !== shownDay) render(); Notify.sync(S); }, 60000);
  S.rollover(now()); render(); Notify.sync(S);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
