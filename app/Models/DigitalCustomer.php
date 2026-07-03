<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens;

class DigitalCustomer extends Authenticatable
{
    use HasApiTokens, HasUuids;

    protected $fillable = ['name', 'email', 'phone', 'password', 'is_blocked'];
    protected $hidden = ['password'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_blocked' => 'boolean',
        ];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(DigitalOrder::class, 'customer_id');
    }
}
