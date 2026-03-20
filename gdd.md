# SCRAP SWARM — Mini GDD

## Concept

Survivor-like top-down où le joueur est un noyau mécanique qui survit à des vagues d'ennemis en récupérant de la ferraille pour débloquer et améliorer ses armes et équipements via un système d'upgrades au level up.

## Core Loop

1. Les ennemis foncent vers le joueur en meutes (spawn par packs)
2. Le joueur se déplace et attaque (épée de base) pour tuer les ennemis
3. Les ennemis tués droppent de la ferraille → XP qui remplit une barre de progression
4. Au level up, choix entre 3 cartes d'upgrade (armes, utilitaires) avec raretés
5. Les armes et tourelles s'améliorent → plus de kills → plus de ferraille → boucle
6. La densité et la difficulté augmentent en 3 actes jusqu'à 10 minutes

## Difficulté — 3 actes + horde events

- **Acte 1 (0–2:30)** : Apprentissage — spawn lent, basics + runners. Le joueur assemble son build.
- **Acte 2 (2:30–7:00)** : Montée — tous les types débloqués, spawn accéléré. Phase de grind.
- **Acte 3 (7:00–10:00)** : Crise — spawn quasi-max, HP ennemis augmentés. Test du build.
- **Horde events** : toutes les 2m30, 8 secondes de spawn ×4 suivies de 12 secondes de calme.

## Armes

| Arme | Description |
|------|-------------|
| **Épée** (départ) | Slash en arc devant le joueur |
| **Tourelle** | Tourelle orbitale qui tire automatiquement |
| **Tesla** | Éclair en chaîne qui saute entre ennemis proches |
| **Onde de choc** | Dégâts en zone autour du joueur |

## Items passifs

| Item | Description |
|------|-------------|
| **Aimant** | Augmente le rayon d'attraction de la ferraille |
| **Rafineur** | Bonus de ferraille par ramassage |
| **Bouclier** | Absorbe un hit, se recharge après un délai |
| **Booster** | Augmente la vitesse de déplacement |
| **Puissance** | +dégâts sur toutes les armes |
| **Célérité** | Réduit le cooldown de toutes les armes |
| **Portée** | Augmente la portée de toutes les armes |
| **Quantité** | +projectiles, rebonds, charges selon l'arme |

## Évolutions d'armes

Quand une arme ET un passif spécifique atteignent tous les deux le **niveau 5**, l'arme évolue en une version drastiquement améliorée avec un gameplay transformé.

| Évolution | Arme lv5 | + Passif lv5 | Effet |
|-----------|----------|-------------|-------|
| **Whirlwind** | Épée | Booster | L'épée devient un spin 360° permanent. Plus besoin de viser — zone de mort rotative autour du joueur. Dégâts réduits mais tick ultra-rapide. |
| **Storm** | Tesla | Portée | Plus de chaîne qui rebondit — un champ électrique permanent qui zap tous les ennemis dans le rayon simultanément. Dégâts par tick réduits mais aucun ennemi n'échappe. |
| **Drone Swarm** | Tourelle | Quantité | Les tourelles quittent leur orbite et deviennent des drones autonomes qui chassent l'ennemi le plus proche. Plus agressif, couvre plus de terrain. Leash pour rester près du joueur. |
| **Nova** | Onde de choc | Puissance | L'onde devient une explosion massive — double rayon, triple dégâts, knockback qui repousse les ennemis. Chaque déclenchement clear la zone. |
| **Counter Strike** | Épée | Bouclier | Chaque hit absorbé par le shield déclenche un slash 360° automatique à double dégâts. Encourage un style tank : prendre des hits volontairement pour DPS. |

Les évolutions créent des **builds distincts** :
- **Speed demon** : Épée + Booster → Whirlwind
- **Zone control** : Tesla + Portée → Storm
- **Chaos** : Tourelle + Quantité → Drone Swarm
- **Nuke** : Pulse + Puissance → Nova
- **Tank** : Épée + Bouclier → Counter Strike

## Types d'ennemis

| Type | Forme | Comportement | HP | Drop |
|------|-------|-------------|-----|------|
| **Basic** | Carré rouge | Fonce vers le joueur | 1 | 1 scrap |
| **Runner** | Losange orange | Rush rapide | 1 | 1 scrap |
| **Tank** | Hexagone violet | Lent, résistant | 3 | 3 scraps |
| **Swarm** | Petits cercles verts | Packs de 12, rush | 1 | 1 scrap |
| **Shooter** | Croix rose | S'arrête à distance, tire | 2 | 2 scraps |

## Méta-progression (localStorage)

- **Bestiaire** : compteur de kills par type d'ennemi, descriptions débloquées
- **Encyclopédie** : items découverts avec descriptions
- **Succès** : 15 achievements (kills, survie, collection, nombre de runs)
- **Best score** : meilleur temps / kills / level

Accessible via le **Codex** (title screen ou Échap en jeu).

## Esthétique

Entièrement procédural — métal, rouille, géométrie industrielle. Ennemis : fill sombre + stroke brillant + détail interne. Joueur : octogone mécanique avec anneau rotatif. Étincelles hot-core (blanc→orange→rouille) à chaque impact. Palette sombre avec accents orange/jaune chaud. Grille industrielle avec rivets en fond.

## Game Feel / Juice

- Screen shake aux impacts (variable : petit pour les kills, gros pour les tanks)
- Hit-stop sur les kills de tanks
- Particules de mort + flash blanc
- Attraction magnétique du scrap (ease-in quadratique + scale up)
- Burst visuel au ramassage du scrap (ring + sparks)
- Wobble sinusoïdal sur les ennemis (swarm organique)
- Barre de progression XP avec lerp smooth + flash au level up
- HP pips en haut à droite du HUD
- Couches de bouclier visuelles autour du joueur

## Session type

10 minutes. Objectif : survivre. Score = temps survécu.

## Cible

CrazyGames — web casual, 35% mobile. Touch + clavier. Sessions 4-8 min moyennes.

## Stack

TypeScript + PixiJS 8, textures 100% procédurales (pas d'assets image).
