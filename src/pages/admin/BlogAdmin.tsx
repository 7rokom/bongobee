import { useState, useRef, lazy, Suspense } from 'react';
import { BlogPost } from '@/data/store-data';
import { useBlogStore } from '@/stores/useBlogStore';
import { useLazyFetch } from '@/lib/use-lazy-fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, Edit2, Trash2, ArrowLeft, Upload, Link, X, Image, Save, Eye, FileText, StickyNote, ExternalLink, Copy, Download, Youtube, Link2, Check } from 'lucide-react';
import { extractYouTubeId, getYouTubeThumbnail, resolveVideo } from '@/lib/youtube';
import ImportExportButtons from '@/components/admin/ImportExportButtons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = lazy(() => import('react-quill-new'));

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    [{ color: [] }, { background: [] }],
    ['clean'],
  ],
};

type ContentType = 'post' | 'page';

const BlogAdmin = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { posts, addPost, updatePost, deletePost } = useBlogStore();
  useLazyFetch([useBlogStore.getState().fetchPosts]);
  const [activeTab, setActiveTab] = useState<ContentType>('post');
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Editor state
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    category: '',
    metaDescription: '',
    metaKeywords: '',
  });
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [featuredImage, setFeaturedImage] = useState('');
  const [featuredImageMode, setFeaturedImageMode] = useState<'upload' | 'link'>('upload');
  const [featuredImageLink, setFeaturedImageLink] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<BlogPost | null>(null);
  const [deleteStep, setDeleteStep] = useState(0); // 0=closed, 1=first, 2=second
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const featuredInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = (post: BlogPost) => {
    const url = `${window.location.origin}${post.type === 'post' ? `/blog/${post.slug}` : `/page/${post.slug}`}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(post.id);
      toast.success('লিংক কপি হয়েছে');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const openDelete = (post: BlogPost) => { setDeleteConfirm(post); setDeleteStep(1); };
  const handleDeleteStep = async () => {
    if (deleteStep === 1) { setDeleteStep(2); return; }
    if (deleteStep === 2 && deleteConfirm) {
      await deletePost(deleteConfirm.id);
      toast.success('ডিলিট হয়েছে');
      setDeleteConfirm(null); setDeleteStep(0);
    }
  };

  const filteredPosts = posts.filter((p) => {
    const matchType = p.type === activeTab;
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const handleFileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.readAsDataURL(file); });

  const handleFeaturedUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFeaturedImage(await handleFileToBase64(file));
  };

  const addFeaturedFromLink = () => { if (featuredImageLink.trim()) { setFeaturedImage(featuredImageLink.trim()); setFeaturedImageLink(''); } };

  const updateField = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const openNewEditor = (type: ContentType) => {
    setEditing(null);
    setFormData({ title: '', slug: '', content: '', category: '', metaDescription: '', metaKeywords: '' });
    setStatus('published');
    setFeaturedImage('');
    setVideoUrl('');
    setActiveTab(type);
    setShowEditor(true);
  };

  const openEditEditor = (post: BlogPost) => {
    setEditing(post);
    setFormData({
      title: post.title,
      slug: post.slug || '',
      content: post.content,
      category: post.category,
      metaDescription: post.metaDescription || '',
      metaKeywords: post.metaKeywords || '',
    });
    setStatus(post.status || 'published');
    setFeaturedImage(post.image || '');
    setVideoUrl(post.videoUrl || '');
    setActiveTab(post.type || 'post');
    setShowEditor(true);
  };

  const handleSave = async (saveStatus: 'published' | 'draft') => {
    if (!formData.title.trim()) { toast.error('শিরোনাম আবশ্যক'); return; }

    const slugify = (s: string) => s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0980-\u09FF-]+/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const customSlug = formData.slug.trim() ? slugify(formData.slug) : '';
    const generatedSlug = slugify(formData.title);
    const slug = customSlug || generatedSlug || editing?.slug || `${activeTab}-${Date.now()}`;
    const postData: BlogPost = {
      id: editing?.id || Date.now().toString(),
      title: formData.title,
      slug,
      excerpt: '',
      content: formData.content,
      image: featuredImage || '',
      date: editing?.date || new Date().toISOString().split('T')[0],
      author: editing?.author || 'অ্যাডমিন',
      category: formData.category,
      type: activeTab,
      status: saveStatus,
      metaDescription: formData.metaDescription || undefined,
      metaKeywords: formData.metaKeywords || undefined,
      videoUrl: videoUrl.trim() || undefined,
    };

    try {
      if (editing) {
        await updatePost(editing.id, postData);
        toast.success(`${activeTab === 'post' ? 'পোস্ট' : 'পেজ'} আপডেট হয়েছে`);
      } else {
        await addPost(postData);
        toast.success(saveStatus === 'draft'
          ? `${activeTab === 'post' ? 'পোস্ট' : 'পেজ'} ড্রাফট সেভ হয়েছে`
          : `${activeTab === 'post' ? 'পোস্ট' : 'পেজ'} পাবলিশ হয়েছে`
        );
      }
      setShowEditor(false);
    } catch (err: any) {
      console.error('[BlogAdmin.handleSave] error:', err);
      const msg = err?.message || 'অজানা ত্রুটি';
      if (msg.includes('video_url')) {
        toast.error('ডাটাবেসে video_url কলাম নেই — মাইগ্রেশন apply করুন');
      } else {
        toast.error(`সেভ করা যায়নি: ${msg}`);
      }
    }
  };

  // Editor View
  if (showEditor) {
    const typeLabel = activeTab === 'post' ? 'পোস্ট' : 'পেজ';
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => setShowEditor(false)} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                {editing ? `${typeLabel} এডিট করুন` : `নতুন ${typeLabel} তৈরি করুন`}
              </h1>
              <p className="text-sm text-muted-foreground truncate">
                {editing ? `${typeLabel}টি পরিবর্তন করুন` : `${typeLabel}ের সকল তথ্য পূরণ করুন`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" className="gap-2 text-xs sm:text-sm" onClick={() => handleSave('draft')}>
              <FileText className="w-4 h-4" /> ড্রাফট
            </Button>
            <Button className="gap-2 text-xs sm:text-sm" onClick={() => handleSave('published')}>
              <Eye className="w-4 h-4" /> পাবলিশ
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader><CardTitle className="text-base">মৌলিক তথ্য</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>শিরোনাম <span className="text-destructive">*</span></Label>
                  <Input placeholder={`${typeLabel}ের শিরোনাম লিখুন`} value={formData.title} onChange={(e) => updateField('title', e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Content */}
            <Card>
              <CardHeader><CardTitle className="text-base">বিস্তারিত কন্টেন্ট</CardTitle></CardHeader>
              <CardContent>
                <Suspense fallback={<div className="h-48 bg-muted animate-pulse rounded-md" />}>
                  <ReactQuill theme="snow" value={formData.content} onChange={(v: string) => updateField('content', v)} modules={quillModules} placeholder={`${typeLabel}ের বিস্তারিত কন্টেন্ট লিখুন...`} className="bg-background rounded-md [&_.ql-editor]:min-h-[300px]" />
                </Suspense>
              </CardContent>
            </Card>

            {/* Media - Featured Image Only */}
            <Card>
              <CardHeader><CardTitle className="text-base">ফিচার ইমেজ</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Tabs value={featuredImageMode} onValueChange={(v) => setFeaturedImageMode(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="upload" className="text-xs gap-1"><Upload className="w-3 h-3" /> আপলোড</TabsTrigger>
                    <TabsTrigger value="link" className="text-xs gap-1"><Link className="w-3 h-3" /> লিংক</TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload" className="mt-2">
                    <input ref={featuredInputRef} type="file" accept="image/*" className="hidden" onChange={handleFeaturedUpload} />
                    <Button type="button" variant="outline" className="w-full gap-2 border-dashed h-20" onClick={() => featuredInputRef.current?.click()}>
                      <Upload className="w-5 h-5" /> ফিচার ইমেজ আপলোড করুন
                    </Button>
                  </TabsContent>
                  <TabsContent value="link" className="mt-2">
                    <div className="flex gap-2">
                      <Input placeholder="ইমেজ লিংক পেস্ট করুন" value={featuredImageLink} onChange={(e) => setFeaturedImageLink(e.target.value)} />
                      <Button type="button" onClick={addFeaturedFromLink} size="sm">যোগ</Button>
                    </div>
                  </TabsContent>
                </Tabs>
                {featuredImage && (
                  <div className="relative inline-block mt-2">
                    <img src={featuredImage} alt="Featured" className="w-32 h-32 rounded-lg object-cover border" />
                    <button onClick={() => setFeaturedImage('')} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="w-3 h-3" /></button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">ফিচার ইমেজ দিলে পোস্ট/পেজের শুরুতে শো করবে। না দিলে কোন ইমেজ শো করবে না।</p>
              </CardContent>
            </Card>

            {/* Video (YouTube / Google Drive / Vimeo / Facebook / direct file) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-600" /> ভিডিও লিংক (ঐচ্ছিক)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="YouTube / Google Drive / Vimeo / Facebook / direct mp4 লিংক"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                {videoUrl && (() => {
                  const v = resolveVideo(videoUrl);
                  if (!v) return <p className="text-xs text-destructive">⚠️ সঠিক ভিডিও লিংক নয়</p>;
                  const ytId = extractYouTubeId(videoUrl);
                  const thumb = v.thumbnail || (ytId ? getYouTubeThumbnail(ytId, 'hqdefault') : '');
                  return (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">✅ ধরন: <span className="font-medium uppercase">{v.kind}</span></p>
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-black max-w-xs">
                        {thumb ? (
                          <img src={thumb} alt="preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/70 text-xs">প্রিভিউ নেই</div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                            <div className="w-0 h-0 border-y-[8px] border-y-transparent border-l-[12px] border-l-white ml-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <p className="text-xs text-muted-foreground">
                  ভিডিও লিংক দিলে ব্লগ পেইজে thumbnail + play button শো করবে এবং ক্লিক করলে ইনলাইনে play হবে। YouTube, Google Drive (/file/d/.../preview বা view), Vimeo, Facebook এবং সরাসরি .mp4 লিংক সাপোর্ট করে।
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader><CardTitle className="text-base">স্ট্যাটাস</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    {status === 'published' ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">পাবলিশড</Badge>
                    ) : (
                      <Badge variant="secondary">ড্রাফট</Badge>
                    )}
                  </div>
                  <Switch checked={status === 'published'} onCheckedChange={(checked) => setStatus(checked ? 'published' : 'draft')} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {status === 'published' ? `${typeLabel}টি ওয়েবসাইটে দেখা যাবে` : `${typeLabel}টি ওয়েবসাইটে দেখা যাবে না`}
                </p>
              </CardContent>
            </Card>

            {/* Category */}
            <Card>
              <CardHeader><CardTitle className="text-base">ক্যাটাগরি</CardTitle></CardHeader>
              <CardContent>
                <Input placeholder="ক্যাটাগরি লিখুন" value={formData.category} onChange={(e) => updateField('category', e.target.value)} />
              </CardContent>
            </Card>

            {/* SEO */}
            <Card>
              <CardHeader><CardTitle className="text-base">SEO সেটিংস</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1"><Link className="w-3 h-3" /> কাস্টম লিংক / স্লাগ</Label>
                  <Input
                    placeholder="যেমন: my-custom-url (খালি রাখলে শিরোনাম থেকে তৈরি হবে)"
                    value={formData.slug}
                    onChange={(e) => updateField('slug', e.target.value)}
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground break-all">
                    URL: https://bongobe.com/{activeTab === 'post' ? 'blog' : 'page'}/<span className="font-medium text-foreground">{formData.slug.trim() || '(auto)'}</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">মেটা ডিস্ক্রিপশন</Label>
                  <Input placeholder="সার্চ ইঞ্জিনে দেখানোর জন্য বিবরণ" value={formData.metaDescription} onChange={(e) => updateField('metaDescription', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">মেটা কিওয়ার্ড</Label>
                  <Input placeholder="কিওয়ার্ড ১, কিওয়ার্ড ২" value={formData.metaKeywords} onChange={(e) => updateField('metaKeywords', e.target.value)} className="h-9 text-sm" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Save Bar */}
        <div className="sticky bottom-0 bg-background border-t p-4 -mx-3 sm:-mx-4 md:-mx-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowEditor(false)}>বাতিল</Button>
          <Button variant="outline" className="gap-2" onClick={() => handleSave('draft')}>
            <FileText className="w-4 h-4" /> ড্রাফট সেভ
          </Button>
          <Button className="gap-2" onClick={() => handleSave('published')}>
            <Save className="w-4 h-4" /> পাবলিশ করুন
          </Button>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">পোস্ট এবং পেজ</h1>
          <p className="text-sm text-muted-foreground">
            মোট {posts.filter(p => p.type === 'post').length}টি পোস্ট, {posts.filter(p => p.type === 'page').length}টি পেজ
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ImportExportButtons
            data={posts}
            filename="blog-posts"
            label="পোস্ট/পেজ"
            onImport={(items: BlogPost[]) => {
              items.forEach(p => {
                if (!posts.find(ep => ep.id === p.id)) addPost(p);
              });
            }}
          />
          <Button onClick={() => openNewEditor('post')} className="gap-2" size="sm">
            <StickyNote className="w-4 h-4" /> নতুন পোস্ট
          </Button>
          <Button onClick={() => openNewEditor('page')} variant="outline" className="gap-2" size="sm">
            <FileText className="w-4 h-4" /> নতুন পেজ
          </Button>
        </div>
      </div>

      {/* Type Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContentType)}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="post" className="gap-1.5">
            <StickyNote className="w-3.5 h-3.5" /> পোস্ট
            <Badge variant="secondary" className="text-[10px] px-1.5 h-4">{posts.filter(p => p.type === 'post').length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="page" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> পেজ
            <Badge variant="secondary" className="text-[10px] px-1.5 h-4">{posts.filter(p => p.type === 'page').length}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={`${activeTab === 'post' ? 'পোস্ট' : 'পেজ'} খুঁজুন...`} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filteredPosts.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            কোনো {activeTab === 'post' ? 'পোস্ট' : 'পেজ'} নেই
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredPosts.map((post) => {
            const url = post.status === 'published'
              ? `${window.location.origin}${post.type === 'post' ? `/blog/${post.slug}` : `/page/${post.slug}`}`
              : null;
            return (
              <Card key={post.id} className="overflow-hidden">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex gap-3">
                    {post.image
                      ? <img src={post.image} alt={post.title} className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-md shrink-0" />
                      : <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-md shrink-0 bg-muted flex items-center justify-center">
                          {post.type === 'post'
                            ? <StickyNote className="h-8 w-8 text-muted-foreground" />
                            : <FileText className="h-8 w-8 text-muted-foreground" />}
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm sm:text-base line-clamp-2">{post.title}</h3>
                        <Badge
                          variant={post.status === 'published' ? 'default' : 'secondary'}
                          className="text-[10px] shrink-0"
                        >
                          {post.status === 'published' ? 'পাবলিশড' : 'ড্রাফট'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{post.date}</span>
                        {post.category && <span className="px-1.5 py-0.5 rounded-full bg-muted">{post.category}</span>}
                      </div>
                      {url && (
                        <div className="mt-2 bg-muted/50 rounded px-2 py-1.5 text-[11px] sm:text-xs break-all font-mono text-muted-foreground">
                          {url}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {url && (
                          <Button size="sm" variant="default" onClick={() => handleCopy(post)} className="h-8 text-xs">
                            {copiedId === post.id
                              ? <><Check className="h-3.5 w-3.5 mr-1" />কপি হয়েছে</>
                              : <><Link2 className="h-3.5 w-3.5 mr-1" />লিংক কপি</>}
                          </Button>
                        )}
                        {url && (
                          <Button size="sm" variant="outline" asChild className="h-8 text-xs">
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />ভিউ
                            </a>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEditEditor(post)} className="h-8 text-xs">
                          <Edit2 className="h-3.5 w-3.5 mr-1" />এডিট
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDelete(post)}
                          className="h-8 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />ডিলিট
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) { setDeleteConfirm(null); setDeleteStep(0); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> {deleteConfirm?.type === 'page' ? 'পেজ' : 'পোস্ট'} ডিলিট
            </DialogTitle>
          </DialogHeader>
          {deleteStep === 1 && (
            <p className="text-sm">
              আপনি কি <span className="font-bold">{deleteConfirm?.title}</span> {deleteConfirm?.type === 'page' ? 'পেজটি' : 'পোস্টটি'} ডিলিট করতে চান?
            </p>
          )}
          {deleteStep === 2 && (
            <p className="text-sm text-destructive font-medium">
              ⚠️ শেষ সতর্কতা! সত্যিই কি "{deleteConfirm?.title}" চিরতরে ডিলিট করতে চান? এটি ফেরানো যাবে না।
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteConfirm(null); setDeleteStep(0); }}>বাতিল</Button>
            <Button variant="destructive" onClick={handleDeleteStep}>
              {deleteStep === 1 ? 'হ্যাঁ, ডিলিট করুন' : 'নিশ্চিত ডিলিট'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BlogAdmin;
