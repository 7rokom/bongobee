<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ResellerDomain;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResellerDomainController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ResellerDomain::with('reseller')->orderByDesc('created_at');

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('domain', 'like', "%{$search}%")
                  ->orWhereHas('reseller', fn ($r) => $r->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json($query->paginate(20));
    }

    public function approve(string $id): JsonResponse
    {
        $domain = ResellerDomain::findOrFail($id);
        $domain->update(['status' => 'verified', 'verified_at' => now()]);
        return response()->json(['message' => 'Domain approved.', 'domain' => $domain]);
    }

    public function reject(string $id): JsonResponse
    {
        $domain = ResellerDomain::findOrFail($id);
        $domain->update(['status' => 'failed']);
        return response()->json(['message' => 'Domain rejected.', 'domain' => $domain]);
    }

    public function disable(string $id): JsonResponse
    {
        $domain = ResellerDomain::findOrFail($id);
        $domain->update(['status' => 'inactive']);
        return response()->json(['message' => 'Domain disabled.', 'domain' => $domain]);
    }

    public function destroy(string $id): JsonResponse
    {
        ResellerDomain::findOrFail($id)->delete();
        return response()->json(['message' => 'Domain deleted.']);
    }
}
