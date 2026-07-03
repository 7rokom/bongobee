<?php

namespace Database\Seeders;

use App\Models\Admin;
use App\Models\Counter;
use App\Models\SiteSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * DefaultSettingsSeeder
 *
 * Seeds all settings required for first boot.
 * Safe to re-run (uses updateOrCreate / firstOrCreate).
 * Called by the installer after migrations.
 */
class DefaultSettingsSeeder extends Seeder
{
    public function run(): void
    {
        // ── Admin account ──────────────────────────────────────────────────
        $email    = env('ADMIN_EMAIL', '');
        $name     = env('ADMIN_NAME', 'Admin');
        $password = env('ADMIN_PASSWORD', '');

        if ($email && $password) {
            Admin::updateOrCreate(
                ['email' => $email],
                ['name' => $name, 'email' => $email, 'password' => Hash::make($password)]
            );
            $this->command->info("Admin: {$email}");
        }

        // ── Counters ───────────────────────────────────────────────────────
        Counter::firstOrCreate(['id' => 'order_number'],          ['value' => 1000]);
        Counter::firstOrCreate(['id' => 'reseller_order_number'], ['value' => 1000]);
        Counter::firstOrCreate(['id' => 'digital_order_number'],  ['value' => 1000]);

        // ── General site settings ──────────────────────────────────────────
        SiteSetting::updateOrCreate(['id' => 'general'], ['value' => [
            'site_name'        => env('APP_NAME', 'BongoBee'),
            'tagline'          => '',
            'primary_color'    => '#8B5CF6',
            'secondary_color'  => '#7C3AED',
            'phone'            => '',
            'email'            => $email,
            'address'          => '',
            'whatsapp_number'  => '',
            'currency'         => 'BDT',
            'language'         => 'bn',
            'logo_url'         => '',
            'favicon_url'      => '',
            'facebook_url'     => '',
            'youtube_url'      => '',
            'footer_credit'    => '© ' . date('Y') . ' ' . env('APP_NAME', 'BongoBee') . '. All rights reserved.',
            'home_products_per_row'        => 4,
            'home_products_per_row_mobile' => 2,
            'shop_products_per_row'        => 4,
            'shop_products_per_row_mobile' => 2,
            'card_title_size'              => 14,
            'card_price_size'              => 15,
        ]]);

        // ── Fraud settings ─────────────────────────────────────────────────
        SiteSetting::updateOrCreate(['id' => 'fraud_settings'], ['value' => [
            'fraud_check_enabled'    => false,
            'device_block_enabled'   => false,
            'min_delivery_percentage'=> 0,
            'bdcourier_api_key'      => '',
            'cooldown_minutes'       => 30,
            'cooldown_enabled'       => false,
        ]]);

        // ── Default courier settings (empty — configure via admin panel) ───
        SiteSetting::updateOrCreate(['id' => 'courier_steadfast'], ['value' => [
            'api_key'    => env('STEADFAST_API_KEY', ''),
            'secret_key' => env('STEADFAST_SECRET_KEY', ''),
            'enabled'    => false,
        ]]);

        SiteSetting::updateOrCreate(['id' => 'courier_carrybee'], ['value' => [
            'client_id'      => '',
            'client_secret'  => '',
            'client_context' => '',
            'enabled'        => false,
        ]]);

        // ── SMS settings ───────────────────────────────────────────────────
        SiteSetting::updateOrCreate(['id' => 'sms_settings'], ['value' => [
            'api_key'    => env('BULKSMS_API_KEY', ''),
            'sender_id'  => '',
            'enabled'    => false,
        ]]);

        // ── Push notification settings ─────────────────────────────────────
        SiteSetting::updateOrCreate(['id' => 'push_settings'], ['value' => [
            'vapid_public'  => env('VAPID_PUBLIC_KEY', ''),
            'vapid_private' => env('VAPID_PRIVATE_KEY', ''),
            'enabled'       => false,
        ]]);

        // ── Digital store settings ─────────────────────────────────────────
        SiteSetting::updateOrCreate(['id' => 'digital_settings'], ['value' => [
            'enabled'       => false,
            'delivery_text' => 'ডেলিভারি: ২৪ ঘণ্টার মধ্যে',
        ]]);

        // ── Header/footer (empty, configurable via admin) ──────────────────
        SiteSetting::updateOrCreate(['id' => 'header_footer'], ['value' => [
            'header_code' => '',
            'body_code'   => '',
            'footer_code' => '',
            'adsense_code' => '',
            'ads_txt_code' => '',
        ]]);

        $this->command->info('DefaultSettingsSeeder complete.');
    }
}
