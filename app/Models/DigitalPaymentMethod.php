<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class DigitalPaymentMethod extends Model {
    use HasUuids;
    protected $fillable = ['method_name','name','type','logo_url','account_number','account_holder','instructions','is_active','sort_order'];
    protected function casts(): array { return ['is_active'=>'boolean']; }
}
