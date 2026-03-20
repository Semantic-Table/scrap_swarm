# Scrap Swarm

Survivor-like top-down où le joueur est un noyau mécanique qui survit 10 minutes en récupérant de la ferraille pour upgrader ses armes. Voir `gdd.md` pour le game design complet.

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

## Règles de code

### Pas de setTimeout/setInterval dans la game loop

Les effets différés (slashes multiples, chaînes tesla, ondes de pulse) utilisent des **tableaux de pending actions** gérés dans `update(dt)`, jamais `setTimeout`. Les `setTimeout` :
- Ignorent le hit-stop et la pause
- Persistent après un restart (ghost callbacks sur un World détruit)
- Ne sont pas testables

Pattern correct :
```typescript
private pendingActions: Array<{ delay: number; /* params */ }> = [];

update(dt: number): void {
  for (let i = this.pendingActions.length - 1; i >= 0; i--) {
    this.pendingActions[i].delay -= dt;
    if (this.pendingActions[i].delay <= 0) {
      const action = this.pendingActions.splice(i, 1)[0];
      this.executeAction(action);
    }
  }
  // ... rest of update
}
```

### Pas de requestAnimationFrame dans les systèmes

Les effets visuels temporaires (slash arc, pulse ring, lightning) sont gérés par le ticker PixiJS ou par des tableaux d'effets actifs dans les systèmes, pas par des boucles rAF indépendantes. Les rAF :
- Ne respectent pas le time scale du jeu
- Créent des closures qui capturent des références au World
- Persistent après un restart

Exception : `Particles.ts` utilise encore rAF pour les particules (à migrer vers un système poolé).

### Constantes dans config/constants.ts

Aucun magic number dans les systèmes. Toute valeur de gameplay (vitesse, taille, cooldown, couleur, chance de drop) a une constante nommée dans `config/constants.ts`.

### Kill toujours via Combat.ts

Ne jamais détruire un ennemi directement avec `destroyEntity()`. Toujours passer par `killEnemy()` ou `damageEnemy()` de `Combat.ts` pour garantir : scrap drop, particules, screen shake, tracking des kills.

### Passifs via helpers centralisés

Les bonus passifs (Puissance, Célérité, Portée, Quantité) sont lus via les helpers de `UpgradeEffects.ts` :
- `getBonusDamage(world)` — dégâts additionnels
- `getCooldownMult(world)` — multiplicateur de cooldown (< 1)
- `getRangeMult(world)` — multiplicateur de portée (> 1)
- `getQuantityBonus(world)` — nombre d'effets supplémentaires

Chaque nouveau système d'arme DOIT appeler ces 4 helpers.

### Cleanup PixiJS

Quand une entité est détruite : `graphic.removeFromParent()` + `graphic.destroy()`. Ne pas appeler `stage.removeChild()` directement — utiliser `removeFromParent()` qui fonctionne quel que soit le parent.

### Lire avant de détruire

Toujours lire les composants d'une entité AVANT d'appeler `destroyEntity()`. Après la destruction, `getComponent()` retourne `undefined`.

### UI en anglais

Le jeu cible CrazyGames (audience internationale). Tout le texte visible par le joueur doit être en anglais. Les commentaires de code peuvent être en français.

### Mobile-first

Tout input (title screen, upgrade selection, restart) doit fonctionner au clavier ET au touch/pointer. Utiliser `pointerdown`/`pointertap` en plus des listeners `keydown`.

### Pas d'allocation dans les hot loops

- Réutiliser les Maps/Arrays au lieu d'en créer chaque frame (ex: grille spatiale)
- Pas de `{ x, y }` literals retournés depuis des fonctions appelées chaque frame — utiliser des champs d'instance
- Pas de `.map()` / `.filter()` sur des arrays chaque frame quand un for loop suffit

## Conventions

- Chaque composant a une factory function `createX()` et une interface exportée
- Chaque système implémente l'interface `System { name: string; update(dt: number): void }`
- Les tourelles ne sont obtenues que via le système d'upgrades (pas d'auto-build)
- Les effets de Quantité sont purement dynamiques (lus chaque frame), pas des effets one-shot
