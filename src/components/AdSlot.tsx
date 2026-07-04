import { useEffect, useRef } from 'react';
import { isInternalUser } from '@/lib/is-internal-user';
import { useResellerRef } from '@/contexts/ResellerRefContext';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';

interface AdSlotProps {
  html: string;
  className?: string;
}

/**
 * Renders user-provided HTML (clickable images, AdSense, sponsor banners, etc.)
 * Re-executes any <script> tags inside the snippet so AdSense / pixel scripts work.
 * Returns null for internal users and resellers that are ad-blocked by admin.
 */
const AdSlot = ({ html, className }: AdSlotProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const internal = isInternalUser();
  const resellerId = useResellerRef();
  const adBlockedResellers = useSiteSettingsStore((s) => s.adBlockedResellers);
  const blocked = !!resellerId && (adBlockedResellers ?? []).includes(resellerId);

  useEffect(() => {
    if (internal || blocked) return;
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
  }, [html, internal, blocked]);

  if (!html || internal || blocked) return null;
  return <div ref={ref} className={className} />;
};

export default AdSlot;
