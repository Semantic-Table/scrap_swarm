# SCRAP SWARM — Mini GDD

## Concept

Survivor-like top-down où le joueur est un noyau mécanique qui survit à des vagues d'ennemis en récupérant de la ferraille pour débloquer et améliorer ses armes et équipements via un système d'upgrades au level up.

## Core Loop

1. Les ennemis foncent vers le joueur en meutes (spawn par packs)
2. Le joueur se déplace et attaque (épée de base) pour tuer les ennemis
3. Les ennemis tués droppent de la ferraille → XP qui remplit une barre de progression
4. Au level up, choix entre 3 cartes d'upgrade (armes, utilitaires) avec raretés
5. Les armes et tourelles s'améliorent → plus de kills → plus de ferraille → boucle
6. La densité et la difficulté augmentent progressivement jusqu'à 15 minutes

## Armes & Items

- **Épée** (arme de départ) — slash en arc devant le joueur
- **Tourelle** — tourelle orbitale qui tire automatiquement (via upgrade)
- **Tesla** — éclair en chaîne entre ennemis proches
- **Onde de choc** — dégâts en zone autour du joueur
- **Aimant** — augmente le rayon d'attraction de la ferraille
- **Rafineur** — bonus de ferraille par ramassage
- **Bouclier** — absorbe un hit, se recharge
- **Booster** — augmente la vitesse de déplacement

## Types d'ennemis

- **Basic** — carré rouge, vitesse normale, 1 HP
- **Runner** — losange orange, rapide, fragile
- **Tank** — hexagone violet, lent, 3 HP, drop 3 scraps
- **Swarm** — petits cercles verts, spawn en groupes de 12, rush rapide
- **Shooter** — croix rose, s'arrête à distance et tire des projectiles

## Esthétique

Entièrement procédural — métal, rouille, géométrie industrielle. Ennemis : fill sombre + stroke brillant + détail interne. Joueur : octogone mécanique avec anneau rotatif. Étincelles hot-core (blanc→orange→rouille) à chaque impact. Palette sombre avec accents orange/jaune chaud. Grille industrielle avec rivets en fond.

## Game Feel / Juice

- Screen shake aux impacts (variable : petit pour les kills, gros pour les tanks)
- Hit-stop sur les kills de tanks et multi-kills (3+ en 400ms)
- Particules de mort avec couleur de l'ennemi + flash blanc
- Attraction magnétique du scrap (ease-in quadratique + scale up)
- Burst visuel au ramassage du scrap (ring + sparks)
- Wobble sinusoïdal sur les ennemis (swarm organique)
- Barre de progression XP avec lerp smooth + flash au level up

## Session type

15 minutes. Objectif : survivre. Score = temps survécu.

## Stack

TypeScript + PixiJS 8, textures 100% procédurales (pas d'assets image).
