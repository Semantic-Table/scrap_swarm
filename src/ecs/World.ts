import type { Entity, Component, System } from "./types";

export class World {
  private nextId = 0;
  private entities = new Set<Entity>();
  private components = new Map<string, Map<Entity, Component>>();
  private systems: System[] = [];

  /** Cached query results — invalidated on structural changes */
  private queryCache = new Map<string, Entity[]>();
  private queryCacheDirty = true;

  // --- Entity management ---

  createEntity(): Entity {
    const id = this.nextId++;
    this.entities.add(id);
    this.queryCacheDirty = true;
    return id;
  }

  destroyEntity(entity: Entity): void {
    for (const store of this.components.values()) {
      store.delete(entity);
    }
    this.entities.delete(entity);
    this.queryCacheDirty = true;
  }

  isAlive(entity: Entity): boolean {
    return this.entities.has(entity);
  }

  // --- Component management ---

  addComponent<T extends Component>(entity: Entity, component: T): void {
    let store = this.components.get(component.type);
    if (!store) {
      store = new Map();
      this.components.set(component.type, store);
    }
    store.set(entity, component);
    this.queryCacheDirty = true;
  }

  getComponent<T extends Component>(entity: Entity, type: string): T | undefined {
    return this.components.get(type)?.get(entity) as T | undefined;
  }

  removeComponent(entity: Entity, type: string): void {
    this.components.get(type)?.delete(entity);
    this.queryCacheDirty = true;
  }

  hasComponent(entity: Entity, type: string): boolean {
    return this.components.get(type)?.has(entity) ?? false;
  }

  /**
   * Query all entities that have ALL of the given component types.
   * Results are cached until the next structural change.
   */
  query(componentTypes: string[]): Entity[] {
    const key = componentTypes.join(",");

    if (this.queryCacheDirty) {
      this.queryCache.clear();
      this.queryCacheDirty = false;
    }

    const cached = this.queryCache.get(key);
    if (cached) return cached;

    // Pick the smallest component store as the starting set
    let smallest: Map<Entity, Component> | undefined;
    let smallestSize = Infinity;
    for (const type of componentTypes) {
      const store = this.components.get(type);
      if (!store || store.size === 0) {
        const empty: Entity[] = [];
        this.queryCache.set(key, empty);
        return empty;
      }
      if (store.size < smallestSize) {
        smallestSize = store.size;
        smallest = store;
      }
    }

    const results: Entity[] = [];
    for (const entity of smallest!.keys()) {
      let match = true;
      for (const type of componentTypes) {
        if (!this.hasComponent(entity, type)) {
          match = false;
          break;
        }
      }
      if (match) results.push(entity);
    }

    this.queryCache.set(key, results);
    return results;
  }

  // --- System management ---

  addSystem(system: System): void {
    this.systems.push(system);
  }

  update(dt: number): void {
    for (const system of this.systems) {
      system.update(dt);
    }
  }
}
