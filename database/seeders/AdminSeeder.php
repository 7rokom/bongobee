<?php

namespace Database\Seeders;

use App\Models\Admin;
use App\Models\Counter;
use App\Models\SiteSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('ADMIN_EMAIL', '786.mahfuzurrahman@gmail.com');
        $name = env('ADMIN_NAME', 'Admin');
        $password = env('ADMIN_PASSWORD', 'admin123');

        Admin::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
            ]
        );

        Counter::updateOrCreate(
            ['id' => 'order_number'],
            ['value' => 1000]
        );

        SiteSetting::updateOrCreate(
            ['id' => 'general'],
            ['value' => [
                'site_name' => 'BongoBee',
                'tagline' => '',
                'primary_color' => '#8B5CF6',
                'secondary_color' => '#7C3AED',
                'phone' => '',
                'email' => $email,
                'address' => '',
                'whatsapp_number' => '',
            ]]
        );

        SiteSetting::updateOrCreate(
            ['id' => 'fraud_settings'],
            ['value' => [
                'fraud_check_enabled' => false,
                'device_block_enabled' => false,
                'min_delivery_percentage' => 0,
                'bdcourier_api_key' => '',
            ]]
        );

        $this->command->info("Admin created: {$email}");
    }
}
