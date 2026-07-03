export type PushSection = 'main' | 'digital' | 'blog' | 'reseller';

export const PUSH_SECTIONS: PushSection[] = ['main', 'digital', 'blog', 'reseller'];

export const PUSH_SECTION_LABELS: Record<PushSection, string> = {
  main: 'মেইন প্রোডাক্ট',
  digital: 'ডিজিটাল প্রোডাক্ট',
  blog: 'ব্লগ পোস্ট',
  reseller: 'রিসেলার প্রোডাক্ট',
};

export function getPushSectionFromPath(pathname: string): PushSection {
  if (pathname.startsWith('/digital')) return 'digital';
  if (pathname.startsWith('/blog')) return 'blog';
  if (pathname.startsWith('/r/')) return 'reseller';
  return 'main';
}
