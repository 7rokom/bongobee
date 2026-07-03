<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class SmsQueue extends Model {
    use HasUuids;
    protected $fillable = ['campaign_id','phone','message','status','response_code','error_message','sent_at'];
    protected function casts(): array { return ['sent_at'=>'datetime']; }
}
