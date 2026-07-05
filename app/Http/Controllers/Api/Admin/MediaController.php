<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MediaController extends Controller
{
    private const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp'];
    private const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
    private const VIDEO_EXT = ['mp4', 'webm', 'mov', 'avi', 'mkv'];

    private function mediaType(string $path): string
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if (in_array($ext, self::IMAGE_EXT)) return 'image';
        if (in_array($ext, self::AUDIO_EXT)) return 'audio';
        if (in_array($ext, self::VIDEO_EXT)) return 'video';
        return 'other';
    }

    public function index(): JsonResponse
    {
        $disk = Storage::disk('public');
        $files = [];
        foreach (['products', 'audio', 'media', 'images', 'digital'] as $folder) {
            if (!$disk->exists($folder)) continue;
            foreach ($disk->allFiles($folder) as $f) {
                $files[] = [
                    'path' => $f,
                    'url'  => url('storage/' . $f),
                    'name' => basename($f),
                    'folder' => $folder,
                    'size' => $disk->size($f),
                    'type' => $this->mediaType($f),
                    'last_modified' => $disk->lastModified($f),
                ];
            }
        }
        usort($files, fn($a, $b) => $b['last_modified'] - $a['last_modified']);
        return response()->json($files);
    }

    public function upload(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|max:20480']); // 20 MB
        $ext = strtolower($request->file('file')->getClientOriginalExtension());
        $folder = in_array($ext, self::IMAGE_EXT) ? 'products'
                : (in_array($ext, self::AUDIO_EXT) ? 'audio' : 'media');
        $path = $request->file('file')->store($folder, 'public');
        return response()->json([
            'path'   => $path,
            'url'    => url('storage/' . $path),
            'name'   => basename($path),
            'folder' => $folder,
            'size'   => Storage::disk('public')->size($path),
            'type'   => $this->mediaType($path),
            'last_modified' => time(),
        ]);
    }

    public function delete(Request $request): JsonResponse
    {
        $path = $request->input('path');
        if ($path) Storage::disk('public')->delete($path);
        return response()->json(['message' => 'Deleted']);
    }
}
