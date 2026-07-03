<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SmsCampaign;
use App\Models\SmsQueue;
use App\Models\PushSubscription;
use App\Models\PushCampaign;
use App\Models\ShortLink;
use App\Models\YoutubeSource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MarketingController extends Controller
{
    // ---- Bulk SMS ----
    public function smsCampaigns(): JsonResponse
    {
        return response()->json(SmsCampaign::orderByDesc('created_at')->paginate(20));
    }

    public function createSmsCampaign(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string',
            'message' => 'required|string',
            'target' => 'nullable|in:all,delivered,custom',
            'phone_numbers' => 'nullable|array',
        ]);

        $campaign = SmsCampaign::create([
            ...$data,
            'total_count' => count($data['phone_numbers'] ?? []),
            'status' => 'pending',
        ]);

        // Queue SMS messages
        if (!empty($data['phone_numbers'])) {
            $queue = array_map(fn($phone) => [
                'id' => (string) Str::uuid(),
                'campaign_id' => $campaign->id,
                'phone' => $phone,
                'message' => $data['message'],
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ], $data['phone_numbers']);

            SmsQueue::insert($queue);
        }

        return response()->json($campaign, 201);
    }

    // SMS Gateway (Android relay)
    public function smsGatewayPending(): JsonResponse
    {
        $pending = SmsQueue::where('status', 'gateway_pending')
            ->select('id', 'phone', 'message')
            ->limit(10)
            ->get();
        return response()->json($pending);
    }

    public function smsGatewayReport(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => 'required|uuid|exists:sms_queue,id',
            'status' => 'required|in:sent,failed',
            'response' => 'nullable|string',
        ]);
        SmsQueue::where('id', $data['id'])->update([
            'status' => $data['status'],
            'response_code' => $data['response'] ?? null,
            'sent_at' => now(),
        ]);
        return response()->json(['message' => 'Updated.']);
    }

    // ---- Push Notifications ----
    public function pushSubscribe(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => 'required|string',
            'p256dh_key' => 'nullable|string',
            'auth_key' => 'nullable|string',
            'section' => 'nullable|string',
        ]);
        PushSubscription::updateOrCreate(
            ['endpoint' => $data['endpoint']],
            $data + ['is_active' => true]
        );
        return response()->json(['message' => 'Subscribed.']);
    }

    public function pushCampaigns(): JsonResponse
    {
        return response()->json(PushCampaign::orderByDesc('created_at')->paginate(20));
    }

    public function createPushCampaign(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string',
            'body' => 'required|string',
            'image_url' => 'nullable|string',
            'click_url' => 'nullable|string',
            'section' => 'nullable|string',
        ]);

        $total = PushSubscription::where('is_active', true)
            ->when($data['section'] ?? 'all' !== 'all', fn($q) => $q->where('section', $data['section']))
            ->count();

        $campaign = PushCampaign::create([...$data, 'total_count' => $total, 'status' => 'pending']);

        // TODO: dispatch SendPushNotificationJob
        return response()->json($campaign, 201);
    }

    // ---- Link Shortener ----
    public function shortLinks(): JsonResponse
    {
        return response()->json(ShortLink::orderByDesc('created_at')->paginate(20));
    }

    public function storeShortLink(Request $request): JsonResponse
    {
        $data = $request->validate([
            'destination_url' => 'required|string',
            'slug' => 'nullable|string|unique:short_links',
            'title' => 'nullable|string',
        ]);
        $data['slug'] = $data['slug'] ?? Str::random(6);
        return response()->json(ShortLink::create($data), 201);
    }

    public function updateShortLink(Request $request, string $id): JsonResponse
    {
        $link = ShortLink::findOrFail($id);
        $link->update($request->validate([
            'destination_url' => 'sometimes|string',
            'slug' => 'sometimes|string|unique:short_links,slug,'.$id,
            'title' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]));
        return response()->json($link);
    }

    public function destroyShortLink(string $id): JsonResponse
    {
        ShortLink::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- YouTube Sync ----
    public function youtubeSources(): JsonResponse
    {
        return response()->json(YoutubeSource::orderByDesc('created_at')->get());
    }

    public function storeYoutubeSource(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string',
            'source_type' => 'required|in:channel,playlist,search,rss',
            'source_value' => 'required|string',
            'category' => 'nullable|string',
            'author' => 'nullable|string',
            'max_videos' => 'nullable|integer',
            'exclude_shorts' => 'nullable|boolean',
            'enabled' => 'nullable|boolean',
        ]);
        return response()->json(YoutubeSource::create($data), 201);
    }

    public function updateYoutubeSource(Request $request, string $id): JsonResponse
    {
        $source = YoutubeSource::findOrFail($id);
        $source->update($request->validate([
            'name' => 'sometimes|string',
            'source_type' => 'sometimes|in:channel,playlist,search,rss',
            'source_value' => 'sometimes|string',
            'category' => 'nullable|string',
            'author' => 'nullable|string',
            'max_videos' => 'nullable|integer',
            'exclude_shorts' => 'nullable|boolean',
            'enabled' => 'nullable|boolean',
        ]));
        return response()->json($source);
    }

    public function destroyYoutubeSource(string $id): JsonResponse
    {
        YoutubeSource::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }
}
