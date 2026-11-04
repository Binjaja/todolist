// Jeu de tests : aujourd'hui = mercredi 4 novembre 2026.
const TODAY = '2026-11-04';
const TESTS = [
  ['Ranger lessive demain &bleu !18:30 €', { title: 'Ranger lessive', date: '2026-11-05', color: 'bleu', time: '18:30', important: true }],
  ['Appeler Marc samedi', { title: 'Appeler Marc', date: '2026-11-07' }],
  ['Sport mercredi', { title: 'Sport', date: '2026-11-11' }],
  ['Sport lundi', { title: 'Sport', date: '2026-11-09' }],
  ['Dentiste 17/11', { title: 'Dentiste', date: '2026-11-17' }],
  ['Anniversaire 02/11', { title: 'Anniversaire', date: '2027-11-02' }],
  ['Poster 04/11', { title: 'Poster', date: '2026-11-04' }],
  ['Impôts 15/05/2027', { title: 'Impôts', date: '2027-05-15' }],
  ['Rendez-vous après-demain', { title: 'Rendez-vous', date: '2026-11-06' }],
  ["Courses aujourd'hui", { title: 'Courses', date: '2026-11-04' }],
  ['Courses Aujourd’hui', { title: 'Courses', date: '2026-11-04' }],
  ['Médicament !8:', { title: 'Médicament', time: '08:00' }],
  ['Appel !25:00', { title: 'Appel !25:00', time: null }],
  ['Acheter du vert de gris', { title: 'Acheter du vert de gris', color: null }],
  ['Idée &violet', { title: 'Idée', color: 'violet' }],
  ['Idée &Rouge', { title: 'Idée', color: 'rouge' }],
  ['Fête 31/02', { title: 'Fête 31/02', date: null }],
  ['Payer loyer € demain,', { title: 'Payer loyer', date: '2026-11-05', important: true }],
];
// Aller-retour : texte -> tâche -> texte -> tâche doit donner la même tâche.
const ROUNDTRIPS = ['Ranger lessive demain &bleu !18:30 €', 'Dentiste 17/11', 'Anniversaire 02/11', 'Sport lundi', 'Fête après-demain', 'Impôts 15/05/2027'];
