/**
 * Generate Test JWT Tokens for Development
 *
 * This script generates JWT tokens for testing OAuth 2.0 authorization
 * in development environment.
 *
 * Before using these tokens, register an OAuth client via the /oauth/register endpoint:
 *
 *   # Register a public client (no secret required):
 *   curl -X POST http://localhost:3001/oauth/register \
 *     -H "Content-Type: application/json" \
 *     -d '{
 *       "client_name": "My Public App",
 *       "client_type": "public",
 *       "redirect_uris": ["http://localhost:3001/callback"],
 *       "grant_types": ["authorization_code", "refresh_token"],
 *       "response_types": ["code"],
 *       "scope": "mcp.read mcp.write"
 *     }'
 *
 *   # Register a confidential client (secret generated in response):
 *   curl -X POST http://localhost:3001/oauth/register \
 *     -H "Content-Type: application/json" \
 *     -d '{
 *       "client_name": "My Server App",
 *       "client_type": "confidential",
 *       "redirect_uris": ["https://myapp.example.com/callback"],
 *       "grant_types": ["authorization_code", "refresh_token"],
 *       "response_types": ["code"],
 *       "scope": "mcp.read mcp.write mcp.admin"
 *     }'
 *
 * Usage: node generate-test-token.js
 */

const crypto = require('crypto');
const fs = require('fs');

function base64UrlEncode(str) {
    return Buffer.from(str).toString('base64url');
}

// Optional dev RSA key for RS256 (place dev-private-key.pem next to this script)
const devPrivateKeyPath = './dev-private-key.pem';
const devPrivateKey = fs.existsSync(devPrivateKeyPath) ? fs.readFileSync(devPrivateKeyPath) : null;

function generateTestJWT(payload = {}, secret = (process.env.MCP_AUTH_JWT_SECRET || 'dev-secret-key-for-testing-only'))  {
    // JWT Header
    const useRS256 = !!devPrivateKey;
    const header = { alg: useRS256 ? 'RS256' : 'HS256', typ: 'JWT', ...(useRS256 ? { kid: 'dev-key' } : {}) };
    if (process.env.MCP_DEBUG || process.env.GAUZY_MCP_DEBUG === 'true') {
        console.log(`[generator] Using ${header.alg} (${useRS256 ? 'dev-private-key.pem found' : 'HMAC secret'})`);
    }

    // Default payload
    const now = Math.floor(Date.now() / 1000);
    const defaultPayload = {
        iss: 'gauzy-dev-auth',           // Issuer
        aud: 'http://localhost:3001/sse',    // Audience (your MCP server)
        sub: 'test-user-123',            // Subject (user ID)
        client_id: 'my-registered-client',   // OAuth client ID (must be registered first)
        scope: 'mcp.read mcp.write',     // Granted scopes
        iat: now,                        // Issued at
        exp: now + 3600,                 // Expires in 1 hour
        ...payload
    };

    // Encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(defaultPayload));

    // Create signature
    const data = `${encodedHeader}.${encodedPayload}`;
    let signature;
    if (useRS256) {
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(data);
        signer.end();
        signature = signer.sign(devPrivateKey).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    } else {
        signature = crypto.createHmac('sha256', secret)
            .update(data)
            .digest('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }
    return `${data}.${signature}`;
}

// Generate test tokens
console.log('Test JWT Tokens for MCP OAuth 2.0 Development\n');
console.log('NOTE: You must first register an OAuth client via POST /oauth/register');
console.log('      See the comments at the top of this file for examples.\n');

// Valid token with required scopes
const validToken = generateTestJWT();
console.log('Valid Token (mcp.read, mcp.write):');
console.log(validToken);
console.log('\nAuthorization header:\nAuthorization: Bearer ' + validToken + '\n');
console.log();

// Token with insufficient scopes
const insufficientScopesToken = generateTestJWT({
    scope: 'read:basic'
});
console.log('Insufficient Scopes Token (read:basic):');
console.log(insufficientScopesToken);
console.log();

// Expired token
const expiredToken = generateTestJWT({
    exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
});
console.log('Expired Token:');
console.log(expiredToken);
console.log();

// Token with wrong audience
const wrongAudienceToken = generateTestJWT({
    aud: 'https://other-service.com'
});
console.log('Wrong Audience Token:');
console.log(wrongAudienceToken);
console.log();

// Admin token with all scopes
const adminToken = generateTestJWT({
    sub: 'admin-user-456',
    scope: 'mcp.read mcp.write mcp.admin',
    role: 'admin'
});
console.log('Admin Token (all scopes):');
console.log(adminToken);
console.log();

console.log('Usage Instructions:');
console.log('1. Start your MCP server: yarn nx serve mcp');
console.log('2. Register an OAuth client via POST /oauth/register (see examples above)');
console.log('3. Copy any token above');
console.log('4. Use in Postman Authorization header: Bearer <token>');
console.log('5. Test different endpoints to see authorization in action');

// Decode and display the valid token payload for reference
const payloadB64 = validToken.split('.')[1];
const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
console.log('\nValid Token Payload:');
console.log(JSON.stringify(payload, null, 2));
