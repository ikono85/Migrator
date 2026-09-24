# Migrator — spécification complète du jeu

> Document de référence destiné à être lu par un humain ou par une IA qui reprend le projet.
> Il décrit **l'intégralité** des règles, des chiffres et de l'architecture du code, à jour des fichiers `index.html`, `style.css`, `data.js` et `game.js`.

---

## 1. Ce qu'est le jeu

Migrator est un jeu de gestion narratif, en français, où l'on incarne une personne qui vient d'arriver dans une ville étrangère et cherche à obtenir un titre de séjour. On joue jour par jour : on se déplace sur une carte de la ville et on choisit des actions qui consomment du temps, de l'argent, de la santé et du moral.

Le sujet est social et volontairement réaliste : la lenteur administrative, la précarité, le travail non déclaré, la solidarité associative. Les activités illégales rapportent peu ou exposent à de lourdes conséquences ; les agressions (§7) rapportent gros mais peuvent mener à l'expulsion.

Public visé : des amis de l'auteur, sur navigateur, en quelques minutes de partie.

---

## 2. Technique

| Point | Valeur |
| --- | --- |
| Fichiers de jeu | `index.html` (structure), `style.css` (apparence), `data.js` (contenu), `game.js` (moteur) — voir §12 |
| Dépendances | **aucune** — pas de framework, pas de build, pas de serveur. Seules les polices (Bebas Neue, Inter) viennent de Google Fonts ; sans internet, la police système prend le relais |
| Lancement | double-clic sur `index.html`, ou n'importe quel hébergement statique — les 4 fichiers doivent rester dans le même dossier |
| Assets | `fonds/` (6 fonds + `carte.jpg`, la carte illustrée), `perso/` (3 avatars), `images/` (images dessinées, voir §12 bis), `musique/` (3 MP3, ~14 Mo) |
| Persistance | `localStorage`, clé `migrator-save` |
| Sons d'action | générés à la volée via l'API Web Audio — aucun fichier son |
| Dépôt | https://github.com/ikono85/Migrator |

Contraintes à respecter si on modifie le projet : **zéro dépendance, zéro build** — seulement des fichiers statiques ouvrables sans serveur (les images vont dans `images/`), garder tous les textes en français, et conserver le ton sobre (pas d'humour sur la situation décrite). Le code reste réparti en 4 fichiers plutôt qu'un seul (voir §12) : ne pas re-fusionner sans raison.

---

## 3. Écran d'accueil

L'utilisateur saisit un prénom (2 à 16 lettres, validé par `/^[\p{L} \-']{2,16}$/u`) et choisit une couleur parmi trois. La couleur n'est pas qu'un habillage : elle détermine l'avatar, le fond d'écran d'accueil, le fond de partie et la musique de fond.

| Couleur | Avatar | Fond accueil | Fond partie | Musique |
| --- | --- | --- | --- | --- |
| `#111111` noir | `perso/noir.jpg` | `geo12ouvkibera-retoucheok.webp` | `rue-noir.jpg` | `noir.mp3` |
| `#facc15` jaune | `perso/jaune.png` | `riziere-bali-indonesie.avif` | `rue-jaune.webp` | `jaune.mp3` |
| `#7b4a2a` marron | `perso/marron.jpg` | `683466.ori.jpg` | `souk-marron.jpg` | `marron.mp3` |

Aucune différence de règles entre les couleurs à ce jour : c'est un axe d'évolution prévu (prix, difficulté et événements propres à chaque « pays »).

Un bouton **▶ Continuer** apparaît à côté de « Commencer » si une sauvegarde existe ; « Commencer » demande confirmation avant de l'écraser.

La couleur choisie donne aussi la **couleur d'accent** de l'interface (`ACCENT`) : gris acier pour le noir, doré pour le jaune, ocre pour le marron. Elle choisit enfin l'image de la famille dans l'événement « La famille a besoin d'argent ».

---

## 4. L'état de la partie

Tout l'état tient dans un seul objet `s`, ce qui rend la sauvegarde triviale :

```js
const s = { sante: 70, moral: 50, argent: 50, langue: 1, papiers: 0, reseau: 0,
            tel: 40, jour: 1, heure: 8, pos: 0, bonus: 0,
            appart: false, diplome: false, clopes: 0, chaud: 0,
            dette: 0, echeance: 0, sac: 0, inv: [],
            recherche: 0, cauchemars: 0, crimes: 0 };
```

| Champ | Sens | Bornes |
| --- | --- | --- |
| `sante` | santé physique | 0–100, `clamp()` à chaque tour ; **0 = mort** |
| `moral` | moral | 0–100 ; **0 = abandon** |
| `argent` | euros | ≥ 0 |
| `langue` | niveau de langue | 1–10 |
| `papiers` | index dans `PAPIERS` | 0–3 ; **3 = victoire** |
| `reseau` | contacts noués | non borné |
| `tel` | batterie du téléphone | 0–100, remis à 100 chaque nuit |
| `jour` | jour courant | à partir de 1 |
| `heure` | heure courante | 8 à 23 |
| `pos` | index du lieu dans `PLACES` | 0–15 |
| `bonus` | bonus cumulé au prochain dossier | remis à 0 après chaque tentative |
| `appart` | appartement loué | booléen |
| `diplome` | diplôme de langue obtenu | booléen |
| `clopes` | paquets de cigarettes en stock | entier |
| `chaud` | à quel point la police t'a repéré | descend de 1 chaque nuit |
| `dette` | euros dus à un usurier | l'échéance tombe tous les 2 jours |
| `echeance` | jour de la prochaine visite de l'usurier | 0 si aucune dette |
| `prefJour` | jour de la dernière visite à la préfecture | limite à 1 par jour |
| `faits` | `{ clé: jour }` — dernier jour où une action limitée a été faite (démarches à bonus, contacts garantis, batterie externe, rencontres) | limite chacune à 1 par jour |
| `sac` | sac possédé : 0 poches, 1 plastique, 2 à dos, 3 randonnée | 0–3 |
| `inv` | objets du sac, `[{ id, u? }]` (`u` = utilisations restantes ou jour d'expiration) | ≤ places du sac |
| `demi` | la carte de transport a déjà payé l'heure du trajet précédent | booléen |
| `pnj` | mémoire des personnages récurrents (§8 bis) | objet |
| `recherche` | jours pendant lesquels on est recherché·e | −1 par nuit |
| `arrete` | texte de l'arrestation ; déclenche la fin EXPULSÉ·E | — |
| `cauchemars` | nuits de cauchemars restantes (−5 moral au réveil) | −1 par nuit |
| `crimes` | nombre d'agressions commises | entier |
| `choix` | index de l'événement à choix en attente, pour le reproposer à la reprise | — |
| `hist` | statistiques pour l'écran de fin : argent gagné, actions, contrôles | objet |

`PAPIERS = ['Aucun', 'Dossier déposé', 'Récépissé', 'Titre de séjour']`

Variables hors de `s` : `name`, `color`, `over` (partie terminée), `moving` (déplacement en cours), `refus` (l'action vient d'être refusée, donc l'heure n'avance pas).

---

## 5. Le temps

- Une journée va de **8 h à 23 h** (`FIN_JOURNEE = 23`).
- **Se déplacer coûte 1 h**, quelle que soit la distance (avec la carte de transport : deux trajets pour 1 h).
- **Chaque action coûte son propre nombre d'heures** (`d`), de 1 à 6 h. Dormir a `d: 0` car la nuit fait passer au jour suivant.
- Chaque lieu a des horaires `o` (ouverture) et `f` (fermeture). On ne peut pas s'y rendre en dehors, et un lieu fermé s'affiche grisé.
- Une action est **désactivée** (bouton gris) si elle ne peut pas se terminer avant 23 h ou avant la fermeture du lieu.
- Exception anti-blocage : les **abris** (`ABRIS = ['foyer', 'squat', 'pont']`, plus son propre appartement) restent accessibles à toute heure, pour qu'on puisse toujours aller dormir quelque part.
- Visuellement, la carte s'assombrit à partir de 18 h (`opacity = (heure - 17) × 0.11`, plafonnée à 0.65) et les lieux encore ouverts s'allument d'une lueur dorée. L'icône à côté de l'heure suit le moment de la journée : 🌅 avant 12 h, ☀️ avant 18 h, 🌇 avant 21 h, 🌙 ensuite. **Sans montre**, le bandeau n'affiche que « matin / après-midi / soir / nuit ».

**La nuit** passe par la fonction commune `nuit(fx)` : `jour + 1`, `heure = 8`, puis les effets propres au lieu où l'on dort (`fx`), la photo de famille (+2 moral), l'expiration de la carte de transport, `recherche - 1`, les cauchemars, `chaud - 1`, le passage de l'usurier (§9) et enfin `randomEvent()`. Si l'argent devient négatif, il est ramené à 0 puis **−10 santé et −10 moral** (« Pas assez pour manger »).

Dormir chez soi ou au foyer est **refusé** si l'on n'a pas de quoi payer (le squat et le pont restent gratuits). La bagarre au squat ne prend que l'argent qu'on a.

Il y a **quatre endroits où dormir**, du plus sûr au plus dur :

| Lieu | Coût | Effet | Batterie |
| --- | --- | --- | --- |
| 🏠 Chez soi | 15 € | +35 santé, +8 moral | rechargée |
| 🏚️ Foyer | 8 € | +20 santé | rechargée |
| 🏚️ Squat | gratuit | tirage : 50 % +15 santé · 30 % bagarre (−15 santé, −10 moral, −10 € sauf cadenas, 30 % de perdre un objet) · 20 % descente de police | rechargée |
| 🛞 Sous le pont | gratuit | −10 santé (−4 avec le sac de couchage), −8 moral | **non rechargée** |

Au squat et sous le pont : +3 santé avec le manteau chaud, et 10 % de perdre un objet si l'on n'a qu'un sac en plastique.

---

## 6. La carte

La carte est une **illustration** (`fonds/carte.jpg`, 1168 × 784) sur laquelle les 16 lieux sont déjà dessinés, avec leur icône et leur nom. Chaque lieu a `img: true` et des coordonnées `x`, `y` en pourcentage : le jeu pose dessus une **zone cliquable ronde** invisible. Au survol, elle s'entoure de la couleur d'accent ; le nom et les horaires apparaissent en infobulle. Le pion du joueur glisse jusqu'au lieu en 0,5 s et se place en haut à droite de l'icône.

États affichés sur la carte :

- **fermé** : le rond s'assombrit et un petit badge en bas indique l'heure d'ouverture (« 9 h ») ou « ✕ » s'il est fermé jusqu'au lendemain ;
- **verrouillé** : le cadenas est dessiné sur l'image ; quand le lieu se débloque, la vraie icône (🏠, 🏭) vient le recouvrir ;
- **la nuit** : les lieux ouverts s'allument.

Les textes dessinés (« 150 € pour louer », « Récépissé requis ») ne changent pas : c'est une limite de l'image. Un rond vert vide, en bas à gauche de l'usine, est libre pour un futur lieu.

Deux lieux sont **verrouillés** au départ :

- 🏭 **Usine** — exige `papiers >= 2` (le récépissé).
- 🏠 **Appartement** — verrouillé tant que `!appart && argent < 150`.

**Boucle de jeu** : cliquer un lieu → le pion s'y déplace (1 h) → les actions de ce lieu s'affichent en cartes sous la carte → on en choisit autant qu'on veut tant que le temps et les horaires le permettent → on repart ailleurs, ou on rentre dormir.

---

## 7. Les actions, lieu par lieu

`d` = durée en heures. Les gains aléatoires sont notés `a–b`.

### 🏚️ Foyer — ouvert 24 h/24

| Action | d | Effet |
| --- | --- | --- |
| 😴 Dormir | — | la nuit (voir §5) |
| 🍜 Repas du foyer | 1 | −3 € · +8 santé · +2 moral |
| 🚿 Douche et lessive | 1 | +3 santé · +6 moral |
| 💬 Discuter avec les autres | 1 | +4 moral · 35 % de chance de +1 réseau · rencontre puis relation avec Karim (§8 bis) |

### 🏫 École — 9 h → 18 h

| Action | d | Effet |
| --- | --- | --- |
| 📖 Cours de langue | 2 | −5 € · −5 santé · 40 % de chance de +1 langue |
| 🗣️ Atelier conversation | 2 | +6 moral · 20 % de chance de +1 langue |
| 🎓 Passer l'examen de langue | 3 | −20 €, exige langue ≥ 5. Réussite à `30 % + 7 % × langue` → `diplome = true`, +20 moral. Échec : −10 moral. Disparaît une fois obtenu |

### 📚 Bibliothèque — 10 h → 19 h

| Action | d | Effet |
| --- | --- | --- |
| 📕 Réviser la langue | 2 | gratuit · +2 moral · 20 % de chance de +1 langue |
| 💻 Utiliser un ordinateur | 1 | +2 moral · +20 batterie · 40 % de chance de +1 réseau |
| 🗞️ Lire le journal | 1 | +4 moral · 12 % de chance de +1 langue |

### 🏛️ Préfecture — 9 h → 16 h

| Action | d | Effet |
| --- | --- | --- |
| 📄 Déposer / suivre ton dossier | 3 | **1 fois par jour**, −8 santé. Voir la formule ci-dessous |
| ❓ Se renseigner au guichet | 1 | 1 fois par jour · −2 moral · **+10 %** au prochain dossier |
| ⚖️ Consulter un avocat | 2 | 1 fois par jour · −40 € · +5 moral · **+25 %** au prochain dossier |

**Formule d'avancée du dossier** — c'est le cœur du jeu :

```js
chance = 0.05                 // socle
       + langue × 0.025       // parler la langue aide
       + min(reseau, 10) × 0.02 // connaître du monde aide, plafonné à +20 %
       - papiers × 0.04       // chaque étape est plus dure que la précédente
       + (diplome ? 0.10 : 0) // permanent
       + bonus                // justificatifs accumulés, consommé après la tentative
       + (tenue ? 0.05 : 0)   // tenue propre, 3 visites
       + (lettre ? 0.10 : 0); // lettre de soutien d'Hélène
```

**Réseau** : seuls les 10 premiers contacts comptent (`RESEAU_MAX`). « Rencontrer les bénévoles » et « Aider au repas solidaire » ne donnent leur contact garanti qu'une fois par jour (`premiereFois(clé)`) ; refaites, elles gardent leurs effets santé et moral.

**Bonus de dossier** : plafonné à **+30 %** (`BONUS_MAX`). Chaque démarche qui en donne (guichet, avocat, bilan de santé, fiche de paie, aide de l'association) n'est possible **qu'une fois par jour** ; la refaire est refusé sans consommer d'heures.

Réussite → `papiers + 1`, +15 moral. Échec → −8 moral. `bonus` est remis à 0 dans les deux cas (à moitié seulement après un échec, avec la pochette de documents). Si l'on est recherché·e, la visite a 50 % de chance de finir en arrestation.

### 🏠 Appartement — 24 h/24, verrouillé tant qu'on n'a pas 150 €

| Action | d | Effet |
| --- | --- | --- |
| 🔑 Louer l'appartement | 1 | −150 € une seule fois · +20 moral · `appart = true` |
| 😴 Dormir chez toi | — | la nuit, version améliorée |
| 🍲 Cuisiner | 1 | −5 € · +12 santé · +5 moral |
| 👥 Inviter des amis | 2 | −10 €, exige réseau ≥ 2 · +18 moral · +3 santé |

Les trois dernières n'apparaissent qu'une fois l'appartement loué ; la première disparaît à ce moment-là.

### 🕌 Lieu de culte — 6 h → 21 h

| Action | d | Effet |
| --- | --- | --- |
| 🙏 Prier | 1 | +10 moral |
| 🤲 Se confier | 2 | +18 moral |
| 🍲 Aider au repas solidaire | 3 | +1 réseau (1 fois par jour) · +8 moral · +6 santé |

### 🏥 Hôpital — 24 h/24

| Action | d | Effet |
| --- | --- | --- |
| 💊 Consulter un médecin | 2 | −20 € · +30 santé |
| 🚑 Attendre aux urgences | 5 | gratuit · +22 santé · −8 moral |
| 🩺 Faire un bilan de santé | 2 | 1 fois par jour · −10 € · +10 santé · **+5 %** au prochain dossier |

### 🏭 Usine — 7 h → 20 h, exige le récépissé

| Action | d | Effet |
| --- | --- | --- |
| 🔧 Journée complète | 6 | exige santé ≥ 25 · **+45 à 65 €** · −20 santé · +6 moral |
| ⏰ Demi-journée | 3 | exige santé ≥ 12 · +20 à 30 € · −9 santé |
| 🧾 Demander une fiche de paie | 1 | 1 fois par jour · **+12 %** au prochain dossier |

### 🛒 Marché — 6 h → 14 h

| Action | d | Effet |
| --- | --- | --- |
| 📦 Petit boulot | 4 | exige santé ≥ 15 · **+(10 à 20) + 3 × langue €** · −12 santé · +3 moral |
| 🥖 Acheter à manger | 1 | −8 € · +12 santé · +3 moral |
| 🧺 Vendre quelques objets | 2 | 25 % : rien et −12 moral. Sinon +8 à 25 € |

### 🤝 Association — 10 h → 19 h

| Action | d | Effet |
| --- | --- | --- |
| ☕ Rencontrer les bénévoles | 2 | +1 réseau (1 fois par jour) · +6 moral · +5 santé |
| 🗂️ Aide pour ton dossier | 2 | 1 fois par jour · +4 moral · **+15 %** au prochain dossier |

Chaque action à l'association fait rencontrer Hélène, puis monte la relation avec elle (§8 bis).
| 👕 Vestiaire solidaire | 1 | +6 santé · +6 moral |

### 📞 Parc (wifi) — 24 h/24

| Action | d | Effet |
| --- | --- | --- |
| 📞 Appeler la famille | 1 | exige batterie ≥ 10 · −15 batterie · +12 moral |
| 🌳 Se reposer sur un banc | 2 | +8 santé · +3 moral |
| ⚽ Jouer au foot | 2 | −4 santé · +12 moral · 40 % de chance de +1 réseau |

### 🚬 Coin de rue — 24 h/24 — économie illégale

| Action | d | Effet |
| --- | --- | --- |
| 🚬 Vendre des cigarettes à l'unité | 2 | **aucune condition** · +3 à 8 € (ou +11 à 17 € si `clopes > 0`, qui consomme un paquet) · −2 moral · `chaud + 1` · risque de base **10 %** |
| 📦 Acheter un paquet au noir | 1 | −6 € · `clopes + 1` · prend une place dans le sac |
| 🕶️ Faire le guet | 3 | +15 à 25 € · −6 moral · `chaud + 2` · risque de base **22 %** |
| 🥊 Chercher la bagarre | 1 | **prototype** — lance une bagarre 1 contre 1 (voir §7 bis), sans condition ni enjeu propre pour l'instant |
| 💸 Demander un dépannage rapide | 1 | +30 € tout de suite · **+50 € de dette** (§9), auprès de Dédé |

**Le contrôle de police** (`police(base)`), commun à ces actions :

```js
risque = base + chaud × 0.04
```

Si l'on est recherché·e, le contrôle finit en **arrestation**. Si le brigadier Morel apprécie le joueur (relation ≥ 2), il a 50 % de chance de fermer les yeux. Sinon : amende de 10 à 20 € (plus 3 € par paquet avec un vrai sac, le tout doublé avec une machette, plafonnée à l'argent disponible), −12 moral, **stock saisi**, `chaud` remis à 0, et **30 % de chance de perdre une étape de papiers** si on en avait au moins une. L'action est perdue mais le temps est quand même consommé.

Intention de game design : c'est un **filet de sécurité quand on n'a plus rien**, pas une stratégie gagnante. Ça rapporte environ 5,5 € pour 2 h — moins que le marché — et ça met en danger l'objectif du jeu.

**Agressions** (coin de rue, 1 h chacune) — choix de l'auteur : contenu violent et gore assumé.

| Acte | Gain | Moral | Reconnu·e |
| --- | --- | --- | --- |
| 👵 Arracher le sac d'une grand-mère | 20–45 € | −15 | 25 % |
| 👴 Assommer un grand-père | 30–70 € | −25 | 40 % |
| 🔪 Couper le poignet pour la montre (machette du bazar, 25 €) | 60–120 € | −35 | 60 % |

Chaque agression : `chaud + 2`, +3 nuits de cauchemars (−5 moral au réveil), `crimes + 1`. Si la victime te reconnaît : **recherché·e 4 jours** (`s.recherche`, cumulable, −1 par nuit). Tant qu'on est recherché·e, on est **arrêté·e** (`s.arrete`) par tout contrôle de police qui tombe, au contrôle d'identité (montrer ses papiers, ou courir et être rattrapé·e), à 50 % à la préfecture et à 5 % à chaque déplacement. Arrestation = fin **EXPULSÉ·E**. Avec une machette dans le sac, l'amende de police double. Une victoire après des agressions le rappelle dans le message de fin.

---

## 7 bis. Bagarre 1 contre 1 (prototype)

Système à choix de coups façon pierre-feuille-ciseaux, déclenché par `bagarre(nom, pv, fin)` — actuellement testable via **Chercher la bagarre** au coin de rue, pas encore raccordé à un vrai enjeu narratif (adversaire précis, gain, conséquence).

Trois coups, en cycle (`COUPS` dans `data.js`) :

| Coup | Bat |
| --- | --- |
| 👊 Coup de poing | 🏖️ Jeter du sable |
| 🏖️ Jeter du sable | 🦶 Esquiver et riposter |
| 🦶 Esquiver et riposter | 👊 Coup de poing |

Chaque round : le joueur choisit un coup, l'adversaire en tire un au hasard. Coup gagnant → 3 à 6 points de dégâts à l'adversaire ; coup perdant → 3 à 6 points au joueur ; égalité → rien. Chacun a 20 points de vie (`pv` du paramètre pour l'adversaire, toujours 20 pour le joueur). La bagarre se termine dès qu'un des deux tombe à 0.

- **Victoire** : −4 santé, +8 moral.
- **Défaite** : −15 santé, −10 moral.
- Le paramètre `fin(victoire)` de `bagarre()` permet de brancher des conséquences propres à l'adversaire (relation avec un PNJ, objet gagné…) — non utilisé pour l'instant.

Moteur dans `game.js` (`bagarre()`, `renderCombat()`, `jouerCoup()`, `finBagarre()`, `barreVie()`), contenu (`COUPS`) dans `data.js`.

---

### 🏚️ Squat — 24 h/24

| Action | d | Effet |
| --- | --- | --- |
| 😴 Squatter pour la nuit | — | gratuit, batterie rechargée, tirage décrit au §5 |
| 🔦 Chercher des objets | 2 | 40 % : +5 à 15 € · 10 % : −8 santé · 5 % : la photo de famille (si on ne l'a pas) · sinon rien |

### 🛞 Sous le pont — 24 h/24

| Action | d | Effet |
| --- | --- | --- |
| 😴 Dormir dehors | — | gratuit · −10 santé · −8 moral · batterie non rechargée |
| 🥫 Taper la manche | 2 | +2 à 8 € · −4 moral |

### 🍺 Bar du quartier — à partir de 16 h

| Action | d | Effet |
| --- | --- | --- |
| 🍺 Boire un coup | 1 | −4 € · +12 moral · −5 santé |
| 🥂 Payer un verre pour discuter | 2 | −8 € · 35 % : +2 réseau · 25 % : −10 moral · 40 % : rien |
| 💸 Demander un dépannage rapide | 1 | la même action qu'au coin de rue — c'est **le même objet JavaScript** partagé par les deux lieux |

Le bar affiche « 16 h – 23 h » sur la carte ; techniquement il est déclaré `o: 16, f: 24`, mais comme la journée s'arrête à 23 h, la fenêtre réelle est bien 16 h → 23 h.

---

### 🏪 Bazar — 9 h → 19 h (16ᵉ case, à la place du parc décoratif)

Achats **instantanés** (0 h). Les objets vont dans le sac (`s.inv`, tableau de `{ id, u? }`) ; les paquets de cigarettes prennent aussi une place chacun. Sans sac : 2 places (les poches).

| Sac (`s.sac`) | Prix | Places | Particularité |
| --- | --- | --- | --- |
| 🛍️ Sac en plastique | 2 € | 4 | 10 % de chance de perdre un objet par nuit au squat ou sous le pont |
| 🎒 Sac à dos | 25 € | 7 | — |
| 🥾 Sac de randonnée | 60 € | 10 | aucun objet ne peut être volé |

On ne peut que monter en gamme. Avec un sac à dos ou de randonnée, chaque paquet saisi par la police ajoute 3 € à l'amende.

| Objet | Prix | Effet |
| --- | --- | --- |
| 🛏️ Sac de couchage | 20 € | pont : −4 santé au lieu de −10 · annule la nuit glaciale |
| 🔒 Cadenas | 8 € | la bagarre au squat ne coûte plus d'argent |
| 🧥 Manteau chaud | 15 € | +3 santé par nuit au squat ou au pont |
| 🔋 Batterie externe | 12 € | à utiliser : téléphone à 100 %, 1 fois par jour |
| ⌚ Montre | 10 € | heure exacte (sinon « matin / après-midi / soir / nuit ») et « ferme dans X h » |
| 🎫 Carte de transport | 15 € | deux trajets pour 1 h (`s.demi`), expire au bout de 7 jours |
| 📁 Pochette de documents | 5 € | un échec à la préfecture ne fait perdre que la moitié du bonus |
| 👔 Tenue propre | 18 € | +5 % à la préfecture, 3 visites |
| 📘 Dictionnaire de poche | 10 € | +10 % à chaque chance de progresser en langue |
| 🩹 Trousse de secours | 12 € | à utiliser : +15 santé, 3 fois, 0 h |
| 🧃 Provisions | 6 € | à utiliser : +8 santé, +2 moral, consommé |
| 📷 Photo de famille | — | trouvée au squat (5 % en cherchant des objets) · +2 moral chaque matin · −20 moral si perdue |

Tous uniques sauf la trousse et les provisions. Un clic sur un objet du bandeau ouvre un menu : l'utiliser, le **revendre à moitié prix** (au bazar, ouvert) ou le jeter. Vols : bagarre au squat (30 %) et vol dans la nuit (50 %) prennent un objet au hasard, sauf avec le sac de randonnée.

---

## 8. Les événements aléatoires

Au réveil, une fois sur deux (`Math.random() > 0.5 → aucun événement`), un événement est tiré dans la liste `EVENTS`, qui en compte **13**.

**Événements immédiats** : repas offert par un bénévole (+10 santé, +5 moral) · téléphone volé (batterie à 0, −15 moral, 50 % de perdre un objet) · argent réclamé (−20 €, ou tout ce qu'on a) · billet de 10 € trouvé · nuit glaciale (−12 santé, sauf sac de couchage) · un voisin t'apprend des mots (+1 langue). Ils s'annoncent par une **notification** en haut de l'écran (médaillon + texte, 4,5 s) et une ligne ⚡ dans le journal. Leur texte est calculé avant leurs effets.

**Événements à choix**, qui ouvrent une fenêtre modale bloquante, avec un **médaillon** rond (icône ou image, couleur propre à l'événement) et un bandeau parchemin :

| Situation | Option A | Option B |
| --- | --- | --- |
| Travail au noir à 60 € | Accepter : 35 % de contrôle (−25 moral, −1 papier), sinon +60 € et −15 santé | Refuser : +2 moral |
| Un migrant affamé demande de l'aide | Partager 10 € : +1 réseau, +10 moral | Passer : −5 moral |
| Contrôle d'identité (brigadier Morel) | Montrer ses papiers : Morel +1 ; sans effet si `papiers ≥ 2` ou s'il t'apprécie, sinon −15 moral et −5 santé ; arrestation si recherché·e | Courir : Morel −2 ; 50 % −10 santé, sinon −25 moral et −1 papier ; arrestation si recherché·e et rattrapé·e |
| La famille a besoin d'argent | Envoyer 25 € : +12 moral | Garder : −10 moral |
| Un habitué demande de garder son sac | Accepter : 50 % +10 € et +1 réseau, sinon contrôle de police garanti et `chaud + 3` | Refuser : −5 moral, il t'insulte |
| Le gardien fouille tes affaires | Baisser la tête : −12 moral | Rétorquer : +5 moral, puis −10 € si tu les as, sinon dehors pour la nuit (−10 santé, −10 moral) |
| Un habitué demande ton téléphone | Prêter : 60 % batterie à zéro, 40 % téléphone perdu (jusqu'à −30 € et −10 moral) | Refuser : −5 moral |

---

## 8 bis. Les personnages récurrents

Chacun a une mémoire dans `s.pnj[id]` : `rel` (relation, négative = rancune), `vu` (rencontré) et des drapeaux de ce qui s'est passé. Leurs événements portent une condition `cond()` ; au réveil, s'il y en a un de disponible, il passe en priorité (60 %). Le bandeau affiche les personnes rencontrées avec leur humeur (😊 🙂 😐 😠).

| Personnage | Rencontre | Ce qu'il retient |
| --- | --- | --- |
| 🧔 **Karim**, voisin de foyer | 1ʳᵉ « Discuter avec les autres » au foyer ; +1 relation par jour ensuite | Demande 10 € : prêter → il rend 20 € 3 jours plus tard ; relation ≥ 3 → présente son cousin (réseau +2). Refuser → il le raconte au foyer (−8 moral, −1 réseau) |
| 👩‍🦳 **Hélène**, bénévole | 1ʳᵉ action à l'association ; +1 relation par jour ensuite | Relation 3 → manteau offert (ou soupe) ; relation 5 → propose une **lettre de soutien** (+10 % permanent à la préfecture, coûte la matinée). Si tu as commis une agression : elle l'apprend, retire la lettre et t'évite |
| 👮 **Brigadier Morel**, policier | 1ᵉʳ contrôle d'identité | Montrer ses papiers +1, courir −2, chaque agression −2. Relation ≥ 2 → 50 % de chance qu'il ferme les yeux sur un contrôle (−1 à chaque fois) ; ≥ 3 → un conseil qui efface le repérage ; ≤ −3 → repérage +3 |
| 🕶️ **Dédé**, prêteur | 1ᵉʳ dépannage | Rembourser +1, ne pas pouvoir payer −2 (c'est lui qui passe réclamer) |

---

## 9. La dette et l'usurier

Une soupape de dernier recours, disponible au 🍺 bar et au 🚬 coin de rue : **Demander un dépannage rapide** donne **+30 € immédiatement** et inscrit **+50 € de dette**. L'échéance est fixée à `jour + 2` **seulement s'il n'y en a pas déjà une** : emprunter à nouveau ne repousse pas le remboursement. La dette est plafonnée à **100 €** (`DETTE_MAX`) : au-delà, l'emprunt est refusé sans consommer d'heures.

`usurier()` est appelée à chaque nuit, avant les événements :

```js
if (!s.dette || s.jour < s.echeance) return;   // rien à réclamer aujourd'hui
if (s.argent >= s.dette) {                     // tu peux payer
  s.argent -= s.dette; s.moral += 5; s.dette = 0; s.echeance = 0;
} else {                                       // tu ne peux pas
  s.sante -= 20; s.moral -= 15;                // passage à tabac
  s.dette += 10; s.echeance = s.jour + 2;      // pénalité, il repassera
}
```

Conséquences de design : emprunter 30 € coûte 50 €, et ne pas pouvoir rembourser fait **−20 santé tous les deux jours**, ce qui peut tuer le personnage. Emprunter plusieurs fois cumule les dettes, dans la limite du plafond (la pénalité de 10 € peut, elle, le dépasser). La dette s'affiche dans les statistiques avec le jour de la prochaine échéance.

---

## 10. Les fins

Vérifiées dans `endTurn()`, dans cet ordre :

| Condition | Écran | Sens |
| --- | --- | --- |
| `arrete` | **EXPULSÉ·E** (orange) | arrêté·e, comparution immédiate, renvoyé·e au pays |
| `sante <= 0` | **MORT** (rouge) | emmené aux urgences |
| `moral <= 0` | **ABANDON** (gris) | retour au pays |
| `papiers >= 3` | **VICTOIRE** (verte) | titre de séjour obtenu en N jours (le message rappelle les agressions éventuelles) |

Chaque écran montre un **résumé** en six cases : jours, argent gagné, actions, papiers, contacts, contrôles de police. Dans tous les cas la sauvegarde est effacée et la musique s'arrête. Le seul bouton proposé est « Rejouer », qui recharge la page.

---

## 11. La sauvegarde

Un événement à choix en attente est sauvegardé (`s.choix`) et reproposé à la reprise. « Commencer » demande confirmation si une partie existe. La batterie est bornée à 0–100 à chaque tour.

Sauvegarde automatique à la fin de chaque tour, dans `localStorage` sous `migrator-save`. Elle contient `s`, le prénom, la couleur et le HTML du journal. Tout est enveloppé dans des `try/catch` car certains contextes bloquent le stockage. Elle est locale à un navigateur : elle ne suit pas l'utilisateur d'une machine à l'autre.

---

## 12. Architecture du code

Le jeu est réparti en 4 fichiers, tous dans le même dossier, chargés dans cet ordre par `index.html` :

1. **`index.html`** — uniquement le balisage : écran d'accueil `#start`, jeu `#game` (bandeau `.hud` avec `#stats`, carte `#map`, panneau `#actions`, journal `#log`), écran de fin `#dead` avec `#recap`, notification `#toast`, modale `#choice`. Charge `style.css` en `<link>`, puis `data.js` et `game.js` en `<script src>` en bas de page, dans cet ordre précis.
2. **`style.css`** — toute la CSS : bandeau, carte, cartes d'action, journal, médaillons, notification, inventaire.
3. **`data.js`** — tout le **contenu**, rien de mécanique : `PNJ` et ses aides (`P()`, `connu()`, `lien()`, `humeur()`, `voirKarim()`, `voirHelene()`), `PAPIERS`, `EVENTS`, `SACS`, `ITEMS`, `BAZAR_ACTS`, `depannage`, `VIEILLES`, `VIEUX`, `CRIMES`, `COUPS` (les coups de la bagarre 1v1, §7 bis), et enfin `PLACES` — **toute la donnée des lieux**, chaque lieu portant son tableau `acts`.
4. **`game.js`** — le **moteur** : état (`s`), tout ce qui dépend de la couleur choisie (`COLORS`, `AVATAR`, `ACCENT`, `BG`, `GAME_BG`, `MUSIC`), `sfx()`, `randomEvent()`/`toast()`/`askChoice()`, `endScreen()`, les aides d'écriture des actions (`non()`, `cout()`, `gagneLangue()`, `police()`, `dejaFait()`, `premiereFois()`, `atout()`), l'inventaire (`icone()`, `has()`, `placeLibre()`, `ajoute()`, `volObjet()`, `dechire()`, `itemMenu()`), `arrete()`/`agression()`, le moteur de bagarre (`bagarre()`, `renderCombat()`, `jouerCoup()`, `finBagarre()`), puis `goTo()`, `doAct()`, `pills()`, `renderPanel()`, `nuit()`, `dormir()`, `usurier()`, `histo()`, `endTurn()`, la sauvegarde, `bar()`, `showDeltas()`, `render()`, `log()`.

`data.js` doit être chargé **avant** `game.js` : dès son exécution, `game.js` construit les boutons de la carte à partir de `PLACES` (`const placeBtns = PLACES.map(...)`). Le reste de `data.js` ne fait aucun appel immédiat aux fonctions de `game.js` — tout est enfermé dans des fermetures (`fn: () => {...}`) qui ne s'exécutent qu'au clic, une fois les deux fichiers chargés ; c'est pour ça que l'ordre inverse ne pose pas de problème ailleurs dans le fichier.

**Le point important pour qui modifie le jeu** : le contenu est entièrement déclaratif dans `PLACES` (`data.js`). Ajouter un lieu ou une action ne demande de toucher à aucune mécanique — il suffit d'ajouter un objet, dans `data.js`. Un lieu s'écrit :

```js
{ a: 'identifiant', ico: '🏥', nom: 'Nom affiché', x: 63, y: 50, img: true, o: 0, f: 24,
  lock: () => condition, lockTxt: 'Raison du cadenas',
  apres: a => { /* facultatif : appelé après chaque action réussie ici */ },
  acts: [
    { ico: '💊', nom: 'Libellé du bouton', d: 2, info: 'coût · effet',
      hide: () => condition,        // facultatif : masque l'action
      fn: () => { /* effets */ } }
  ]}
```

Dans un `fn` : `cout(n)` retire l'argent ou refuse, `non(texte)` refuse l'action **sans consommer d'heures**, `log(texte)` écrit au journal, `sfx(type)` joue un son (`coin`, `good`, `bad`, `ring`, `sleep`, `event`, `win`, `lose`), `police(risque)` déclenche un contrôle et renvoie `true` si le joueur s'est fait prendre, `dejaFait(clé)` refuse une démarche déjà faite aujourd'hui, `atout(clé, part, texte)` ajoute un bonus plafonné au prochain dossier et marque la démarche comme faite, `nuit(fx)` fait passer la nuit avec les effets `fx`.

Champs facultatifs d'un lieu : `lock`/`lockTxt` (cadenas), `txt` (horaires affichés à la place des horaires réels), `img` (le lieu est dessiné sur la carte : zone cliquable invisible), `apres` (réaction après une action, utilisée pour les rencontres). Champs facultatifs d'une action : `hide` (la masque au lieu de la griser), `img` (image à la place de l'emoji), `achat` (achat instantané, pastille « achat »).

Un événement s'écrit `{ ico, img?, col, txt, fx, snd }` (immédiat) ou `{ choice: true, ico, img?, col, txt, opts: [[libellé, fn], …] }` (à choix, `fn` renvoie le texte du résultat). `cond: () => …` le réserve à une situation (utilisé pour les personnages).

⚠️ Les index de `PLACES` sont stockés dans les sauvegardes via `s.pos` : **ajouter un lieu à la fin** plutôt qu'au milieu, sinon les parties sauvegardées reprennent au mauvais endroit.

---

## 12 bis. Interface et images

**Bandeau du haut** (`.hud`, collé en haut de l'écran) : avatar, prénom, jour et heure ; trois barres (santé, moral, batterie) ; étiquettes (argent, papiers, langue, réseau, puis bonus, diplôme, dette, paquets, repérage, recherche quand ils comptent) ; le carnet 👥 des personnages rencontrés ; la ligne du sac (image du sac, places prises, objets cliquables). Quand une stat change, un chiffre vert ou rouge s'envole au-dessus d'elle (`showDeltas()`).

**Actions** : des cartes avec une grande icône, le nom et des pastilles tirées du texte `info` (`pills()`) — durée dans la couleur d'accent, gains en vert, coûts et risques en rouge.

**Journal** : les lignes ⚡ (événements) sont surlignées en jaune, 👮 (police) en rouge, les gains d'argent ont un trait vert, et un bandeau « — Jour N — » sépare les journées.

**Images dessinées** : tout élément qui a un champ `img` affiche l'image à la place de son emoji, via `icone(o, classe)`. Si le fichier manque ou ne se charge pas, l'emoji revient tout seul (`onerror`). Les images sont en **PNG** (le WebP s'affichait parfois brouillé), carrées, 256 à 320 px, fond transparent de préférence.

| Dossier | Contenu | Fait |
| --- | --- | --- |
| `fonds/carte.jpg` | la carte illustrée | ✅ |
| `images/sacs/` | `poches`, `plastique`, `dos`, `rando` | ✅ 4/4 |
| `images/objets/` | les 13 objets, nommés par leur `id` (`couchage`, `machette`…) | ✅ 13/13 |
| `images/pnj/` | `karim`, `helene`, `morel`, `dede` (carnet et médaillons de leurs événements) | ✅ 4/4 |
| `images/evenements/` | `famille-noir/jaune/marron`, `controle`, `telephone`, `travail-noir`, `repas`, `telephone-vole`, `billet`, `nuit-glaciale`, `mots`, `garder-sac` (réutilisée pour l'événement du gardien), `argent-reclame` | ✅ 13/13 |
| `perso/` | avatars : `noir.jpg`, `jaune.png`, `marron.jpg` | ✅ 3/3 |

---

## 13. Audit — état des lieux

**Ce qui est solide**

- Séparation nette entre le moteur et le contenu : lieux dans `PLACES`, objets dans `ITEMS`, événements dans `EVENTS`, personnages dans `PNJ`.
- Aucune dépendance, 4 fichiers statiques seulement (HTML, CSS, contenu, moteur) : rien ne peut casser à cause d'une bibliothèque. Une image manquante ne casse rien non plus (retour à l'emoji).
- Pas d'impasse possible : le retour au foyer est autorisé à toute heure, et dormir ne demande rien.
- Toutes les actions passent par les mêmes contrôles de temps et d'horaires, donc une nouvelle action hérite automatiquement des bonnes règles.
- Testé à la main dans le navigateur après chaque ajout (bazar, agressions, personnages, images), sans erreur JavaScript.
- Trois niveaux de précarité pour la nuit (chez soi, foyer, squat, dehors) : le joueur qui n'a plus rien a toujours une option, mais elle abîme.

**Limites connues**

- Les trois couleurs changent l'apparence (avatar, fonds, musique, accent, image de famille) mais pas les règles.
- L'échec est plus probable que la réussite au début : avec langue 1 et réseau 0, une visite à la préfecture réussit à 7,5 %. C'est voulu, mais les premiers jours peuvent sembler longs.
- Une seule fin heureuse. Retourner au pays ou devenir bénévole à son tour ne sont pas implémentés.
- Les musiques pèsent 14 Mo, ce qui est lourd pour un premier chargement en ligne.
- Les textes dessinés sur la carte (« 150 € pour louer », « Récépissé requis ») restent affichés quand ils ne s'appliquent plus.
- Pas de vraie version téléphone : le bandeau est haut, les ronds de la carte sont petits au doigt (prévue plus tard).
- Les images mélangent photos et dessins, mais toutes les images prévues (avatars, médaillons d'événements) sont maintenant en place.
- L'équilibrage (bazar, agressions, personnages) n'a pas encore été éprouvé par de vraies parties complètes.
- Aucun test automatisé dans le dépôt : la validation se fait à la main dans le navigateur.

**Pistes d'évolution déjà identifiées**

Donner de vraies différences aux couleurs (prix, difficulté administrative, événements) · plusieurs fins · un écran d'introduction et un tutoriel · un tableau des scores · un nouveau lieu sur le rond vert libre de la carte (gare, commissariat, tribunal) · la version téléphone · compléter les images (§12 bis).

---

## 14. Comment reprendre le projet

1. Ouvrir `index.html` dans un navigateur : il n'y a rien à installer (les 4 fichiers — `index.html`, `style.css`, `data.js`, `game.js` — doivent rester ensemble dans le même dossier).
2. Pour ajouter du contenu, modifier `PLACES`, `ITEMS`, `EVENTS` ou `PNJ` dans **`data.js`** (§12). Pour une image, la déposer dans `images/` et ajouter `img` à l'élément (§12 bis).
3. Pour rééquilibrer, les chiffres sont tous dans les `fn` des actions (`data.js`) et dans la formule de la préfecture (§7).
4. Après modification, vérifier la syntaxe puis faire une journée complète dans le navigateur — dont une nuit, un événement à choix et une fin de partie. Pour que les images se chargent, ouvrir le jeu via un petit serveur local (`python -m http.server`) plutôt qu'en double-clic si le navigateur bloque les fichiers locaux.
