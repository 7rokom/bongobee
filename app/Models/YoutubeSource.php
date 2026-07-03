<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class YoutubeSource extends Model {
    use HasUuids;
    protected $fillable = ['name','source_type','source_value','category','author','max_videos','exclude_shorts','enabled','last_synced_at','last_sync_count'];
    protected function casts(): array { return ['exclude_shorts'=>'boolean','enabled'=>'boolean','last_synced_at'=>'datetime']; }
}
