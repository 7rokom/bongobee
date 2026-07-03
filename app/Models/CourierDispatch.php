<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class CourierDispatch extends Model {
    use HasUuids;
    protected $table = 'courier_dispatch';
    protected $fillable = ['order_id','courier','consignment_id','tracking_code','status','response_data','courier_type','courier_status','transfer_status','sent_at','store_id'];
    protected function casts(): array { return ['response_data'=>'array']; }
}
