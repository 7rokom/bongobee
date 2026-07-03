/** Extract YouTube video ID from various URL formats */
export const extractYouTubeId = (url?: string | null): string | null => {
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

export type YouTubeThumbQuality =
  | 'default'      // 120x90
  | 'mqdefault'    // 320x180
  | 'hqdefault'    // 480x360
  | 'sddefault'    // 640x480
  | 'maxresdefault'; // 1280x720

/** Build YouTube thumbnail URL from a video ID */
export const getYouTubeThumbnail = (id: string, quality: YouTubeThumbQuality = 'hqdefault'): string =>
  `https://i.ytimg.com/vi/${id}/${quality}.jpg`;

/** Build YouTube embed URL */
export const getYouTubeEmbedUrl = (
  id: string,
  opts: { autoplay?: boolean; modestbranding?: boolean; rel?: boolean } = {}
): string => {
  const params = new URLSearchParams();
  if (opts.autoplay) params.set('autoplay', '1');
  if (opts.modestbranding !== false) params.set('modestbranding', '1');
  if (opts.rel === false) params.set('rel', '0');
  params.set('playsinline', '1');
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
};

// ---------- Generic video resolver (YouTube + Google Drive + Vimeo + Facebook + direct files) ----------

export type VideoKind = 'youtube' | 'gdrive' | 'vimeo' | 'facebook' | 'file';

export interface ResolvedVideo {
  kind: VideoKind;
  /** iframe src or direct file URL */
  src: (opts?: { autoplay?: boolean }) => string;
  /** true → render via <iframe>, false → render via <video> */
  isIframe: boolean;
  /** Optional poster/thumbnail (only some providers) */
  thumbnail?: string;
  /** Provider id, when known */
  id?: string;
}

const extractGoogleDriveId = (url: string): string | null => {
  const m =
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
};

const extractVimeoId = (url: string): string | null => {
  const m =
    url.match(/vimeo\.com\/(?:video\/)?(\d+)/) ||
    url.match(/player\.vimeo\.com\/video\/(\d+)/);
  return m ? m[1] : null;
};

const isDirectVideoFile = (url: string): boolean =>
  /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i.test(url);

const isFacebookVideo = (url: string): boolean =>
  /(?:facebook\.com|fb\.watch)\//i.test(url);

/** Resolve any supported video URL into render-ready info. Returns null if not recognised. */
export const resolveVideo = (url?: string | null): ResolvedVideo | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1) YouTube
  const ytId = extractYouTubeId(trimmed);
  if (ytId) {
    return {
      kind: 'youtube',
      id: ytId,
      isIframe: true,
      thumbnail: getYouTubeThumbnail(ytId, 'maxresdefault'),
      src: (opts) =>
        getYouTubeEmbedUrl(ytId, { autoplay: !!opts?.autoplay, rel: false }),
    };
  }

  // 2) Google Drive
  if (/drive\.google\.com/i.test(trimmed)) {
    const id = extractGoogleDriveId(trimmed);
    if (id) {
      return {
        kind: 'gdrive',
        id,
        isIframe: true,
        src: (opts) =>
          `https://drive.google.com/file/d/${id}/preview${opts?.autoplay ? '?autoplay=1&mute=1' : ''}`,
      };
    }
  }

  // 3) Vimeo
  const vId = extractVimeoId(trimmed);
  if (vId) {
    return {
      kind: 'vimeo',
      id: vId,
      isIframe: true,
      src: (opts) =>
        `https://player.vimeo.com/video/${vId}?${opts?.autoplay ? 'autoplay=1&' : ''}title=0&byline=0&portrait=0`,
    };
  }

  // 4) Facebook
  if (isFacebookVideo(trimmed)) {
    return {
      kind: 'facebook',
      isIframe: true,
      src: (opts) =>
        `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=0${opts?.autoplay ? '&autoplay=1' : ''}`,
    };
  }

  // 5) Direct video file (mp4, webm, …) or any other URL → treat as direct file
  if (isDirectVideoFile(trimmed) || /^https?:\/\//i.test(trimmed)) {
    return {
      kind: 'file',
      isIframe: false,
      src: () => trimmed,
    };
  }

  return null;
};

/** Get the best display image for a blog post: explicit image > YouTube thumbnail > '' */
export const getPostDisplayImage = (image?: string, videoUrl?: string): string => {
  if (image) return image;
  const id = extractYouTubeId(videoUrl);
  if (id) return getYouTubeThumbnail(id, 'hqdefault');
  return '';
};
