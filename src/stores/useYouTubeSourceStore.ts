import { create } from 'zustand';
import { api } from '@/lib/api';

export interface YouTubeSource {
  id: string;
  name: string;
  source_type: 'channel' | 'playlist' | 'search' | 'rss';
  source_value: string;
  category: string | null;
  author: string | null;
  max_videos: number;
  exclude_shorts: boolean;
  enabled: boolean;
  last_synced_at: string | null;
  last_sync_count: number;
  created_at: string;
}

interface State {
  sources: YouTubeSource[];
  loading: boolean;
  fetchSources: () => Promise<void>;
  addSource: (s: Omit<YouTubeSource, 'id' | 'last_synced_at' | 'last_sync_count' | 'created_at'>) => Promise<void>;
  updateSource: (id: string, updates: Partial<YouTubeSource>) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
}

export const useYouTubeSourceStore = create<State>((set) => ({
  sources: [],
  loading: false,
  fetchSources: async () => {
    set({ loading: true });
    try {
      const data = await api.get('/admin/mk/youtube-sources');
      set({ sources: (Array.isArray(data) ? data : []) as YouTubeSource[], loading: false });
    } catch (e) {
      console.error('[useYouTubeSourceStore.fetchSources]', e);
      set({ loading: false });
    }
  },
  addSource: async (s) => {
    const data = await api.post('/admin/mk/youtube-sources', s);
    set((st) => ({ sources: [data as YouTubeSource, ...st.sources] }));
  },
  updateSource: async (id, updates) => {
    await api.put(`/admin/mk/youtube-sources/${id}`, updates);
    set((st) => ({
      sources: st.sources.map((x) => (x.id === id ? { ...x, ...updates } : x)),
    }));
  },
  deleteSource: async (id) => {
    await api.del(`/admin/mk/youtube-sources/${id}`);
    set((st) => ({ sources: st.sources.filter((x) => x.id !== id) }));
  },
}));