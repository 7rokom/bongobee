<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

// Phase 3 — courier dispatch proxy. Replaces the Supabase `steadfast` and
// `carrybee` edge functions. The React courier code (admin Orders + Reseller
// Orders) calls these with an action-based payload (credentials in the body)
// and consumes the upstream courier JSON unchanged, so the UI is untouched.
//
// Both handlers always respond 200 with the upstream JSON embedded (errors live
// inside the body as `status` / `message` / `errors` / `error`), exactly like
// the old edge functions, so the frontend's own error handling still applies.
class FrontendCourierController extends Controller
{
    // ---- Steadfast (steadfast.com.bd/api/v1) ----
    public function steadfast(Request $request): JsonResponse
    {
        $action = $request->input('action', 'create_order');
        $settings = SiteSetting::get('courier_steadfast', []);
        $apiKey = $request->input('apiKey') ?: ($settings['apiKey'] ?? env('STEADFAST_API_KEY', ''));
        $secretKey = $request->input('secretKey') ?: ($settings['secretKey'] ?? env('STEADFAST_SECRET_KEY', ''));

        if (!$apiKey || !$secretKey) {
            return response()->json(['status' => 401, 'message' => 'Steadfast API কনফিগার করা হয়নি']);
        }

        // Official API base per Steadfast docs: https://portal.packzy.com/api/v1
        $base = env('STEADFAST_API_BASE', 'https://portal.packzy.com/api/v1');
        // SSL: prefer CURL_CA_BUNDLE env → php.ini curl.cainfo → system default (true).
        // CURLOPT_IPRESOLVE: force IPv4 to fix DNS resolution failures on Windows/Laragon.
        $caBundle = env('CURL_CA_BUNDLE') ?: ini_get('curl.cainfo') ?: true;
        $http = Http::withHeaders([
            'Api-Key' => $apiKey,
            'Secret-Key' => $secretKey,
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ])->timeout(30)->withOptions([
            'verify' => $caBundle,
            'curl' => [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4],
        ]);

        try {
            if ($action === 'create_order') {
                $resp = $http->post("$base/create_order", [
                    'invoice' => (string) $request->input('invoice'),
                    'recipient_name' => $request->input('recipient_name'),
                    'recipient_phone' => $request->input('recipient_phone'),
                    'recipient_address' => $request->input('recipient_address'),
                    'cod_amount' => $request->input('cod_amount', 0),
                    'note' => $request->input('note', ''),
                    'item_description' => $request->input('item_description', ''),
                    'delivery_type' => $request->input('delivery_type', 0),
                ]);
                $json = $resp->json() ?? [];
                if (!isset($json['status'])) $json['status'] = $resp->status();
                return response()->json($json);
            }
            if ($action === 'get_balance') {
                return response()->json($http->get("$base/get_balance")->json() ?? []);
            }
            if ($action === 'status') {
                $cid = $request->input('consignment_id');
                return response()->json($http->get("$base/status_by_cid/$cid")->json() ?? []);
            }
            return response()->json(['status' => 400, 'message' => 'Unknown action: ' . $action]);
        } catch (\Throwable $e) {
            return response()->json(['status' => 500, 'message' => $e->getMessage()]);
        }
    }

    // ---- CarryBee (developers.carrybee.com/api/v2, Client-ID/Secret/Context headers) ----
    public function carrybee(Request $request): JsonResponse
    {
        $action = $request->input('action', 'create_order');
        $settings = SiteSetting::get('courier_carrybee', []);
        $clientId      = $request->input('clientId')     ?: ($settings['clientId']      ?? '');
        $clientSecret  = $request->input('clientSecret') ?: ($settings['clientSecret']  ?? '');
        $clientContext = $request->input('clientContext') ?: ($settings['clientContext'] ?? '');

        if (!$clientId || !$clientSecret || !$clientContext) {
            return response()->json(['error' => 'CarryBee API কনফিগার করা হয়নি — Courier Setup-এ Client ID, Secret ও Context দিন']);
        }

        $base = 'https://developers.carrybee.com/api/v2';
        $caBundle = env('CURL_CA_BUNDLE') ?: ini_get('curl.cainfo') ?: true;
        $curlOpts = ['verify' => $caBundle, 'curl' => [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4]];

        $http = Http::withHeaders([
            'Client-ID'      => $clientId,
            'Client-Secret'  => $clientSecret,
            'Client-Context' => $clientContext,
            'Content-Type'   => 'application/json',
            'Accept'         => 'application/json',
        ])->timeout(30)->withOptions($curlOpts);

        try {
            if ($action === 'get_cities') {
                $resp = $http->get("$base/cities");
                return response()->json($resp->json() ?? ['error' => 'no response']);
            }
            if ($action === 'get_zones') {
                $cityId = $request->input('city_id');
                $resp = $http->get("$base/cities/$cityId/zones");
                return response()->json($resp->json() ?? ['error' => 'no response']);
            }
            if ($action === 'get_areas') {
                $cityId = $request->input('city_id');
                $zoneId = $request->input('zone_id');
                $resp = $http->get("$base/cities/$cityId/zones/$zoneId/areas");
                return response()->json($resp->json() ?? ['error' => 'no response']);
            }
            if ($action === 'area_suggestion') {
                $resp = $http->get("$base/area-suggestion", ['search' => $request->input('search', '')]);
                return response()->json($resp->json() ?? ['error' => 'no response']);
            }
            if ($action === 'address_details') {
                $query = $request->input('query', '');
                $resp = $http->post("$base/address-details", ['query' => $query]);
                $body = $resp->json();
                Log::info('CarryBee address_details', ['status' => $resp->status(), 'response' => $body]);
                return response()->json($body ?? ['error' => 'no response']);
            }
            if ($action === 'get_stores') {
                $resp = $http->get("$base/stores");
                Log::info('CarryBee get_stores', ['status' => $resp->status(), 'response' => $resp->json()]);
                return response()->json($resp->json() ?? ['error' => 'no response']);
            }
            if ($action === 'create_store') {
                $payload = $request->except(['action', 'clientId', 'clientSecret', 'clientContext']);
                $resp = $http->post("$base/stores", $payload);
                $body = $resp->json();
                Log::info('CarryBee create_store', ['status' => $resp->status(), 'response' => $body]);
                return response()->json($body ?? ['error' => 'no response']);
            }
            if ($action === 'create_order') {
                $payload = $request->except(['action', 'clientId', 'clientSecret', 'clientContext']);
                $resp = $http->post("$base/orders", $payload);
                $body = $resp->json();
                Log::info('CarryBee create_order', [
                    'status'   => $resp->status(),
                    'payload'  => $payload,
                    'response' => $body,
                ]);
                return response()->json($body ?? ['error' => 'no response', 'http_status' => $resp->status()]);
            }
            if ($action === 'order_details') {
                $cid = $request->input('consignment_id');
                $resp = $http->get("$base/orders/$cid/details");
                return response()->json($resp->json() ?? ['error' => 'no response']);
            }
            if ($action === 'cancel_order') {
                $cid = $request->input('consignment_id');
                $resp = $http->post("$base/orders/$cid/cancel");
                return response()->json($resp->json() ?? ['error' => 'no response']);
            }
            return response()->json(['error' => 'Unknown action: ' . $action]);
        } catch (\Throwable $e) {
            Log::error('CarryBee error', ['action' => $action, 'error' => $e->getMessage()]);
            return response()->json(['error' => $e->getMessage()]);
        }
    }
}
