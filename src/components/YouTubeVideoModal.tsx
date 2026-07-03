import { useEffect } from 'react';
import { X } from 'lucide-react';

interface YouTubeVideoModalProps {
  videoUrl: string;
  open: boolean;
  onClose: () => void;
}

/** Extract YouTube video ID from various URL formats */
const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

const YouTubeVideoModal = ({ videoUrl, open, onClose }: YouTubeVideoModalProps) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - thick & visible at corner */}
        <button
          onClick={onClose}
          aria-label="বন্ধ করুন"
          className="absolute -top-3 -right-3 md:-top-4 md:-right-4 z-10 flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-white text-black shadow-2xl ring-4 ring-white/30 hover:bg-destructive hover:text-white transition-all"
        >
          <X className="h-6 w-6 md:h-7 md:w-7" strokeWidth={3} />
        </button>

        {/* Video container - YouTube native 16:9 ratio */}
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title="Product video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
};

export default YouTubeVideoModal;
export { extractYouTubeId };
