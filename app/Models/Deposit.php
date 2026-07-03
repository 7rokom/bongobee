<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class Deposit extends Model {
    use HasUuids;
    protected $fillable = ['title','amount','source','note','date','deposit_date'];
    protected function casts(): array { return ['amount'=>'decimal:2','deposit_date'=>'date']; }
}
