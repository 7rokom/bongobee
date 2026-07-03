<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class EmployeeActivity extends Model {
    use HasUuids;
    protected $fillable = ['employee_id','action','entity_type','entity_id','details','employee_name','order_id','timestamp'];
    public function employee(): BelongsTo { return $this->belongsTo(Employee::class); }
}
