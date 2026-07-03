<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class Expense extends Model {
    use HasUuids;
    protected $fillable = ['title','amount','category','note','date','employee_id','expense_date'];
    protected function casts(): array { return ['amount'=>'decimal:2','expense_date'=>'date']; }
}
