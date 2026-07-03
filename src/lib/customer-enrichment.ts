// Customer data enrichment for Facebook CAPI / Google Enhanced Conversions
// (sent via stape.io server-side GTM). All values are plain — sGTM tags
// will hash them before forwarding to ad platforms.
//
// Goal: raise Event Match Quality without asking the customer for more
// fields at checkout. We derive:
//   • country = "bd"  (business operates only in Bangladesh)
//   • ct      = city/district parsed from the typed address
//   • ge      = "m" / "f" guessed from the first name
//   • fn / ln = split of the customer's name
//   • ph      = normalized E.164 (8801XXXXXXXXX)

// 64 districts of Bangladesh — English token → canonical English (lowercase)
// plus Bangla token → canonical English. Checked against the address string.
const DISTRICT_MAP: Record<string, string> = {
  // English
  dhaka: 'dhaka', chattogram: 'chattogram', chittagong: 'chattogram',
  khulna: 'khulna', rajshahi: 'rajshahi', sylhet: 'sylhet',
  barisal: 'barisal', barishal: 'barisal', rangpur: 'rangpur',
  mymensingh: 'mymensingh', comilla: 'cumilla', cumilla: 'cumilla',
  narayanganj: 'narayanganj', gazipur: 'gazipur', narsingdi: 'narsingdi',
  munshiganj: 'munshiganj', manikganj: 'manikganj', tangail: 'tangail',
  kishoreganj: 'kishoreganj', faridpur: 'faridpur', madaripur: 'madaripur',
  shariatpur: 'shariatpur', rajbari: 'rajbari', gopalganj: 'gopalganj',
  jamalpur: 'jamalpur', netrokona: 'netrokona', sherpur: 'sherpur',
  bogura: 'bogura', bogra: 'bogura', joypurhat: 'joypurhat',
  naogaon: 'naogaon', natore: 'natore', chapainawabganj: 'chapainawabganj',
  pabna: 'pabna', sirajganj: 'sirajganj', jashore: 'jashore', jessore: 'jashore',
  satkhira: 'satkhira', meherpur: 'meherpur', narail: 'narail',
  chuadanga: 'chuadanga', kushtia: 'kushtia', magura: 'magura',
  jhenaidah: 'jhenaidah', bagerhat: 'bagerhat', pirojpur: 'pirojpur',
  jhalokati: 'jhalokati', bhola: 'bhola', patuakhali: 'patuakhali',
  barguna: 'barguna', habiganj: 'habiganj', moulvibazar: 'moulvibazar',
  sunamganj: 'sunamganj', brahmanbaria: 'brahmanbaria', chandpur: 'chandpur',
  laxmipur: 'lakshmipur', lakshmipur: 'lakshmipur', noakhali: 'noakhali',
  feni: 'feni', khagrachari: 'khagrachari', rangamati: 'rangamati',
  bandarban: 'bandarban', coxsbazar: 'coxsbazar', "cox'sbazar": 'coxsbazar',
  dinajpur: 'dinajpur', thakurgaon: 'thakurgaon', panchagarh: 'panchagarh',
  nilphamari: 'nilphamari', lalmonirhat: 'lalmonirhat', kurigram: 'kurigram',
  gaibandha: 'gaibandha',
  // Bangla
  'ঢাকা': 'dhaka', 'চট্টগ্রাম': 'chattogram', 'চিটাগাং': 'chattogram',
  'চিটাগং': 'chattogram', 'খুলনা': 'khulna', 'রাজশাহী': 'rajshahi',
  'সিলেট': 'sylhet', 'বরিশাল': 'barisal', 'রংপুর': 'rangpur',
  'ময়মনসিংহ': 'mymensingh', 'কুমিল্লা': 'cumilla', 'নারায়ণগঞ্জ': 'narayanganj',
  'গাজীপুর': 'gazipur', 'নরসিংদী': 'narsingdi', 'মুন্সিগঞ্জ': 'munshiganj',
  'মানিকগঞ্জ': 'manikganj', 'টাঙ্গাইল': 'tangail', 'কিশোরগঞ্জ': 'kishoreganj',
  'ফরিদপুর': 'faridpur', 'মাদারীপুর': 'madaripur', 'শরীয়তপুর': 'shariatpur',
  'রাজবাড়ী': 'rajbari', 'গোপালগঞ্জ': 'gopalganj', 'জামালপুর': 'jamalpur',
  'নেত্রকোনা': 'netrokona', 'শেরপুর': 'sherpur', 'বগুড়া': 'bogura',
  'জয়পুরহাট': 'joypurhat', 'নওগাঁ': 'naogaon', 'নাটোর': 'natore',
  'চাঁপাইনবাবগঞ্জ': 'chapainawabganj', 'পাবনা': 'pabna', 'সিরাজগঞ্জ': 'sirajganj',
  'যশোর': 'jashore', 'সাতক্ষীরা': 'satkhira', 'মেহেরপুর': 'meherpur',
  'নড়াইল': 'narail', 'চুয়াডাঙ্গা': 'chuadanga', 'কুষ্টিয়া': 'kushtia',
  'মাগুরা': 'magura', 'ঝিনাইদহ': 'jhenaidah', 'বাগেরহাট': 'bagerhat',
  'পিরোজপুর': 'pirojpur', 'ঝালকাঠি': 'jhalokati', 'ভোলা': 'bhola',
  'পটুয়াখালী': 'patuakhali', 'বরগুনা': 'barguna', 'হবিগঞ্জ': 'habiganj',
  'মৌলভীবাজার': 'moulvibazar', 'সুনামগঞ্জ': 'sunamganj',
  'ব্রাহ্মণবাড়িয়া': 'brahmanbaria', 'চাঁদপুর': 'chandpur',
  'লক্ষ্মীপুর': 'lakshmipur', 'নোয়াখালী': 'noakhali', 'ফেনী': 'feni',
  'খাগড়াছড়ি': 'khagrachari', 'রাঙ্গামাটি': 'rangamati', 'রাঙামাটি': 'rangamati',
  'বান্দরবান': 'bandarban', 'কক্সবাজার': 'coxsbazar', 'দিনাজপুর': 'dinajpur',
  'ঠাকুরগাঁও': 'thakurgaon', 'পঞ্চগড়': 'panchagarh', 'নীলফামারী': 'nilphamari',
  'লালমনিরহাট': 'lalmonirhat', 'কুড়িগ্রাম': 'kurigram', 'গাইবান্ধা': 'gaibandha',
};

export function parseCityFromAddress(address?: string | null): string | undefined {
  if (!address) return undefined;
  const raw = address.toLowerCase();
  // Try Bangla tokens (Bangla unicode survives lowercase as-is)
  for (const key of Object.keys(DISTRICT_MAP)) {
    if (/[\u0980-\u09FF]/.test(key)) {
      if (address.includes(key)) return DISTRICT_MAP[key];
    }
  }
  // English: strip punctuation/spaces and search
  const flat = raw.replace(/[^a-z]/g, '');
  for (const key of Object.keys(DISTRICT_MAP)) {
    if (/[\u0980-\u09FF]/.test(key)) continue;
    if (flat.includes(key.replace(/[^a-z]/g, ''))) return DISTRICT_MAP[key];
  }
  return undefined;
}

// Female-leaning name tokens (Bangla + English transliterations).
// We only flag when a clear female marker exists — otherwise default to 'm'
// (BD demographics + checkout reality means most COD orders are male-named).
const FEMALE_TOKENS = [
  // English
  'akter', 'akhter', 'aktar', 'khatun', 'khatoon', 'begum', 'begam',
  'sultana', 'parvin', 'parveen', 'nasrin', 'yasmin', 'jasmin',
  'rahima', 'fatema', 'fatima', 'ayesha', 'aisha', 'rabeya', 'salma',
  'mariam', 'maria', 'sumi', 'shathi', 'shati', 'shilpi', 'jharna',
  'rina', 'mina', 'tina', 'lipi', 'mim', 'mst', 'mosammat', 'mosammet',
  'most', 'smt', 'mrs', 'miss',
  // Bangla
  'আক্তার', 'আখতার', 'খাতুন', 'বেগম', 'সুলতানা', 'পারভীন', 'নাসরিন',
  'ইয়াসমিন', 'ফাতেমা', 'ফাতিমা', 'আয়েশা', 'রাবেয়া', 'সালমা', 'মরিয়ম',
  'সুমি', 'সাথী', 'শিল্পী', 'ঝর্ণা', 'রিনা', 'মীনা', 'লিপি', 'মীম',
  'মোসাঃ', 'মোছাঃ', 'মোসাম্মৎ', 'মোসাম্মাৎ', 'মিসেস', 'শ্রীমতি',
];

const MALE_TOKENS = [
  'mohammad', 'mohammed', 'muhammad', 'md', 'mohd', 'sk', 'sheikh',
  'mia', 'miah', 'mian', 'hossain', 'hosen', 'rahman', 'islam',
  'uddin', 'ahmed', 'ahmad',
  'মোঃ', 'মোহাম্মদ', 'মুহাম্মদ', 'মো:', 'মো.', 'শেখ', 'মিয়া',
  'হোসেন', 'রহমান', 'ইসলাম', 'উদ্দিন', 'আহমেদ', 'আহমদ',
];

export function guessGenderFromName(name?: string | null): 'm' | 'f' | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase();
  for (const t of FEMALE_TOKENS) {
    if (lower.includes(t.toLowerCase())) return 'f';
  }
  for (const t of MALE_TOKENS) {
    if (lower.includes(t.toLowerCase())) return 'm';
  }
  return undefined; // unknown — don't send rather than guess wrong
}

export function splitName(name?: string | null): { fn?: string; ln?: string } {
  if (!name) return {};
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { fn: parts[0] };
  return { fn: parts[0], ln: parts.slice(1).join(' ') };
}

export function normalizePhoneE164(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  let s = String(phone).replace(/[^\d]/g, '');
  if (s.startsWith('880')) s = s.slice(3);
  if (s.startsWith('0')) s = s.slice(1);
  if (s.length !== 10) return undefined;
  return '880' + s;
}

// District (city) → Division (state) map for Bangladesh.
// Used to derive `st` (state/region) for Facebook CAPI from the parsed city.
const DISTRICT_TO_DIVISION: Record<string, string> = {
  // Dhaka Division
  dhaka: 'dhaka', narayanganj: 'dhaka', gazipur: 'dhaka', narsingdi: 'dhaka',
  munshiganj: 'dhaka', manikganj: 'dhaka', tangail: 'dhaka', kishoreganj: 'dhaka',
  faridpur: 'dhaka', madaripur: 'dhaka', shariatpur: 'dhaka', rajbari: 'dhaka',
  gopalganj: 'dhaka',
  // Mymensingh Division
  mymensingh: 'mymensingh', jamalpur: 'mymensingh', netrokona: 'mymensingh',
  sherpur: 'mymensingh',
  // Chattogram Division
  chattogram: 'chattogram', cumilla: 'chattogram', brahmanbaria: 'chattogram',
  chandpur: 'chattogram', lakshmipur: 'chattogram', noakhali: 'chattogram',
  feni: 'chattogram', khagrachari: 'chattogram', rangamati: 'chattogram',
  bandarban: 'chattogram', coxsbazar: 'chattogram',
  // Rajshahi Division
  rajshahi: 'rajshahi', bogura: 'rajshahi', joypurhat: 'rajshahi',
  naogaon: 'rajshahi', natore: 'rajshahi', chapainawabganj: 'rajshahi',
  pabna: 'rajshahi', sirajganj: 'rajshahi',
  // Khulna Division
  khulna: 'khulna', jashore: 'khulna', satkhira: 'khulna', meherpur: 'khulna',
  narail: 'khulna', chuadanga: 'khulna', kushtia: 'khulna', magura: 'khulna',
  jhenaidah: 'khulna', bagerhat: 'khulna',
  // Barisal Division
  barisal: 'barisal', pirojpur: 'barisal', jhalokati: 'barisal', bhola: 'barisal',
  patuakhali: 'barisal', barguna: 'barisal',
  // Sylhet Division
  sylhet: 'sylhet', habiganj: 'sylhet', moulvibazar: 'sylhet', sunamganj: 'sylhet',
  // Rangpur Division
  rangpur: 'rangpur', dinajpur: 'rangpur', thakurgaon: 'rangpur',
  panchagarh: 'rangpur', nilphamari: 'rangpur', lalmonirhat: 'rangpur',
  kurigram: 'rangpur', gaibandha: 'rangpur',
};

export function divisionFromCity(city?: string): string | undefined {
  if (!city) return undefined;
  return DISTRICT_TO_DIVISION[city];
}

export interface CustomerInfo {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface EnrichedUserData {
  country: string;
  ph?: string;
  fn?: string;
  ln?: string;
  ct?: string;
  st?: string;
  ge?: 'm' | 'f';
}

export function buildEnrichedUserData(info: CustomerInfo): EnrichedUserData {
  const { fn, ln } = splitName(info.name);
  const data: EnrichedUserData = { country: 'bd' };
  const ph = normalizePhoneE164(info.phone);
  if (ph) data.ph = ph;
  if (fn) data.fn = fn;
  if (ln) data.ln = ln;
  const ct = parseCityFromAddress(info.address);
  if (ct) {
    data.ct = ct;
    const st = divisionFromCity(ct);
    if (st) data.st = st;
  }
  const ge = guessGenderFromName(info.name);
  if (ge) data.ge = ge;
  return data;
}
