# Migrator — spécification complète du jeu

> Document de référence destiné à être lu par un humain ou par une IA qui reprend le projet.
> Il décrit **l'intégralité** des règles, des chiffres et de l'architecture du code, à jour du fichier `index.html` (~730 lignes).

---

## 1. Ce qu'est le jeu

Migrator est un jeu de gestion narratif, en français, où l'on incarne une personne qui vient d'arriver dans une ville étrangère et cherche à obtenir un titre de séjour. On joue jour par jour : on se déplace sur une carte de la ville et on choisit des actions qui consomment du temps, de l'argent, de la santé et du moral.

Le sujet est social et volontairement réaliste : la lenteur administrative, la précarité, le travail non déclaré, la solidarité associative. **Le jeu n'encourage pas les activités illégales qu'il représente** : elles rapportent peu et font reculer l'objectif principal.

Public visé : des amis de l'auteur, sur navigateur, en quelques minutes de partie.

---

## 2. Technique

| Point | Valeur |
| --- | --- |
| Fichier de jeu | `index.html`, **un seul fichier**, HTML + CSS + JavaScript inclus |
| Dépendances | **aucune** — pas de framework, pas de build, pas de serveur |
| Lancement | double-clic sur `index.html`, ou n'importe quel hébergement statique |
| Assets | `fonds/` (6 images), `perso/` (3 images), `musique/` (3 MP3, ~14 Mo) |
| Persistance | `localStorage`, clé `migrator-save` |
| Sons d'action | générés à la volée via l'API Web Audio — aucun fichier son |
| Dépôt | https://github.com/ikono85/Migrator |

Contraintes à respecter si on modifie le projet : **rester en un seul fichier sans dépendance**, garder tous les textes en français, et conserver le ton sobre (pas d'humour sur la situation décrite).

---

## 3. Écran d'accueil

L'utilisateur saisit un prénom (2 à 16 lettres, validé par `/^[\p{L} \-']{2,16}$/u`) et choisit une couleur parmi trois. La couleur n'est pas qu'un habillage : elle détermine l'avatar, le fond d'écran d'accueil, le fond de partie et la musique de fond.

| Couleur | Avatar | Fond accueil | Fond partie | Musique |
| --- | --- | --- | --- | --- |
| `#111111` noir | `perso/14.png` | `geo12ouvkibera-retoucheok.webp` | `rue-noir.jpg` | `noir.mp3` |
| `#facc15` jaune | `perso/rond jaune.webp` | `riziere-bali-indonesie.avif` | `rue-jaune.webp` | `jaune.mp3` |
| `#7b4a2a` marron | `perso/8e1c…webp` | `683466.ori.jpg` | `souk-marron.jpg` | `marron.mp3` |

Aucune différence de règles entre les couleurs à ce jour : c'est un axe d'évolution prévu (prix, difficulté et événements propres à chaque « pays »).

Un bouton **▶ Continuer** apparaît sous « Commencer » si une sauvegarde existe.

---

## 4. L'état de la partie

Tout l'état tient dans un seul objet `s`, ce qui rend la sauvegarde triviale :

```js
const s = { sante: 70, moral: 50, argent: 50, langue: 1, papiers: 0, reseau: 0,
            tel: 40, jour: 1, heure: 8, pos: 0, bonus: 0,
            appart: false, diplome: false, clopes: 0, chaud: 0,
            dette: 0, echeance: 0 };
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
| `pos` | index du lieu dans `PLACES` | 0–14 |
| `bonus` | bonus cumulé au prochain dossier | remis à 0 après chaque tentative |
| `appart` | appartement loué | booléen |
| `diplome` | diplôme de langue obtenu | booléen |
| `clopes` | paquets de cigarettes en stock | entier |
| `chaud` | à quel point la police t'a repéré | descend de 1 chaque nuit |
| `dette` | euros dus à un usurier | l'échéance tombe tous les 2 jours |
| `echeance` | jour de la prochaine visite de l'usurier | 0 si aucune dette |
| `prefJour` | jour de la dernière visite à la préfecture | limite à 1 par jour |
| `fiche` | jour de la dernière fiche de paie demandée | limite à 1 par jour |

`PAPIERS = ['Aucun', 'Dossier déposé', 'Récépissé', 'Titre de séjour']`

Variables hors de `s` : `name`, `color`, `over` (partie terminée), `moving` (déplacement en cours), `refus` (l'action vient d'être refusée, donc l'heure n'avance pas).

---

## 5. Le temps

- Une journée va de **8 h à 23 h** (`FIN_JOURNEE = 23`).
- **Se déplacer coûte 1 h**, quelle que soit la distance.
- **Chaque action coûte son propre nombre d'heures** (`d`), de 1 à 6 h. Dormir a `d: 0` car la nuit fait passer au jour suivant.
- Chaque lieu a des horaires `o` (ouverture) et `f` (fermeture). On ne peut pas s'y rendre en dehors, et un lieu fermé s'affiche grisé.
- Une action est **désactivée** (bouton gris) si elle ne peut pas se terminer avant 23 h ou avant la fermeture du lieu.
- Exception anti-blocage : les **abris** (`ABRIS = ['foyer', 'squat', 'pont']`, plus son propre appartement) restent accessibles à toute heure, pour qu'on puisse toujours aller dormir quelque part.
- Visuellement, la carte s'assombrit à partir de 18 h (`opacity = (heure - 17) × 0.11`, plafonnée à 0.65) et l'icône à côté de l'heure suit le moment de la journée : 🌅 avant 12 h, ☀️ avant 18 h, 🌇 avant 21 h, 🌙 ensuite.

**La nuit** passe par la fonction commune `nuit(fx)` : `jour + 1`, `heure = 8`, puis les effets propres au lieu où l'on dort (`fx`), puis `chaud - 1`, le passage de l'usurier (§9) et enfin `randomEvent()`. Si l'argent devient négatif, il est ramené à 0 puis **−10 santé et −10 moral** (« Pas assez pour manger »).

Il y a **quatre endroits où dormir**, du plus sûr au plus dur :

| Lieu | Coût | Effet | Batterie |
| --- | --- | --- | --- |
| 🏠 Chez soi | 15 € | +35 santé, +8 moral | rechargée |
| 🏚️ Foyer | 8 € | +20 santé | rechargée |
| 🏚️ Squat | gratuit | tirage : 50 % +15 santé · 30 % bagarre (−15 santé, −10 moral, −10 €) · 20 % descente de police | rechargée |
| 🛞 Sous le pont | gratuit | −10 santé, −8 moral | **non rechargée** |

---

## 6. La carte

Une grille de 15 lieux (4 colonnes × 4 rangées, la 16ᵉ case étant occupée par un parc vert décoratif) reliés par des routes dessinées en CSS. Le pion du joueur est un rond à sa couleur qui glisse jusqu'au lieu cliqué en 0,5 s.

```
🏚️ Foyer       🏫 École         📚 Bibliothèque  🏛️ Préfecture
🏠 Appartement 🕌 Lieu de culte 🏥 Hôpital       🏭 Usine
🛒 Marché      🤝 Association   📞 Parc (wifi)   🚬 Coin de rue
🏚️ Squat       🛞 Sous le pont  🍺 Bar           🌳 (parc)
```

Les rangées se lisent comme une descente sociale : en haut les institutions, au milieu les ressources, en bas la survie.

Deux lieux sont **verrouillés** au départ :

- 🏭 **Usine** — exige `papiers >= 2` (le récépissé).
- 🏠 **Appartement** — verrouillé tant que `!appart && argent < 150`.

**Boucle de jeu** : cliquer un lieu → le pion s'y déplace (1 h) → les actions de ce lieu s'affichent en boutons sous la carte → on en choisit autant qu'on veut tant que le temps et les horaires le permettent → on repart ailleurs, ou on rentre dormir.

---

## 7. Les 46 actions, lieu par lieu

`d` = durée en heures. Les gains aléatoires sont notés `a–b`.

### 🏚️ Foyer — ouvert 24 h/24

| Action | d | Effet |
| --- | --- | --- |
| 😴 Dormir | — | la nuit (voir §5) |
| 🍜 Repas du foyer | 1 | −3 € · +8 santé · +2 moral |
| 🚿 Douche et lessive | 1 | +3 santé · +6 moral |
| 💬 Discuter avec les autres | 1 | +4 moral · 35 % de chance de +1 réseau |

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
| ❓ Se renseigner au guichet | 1 | −2 moral · **+10 %** au prochain dossier |
| ⚖️ Consulter un avocat | 2 | −40 € · +5 moral · **+25 %** au prochain dossier |

**Formule d'avancée du dossier** — c'est le cœur du jeu :

```js
chance = 0.05                 // socle
       + langue × 0.025       // parler la langue aide
       + reseau × 0.02        // connaître du monde aide
       - papiers × 0.04       // chaque étape est plus dure que la précédente
       + (diplome ? 0.10 : 0) // permanent
       + bonus;               // justificatifs accumulés, consommé après la tentative
```

Réussite → `papiers + 1`, +15 moral. Échec → −8 moral. `bonus` est remis à 0 dans les deux cas.

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
| 🍲 Aider au repas solidaire | 3 | +1 réseau · +8 moral · +6 santé |

### 🏥 Hôpital — 24 h/24

| Action | d | Effet |
| --- | --- | --- |
| 💊 Consulter un médecin | 2 | −20 € · +30 santé |
| 🚑 Attendre aux urgences | 5 | gratuit · +22 santé · −8 moral |
| 🩺 Faire un bilan de santé | 2 | −10 € · +10 santé · **+5 %** au prochain dossier |

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
| ☕ Rencontrer les bénévoles | 2 | +1 réseau · +6 moral · +5 santé |
| 🗂️ Aide pour ton dossier | 2 | +4 moral · **+15 %** au prochain dossier |
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
| 📦 Acheter un paquet au noir | 1 | −6 € · `clopes + 1` |
| 🕶️ Faire le guet | 3 | +15 à 25 € · −6 moral · `chaud + 2` · risque de base **22 %** |
| 💸 Demander un dépannage rapide | 1 | +30 € tout de suite · **+50 € de dette** (§9) |

**Le contrôle de police** (`police(base)`), commun à ces actions :

```js
risque = base + chaud × 0.04
```

Si le contrôle tombe : amende de 10 à 20 € (plafonnée à l'argent disponible), −12 moral, **stock saisi**, `chaud` remis à 0, et **30 % de chance de perdre une étape de papiers** si on en avait au moins une. L'action est perdue mais le temps est quand même consommé.

Intention de game design : c'est un **filet de sécurité quand on n'a plus rien**, pas une stratégie gagnante. Ça rapporte environ 5,5 € pour 2 h — moins que le marché — et ça met en danger l'objectif du jeu.

### 🏚️ Squat — 24 h/24

| Action | d | Effet |
| --- | --- | --- |
| 😴 Squatter pour la nuit | — | gratuit, batterie rechargée, tirage décrit au §5 |
| 🔦 Chercher des objets | 2 | 40 % : +5 à 15 € · 10 % : −8 santé · 50 % : rien |

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

Le bar affiche « 16 h – 2 h » sur la carte pour l'ambiance, mais techniquement il est déclaré `o: 16, f: 24` : comme la journée s'arrête à 23 h, la fenêtre réelle est 16 h → 23 h.

---

## 8. Les événements aléatoires

Au réveil, une fois sur deux (`Math.random() > 0.5 → aucun événement`), un événement est tiré dans la liste `EVENTS`, qui en compte **13**.

**Événements immédiats** : repas offert par un bénévole (+10 santé, +5 moral) · téléphone volé (batterie à 0, −15 moral) · loyer réclamé (−20 €) · billet de 10 € trouvé · nuit glaciale (−12 santé) · un voisin t'apprend des mots (+1 langue).

**Événements à choix**, qui ouvrent une fenêtre modale bloquante :

| Situation | Option A | Option B |
| --- | --- | --- |
| Travail au noir à 60 € | Accepter : 35 % de contrôle (−25 moral, −1 papier), sinon +60 € et −15 santé | Refuser : +2 moral |
| Un migrant affamé demande de l'aide | Partager 10 € : +1 réseau, +10 moral | Passer : −5 moral |
| Contrôle d'identité dans la rue | Montrer ses papiers : sans effet si `papiers ≥ 2`, sinon −15 moral et −5 santé | Courir : 50 % −10 santé, sinon −25 moral et −1 papier |
| La famille a besoin d'argent | Envoyer 25 € : +12 moral | Garder : −10 moral |
| Un habitué demande de garder son sac | Accepter : 50 % +10 € et +1 réseau, sinon contrôle de police garanti et `chaud + 3` | Refuser : −5 moral, il t'insulte |
| Le gardien fouille tes affaires | Baisser la tête : −12 moral | Rétorquer : +5 moral, puis −10 € si tu les as, sinon dehors pour la nuit (−10 santé, −10 moral) |
| Un habitué demande ton téléphone | Prêter : 60 % batterie à zéro, 40 % téléphone perdu (jusqu'à −30 € et −10 moral) | Refuser : −5 moral |

---

## 9. La dette et l'usurier

Une soupape de dernier recours, disponible au 🍺 bar et au 🚬 coin de rue : **Demander un dépannage rapide** donne **+30 € immédiatement** et inscrit **+50 € de dette**. L'échéance est fixée à `jour + 2`.

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

Conséquences de design : emprunter 30 € coûte 50 €, et ne pas pouvoir rembourser fait **−20 santé tous les deux jours**, ce qui peut tuer le personnage. Emprunter plusieurs fois cumule les dettes. La dette s'affiche dans les statistiques avec le jour de la prochaine échéance.

---

## 10. Les fins

Vérifiées dans `endTurn()`, dans cet ordre :

| Condition | Écran | Sens |
| --- | --- | --- |
| `sante <= 0` | **MORT** (rouge) | emmené aux urgences |
| `moral <= 0` | **ABANDON** (gris) | retour au pays |
| `papiers >= 3` | **VICTOIRE** (verte) | titre de séjour obtenu en N jours |

Dans les trois cas la sauvegarde est effacée et la musique s'arrête. Le seul bouton proposé est « Rejouer », qui recharge la page.

---

## 11. La sauvegarde

Sauvegarde automatique à la fin de chaque tour, dans `localStorage` sous `migrator-save`. Elle contient `s`, le prénom, la couleur et le HTML du journal. Tout est enveloppé dans des `try/catch` car certains contextes bloquent le stockage. Elle est locale à un navigateur : elle ne suit pas l'utilisateur d'une machine à l'autre.

---

## 12. Architecture du code

L'ordre du fichier `index.html` :

1. `<style>` — toute la CSS, y compris la carte, le panneau d'actions et le mode nuit
2. Le balisage : écran d'accueil `#start`, jeu `#game` (carte `#map` + panneau `#actions` + journal `#log`), écran de fin `#dead`, modale d'événement `#choice`
3. `COLORS`, `AVATAR`, `BG`, `GAME_BG`, `MUSIC` — tout ce qui dépend de la couleur choisie
4. `s`, `PAPIERS`, `name` — l'état
5. `sfx()` — sons générés par oscillateurs Web Audio
6. `EVENTS`, `randomEvent()`, `askChoice()`
7. `endScreen()`
8. **Les aides d'écriture des actions** : `non()`, `cout()`, `gagneLangue()`, `police()`, `depannage`, `atout()`
9. `PLACES` — **toute la donnée du jeu**, chaque lieu portant son tableau `acts`
10. `goTo()`, `doAct()`, `renderPanel()`, `nuit()`, `dormir()`, `usurier()`
11. `endTurn()`, sauvegarde, `render()`, `log()`

**Le point important pour qui modifie le jeu** : le contenu est entièrement déclaratif dans `PLACES`. Ajouter un lieu ou une action ne demande de toucher à aucune mécanique — il suffit d'ajouter un objet. Un lieu s'écrit :

```js
{ a: 'identifiant', ico: '🏥', nom: 'Nom affiché', x: 63, y: 50, o: 0, f: 24,
  lock: () => condition, lockTxt: 'Raison du cadenas',
  acts: [
    { ico: '💊', nom: 'Libellé du bouton', d: 2, info: 'coût · effet',
      hide: () => condition,        // facultatif : masque l'action
      fn: () => { /* effets */ } }
  ]}
```

Dans un `fn` : `cout(n)` retire l'argent ou refuse, `non(texte)` refuse l'action **sans consommer d'heures**, `log(texte)` écrit au journal, `sfx(type)` joue un son (`coin`, `good`, `bad`, `ring`, `sleep`, `event`, `win`, `lose`), `police(risque)` déclenche un contrôle et renvoie `true` si le joueur s'est fait prendre, `atout(part, texte)` ajoute un bonus au prochain dossier, `nuit(fx)` fait passer la nuit avec les effets `fx`.

Champs facultatifs d'un lieu : `lock`/`lockTxt` (cadenas), `txt` (horaires affichés à la place des horaires réels). Champ facultatif d'une action : `hide` (la masque au lieu de la griser).

⚠️ Les index de `PLACES` sont stockés dans les sauvegardes via `s.pos` : **ajouter un lieu à la fin** plutôt qu'au milieu, sinon les parties sauvegardées reprennent au mauvais endroit.

---

## 13. Audit — état des lieux

**Ce qui est solide**

- Séparation nette entre le moteur et le contenu : tout le jeu se modifie dans `PLACES`.
- Aucune dépendance, un seul fichier : rien ne peut casser à cause d'une bibliothèque.
- Pas d'impasse possible : le retour au foyer est autorisé à toute heure, et dormir ne demande rien.
- Toutes les actions passent par les mêmes contrôles de temps et d'horaires, donc une nouvelle action hérite automatiquement des bonnes règles.
- Testé par 400 actions aléatoires enchaînées sur 67 jours, dettes et contrôles de police compris, sans erreur JavaScript.
- Trois niveaux de précarité pour la nuit (chez soi, foyer, squat, dehors) : le joueur qui n'a plus rien a toujours une option, mais elle abîme.

**Limites connues**

- Les trois couleurs sont purement cosmétiques : aucune différence de règles, alors que la structure s'y prête.
- L'échec est plus probable que la réussite au début : avec langue 1 et réseau 0, une visite à la préfecture réussit à 7,5 %. C'est voulu, mais les premiers jours peuvent sembler longs.
- Aucun personnage récurrent : les événements sont anonymes et sans mémoire.
- Une seule fin heureuse. Retourner au pays ou devenir bénévole à son tour ne sont pas implémentés.
- Les musiques pèsent 14 Mo, ce qui est lourd pour un premier chargement en ligne.
- Le pion masque légèrement le nom du lieu où il se trouve.
- La carte à 15 lieux devient haute sur un téléphone : il faut faire défiler pour voir la dernière rangée.
- Le bar est annoncé ouvert jusqu'à 2 h alors que la journée s'arrête à 23 h : c'est un écart assumé entre le texte et la règle.
- Rien n'empêche d'emprunter en boucle : les dettes se cumulent sans plafond, ce qui peut mener à une spirale irrattrapable — voulu, mais brutal.
- Aucun test automatisé dans le dépôt : la validation se fait à la main dans le navigateur.

**Pistes d'évolution déjà identifiées**

Donner de vraies différences aux couleurs (prix, difficulté administrative, événements) · des personnages récurrents qui se souviennent des choix · plusieurs fins · un écran d'introduction et un tutoriel · un tableau des scores · de nouveaux lieux (gare, commissariat, tribunal) · la mise en ligne via GitHub Pages.

---

## 14. Comment reprendre le projet

1. Ouvrir `index.html` dans un navigateur : il n'y a rien à installer.
2. Pour ajouter du contenu, modifier le tableau `PLACES` (§11).
3. Pour rééquilibrer, les chiffres sont tous dans les `fn` des actions et dans la formule de la préfecture (§7).
4. Après modification, vérifier la syntaxe puis faire une journée complète dans le navigateur — dont une nuit, un événement à choix et une fin de partie.
