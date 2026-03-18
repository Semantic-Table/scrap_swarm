# Scrap Swarm

Survivor-like top-down où le joueur est un noyau mécanique qui survit à des vagues d'ennemis en construisant automatiquement des tourelles à partir de la ferraille récupérée. Voir `gdd.md` pour le game design complet.

## Stack

- TypeScript + PixiJS 8
- Vite (bundler/dev server)
- Textures 100% procédurales (pas d'assets image)

## Architecture : ECS (Entity Component System)

Le projet suit une architecture ECS stricte :

- **Entity** = un simple ID numérique
- **Component** = données pures (struct), pas de logique. Chaque component a un champ `type` discriminant
- **System** = logique pure qui query les entités par composants et les met à jour
- **World** = registre central (entités, composants, systèmes)

### Règles ECS

- Toute nouvelle feature passe par des composants (data) + systèmes (logique)
- Un système ne modifie jamais de composants qu'il ne query pas
- L'ordre des systèmes dans `Game.registerSystems()` est critique — le commenter
- Le rendering (PixiJS Graphics) est séparé de la logique via le couple Sprite component + RenderSystem

## Structure du projet

```
src/
  ecs/          # Core ECS : World, types (Entity, Component, System)
  components/   # Données pures : Transform, Velocity, Sprite, Collider, Tags...
  systems/      # Logique : Input, Movement, Spawn, EnemyAI, Shoot, Collision, Render...
  core/         # Game (orchestration), Input (état clavier)
  config/       # Constantes de gameplay (vitesses, tailles, couleurs, cooldowns)
```

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
- Quand une entité est détruite, toujours cleanup le Graphics PixiJS (`stage.removeChild` + `graphic.destroy()`)
