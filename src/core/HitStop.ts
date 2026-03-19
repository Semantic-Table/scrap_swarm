/** Shared hit-stop state — brief time-slow on heavy kills */
export const hitStop = {
  scale: 1.0,
  timer: 0,
};

export function triggerHitStop(duration = 0.07, scale = 0.05): void {
  if (duration > hitStop.timer) {
    hitStop.scale = scale;
    hitStop.timer = duration;
  }
}
