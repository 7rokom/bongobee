import { useEffect, useRef } from 'react';
import { isInternalUser } from '@/lib/is-internal-user';

interface AdSlotProps {
  html: string;
  className?: string;
}

/**
 * Renders user-provided HTML (clickable images, AdSense, sponsor banners, etc.)
 * Re-executes any <script> tags inside the snippet so AdSense / pixel scripts work.
 */
const AdSlot = ({ html, className }: AdSlotProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const internal = isInternalUser();

  useEffect(() => {
    if (internal) return;
    const el = ref.current;
    if (!el || !html) return;
    el.innerHTML = html;
    el.querySelectorAll('script').forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value)
      );
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }, [html, internal]);

  if (!html || internal) return null;
  return <div ref={ref} className={className} />;
};

export default AdSlot;
