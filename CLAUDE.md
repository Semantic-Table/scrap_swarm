# Scrap Swarm

Survivor-like top-down où le joueur est un noyau mécanique qui survit 15 minutes en récupérant de la ferraille pour upgrader ses armes. Voir `gdd.md` pour le game design complet.

## Stack

- TypeScript + PixiJS 8
- Vite (bundler/dev server)
- Textures 100% procédurales (pas d'assets image)

## Architecture : ECS (Entity Component System)

Le projet suit une architecture ECS stricte :

- **Entity** = un simple ID numérique
- **Component** = données pures (struct), pas de logique. Chaque component a un champ `type` discriminant
- **System** = logique pure qui query les entités par composants et les met à jour
- **World** = registre central (entités, composants, systèmes) avec query cache

### Règles ECS

- Toute nouvelle feature passe par des composants (data) + systèmes (logique)
- Un système ne modifie jamais de composants qu'il ne query pas
- L'ordre des systèmes dans `Game.registerSystems()` est critique — le commenter
- Le rendering (PixiJS) est séparé de la logique via le couple Sprite component + RenderSystem

## Structure du projet

```
src/
  ecs/          # Core ECS : World (avec query cache), types (Entity, Component, System)
  components/   # Données pures : Transform, Velocity, Sprite, Collider, Health, Tags...
  systems/      # Logique : Input, Movement, Spawn, EnemyAI, Sword, Collision, Render, Camera...
  core/         # Game (orchestration), Input, Combat (kill partagé), Particles, ScreenShake, HitStop, UpgradeManager/UI/Effects
  config/       # Constantes de gameplay (vitesses, tailles, couleurs, cooldowns)
```

## Architecture rendering

- **gameContainer** : Container PixiJS qui contient toutes les entités de jeu (ennemis, joueur, projectiles, scrap)
- **CameraSystem** : translate gameContainer pour centrer le viewport sur le joueur + screen shake
- **Background** : TilingSprite avec texture procédurale (grille industrielle), scroll avec la caméra
- **hudLayer** / **upgradeUI** : enfants directs de `app.stage`, fixes à l'écran (pas affectés par la caméra)
- Les systèmes reçoivent `stage: Container` (= gameContainer) pour ajouter des graphics, et utilisent `removeFromParent()` pour les retirer

## Modules partagés (core/)

- **Combat.ts** : `damageEnemy()` et `killEnemy()` — logique de kill unifiée (scrap drop, particules, shake, hit-stop, cleanup). Utilisé par tous les systèmes de combat
- **Particles.ts** : `spawnDeathParticles()`, `spawnKillFlash()`, `spawnPickupBurst()`, `registerKill()` (multi-kill tracker)
- **ScreenShake.ts** : `triggerShake(intensity, duration)` — état partagé lu par CameraSystem
- **HitStop.ts** : `triggerHitStop(duration, scale)` — ralenti temporaire lu par le ticker Game

## Commandes

- `npm run dev` — dev server (Vite)
- `npm run build` — build production (tsc + Vite)
- `npx tsc --noEmit` — type check sans build

## Contraintes TypeScript

- `erasableSyntaxOnly` est activé : pas de parameter properties (`private x` dans constructor). Déclarer les champs explicitement
- `strict: true`, `noUnusedLocals`, `noUnusedParameters`

## Conventions

- Chaque composant a une factory function `createX()` et une interface exportée
- Chaque système implémente l'interface `System { name: string; update(dt: number): void }`
- Les constantes de gameplay vont dans `config/constants.ts`, jamais de magic numbers dans les systèmes
- Quand une entité est détruite, toujours cleanup le PixiJS (`graphic.removeFromParent()` + `graphic.destroy()`)
- Les tourelles ne sont obtenues que via le système d'upgrades (pas d'auto-build)
