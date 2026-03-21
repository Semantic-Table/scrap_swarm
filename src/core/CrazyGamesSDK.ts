/**
 * CrazyGames SDK wrapper — single module for all SDK interactions.
 * All calls are fire-and-forget with try/catch (never blocks gameplay on failure).
 * When SDK is unavailable (local dev), all functions no-op gracefully.
 */
let sdkReady = false;

function getSDK(): CrazyGamesSDKInstance | null {
  if (!sdkReady) return null;
  return window.CrazyGames?.SDK ?? null;
}

/**
 * Initialize the CrazyGames SDK. Call once at game start.
 * Resolves even if SDK is unavailable (local dev).
 */
export async function initCrazySDK(): Promise<void> {
  try {
    const sdk = window.CrazyGames?.SDK;
    if (!sdk) {
      console.log("[CrazyGames] SDK not found — running in local mode");
      return;
    }
    await sdk.init();
    sdkReady = true;
    console.log("[CrazyGames] SDK initialized");
  } catch (e) {
    console.warn("[CrazyGames] SDK init failed:", e);
  }
}

/**
 * Show an interstitial (midgame) ad.
 * Returns a Promise that resolves when the ad finishes, errors, or is unavailable.
 */
export function showInterstitialAd(): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const sdk = getSDK();
      if (!sdk) {
        resolve();
        return;
      }
      sdk.ad.requestAd("midgame", {
        adStarted: () => {
          // Pause audio/game handled by caller
        },
        adFinished: () => resolve(),
        adError: (error: string) => {
          console.warn("[CrazyGames] Interstitial ad error:", error);
          resolve(); // Never block gameplay
        },
      });
    } catch {
      resolve();
    }
  });
}

/**
 * Show a rewarded ad.
 * Returns true if the player watched the full ad, false otherwise.
 */
export function showRewardedAd(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      const sdk = getSDK();
      if (!sdk) {
        resolve(false);
        return;
      }
      sdk.ad.requestAd("rewarded", {
        adStarted: () => {
          // Pause audio/game handled by caller
        },
        adFinished: () => resolve(true),
        adError: (error: string) => {
          console.warn("[CrazyGames] Rewarded ad error:", error);
          resolve(false);
        },
      });
    } catch {
      resolve(false);
    }
  });
}

/** Notify SDK that active gameplay has started. */
export function gameplayStart(): void {
  try {
    getSDK()?.game.gameplayStart();
  } catch { /* no-op */ }
}

/** Notify SDK that active gameplay has stopped. */
export function gameplayStop(): void {
  try {
    getSDK()?.game.gameplayStop();
  } catch { /* no-op */ }
}

/** Trigger a celebration effect (confetti) on the CrazyGames website. */
export function happyTime(): void {
  try {
    getSDK()?.game.happytime();
  } catch { /* no-op */ }
}
