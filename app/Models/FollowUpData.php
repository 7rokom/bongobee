<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class FollowUpData extends Model {
    use HasUuids;
    protected $fillable = ['order_id','tracking_url','courier_name','vendor_buy_price','stock_type','courier_delivery_charge','courier_invoice_id','status','note','courier_locked'];
    protected function casts(): array { return ['vendor_buy_price'=>'decimal:2','courier_delivery_charge'=>'decimal:2']; }
    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
}
