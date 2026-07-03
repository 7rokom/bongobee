import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { useContactNumbers, toWaNumber } from '@/lib/contact-numbers';

interface Props {
  /** Optional pre-filled message for the WhatsApp chat. */
  message?: string;
  className?: string;
}

/**
 * Renders a green WhatsApp button that shows the contact number and
 * opens wa.me when clicked. Picks reseller-custom number first, falls
 * back to admin site settings.
 */
const WhatsAppContactButton = ({ message, className }: Props) => {
  const { whatsapp } = useContactNumbers();
  if (!whatsapp) return null;
  const wa = toWaNumber(whatsapp);
  const url = `https://wa.me/${wa}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      <Button
        size="lg"
        className="w-full rounded-[5px] h-11 gap-2 text-[15px] bg-[#25D366] text-white hover:bg-[#1da851]"
      >
        <MessageCircle className="h-4 w-4" />
        Whatsapp-এ যোগাযোগ করুন
      </Button>
    </a>
  );
};

export default WhatsAppContactButton;
