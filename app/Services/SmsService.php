<?php

namespace App\Services;

use App\Models\SiteSetting;
use App\Models\SmsQueue;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsService
{
    private const API_URL     = 'http://bulksmsbd.net/api/smsapi';
    private const BALANCE_URL = 'http://bulksmsbd.net/api/getBalanceApi';

    private function credentials(): array
    {
        $blob = SiteSetting::get('frontend_blob', []);
        return [
            'api_key'  => $blob['bulkSmsApiKey']  ?? env('BULKSMS_API_KEY', ''),
            'senderid' => $blob['bulkSmsSenderId'] ?? env('BULKSMS_SENDER_ID', ''),
        ];
    }

    private function http(): \Illuminate\Http\Client\PendingRequest
    {
        $caBundle = env('CURL_CA_BUNDLE') ?: ini_get('curl.cainfo') ?: true;
        return Http::timeout(30)->withOptions([
            'verify' => $caBundle,
            'curl'   => [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4],
        ]);
    }

    private function parseResponseCode(string $body): int
    {
        $json = @json_decode($body, true);
        if (isset($json['response_code'])) return (int) $json['response_code'];
        // Plain-text fallback: the API sometimes returns just the code as text
        if (preg_match('/\b(202|10\d{2})\b/', $body, $m)) return (int) $m[1];
        return 0;
    }

    /**
     * Send one message to one or many phone numbers.
     *
     * @param string|string[] $phones  Single number or array of numbers (comma-separated in one API call)
     * @return array{ok: bool, response_code: int, response: string}
     */
    public function send(string|array $phones, string $message): array
    {
        $creds = $this->credentials();
        if (empty($creds['api_key'])) {
            Log::warning('BulkSMS API key not configured');
            return ['ok' => false, 'response_code' => 0, 'response' => 'API key সেট করা নেই'];
        }

        $numberStr = is_array($phones) ? implode(',', $phones) : $phones;

        try {
            $response = $this->http()->get(self::API_URL, [
                'api_key'  => $creds['api_key'],
                'type'     => 'text',
                'number'   => $numberStr,
                'senderid' => $creds['senderid'],
                'message'  => $message,
            ]);

            $body = $response->body();
            $code = $this->parseResponseCode($body);
            $ok   = $code === 202;

            if (!$ok) Log::warning('BulkSMS response_code ' . $code, ['phones' => $numberStr, 'body' => $body]);

            return ['ok' => $ok, 'response_code' => $code, 'response' => $body];
        } catch (\Throwable $e) {
            Log::error('SMS send failed', ['phones' => $numberStr, 'error' => $e->getMessage()]);
            return ['ok' => false, 'response_code' => 0, 'response' => $e->getMessage()];
        }
    }

    public function getBalance(): array
    {
        $creds = $this->credentials();
        if (empty($creds['api_key'])) return ['balance' => null, 'error' => 'API key সেট করা নেই'];
        try {
            $resp = $this->http()->get(self::BALANCE_URL, ['api_key' => $creds['api_key']]);
            return ['balance' => $resp->json('balance') ?? $resp->body()];
        } catch (\Throwable $e) {
            return ['balance' => null, 'error' => $e->getMessage()];
        }
    }

    public function processPendingQueue(int $limit = 50): array
    {
        $items   = SmsQueue::where('status', 'pending')->lockForUpdate()->limit($limit)->get();
        $results = ['sent' => 0, 'failed' => 0];

        foreach ($items as $item) {
            $item->update(['status' => 'processing']);
            $r = $this->send($item->phone, $item->message);
            $item->update([
                'status'        => $r['ok'] ? 'sent' : 'failed',
                'response_code' => (string) $r['response_code'],
                'sent_at'       => $r['ok'] ? now() : null,
            ]);
            $r['ok'] ? $results['sent']++ : $results['failed']++;
        }

        return $results;
    }
}
