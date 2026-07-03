// Central registry for the Backup & Restore system.
// Each entry describes one database table that should be included
// in the full-site backup, along with how to restore it.

export type RestoreStrategy =
  | 'replace' // delete all rows then insert
  | 'upsert'; // singleton/config table — upsert by id (or pk)

export interface BackupTable {
  /** Stable key used in the JSON file under `data` */
  key: string;
  /** Human readable label (Bangla) */
  label: string;
  /** Database table name */
  table: string;
  /** Group label for UI grouping */
  group: string;
  /** Restore behavior */
  strategy: RestoreStrategy;
  /** Conflict column for upsert (default: 'id') */
  conflictKey?: string;
  /** Primary key column used for the "delete all" predicate on replace.
   *  Defaults to 'id'. Important for tables like follow_up_data whose PK
   *  is `order_id` — using the wrong column makes the delete fail and the
   *  whole table restore skipped (stock_type / vendor info disappears). */
  pk?: string;
}

export interface BackupGroup {
  key: string;
  label: string;
  tables: BackupTable[];
}

// NOTE: Restore order = the order of groups, then tables within a group.
// Settings & counters first, catalog next, then content, people, orders/finance,
// finally courier/fraud/support tables.
export const BACKUP_GROUPS: BackupGroup[] = [
  {
    key: 'settings',
    label: 'সাইট ও কনফিগ সেটিংস',
    tables: [
      { key: 'site_settings', label: 'সাইট সেটিংস', table: 'site_settings', group: 'settings', strategy: 'upsert' },
      { key: 'fraud_settings', label: 'ফ্রড সেটিংস', table: 'fraud_settings', group: 'settings', strategy: 'upsert' },
      { key: 'courier_settings', label: 'কুরিয়ার সেটিংস', table: 'courier_settings', group: 'settings', strategy: 'upsert' },
      { key: 'counters', label: 'কাউন্টার (অর্ডার নাম্বারিং)', table: 'counters', group: 'settings', strategy: 'upsert', conflictKey: 'id' },
    ],
  },
  {
    key: 'catalog',
    label: 'প্রোডাক্ট ক্যাটালগ',
    tables: [
      { key: 'categories', label: 'ক্যাটাগরি', table: 'categories', group: 'catalog', strategy: 'replace' },
      { key: 'variations', label: 'ভেরিয়েশন', table: 'variations', group: 'catalog', strategy: 'replace' },
      { key: 'products', label: 'প্রোডাক্ট', table: 'products', group: 'catalog', strategy: 'replace' },
      { key: 'stock_entries', label: 'স্টক এন্ট্রি', table: 'stock_entries', group: 'catalog', strategy: 'replace' },
    ],
  },
  {
    key: 'content',
    label: 'কনটেন্ট ও মার্কেটিং',
    tables: [
      { key: 'blog_posts', label: 'ব্লগ ও পেজ', table: 'blog_posts', group: 'content', strategy: 'replace' },
      { key: 'landing_pages', label: 'ল্যান্ডিং পেজ', table: 'landing_pages', group: 'content', strategy: 'replace' },
      { key: 'coupons', label: 'কুপন', table: 'coupons', group: 'content', strategy: 'replace' },
      { key: 'short_links', label: 'লিংক শর্টনার', table: 'short_links', group: 'content', strategy: 'replace' },
    ],
  },
  {
    key: 'team',
    label: 'টিম ও স্টাফ',
    tables: [
      { key: 'employees', label: 'টিম মেম্বার', table: 'employees', group: 'team', strategy: 'replace' },
      { key: 'employee_activities', label: 'টিম অ্যাক্টিভিটি / রিপোর্ট', table: 'employee_activities', group: 'team', strategy: 'replace' },
    ],
  },
  {
    key: 'reseller',
    label: 'রিসেলার',
    tables: [
      { key: 'resellers', label: 'রিসেলার', table: 'resellers', group: 'reseller', strategy: 'replace' },
      { key: 'reseller_payment_methods', label: 'রিসেলার পেমেন্ট মেথড', table: 'reseller_payment_methods', group: 'reseller', strategy: 'replace' },
      { key: 'reseller_product_prices', label: 'রিসেলার প্রোডাক্ট দাম', table: 'reseller_product_prices', group: 'reseller', strategy: 'replace' },
      { key: 'reseller_orders', label: 'রিসেলার অর্ডার', table: 'reseller_orders', group: 'reseller', strategy: 'replace' },
      { key: 'payment_requests', label: 'পেমেন্ট রিকুয়েস্ট', table: 'payment_requests', group: 'reseller', strategy: 'replace' },
      { key: 'reseller_domains', label: 'রিসেলার ডোমেইন', table: 'reseller_domains', group: 'reseller', strategy: 'replace' },
    ],
  },
  {
    key: 'orders',
    label: 'অর্ডার ও অপারেশন',
    tables: [
      { key: 'orders', label: 'অর্ডার', table: 'orders', group: 'orders', strategy: 'replace' },
      { key: 'incomplete_orders', label: 'অসম্পূর্ণ অর্ডার', table: 'incomplete_orders', group: 'orders', strategy: 'replace' },
      { key: 'follow_up_data', label: 'ফলোয়াপ', table: 'follow_up_data', group: 'orders', strategy: 'replace', pk: 'order_id' },
    ],
  },
  {
    key: 'customers',
    label: 'কাস্টমার ও ফ্রড',
    tables: [
      { key: 'blocked_customers', label: 'ব্লকড কাস্টমার', table: 'blocked_customers', group: 'customers', strategy: 'replace' },
    ],
  },
  {
    key: 'finance',
    label: 'একাউন্ট ও ফাইন্যান্স',
    tables: [
      { key: 'expenses', label: 'খরচ', table: 'expenses', group: 'finance', strategy: 'replace' },
      { key: 'deposits', label: 'ডিপোজিট', table: 'deposits', group: 'finance', strategy: 'replace' },
    ],
  },
  {
    key: 'courier',
    label: 'কুরিয়ার সাপোর্ট',
    tables: [
      // PK is order_id (no `id` column) — must specify pk so delete doesn't crash
      { key: 'courier_dispatch', label: 'কুরিয়ার ডিসপ্যাচ', table: 'courier_dispatch', group: 'courier', strategy: 'replace', pk: 'order_id' },
      // PK is phone
      { key: 'courier_ratio_cache', label: 'কুরিয়ার রেশিও ক্যাশ', table: 'courier_ratio_cache', group: 'courier', strategy: 'replace', pk: 'phone' },
    ],
  },
  {
    key: 'integrations',
    label: 'ইন্টিগ্রেশন ও সোর্স',
    tables: [
      { key: 'youtube_sources', label: 'YouTube সোর্স', table: 'youtube_sources', group: 'integrations', strategy: 'replace' },
    ],
  },
  {
    key: 'push',
    label: 'পুশ নোটিফিকেশন',
    tables: [
      // push_subscriptions has a UNIQUE(endpoint) constraint. Old backups can
      // contain duplicate endpoints (same browser re-subscribed). Use upsert by
      // endpoint so duplicates merge instead of crashing the whole restore.
      { key: 'push_subscriptions', label: 'পুশ সাবস্ক্রাইবার', table: 'push_subscriptions', group: 'push', strategy: 'upsert', conflictKey: 'endpoint' },
      { key: 'push_campaigns', label: 'পুশ ক্যাম্পেইন হিস্ট্রি', table: 'push_campaigns', group: 'push', strategy: 'replace' },
    ],
  },
  {
    key: 'sms',
    label: 'SMS ক্যাম্পেইন',
    tables: [
      // sms_campaigns must restore BEFORE sms_queue (queue has FK -> campaigns.id)
      { key: 'sms_campaigns', label: 'SMS ক্যাম্পেইন হিস্ট্রি', table: 'sms_campaigns', group: 'sms', strategy: 'replace' },
      { key: 'sms_queue', label: 'SMS কিউ', table: 'sms_queue', group: 'sms', strategy: 'replace' },
    ],
  },
  {
    key: 'digital',
    label: 'ডিজিটাল প্রোডাক্ট',
    tables: [
      { key: 'digital_categories', label: 'ডিজিটাল ক্যাটাগরি', table: 'digital_categories', group: 'digital', strategy: 'replace' },
      { key: 'digital_products', label: 'ডিজিটাল প্রোডাক্ট', table: 'digital_products', group: 'digital', strategy: 'replace' },
      { key: 'digital_payment_methods', label: 'ডিজিটাল পেমেন্ট মেথড', table: 'digital_payment_methods', group: 'digital', strategy: 'replace' },
      { key: 'digital_customers', label: 'ডিজিটাল কাস্টমার', table: 'digital_customers', group: 'digital', strategy: 'replace' },
      { key: 'digital_orders', label: 'ডিজিটাল অর্ডার', table: 'digital_orders', group: 'digital', strategy: 'replace' },
      { key: 'digital_blocked_users', label: 'ডিজিটাল ব্লকড ইউজার', table: 'digital_blocked_users', group: 'digital', strategy: 'replace' },
    ],
  },
];

export const ALL_BACKUP_TABLES: BackupTable[] = BACKUP_GROUPS.flatMap((g) => g.tables);

export const BACKUP_FILE_VERSION = '2.2';

export interface BackupFile {
  version: string;
  createdAt: string;
  siteName?: string;
  counts: Record<string, number>;
  data: Record<string, any[]>;
}