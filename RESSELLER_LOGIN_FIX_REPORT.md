# Reseller Login Fix Report

**Date:** 2026-06-28  
**Scope:** Reseller login system only — no other modules modified.  
**Status:** COMPLETE ✅

---

## Root Cause

All 10 existing resellers had **plaintext passwords** stored in the `resellers` table (e.g., `sojib.ahmed.098`, `rafi2311`). `ResellerAuthController::login()` used `Hash::check($input, $stored)`, which requires the stored value to be a bcrypt hash starting with `$2y$`. Since none of the stored passwords were hashed, `Hash::check()` always returned `false` → every login attempt resulted in "Invalid credentials."

Secondary cause: `FrontendResellerController::storeReseller()` stored `password` raw (no `Hash::make()`), so any reseller created via the admin panel would also have a plaintext password and would fail to log in.

---

## Files Changed

| File | Change |
|------|--------|
| `app/Http/Controllers/Api/Auth/ResellerAuthController.php` | `login()` — added plaintext fallback check + auto-rehash on first successful login |
| `app/Http/Controllers/Api/Admin/FrontendResellerController.php` | `storeReseller()` and `updateReseller()` — hash password with `Hash::make()` if present |
| `app/Console/Commands/MigrateResellerPasswords.php` | New artisan command: `reseller:migrate-passwords` |

---

## Solution

Three-layer fix, chosen for maximum safety and zero plaintext storage:

### Layer 1 — Artisan Migration Command (primary fix)
`php artisan reseller:migrate-passwords`

Finds every reseller whose stored password does NOT start with `$2y$`, `$2b$`, or `$argon`, hashes it with `Hash::make()`, and saves. Run once on deployment.

Supports `--dry-run` flag for safe preview before applying.

### Layer 2 — Login Fallback + Auto-Rehash (insurance net)
`ResellerAuthController::login()` now:
1. Checks if stored password is a bcrypt hash (starts with `$2y$` / `$2b$` / `$argon`)
2. If **hashed**: uses `Hash::check()` — normal path
3. If **plaintext**: compares directly (`===`), then immediately rehashes and saves on success
4. Proceeds to status check and token creation

This means even if the artisan migration is somehow skipped, or a plaintext account is added later, it self-heals on first login. **Plaintext is never re-stored.**

### Layer 3 — Controller Fix (prevent recurrence)
`FrontendResellerController::storeReseller()` and `updateReseller()` now call `Hash::make()` on any `password` field before storing. Admin-created resellers will have properly hashed passwords from now on.

---

## Migration Run (2026-06-28)

```
Migrated:          10 accounts
Already hashed:     1 account (testreseller@bongobee.test — bcrypt from previous test)
```

Accounts migrated:
- sojib.ahmed.098@gmail.com
- nazmulhuda.2003@gmail.com
- rafi2311@gmail.com
- genz420@gmail.com
- mithila.rufan19@gmail.com
- eftikargamer8@gmail.com
- saiem.sa223
- phonestore@gmail.com
- GadgetStore@gmail.com
- routechbd@gmail.com

All 11 reseller accounts verified to have `$2y$12` bcrypt passwords in the DB after migration.

---

## Test Results

All tests run against the live application at `http://bongobee-laravel.test`.

| # | Test | Expected | Result | HTTP |
|---|------|----------|--------|------|
| 1 | Old reseller login (`sojib.ahmed.098@gmail.com` / `sojib.ahmed.098`) | 200 + token | **PASS** | 200 |
| 2 | New/bcrypt reseller login (`testreseller@bongobee.test` / `Test@12345`) | 200 + token | **PASS** | 200 |
| 3 | Wrong password (`sojib.ahmed.098@gmail.com` / `wrongpassword`) | 422 | **PASS** | 422 |
| 4 | Inactive reseller login (`testreseller@bongobee.test`, status=inactive) | 403 | **PASS** | 403 |
| 5 | Active/approved reseller login | 200, `status=active` in response | **PASS** | 200 |
| 6 | Token generation | Non-empty Sanctum token (`{id}\|{40-char key}`) | **PASS** | — |
| 7 | Logout + token invalidation | 200 on logout; 401 on subsequent `/me` | **PASS** | 200 / 401 |

---

## What Was NOT Changed

- Login route: `POST /api/auth/reseller/login` — **unchanged**
- Request fields: `email`, `password` — **unchanged**
- Registration: `POST /api/auth/reseller/register` — **unchanged** (already hashed correctly)
- Sanctum token structure — **unchanged**
- Password reset — **unchanged** (uses Laravel's built-in hash flow)
- All other modules — **untouched**

---

## Production Deployment Steps

1. Deploy the three changed files.
2. Run: `php artisan reseller:migrate-passwords`  
   (Use `--dry-run` first to preview. Safe to run multiple times — already-hashed accounts are skipped.)
3. No migration file needed — schema unchanged.
4. Verify with a known test account before going live.

---

## Security Notes

- Plaintext passwords are **never re-stored** under any code path.
- The login fallback rehashes immediately on the first successful login, so plaintext values disappear from the DB as soon as accounts are used.
- The artisan command runs the migration upfront so no plaintext ever needs to go through the login fallback in production.
- `$hidden = ['password']` on the `Reseller` model should be verified to ensure password hashes are not leaked in API responses (pre-existing concern, out of scope for this fix).
