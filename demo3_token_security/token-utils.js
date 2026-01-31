/**
 * Token Security Utility Library
 * 
 * ⚠️ IMPORTANT: This is a JavaScript simulation for demonstration purposes only!
 * 
 * In production, token generation MUST happen server-side (PHP/Node.js/Python) to:
 * 1. Keep the SECRET_KEY truly secret
 * 2. Prevent client-side token forgery
 * 3. Validate against server-side user sessions
 * 4. Check database for user permissions and enrollment
 * 
 * This demo shows the CONCEPT of secure token-based launch for the proposal.
 */

const TokenSecurity = (() => {
    // ⚠️ In production: This SECRET_KEY would be in server environment variables, NEVER in JavaScript!
    const SECRET_KEY = 'demo_secret_key_12345_NEVER_IN_CLIENT_CODE';
    
    // Token expiration time (5 minutes for demo)
    const TOKEN_EXPIRATION_MS = 5 * 60 * 1000;
    
    /**
     * Generate a secure token (simulates server-side PHP generation)
     * 
     * In production PHP, this would:
     * 1. Verify user is authenticated in LMS
     * 2. Check database for course enrollment
     * 3. Create token with user/course binding
     * 4. Sign with server-side secret
     * 5. Store token hash in database for verification
     */
    async function generateToken(userId, courseId) {
        const now = Date.now();
        const expiresAt = now + TOKEN_EXPIRATION_MS;
        
        const payload = {
            user_id: userId,
            course_id: courseId,
            issued_at: now,
            expires_at: expiresAt,
            session_id: generateSessionId()
        };
        
        // Simulate HMAC signature (in production: use crypto.subtle or server-side HMAC)
        const signature = await generateSignature(payload, SECRET_KEY);
        
        const token = {
            payload: payload,
            signature: signature
        };
        
        // Encode as base64 for URL transport
        return btoa(JSON.stringify(token));
    }
    
    /**
     * Validate token (simulates server-side PHP validation)
     * 
     * In production PHP, this would:
     * 1. Decode token from request
     * 2. Verify signature with server secret
     * 3. Check expiration time
     * 4. Verify token hash exists in database
     * 5. Check user session is still active
     * 6. Verify user is still enrolled in course
     */
    async function validateToken(tokenString) {
        try {
            // Decode token
            const token = JSON.parse(atob(tokenString));
            
            if (!token.payload || !token.signature) {
                return {
                    valid: false,
                    reason: 'Invalid token structure',
                    details: 'Token is missing required fields'
                };
            }
            
            const { payload, signature } = token;
            
            // Verify signature
            const expectedSignature = await generateSignature(payload, SECRET_KEY);
            if (signature !== expectedSignature) {
                return {
                    valid: false,
                    reason: 'Invalid signature',
                    details: 'Token signature verification failed. Token may have been tampered with.'
                };
            }
            
            // Check expiration
            const now = Date.now();
            if (now > payload.expires_at) {
                const expiredAgo = Math.floor((now - payload.expires_at) / 1000);
                return {
                    valid: false,
                    reason: 'Token expired',
                    details: `Token expired ${expiredAgo} seconds ago. Please launch the content again from the LMS.`,
                    expired_at: new Date(payload.expires_at).toISOString()
                };
            }
            
            // Token is valid
            return {
                valid: true,
                payload: payload,
                time_remaining: payload.expires_at - now,
                details: 'Token is valid and active'
            };
            
        } catch (error) {
            return {
                valid: false,
                reason: 'Token parsing error',
                details: error.message
            };
        }
    }
    
    /**
     * Generate HMAC-like signature (simplified simulation)
     * 
     * In production: Use proper HMAC-SHA256
     * PHP: hash_hmac('sha256', $payload, $secret)
     * Node.js: crypto.createHmac('sha256', secret).update(payload).digest('hex')
     */
    async function generateSignature(payload, secret) {
        const payloadString = JSON.stringify(payload);
        const data = payloadString + secret;
        
        // Use Web Crypto API for consistent hashing
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        
        // Convert to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex;
    }
    
    /**
     * Generate a random session ID
     */
    function generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
    
    /**
     * Format time remaining in human-readable format
     */
    function formatTimeRemaining(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${seconds}s`;
    }
    
    /**
     * Get token from URL parameters
     */
    function getTokenFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('token');
    }
    
    /**
     * Get token expiration time in milliseconds
     */
    function getTokenExpirationTime() {
        return TOKEN_EXPIRATION_MS;
    }
    
    // Public API
    return {
        generateToken,
        validateToken,
        getTokenFromURL,
        formatTimeRemaining,
        getTokenExpirationTime
    };
})();
