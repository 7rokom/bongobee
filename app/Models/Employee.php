<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens;

class Employee extends Authenticatable
{
    use HasApiTokens, HasUuids;

    protected $fillable = [
        'name', 'email', 'phone', 'password', 'role', 'permissions', 'is_active',
        'assigned_reseller_ids', 'hidden_reseller_ids', 'auto_assign_main',
    ];
    protected $hidden = ['password'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'permissions' => 'array',
            'is_active' => 'boolean',
            'assigned_reseller_ids' => 'array',
            'hidden_reseller_ids' => 'array',
            'auto_assign_main' => 'boolean',
        ];
    }

    public function hasPermission(string $permission): bool
    {
        $permissions = $this->permissions ?? [];
        return in_array($permission, $permissions) || in_array('all', $permissions);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(EmployeeActivity::class);
    }
}
