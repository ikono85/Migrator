// ==========================================================================
// game.js — le MOTEUR du jeu : état, mécaniques, rendu, sauvegarde.
// Chargé APRÈS data.js (dont il utilise PLACES dès la première exécution
// pour construire les boutons de la carte).
// ==========================================================================

const COLORS = ['#111111', '#facc15', '#7b4a2a'];
let color = COLORS[0];
const AVATAR = {
  '#111111': 'perso/14.png',
  '#facc15': 'perso/rond jaune.webp',
  '#7b4a2a': 'perso/8e1c08e031d3b42e218d8b6df5069e.webp'
};
const avatarBg = c => `${c} url('${AVATAR[c]}') center / cover`;
const s = { sante: 70, moral: 50, argent: 50, langue: 1, papiers: 0, reseau: 0, tel: 40, jour: 1, heure: 8, pos: 0, bonus: 0, appart: false, diplome: false, clopes: 0, chaud: 0, dette: 0, echeance: 0, sac: 0, inv: [], recherche: 0, cauchemars: 0, crimes: 0 };
let name = 'Sam';

const cBox = document.getElementById('colors');
COLORS.forEach((c, i) => {
  const d = document.createElement('div');
  d.className = 'color' + (i === 0 ? ' sel' : '');
  d.style.background = avatarBg(c);
  d.onclick = () => { color = c; document.querySelectorAll('.color').forEach(e => e.classList.remove('sel')); d.classList.add('sel'); setBg(); };
  cBox.appendChild(d);
});

const BG = {
  '#111111': 'fonds/geo12ouvkibera-retoucheok.webp',
  '#facc15': 'fonds/riziere-bali-indonesie.avif',
  '#7b4a2a': 'fonds/683466.ori.jpg'
};
// Fond pendant la partie (après « Commencer ») ; sinon on garde celui de l'accueil
const GAME_BG = {
  '#111111': 'fonds/rue-noir.jpg',
  '#facc15': 'fonds/rue-jaune.webp',
  '#7b4a2a': 'fonds/souk-marron.jpg'
};
const MUSIC = {
  '#111111': 'musique/noir.mp3',
  '#facc15': 'musique/jaune.mp3',
  '#7b4a2a': 'musique/marron.mp3'
};
const music = new Audio();
music.loop = true;
music.volume = 0.4;
function toggleMusic() {
  music.muted = !music.muted;
  document.getElementById('mute').textContent = music.muted ? '🔇' : '🔊';
}

function toggleLog() {
  document.querySelector('.layout .side').classList.toggle('folded');
}

// ---- Statistiques du personnage, consultables en jeu (bouton 📊) ----
function showStats() {
  const h = histo();
  const lignes = [
    ['💶', 'Argent gagné', h.gagne + ' €'],
    ['💸', 'Argent dépensé', h.depense + ' €'],
    ['✅', 'Actions réalisées', h.actions],
    ['👮', 'Contrôles de police subis', h.controles],
    ['🚬', 'Ventes de cigarettes', h.clopes],
    ['🩸', 'Agressions commises', s.crimes || 0],
    ['🤝', 'Contacts (réseau)', s.reseau],
    ['🗣️', 'Niveau de langue', s.langue],
    ['📄', 'Statut administratif', PAPIERS[s.papiers]],
    ['📅', 'Jours survécus', s.jour]
  ];
  document.getElementById('choiceIco').innerHTML = '📊';
  document.getElementById('choiceIco').style.setProperty('--med', '#3b4a63');
  document.getElementById('choiceTitre').textContent = 'Tes statistiques';
  document.getElementById('choiceTxt').innerHTML = lignes.map(([ico, l, v]) =>
    `<span style="display:flex;justify-content:space-between;gap:10px;padding:4px 2px;border-bottom:1px solid var(--line)"><span>${ico} ${l}</span><b>${v}</b></span>`
  ).join('');
  const box = document.getElementById('choiceBtns');
  box.innerHTML = '';
  const b = document.createElement('button');
  b.textContent = 'Fermer';
  b.onclick = () => { document.getElementById('choice').style.display = 'none'; };
  box.appendChild(b);
  document.getElementById('choice').style.display = 'flex';
}

// couleur d'accent de l'interface selon la couleur choisie : [accent, texte sur accent]
const ACCENT = {
  '#111111': ['#8fa3bf', '#10141c'],
  '#facc15': ['#f5c518', '#1c1600'],
  '#7b4a2a': ['#d08a4c', '#1f1208']
};
function setBg(inGame) {
  const [acc, ink] = ACCENT[color];
  document.documentElement.style.setProperty('--accent', acc);
  document.documentElement.style.setProperty('--accent-ink', ink);
  const img = (inGame && GAME_BG[color]) || BG[color];
  document.body.style.background = img ? `#1e2430 url('${img}') center / cover fixed` : '';
}

setBg();

function start() {
  const n = document.getElementById('name').value.trim();
  if (!/^[\p{L} \-']{2,16}$/u.test(n)) { document.getElementById('err').textContent = 'Prénom : 2 à 16 lettres.'; return; }
  name = n;
  launch();
  log(`Bienvenue ${name}. Premier jour en ville, il est 8 h.`);
  endTurn();
}

function launch() {
  document.getElementById('start').style.display = 'none';
  document.getElementById('game').style.display = 'block';
  document.getElementById('avatar').style.background = avatarBg(color);
  player.style.background = avatarBg(color);
  setBg(true);
  music.src = MUSIC[color];
  music.play().catch(() => {});
}

const clamp = v => Math.max(0, Math.min(100, v));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
let over = false;

// ---- Sons d'action (générés, pas de fichier) ----
let actx;
function sfx(type) {
  if (music.muted) return;
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  const notes = {
    coin:  [[988, .08], [1319, .15]],
    good:  [[523, .1], [659, .1], [784, .2]],
    bad:   [[220, .15], [165, .3]],
    ring:  [[880, .1], [0, .05], [880, .1]],
    sleep: [[392, .25], [330, .35]],
    event: [[660, .1], [990, .15]],
    win:   [[523, .15], [659, .15], [784, .15], [1047, .4]],
    lose:  [[196, .3], [147, .3], [98, .6]]
  }[type];
  let t = actx.currentTime;
  for (const [f, d] of notes) {
    if (f) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type === 'coin' ? 'square' : 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(.15, t);
      g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + d);
    }
    t += d;
  }
}

function randomEvent() {
  if (Math.random() > 0.5) return;
  const perso = EVENTS.filter(e => e.cond && e.cond()), autres = EVENTS.filter(e => !e.cond);
  const liste = perso.length && Math.random() < .6 ? perso : autres;
  const e = liste[rnd(0, liste.length - 1)];
  if (e.choice) return askChoice(e);
  const t = e.txt(); // le texte décrit la situation avant les effets
  e.fx(); sfx(e.snd); log('⚡ ' + t); toast(e, t);
}

// petite notification en haut de l'écran, qui disparaît seule
let toastTimer;
function toast(e, texte) {
  const t = document.getElementById('toast');
  t.style.setProperty('--tc', e.col || 'var(--accent)');
  document.getElementById('toastIco').innerHTML = e.img ? icone(e, 'medimg') : (e.ico || '⚡');
  document.getElementById('toastTxt').textContent = texte || e.txt();
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4500);
}

function askChoice(e) {
  s.choix = EVENTS.indexOf(e); // gardé dans la sauvegarde : recharger ne fait pas disparaître le choix
  sfx('event');
  document.getElementById('choiceIco').innerHTML = e.img ? icone(e, 'medimg') : (e.ico || '⚡');
  document.getElementById('choiceIco').style.setProperty('--med', e.col || 'var(--accent)');
  document.getElementById('choiceTitre').textContent = 'Événement';
  document.getElementById('choiceTxt').textContent = e.txt();
  const box = document.getElementById('choiceBtns');
  box.innerHTML = '';
  for (const [label, fn] of e.opts) {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => {
      document.getElementById('choice').style.display = 'none';
      delete s.choix;
      log('⚡ ' + fn());
      endTurn();
    };
    box.appendChild(b);
  }
  document.getElementById('choice').style.display = 'flex';
}

// ---- Écrans de fin ----
function endScreen(title, col, msg, snd) {
  over = true;
  const h = document.getElementById('endTitle');
  h.textContent = title; h.style.color = col; h.style.textShadow = `0 0 30px ${col}`;
  document.getElementById('deadMsg').textContent = msg;
  const h2 = s.hist || {};
  const tuiles = [[s.jour, s.jour > 1 ? 'jours' : 'jour'], [(h2.gagne || 0) + ' €', 'gagnés'], [h2.actions || 0, 'actions'],
                  [PAPIERS[s.papiers], 'papiers'], [s.reseau, 'contacts'], [h2.controles || 0, 'contrôles de police']];
  document.getElementById('recap').innerHTML = tuiles.map(([v, l]) => `<div class="tile"><b${String(v).length > 7 ? ' class="long"' : ''}>${v}</b><span>${l}</span></div>`).join('');
  document.getElementById('dead').style.display = 'flex';
  music.pause(); sfx(snd);
}

const FIN_JOURNEE = 23;

// petites aides pour écrire les actions
let refus = false;
const non = t => { refus = true; log(t); };
const cout = n => { if (s.argent < n) { non(`Il te faut ${n} € pour ça.`); return false; } s.argent -= n; histo().depense += n; return true; };
const gagneLangue = p => {
  if (Math.random() < p + (has('dico') ? .1 : 0) && s.langue < 10) { s.langue++; sfx('good'); log(`🗣️ ${name} progresse en langue ! Niveau ${s.langue}.`); return true; }
  return false;
};
// contrôle de police : renvoie vrai si tu t'es fait prendre (tu perds l'action)
const police = base => {
  if (Math.random() > base + (s.chaud || 0) * .04) return false;
  if (s.recherche) { arrete('Contrôle de police : ton visage correspond au signalement. Menottes.'); return true; }
  if (connu('morel') && P('morel').rel >= 2 && Math.random() < .5) {
    P('morel').rel--; s.chaud = 0;
    log('👮 C’est le brigadier Morel. Il soupire : « Pas aujourd’hui. Rentre chez toi. » (il ne le fera pas éternellement)');
    return false;
  }
  histo().controles++;
  const amende = Math.min(s.argent, (rnd(10, 20) + (s.sac >= 2 ? (s.clopes || 0) * 3 : 0)) * (has('machette') ? 2 : 1));
  s.argent -= amende; s.moral -= 12; s.clopes = 0; s.chaud = 0; sfx('bad');
  log(`👮 Contrôle de police ! Marchandise saisie${amende ? `, ${amende} € d'amende` : ''}.`);
  if (s.papiers >= 1 && Math.random() < .3) { s.papiers--; log(`Ton dossier recule : ${PAPIERS[s.papiers]}.`); }
  return true;
};
const DETTE_MAX = 100;
// bonus au prochain dossier : plafonné, et chaque démarche ne compte qu'une fois par jour
const BONUS_MAX = .3;
const dejaFait = k => { if ((s.faits || {})[k] === s.jour) { non('Tu as déjà fait cette démarche aujourd’hui. Reviens demain.'); return true; } return false; };
// le réseau compte à la préfecture jusqu'à RESEAU_MAX contacts ; les rencontres garanties ne font un contact qu'une fois par jour
const RESEAU_MAX = 10;
const premiereFois = k => { s.faits = s.faits || {}; if (s.faits[k] === s.jour) return false; s.faits[k] = s.jour; return true; };
const atout = (k, n, t) => {
  s.faits = s.faits || {}; s.faits[k] = s.jour;
  const avant = s.bonus || 0;
  s.bonus = Math.min(BONUS_MAX, avant + n);
  log('📌 ' + t);
  if (avant + n > BONUS_MAX) log(`Ton dossier est déjà bien préparé : bonus plafonné à +${BONUS_MAX * 100} %.`);
};

// ---- Sacs et objets : aides d'inventaire ----
// ton image si elle existe (champ img), sinon l'emoji ; si le fichier manque, l'emoji revient tout seul
const icone = (o, cls = 'ic') => o.img
  ? `<img class="${cls}" src="${o.img}" alt="${o.ico}" onerror="this.replaceWith(this.alt)">` : o.ico;
const inv = () => (s.inv = s.inv || []);
const has = id => inv().some(o => o.id === id);
const placesPrises = () => inv().length + (s.clopes || 0);
const placeLibre = () => placesPrises() < SACS[s.sac || 0].cap;
const sacPlein = () => non(`Ton sac est plein (${placesPrises()}/${SACS[s.sac || 0].cap}). Il te faut un plus grand sac.`);
function ajoute(id) {
  const d = ITEMS[id];
  inv().push(d.u ? { id, u: d.u() } : { id });
}
// vol d'un objet au hasard (squat, vol dans la nuit) — le sac de randonnée ne quitte pas ton dos
function volObjet(p) {
  if (s.sac === 3 || !inv().length || Math.random() > p) return;
  const [o] = inv().splice(rnd(0, inv().length - 1), 1), d = ITEMS[o.id];
  log(`🎒 On t'a volé : ${d.ico} ${d.nom}.`);
  if (o.id === 'photo') { s.moral -= 20; log('La photo de ta famille… c’est ce qui fait le plus mal.'); }
}
// le sac en plastique peut se déchirer quand on dort dehors ou au squat
function dechire() {
  if (s.sac !== 1 || !inv().length || Math.random() > .1) return;
  const [o] = inv().splice(rnd(0, inv().length - 1), 1), d = ITEMS[o.id];
  log(`🛍️ Ton sac en plastique s'est déchiré : tu as perdu ${d.ico} ${d.nom}.`);
  if (o.id === 'photo') s.moral -= 20;
}
const auBazar = () => { const p = PLACES[s.pos]; return p.a === 'bazar' && s.heure >= p.o && s.heure < p.f; };

// clic sur un objet de l'inventaire : l'utiliser, le revendre (au bazar) ou le jeter
function itemMenu(k) {
  if (over || moving) return;
  const o = inv()[k], d = ITEMS[o.id];
  const reste = o.id === 'transport' ? ` Valable jusqu'au jour ${o.u}.` : o.u ? ` Encore ${o.u} utilisation${o.u > 1 ? 's' : ''}.` : '';
  const opts = [];
  if (d.use) opts.push([d.use, () => d.fn(k)]);
  if (auBazar() && d.prix) {
    const px = Math.floor(d.prix / 2);
    opts.push([`💶 Revendre (${px} €)`, () => { inv().splice(k, 1); s.argent += px; sfx('coin'); log(`Tu revends ${d.nom} au bazar (+${px} €).`); }]);
  }
  opts.push(['🗑️ Jeter', () => { inv().splice(k, 1); log(`Tu te débarrasses de : ${d.nom}.`); }]);
  opts.push(['Fermer', () => {}]);
  document.getElementById('choiceIco').innerHTML = icone(d, 'medimg obj');
  document.getElementById('choiceIco').style.setProperty('--med', '#3b4a63');
  document.getElementById('choiceTitre').textContent = d.nom;
  document.getElementById('choiceTxt').textContent = d.desc + reste;
  const box = document.getElementById('choiceBtns');
  box.innerHTML = '';
  for (const [label, fn] of opts) {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => { document.getElementById('choice').style.display = 'none'; refus = false; fn(); refus = false; endTurn(); };
    box.appendChild(b);
  }
  document.getElementById('choice').style.display = 'flex';
}

// ---- Agressions : mécanique commune (le contenu est dans CRIMES, data.js) ----
const arrete = t => { s.arrete = t; log('🚨 ' + t); };
function agression(victime, gain, souvenir, perteMoral, texte) {
  s.crimes = (s.crimes || 0) + 1;
  lien('morel', -2);
  s.argent += gain; s.moral -= perteMoral; s.chaud = (s.chaud || 0) + 2;
  s.cauchemars = (s.cauchemars || 0) + 3;
  sfx('bad'); log(`🩸 ${texte} (+${gain} €)`);
  if (Math.random() < souvenir) {
    s.recherche = (s.recherche || 0) + 4;
    log(`🚨 ${victime} a vu ton visage. Ton signalement circule : recherché·e pendant ${s.recherche} jours.`);
  } else log('Personne ne semble t’avoir reconnu·e… pour cette fois.');
}

// ---- Bagarre 1 contre 1 : moteur (le contenu, COUPS, est dans data.js) ----
// démarre une bagarre ; fin(victoire) est appelé à la fin avec true/false pour brancher des conséquences propres à l'adversaire
function bagarre(nom, pv, fin) {
  s.combat = { nom, pvA: pv || 20, pvAmax: pv || 20, pvJ: 20, pvJmax: 20, log: `Une bagarre éclate avec ${nom}.`, fin: fin || null };
  sfx('event');
  renderCombat();
  document.getElementById('choice').style.display = 'flex';
}
function barreVie(label, pv, max, col) {
  return `<span style="display:block;margin:4px 0 10px;text-align:left"><b>${label}</b> ${Math.max(0, pv)}/${max}` +
         `<br><span style="display:block;height:7px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:2px">` +
         `<span style="display:block;height:100%;width:${Math.max(0, pv) / max * 100}%;background:${col}"></span></span></span>`;
}
const coupPar = id => COUPS.find(c => c.id === id);
function renderCombat() {
  const c = s.combat;
  document.getElementById('choiceIco').innerHTML = '🥊';
  document.getElementById('choiceIco').style.setProperty('--med', '#c0392b');
  document.getElementById('choiceTitre').textContent = 'Bagarre';
  document.getElementById('choiceTxt').innerHTML =
    barreVie('Toi', c.pvJ, c.pvJmax, 'var(--good)') + barreVie(c.nom, c.pvA, c.pvAmax, 'var(--bad)') +
    `<span style="display:block;margin-top:6px;font-size:15px">${c.log}</span>`;
  const box = document.getElementById('choiceBtns');
  box.innerHTML = '';
  if (c.pvJ <= 0 || c.pvA <= 0) {
    const b = document.createElement('button');
    b.textContent = 'Continuer';
    b.onclick = () => finBagarre();
    box.appendChild(b);
    return;
  }
  for (const coup of COUPS) {
    const b = document.createElement('button');
    b.textContent = `${coup.ico} ${coup.nom}`;
    b.onclick = () => jouerCoup(coup.id);
    box.appendChild(b);
  }
}
function jouerCoup(id) {
  const c = s.combat, adv = COUPS[rnd(0, COUPS.length - 1)].id, mien = coupPar(id), sien = coupPar(adv);
  if (id === adv) { c.log = `Vous jouez tous les deux « ${mien.nom.toLowerCase()} » : personne ne prend l'avantage.`; }
  else if (mien.bat === adv) {
    const deg = rnd(3, 6); c.pvA -= deg; sfx('good');
    c.log = `${mien.ico} Ton « ${mien.nom.toLowerCase()} » passe : ${c.nom} perd ${deg} points.`;
  } else {
    const deg = rnd(3, 6); c.pvJ -= deg; sfx('bad');
    c.log = `${sien.ico} ${c.nom} place un « ${sien.nom.toLowerCase()} » : tu perds ${deg} points.`;
  }
  renderCombat();
}
function finBagarre() {
  const c = s.combat;
  document.getElementById('choice').style.display = 'none';
  const victoire = c.pvA <= 0 && c.pvJ > 0;
  if (c.pvJ <= 0 && c.pvA > 0) { s.sante -= 15; s.moral -= 10; sfx('bad'); log(`🥊 ${c.nom} t'a mis au tapis. Tu rentres amoché·e.`); }
  else if (victoire) { s.sante -= 4; s.moral += 8; sfx('win'); log(`🥊 Tu as pris le dessus sur ${c.nom}.`); }
  else log(`🥊 La bagarre avec ${c.nom} tourne court.`);
  const suite = c.fin; s.combat = null;
  if (suite) suite(victoire);
  if (combatPending) {
    const { p, a } = combatPending; combatPending = null;
    if (!refus && p.apres) p.apres(a);
    if (!refus) histo().actions++;
    if (!refus && a.d) s.heure += a.d;
  }
  refus = false;
  endTurn();
}

let moving = false;
const map = document.getElementById('map');
const player = document.getElementById('player');
const panel = document.getElementById('actions');
const placeBtns = PLACES.map((p, i) => {
  const b = document.createElement('button');
  b.className = 'place';
  b.style.left = p.x + '%'; b.style.top = p.y + '%';
  b.onclick = () => goTo(i);
  map.appendChild(b);
  return b;
});
function placePlayer(i) { player.style.left = PLACES[i].x + '%'; player.style.top = PLACES[i].y + '%'; }
// les lieux où l'on peut toujours aller, même la nuit, pour dormir : foyer, squat, pont et son appartement
const ABRIS = ['foyer', 'squat', 'pont'];
const litOu = i => ABRIS.includes(PLACES[i].a) || (PLACES[i].a === 'appart' && s.appart);

// ---- Se déplacer : 1 h de marche, puis on choisit une action sur place ----
function goTo(i) {
  if (over || moving) return;
  const p = PLACES[i];
  if (p.lock && p.lock()) return log(`🔒 ${p.nom} : ${p.lockTxt}.`);
  if (i === s.pos) return log('Tu y es déjà : choisis une action sous la carte.');
  const gratuit = has('transport') && s.demi, arrivee = s.heure + (gratuit ? 0 : 1);
  if (!litOu(i)) {
    if (arrivee > FIN_JOURNEE) return log('Il est trop tard pour traverser la ville. Rentre dormir.');
    if (arrivee < p.o || arrivee >= p.f) return log(`${p.nom} : fermé à ${arrivee} h (ouvert de ${p.o} h à ${p.f} h).`);
  }
  moving = true;
  s.pos = i;
  s.heure = Math.min(arrivee, FIN_JOURNEE);
  if (has('transport')) s.demi = !gratuit;
  placePlayer(i);
  if (s.recherche && Math.random() < .05) arrete(`Une patrouille te reconnaît en chemin vers « ${p.nom} ».`);
  log(gratuit ? `🎫 ${name} prend le bus jusqu'à « ${p.nom} » (trajet compris dans l'heure précédente).` : `🚶 ${name} ${has('transport') ? 'prend le bus' : 'marche'} jusqu'à « ${p.nom} » (1 h).`);
  setTimeout(() => { moving = false; endTurn(); }, 500);
}

// ---- Faire une des actions du lieu où l'on se trouve ----
// une bagarre (voir bagarre() / finBagarre()) ouvre une modale et ne se termine que plus tard :
// on garde ici ce qu'il reste à faire (p.apres, durée, endTurn) pour le jouer une fois le combat fini.
let combatPending = null;
function doAct(i) {
  if (over || moving) return;
  const p = PLACES[s.pos], a = p.acts[i];
  if (!a || (a.hide && a.hide())) return;
  const fin = s.heure + a.d;
  if (a.d > 0) {
    if (fin > FIN_JOURNEE) return log(`Pas le temps : « ${a.nom} » prend ${a.d} h et il est déjà ${s.heure} h.`);
    if (p.f - p.o < 24 && fin > p.f) return log(`${p.nom} ferme à ${p.f} h : pas le temps pour « ${a.nom} ».`);
  }
  refus = false;
  a.fn();
  if (s.combat) { combatPending = { p, a }; return; }
  if (!refus && p.apres) p.apres(a);
  if (!refus) histo().actions++;
  if (!refus && a.d) s.heure += a.d;
  refus = false;
  endTurn();
}

// ---- Les boutons d'action du lieu, affichés sous la carte ----
// découpe « info » en pastilles : vert si ça rapporte, rouge si ça coûte ou si c'est risqué
function pills(a) {
  const t = `<span class="pill t">${a.d ? a.d + ' h' : a.achat ? 'achat' : 'nuit'}</span>`;
  return t + a.info.split(' · ').filter(x => x !== 'la nuit').map(x => {
    const cls = /^−|^\d+ €|risqu|très dur/.test(x) ? 'b' : /^\+|gratuit|moral|santé|réseau|recharge/.test(x) ? 'g' : '';
    return `<span class="pill ${cls}">${x}</span>`;
  }).join('');
}
function renderPanel() {
  const p = PLACES[s.pos];
  const nom = p.a === 'appart' && s.appart ? 'chez toi' : p.nom;
  const reste = has('montre') && p.f - p.o < 24 ? ` <b>(ferme dans ${p.f - s.heure} h)</b>` : '';
  let html = `<div class="here">📍 Tu es à « ${nom} »${reste} — que fais-tu ?</div><div class="acts">`;
  p.acts.forEach((a, i) => {
    if (a.hide && a.hide()) return;
    const fin = s.heure + a.d;
    const tard = a.d > 0 && (fin > FIN_JOURNEE || (p.f - p.o < 24 && fin > p.f));
    html += `<button class="act" onclick="doAct(${i})"${tard ? ' disabled' : ''}>` +
            `<span class="ico">${icone(a, 'ic big')}</span><b>${a.nom}</b><span class="pills">${pills(a)}</span></button>`;
  });
  panel.innerHTML = html + '</div>';
}

// ---- La nuit ----
function nuit(fx) {
  s.jour++; s.heure = 8; s.demi = false;
  fx();
  if (s.recherche > 0 && --s.recherche === 0) log('🚨 On dirait qu’on ne te cherche plus.');
  if (s.cauchemars > 0) { s.cauchemars--; s.moral -= 5; log('😰 Cauchemars : tu revois le sang, tu entends les cris.'); }
  if (has('photo')) s.moral += 2;
  const carte = inv().find(o => o.id === 'transport');
  if (carte && s.jour > carte.u) { inv().splice(inv().indexOf(carte), 1); log('🎫 Ta carte de transport a expiré.'); }
  sfx('sleep');
  if (s.argent < 0) { s.argent = 0; s.sante -= 10; s.moral -= 10; log('Pas assez pour manger… nuit difficile.'); }
  if (s.chaud > 0) s.chaud--;
  log(`— Jour ${s.jour} —`);
  s.sante = clamp(s.sante); s.moral = clamp(s.moral);
  usurier();
  randomEvent();
}

function dormir(appart) {
  const prix = appart ? 15 : 8;
  if (s.argent < prix) return non(`Il te faut ${prix} € pour dormir ici. Le squat et le pont sont gratuits.`);
  nuit(() => {
    s.tel = 100;
    if (appart) { s.sante += 35; s.moral += 8; s.argent -= 15; log('Une vraie nuit au calme dans ton appartement (loyer 15 €).'); }
    else { s.sante += 20; s.argent -= 8; }
  });
}

// ---- L'usurier repasse tous les 2 jours tant que la dette n'est pas soldée ----
function usurier() {
  if (!s.dette || s.jour < s.echeance) return;
  if (s.argent >= s.dette) {
    s.argent -= s.dette; s.moral += 5; sfx('coin');
    lien('dede', 1);
    log(`💸 Tu rembourses tes ${s.dette} € à Dédé. « T'es réglo, toi. »`);
    s.dette = 0; s.echeance = 0;
  } else {
    s.sante -= 20; s.moral -= 15; s.dette += 10; s.echeance = s.jour + 2; sfx('bad');
    lien('dede', -2);
    log(`💸 Dédé et deux types t'attendent. Tu ne peux pas payer : tu prends des coups et 10 € de pénalité (dette : ${s.dette} €).`);
  }
}

// ---- Fin de tour : bornes, affichage, fins de partie, sauvegarde ----
// statistiques de la partie, pour l'écran de fin
const histo = () => {
  s.hist = s.hist || { gagne: 0, argent: s.argent };
  s.hist.depense = s.hist.depense || 0; s.hist.actions = s.hist.actions || 0;
  s.hist.controles = s.hist.controles || 0; s.hist.clopes = s.hist.clopes || 0;
  return s.hist;
};
function endTurn() {
  s.sante = clamp(s.sante); s.moral = clamp(s.moral); s.tel = clamp(s.tel); s.argent = Math.max(0, s.argent);
  const hi = histo();
  if (s.argent > hi.argent) hi.gagne += s.argent - hi.argent;
  hi.argent = s.argent;
  render();
  if (over) return;
  if (s.arrete) {
    endScreen('EXPULSÉ·E', '#f59e0b', `${name} est arrêté·e, jugé·e en comparution immédiate, puis renvoyé·e au pays au jour ${s.jour}.`, 'lose');
  } else if (s.sante <= 0) {
    log(`${name} s'effondre et est emmené·e aux urgences. Fin de partie.`);
    endScreen('MORT', '#e11', `${name} n'a pas survécu au jour ${s.jour}.`, 'lose');
  } else if (s.moral <= 0) {
    log(`${name} n'en peut plus et abandonne.`);
    endScreen('ABANDON', '#9aa', `Le moral à zéro, ${name} rentre au pays au jour ${s.jour}.`, 'lose');
  } else if (s.papiers >= 3) {
    log(`🎉 ${name} a obtenu son titre de séjour en ${s.jour} jours !`);
    endScreen('VICTOIRE', '#2e2', `${name} a obtenu son titre de séjour en ${s.jour} jours !` + (s.crimes ? ` Mais ${s.crimes} personne${s.crimes > 1 ? 's' : ''} ne se remettr${s.crimes > 1 ? 'ont' : 'a'} jamais de ce que tu leur as fait.` : ''), 'win');
  }
  if (over) clearSave(); else save();
}

// ---- Sauvegarde (dans ce navigateur) ----
const SAVE_KEY = 'migrator-save';
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ s, name, color, log: document.getElementById('log').innerHTML })); } catch {}
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}
const saved = loadSave();
if (saved) {
  const b = document.getElementById('continue');
  b.style.display = 'inline-block';
  b.textContent = `▶ Continuer (${saved.name}, jour ${saved.s.jour})`;
}
function continueGame() {
  const d = loadSave();
  if (!d) return;
  Object.assign(s, d.s); name = d.name; color = d.color;
  s.combat = null; // une bagarre en cours ne se sauvegarde jamais (voir doAct/finBagarre) ; par sécurité sur une vieille sauvegarde
  launch();
  document.getElementById('log').innerHTML = d.log;
  log('Partie reprise.');
  render();
  if (s.choix != null && EVENTS[s.choix]) askChoice(EVENTS[s.choix]);
}
function newGame() {
  if (loadSave() && !confirm('Une partie est en cours. La remplacer par une nouvelle ?')) return;
  clearSave(); start();
}

// ---- Affichage ----
function bar(icon, label, v, k) {
  const col = `hsl(${v * 1.2}, 75%, 48%)`;
  return `<div class="stat bar" data-k="${k}"><div class="lbl"><span>${icon} ${label}</span><b>${v}</b></div>` +
         `<div class="track"><div class="fill" style="width:${v}%;background:${col}"></div></div></div>`;
}

// ---- Chiffres qui s'envolent : on compare avec l'affichage précédent ----
const SUIVIS = { sante: '', moral: '', tel: '', argent: ' €', langue: '', reseau: '' };
let avant = null;
function showDeltas() {
  const maint = {};
  for (const k in SUIVIS) maint[k] = s[k];
  if (avant) for (const k in SUIVIS) {
    const diff = maint[k] - avant[k], el = document.querySelector(`#stats [data-k="${k}"]`);
    if (!diff || !el) continue;
    const d = document.createElement('span');
    d.className = 'delta ' + (diff > 0 ? 'up' : 'down');
    d.textContent = (diff > 0 ? '+' : '−') + Math.abs(diff) + SUIVIS[k];
    el.appendChild(d);
  }
  avant = maint;
}

function render() {
  const h = s.heure;
  const moment = h < 12 ? '🌅' : h < 18 ? '☀️' : h < 21 ? '🌇' : '🌙';
  document.getElementById('title').textContent = name;
  const vague = h < 12 ? 'matin' : h < 18 ? 'après-midi' : h < 21 ? 'soir' : 'nuit';
  document.getElementById('clock').textContent = `Jour ${s.jour} · ${moment} ${has('montre') ? h + ' h' : vague}`;
  document.getElementById('stats').innerHTML = `
    ${bar('❤️', 'Santé', s.sante, 'sante')}${bar('🙂', 'Moral', s.moral, 'moral')}${bar('🔋', 'Batterie', s.tel, 'tel')}
    <div class="chips">
      <span class="chip" data-k="argent">💶 ${s.argent} €</span><span class="chip">📄 ${PAPIERS[s.papiers]}</span>
      <span class="chip" data-k="langue">🗣️ Langue ${s.langue}</span><span class="chip" data-k="reseau">🤝 Réseau ${s.reseau}</span>
      ${s.bonus ? `<span class="chip">📌 Dossier +${Math.round(s.bonus * 100)} %</span>` : ''}
      ${s.diplome ? '<span class="chip">🎓 Diplôme</span>' : ''}
      ${s.dette ? `<span class="chip warn">💸 Dette ${s.dette} € (jour ${s.echeance})</span>` : ''}
      ${s.clopes ? `<span class="chip">🚬 ${s.clopes} paquet${s.clopes > 1 ? 's' : ''}</span>` : ''}
      ${s.chaud ? `<span class="chip warn">👮 Repéré ${'!'.repeat(Math.min(5, s.chaud))}</span>` : ''}
      ${s.recherche ? `<span class="chip warn">🚨 Recherché·e (${s.recherche} j)</span>` : ''}
    </div>
    ${s.pnj && Object.keys(PNJ).some(connu) ? `<div class="inv">👥 ${Object.keys(PNJ).filter(connu).map(id => `<span class="chip" title="${PNJ[id].role} · relation ${P(id).rel}">${icone(PNJ[id], 'ic face')} ${PNJ[id].nom} ${humeur(P(id).rel)}</span>`).join('')}</div>` : ''}
    <div class="inv"><span class="sac" title="${SACS[s.sac || 0].nom}">${icone(SACS[s.sac || 0])} ${placesPrises()}/${SACS[s.sac || 0].cap}</span>${inv().length ? inv().map((o, k) => `<button onclick="itemMenu(${k})" title="${ITEMS[o.id].nom}">${icone(ITEMS[o.id], 'ic obj')}</button>`).join('') : '<span class="vide">sac vide — le bazar vend des objets utiles</span>'}</div>`;
  showDeltas();
  // Jour et nuit : la carte s'assombrit à partir de 18 h
  map.classList.toggle('nuit', h >= 18);
  document.getElementById('night').style.opacity = Math.max(0, Math.min(0.65, (h - 17) * 0.11));
  placePlayer(s.pos);
  renderPanel();
  PLACES.forEach((p, i) => {
    const lock = p.lock && p.lock();
    const ouvert = h >= p.o && h < p.f;
    const b = placeBtns[i];
    b.classList.toggle('locked', !!lock);
    b.classList.toggle('closed', !lock && !ouvert);
    const nom = p.a === 'appart' && s.appart ? 'Chez toi' : p.nom;
    const info = lock ? '🔒 ' + p.lockTxt : p.txt || (p.f - p.o === 24 ? '24 h/24' : `${p.o} h – ${p.f} h`);
    const court = p.img, ferme = !lock && !ouvert ? `<em class="shut">${h < p.o ? (court ? p.o + ' h' : 'ouvre à ' + p.o + ' h') : (court ? '✕' : 'fermé')}</em>` : '';
    b.classList.toggle('spot', !!p.img);
    if (p.img) {
      b.title = `${nom} — ${info}`;
      b.innerHTML = ferme + (p.lock && !lock ? `<span>${p.a === 'appart' ? '🏠' : p.ico}</span>` : '');
    } else b.innerHTML = `${ferme}<span>${lock ? '🔒' : p.ico}</span>${nom}<small>${info}</small>`;
  });
}

function log(t) {
  const l = document.getElementById('log');
  const cls = t.startsWith('— Jour') ? 'day' : t.startsWith('⚡') ? 'ev' : t.startsWith('👮') ? 'cop'
            : /^💸|\(\+\d+ €\)/.test(t) ? 'money' : '';
  l.innerHTML = `<div class="${cls}">${t.replace(/</g, '&lt;')}</div>` + l.innerHTML;
}
