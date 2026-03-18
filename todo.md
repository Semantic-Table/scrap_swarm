# Scrap Swarm — TODO

## Core Loop

### 1. Ennemis de base
- [x] Spawn d'ennemis hors écran
- [x] Déplacement vers le joueur (EnemyAISystem)
- [x] Collision joueur/ennemi → game over
- [x] Game over + restart (R)

### 2. Tir du joueur
- [x] Auto-tir vers l'ennemi le plus proche (ShootSystem)
- [x] Collision projectile/ennemi → destruction des deux (ProjectileHitSystem)
- [x] Lifetime des projectiles (LifetimeSystem)

### 3. Ferraille (scrap)
- [x] Les ennemis tués droppent de la ferraille
- [x] Ramassage automatique quand le joueur passe dessus (+ effet d'attraction)
- [x] Compteur de ferraille (HUD)

### 4. Tourelles orbitales
- [x] Construction auto quand seuil de ferraille atteint (5 + 3 par tourelle)
- [x] Les tourelles orbitent autour du joueur (redistribution uniforme)
- [x] Les tourelles tirent automatiquement sur les ennemis
- [x] La ferraille finance des tourelles supplémentaires (coût croissant)

### 4a. Types d'ennemis
- [x] Basic — carré rouge, vitesse normale, 1 HP
- [x] Runner — losange orange, rapide, fragile, 1 HP (débloqué vague 3)
- [x] Tank — hexagone violet, lent, 3 HP, drop 3 scraps (débloqué vague 4)
- [x] Swarm — petits cercles verts, spawn en groupe de 4 (débloqué vague 5)
- [x] Système de HP + flash de dégâts
- [x] Vitesse individuelle par type (scalée avec la vague)
- [x] Scrap drop variable selon le type

### 4b. Système d'upgrades
- [x] Level up basé sur le scrap collecté (coût croissant)
- [x] Pause du jeu au level up → choix entre 3 cartes
- [x] UI de sélection (3 cartes avec rareté normal/rare/epic)
- [x] Système d'inventaire (max 6 slots)
- [x] Objets : Tourelle, Tesla (placeholder), Aimant, Rafineur, Bouclier, Booster
- [x] Upgrades avec effets par rareté
- [x] HUD : niveau, scrap/prochain niveau, bouclier
- [ ] Tesla : implémentation gameplay (éclair en chaîne)
- [ ] Équilibrage des coûts de level up et des effets

### 5. Flux continu
- [x] Spawn continu d'ennemis (plus de vagues visibles)
- [x] Densité qui augmente progressivement avec le temps
- [x] Ennemis plus rapides au fil du temps
- [x] HP des ennemis augmente toutes les 3 minutes
- [x] Objectif : survivre 15 minutes
- [x] Timer affiché au centre du HUD (devient doré < 1 min)
- [x] Écran de victoire si 15 min atteintes
- [x] Score = temps survécu

## Polish

### Visuels procéduraux
- [ ] Remplacer les carrés/cercles par des formes procédurales (métal, rouille)
- [ ] Étincelles à chaque impact
- [ ] Particules métalliques à la mort des ennemis
- [ ] Palette sombre + accents orange/jaune

### Feedback & Juice
- [ ] Screen shake aux impacts
- [ ] Flash quand le joueur prend un hit
- [ ] Son procédural (Tone.js ?)
- [ ] Effet d'aspiration de la ferraille vers le joueur

### UX
- [ ] Écran titre
- [ ] Tableau des scores (local)
- [ ] Tutoriel implicite (première vague lente)
