<?php

namespace App\Services;

use App\Models\BlockedCustomer;
use App\Models\Order;
use App\Models\SiteSetting;

class FraudCheckService
{
    private array $settings;

    public function __construct()
    {
        $this->settings = SiteSetting::get('fraud_settings', [
            'fraud_check_enabled' => false,
            'device_block_enabled' => false,
            'min_delivery_percentage' => 0,
        ]);
    }

    public function check(string $phone, ?string $deviceFingerprint, ?string $ip): array
    {
        // Check blocked customer list
        if (BlockedCustomer::where('phone', $phone)->exists()) {
            return ['blocked' => true, 'reason' => 'blocked_phone'];
        }

        if (!($this->settings['fraud_check_enabled'] ?? false)) {
            return ['blocked' => false];
        }

        // Check device fingerprint
        if ($deviceFingerprint && ($this->settings['device_block_enabled'] ?? false)) {
            $deviceBlocked = BlockedCustomer::where('device_fingerprint', $deviceFingerprint)->exists();
            if ($deviceBlocked) {
                return ['blocked' => true, 'reason' => 'blocked_device'];
            }
        }

        // Check delivery rate
        $minRate = (float) ($this->settings['min_delivery_percentage'] ?? 0);
        if ($minRate > 0) {
            $totalOrders = Order::where('customer_phone', $phone)->count();
            if ($totalOrders >= 3) {
                $delivered = Order::where('customer_phone', $phone)
                    ->where('status', 'ডেলিভারড')
                    ->count();
                $rate = $totalOrders > 0 ? ($delivered / $totalOrders) * 100 : 100;
                if ($rate < $minRate) {
                    return ['blocked' => true, 'reason' => 'low_delivery_rate', 'rate' => $rate];
                }
            }
        }

        return ['blocked' => false];
    }
}
