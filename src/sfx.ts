import { Audio } from "expo-av";

let place: Audio.Sound | null = null;
let invalid: Audio.Sound | null = null;

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
