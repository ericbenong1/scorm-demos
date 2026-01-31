# Demo 3: Token Security Demo

## 🎯 Purpose

This demo demonstrates the concept of **secure token-based launch** for SCORM Light packages. It shows how to prevent unauthorized access to course content by implementing time-limited, signed tokens that bind users to specific courses and sessions.

## 🔐 What This Demo Shows

1. **Token Generation**: Simulates LMS generating a secure token when user clicks "Launch"
2. **Token Structure**: Shows token payload (user_id, course_id, timestamps, session_id) and signature
3. **Token Validation**: Validates token signature and expiration before displaying content
4. **Security Enforcement**: Redirects to error page if token is invalid, expired, or missing
5. **User Experience**: Clean, professional interface with clear security messaging

## 📁 Files

- **`launcher.html`** - Simulates the LMS launch page that generates tokens and redirects to content
- **`content.html`** - Protected content page that validates tokens before displaying
- **`rejected.html`** - Error page shown when token validation fails
- **`token-utils.js`** - JavaScript library with token generation/validation logic
- **`styles.css`** - Professional styling for all pages
- **`README.md`** - This documentation file

## 🚀 How to Use

### Option 1: Open Locally
1. Open `launcher.html` in a web browser
2. Enter a User ID and Course ID (or use the defaults)
3. Click "Launch Content" to generate a token
4. You'll be redirected to `content.html` with the token
5. Content validates the token and displays if valid

### Option 2: Test Error Scenarios
- **Expired Token**: Wait 5 minutes after launching, or click "Test Expired Token" button
- **Invalid Token**: Manually modify the token in the URL and reload
- **Missing Token**: Access `content.html` directly without a token

### Option 3: Host on GitHub Pages
```bash
# This demo works on GitHub Pages as it's pure client-side JavaScript
# Just push to your repo and enable GitHub Pages
```

## 🔍 Demo Flow

```
┌─────────────────┐
│  launcher.html  │  ← User clicks "Launch"
│  (LMS Simulator)│
└────────┬────────┘
         │
         │ Generates token with:
         │ - user_id, course_id
         │ - timestamps, expiration
         │ - signature (HMAC-like)
         ↓
┌─────────────────┐
│  content.html   │  ← Validates token
│ (Protected Page)│
└────────┬────────┘
         │
    Valid? ├─── YES → Display content
         │
         └─── NO ──→ rejected.html (Error page)
```

## ⚠️ Important: JavaScript Simulation

**This demo uses JavaScript for proof-of-concept purposes ONLY!**

### Why JavaScript in the Demo?
- GitHub Pages doesn't support server-side code (PHP/Node.js)
- Demonstrates the security concepts visually
- Shows the complete workflow end-to-end
- Appropriate for proposal demonstration

### Production Requirements

In a **real SCORM Light implementation**, token security MUST be server-side:

#### ❌ Do NOT do in production:
```javascript
// INSECURE - Secret key exposed in JavaScript
const SECRET_KEY = 'my_secret_key';
const token = generateToken(userId, SECRET_KEY);
```

#### ✅ DO in production (PHP example):
```php
// lms_launch.php (SECURE - Server-side)

session_start();

// Verify user is authenticated
if (!isset($_SESSION['user_id'])) {
    die('Not authenticated');
}

$user_id = $_SESSION['user_id'];
$course_id = $_GET['course_id'];

// Check database: Is user enrolled?
$db = new Database();
if (!$db->isUserEnrolled($user_id, $course_id)) {
    die('Not enrolled in this course');
}

// Generate secure token with server-side secret
$secret_key = getenv('TOKEN_SECRET_KEY'); // From environment
$token_data = [
    'user_id' => $user_id,
    'course_id' => $course_id,
    'issued_at' => time(),
    'expires_at' => time() + (5 * 60), // 5 minutes
    'session_id' => session_id()
];

// Sign token with HMAC
$payload = json_encode($token_data);
$signature = hash_hmac('sha256', $payload, $secret_key);
$token = base64_encode(json_encode([
    'payload' => $token_data,
    'signature' => $signature
]));

// Store token hash in database for verification
$token_hash = hash('sha256', $token);
$db->storeToken($token_hash, $user_id, $course_id, $token_data['expires_at']);

// Redirect to content with token
header("Location: content.php?token=" . urlencode($token));
exit;
```

#### Content Validation (PHP):
```php
// content.php (SECURE - Server-side validation)

$token = $_GET['token'] ?? '';

if (empty($token)) {
    header('Location: rejected.php?reason=missing');
    exit;
}

// Decode and validate token
$token_decoded = json_decode(base64_decode($token), true);
$payload = $token_decoded['payload'];
$signature = $token_decoded['signature'];

// Verify signature
$secret_key = getenv('TOKEN_SECRET_KEY');
$expected_signature = hash_hmac('sha256', json_encode($payload), $secret_key);

if (!hash_equals($expected_signature, $signature)) {
    header('Location: rejected.php?reason=invalid_signature');
    exit;
}

// Check expiration
if (time() > $payload['expires_at']) {
    header('Location: rejected.php?reason=expired');
    exit;
}

// Verify token exists in database
$db = new Database();
$token_hash = hash('sha256', $token);
if (!$db->tokenExists($token_hash)) {
    header('Location: rejected.php?reason=not_found');
    exit;
}

// Check session binding
session_start();
if (session_id() !== $payload['session_id']) {
    header('Location: rejected.php?reason=session_mismatch');
    exit;
}

// All checks passed - load content
$user_id = $payload['user_id'];
$course_id = $payload['course_id'];

include 'scorm_content_template.php';
```

## 🔧 Technical Details

### Token Structure
```json
{
  "payload": {
    "user_id": "user_12345",
    "course_id": "course_scorm_light_101",
    "issued_at": 1738368000000,
    "expires_at": 1738368300000,
    "session_id": "sess_abc123xyz_1738368000000"
  },
  "signature": "a7f3c9e1b2d4f6a8c5e7d9f1b3a5c7e9..."
}
```

### Token Validation Steps
1. **Extract**: Get token from URL parameter
2. **Decode**: Decode base64-encoded token
3. **Parse**: Parse JSON structure
4. **Verify Signature**: Recalculate signature and compare
5. **Check Expiration**: Ensure current time < expires_at
6. **Validate Payload**: Ensure all required fields present
7. **Grant Access**: Display content if all checks pass

### Security Features Demonstrated

✅ **User Binding**: Token contains specific user_id and course_id  
✅ **Time Limitation**: Token expires after 5 minutes  
✅ **Signature Verification**: Detects token tampering  
✅ **Session Binding**: Token linked to session_id  
✅ **Clear Error Messages**: Users understand what went wrong  
✅ **Professional UX**: Clean, accessible interface

## 📚 Educational Value

This demo teaches:

1. **Why tokens are needed**: Prevents unauthorized access via direct links
2. **How tokens work**: Generation → Transport → Validation flow
3. **Security principles**: Signing, expiration, binding
4. **Production requirements**: Server-side implementation necessity
5. **User experience**: What users see during launch process

## 🎓 Learning Outcomes

After exploring this demo, you'll understand:

- How token-based launch prevents content sharing via URLs
- Why token expiration protects against replay attacks
- The importance of signature verification to prevent tampering
- Why server-side implementation is mandatory in production
- How this fits into the SCORM Light architecture

## 🔗 Integration with SCORM Light

In the full SCORM Light implementation:

```
┌──────────────┐
│     LMS      │
│  (PHP/Server)│
└──────┬───────┘
       │
       │ 1. User clicks "Launch"
       │ 2. Generate token (server-side)
       │ 3. Redirect to wrapper with token
       ↓
┌──────────────────┐
│  SCORM Wrapper   │  ← launch.html in scorm_package/
│  (Hosted on LMS) │
└──────┬───────────┘
       │
       │ 4. Validate token (server-side)
       │ 5. If valid, load iframe with external content
       ↓
┌──────────────────────┐
│  External Content    │  ← Your course content
│  (GitHub Pages/CDN)  │
└──────────────────────┘
```

## 🚀 Next Steps for Production

1. **Implement server-side token generation** (PHP/Node.js/Python)
2. **Store secret keys in environment variables** (never in code)
3. **Add database token tracking** (store token hashes)
4. **Implement session verification** (bind tokens to sessions)
5. **Add logging and monitoring** (track failed attempts)
6. **Set appropriate token expiration** (balance security vs. UX)
7. **Handle edge cases** (network delays, clock skew)
8. **Add user-friendly error messages** (guide users to proper launch)

## 📝 Notes

- **Token expiration**: 5 minutes in demo (adjust for production based on content length)
- **Signature algorithm**: Simulated HMAC-SHA256 (use proper crypto in production)
- **Session binding**: Demonstrated (requires server-side session management)
- **Database storage**: Not implemented in demo (required for production)

## 🔍 Testing Checklist

- [ ] Valid token allows content access
- [ ] Expired token shows error page
- [ ] Invalid token shows error page
- [ ] Missing token shows error page
- [ ] Token info displays correctly in content page
- [ ] Time remaining updates in real-time
- [ ] Expiration triggers redirect to error page
- [ ] Error page shows helpful information
- [ ] All pages are styled consistently
- [ ] Mobile responsive design works

## 📞 Questions?

This demo is designed to demonstrate understanding of secure launch architecture for the SCORM Light proposal. The JavaScript simulation shows the concepts clearly while acknowledging that production requires server-side implementation.

**Key Takeaway**: Token security is essential for protecting SCORM content, and this demo shows exactly how it would work in a production environment.

---

**Demo 3 of 3** - Part of the SCORM Light Package Conversion Proposal
