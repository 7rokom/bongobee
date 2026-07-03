<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class PushCampaign extends Model {
    use HasUuids;
    protected $fillable = ['title','body','image_url','click_url','section','total_count','sent_count','status'];
}
