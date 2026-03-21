# Scrap Swarm — TODO

## Done ✅

### Core
- [x] ECS architecture, camera, spawn par packs, 5 types d'ennemis
- [x] 12 armes (sword, turret, tesla, pulse, boomerang, mine, laser, aura, ricochet, gravity, chainsaw, sentry)
- [x] 12 passifs (magnet, refiner, shield, booster, might, swiftness, reach, multi, luck, armor, regen, crit)
- [x] 13 évolutions d'armes (toutes implémentées)
- [x] 3 act difficulty curve + horde events
- [x] 3 bosses (Colossus, Broadcaster, Swarm Queen)
- [x] Scrap Caches + Power Crates (magnetite, overclock, repair)
- [x] Player HP (5), shield layers, invincibility frames
- [x] Health pickups, destructible props
- [x] 10 min session, victory/game over

### Meta
- [x] Garage (13 permanent upgrades, Cogs currency)
- [x] Codex (bestiary, items+evolutions, 15 achievements)
- [x] Best score localStorage
- [x] Build summary on death screen

### UX
- [x] Title overlay (auto-dismiss 3s, game starts immediately)
- [x] Touch/mobile joystick
- [x] Responsive upgrade cards
- [x] A/D navigation + activation delay
- [x] ESC pause + codex in-game
- [x] F1 debug panel
- [x] Visibility pause + dt cap

### Juice
- [x] Screen shake, hit-stop, death particles (enemy colored), kill flash, tank shockwave
- [x] Scrap pickup burst, magnetic snap, scrap spin
- [x] Enemy wobble, spawn-in scale pop, hit scale-pop
- [x] Player rotating ring, idle breathe, directional arrow, core glow by HP
- [x] Low-HP vignette, camera lerp, background shudder
- [x] XP bar sparks on level up, evolution burst celebration
- [x] Horde "HORDE!" announcement
- [x] Procedural audio (10 SFX + music loop + evolution sound)

---

## À faire pour publication CrazyGames 🎯

### P0 — Bloquants

- [ ] **Équilibrage complet** — tester chaque arme, chaque évolution, chaque passif. Ajuster les dégâts, cooldowns, et scaling par level pour les 8 nouvelles armes
- [x] **Tutoriel contextuel** — "WASD to move" (1s), "Attacks are automatic" (4s), "Collect scrap to level up" (8s). Première run uniquement
- [x] **Sons des nouvelles armes** — boomerang whoosh, mine explosion, laser beam sweep, aura tick, ricochet ping, gravity hum, chainsaw buzz, sentry deploy. Tous throttled pour éviter le spam
- [x] **PulseSystem drawPulse()** — migré de rAF vers activeRings[] ticker-driven
- [x] **Particles.ts** — migré vers pool ticker-driven (0 rAF). `updateParticles(dt)` + `clearParticles()` appelés depuis Game.ts
- [x] **DEBUG_SCRAP_MULT** — retiré du codebase
- [x] **Restart singletons** — ScreenShake, HitStop, Audio, Particles tous reset proprement

### P1 — Important

- [ ] **CrazyGames SDK** — intégrer les ads (interstitiel entre les runs dans le Garage, rewarded ad pour +HP sur le death screen)
- [x] **Spawn weights par type** — basic 30%, runner 25%, swarm 20%, tank 15%, shooter 10%
- [x] **Damage numbers flottants** — "+N" float sur les hits ≥ 2 dégâts, coloré par type d'ennemi
- [x] **Barres de vie sur les ennemis multi-HP** — 2px rouge au-dessus, visible quand blessé
- [x] **Boss HP bar dans le HUD** — barre rouge 50% width avec nom du boss (COLOSSUS/BROADCASTER/SWARM QUEEN)
- [x] **Veteran Core garage upgrade** — applique un upgrade aléatoire silencieusement au début du run
- [x] **Indicateurs off-screen** — flèches rouges (bosses) et dorées (caches) au bord de l'écran, max 4

### P2 — Polish

- [x] **Descriptions d'upgrade en anglais** — tous les noms et descriptions traduits
- [x] **Musique qui s'intensifie par acte** — Level 1 baseline, Level 2 +3dB, Level 3 +6dB + 145 BPM
- [x] **Screenshake sur pickup de power crate** — triggerShake(4, 0.1) au pickup
- [x] **Animation de la Swarm Queen** — scale pulse sin(3Hz) ±8% + particules vertes 1-2/s
- [x] **Queen death message** — "The Swarm Queen has fallen!" (vert) ou "The Swarm Queen survived..." (rouge)
- [x] **Transition visuelle entre les actes** — "ACT 2" / "ACT 3" annonce + shake
- [x] **Tableau des scores** — top 3 runs affichés sur le title overlay + top 5 en localStorage
- [x] **Bouton mute** — icône speaker en haut à droite, click/tap toggle mute
- [x] **Performance** — Particles.ts 100% ticker-driven, 0 rAF, pool + clearParticles au restart

### P3 — Nice to have

- [ ] **Environmental hazards** — oil slicks (ralentissent), lava vents (dégâts zone)
- [ ] **Facing indicator pour le laser/chainsaw** — ces armes dépendent de l'orientation
- [ ] **Speed lines** derrière le joueur quand il bouge vite
- [ ] **Off-screen danger arrows** pour les tanks et shooters
- [ ] **Cosmétiques** dans le Garage (couleurs de joueur, trail effects)
- [ ] **2ème arme de départ sélectionnable** (weapon select avant le run si Protocol acheté)
