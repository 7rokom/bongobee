import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { BlogPost } from '@/data/store-data';
import { api } from '@/lib/api';

interface BlogStore {
  posts: BlogPost[];
  loading: boolean;
  initialized: boolean;
  fetchPosts: () => Promise<void>;
  fetchPostBySlug: (slug: string, type?: string) => Promise<BlogPost | null>;
  addPost: (post: BlogPost) => Promise<void>;
  updatePost: (id: string, updates: Partial<BlogPost>) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
}

const mapRow = (r: any): BlogPost => ({
  id: r.id, title: r.title, slug: r.slug, excerpt: r.excerpt || '',
  content: r.content || '', image: r.image || '', galleryImages: r.gallery_images || [],
  date: r.date || '', author: r.author || '', category: r.category || '',
  type: r.type || 'post', status: r.status || 'published',
  metaDescription: r.meta_description, metaKeywords: r.meta_keywords,
  videoUrl: r.video_url || undefined,
});

const toRow = (p: Partial<BlogPost>) => {
  const r: any = {};
  if (p.title !== undefined) r.title = p.title;
  if (p.slug !== undefined) r.slug = p.slug;
  if (p.excerpt !== undefined) r.excerpt = p.excerpt;
  if (p.content !== undefined) r.content = p.content;
  if (p.image !== undefined) r.image = p.image;
  if (p.galleryImages !== undefined) r.gallery_images = p.galleryImages;
  if (p.date !== undefined) r.date = p.date;
  if (p.author !== undefined) r.author = p.author;
  if (p.category !== undefined) r.category = p.category;
  if (p.type !== undefined) r.type = p.type;
  if (p.status !== undefined) r.status = p.status;
  if (p.metaDescription !== undefined) r.meta_description = p.metaDescription;
  if (p.metaKeywords !== undefined) r.meta_keywords = p.metaKeywords;
  if (p.videoUrl !== undefined) r.video_url = p.videoUrl || null;
  return r;
};

const isAdminCtx = () =>
  typeof window !== 'undefined' &&
  (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/reseller'));

export const useBlogStore = create<BlogStore>()(
  persist(
    (set, get) => ({
      posts: [],
      loading: false,
      initialized: false,

      fetchPosts: async () => {
        set({ loading: true });
        try {
          // Admin sees drafts too; storefront sees published only.
          const path = isAdminCtx() ? '/admin/blog?per_page=10000' : '/public/blog?per_page=10000';
          const res = await api.get(path);
          const rows = Array.isArray(res) ? res : (res?.data ?? []);
          set({ posts: rows.map(mapRow), initialized: true });
        } catch (e) {
          console.error('[useBlogStore.fetchPosts] error:', e);
        }
        set({ loading: false });
      },

      fetchPostBySlug: async (slug: string, type?: string) => {
        const existing = get().posts.find((p) => p.slug === slug && (!type || p.type === type));
        if (existing) return existing;
        try {
          const row = await api.get(`/public/blog/${slug}`);
          if (row && row.id) {
            const post = mapRow(row);
            set((s) => (s.posts.find((p) => p.id === post.id) ? s : { posts: [...s.posts, post] }));
            return post;
          }
        } catch { /* not found */ }
        return null;
      },

      addPost: async (post) => {
        const created = await api.post('/admin/blog', toRow(post));
        set((s) => ({ posts: [mapRow(created), ...s.posts] }));
      },

      updatePost: async (id, updates) => {
        const updated = await api.put(`/admin/blog/${id}`, toRow(updates));
        set((s) => ({ posts: s.posts.map((p) => (p.id === id ? mapRow(updated) : p)) }));
      },

      deletePost: async (id) => {
        await api.del(`/admin/blog/${id}`);
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
      },
    }),
    {
      name: 'cache-blog-posts',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ posts: s.posts }),
    }
  )
);
