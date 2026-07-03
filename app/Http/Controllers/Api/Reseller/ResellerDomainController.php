<?php

namespace App\Http\Controllers\Api\Reseller;

use App\Http\Controllers\Controller;
use App\Models\ResellerDomain;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ResellerDomainController extends Controller
{
    private function resellerId(): ?string
    {
        // Normal reseller login: their Sanctum token directly resolves
        if ($reseller = Auth::guard('reseller')->user()) {
            return (string) $reseller->id;
        }
        // Admin/employee impersonating a reseller: pass reseller_id as query or body param
        if (Auth::guard('admin')->user() || Auth::guard('employee')->user()) {
            $id = request()->query('reseller_id') ?? request()->input('reseller_id');
            return $id ? (string) $id : null;
        }
        return null;
    }

    public function index(): JsonResponse
    {
        $domains = ResellerDomain::where('reseller_id', $this->resellerId())
            ->orderByDesc('created_at')
            ->get();
        return response()->json($domains);
    }

    public function store(Request $request): JsonResponse
    {
        $resellerId = $this->resellerId();

        if (ResellerDomain::where('reseller_id', $resellerId)->exists()) {
            return response()->json(
                ['message' => 'আপনার ইতিমধ্যে একটি কাস্টম ডোমেইন আছে। প্রথমে সেটি মুছুন।'],
                422
            );
        }

        $data = $request->validate([
            'domain' => [
                'required',
                'string',
                'max:255',
                'unique:reseller_domains,domain',
                'regex:/^[a-zA-Z0-9][a-zA-Z0-9\-\.]*\.[a-zA-Z]{2,}$/',
            ],
        ]);

        $data['domain'] = preg_replace('#^https?://#', '', $data['domain']);
        $data['domain'] = rtrim($data['domain'], '/');

        $domain = ResellerDomain::create([
            'reseller_id' => $resellerId,
            'domain'      => $data['domain'],
            'is_primary'  => true,
            'status'      => 'pending',
            'ssl_status'  => 'none',
        ]);

        return response()->json($domain, 201);
    }

    public function destroy(string $id): JsonResponse
    {
        $domain = ResellerDomain::where('id', $id)
            ->where('reseller_id', $this->resellerId())
            ->firstOrFail();
        $domain->delete();
        return response()->json(['message' => 'ডোমেইন সরানো হয়েছে।']);
    }

    public function verifyDns(string $id): JsonResponse
    {
        $domain = ResellerDomain::where('id', $id)
            ->where('reseller_id', $this->resellerId())
            ->firstOrFail();

        $host        = $domain->domain;
        $cnameTarget = config('app.custom_domain_cname', 'store.bongobee.com');
        $serverIp    = config('app.custom_domain_server_ip', '');
        $resolved    = false;

        try {
            $cnameRecords = @dns_get_record($host, DNS_CNAME) ?: [];
            foreach ($cnameRecords as $record) {
                if (isset($record['target']) && rtrim($record['target'], '.') === $cnameTarget) {
                    $resolved = true;
                    break;
                }
            }

            if (!$resolved && $serverIp) {
                $aRecords = @dns_get_record($host, DNS_A) ?: [];
                foreach ($aRecords as $record) {
                    if (isset($record['ip']) && $record['ip'] === $serverIp) {
                        $resolved = true;
                        break;
                    }
                }
            }
        } catch (\Throwable) {
            $resolved = false;
        }

        if ($resolved) {
            $domain->update(['status' => 'verified', 'verified_at' => now()]);
            return response()->json(['message' => 'DNS যাচাই সফল!', 'domain' => $domain->fresh()]);
        }

        return response()->json([
            'message' => 'DNS যাচাই ব্যর্থ। সঠিক CNAME বা A রেকর্ড যোগ করুন এবং আবার চেষ্টা করুন।',
            'domain'  => $domain,
        ], 422);
    }
}
