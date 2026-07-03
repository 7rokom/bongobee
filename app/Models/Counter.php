<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class Counter extends Model {
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id','value'];
}
