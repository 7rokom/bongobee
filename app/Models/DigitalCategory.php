<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class DigitalCategory extends Model {
    use HasUuids;
    protected $fillable = ['name','slug','image','sort_order','is_active'];
    protected function casts(): array { return ['is_active'=>'boolean']; }
}
