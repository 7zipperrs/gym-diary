let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      ctx = new AudioCtx();
    }
  }
  return ctx;
}

/**
 * Вызывается внутри клика пользователя (например, при добавлении подхода),
 * чтобы iOS Safari разрешил воспроизведение звука по таймеру.
 */
export function unlockAudio(): void {
  try {
    const audio = getContext();
    if (!audio) return;
    if (audio.state === 'suspended') {
      void audio.resume();
    }
    // Короткий нулевой импульс для разблокировки аудиоканала на iOS
    const buffer = audio.createBuffer(1, 1, 22050);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    source.start(0);
  } catch {
    // Игнорируем, если браузер блокирует аудио
  }
}

/**
 * Приятный двойной сигнал окончания отдыха (не ставит музыку на паузу).
 */
export function playRestFinishedChime(): void {
  try {
    const audio = getContext();
    if (!audio) return;
    if (audio.state === 'suspended') {
      void audio.resume();
    }

    const base = audio.currentTime;
    const notes = [
      { freq: 880, start: 0, duration: 0.16 },
      { freq: 1174.66, start: 0.18, duration: 0.28 },
      { freq: 1318.51, start: 0.5, duration: 0.35 }
    ];

    for (const n of notes) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, base + n.start);

      gain.gain.setValueAtTime(0.0001, base + n.start);
      gain.gain.exponentialRampToValueAtTime(0.28, base + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, base + n.start + n.duration);

      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(base + n.start);
      osc.stop(base + n.start + n.duration + 0.02);
    }
  } catch {
    // Игнорируем ошибки аудио
  }
}
