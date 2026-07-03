<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    use HasUuids;

    protected $fillable = [
        'invoice_number', 'customer_name', 'customer_phone', 'customer_address',
        'delivery_zone', 'total_amount', 'delivery_charge', 'discount_amount',
        'coupon_code', 'items', 'status', 'note', 'admin_note', 'assigned_to',
        'source', 'device_fingerprint', 'ip_address', 'tracking_url',
        'courier_name', 'vendor_buy_price', 'courier_invoice_id',
        'courier_delivery_charge', 'sms_sent',
        // Phase 3 frontend-schema columns
        'order_code', 'customer', 'phone', 'address', 'total', 'original_delivery_charge',
        'date', 'iso_date', 'confirmed_by', 'assigned_to_name', 'customer_ip',
        'customer_fingerprint', 'paid_return_amount',
    ];

    protected function casts(): array
    {
        return [
            'items' => 'array',
            'sms_sent' => 'array',
            'total_amount' => 'decimal:2',
            'delivery_charge' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'vendor_buy_price' => 'decimal:2',
            'courier_delivery_charge' => 'decimal:2',
            'total' => 'decimal:2',
            'original_delivery_charge' => 'decimal:2',
            'paid_return_amount' => 'decimal:2',
        ];
    }

    public static function nextInvoiceNumber(): int
    {
        $counter = Counter::lockForUpdate()->find('order_number');
        if (!$counter) {
            $counter = Counter::create(['id' => 'order_number', 'value' => 1000]);
        }
        $counter->increment('value');
        return $counter->fresh()->value;
    }

    public function followUp(): HasOne
    {
        return $this->hasOne(FollowUpData::class);
    }
}
