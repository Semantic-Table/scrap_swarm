/** CrazyGames SDK v3 type declarations (loaded via script tag) */

interface CrazyGamesAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: string) => void;
}

interface CrazyGamesAd {
  requestAd(type: "midgame" | "rewarded", callbacks: CrazyGamesAdCallbacks): void;
  hasAdblock(): Promise<boolean>;
}

interface CrazyGamesGame {
  gameplayStart(): void;
  gameplayStop(): void;
  happytime(): void;
  loadingStart(): void;
  loadingStop(): void;
}

interface CrazyGamesSDKInstance {
  init(): Promise<void>;
  ad: CrazyGamesAd;
  game: CrazyGamesGame;
}

interface CrazyGamesNamespace {
  SDK: CrazyGamesSDKInstance;
}

interface Window {
  CrazyGames?: CrazyGamesNamespace;
}
