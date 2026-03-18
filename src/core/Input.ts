/** Centralized keyboard state */
export class Input {
  private keys = new Set<string>();

  constructor() {
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }
}
