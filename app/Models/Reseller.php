<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens;

class Reseller extends Authenticatable
{
    use HasApiTokens, HasUuids;

    protected $fillable = [
        'name', 'email', 'phone', 'shop_name', 'password', 'status',
        'referral_code', 'contact_phone', 'contact_whatsapp',
        'header_code', 'body_code', 'footer_code',
        'sms_template_confirmed', 'sms_template_shipped',
        // Phase 3 frontend columns
        'is_active', 'balance', 'approval_status', 'deactivation_note', 'serial_number',
        'fingerprint', 'sms_pending_template', 'sms_confirmed_template',
        'sms_shipment_template', 'sms_followup_template',
        // Storefront branding (custom domain)
        'storefront_logo_url', 'storefront_favicon_url', 'storefront_bio',
        'storefront_address', 'storefront_phone', 'storefront_footer_credit',
        'storefront_legal_pages', 'storefront_facebook_url', 'storefront_youtube_url',
        'storefront_twitter_url', 'storefront_instagram_url',
    ];
    protected $hidden = ['password'];

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function (self $reseller) {
            if ($reseller->serial_number === null) {
                $reseller->serial_number = (static::max('serial_number') ?? 0) + 1;
            }
        });
    }

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'balance' => 'decimal:2',
            'storefront_legal_pages' => 'array',
        ];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(ResellerOrder::class);
    }

    public function paymentMethods(): HasMany
    {
        return $this->hasMany(ResellerPaymentMethod::class);
    }

    public function paymentRequests(): HasMany
    {
        return $this->hasMany(PaymentRequest::class);
    }

    public function productPrices(): HasMany
    {
        return $this->hasMany(ResellerProductPrice::class);
    }
}
