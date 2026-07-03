<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class IncompleteOrder extends Model {
    // frontend supplies its own "INC..." id
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected function casts(): array {
        return ['items'=>'array','fraud_blocked'=>'boolean','total_amount'=>'decimal:2','delivery_charge'=>'decimal:2','total_price'=>'decimal:2','grand_total'=>'decimal:2'];
    }
}
