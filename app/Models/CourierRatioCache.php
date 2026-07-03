<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class CourierRatioCache extends Model {
    protected $table = 'courier_ratio_cache';
    protected $primaryKey = 'phone';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['phone','delivery_ratio','total_orders','delivered_count','cached_at','all_count','returned','delivered','checked_at'];
    protected function casts(): array { return ['delivery_ratio'=>'decimal:2']; }
}
