<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

class PushNotificationService
{
    private string $vapidPublic;
    private string $vapidPrivate;

    public function __construct()
    {
        $this->vapidPublic  = env('VAPID_PUBLIC_KEY', '');
        $this->vapidPrivate = env('VAPID_PRIVATE_KEY', '');
    }

    public function sendToAll(string $title, string $body, ?string $url = null, ?string $icon = null): array
    {
        return $this->sendToSubscriptions(PushSubscription::where('is_active', true)->get(), $title, $body, $url, $icon);
    }

    public function sendToSection(string $section, string $title, string $body, ?string $url = null): array
    {
        return $this->sendToSubscriptions(
            PushSubscription::where('section', $section)->where('is_active', true)->get(),
            $title, $body, $url
        );
    }

    private function sendToSubscriptions($subscriptions, string $title, string $body, ?string $url, ?string $icon = null): array
    {
        if (empty($this->vapidPublic) || empty($this->vapidPrivate)) {
            Log::warning('VAPID keys not configured for push notifications');
            return ['sent' => 0, 'failed' => 0, 'error' => 'VAPID keys not configured'];
        }

        if ($subscriptions->isEmpty()) {
            return ['sent' => 0, 'failed' => 0];
        }

        $payload = json_encode([
            'title' => $title,
            'body'  => $body,
            'url'   => $url,
            'icon'  => $icon ?? '/icon-192.png',
        ]);

        $webPush = new WebPush([
            'VAPID' => [
                'subject'    => config('app.url'),
                'publicKey'  => $this->vapidPublic,
                'privateKey' => $this->vapidPrivate,
            ],
        ]);
        $webPush->setReuseVAPIDHeaders(true);

        // Index subscriptions by endpoint so we can act on results
        $subMap = [];
        foreach ($subscriptions as $sub) {
            $subscription = Subscription::create([
                'endpoint' => $sub->endpoint,
                'keys'     => [
                    'p256dh' => $sub->p256dh_key,
                    'auth'   => $sub->auth_key,
                ],
            ]);
            $webPush->queueNotification($subscription, $payload);
            $subMap[$sub->endpoint] = $sub;
        }

        $sent   = 0;
        $failed = 0;

        foreach ($webPush->flush() as $report) {
            $endpoint = $report->getRequest()->getUri()->__toString();
            // Endpoint in the report is the push service URL, not necessarily our stored key
            // Find by matching stored endpoint prefix
            $matchedSub = null;
            foreach ($subMap as $ep => $s) {
                if (str_starts_with($endpoint, $ep) || str_starts_with($ep, $endpoint)) {
                    $matchedSub = $s;
                    break;
                }
            }

            if ($report->isSuccess()) {
                $sent++;
            } else {
                $failed++;
                $statusCode = $report->getResponse()?->getStatusCode();
                Log::warning('Push failed', ['endpoint' => substr($endpoint, 0, 60), 'status' => $statusCode]);
                // 410 Gone or 404 = subscription expired, deactivate it
                if ($matchedSub && in_array($statusCode, [404, 410])) {
                    $matchedSub->update(['is_active' => false]);
                }
            }
        }

        return ['sent' => $sent, 'failed' => $failed];
    }
}
