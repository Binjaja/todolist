// store.js : données, règles métier, stockage local. Aucune dépendance à l'affichage.
(function (global) {
  'use strict';
  const P = (typeof module !== 'undefined' && module.exports) ? require('./parser.js') : global.Parser;
  const KEY = 'todo.v1';
  const DEFAULTS = { rolloverHour: 3, ntfyTopic: '' };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const byOrder = (a, b) => a.order - b.order;

  // Heure exacte du rappel : date + heure, ou prochaine occurrence de l'heure si pas de date.
  function remindAtFor(date, time, now) {
    if (!time) return null;
    const [h, mi] = time.split(':').map(Number);
    if (date) { const d = P.toDate(date); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mi).toISOString(); }
    const c = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, mi);
    if (c <= now) c.setDate(c.getDate() + 1);
    return c.toISOString();
  }

  function normalize(o) {
    const r = o && o.routine;
    return { tasks: Array.isArray(o && o.tasks) ? o.tasks : [], settings: Object.assign({}, DEFAULTS, o && o.settings),
      routine: { items: Array.isArray(r && r.items) ? r.items : [], log: r && r.log && typeof r.log === 'object' ? r.log : {} } };
  }

  function createStore(storage) {
    storage = storage || global.localStorage;
    let state = normalize(null);
    try { const raw = storage.getItem(KEY); if (raw) state = normalize(JSON.parse(raw)); } catch (e) { /* données illisibles : on repart de zéro */ }

    const save = () => { try { storage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error('Sauvegarde impossible', e); } };
    const todayOf = now => P.logicalToday(now || new Date(), state.settings.rolloverHour);
    const get = id => state.tasks.find(t => t.id === id);
    const nextOrder = date => state.tasks.filter(t => t.date === date).reduce((m, t) => Math.max(m, t.order), -1) + 1;
    // Une tâche terminée reste visible jusqu'au changement de jour, puis passe à l'historique.
    const visible = (t, today) => !t.done || t.doneAt >= today;
    const FREE_COLORS = ['bleu', 'vert', 'orange', 'violet', 'rose', 'jaune', 'rouge', 'gris'];
    const activeItems = () => state.routine.items.filter(i => !i.archived).sort(byOrder);
    const doneOn = (id, iso) => (state.routine.log[iso] || []).includes(id);
    const gap = (a, b) => Math.round((P.toDate(a) - P.toDate(b)) / 86400000);

    // Série : jours validés d'affilée en remontant. Un jour manqué est toléré, mais deux jours manqués
    // à moins de 7 jours d'écart cassent la série. Aujourd'hui non validé n'est pas encore un jour manqué.
    function streakOf(item, today) {
      let d = doneOn(item.id, today) ? today : P.addDays(today, -1), count = 0, lastMiss = null;
      for (let i = 0; i < 800 && d >= item.created; i++, d = P.addDays(d, -1)) {
        if (doneOn(item.id, d)) count++;
        else { if (lastMiss !== null && gap(lastMiss, d) < 7) break; lastMiss = d; }
      }
      return count;
    }

    return {
      get tasks() { return state.tasks; },
      get settings() { return state.settings; },
      setSetting(k, v) { state.settings[k] = v; save(); },

      addFromText(text, now) {
        now = now || new Date();
        const p = P.parse(text, todayOf(now));
        if (!p.title) return null;
        const t = { id: uid(), title: p.title, color: p.color, date: p.date, time: p.time, important: p.important,
          done: false, doneAt: null, order: nextOrder(p.date), remindAt: remindAtFor(p.date, p.time, now),
          notified: false, overdue: false };
        state.tasks.push(t); save(); return t;
      },

      updateFromText(id, text, now) {
        now = now || new Date();
        const t = get(id), p = P.parse(text, todayOf(now));
        if (!t || !p.title) return null;
        const sameReminder = t.date === p.date && t.time === p.time && t.remindAt;
        if (t.date !== p.date) t.order = nextOrder(p.date);        // changement de pile : en bas de la nouvelle
        Object.assign(t, { title: p.title, color: p.color, date: p.date, time: p.time, important: p.important, overdue: false });
        if (!sameReminder) { t.remindAt = remindAtFor(p.date, p.time, now); t.notified = false; }
        save(); return t;
      },

      textOf(id, now) { const t = get(id); return t ? P.toText(t, todayOf(now)) : ''; },

      toggleDone(id, now) {
        const t = get(id); if (!t) return null;
        t.done = !t.done; t.doneAt = t.done ? todayOf(now) : null;
        save(); return t;
      },

      markNotified(id, v, seq) { const t = get(id); if (t) { t.notified = v !== false; t.seq = t.notified ? (seq || null) : null; save(); } },

      remove(id) { state.tasks = state.tasks.filter(t => t.id !== id); save(); },

      // ids = nouvel ordre d'une pile ; on redistribue les valeurs d'ordre existantes (les autres tâches ne bougent pas)
      reorder(ids) {
        const list = ids.map(get).filter(Boolean);
        const orders = list.map(t => t.order).sort((a, b) => a - b);
        list.forEach((t, i) => { t.order = orders[i]; });
        save();
      },

      // Tâches non terminées d'un jour passé : perdent date et rappel, montent en haut de « Sans date ».
      rollover(now) {
        const today = todayOf(now);
        const late = state.tasks.filter(t => !t.done && t.date && t.date < today)
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order));
        if (!late.length) return 0;
        const orders = state.tasks.filter(t => !t.date).map(t => t.order);
        const base = (orders.length ? Math.min(...orders) : 0) - late.length;
        late.forEach((t, i) => Object.assign(t, { date: null, time: null, remindAt: null, notified: false, overdue: true, order: base + i }));
        save(); return late.length;
      },

      // Écran de gauche : aujourd'hui + 6 jours toujours présents, puis les jours plus lointains ayant des tâches.
      agenda(now) {
        const today = todayOf(now), groups = {};
        for (let i = 0; i < 7; i++) groups[P.addDays(today, i)] = { date: P.addDays(today, i), tasks: [], fixed: true };
        state.tasks.filter(t => t.date && visible(t, today)).forEach(t => {
          (groups[t.date] = groups[t.date] || { date: t.date, tasks: [], fixed: false }).tasks.push(t);
        });
        return Object.values(groups).sort((a, b) => (a.date < b.date ? -1 : 1)).map(g => (g.tasks.sort(byOrder), g));
      },

      undated(now) { const today = todayOf(now); return state.tasks.filter(t => !t.date && visible(t, today)).sort(byOrder); },

      history(now) {
        const today = todayOf(now);
        return state.tasks.filter(t => t.done && t.doneAt < today).sort((a, b) => (a.doneAt < b.doneAt ? 1 : -1));
      },

      restore(id, now) {
        const t = get(id); if (!t) return null;
        t.done = false; t.doneAt = null;
        if (t.date && t.date < todayOf(now)) { t.date = null; t.time = null; t.remindAt = null; }
        t.order = nextOrder(t.date); save(); return t;
      },

      // ---------- Routine ----------
      routineItems() { return activeItems(); },
      routineDone: doneOn,
      addRoutine(name, color, now) {
        name = (name || '').trim(); if (!name) return null;
        const items = activeItems(), used = items.map(i => i.color);
        const item = { id: uid(), name, color: color || FREE_COLORS.find(c => !used.includes(c)) || FREE_COLORS[items.length % 8],
          order: state.routine.items.reduce((m, i) => Math.max(m, i.order), -1) + 1, created: todayOf(now), archived: false };
        state.routine.items.push(item); save(); return item;
      },
      updateRoutine(id, patch) {
        const i = state.routine.items.find(x => x.id === id); if (!i) return null;
        if (patch.name && patch.name.trim()) i.name = patch.name.trim();
        if (patch.color) i.color = patch.color;
        save(); return i;
      },
      moveRoutine(id, dir) {
        const l = activeItems(), k = l.findIndex(i => i.id === id), o = l[k + dir];
        if (k < 0 || !o) return; [l[k].order, o.order] = [o.order, l[k].order]; save();
      },
      removeRoutine(id) { const i = state.routine.items.find(x => x.id === id); if (i) { i.archived = true; save(); } },   // données conservées
      toggleRoutine(id, iso) {
        const day = (state.routine.log[iso] || []).slice(), k = day.indexOf(id);
        if (k >= 0) day.splice(k, 1); else day.push(id);
        if (day.length) state.routine.log[iso] = day; else delete state.routine.log[iso];
        save(); return k < 0;
      },
      routineStreak(id, now) { const i = state.routine.items.find(x => x.id === id); return i ? streakOf(i, todayOf(now)) : 0; },
      routineTotal(id) { return Object.values(state.routine.log).filter(ids => ids.includes(id)).length; },
      // 4 semaines (lundi -> dimanche), la dernière étant la semaine en cours.
      routineGrid(now) {
        const today = todayOf(now), items = activeItems();
        const start = P.addDays(today, -((P.toDate(today).getDay() + 6) % 7) - 21), weeks = [];
        for (let w = 0; w < 4; w++) {
          const row = [];
          for (let d = 0; d < 7; d++) {
            const iso = P.addDays(start, w * 7 + d);
            row.push({ date: iso, today: iso === today, future: iso > today, ids: items.filter(i => doneOn(i.id, iso)).map(i => i.id) });
          }
          weeks.push(row);
        }
        return weeks;
      },

      exportJSON() { return JSON.stringify(state, null, 2); },
      importJSON(json) {
        try { const o = JSON.parse(json); if (!o || !Array.isArray(o.tasks)) return false; state = normalize(o); save(); return true; }
        catch (e) { return false; }
      },
    };
  }

  const api = { createStore, remindAtFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else global.Store = api;
})(typeof window !== 'undefined' ? window : globalThis);
