<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class Variation extends Model {
    use HasUuids;
    protected $fillable = ['name', 'type', 'options'];
    protected function casts(): array { return ['options' => 'array']; }
}
