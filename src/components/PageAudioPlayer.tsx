import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

/**
 * Floating audio player. Reusable across pages.
 * - Auto-plays once per visitor per `pageKey` (tracked via localStorage), 2.5s after mount
 * - User can pause / resume by clicking the floating button
 * - Stops on its own when the audio ends
 */
interface PageAudioPlayerProps {
  audioUrl: string;
  enabled: boolean;
  /** Unique key per page so each page has independent auto-play state */
  pageKey: string;
}

const PageAudioPlayer = ({ audioUrl, enabled, pageKey }: PageAudioPlayerProps) => {
  const AUTOPLAY_FLAG_KEY = `page_audio_autoplayed_${pageKey}_v1`;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const startedRef = useRef(false);

  // Try auto-play once per visitor, after a small delay.
  // Strategy: try with sound first; if browser blocks it, retry muted (always allowed),
  // then unmute on the very first user interaction anywhere on the page.
  useEffect(() => {
    if (!enabled || !audioUrl) return;
    const audio = audioRef.current;
    if (!audio) return;

    const alreadyPlayed = typeof window !== "undefined" && sessionStorage.getItem(AUTOPLAY_FLAG_KEY) === "1";
    if (alreadyPlayed) return;

    const t = setTimeout(async () => {
      if (startedRef.current) return;
      // 1) Try with sound
      audio.muted = false;
      setIsMuted(false);
      try {
        await audio.play();
        startedRef.current = true;
        setIsPlaying(true);
        sessionStorage.setItem(AUTOPLAY_FLAG_KEY, "1");
        return;
      } catch {
        // Browser blocked sound autoplay — fall back to muted autoplay
      }
      try {
        audio.muted = true;
        setIsMuted(true);
        await audio.play();
        startedRef.current = true;
        setIsPlaying(true);
        // Don't set the localStorage flag yet — visitor hasn't really "heard" it.
        // It will be set the moment we unmute on first interaction.
      } catch {
        // Even muted failed — user will need to tap the floating button
      }
    }, 2500);

    // First-interaction unmute handler
    const unmuteOnInteraction = async () => {
      const a = audioRef.current;
      if (!a) return;
      if (a.muted) {
        a.muted = false;
        setIsMuted(false);
        try {
          if (a.paused) await a.play();
        } catch {
          /* ignore */
        }
        sessionStorage.setItem(AUTOPLAY_FLAG_KEY, "1");
      }
      cleanup();
    };
    const events: Array<keyof WindowEventMap> = [
      "click",
      "touchstart",
      "touchend",
      "keydown",
      "scroll",
      "pointerdown",
    ];
    const cleanup = () => {
      events.forEach((ev) => window.removeEventListener(ev, unmuteOnInteraction));
    };
    events.forEach((ev) =>
      window.addEventListener(ev, unmuteOnInteraction, { once: false, passive: true })
    );

    return () => {
      clearTimeout(t);
      cleanup();
    };
  }, [enabled, audioUrl, AUTOPLAY_FLAG_KEY]);

  const handleToggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Always ensure unmuted when user explicitly interacts with our button
    if (audio.muted) {
      audio.muted = false;
      setIsMuted(false);
    }
    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
        sessionStorage.setItem(AUTOPLAY_FLAG_KEY, "1");
      } catch {
        /* ignore */
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  if (!enabled || !audioUrl) return null;

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        playsInline
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isPlaying ? (isMuted ? "ভয়েস চালু করুন" : "ভয়েস বন্ধ করুন") : "ভয়েস শুনুন"}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[60] flex items-center justify-center h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(0,0,0,0.3)] hover:opacity-90 active:scale-95 transition-all"
      >
        {isPlaying && (
          <span className="absolute inset-0 rounded-full animate-ping bg-primary/40" aria-hidden />
        )}
        <span className="relative flex items-center justify-center">
          {isPlaying && isMuted ? (
            <VolumeX className="h-5 w-5" strokeWidth={2.5} />
          ) : isPlaying ? (
            <Pause className="h-5 w-5" strokeWidth={2.5} />
          ) : (
            <Play className="h-5 w-5 fill-current" strokeWidth={2.5} />
          )}
        </span>
      </button>
    </>
  );
};

export default PageAudioPlayer;