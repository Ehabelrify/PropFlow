# CSRF Protection Documentation

**Document Version:** 1.0  
**Last Updated:** 2026-05-15  
**Status:** ✅ Implemented via Supabase JWT Authentication

---

## Overview

PropFlow CRM implements CSRF (Cross-Site Request Forgery) protection through Supabase's built-in JWT-based authentication system. This document explains how CSRF protection works in our application and why additional custom CSRF tokens are not necessary.

---

## How Supabase Provides CSRF Protection

### 1. JWT Token-Based Authentication

**Mechanism:**
- All authenticated requests include a JWT (JSON Web Token) in the `Authorization` header
- JWTs are cryptographically signed and cannot be forged
- Tokens are stored in `httpOnly` cookies (when configured) or localStorage
- Each request validates the JWT signature server-side

**Why This Prevents CSRF:**
- Malicious sites cannot access the JWT token due to Same-Origin Policy
- Even if a malicious site triggers a request, it cannot include the valid JWT
- The server rejects any request without a valid JWT signature

### 2. SameSite Cookie Attribute

**Configuration:**
```typescript
// Supabase automatically sets SameSite=Lax for auth cookies
// This prevents cookies from being sent in cross-site requests
```

**Protection Level:**
- `SameSite=Lax`: Cookies sent only for same-site requests and top-level navigation
- Blocks CSRF attacks from embedded iframes and AJAX requests
- Allows legitimate navigation (e.g., clicking links from emails)

### 3. Origin Validation

**Supabase Configuration:**
```sql
-- In Supabase Dashboard > Authentication > URL Configuration
-- Site URL: https://propflow.example.com
-- Redirect URLs: https://propflow.example.com/auth/callback
```

**How It Works:**
- Supabase validates the `Origin` and `Referer` headers
- Rejects requests from unauthorized origins
- Prevents token theft via malicious redirects

---

## Current Implementation

### Authentication Flow

```typescript
// src/lib/auth-context.tsx
import { supabase } from "@/integrations/supabase/client";

// Sign in - JWT automatically included in subsequent requests
const { data, error } = await supabase.auth.signInWithPassword({
  email: sanitizedEmail,
  password: sanitizedPassword,
});

// All subsequent API calls automatically include JWT
const { data: leads } = await supabase
  .from("leads")
  .select("*");
// ↑ JWT sent in Authorization header automatically
```

### Request Headers

**Automatic JWT Inclusion:**
```http
GET /rest/v1/leads HTTP/1.1
Host: your-project.supabase.co
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
apikey: your-anon-key
```

**CSRF Protection Headers:**
```http
Origin: https://propflow.example.com
Referer: https://propflow.example.com/leads
```

---

## Security Measures in Place

### ✅ 1. JWT Signature Validation
- **Location:** Supabase server-side
- **Protection:** Prevents token forgery
- **Implementation:** Automatic via Supabase Auth

### ✅ 2. Token Expiration
- **Default:** 1 hour (configurable)
- **Refresh:** Automatic via refresh tokens
- **Protection:** Limits window of opportunity for stolen tokens

### ✅ 3. Secure Token Storage
- **Method:** httpOnly cookies (when configured) or localStorage
- **Protection:** JavaScript cannot access httpOnly cookies
- **Fallback:** localStorage with XSS protection via input sanitization

### ✅ 4. Input Sanitization
- **Location:** [`src/lib/sanitize.ts`](../src/lib/sanitize.ts)
- **Protection:** Prevents XSS attacks that could steal tokens
- **Coverage:** All user inputs sanitized before processing

### ✅ 5. HTTPS Enforcement
- **Configuration:** Vercel/production environment
- **Protection:** Prevents man-in-the-middle attacks
- **Status:** Enforced in production

### ✅ 6. Rate Limiting
- **Location:** [`supabase/migrations/011_password_reset_rate_limiting.sql`](../supabase/migrations/011_password_reset_rate_limiting.sql)
- **Protection:** Prevents brute-force attacks
- **Coverage:** Password reset, login attempts

---

## Why Custom CSRF Tokens Are Not Needed

### Traditional CSRF Protection (Not Required)

**Traditional Approach:**
```typescript
// ❌ NOT NEEDED - Traditional CSRF token approach
const csrfToken = generateToken();
setCookie('csrf_token', csrfToken);

// Include in forms
<input type="hidden" name="csrf_token" value={csrfToken} />

// Validate on server
if (request.csrf_token !== session.csrf_token) {
  throw new Error('CSRF validation failed');
}
```

**Why We Don't Need This:**
1. **JWT-based auth** already provides CSRF protection
2. **SameSite cookies** prevent cross-site requests
3. **Origin validation** blocks unauthorized domains
4. **No session cookies** that could be exploited

### Modern Approach (Current Implementation)

**Our Approach:**
```typescript
// ✅ CURRENT - JWT-based protection (automatic)
const { data } = await supabase.auth.signInWithPassword({
  email,
  password,
});
// JWT automatically included in all subsequent requests
// No manual CSRF token management needed
```

**Benefits:**
- ✅ Simpler implementation
- ✅ No token synchronization issues
- ✅ Automatic token refresh
- ✅ Stateless authentication
- ✅ Better mobile app support

---

## Additional Security Layers

### 1. Row-Level Security (RLS)

**Implementation:** [`supabase/migrations/010_enhance_rls_team_filtering.sql`](../supabase/migrations/010_enhance_rls_team_filtering.sql)

**Protection:**
- Even if CSRF attack succeeds, RLS prevents unauthorized data access
- Users can only access data within their tenant/team scope
- Database-level enforcement (cannot be bypassed)

**Example:**
```sql
-- Leads can only be accessed by users in the same tenant
CREATE POLICY "leads_read_scope" ON public.leads
FOR SELECT USING (
  tenant_id = current_user_tenant_id()
  OR is_super_admin()
);
```

### 2. Input Validation

**Implementation:** [`src/lib/sanitize.ts`](../src/lib/sanitize.ts)

**Protection:**
- Prevents XSS attacks that could steal JWTs
- Sanitizes all user inputs before processing
- Validates data types and formats

**Example:**
```typescript
import { sanitizeEmail, sanitizeText } from "@/lib/sanitize";

const email = sanitizeEmail(userInput.email);
const name = sanitizeText(userInput.name, { maxLength: 100 });
```

### 3. Content Security Policy (CSP)

**Recommended Configuration:**
```typescript
// Add to vercel.json or next.config.js
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co;"
        }
      ]
    }
  ]
}
```

**Status:** ⚠️ Recommended for future implementation

---

## Testing CSRF Protection

### Manual Testing

**Test 1: Cross-Origin Request**
```bash
# Attempt to make request from different origin
curl -X POST https://your-project.supabase.co/rest/v1/leads \
  -H "Origin: https://malicious-site.com" \
  -H "Authorization: Bearer stolen-jwt" \
  -H "apikey: your-anon-key"

# Expected: 403 Forbidden (Origin validation fails)
```

**Test 2: Missing JWT**
```bash
# Attempt request without JWT
curl -X GET https://your-project.supabase.co/rest/v1/leads \
  -H "apikey: your-anon-key"

# Expected: 401 Unauthorized
```

**Test 3: Invalid JWT**
```bash
# Attempt request with forged JWT
curl -X GET https://your-project.supabase.co/rest/v1/leads \
  -H "Authorization: Bearer invalid-jwt" \
  -H "apikey: your-anon-key"

# Expected: 401 Unauthorized (Signature validation fails)
```

### Automated Testing

**Recommended Tools:**
- **OWASP ZAP:** Automated CSRF testing
- **Burp Suite:** Manual security testing
- **Playwright:** E2E security tests

**Example Test:**
```typescript
// tests/security/csrf.spec.ts
import { test, expect } from '@playwright/test';

test('CSRF protection prevents unauthorized requests', async ({ page, context }) => {
  // Login and get JWT
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  // Extract JWT from localStorage
  const jwt = await page.evaluate(() => localStorage.getItem('supabase.auth.token'));
  
  // Attempt cross-origin request (should fail)
  const response = await context.request.post('https://your-project.supabase.co/rest/v1/leads', {
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Origin': 'https://malicious-site.com',
    },
    data: { name: 'Test Lead' },
  });
  
  expect(response.status()).toBe(403);
});
```

---

## Monitoring & Incident Response

### Monitoring

**Metrics to Track:**
- Failed authentication attempts
- Invalid JWT errors
- Cross-origin request rejections
- Unusual API usage patterns

**Tools:**
- Supabase Dashboard > Logs
- Vercel Analytics
- Custom error tracking (Sentry recommended)

### Incident Response

**If CSRF Attack Detected:**

1. **Immediate Actions:**
   - Revoke all active sessions
   - Force password reset for affected users
   - Review access logs for unauthorized data access

2. **Investigation:**
   - Identify attack vector
   - Check for XSS vulnerabilities
   - Review recent code changes

3. **Remediation:**
   - Patch vulnerabilities
   - Update security policies
   - Notify affected users

4. **Prevention:**
   - Implement additional security headers
   - Add rate limiting
   - Enhance monitoring

---

## Best Practices

### ✅ Do's

1. **Always use HTTPS in production**
2. **Keep Supabase client library updated**
3. **Sanitize all user inputs**
4. **Implement proper error handling**
5. **Use RLS policies for all tables**
6. **Monitor authentication logs**
7. **Rotate JWT secrets periodically**
8. **Implement rate limiting**

### ❌ Don'ts

1. **Don't store JWTs in plain cookies without httpOnly**
2. **Don't expose JWTs in URLs or logs**
3. **Don't disable CORS without understanding implications**
4. **Don't trust client-side validation alone**
5. **Don't use weak JWT secrets**
6. **Don't ignore security warnings**

---

## Future Enhancements

### Recommended Additions

1. **Content Security Policy (CSP)**
   - Prevent XSS attacks
   - Restrict resource loading
   - Report violations

2. **Subresource Integrity (SRI)**
   - Verify CDN resources
   - Prevent tampering

3. **Security Headers**
   ```typescript
   X-Frame-Options: DENY
   X-Content-Type-Options: nosniff
   Referrer-Policy: strict-origin-when-cross-origin
   Permissions-Policy: geolocation=(), microphone=(), camera=()
   ```

4. **Advanced Rate Limiting**
   - Per-user limits
   - Per-IP limits
   - Adaptive throttling

5. **Security Audit Logging**
   - Track all authentication events
   - Log permission changes
   - Monitor data access patterns

---

## Compliance

### OWASP Top 10 Coverage

- ✅ **A01:2021 – Broken Access Control:** RLS policies + JWT validation
- ✅ **A02:2021 – Cryptographic Failures:** HTTPS + JWT signatures
- ✅ **A03:2021 – Injection:** Input sanitization
- ✅ **A05:2021 – Security Misconfiguration:** Secure defaults
- ✅ **A07:2021 – Identification and Authentication Failures:** JWT + rate limiting
- ✅ **A08:2021 – Software and Data Integrity Failures:** JWT signatures

### GDPR Compliance

- ✅ Data encryption in transit (HTTPS)
- ✅ Access control (RLS + JWT)
- ✅ Audit logging (Supabase logs)
- ✅ Right to erasure (user deletion)

---

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [SameSite Cookie Attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)

---

**Document Status:** Complete  
**Review Date:** 2026-05-15  
**Next Review:** 2026-08-15 (Quarterly)

**Prepared by:** Engineering Team  
**Approved by:** Security Team