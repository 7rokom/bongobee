<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class StockEntry extends Model {
    use HasUuids;
    protected $fillable = ['product_name','quantity','buy_price','sell_price','total_cost','supplier','note','date','entry_date','damage'];
    protected function casts(): array { return ['buy_price'=>'decimal:2','total_cost'=>'decimal:2','entry_date'=>'date']; }
}
