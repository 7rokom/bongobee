<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class PaymentRequest extends Model {
    use HasUuids;
    protected $fillable = ['reseller_id','reseller_name','amount','payment_method','account_number','status','admin_note','date'];
    protected function casts(): array { return ['amount'=>'decimal:2']; }
    public function reseller(): BelongsTo { return $this->belongsTo(Reseller::class); }
}
