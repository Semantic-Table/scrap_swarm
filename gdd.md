# SCRAP SWARM — Mini GDD

## Concept

Survivor-like top-down où le joueur est un noyau mécanique qui survit à des vagues d'ennemis en construisant automatiquement des tourelles à partir de la ferraille récupérée sur les cadavres.

## Core Loop

1. Les ennemis foncent vers le joueur
2. Le joueur se déplace pour éviter et récupère automatiquement la ferraille des ennemis tués
3. La ferraille s'accumule et déclenche la construction automatique de tourelles orbitales autour du joueur
4. Les tourelles tirent automatiquement → tuent des ennemis → plus de ferraille → plus de tourelles
5. Les vagues grossissent jusqu'à la mort inévitable

## Esthétique

Entièrement procédural — métal, rouille, géométrie industrielle. Étincelles et particules métalliques à chaque impact. Palette sombre avec des accents orange/jaune chaud pour les étincelles.

## Session type

2-5 minutes. Score basé sur les vagues survivies.

## Stack

TypeScript + PixiJS, textures 100% procédurales (canvas 2D + shaders simples).
