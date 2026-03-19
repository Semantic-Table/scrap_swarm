# Scrap Swarm — TODO

## Core Loop

### 1. Ennemis de base
- [x] Spawn d'ennemis hors écran (par packs, relatif au joueur)
- [x] Déplacement vers le joueur (EnemyAISystem + séparation spatiale)
- [x] Collision joueur/ennemi → game over (avec shield absorb)
- [x] Game over + restart (R) → retour écran titre

### 2. Armes du joueur
- [x] Épée (arme de départ) — slash en arc dans la direction du mouvement (SwordSystem)
- [x] Tourelles orbitales — obtenues via upgrades, tirent auto (TurretShootSystem)
- [x] Tesla — éclair en chaîne entre ennemis (TeslaSystem)
- [x] Onde de choc — dégâts en zone autour du joueur (PulseSystem)
- [x] Collision projectile/ennemi (ProjectileHitSystem)
- [x] Lifetime des projectiles (LifetimeSystem)

### 3. Ferraille (scrap)
- [x] Les ennemis tués droppent de la ferraille
- [x] Attraction magnétique (ease-in quadratique + scale up)
- [x] Burst visuel au ramassage (ring + sparks)
- [x] Barre de progression XP (lerp smooth + flash level up)

### 4. Types d'ennemis
- [x] Basic — carré rouge, vitesse normale, 1 HP
- [x] Runner — losange orange, rapide, fragile, 1 HP (débloqué ~1:30)
- [x] Tank — hexagone violet, lent, 3 HP, drop 3 scraps (débloqué ~2:00)
- [x] Swarm — petits cercles verts, spawn en groupe de 12, rapides (débloqué ~2:30)
- [x] Shooter — croix rose, s'arrête à distance et tire (débloqué ~3:00)
- [x] Système de HP + flash de dégâts
- [x] Vitesse individuelle par type (scalée avec la vague, cap 2.2x)
- [x] Scrap drop variable selon le type
- [x] Collision entre ennemis (séparation via grille spatiale)

### 5. Système d'upgrades
- [x] Level up basé sur le scrap collecté (coût croissant)
- [x] Pause du jeu au level up → choix entre 3 cartes
- [x] UI de sélection (3 cartes avec rareté normal/rare/epic)
- [x] Système d'inventaire (max 6 slots)
- [x] Items : Épée, Tourelle, Tesla, Onde de choc, Aimant, Rafineur, Bouclier, Booster
- [x] HUD : barre d'items avec icônes et niveaux

### 6. Flux continu
- [x] Spawn continu par packs (densité croissante)
- [x] Intervalle de spawn : 1.2s → 0.2s
- [x] Ennemis plus rapides au fil du temps (cap 2.2x)
- [x] HP des ennemis augmente toutes les 4.5 minutes
- [x] Objectif : survivre 15 minutes
- [x] Timer affiché (devient doré < 1 min)
- [x] Écran de victoire / game over

### 7. Caméra & monde
- [x] Caméra suit le joueur (CameraSystem)
- [x] Fond grille industrielle (TilingSprite procédural)
- [x] Mouvement libre (pas de bounds)
- [x] Spawn/cleanup relatifs à la position du joueur

## Polish

### Visuels procéduraux
- [x] Ennemis : fill sombre + stroke brillant + détail interne
- [x] Joueur : octogone mécanique + anneau rotatif
- [x] Étincelles hot-core à chaque kill (blanc→orange→rouille + gravité)
- [x] Flash blanc à chaque kill
- [x] Palette sombre + accents orange/jaune
- [x] Size variation ±15% par ennemi
- [x] Wobble sinusoïdal (jitter organique)
- [x] Scrap spin idle

### Feedback & Juice
- [x] Screen shake aux impacts (variable par type)
- [x] Hit-stop sur kills de tanks (80ms quasi-freeze)
- [x] Multi-kill slowmo (3+ kills en 400ms)
- [x] Flash shield quand le joueur absorbe un hit
- [x] Attraction magnétique du scrap (ease-in + scale)
- [x] Burst au ramassage du scrap
- [ ] Son procédural (Tone.js ?)

### UX
- [x] Écran titre (SCRAP SWARM + Enter pour commencer)
- [ ] Tableau des scores (local)
- [ ] Tutoriel implicite (première vague lente)

## À faire

### Gameplay
- [ ] Équilibrage des coûts de level up et des effets de rareté
- [ ] Synergies entre items (Tesla+Pulse, Shield+Sword, etc.)
- [ ] Boss périodique ?

### Polish
- [ ] Son procédural (Tone.js)
- [ ] Damage numbers flottants
- [ ] Barres de vie sur les ennemis multi-HP
- [ ] Tableau des scores local (localStorage)
