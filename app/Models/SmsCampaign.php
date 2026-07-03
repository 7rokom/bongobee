<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class SmsCampaign extends Model {
    use HasUuids;
    protected $fillable = ['title','message','target','phone_numbers','total_count','sent_count','failed_count','status'];
    protected function casts(): array { return ['phone_numbers'=>'array']; }
}
