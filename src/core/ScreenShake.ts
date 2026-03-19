/** Shared screen shake state — systems call triggerShake(), CameraSystem reads it */
export const screenShake = {
  intensity: 0,
  duration: 0,
  timer: 0,
};

export function triggerShake(intensity: number, duration: number): void {
  screenShake.intensity = Math.max(screenShake.intensity, intensity);
  screenShake.duration = Math.max(screenShake.duration, duration);
  screenShake.timer = Math.max(screenShake.timer, duration);
}
