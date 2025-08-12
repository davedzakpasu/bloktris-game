import { Audio } from "expo-av";

let place: Audio.Sound | null = null;
let invalid: Audio.Sound | null = null;
let isWeb = typeof window !== "undefined";

export async function initSfx() {
  place = (await Audio.Sound.createAsync(require("../assets/sfx/place.mp3")))
    .sound;
  invalid = (
    await Audio.Sound.createAsync(require("../assets/sfx/invalid.mp3"))
  ).sound;
}

export async function playPlace() {
  try {
    await place?.replayAsync();
  } catch {}
}
export async function playInvalid() {
  try {
    await invalid?.replayAsync();
  } catch {}
}

export async function playStart() {
  try {
    if (isWeb) {
      // Web fallback: quick beep using WebAudio
      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = 660; // E5
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      const t0 = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      o.stop(t0 + 0.3);
      return;
    } else {
      // Native: play a bundled start.wav via expo-av
      const { Audio } = require("expo-av");
      const sound = new Audio.Sound();
      await sound.loadAsync(require("../assets/sfx/start.wav"));
      await sound.playAsync();
      // unload after ~1s
      setTimeout(() => sound.unloadAsync().catch(() => {}), 1000);
    }
  } catch {}
}
