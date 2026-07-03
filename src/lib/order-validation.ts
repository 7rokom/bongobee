// Shared phone/name validation for checkout, admin, and reseller order forms

/**
 * Convert Bengali/Arabic-Indic digits to English digits.
 * Example: "০১৭১২৩৪৫৬৭৮" → "01712345678"
 */
const toEnglishDigits = (s: string): string => {
  return s
    .replace(/[\u09E6-\u09EF]/g, (d) => String(d.charCodeAt(0) - 0x09E6)) // Bengali ০-৯
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)); // Arabic ٠-٩
};

/**
 * Normalize phone: convert Bengali digits, strip country code (+88, 88, +880, 880),
 * dashes, spaces, parentheses. Returns digits-only string starting with 01.
 */
export const normalizePhone = (phone: string): string => {
  // Convert Bengali/Arabic digits to English first, then strip non-digit chars except leading +
  let cleaned = toEnglishDigits(phone.trim()).replace(/[\s\-()]/g, '');
  // Remove leading + (we only care about digits now)
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  // Strip BD country code variants. After this, if user typed it with the leading 0
  // (e.g. 88 01712345678), we end up with 01712345678. If they typed without it
  // (e.g. 880 1712345678 → 8801712345678), we end up with 1712345678 and need to add 0.
  if (cleaned.startsWith('880')) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith('88') && cleaned.length === 13) cleaned = cleaned.slice(2);
  // If after stripping country code we get a 10-digit number starting with 1, prepend 0
  if (/^1[3-9]\d{8}$/.test(cleaned)) cleaned = '0' + cleaned;
  return cleaned;
};

/**
 * Validate phone number input.
 * Allows: digits, +, -, spaces (for country code and formatting)
 * Returns null if valid, or error message string if invalid
 */
const PHONE_ERROR = 'আপনার ফোন নাম্বার ভুল হয়েছে। দয়া করে সঠিক ফোন নাম্বার দিয়ে অর্ডার করুন।';

export const validatePhone = (phone: string): string | null => {
  if (!phone.trim()) return null; // empty is handled by required check

  // Allow only digits, +, -, spaces (for country code & formatting like 01997-9003670)
  const allowedPattern = /^[\d\s+\-]+$/;
  if (!allowedPattern.test(phone.trim())) {
    return PHONE_ERROR;
  }

  // Normalize: strips +880/880/88 country codes, dashes, and spaces
  const normalized = normalizePhone(phone);

  // Must be exactly 11 digits, start with 01, and have valid BD operator prefix (013-019)
  if (!/^01[3-9]\d{8}$/.test(normalized)) {
    return PHONE_ERROR;
  }

  return null;
};

/**
 * Validate name - no numbers allowed
 * Returns null if valid, or error message string
 */
export const validateName = (name: string): string | null => {
  if (!name.trim()) return null;
  if (/\d/.test(name)) {
    return 'নামের ঘরে সংখ্যা লেখা যাবে না। দয়া করে সঠিক নাম লিখুন।';
  }
  return null;
};
