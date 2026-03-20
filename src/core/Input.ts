/** Centralized input state — keyboard + touch joystick */
export class Input {
  private keys = new Set<string>();

  /** Touch joystick state — normalized direction [-1, 1] */
  touchDx = 0;
  touchDy = 0;
  isTouching = false;
  readonly isMobile: boolean;

  private joystickBaseX = 0;
  private joystickBaseY = 0;
  private activePointerId = -1;

  constructor() {
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    this.isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (this.isMobile) {
      this.setupTouch();
    }
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  private setupTouch(): void {
    const DEADZONE = 10;
    const MAX_RADIUS = 60;

    window.addEventListener("pointerdown", (e) => {
      // Only track touches in the left half of the screen for movement
      if (e.clientX < window.innerWidth * 0.6 && this.activePointerId === -1) {
        this.activePointerId = e.pointerId;
        this.joystickBaseX = e.clientX;
        this.joystickBaseY = e.clientY;
        this.isTouching = true;
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.activePointerId) return;

      const dx = e.clientX - this.joystickBaseX;
      const dy = e.clientY - this.joystickBaseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < DEADZONE) {
        this.touchDx = 0;
        this.touchDy = 0;
        return;
      }

      const clampedDist = Math.min(dist, MAX_RADIUS);
      this.touchDx = (dx / dist) * (clampedDist / MAX_RADIUS);
      this.touchDy = (dy / dist) * (clampedDist / MAX_RADIUS);
      e.preventDefault();
    }, { passive: false });

    const endTouch = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = -1;
      this.isTouching = false;
      this.touchDx = 0;
      this.touchDy = 0;
    };

    window.addEventListener("pointerup", endTouch);
    window.addEventListener("pointercancel", endTouch);
  }
}
