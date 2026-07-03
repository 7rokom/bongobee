<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class PushSubscription extends Model {
    use HasUuids;
    protected $fillable = ['endpoint','p256dh_key','auth_key','section','is_active'];
    protected function casts(): array { return ['is_active'=>'boolean']; }
}
