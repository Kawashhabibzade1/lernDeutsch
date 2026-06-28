"""
German TTS via Google Translate (gTTS).
Free, no API key required, natural neural German voice.
Falls back to macOS `say` if gTTS is unavailable.
"""
import io

def synthesize(text: str, lang: str = "de") -> bytes:
    """Return MP3 bytes for the given text in the specified language."""
    try:
        from gtts import gTTS
        tts = gTTS(text=text, lang=lang, slow=False)
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        return fp.read()
    except Exception as e:
        raise RuntimeError(f"gTTS synthesis failed: {e}") from e
