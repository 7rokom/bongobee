import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Truck, Package } from 'lucide-react';

const COD_CHARGE_PERCENT = 1;
const calcCodCharge = (amount: number) => Math.ceil((amount * COD_CHARGE_PERCENT) / 100);
const VENDOR_PACKAGING_CHARGE = 10;

interface OrderDetail {
  id: string;
  type: 'main' | 'reseller';
  customer: string;
  sellPrice: number;
  deliveryCharge: number;
  packagingCharge: number;
  codCharge: number;
  buyPrice: number;
  profit: number;
  /** Optional row label/status (e.g. 'রিটার্ন', 'পেইড রিটার্ন') */
  note?: string;
}

interface PaymentDetailTablesProps {
  orders: any[];
  resellerOrders: any[];
  buyPriceMap: Record<string, number>;
  stockTypes: Record<string, string>;
  vendorBuyPrices: Record<string, number>;
  allProducts: any[];
  inDateRange: (dateStr: string) => boolean;
  getMainOrderStockType: (orderId: string) => string;
  getResellerOrderStockType: (orderId: string, items?: any[]) => string;
  getMainItemBuyPrice: (item: any) => number;
}

const PaymentDetailTables = ({
  orders,
  resellerOrders,
  buyPriceMap,
  stockTypes,
  vendorBuyPrices,
  allProducts,
  inDateRange,
  getMainOrderStockType,
  getResellerOrderStockType,
  getMainItemBuyPrice,
}: PaymentDetailTablesProps) => {
  const [courierOpen, setCourierOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);

  const { courierDetails, vendorDetails } = useMemo(() => {
    const courierDetails: OrderDetail[] = [];
    const vendorDetails: OrderDetail[] = [];

    // Main orders
    const deliveredOrders = orders.filter(o => o.status === 'ডেলিভারড' && inDateRange(o.isoDate || o.date));
    deliveredOrders.forEach(o => {
      const sellPrice = o.total;
      const deliveryCharge = o.deliveryCharge || 0;
      const codCharge = calcCodCharge(sellPrice);
      const orderStockType = getMainOrderStockType(o.id);

      if (orderStockType === 'vendor') {
        const packagingCharge = 10;
        const customBuyPrice = vendorBuyPrices[o.id];
        let productCost: number;
        if (customBuyPrice !== undefined) {
          productCost = customBuyPrice;
        } else {
          productCost = 0;
          o.items.forEach((item: any) => {
            productCost += getMainItemBuyPrice(item) * item.qty;
          });
        }
        const profit = sellPrice - codCharge - productCost - deliveryCharge - packagingCharge;
        vendorDetails.push({
          id: o.id,
          type: 'main',
          customer: o.customer,
          sellPrice,
          deliveryCharge,
          packagingCharge,
          codCharge,
          buyPrice: productCost,
          profit,
        });
      } else {
        const profit = sellPrice - deliveryCharge - codCharge;
        courierDetails.push({
          id: o.id,
          type: 'main',
          customer: o.customer,
          sellPrice,
          deliveryCharge,
          packagingCharge: 0,
          codCharge,
          buyPrice: 0,
          profit,
        });
      }
    });

    // Vendor-stock returns & paid-returns reduce/adjust vendor payment
    const vendorReturnedMain = orders.filter(o =>
      (o.status === 'রিটার্ন' || o.status === 'পেইড রিটার্ন') &&
      inDateRange(o.isoDate || o.date) &&
      getMainOrderStockType(o.id) === 'vendor'
    );
    vendorReturnedMain.forEach(o => {
      const deliveryCharge = o.deliveryCharge || 0;
      const packagingCharge = VENDOR_PACKAGING_CHARGE;
      let profit: number;
      if (o.status === 'পেইড রিটার্ন') {
        const paidAmount = (o as any).paidReturnAmount ?? 0;
        profit = paidAmount - deliveryCharge - packagingCharge;
      } else {
        // রিটার্ন — full loss of delivery + packaging
        profit = -(deliveryCharge + packagingCharge);
      }
      vendorDetails.push({
        id: o.id,
        type: 'main',
        customer: o.customer,
        sellPrice: 0,
        deliveryCharge,
        packagingCharge,
        codCharge: 0,
        buyPrice: 0,
        profit,
        note: o.status,
      });
    });

    // Self-stock returns & paid-returns adjust courier payment.
    const selfReturnedMain = orders.filter(o =>
      (o.status === 'রিটার্ন' || o.status === 'পেইড রিটার্ন') &&
      inDateRange(o.isoDate || o.date) &&
      getMainOrderStockType(o.id) !== 'vendor'
    );
    selfReturnedMain.forEach(o => {
      const deliveryCharge = o.deliveryCharge || 0;
      let profit: number;
      if (o.status === 'পেইড রিটার্ন') {
        const paidAmount = (o as any).paidReturnAmount ?? 0;
        profit = paidAmount - deliveryCharge;
      } else {
        profit = -deliveryCharge;
      }
      courierDetails.push({
        id: o.id,
        type: 'main',
        customer: o.customer,
        sellPrice: 0,
        deliveryCharge,
        packagingCharge: 0,
        codCharge: 0,
        buyPrice: 0,
        profit,
        note: o.status,
      });
    });

    // Reseller orders
    const deliveredResellerOrders = resellerOrders.filter(o => o.status === 'ডেলিভারড' && inDateRange(o.date));
    deliveredResellerOrders.forEach(o => {
      const sellingPrice = o.totalSellingPrice || 0;
      const codCharge = calcCodCharge(sellingPrice);
      const deliveryCharge = o.deliveryCharge || 0;
      const packagingCharge = o.packagingCharge || 0;
      const orderStockType = getResellerOrderStockType(o.id, o.items);

      if (orderStockType === 'vendor') {
        const key = `reseller-${o.id}`;
        const customBuyPrice = vendorBuyPrices[key];
        let productCost: number;
        if (customBuyPrice !== undefined) {
          productCost = customBuyPrice;
        } else {
          productCost = 0;
          o.items.forEach((item: any) => {
            const matchedProduct = allProducts.find((p: any) => p.id === item.productId || p.title === item.productTitle);
            const stockName = matchedProduct?.stockProductName || item.productTitle;
            const bPrice = matchedProduct?.buyPrice ?? buyPriceMap[stockName] ?? 0;
            productCost += bPrice * item.qty;
          });
        }
        const profit = sellingPrice - codCharge - productCost - deliveryCharge - packagingCharge;
        vendorDetails.push({
          id: `R-${o.id}`,
          type: 'reseller',
          customer: o.customerName,
          sellPrice: sellingPrice,
          deliveryCharge,
          packagingCharge,
          codCharge,
          buyPrice: productCost,
          profit,
        });
      } else {
        const profit = sellingPrice - codCharge - deliveryCharge;
        courierDetails.push({
          id: `R-${o.id}`,
          type: 'reseller',
          customer: o.customerName,
          sellPrice: sellingPrice,
          deliveryCharge,
          packagingCharge: 0,
          codCharge,
          buyPrice: 0,
          profit,
        });
      }
    });

    // NOTE: Reseller order returns/paid-returns are borne by the reseller
    // (deducted from their balance), so we don't list them under courier or
    // vendor payment details.

    return { courierDetails, vendorDetails };
  }, [orders, resellerOrders, buyPriceMap, stockTypes, vendorBuyPrices, allProducts, inDateRange]);

  const courierTotal = courierDetails.reduce((s, d) => s + d.profit, 0);
  const vendorTotal = vendorDetails.reduce((s, d) => s + d.profit, 0);

  const renderTable = (details: OrderDetail[], showBuyPrice: boolean) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">অর্ডার আইডি</TableHead>
            <TableHead className="text-xs">কাস্টমার</TableHead>
            <TableHead className="text-xs">টাইপ</TableHead>
            <TableHead className="text-xs text-right">সেল প্রাইস</TableHead>
            <TableHead className="text-xs text-right">ডেলিভারি</TableHead>
            {showBuyPrice && <TableHead className="text-xs text-right">প্যাকেজিং</TableHead>}
            <TableHead className="text-xs text-right">COD চার্জ</TableHead>
            {showBuyPrice && <TableHead className="text-xs text-right">বাই প্রাইস</TableHead>}
            <TableHead className="text-xs text-right font-semibold">প্রফিট</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {details.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showBuyPrice ? 9 : 6} className="text-center text-muted-foreground py-6">
                কোনো অর্ডার নেই
              </TableCell>
            </TableRow>
          ) : (
            <>
              {details.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs font-mono">
                    {d.id}
                    {d.note && (
                      <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] bg-pink-100 text-pink-700 border border-pink-200">
                        {d.note}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{d.customer}</TableCell>
                  <TableCell className="text-xs">{d.type === 'reseller' ? 'রিসেলার' : 'মেইন'}</TableCell>
                  <TableCell className="text-xs text-right">৳{d.sellPrice.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-right">৳{d.deliveryCharge.toLocaleString()}</TableCell>
                  {showBuyPrice && <TableCell className="text-xs text-right">৳{d.packagingCharge.toLocaleString()}</TableCell>}
                  <TableCell className="text-xs text-right">৳{d.codCharge.toLocaleString()}</TableCell>
                  {showBuyPrice && <TableCell className="text-xs text-right">৳{d.buyPrice.toLocaleString()}</TableCell>}
                  <TableCell className="text-xs text-right font-semibold">৳{d.profit.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={showBuyPrice ? 8 : 5} className="text-xs text-right">মোট:</TableCell>
                <TableCell className="text-xs text-right">
                  ৳{details.reduce((s, d) => s + d.profit, 0).toLocaleString()}
                </TableCell>
              </TableRow>
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Courier Payment Details */}
      <Collapsible open={courierOpen} onOpenChange={setCourierOpen}>
        <Card className="border-0 shadow-sm">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="pb-2 pt-4 px-4 cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <CardTitle className="text-sm font-semibold">কুরিয়ার পেমেন্ট বিস্তারিত</CardTitle>
                  <span className="text-xs text-muted-foreground">({courierDetails.length}টি অর্ডার)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-600">৳{courierTotal.toLocaleString()}</span>
                  {courierOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-0">
              {renderTable(courierDetails, true)}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Vendor Payment Details */}
      <Collapsible open={vendorOpen} onOpenChange={setVendorOpen}>
        <Card className="border-0 shadow-sm">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="pb-2 pt-4 px-4 cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-600" />
                  <CardTitle className="text-sm font-semibold">ভেন্ডর পেমেন্ট বিস্তারিত</CardTitle>
                  <span className="text-xs text-muted-foreground">({vendorDetails.length}টি অর্ডার)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-600">৳{vendorTotal.toLocaleString()}</span>
                  {vendorOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-0">
              {renderTable(vendorDetails, true)}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};

export default PaymentDetailTables;
