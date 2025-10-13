/**
 * OAuth 2.0 Authorization Code Management
 *
 * Manages authorization codes for OAuth 2.0 authorization code flow
 */

import * as crypto from 'crypto';
import { SecurityLogger } from '../utils/security-logger';

export interface AuthorizationCode {
	code: string;
	clientId: string;
	userId: string;
	redirectUri: string;
	scopes: string[];
	codeChallenge?: string;
	codeChallengeMethod?: 'S256' | 'plain';
	state?: string;
	createdAt: Date;
	expiresAt: Date;
	isUsed: boolean;
	metadata?: Record<string, any>;
}

export interface AuthorizationRequest {
	clientId: string;
	redirectUri: string;
	scopes: string[];
	state?: string;
	codeChallenge?: string;
	codeChallengeMethod?: 'S256' | 'plain';
	responseType: string;
}

export interface TokenExchangeRequest {
	code: string;
	clientId: string;
	clientSecret?: string;
	redirectUri: string;
	grantType: string;
	codeVerifier?: string;
}

export class OAuth2AuthorizationCodeManager {
	private codes = new Map<string, AuthorizationCode>();
	private securityLogger: SecurityLogger;
	private cleanupInterval: NodeJS.Timeout;

	// Authorization code expires in 10 minutes (recommended by RFC 6749)
	private readonly CODE_EXPIRATION_TIME = 10 * 60 * 1000; // 10 minutes
	private readonly MAX_CODES = 5000;

	/**
	 * Redact authorization code for logging (show first 4 + '...' + last 4 characters)
	 */
	private redactAuthorizationCode(code: string): string {
		if (!code) return '[empty]';
		if (code.length <= 8) return '*'.repeat(code.length);
		return `${code.substring(0, 4)}...${code.substring(code.length - 4)}`;
	}

	constructor() {
		this.securityLogger = new SecurityLogger();

		// Cleanup expired codes every 5 minutes
		this.cleanupInterval = setInterval(() => {
			this.cleanupExpiredCodes();
		}, 5 * 60 * 1000);
		this.cleanupInterval.unref();
	}

	/**
	 * Generate authorization code for user consent
	 */
	generateAuthorizationCode(
		clientId: string,
		userId: string,
		redirectUri: string,
		scopes: string[],
		options: {
			state?: string;
			codeChallenge?: string;
			codeChallengeMethod?: 'S256' | 'plain';
			metadata?: Record<string, any>;
		} = {}
	): string {
		const code = this.generateSecureCode();
		const now = new Date();
		const expiresAt = new Date(now.getTime() + this.CODE_EXPIRATION_TIME);

		const authCode: AuthorizationCode = {
			code,
			clientId,
			userId,
			redirectUri,
			scopes,
			codeChallenge: options.codeChallenge,
			codeChallengeMethod: options.codeChallengeMethod,
			state: options.state,
			createdAt: now,
			expiresAt,
			isUsed: false,
			metadata: options.metadata
		};

		this.codes.set(code, authCode);

		this.securityLogger.debug(`Authorization code generated for user ${userId}, client ${clientId}`);
		return code;
	}

	/**
	 * Exchange authorization code for token information
	 */
	exchangeAuthorizationCode(
		code: string,
		clientId: string,
		redirectUri: string,
		codeVerifier?: string
	): AuthorizationCode | null {
		const authCode = this.codes.get(code);

		if (!authCode) {
			this.securityLogger.warn(`Authorization code not found: ${this.redactAuthorizationCode(code)}`);
			return null;
		}

		// Check if code is expired
		if (new Date() > authCode.expiresAt) {
			this.securityLogger.warn(`Authorization code expired: ${this.redactAuthorizationCode(code)}`);
			this.codes.delete(code);
			return null;
		}

		// Check if code was already used
		if (authCode.isUsed) {
			this.securityLogger.warn(`Authorization code already used: ${this.redactAuthorizationCode(code)}`);
			this.codes.delete(code);
			return null;
		}

		// Validate client ID
		if (authCode.clientId !== clientId) {
			this.securityLogger.warn(`Client ID mismatch for code ${this.redactAuthorizationCode(code)}: expected ${authCode.clientId}, got ${clientId}`);
			return null;
		}

		// Validate redirect URI
		if (authCode.redirectUri !== redirectUri) {
			this.securityLogger.warn(`Redirect URI mismatch for code ${this.redactAuthorizationCode(code)}`);
			return null;
		}

		// Validate PKCE if present
		if (authCode.codeChallenge) {
			if (!codeVerifier) {
				this.securityLogger.warn(`PKCE code verifier missing for code ${this.redactAuthorizationCode(code)}`);
				return null;
			}

			if (!this.validatePKCE(authCode.codeChallenge, authCode.codeChallengeMethod, codeVerifier)) {
				this.securityLogger.warn(`PKCE validation failed for code ${this.redactAuthorizationCode(code)}`);
				return null;
			}
		}

		// Mark code as used
		authCode.isUsed = true;

		this.securityLogger.log(`Authorization code exchanged successfully for user ${authCode.userId}, client ${clientId}`);

		// Remove code after successful exchange
		setTimeout(() => {
			this.codes.delete(code);
		}, 1000); // Small delay to prevent race conditions

		return { ...authCode };
	}

	/**
	 * Validate PKCE challenge
	 */
	private validatePKCE(
		codeChallenge: string,
		method: 'S256' | 'plain' | undefined,
		codeVerifier: string
	): boolean {
		const m = method ?? 'S256';
		if (m === 'plain') {
			const challengeBuffer = Buffer.from(codeChallenge, 'utf8');
			const verifierBuffer = Buffer.from(codeVerifier, 'utf8');
			if (challengeBuffer.length !== verifierBuffer.length) {
				return false;
			}
			return crypto.timingSafeEqual(challengeBuffer, verifierBuffer);
		} else if (m === 'S256') {
			const hash = crypto
				.createHash('sha256')
				.update(codeVerifier, 'ascii')
				.digest('base64url');
			const challengeBuffer = Buffer.from(codeChallenge, 'utf8');
			const hashBuffer = Buffer.from(hash, 'utf8');
			if (challengeBuffer.length !== hashBuffer.length) {
				return false;
			}
			return crypto.timingSafeEqual(challengeBuffer, hashBuffer);
		}
		return false;
	}

	/**
	 * Generate secure authorization code
	 */
	private generateSecureCode(): string {
		// Generate cryptographically secure random code
		const randomBytes = crypto.randomBytes(32);
		return randomBytes.toString('base64url');
	}

	/**
	 * Clean up expired authorization codes
	 */
	private cleanupExpiredCodes(): void {
		const now = new Date();
		let cleanedCount = 0;

		for (const [code, authCode] of this.codes.entries()) {
			if (now > authCode.expiresAt || authCode.isUsed) {
				this.codes.delete(code);
				cleanedCount++;
			}
		}

		while (this.codes.size > this.MAX_CODES) {
			const oldest = this.codes.keys().next().value;
			if (!oldest) break;
			this.codes.delete(oldest);
			cleanedCount++;
		}

		if (cleanedCount > 0) {
			this.securityLogger.debug(`Cleaned up ${cleanedCount} expired/used authorization codes`);
		}
	}

	/**
	 * Get authorization code details (for debugging)
	 */
	getAuthorizationCode(code: string): AuthorizationCode | null {
		return this.codes.get(code) || null;
	}

	/**
	 * Get statistics
	 */
	getStats(): { totalCodes: number; activeCodes: number; expiredCodes: number } {
		const now = new Date();
		let activeCodes = 0;
		let expiredCodes = 0;

		for (const authCode of this.codes.values()) {
			if (now > authCode.expiresAt || authCode.isUsed) {
				expiredCodes++;
			} else {
				activeCodes++;
			}
		}

		return {
			totalCodes: this.codes.size,
			activeCodes,
			expiredCodes
		};
	}

	/**
	 * Cleanup and destroy
	 */
	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
		this.codes.clear();
	}
}

// Singleton instance
export const oAuth2AuthorizationCodeManager = new OAuth2AuthorizationCodeManager();
