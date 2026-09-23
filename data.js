// ==========================================================================
// data.js — tout le CONTENU du jeu : personnages, événements, objets, lieux.
// Ce fichier doit être chargé AVANT game.js (qui référence PLACES au démarrage).
// Rien de mécanique ici : les fonctions du moteur (cout, sfx, log, police…)
// sont appelées à l'intérieur des `fn`, définies dans game.js — l'ordre de
// chargement n'a pas d'importance pour elles car elles ne s'exécutent qu'au clic.
// ==========================================================================

// ---- Personnages récurrents : ils se souviennent de ce que tu fais ----
// rel = relation (négative = rancune) · vu = déjà rencontré · les autres champs retiennent ce qui s'est passé
const PNJ = {
  karim:  { ico: '🧔', img: 'images/pnj/karim.png', nom: 'Karim', role: 'voisin de foyer' },
  helene: { ico: '👩‍🦳', img: 'images/pnj/helene.png', nom: 'Hélène', role: 'bénévole à l’association' },
  morel:  { ico: '👮', img: 'images/pnj/morel.png', nom: 'Brigadier Morel', role: 'policier du quartier' },
  dede:   { ico: '🕶️', img: 'images/pnj/dede.png', nom: 'Dédé', role: 'prêteur' }
};
const P = id => { s.pnj = s.pnj || {}; return (s.pnj[id] = s.pnj[id] || { rel: 0 }); };
const connu = id => !!(s.pnj && s.pnj[id] && s.pnj[id].vu);
const lien = (id, n) => { if (connu(id)) P(id).rel += n; };
const humeur = r => r >= 3 ? '😊' : r >= 1 ? '🙂' : r > -2 ? '😐' : '😠';
function voirKarim() {
  const k = P('karim');
  if (!k.vu) { k.vu = true; log('🧔 Un homme s’assoit à côté de toi : Karim, arrivé il y a deux ans. Il dort dans le lit voisin du tien.'); return; }
  if (premiereFois('karim')) { k.rel++; log(`🧔 Tu passes un moment avec Karim. ${k.rel >= 3 ? 'Vous riez comme de vieux amis.' : 'Il te raconte son village.'}`); }
}
function voirHelene() {
  const h = P('helene');
  if (h.sait) return log('👩‍🦳 Hélène t’évite. Elle sait ce que tu as fait.');
  if (!h.vu) { h.vu = true; log('👩‍🦳 Une bénévole aux cheveux bouclés, un badge « Hélène » autour du cou, vient vers toi. « Si tu as besoin de quoi que ce soit, tu viens me voir. »'); return; }
  if (premiereFois('helene')) { h.rel++; if (h.rel === 3) log('👩‍🦳 Hélène se souvient de ton prénom et de ton histoire.'); }
}

const PAPIERS = ['Aucun', 'Dossier déposé', 'Récépissé', 'Titre de séjour'];

// ---- Événements surprises au réveil ----
const EVENTS = [
  // --- Karim ---
  { choice: true, ico: '🧔', img: 'images/pnj/karim.png', col: '#b7791f', cond: () => connu('karim') && !P('karim').etape,
    txt: () => 'Karim a besoin de 10 € pour ses médicaments. Il promet de te rendre le double dans quelques jours.',
    opts: [
      ['Prêter 10 €', () => {
        if (s.argent < 10) return 'Tu n’as même pas 10 €. Karim comprend.';
        const k = P('karim'); s.argent -= 10; k.rel += 2; k.etape = 1; k.rend = s.jour + 3; sfx('good');
        return 'Karim te serre la main longtemps. « Je n’oublierai pas. »'; }],
      ['Refuser', () => { const k = P('karim'); k.rel -= 2; k.etape = 2; return 'Karim hoche la tête sans rien dire.'; }]
    ] },
  { ico: '🧔', img: 'images/pnj/karim.png', col: '#b7791f', cond: () => P('karim').etape === 1 && s.jour >= P('karim').rend, snd: 'coin',
    txt: () => 'Karim te rend 20 €, comme promis. « Chez nous, une dette, c’est sacré. »',
    fx: () => { const k = P('karim'); s.argent += 20; k.rel++; k.etape = 2; } },
  { ico: '🧔', img: 'images/pnj/karim.png', col: '#b7791f', cond: () => P('karim').etape === 2 && P('karim').rel >= 3 && !P('karim').cousin, snd: 'good',
    txt: () => 'Karim te présente son cousin, qui connaît tout le monde dans le quartier. Réseau +2.',
    fx: () => { P('karim').cousin = true; s.reseau += 2; } },
  { ico: '🧔', img: 'images/pnj/karim.png', col: '#b7791f', cond: () => P('karim').etape === 2 && P('karim').rel < 0 && !P('karim').rancune, snd: 'bad',
    txt: () => 'Au foyer, Karim raconte que tu l’as laissé tomber. Les regards ont changé.',
    fx: () => { P('karim').rancune = true; s.moral -= 8; s.reseau = Math.max(0, s.reseau - 1); } },
  // --- Hélène ---
  { ico: '👩‍🦳', img: 'images/pnj/helene.png', col: '#9b59b6', cond: () => P('helene').rel >= 3 && !P('helene').cadeau && !P('helene').sait, snd: 'good',
    txt: () => has('manteau') || !placeLibre() ? 'Hélène t’a gardé une soupe chaude et un sandwich. +10 santé.' : 'Hélène t’a mis de côté un manteau chaud, à ta taille.',
    fx: () => { P('helene').cadeau = true; if (has('manteau') || !placeLibre()) s.sante += 10; else ajoute('manteau'); } },
  { choice: true, ico: '👩‍🦳', img: 'images/pnj/helene.png', col: '#9b59b6', cond: () => P('helene').rel >= 5 && !P('helene').lettre && !P('helene').sait && !P('helene').refus,
    txt: () => 'Hélène propose d’écrire une lettre de soutien pour ton dossier. Il faut passer la matinée avec elle à tout relire.',
    opts: [
      ['Accepter (jusqu’à 11 h)', () => { P('helene').lettre = true; s.heure = 11; sfx('win'); return 'La lettre est signée : +10 % à chaque visite à la préfecture.'; }],
      ['Pas aujourd’hui', () => { P('helene').refus = true; P('helene').rel--; return 'Hélène range la feuille. « Comme tu veux. »'; }]
    ] },
  { ico: '👩‍🦳', img: 'images/pnj/helene.png', col: '#9b59b6', cond: () => connu('helene') && s.crimes > 0 && !P('helene').sait, snd: 'bad',
    txt: () => 'Hélène a entendu parler de l’agression dans le quartier. Elle a reconnu ta description.' + (P('helene').lettre ? ' Elle retire sa lettre de soutien.' : ''),
    fx: () => { const h = P('helene'); h.sait = true; h.rel = -5; h.lettre = false; s.moral -= 15; } },
  // --- Brigadier Morel ---
  { ico: '👮', img: 'images/pnj/morel.png', col: '#2f6fd1', cond: () => P('morel').rel >= 3 && !P('morel').conseil, snd: 'good',
    txt: () => 'Le brigadier Morel te glisse en passant : « Évite le coin de rue cette semaine. » Tu n’es plus repéré·e.',
    fx: () => { P('morel').conseil = true; s.chaud = 0; } },
  { ico: '👮', img: 'images/pnj/morel.png', col: '#2f6fd1', cond: () => connu('morel') && P('morel').rel <= -3 && !P('morel').hostile, snd: 'bad',
    txt: () => 'Le brigadier Morel t’a dans le collimateur. Ses collègues connaissent ton visage.',
    fx: () => { P('morel').hostile = true; s.chaud = (s.chaud || 0) + 3; } },
  { ico: '🍲', col: '#d9822b', txt: () => `Un bénévole offre un repas chaud à ${name}.`, fx: () => { s.sante += 10; s.moral += 5; }, snd: 'good' },
  { ico: '📵', col: '#6b7280', txt: () => `Le téléphone de ${name} a été volé dans la nuit !`, fx: () => { s.tel = 0; s.moral -= 15; volObjet(.5); }, snd: 'bad' },
  { ico: '💸', col: '#c0392b', txt: () => 'On te réclame de l’argent pour ta place : -20 €, ou tout ce que tu as.', fx: () => { s.argent = Math.max(0, s.argent - 20); }, snd: 'bad' },
  { ico: '💶', col: '#2f9e5a', txt: () => 'Tu trouves un billet de 10 € par terre.', fx: () => { s.argent += 10; s.moral += 3; }, snd: 'coin' },
  { ico: '🥶', col: '#2f6fd1', txt: () => has('couchage') ? 'Nuit glaciale, mais ton sac de couchage te garde au chaud.' : 'Nuit glaciale, tu dors mal.', fx: () => { if (!has('couchage')) s.sante -= 12; }, snd: 'bad' },
  { ico: '🗣️', col: '#8e44ad', txt: () => 'Un voisin t\'apprend quelques mots en échange d\'un coup de main.', fx: () => { if (s.langue < 10) s.langue++; }, snd: 'good' },
  { choice: true, ico: '💼', img: 'images/evenements/travail-noir.png', col: '#d9822b', txt: () => 'Un inconnu te propose un travail au noir bien payé (60 €). Mais c\'est risqué…',
    opts: [
      ['Accepter', () => {
        if (Math.random() < 0.35) { s.moral -= 25; s.papiers = Math.max(0, s.papiers - 1); sfx('bad'); return 'Contrôle de police ! Ton dossier recule.'; }
        s.argent += 60; s.sante -= 15; sfx('coin'); return 'Tu as été payé·e 60 €. Épuisant, mais ça aide.';
      }],
      ['Refuser', () => { s.moral += 2; return 'Tu préfères ne pas prendre de risque.'; }]
    ] },
  { choice: true, ico: '🤝', col: '#c2477a', txt: () => 'Un autre migrant, sans rien à manger, te demande de l\'aide.',
    opts: [
      ['Partager (10 €)', () => { if (s.argent < 10) return 'Tu n\'as même pas 10 €…'; s.argent -= 10; s.reseau++; s.moral += 10; sfx('good'); return 'Il te remercie. Un ami de plus.'; }],
      ['Passer ton chemin', () => { s.moral -= 5; return 'Tu y repenses toute la journée.'; }]
    ] },
  { choice: true, ico: '👮', img: 'images/evenements/controle.png', col: '#2f6fd1', txt: () => connu('morel') ? `Le brigadier Morel t'arrête pour un contrôle d'identité. ${humeur(P('morel').rel)}` : 'Contrôle d\'identité dans la rue ! Le policier se présente : brigadier Morel.',
    opts: [
      ['Montrer tes papiers', () => {
        P('morel').vu = true;
        if (s.recherche) { arrete('Le policier vérifie ton nom : tu es recherché·e. On t’embarque.'); return 'Arrêté·e.'; }
        P('morel').rel++;
        if (s.papiers >= 2) { sfx('good'); return 'Le récépissé suffit. Morel note que tu as joué franc jeu.'; }
        if (P('morel').rel >= 3) { sfx('good'); return 'Morel soupire : « Je te connais. Va, et fais avancer ton dossier. »'; }
        s.moral -= 15; s.sante -= 5; sfx('bad'); return 'Tu passes 4 h au commissariat… Morel, au moins, a été correct.';
      }],
      ['Courir', () => {
        P('morel').vu = true; P('morel').rel -= 2;
        if (Math.random() < 0.5) { s.sante -= 10; return 'Tu t\'en sors, mais tu t\'es fait mal.'; }
        if (s.recherche) { arrete('Rattrapé·e après une course-poursuite. Ils savent ce que tu as fait.'); return 'Arrêté·e.'; }
        s.moral -= 25; s.papiers = Math.max(0, s.papiers - 1); sfx('bad'); return 'Rattrapé·e. Ton dossier recule.';
      }]
    ] },
  { choice: true, ico: '🎒', col: '#8a5a2b', txt: () => 'Un habitué te demande de garder son sac « juste 10 minutes ».',
    opts: [
      ['Accepter', () => {
        if (Math.random() < .5) { s.argent += 10; s.reseau++; sfx('coin'); return 'Il revient, te remercie et te glisse 10 €.'; }
        police(2); s.chaud += 3; return 'Le sac n\'était pas net. Te voilà fiché·e dans le quartier.';
      }],
      ['Refuser', () => { s.moral -= 5; return 'Il t\'insulte devant tout le monde.'; }]
    ] },
  { choice: true, ico: '🔦', col: '#6b7280', txt: () => `Le gardien fouille les affaires de ${name} sans rien demander.`,
    opts: [
      ['Baisser la tête', () => { s.moral -= 12; return 'Tu ne dis rien. C\'est ça le plus dur.'; }],
      ['Rétorquer', () => {
        s.moral += 5;
        if (s.argent >= 10) { s.argent -= 10; return 'Tu tiens tête. Ça te coûte 10 € de « frais » le lendemain.'; }
        s.sante -= 10; s.moral -= 10; sfx('bad'); return 'Tu tiens tête, et tu dors dehors pour la nuit.';
      }]
    ] },
  { choice: true, ico: '📱', img: 'images/evenements/telephone.png', col: '#2f9e5a', txt: () => 'Un habitué demande ton téléphone pour un « appel urgent ».',
    opts: [
      ['Prêter', () => {
        if (Math.random() < .6) { s.tel = 0; return 'Il te le rend, batterie à zéro.'; }
        const perte = Math.min(s.argent, 30); s.argent -= perte; s.moral -= 10; sfx('bad');
        return `Il disparaît avec. Tu en rachètes un d'occasion (−${perte} €).`;
      }],
      ['Refuser', () => { s.moral -= 5; return 'Il hausse les épaules. L\'ambiance est glaciale.'; }]
    ] },
  { choice: true, ico: '💌', col: '#c0392b', get img() { return `images/evenements/famille-${{ '#111111': 'noir', '#facc15': 'jaune', '#7b4a2a': 'marron' }[color]}.png`; }, txt: () => 'Ta famille a besoin d\'argent au pays.',
    opts: [
      ['Envoyer 25 €', () => { if (s.argent < 25) return 'Tu n\'as pas assez… ça te pèse.'; s.argent -= 25; s.moral += 12; sfx('coin'); return 'Ta famille t\'appelle pour te remercier.'; }],
      ['Garder ton argent', () => { s.moral -= 10; return 'Tu culpabilises.'; }]
    ] }
];

// ---- Sacs et objets (le bazar) ----
// sans sac : 2 places (les poches). Les paquets de cigarettes prennent aussi une place chacun.
const SACS = [
  { nom: 'Poches', ico: '👖', img: 'images/sacs/poches.png', cap: 2 },
  { nom: 'Sac en plastique', ico: '🛍️', img: 'images/sacs/plastique.png', cap: 4, prix: 2, info: 'peut se déchirer la nuit dehors' },
  { nom: 'Sac à dos', ico: '🎒', img: 'images/sacs/dos.png', cap: 7, prix: 25, info: 'solide' },
  { nom: 'Sac de randonnée', ico: '🥾', img: 'images/sacs/rando.png', cap: 10, prix: 60, info: 'impossible à voler' }
];
// unique : on ne peut en avoir qu'un · u : utilisations (ou jour d'expiration pour la carte) · use : objet qu'on peut utiliser
const ITEMS = {
  couchage:  { ico: '🛏️', img: 'images/objets/couchage.png', nom: 'Sac de couchage', prix: 20, unique: true, desc: 'Dormir sous le pont ne coûte que −4 santé, et tu ne crains plus les nuits glaciales.' },
  cadenas:   { ico: '🔒', img: 'images/objets/cadenas.png', nom: 'Cadenas', prix: 8, unique: true, desc: 'Au squat, une bagarre ne te coûte plus d’argent.' },
  manteau:   { ico: '🧥', img: 'images/objets/manteau.png', nom: 'Manteau chaud', prix: 15, unique: true, desc: '+3 santé chaque nuit au squat ou sous le pont.' },
  batterie:  { ico: '🔋', img: 'images/objets/batterie.png', nom: 'Batterie externe', prix: 12, unique: true, desc: 'Recharge le téléphone à 100 %, une fois par jour.',
               use: '🔋 Recharger le téléphone', fn: () => {
                 if (!premiereFois('batterie')) return non('La batterie externe est vide. Elle se recharge pendant la nuit.');
                 s.tel = 100; sfx('ring'); log('🔋 Téléphone rechargé à 100 %.'); } },
  montre:    { ico: '⌚', img: 'images/objets/montre.png', nom: 'Montre', prix: 10, unique: true, desc: 'Tu connais l’heure exacte, et combien de temps il reste avant qu’un lieu ferme.' },
  transport: { ico: '🎫', img: 'images/objets/transport.png', nom: 'Carte de transport', prix: 15, unique: true, u: () => s.jour + 7, desc: 'Deux trajets pour 1 h. Valable 7 jours.' },
  pochette:  { ico: '📁', img: 'images/objets/pochette.png', nom: 'Pochette de documents', prix: 5, unique: true, desc: 'Après un échec à la préfecture, tu ne perds que la moitié de ton bonus de dossier.' },
  tenue:     { ico: '👔', img: 'images/objets/tenue.png', nom: 'Tenue propre', prix: 18, unique: true, u: () => 3, desc: '+5 % à chaque visite à la préfecture. S’use après 3 visites.' },
  dico:      { ico: '📘', img: 'images/objets/dico.png', nom: 'Dictionnaire de poche', prix: 10, unique: true, desc: '+10 % de chance de progresser en langue.' },
  trousse:   { ico: '🩹', img: 'images/objets/trousse.png', nom: 'Trousse de secours', prix: 12, u: () => 3, desc: '+15 santé, n’importe où, sans perdre de temps. 3 utilisations.',
               use: '🩹 Se soigner (+15 santé)', fn: k => {
                 s.sante += 15; sfx('good'); log('🩹 Tu désinfectes et tu bandes tes blessures (+15 santé).');
                 if (--s.inv[k].u <= 0) { s.inv.splice(k, 1); log('La trousse de secours est vide.'); } } },
  provisions:{ ico: '🧃', img: 'images/objets/provisions.png', nom: 'Provisions', prix: 6, desc: 'Un repas à emporter : +8 santé, n’importe où.',
               use: '🧃 Manger (+8 santé)', fn: k => {
                 s.inv.splice(k, 1); s.sante += 8; s.moral += 2; sfx('good'); log('🧃 Tu manges tes provisions sur le pouce (+8 santé).'); } },
  machette:  { ico: '🔪', img: 'images/objets/machette.png', nom: 'Machette', prix: 25, unique: true, desc: 'Une arme. Si la police te contrôle avec, l’amende double.' },
  photo:     { ico: '📷', img: 'images/objets/photo.png', nom: 'Photo de famille', prix: 0, unique: true, desc: '+2 moral chaque matin. La perdre ferait très mal.' }
};

// actions du bazar : les sacs (on ne peut que monter en gamme), puis les objets
const BAZAR_ACTS = [
  ...SACS.slice(1).map((sac, n) => ({ ico: sac.ico, img: sac.img, nom: `Acheter un ${sac.nom.toLowerCase()}`, d: 0, achat: true,
    info: `${sac.prix} € · ${sac.cap} places · ${sac.info}`, hide: () => (s.sac || 0) >= n + 1, fn: () => {
      if (!cout(sac.prix)) return;
      s.sac = n + 1; sfx('coin'); log(`${sac.ico} Tu as maintenant un ${sac.nom.toLowerCase()} : ${sac.cap} places.`); } })),
  ...Object.entries(ITEMS).filter(([, d]) => d.prix).map(([id, d]) => ({ ico: d.ico, img: d.img, nom: d.nom, d: 0, achat: true,
    info: `${d.prix} € · ${d.desc}`, hide: () => d.unique && has(id), fn: () => {
      if (!placeLibre()) return sacPlein();
      if (!cout(d.prix)) return;
      ajoute(id); sfx('coin'); log(`🏪 Acheté : ${d.ico} ${d.nom}.`); } }))
];

// proposée au bar et au coin de rue : le même objet dans les deux lieux
// dette plafonnée, et un nouvel emprunt ne repousse jamais l'échéance déjà fixée
const depannage = { ico: '💸', nom: 'Demander un dépannage rapide', d: 1, info: '+30 € · 50 € à rendre', fn: () => {
  if ((s.dette || 0) + 50 > DETTE_MAX) return non(`Personne ne te prête plus : tu dois déjà ${s.dette} €. Rembourse d'abord.`);
  s.argent += 30; s.dette = (s.dette || 0) + 50; if (!s.echeance) s.echeance = s.jour + 2; sfx('coin');
  if (!connu('dede')) { P('dede').vu = true; log('🕶️ Un vieil homme en pull gris compte une liasse de billets. Il sourit : « Appelle-moi Dédé. »'); }
  log('💸 Dédé te dépanne de 30 €. Il faudra lui en rendre 50 — et il sait où te trouver.'); } };

// ---- Agressions : gros gains, mais la victime peut se souvenir de toi ----
// recherché·e = chaque déplacement, contrôle ou visite à la préfecture peut finir en arrestation, donc en expulsion
const VIEILLES = ['Madame Leroy, 81 ans', 'Madame Dupuis, 77 ans', 'Madame Moreau, 84 ans', 'Madame Garnier, 79 ans'];
const VIEUX = ['Monsieur Martin, 82 ans', 'Monsieur Petit, 76 ans', 'Monsieur Roux, 88 ans', 'Monsieur Faure, 80 ans'];
const CRIMES = [
  { ico: '👵', nom: 'Arracher le sac d’une grand-mère', d: 1, info: '20–45 € · −15 moral · 25 % d’être reconnu·e', fn: () => {
      const v = VIEILLES[rnd(0, VIEILLES.length - 1)];
      agression(v, rnd(20, 45), .25, 15,
        `Tu arraches le sac de ${v}. Elle ne lâche pas : tu la traînes sur le trottoir, sa tête heurte le rebord et elle reste au sol, le visage en sang.`); } },
  { ico: '👴', nom: 'Assommer un grand-père', d: 1, info: '30–70 € · −25 moral · 40 % d’être reconnu·e', fn: () => {
      const v = VIEUX[rnd(0, VIEUX.length - 1)];
      agression(v, rnd(30, 70), .4, 25,
        `Un coup de pierre derrière le crâne. ${v} s’effondre, le sang coule dans ses cheveux blancs. Tu lui prends son porte-monnaie pendant qu’il gémit.`); } },
  { ico: '🔪', nom: 'Couper le poignet pour la montre', d: 1, info: 'machette requise · 60–120 € · −35 moral · 60 % d’être reconnu·e', fn: () => {
      if (!has('machette')) return non('Il te faut une machette. Le bazar en vend.');
      const v = VIEUX[rnd(0, VIEUX.length - 1)];
      agression(v, rnd(60, 120), .6, 35,
        `Un coup de machette. ${v} hurle, sa main ne tient plus que par un lambeau de peau. Tu arraches la montre du poignet ouvert et tu t’enfuis, les mains couvertes de sang.`); } }
];

// ---- Bagarre 1 contre 1 : pierre-feuille-ciseaux à trois coups ----
// frapper bat sable (tu le touches pendant qu'il se baisse) · sable bat esquive (il ne voit pas venir) · esquive bat frapper (tu contres son coup direct)
const COUPS = [
  { id: 'frapper', ico: '👊', nom: 'Coup de poing', bat: 'sable' },
  { id: 'sable', ico: '🏖️', nom: 'Jeter du sable', bat: 'esquive' },
  { id: 'esquive', ico: '🦶', nom: 'Esquiver et riposter', bat: 'frapper' }
];

// ---- La carte de la ville ----
// o/f = heures d'ouverture/fermeture, lock = ce qui verrouille le lieu
// acts = les boutons proposés une fois sur place (d = durée de l'action, en heures)
// ⚠️ Les index de PLACES sont stockés dans les sauvegardes via s.pos : ajouter un lieu à la fin, jamais au milieu.
const PLACES = [
  { a: 'foyer', apres: a => a.nom.startsWith('Discuter') && voirKarim(), ico: '🏚️', nom: 'Foyer', x: 15.9, y: 9.7, img: true, o: 0, f: 24, acts: [
    { ico: '😴', nom: 'Dormir', d: 0, info: 'la nuit · 8 €', fn: () => dormir(false) },
    { ico: '🍜', nom: 'Repas du foyer', d: 1, info: '3 € · +8 santé', fn: () => {
        if (!cout(3)) return; s.sante += 8; s.moral += 2; sfx('good'); log('Un repas chaud au réfectoire du foyer.'); } },
    { ico: '🚿', nom: 'Douche et lessive', d: 1, info: 'gratuit · +moral', fn: () => {
        s.sante += 3; s.moral += 6; sfx('good'); log(`${name} se sent propre, et un peu plus humain·e.`); } },
    { ico: '💬', nom: 'Discuter avec les autres', d: 1, info: 'chance de réseau', fn: () => {
        s.moral += 4;
        if (Math.random() < .35) { s.reseau++; sfx('good'); log(`Un résident te donne de bons conseils. Réseau : ${s.reseau}.`); }
        else log('Vous parlez du pays, des dossiers, de la pluie.'); } }
  ]},

  { a: 'ecole', ico: '🏫', nom: 'École', x: 24.1, y: 24.0, img: true, o: 9, f: 18, acts: [
    { ico: '📖', nom: 'Cours de langue', d: 2, info: '5 €', fn: () => {
        if (!cout(5)) return; s.sante -= 5;
        if (!gagneLangue(.4)) log(`${name} a suivi un cours. Ça rentre doucement.`); } },
    { ico: '🗣️', nom: 'Atelier conversation', d: 2, info: 'gratuit · +moral', fn: () => {
        s.moral += 6;
        if (!gagneLangue(.2)) log('Deux heures à parler avec les autres élèves. On rit beaucoup.'); } },
    { ico: '🎓', nom: "Passer l'examen de langue", d: 3, info: '20 € · niveau 5 requis',
      hide: () => s.diplome, fn: () => {
        if (s.langue < 5) return non("Il faut au moins le niveau 5 pour s'inscrire.");
        if (!cout(20)) return;
        if (Math.random() < .3 + s.langue * .07) { s.diplome = true; s.moral += 20; sfx('win'); log('🎓 Examen réussi ! Ton diplôme aidera à la préfecture.'); }
        else { s.moral -= 10; sfx('bad'); log('Examen raté de peu. Tu pourras le repasser.'); } } }
  ]},

  { a: 'biblio', ico: '📚', nom: 'Bibliothèque', x: 13.4, y: 39.7, img: true, o: 10, f: 19, acts: [
    { ico: '📕', nom: 'Réviser la langue', d: 2, info: 'gratuit · lent', fn: () => {
        s.moral += 2;
        if (!gagneLangue(.2)) log('Deux heures à lire, au chaud et gratuitement.'); } },
    { ico: '💻', nom: 'Utiliser un ordinateur', d: 1, info: 'offres · recharge', fn: () => {
        s.moral += 2; s.tel = Math.min(100, s.tel + 20);
        if (Math.random() < .4) { s.reseau++; sfx('good'); log(`Tu réponds à une annonce et notes un contact. Réseau : ${s.reseau}.`); }
        else log('Rien d’intéressant aujourd’hui, mais tu as rechargé ton téléphone.'); } },
    { ico: '🗞️', nom: 'Lire le journal', d: 1, info: '+moral', fn: () => {
        s.moral += 4;
        if (!gagneLangue(.12)) log('Tu suis les nouvelles du pays, et celles d’ici.'); } }
  ]},

  { a: 'pref', ico: '🏛️', nom: 'Préfecture', x: 78.3, y: 11.0, img: true, o: 9, f: 16, acts: [
    { ico: '📄', nom: 'Déposer / suivre ton dossier', d: 3, info: '1 fois par jour', fn: () => {
        if (s.prefJour === s.jour) return non("La préfecture t'a déjà reçu·e aujourd'hui. Reviens demain.");
        if (s.recherche && Math.random() < .5) return arrete('Au guichet, l’agent tape ton nom… deux policiers arrivent dans ton dos.');
        s.prefJour = s.jour; s.sante -= 8;
        const bonus = s.bonus || 0, tenue = inv().find(o => o.id === 'tenue');
        const chance = .05 + s.langue * .025 + Math.min(s.reseau, RESEAU_MAX) * .02 - s.papiers * .04 + (s.diplome ? .1 : 0) + bonus + (tenue ? .05 : 0) + (P('helene').lettre ? .1 : 0);
        s.bonus = 0;
        if (tenue && --tenue.u <= 0) { inv().splice(inv().indexOf(tenue), 1); log('👔 Ta tenue propre est usée.'); }
        if (Math.random() < chance) { s.papiers++; s.moral += 15; sfx('good'); log(`Préfecture : avancée ! ${PAPIERS[s.papiers]}.`); }
        else {
          s.moral -= 8; sfx('bad'); log('Préfecture : 3 h d’attente… « Revenez avec un justificatif ».');
          if (has('pochette') && bonus) { s.bonus = bonus / 2; log('📁 Grâce à ta pochette, tu gardes la moitié de tes justificatifs.'); }
        } } },
    { ico: '❓', nom: 'Se renseigner au guichet', d: 1, info: '+10 % au dossier · 1×/jour', fn: () => {
        if (dejaFait('guichet')) return;
        s.moral -= 2; sfx('ring'); atout('guichet', .1, 'On t’explique enfin quelle pièce manque. Tu notes tout.'); } },
    { ico: '⚖️', nom: 'Consulter un avocat', d: 2, info: '40 € · +25 % · 1×/jour', fn: () => {
        if (dejaFait('avocat') || !cout(40)) return; s.moral += 5; sfx('good'); atout('avocat', .25, 'L’avocat relit ton dossier et corrige deux erreurs.'); } }
  ]},

  { a: 'appart', ico: '🏠', nom: 'Appartement', x: 85.2, y: 33.4, img: true, o: 0, f: 24,
    lock: () => !s.appart && s.argent < 150, lockTxt: '150 € pour louer', acts: [
    { ico: '🔑', nom: "Louer l'appartement", d: 1, info: '150 € · une seule fois',
      hide: () => s.appart, fn: () => {
        if (!cout(150)) return; s.appart = true; s.moral += 20; sfx('win');
        log('🏠 Tu as loué un appartement ! Tu y dormiras bien mieux (loyer 15 €/nuit).'); } },
    { ico: '😴', nom: 'Dormir chez toi', d: 0, info: 'la nuit · 15 €',
      hide: () => !s.appart, fn: () => dormir(true) },
    { ico: '🍲', nom: 'Cuisiner', d: 1, info: '5 € · +12 santé',
      hide: () => !s.appart, fn: () => {
        if (!cout(5)) return; s.sante += 12; s.moral += 5; sfx('good'); log('Un plat du pays, enfin fait maison.'); } },
    { ico: '👥', nom: 'Inviter des amis', d: 2, info: '10 € · réseau 2 requis',
      hide: () => !s.appart, fn: () => {
        if (s.reseau < 2) return non('Tu ne connais pas encore assez de monde.');
        if (!cout(10)) return; s.moral += 18; s.sante += 3; sfx('good'); log('Une vraie soirée, des rires : tu te sens moins seul·e.'); } }
  ]},

  { a: 'culte', ico: '🕌', nom: 'Lieu de culte', x: 49.3, y: 39.9, img: true, o: 6, f: 21, acts: [
    { ico: '🙏', nom: 'Prier', d: 1, info: '+10 moral', fn: () => {
        s.moral += 10; sfx('good'); log(`${name} trouve un peu de paix.`); } },
    { ico: '🤲', nom: 'Se confier', d: 2, info: '+18 moral', fn: () => {
        s.moral += 18; sfx('good'); log('Tu racontes ton voyage. On t’écoute sans te juger.'); } },
    { ico: '🍲', nom: 'Aider au repas solidaire', d: 3, info: '+réseau 1×/jour · +santé', fn: () => {
        s.moral += 8; s.sante += 6; sfx('good');
        if (premiereFois('repas')) { s.reseau++; log(`Tu sers les repas, puis tu manges avec les autres. Réseau : ${s.reseau}.`); }
        else log('Tu donnes encore un coup de main. Ce sont les mêmes visages qu’un peu plus tôt.'); } }
  ]},

  { a: 'hosto', ico: '🏥', nom: 'Hôpital', x: 77.4, y: 54.2, img: true, o: 0, f: 24, acts: [
    { ico: '💊', nom: 'Consulter un médecin', d: 2, info: '20 € · +30 santé', fn: () => {
        if (!cout(20)) return; s.sante += 30; sfx('good'); log(`Un médecin soigne ${name}.`); } },
    { ico: '🚑', nom: 'Attendre aux urgences', d: 5, info: 'gratuit · très long', fn: () => {
        s.sante += 22; s.moral -= 8; sfx('good'); log('Cinq heures sur une chaise, mais tu es soigné·e gratuitement.'); } },
    { ico: '🩺', nom: 'Faire un bilan de santé', d: 2, info: '10 € · +5 % · 1×/jour', fn: () => {
        if (dejaFait('bilan') || !cout(10)) return; s.sante += 10; sfx('good'); atout('bilan', .05, 'Le certificat médical rejoint ton dossier.'); } }
  ]},

  { a: 'usine', ico: '🏭', nom: 'Usine', x: 13.5, y: 77.4, img: true, o: 7, f: 20,
    lock: () => s.papiers < 2, lockTxt: 'Récépissé requis', acts: [
    { ico: '🔧', nom: 'Journée complète', d: 6, info: '45–65 €', fn: () => {
        if (s.sante < 25) return non(`${name} est trop épuisé·e pour une journée entière.`);
        const g = rnd(45, 65); s.argent += g; s.sante -= 20; s.moral += 6; sfx('coin');
        log(`Journée à l’usine, un vrai contrat ! (+${g} €)`); } },
    { ico: '⏰', nom: 'Demi-journée', d: 3, info: '20–30 €', fn: () => {
        if (s.sante < 12) return non('Trop épuisé·e, même pour trois heures.');
        const g = rnd(20, 30); s.argent += g; s.sante -= 9; sfx('coin'); log(`Une demi-journée à l’usine (+${g} €).`); } },
    { ico: '🧾', nom: 'Demander une fiche de paie', d: 1, info: '+12 % au dossier · 1×/jour', fn: () => {
        if (dejaFait('fiche')) return;
        sfx('good'); atout('fiche', .12, 'Le patron te remet une fiche de paie : un vrai justificatif.'); } }
  ]},

  { a: 'job', ico: '🛒', nom: 'Marché', x: 28.5, y: 51.3, img: true, o: 6, f: 14, acts: [
    { ico: '📦', nom: 'Petit boulot', d: 4, info: 'payé à la journée', fn: () => {
        if (s.sante < 15) return non(`${name} est trop épuisé·e pour travailler.`);
        const g = rnd(10, 20) + s.langue * 3; s.argent += g; s.sante -= 12; s.moral += 3; sfx('coin');
        log(`${name} décharge des cageots toute la matinée (+${g} €).`); } },
    { ico: '🥖', nom: 'Acheter à manger', d: 1, info: '8 € · +12 santé', fn: () => {
        if (!cout(8)) return; s.sante += 12; s.moral += 3; sfx('good'); log('Du pain, des fruits : de quoi tenir.'); } },
    { ico: '🧺', nom: 'Vendre quelques objets', d: 2, info: 'risqué', fn: () => {
        if (Math.random() < .25) { s.moral -= 12; sfx('bad'); log('La police municipale te fait ranger ton étal. Rien gagné.'); }
        else { const g = rnd(8, 25); s.argent += g; sfx('coin'); log(`Tu vends sur un coin de trottoir (+${g} €).`); } } }
  ]},

  { a: 'assoc', apres: () => voirHelene(), ico: '🤝', nom: 'Association', x: 27.9, y: 66.8, img: true, o: 10, f: 19, acts: [
    { ico: '☕', nom: 'Rencontrer les bénévoles', d: 2, info: '+réseau 1×/jour', fn: () => {
        s.moral += 6; s.sante += 5; sfx('good');
        if (premiereFois('benevoles')) { s.reseau++; log(`${name} discute autour d’un café. Réseau : ${s.reseau}.`); }
        else log('Un autre café avec les bénévoles. Tu les connais déjà.'); } },
    { ico: '🗂️', nom: 'Aide pour ton dossier', d: 2, info: '+15 % au dossier · 1×/jour', fn: () => {
        if (dejaFait('assoc')) return;
        s.moral += 4; sfx('good'); atout('assoc', .15, 'Une bénévole relit ton dossier ligne par ligne.'); } },
    { ico: '👕', nom: 'Vestiaire solidaire', d: 1, info: 'gratuit', fn: () => {
        s.sante += 6; s.moral += 6; sfx('good'); log('Un manteau chaud et des chaussures à ta taille.'); } }
  ]},

  { a: 'call', ico: '📞', nom: 'Parc (wifi)', x: 82.7, y: 76.5, img: true, o: 0, f: 24, acts: [
    { ico: '📞', nom: 'Appeler la famille', d: 1, info: 'batterie · +12 moral', fn: () => {
        if (s.tel < 10) return non('Plus assez de batterie. Dors pour recharger.');
        s.tel -= 15; s.moral += 12; sfx('ring'); log(`Message de la famille : « Comment tu vas, ${name} ? »`); } },
    { ico: '🌳', nom: 'Se reposer sur un banc', d: 2, info: '+8 santé', fn: () => {
        s.sante += 8; s.moral += 3; log('Deux heures au soleil, les yeux fermés.'); } },
    { ico: '⚽', nom: 'Jouer au foot', d: 2, info: 'moral · un peu de fatigue', fn: () => {
        s.sante -= 4; s.moral += 12;
        if (Math.random() < .4) { s.reseau++; sfx('good'); log(`Un match improvisé, on t’ajoute au groupe. Réseau : ${s.reseau}.`); }
        else log('Un bon match. Tu oublies tout pendant deux heures.'); } }
  ]},

  { a: 'rue', ico: '🚬', nom: 'Coin de rue', x: 61.0, y: 20.9, img: true, o: 0, f: 24, acts: [
    { ico: '🚬', nom: "Vendre des cigarettes à l'unité", d: 2, info: 'sans rien · rapporte peu', fn: () => {
        if (police(.1)) return;
        let g;
        if (s.clopes > 0) { s.clopes--; g = rnd(11, 17); log(`Tu écoules ton paquet à l'unité (+${g} €).`); }
        else { g = rnd(3, 8); log(`Quelques cigarettes vendues une par une (+${g} €). C'est peu, mais c'est sans rien.`); }
        s.argent += g; s.moral -= 2; s.chaud = (s.chaud || 0) + 1; histo().clopes++; sfx('coin'); } },
    { ico: '📦', nom: 'Acheter un paquet au noir', d: 1, info: '6 € · à revendre', fn: () => {
        if (!placeLibre()) return sacPlein();
        if (!cout(6)) return; s.clopes = (s.clopes || 0) + 1; sfx('coin');
        log('Un paquet acheté sous le manteau : il rapportera plus à l’unité.'); } },
    { ico: '🕶️', nom: 'Faire le guet', d: 3, info: '15–25 € · très risqué', fn: () => {
        if (police(.22)) return;
        const g = rnd(15, 25); s.argent += g; s.moral -= 6; s.chaud = (s.chaud || 0) + 2; sfx('coin');
        log(`Tu surveilles la rue pour d’autres (+${g} €). Tu n’es pas fier·e.`); } },
    { ico: '🥊', nom: 'Chercher la bagarre', d: 1, info: 'prototype · risqué', fn: () => bagarre('Un provocateur') },
    ...CRIMES,
    depannage
  ]},

  { a: 'squat', ico: '🏚️', nom: 'Squat', x: 47.8, y: 73.7, img: true, o: 0, f: 24, acts: [
    { ico: '😴', nom: 'Squatter pour la nuit', d: 0, info: 'gratuit · au hasard', fn: () => nuit(() => {
        s.tel = 100;
        if (has('manteau')) s.sante += 3;
        dechire();
        const d = Math.random();
        if (d < .5) { s.sante += 15; log('Un matelas dans un coin, personne ne t’embête. Tu récupères.'); }
        else if (d < .8) { const perte = has('cadenas') ? 0 : Math.min(s.argent, 10); s.sante -= 15; s.moral -= 10; s.argent -= perte; log(`Bagarre au milieu de la nuit : tu y laisses des forces${perte ? ` et ${perte} €` : has('cadenas') ? ', mais ton argent est resté sous cadenas' : ''}.`); volObjet(.3); }
        else { log('Descente de police dans le squat au petit matin.'); police(2); } }) },
    { ico: '🔦', nom: 'Chercher des objets', d: 2, info: 'récup · à revendre', fn: () => {
        const d = Math.random();
        if (d < .4) { const g = rnd(5, 15); s.argent += g; sfx('coin'); log(`Du métal et un vieux téléphone : revendus (+${g} €).`); }
        else if (d < .5) { s.sante -= 8; sfx('bad'); log('Tu te coupes en fouillant les gravats.'); }
        else if (d < .55 && !has('photo')) {
          if (!placeLibre()) log('Tu trouves une vieille photo de famille, mais ton sac est plein.');
          else { ajoute('photo'); sfx('good'); log('📷 Dans les gravats, une photo de famille abandonnée. Tu la gardes précieusement.'); } }
        else log('Deux heures à fouiller pour rien.'); } }
  ]},

  { a: 'pont', ico: '🛞', nom: 'Sous le pont', x: 40.5, y: 20.9, img: true, o: 0, f: 24, acts: [
    { ico: '😴', nom: 'Dormir dehors', d: 0, info: 'gratuit · très dur', fn: () => nuit(() => {
        s.sante -= has('couchage') ? 4 : 10; s.moral -= 8;
        if (has('manteau')) s.sante += 3;
        dechire();
        log(has('couchage') ? 'Une nuit dehors, roulé·e dans ton sac de couchage. Le téléphone reste éteint.' : 'Une nuit dehors, dans le bruit et le froid. Le téléphone reste éteint.'); }) },
    { ico: '🥫', nom: 'Taper la manche', d: 2, info: '2 à 8 € · −4 moral', fn: () => {
        const g = rnd(2, 8); s.argent += g; s.moral -= 4; sfx('coin');
        log(`Deux heures la main tendue (+${g} €). Les regards pèsent.`); } }
  ]},

  { a: 'bar', ico: '🍺', nom: 'Bar du quartier', x: 68.3, y: 67.6, img: true, o: 16, f: 24, txt: '16 h – 23 h', acts: [
    { ico: '🍺', nom: 'Boire un coup', d: 1, info: '4 € · +12 moral', fn: () => {
        if (!cout(4)) return; s.moral += 12; s.sante -= 5; sfx('good'); log('Un verre au comptoir, la télé en fond. Ça fait du bien.'); } },
    { ico: '🥂', nom: 'Payer un verre pour discuter', d: 2, info: '8 € · réseau', fn: () => {
        if (!cout(8)) return;
        const d = Math.random();
        if (d < .35) { s.reseau += 2; sfx('good'); log(`La tournée délie les langues : deux contacts de plus. Réseau : ${s.reseau}.`); }
        else if (d < .6) { s.moral -= 10; sfx('bad'); log('La discussion tourne mal. Tu préfères partir.'); }
        else log('Tu paies ta tournée. On te remercie, et puis plus rien.'); } },
    depannage
  ]},

  { a: 'bazar', ico: '🏪', nom: 'Bazar', x: 71.7, y: 37.0, img: true, o: 9, f: 19, acts: BAZAR_ACTS }
];
