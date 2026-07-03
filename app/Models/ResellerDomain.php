<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResellerDomain extends Model
{
    protected $fillable = [
        'reseller_id',
        'domain',
        'is_primary',
        'status',
        'ssl_status',
        'verified_at',
    ];

    protected $casts = [
        'is_primary'  => 'boolean',
        'verified_at' => 'datetime',
        'reseller_id' => 'string',
    ];

    public function reseller(): BelongsTo
    {
        return $this->belongsTo(Reseller::class);
    }
}
