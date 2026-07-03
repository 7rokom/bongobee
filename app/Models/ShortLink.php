<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class ShortLink extends Model {
    use HasUuids;
    protected $fillable = ['slug','destination_url','target_url','product_id','title','click_count','is_active'];
    protected function casts(): array { return ['is_active'=>'boolean']; }
}
