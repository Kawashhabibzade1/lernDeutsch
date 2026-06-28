/**
 * Speaks German text using the backend TTS endpoint (macOS neural voice).
 * Falls back to browser Web Speech API if the request fails.
 */

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let _current: HTMLAudioElement | null = null;

function stripEmoji(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[‍️⃣]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function speakGerman(text: string): Promise<void> {
  const clean = stripEmoji(text);
  if (!clean) return;

  // Stop anything already playing
  if (_current) {
    _current.pause();
    _current.src = "";
    _current = null;
  }

  try {
    const res = await fetch(`${API}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean }),
    });
    if (!res.ok) throw new Error(`TTS ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    _current = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (_current === audio) _current = null;
    };
    await audio.play();
  } catch {
    // Fallback: browser Web Speech API
    _webSpeechFallback(clean);
  }
}

function _webSpeechFallback(text: string) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  const voices = synth.getVoices();
  const german =
    voices.find((v) => v.lang === "de-DE" && !["Anna", "Petra"].includes(v.name)) ||
    voices.find((v) => v.lang.startsWith("de"));
  if (german) u.voice = german;
  u.rate = 0.88;
  synth.speak(u);
}
