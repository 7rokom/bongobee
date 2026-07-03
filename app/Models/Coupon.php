<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class Coupon extends Model {
    use HasUuids;
    protected $fillable = ['code','discount_type','discount_value','min_order_amount','max_usage','used_count','start_date','end_date','is_active','product_ids'];
    protected function casts(): array {
        return ['is_active'=>'boolean','start_date'=>'date','end_date'=>'date','discount_value'=>'decimal:2','min_order_amount'=>'decimal:2','product_ids'=>'array'];
    }
}
