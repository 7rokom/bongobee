<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class SiteSetting extends Model {
    protected $table = 'site_settings';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id','value'];
    protected function casts(): array { return ['value'=>'array']; }
    public static function get(string $key, mixed $default = null): mixed {
        $setting = static::find($key);
        return $setting ? $setting->value : $default;
    }
    public static function set(string $key, mixed $value): void {
        static::updateOrCreate(['id' => $key], ['value' => $value]);
    }
}
