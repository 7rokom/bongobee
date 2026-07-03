<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResellerOrder extends Model
{
    use HasUuids;

    protected $fillable = [
        'reseller_id', 'invoice_number', 'customer_name', 'customer_phone',
        'customer_address', 'delivery_zone', 'items', 'total_amount',
        'delivery_charge', 'reseller_profit', 'paid_return_amount',
        'status', 'note', 'admin_note', 'tracking_url', 'courier_name',
        'source', 'sms_sent',
        'order_code', 'reseller_name', 'packaging_charge', 'cod_charge',
        'total_selling_price', 'total_reseller_cost', 'total_profit', 'date',
        'notes', 'customer_ip', 'customer_fingerprint', 'assigned_to',
        'assigned_to_name', 'confirmed_by',
    ];

    protected function casts(): array
    {
        return [
            'items' => 'array',
            'sms_sent' => 'array',
            'notes' => 'array',
            'total_amount' => 'decimal:2',
            'delivery_charge' => 'decimal:2',
            'reseller_profit' => 'decimal:2',
            'paid_return_amount' => 'decimal:2',
            'packaging_charge' => 'decimal:2',
            'cod_charge' => 'decimal:2',
            'total_selling_price' => 'decimal:2',
            'total_reseller_cost' => 'decimal:2',
            'total_profit' => 'decimal:2',
        ];
    }

    public function reseller(): BelongsTo
    {
        return $this->belongsTo(Reseller::class);
    }
}
