import { useMemo, useEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { isInternalUser } from '@/lib/is-internal-user';

interface Props {
  content: string;
  /** Optional video player rendered inline in the middle of the post body */
  videoSlot?: ReactNode;
}

const VIDEO_MARKER = '__BLOG_VIDEO_SLOT__';

const BlogContentWithAds = ({ content, videoSlot }: Props) => {
  const { adsenseCode } = useSiteSettingsStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoMount, setVideoMount] = useState<HTMLElement | null>(null);
  const internal = isInternalUser();

  const htmlWithAds = useMemo(() => {
    if (!content) return content;

    const adPlaceholder =
      adsenseCode && !internal ? `<div class="adsense-slot my-4">${adsenseCode}</div>` : '';
    const videoPlaceholder = videoSlot
      ? `<div class="blog-video-slot my-6" data-marker="${VIDEO_MARKER}"></div>`
      : '';

    const parts = content.split(/<\/p>/i);

    if (parts.length <= 1) {
      return [adPlaceholder, content, videoPlaceholder, adPlaceholder].filter(Boolean).join('');
    }

    const result: string[] = [];
    if (adPlaceholder) result.push(adPlaceholder);

    const videoIndex = videoPlaceholder ? Math.floor((parts.length - 1) / 2) : -1;

    parts.forEach((part, i) => {
      if (i < parts.length - 1) {
        result.push(part + '</p>');
        if (i === videoIndex) result.push(videoPlaceholder);
        if (adPlaceholder && (i + 1) % 4 === 0) result.push(adPlaceholder);
      } else if (part.trim()) {
        result.push(part);
      }
    });

    if (adPlaceholder) result.push(adPlaceholder);
    return result.join('');
  }, [content, adsenseCode, internal, videoSlot]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (adsenseCode && !internal) {
      const slots = containerRef.current.querySelectorAll('.adsense-slot');
      slots.forEach((slot) => {
        const scripts = slot.querySelectorAll('script');
        scripts.forEach((oldScript) => {
          const newScript = document.createElement('script');
          Array.from(oldScript.attributes).forEach((attr) =>
            newScript.setAttribute(attr.name, attr.value)
          );
          newScript.textContent = oldScript.textContent;
          oldScript.parentNode?.replaceChild(newScript, oldScript);
        });
      });
    }

    const node = containerRef.current.querySelector<HTMLElement>(
      `[data-marker="${VIDEO_MARKER}"]`
    );
    setVideoMount(node || null);
  }, [htmlWithAds, adsenseCode, internal]);

  return (
    <>
      <div
        ref={containerRef}
        className="prose prose-sm max-w-none text-foreground text-[14px] overflow-x-auto [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-[14px] [&_li]:text-[14px] [&_br]:block [&_br]:content-[''] [&_br]:mb-2 [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-[20px] [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-[20px] [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-[20px] [&_h4]:text-[20px] [&_h5]:text-[20px] [&_h6]:text-[20px] [&_ul]:mb-4 [&_ol]:mb-4 [&_li]:mb-1 [&_blockquote]:mb-4 [&_.ql-indent-1]:ml-8 [&_.ql-indent-2]:ml-16 [&_img]:max-w-full [&_img]:h-auto [&_table]:w-full [&_table]:table-fixed [&_td]:break-words [&_span]:break-words [&_*]:max-w-full"
        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        dangerouslySetInnerHTML={{ __html: htmlWithAds }}
      />
      {videoSlot && videoMount ? createPortal(videoSlot, videoMount) : null}
    </>
  );
};

export default BlogContentWithAds;
