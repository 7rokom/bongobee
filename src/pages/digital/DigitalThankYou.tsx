import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { trackPurchase } from '@/lib/dataLayer';

interface LastOrder {
  orderId?: string;
  orderNumber: string;
  productId?: string;
  productTitle: string;
  price?: number;
}

const DigitalThankYou = () => {
  const [info, setInfo] = useState<LastOrder | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const s = sessionStorage.getItem('digital_last_order');
    if (s) {
      const parsed: LastOrder = JSON.parse(s);
      setInfo(parsed);

      if (!firedRef.current) {
        firedRef.current = true;
        const value = Number(parsed.price) || 0;
        trackPurchase(
          parsed.orderNumber,
          [{
            item_id: parsed.productId || parsed.orderNumber,
            item_name: parsed.productTitle,
            price: value,
            quantity: 1,
            item_category: 'Digital',
          }],
          value,
          0,
          0,
        );
      }
    }
  }, []);

  return (
    <div className="container mx-auto px-4 py-10 max-w-xl">
      <Card className="border-2 border-green-200 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-6">
          <CardContent className="p-0 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold">ধন্যবাদ! অর্ডার সফল হয়েছে</h1>
            {info && (
              <div className="text-sm bg-card border rounded-lg p-4 text-left space-y-1">
                <p>অর্ডার নং: <span className="font-mono font-bold text-primary">{info.orderNumber}</span></p>
                <p>প্রডাক্ট: <strong>{info.productTitle}</strong></p>
              </div>
            )}
            <p className="text-muted-foreground text-sm">
              আপনার পেমেন্ট যাচাই করে অ্যাডমিন অ্যাপ্রুভ করার পর আপনি আপনার অ্যাকাউন্টে ডাউনলোড/অ্যাক্সেস পাবেন।
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button asChild className="bg-gradient-to-r from-primary to-secondary"><Link to="/digital/account">আমার অ্যাকাউন্ট</Link></Button>
              <Button asChild variant="outline"><Link to="/digital-products">শপে যান</Link></Button>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
};

export default DigitalThankYou;
