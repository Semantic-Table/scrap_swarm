import type { Entity, Component, System } from "./types";

export class World {
  private nextId = 0;
  private entities = new Set<Entity>();
  private components = new Map<string, Map<Entity, Component>>();
  private systems: System[] = [];

  // --- Entity management ---

  createEntity(): Entity {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  destroyEntity(entity: Entity): void {
    for (const store of this.components.values()) {
      store.delete(entity);
    }
    this.entities.delete(entity);
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
  }

  getComponent<T extends Component>(entity: Entity, type: string): T | undefined {
    return this.components.get(type)?.get(entity) as T | undefined;
  }

  removeComponent(entity: Entity, type: string): void {
    this.components.get(type)?.delete(entity);
  }

  hasComponent(entity: Entity, type: string): boolean {
    return this.components.get(type)?.has(entity) ?? false;
  }

  /**
   * Query all entities that have ALL of the given component types.
   * Returns an array of entity IDs.
   */
  query(componentTypes: string[]): Entity[] {
    const results: Entity[] = [];
    for (const entity of this.entities) {
      let match = true;
      for (const type of componentTypes) {
        if (!this.hasComponent(entity, type)) {
          match = false;
          break;
        }
      }
      if (match) results.push(entity);
    }
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
