<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class BlockedCustomer extends Model {
    use HasUuids;
    protected $fillable = ['type','value','reason','customer_name','blocked_at','linked_group'];
}
