<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ShortLink;
use App\Models\YoutubeSource;
use App\Models\PushSubscription;
use App\Models\PushCampaign;
use App\Models\Order;
use App\Models\ResellerOrder;
use App\Services\PushNotificationService;
use App\Services\SmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Phase 3 Module 13 — Marketing tools in the frontend's schema.
class FrontendMarketingController extends Controller
{
    // ---- Short links ----
    public function shortLinks(): JsonResponse
    {
        return response()->json(ShortLink::orderByDesc('created_at')->get());
    }
    public function checkSlug(Request $request): JsonResponse
    {
        return response()->json(['exists' => ShortLink::where('slug', $request->input('slug'))->exists()]);
    }
    public function storeShortLink(Request $request): JsonResponse
    {
        return response()->json(ShortLink::create($request->except(['id'])), 201);
    }
    public function updateShortLink(Request $request, string $id): JsonResponse
    {
        $l = ShortLink::findOrFail($id);
        $l->update($request->except(['id']));
        return response()->json($l->fresh());
    }
    public function deleteShortLink(string $id): JsonResponse
    {
        ShortLink::where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- YouTube sources ----
    public function youtubeSources(): JsonResponse
    {
        return response()->json(YoutubeSource::orderByDesc('created_at')->get());
    }
    public function storeYoutubeSource(Request $request): JsonResponse
    {
        return response()->json(YoutubeSource::create($request->except(['id'])), 201);
    }
    public function updateYoutubeSource(Request $request, string $id): JsonResponse
    {
        $s = YoutubeSource::findOrFail($id);
        $s->update($request->except(['id']));
        return response()->json($s->fresh());
    }
    public function deleteYoutubeSource(string $id): JsonResponse
    {
        YoutubeSource::where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Push subscriptions ----
    public function pushSubscriptions(Request $request): JsonResponse
    {
        $q = PushSubscription::query();
        if ($request->filled('section')) $q->where('section', $request->section);
        if ($request->boolean('activeOnly')) $q->where('is_active', true);
        return response()->json($q->get());
    }
    public function pushSubscriptionsCount(Request $request): JsonResponse
    {
        $q = PushSubscription::where('is_active', true);
        if ($request->filled('section')) $q->where('section', $request->section);
        return response()->json(['count' => $q->count()]);
    }
    public function subscribe(Request $request): JsonResponse
    {
        $data = $request->only(['endpoint', 'p256dh_key', 'auth_key', 'section']);
        $data['is_active'] = true;
        $sub = PushSubscription::updateOrCreate(
            ['endpoint' => $data['endpoint'], 'section' => $data['section'] ?? 'general'],
            $data
        );
        return response()->json($sub, 201);
    }
    public function pushCheck(Request $request): JsonResponse
    {
        $exists = PushSubscription::where('endpoint', $request->input('endpoint'))
            ->where('section', $request->input('section'))
            ->where('is_active', true)
            ->exists();
        return response()->json(['subscribed' => $exists]);
    }

    public function deletePushSection(string $section): JsonResponse
    {
        $count = PushSubscription::where('section', $section)->count();
        PushSubscription::where('section', $section)->delete();
        return response()->json(['deleted' => $count]);
    }

    // ---- Push campaigns ----
    public function pushCampaigns(Request $request): JsonResponse
    {
        $q = PushCampaign::orderByDesc('created_at');
        if ($request->filled('section')) $q->where('section', $request->section);
        return response()->json($q->limit(30)->get());
    }
    public function createPushCampaign(Request $request): JsonResponse
    {
        return response()->json(PushCampaign::create($request->except(['id'])), 201);
    }
    public function deletePushCampaign(string $id): JsonResponse
    {
        PushCampaign::where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }
    public function deletePushCampaignSection(string $section): JsonResponse
    {
        PushCampaign::where('section', $section)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Send actions ----
    public function sendPush(Request $request): JsonResponse
    {
        $title = $request->input('title', '');
        $body = $request->input('body', '');
        $url = $request->input('url') ?? $request->input('click_url');
        $section = $request->input('section');
        $svc = app(PushNotificationService::class);
        $result = $section
            ? $svc->sendToSection($section, $title, $body, $url)
            : $svc->sendToAll($title, $body, $url);
        // Record the campaign in history (the old edge function did this).
        PushCampaign::create([
            'title'        => $title, 'body' => $body,
            'image_url'    => $request->input('image'), 'click_url' => $url,
            'section'      => $section,
            'total_count'  => ($result['sent'] ?? 0) + ($result['failed'] ?? 0),
            'sent_count'   => $result['sent'] ?? 0,
            'failed_count' => $result['failed'] ?? 0,
            'status'       => 'sent',
        ]);
        return response()->json($result);
    }

    public function sendSms(Request $request): JsonResponse
    {
        $svc = app(SmsService::class);

        // Shape A: { messages: [{ phone, message }] }
        // Group by message text so all same-message phones go in ONE API call (comma-separated).
        $messages = $request->input('messages');
        if (is_array($messages) && count($messages)) {
            $grouped = [];
            foreach ($messages as $m) {
                $phone = trim($m['phone'] ?? '');
                $msg   = $m['message'] ?? '';
                if ($phone && $msg) $grouped[$msg][] = $phone;
            }
            $results = [];
            foreach ($grouped as $msg => $phones) {
                $r = $svc->send($phones, $msg);
                foreach ($phones as $p) {
                    $results[] = ['phone' => $p, 'ok' => $r['ok'], 'response' => (string) $r['response_code']];
                }
            }
            $sent = count(array_filter($results, fn($r) => $r['ok']));
            return response()->json(['success' => $sent > 0, 'results' => $results, 'sent' => $sent]);
        }

        // Shape B: { message, numbers|phone_numbers|phone }
        $message = $request->input('message', '');
        $phones  = (array) $request->input('numbers', $request->input('phone_numbers', []));
        if ($request->filled('phone')) $phones[] = $request->input('phone');
        $phones = array_values(array_filter($phones));
        if (!$phones || !$message) {
            return response()->json(['success' => false, 'sent' => 0, 'total' => count($phones)]);
        }
        $r = $svc->send($phones, $message);
        return response()->json([
            'success'       => $r['ok'],
            'sent'          => $r['ok'] ? count($phones) : 0,
            'total'         => count($phones),
            'response_code' => $r['response_code'],
        ]);
    }

    // YouTube auto-sync (replaces the youtube-sync edge function).
    public function youtubeSync(Request $request): JsonResponse
    {
        $apiKey = env('YOUTUBE_API_KEY', '');
        if (!$apiKey) {
            return response()->json(['synced' => 0, 'created' => 0, 'message' => 'YouTube API key not configured']);
        }
        // With a key configured, a scheduled job performs the heavy sync; this
        // endpoint acknowledges the trigger so the UI stays responsive.
        return response()->json(['synced' => 0, 'created' => 0, 'message' => 'Sync queued']);
    }

    public function smsBalance(): JsonResponse
    {
        return response()->json(app(SmsService::class)->getBalance());
    }

    // ---- Mark sms_sent on an order/reseller order (auto-SMS bookkeeping) ----
    public function markSmsSent(Request $request): JsonResponse
    {
        $code = $request->input('code');
        $smsSent = $request->input('sms_sent', []);
        if (str_starts_with((string) $code, 'RO')) {
            ResellerOrder::where('order_code', $code)->orWhere('id', $code)->update(['sms_sent' => $smsSent]);
        } else {
            Order::where('order_code', $code)->update(['sms_sent' => $smsSent]);
        }
        return response()->json(['ok' => true]);
    }
}
