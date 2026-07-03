import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { useResellerRefValue } from '@/contexts/ResellerRefContext';

/**
 * Returns the contact numbers to display on public-facing pages.
 * If a reseller context is active and that reseller has set their own
 * numbers, those take priority. Otherwise the admin site settings are used.
 */
export function useContactNumbers(): { phone: string; whatsapp: string } {
  const sitePhone = useSiteSettingsStore((s) => s.phone);
  const siteWhatsapp = useSiteSettingsStore((s) => s.whatsappNumber);
  const ref = useResellerRefValue();
  const phone = (ref?.contactPhone || '').trim() || sitePhone || '';
  const whatsapp = (ref?.contactWhatsapp || '').trim() || siteWhatsapp || phone;
  return { phone, whatsapp };
}

/** Convert a Bangladeshi phone number to a wa.me-friendly format. */
export function toWaNumber(num: string): string {
  if (!num) return '';
  const digits = num.replace(/\D/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return '88' + digits;
  if (digits.length === 10 && digits.startsWith('1')) return '880' + digits;
  return digits;
}
