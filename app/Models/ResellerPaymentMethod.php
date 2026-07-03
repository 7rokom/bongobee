<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class ResellerPaymentMethod extends Model {
    use HasUuids;
    protected $fillable = ['reseller_id','method_name','account_number','account_holder','is_default','method_type','label'];
    protected function casts(): array { return ['is_default'=>'boolean']; }
    public function reseller(): BelongsTo { return $this->belongsTo(Reseller::class); }
}
