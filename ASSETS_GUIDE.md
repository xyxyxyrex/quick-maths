# Guide: Adding Manually Configured Audio Assets

By default, the game uses a procedural audio synthesizer (`SeededSynth`) built on top of the native **Web Audio API** so that it runs out-of-the-box on localhost without requiring external files.

If you want to replace these synthesized beeps and sweeps with your own custom high-quality sound effects (MP3, WAV, OGG, etc.), follow this guide.

---

## 1. Place your audio files in the public folder
Move your custom audio files to the `public/assets/audio/` directory. For example:
- `public/assets/audio/correct.mp3` (Short satisfying click/ding)
- `public/assets/audio/combo.mp3` (Short, energetic pulse)
- `public/assets/audio/attack.mp3` (Laser or swift whoosh)
- `public/assets/audio/warning.mp3` (Alert siren/beep)
- `public/assets/audio/lose.mp3` (Retro explosion/downward synth slide)

---

## 2. Initialize the SoundManager with assets
Open the main entry point where the game initializes (e.g. in your React layout or game launcher) and call `init` on the `SoundManager` with custom configurations.

### Code Example:
```typescript
import { SoundManager } from "./game/audio/soundManager";

const soundManager = SoundManager.getInstance();

// Initialize with asset configuration
soundManager.init({
  useAssets: true,
  assetPaths: {
    correct: "/assets/audio/correct.mp3",
    combo: "/assets/audio/combo.mp3",
    attack: "/assets/audio/attack.mp3",
    warning: "/assets/audio/warning.mp3",
    lose: "/assets/audio/lose.mp3"
  }
});
```

---

## 3. Best Practices for Audio Files
* **Latency:** Keep files small. Remove any leading silence from the audio tracks so the sound plays *instantly* upon submit/input.
* **Duration:** Keep the length extremely short (under 150ms for ticks/combos, under 500ms for explosions/lose states).
* **Format:** MP3 has the widest support, but WAV is uncompressed and has the absolute lowest decoding delay.
