// parser.js : texte saisi <-> tâche. Aucune dépendance, fonctionne en ouvrant test.html directement.
(function (global) {
  'use strict';

  const COLORS = ['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet', 'rose', 'gris'];
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  // ---------- Dates (chaînes 'AAAA-MM-JJ', heure locale) ----------
  const pad = n => String(n).padStart(2, '0');
  const toDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addDays = (iso, n) => { const d = toDate(iso); return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
  const isValid = (y, m, d) => { const t = new Date(y, m - 1, d); return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d; };

  // "Jour courant" : le changement de jour se fait à 3 h (réglable).
  function logicalToday(now, hour) {
    now = now || new Date();
    return toISO(new Date(now.getTime() - (hour === undefined ? 3 : hour) * 3600000));
  }

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'");

  function parseDate(w, today) {
    if (w === "aujourd'hui" || w === 'aujourdhui') return today;
    if (w === 'demain') return addDays(today, 1);
    if (w === 'apres-demain' || w === 'apresdemain') return addDays(today, 2);

    const wd = DAYS.indexOf(w);
    if (wd >= 0) {                                   // prochain jour de la semaine à venir (jamais aujourd'hui)
      let diff = (wd - toDate(today).getDay() + 7) % 7;
      return addDays(today, diff === 0 ? 7 : diff);
    }

    const m = w.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (m) {
      const d = +m[1], mo = +m[2];
      if (m[3]) return isValid(+m[3], mo, d) ? m[3] + '-' + pad(mo) + '-' + pad(d) : null;
      const y0 = toDate(today).getFullYear();
      for (let y = y0; y <= y0 + 4; y++) {           // prochaine occurrence (aujourd'hui inclus)
        if (isValid(y, mo, d)) { const iso = y + '-' + pad(mo) + '-' + pad(d); if (iso >= today) return iso; }
      }
    }
    return null;
  }

  function parseTime(w) {                            // !18:30  ou  !18:
    const m = w.match(/^!(\d{1,2}):(\d{2})?$/);
    if (!m) return null;
    const h = +m[1], mi = m[2] === undefined ? 0 : +m[2];
    return h < 24 && mi < 60 ? pad(h) + ':' + pad(mi) : null;
  }

  // ---------- Texte -> tâche ----------
  function parse(text, today) {
    today = today || logicalToday();
    const res = { title: '', color: null, date: null, time: null, important: false };
    const kept = [];
    text.split(/\s+/).filter(Boolean).forEach(tok => {
      const n = norm(tok);
      if (tok === '€') { res.important = true; return; }
      if (n[0] === '&' && !res.color && COLORS.includes(n.slice(1))) { res.color = n.slice(1); return; }
      if (n[0] === '!' && !res.time) { const t = parseTime(n); if (t) { res.time = t; return; } }
      if (!res.date) { const d = parseDate(n.replace(/[.,;]+$/, ''), today); if (d) { res.date = d; return; } }
      kept.push(tok);                                // tout le reste appartient au titre
    });
    res.title = kept.join(' ');
    return res;
  }

  // ---------- Tâche -> texte (pour la modification) ----------
  function dateWord(iso, today) {
    const diff = Math.round((toDate(iso) - toDate(today)) / 86400000);
    if (diff === 0) return "aujourd'hui";
    if (diff === 1) return 'demain';
    if (diff === 2) return 'après-demain';
    if (diff >= 3 && diff <= 7) return DAYS[toDate(iso).getDay()];
    const d = toDate(iso), base = pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
    return parseDate(base, today) === iso ? base : base + '/' + d.getFullYear();
  }

  function toText(task, today) {
    today = today || logicalToday();
    const parts = [task.title];
    if (task.date) parts.push(dateWord(task.date, today));
    if (task.color) parts.push('&' + task.color);
    if (task.time) parts.push('!' + task.time);
    if (task.important) parts.push('€');
    return parts.join(' ');
  }

  const api = { parse, toText, logicalToday, addDays, toISO, toDate, COLORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Parser = api;
})(typeof window !== 'undefined' ? window : globalThis);
