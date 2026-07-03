<?php

namespace App\Services;

use App\Models\Order;
use App\Models\SiteSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CourierService
{
    public function dispatchSteadfast(Order $order): array
    {
        $settings = SiteSetting::get('courier_settings', []);
        $apiKey = $settings['steadfast_api_key'] ?? env('STEADFAST_API_KEY', '');
        $secretKey = $settings['steadfast_secret_key'] ?? env('STEADFAST_SECRET_KEY', '');

        if (empty($apiKey) || empty($secretKey)) {
            return ['success' => false, 'message' => 'Steadfast credentials not configured'];
        }

        try {
            $response = Http::withHeaders([
                'Api-Key' => $apiKey,
                'Secret-Key' => $secretKey,
                'Content-Type' => 'application/json',
            ])->post('https://portal.packzy.com/api/v1/create_order', [
                'invoice' => (string) $order->invoice_number,
                'recipient_name' => $order->customer_name,
                'recipient_phone' => $order->customer_phone,
                'recipient_address' => $order->customer_address,
                'cod_amount' => $order->total_amount,
                'note' => $order->note ?? '',
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $order->update([
                    'courier_name' => 'steadfast',
                    'courier_invoice_id' => $data['consignment']['tracking_code'] ?? null,
                ]);
                return ['success' => true, 'data' => $data];
            }

            return ['success' => false, 'message' => $response->body()];
        } catch (\Exception $e) {
            Log::error('Steadfast dispatch failed', ['order' => $order->id, 'error' => $e->getMessage()]);
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function dispatchCarrybee(Order $order): array
    {
        $clientId = env('CARRYBEE_CLIENT_ID', '');
        $secret = env('CARRYBEE_SECRET', '');

        if (empty($clientId) || empty($secret)) {
            return ['success' => false, 'message' => 'Carrybee credentials not configured'];
        }

        try {
            // Authenticate first
            $authResponse = Http::post('https://api.carrybee.com/oauth/token', [
                'grant_type' => 'client_credentials',
                'client_id' => $clientId,
                'client_secret' => $secret,
            ]);

            if (!$authResponse->successful()) {
                return ['success' => false, 'message' => 'Carrybee auth failed'];
            }

            $token = $authResponse->json('access_token');

            $response = Http::withToken($token)->post('https://api.carrybee.com/api/v1/orders', [
                'invoice_id' => (string) $order->invoice_number,
                'recipient_name' => $order->customer_name,
                'recipient_mobile' => $order->customer_phone,
                'recipient_address' => $order->customer_address,
                'cod_amount' => $order->total_amount,
                'delivery_type' => 'regular',
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $order->update([
                    'courier_name' => 'carrybee',
                    'courier_invoice_id' => $data['tracking_id'] ?? null,
                ]);
                return ['success' => true, 'data' => $data];
            }

            return ['success' => false, 'message' => $response->body()];
        } catch (\Exception $e) {
            Log::error('Carrybee dispatch failed', ['order' => $order->id, 'error' => $e->getMessage()]);
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getCourierBalance(string $courier): array
    {
        $settings = SiteSetting::get('courier_settings', []);

        if ($courier === 'steadfast') {
            $apiKey = $settings['steadfast_api_key'] ?? env('STEADFAST_API_KEY', '');
            $secretKey = $settings['steadfast_secret_key'] ?? env('STEADFAST_SECRET_KEY', '');
            if (empty($apiKey)) return ['success' => false, 'message' => 'Not configured'];

            try {
                $response = Http::withHeaders([
                    'Api-Key' => $apiKey,
                    'Secret-Key' => $secretKey,
                ])->get('https://portal.packzy.com/api/v1/get_balance');
                return $response->successful()
                    ? ['success' => true, 'balance' => $response->json('current_balance')]
                    : ['success' => false, 'message' => $response->body()];
            } catch (\Exception $e) {
                return ['success' => false, 'message' => $e->getMessage()];
            }
        }

        return ['success' => false, 'message' => 'Unknown courier'];
    }
}
