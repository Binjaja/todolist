// notify.js : rappels via ntfy.sh. Un rappel est programmé chez ntfy (au plus 3 jours à l'avance)
// avec un identifiant de séquence, ce qui permet de l'annuler si la tâche change.
(function (global) {
  'use strict';
  const BASE = 'https://ntfy.sh';
  const MAX_MS = 71 * 3600e3;      // ntfy accepte au plus 3 jours : marge de sécurité
  const MIN_MS = 15e3;             // et au moins 10 secondes
  const inflight = new Set();

  const topicOf = store => (store.settings.ntfyTopic || '').trim();
  const stamp = iso => Math.floor(Date.parse(iso) / 1000);
  const newSeq = (id, remindAt) => 'r' + id + '_' + stamp(remindAt) + '_' + Date.now().toString(36);   // unique à chaque envoi

  async function publish(body) {
    try { return (await fetch(BASE + '/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).ok; }
    catch (e) { return false; }
  }
  async function remove(topic, seq) {
    try { return (await fetch(BASE + '/' + encodeURIComponent(topic) + '/' + encodeURIComponent(seq), { method: 'DELETE' })).ok; }
    catch (e) { return false; }
  }

  // Envoie à ntfy les rappels qui entrent dans la fenêtre de 3 jours (une seule fois chacun).
  async function sync(store, now) {
    const topic = topicOf(store); if (!topic) return 0;
    now = now || new Date();
    let sent = 0;
    for (const t of store.tasks.slice()) {
      if (t.done || !t.remindAt || t.notified || inflight.has(t.id)) continue;
      const ms = Date.parse(t.remindAt) - now.getTime();
      if (ms < MIN_MS || ms > MAX_MS) continue;
      inflight.add(t.id);
      const seq = newSeq(t.id, t.remindAt);
      const ok = await publish({ topic, title: 'Rappel', message: t.title, tags: ['alarm_clock'],
        priority: t.important ? 4 : 3, delay: String(stamp(t.remindAt)), sequence_id: seq });
      inflight.delete(t.id);
      if (!ok) continue;                                   // échec réseau : on réessaiera au prochain passage
      const cur = store.tasks.find(x => x.id === t.id);
      if (cur && !cur.done && cur.remindAt === t.remindAt) { store.markNotified(t.id, true, seq); sent++; }
      else await remove(topic, seq);                       // la tâche a changé pendant l'envoi : on annule
    }
    return sent;
  }

  // À appeler AVANT une modification : mémorise le rappel déjà programmé, s'il y en a un.
  function snapshot(t) {
    return t && t.notified && t.seq && t.remindAt && Date.parse(t.remindAt) > Date.now() ? { id: t.id, remindAt: t.remindAt, seq: t.seq } : null;
  }
  // À appeler APRÈS : annule l'ancien rappel s'il n'est plus valable, puis programme le nouveau.
  async function after(store, snap, id) {
    const t = store.tasks.find(x => x.id === id), topic = topicOf(store);
    if (snap && topic && !(t && !t.done && t.notified && t.remindAt === snap.remindAt)) {
      await remove(topic, snap.seq);
      if (t) store.markNotified(id, false);
    }
    return sync(store);
  }

  async function test(store) {
    const topic = topicOf(store); if (!topic) return false;
    return publish({ topic, title: 'Test', message: 'Les rappels fonctionnent ✔', tags: ['white_check_mark'] });
  }
  // Programme un message dans 2 minutes, puis l'annule : s'il n'arrive pas, l'annulation marche.
  async function testCancel(store) {
    const topic = topicOf(store); if (!topic) return false;
    const seq = 'test-annulation-' + Date.now();
    const ok = await publish({ topic, title: 'Test annulation', message: 'Ce message ne devrait PAS arriver',
      delay: String(Math.floor(Date.now() / 1000) + 120), sequence_id: seq });
    if (!ok) return false;
    await new Promise(r => setTimeout(r, 3000));
    return remove(topic, seq);
  }

  const api = { sync, snapshot, after, test, testCancel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else global.Notify = api;
})(typeof window !== 'undefined' ? window : globalThis);
