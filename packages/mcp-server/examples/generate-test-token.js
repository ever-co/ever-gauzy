/**
 * Generate Test JWT Tokens for Development
 *
 * This script generates JWT tokens for testing OAuth 2.0 authorization
 * in development environment.
 *
 * Usage: node generate-test-token.js
 */

const crypto = require('crypto');

function base64UrlEncode(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function generateTestJWT(payload = {}, secret = (process.env.MCP_AUTH_JWT_SECRET || 'dev-secret-key-for-testing-only'))  {
    // JWT Header
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

    // Default payload
    const now = Math.floor(Date.now() / 1000);
    const defaultPayload = {
        iss: 'gauzy-dev-auth',           // Issuer
        aud: 'http://localhost:3001/sse',    // Audience (your MCP server)
        sub: 'test-user-123',            // Subject (user ID)
        client_id: 'test-client',        // OAuth client ID
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
    const signature = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${data}.${signature}`;
}

// Generate test tokens
console.log('🔑 Test JWT Tokens for MCP OAuth 2.0 Development\n');

// Valid token with required scopes
const validToken = generateTestJWT();
console.log('✅ Valid Token (mcp.read, mcp.write):');
console.log(validToken);
console.log('\nAuthorization header:\nBearer ' + validToken + '\n');
console.log();

// Token with insufficient scopes
const insufficientScopesToken = generateTestJWT({
    scope: 'read:basic'
});
console.log('❌ Insufficient Scopes Token (read:basic):');
console.log(insufficientScopesToken);
console.log();

// Expired token
const expiredToken = generateTestJWT({
    exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
});
console.log('⏰ Expired Token:');
console.log(expiredToken);
console.log();

// Token with wrong audience
const wrongAudienceToken = generateTestJWT({
    aud: 'https://other-service.com'
});
console.log('🎯 Wrong Audience Token:');
console.log(wrongAudienceToken);
console.log();

// Admin token with all scopes
const adminToken = generateTestJWT({
    sub: 'admin-user-456',
    scope: 'mcp.read mcp.write mcp.admin',
    role: 'admin'
});
console.log('👑 Admin Token (all scopes):');
console.log(adminToken);
console.log();

console.log('📋 Usage Instructions:');
console.log('1. Start your MCP server: yarn nx serve mcp');
console.log('2. Copy any token above');
console.log('3. Use in Postman Authorization header: Bearer <token>');
console.log('4. Test different endpoints to see authorization in action');

// Decode and display the valid token payload for reference
const payloadB64 = validToken.split('.')[1];
const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
console.log('\n📄 Valid Token Payload:');
console.log(JSON.stringify(payload, null, 2));
