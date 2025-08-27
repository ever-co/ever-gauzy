/**
 * OAuth 2.0 JWT Token Management
 *
 * Manages JWT access tokens and refresh tokens for OAuth 2.0 flows
 */

import jwt from 'jsonwebtoken';
import { SignJWT, importPKCS8, importSPKI } from 'jose';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { SecurityLogger } from './security-logger';

export interface TokenPair {
	accessToken: string;
	refreshToken?: string;
	tokenType: 'Bearer';
	expiresIn: number;
	scope: string;
	issuedAt: number;
}

export interface TokenPayload {
	sub: string; // Subject (user ID)
	aud: string; // Audience
	iss: string; // Issuer
	iat: number; // Issued at
	exp: number; // Expires at
	nbf?: number; // Not before
	jti: string; // JWT ID
	client_id: string;
	scope: string;
	token_type: 'access_token' | 'refresh_token';
	[key: string]: any;
}

export interface RefreshToken {
	tokenId: string;
	userId: string;
	clientId: string;
	scopes: string[];
	createdAt: Date;
	expiresAt: Date;
	isRevoked: boolean;
	parentTokenId?: string;
}

interface KeyPair {
	publicKey: string;
	privateKey: string;
	keyId: string;
	algorithm: 'RS256' | 'ES256';
}

export class OAuth2TokenManager {
	private securityLogger: SecurityLogger;
	private refreshTokens = new Map<string, RefreshToken>();
	private keyPair: KeyPair;
	private cleanupInterval: NodeJS.Timeout;

	// Token expiration times
	private readonly ACCESS_TOKEN_EXPIRATION = 15 * 60; // 15 minutes
	private readonly REFRESH_TOKEN_EXPIRATION = 30 * 24 * 60 * 60; // 30 days

	constructor(
		private issuer: string,
		private audience: string,
		keyPair?: KeyPair
	) {
		this.securityLogger = new SecurityLogger();

		// Use provided key pair or generate new one
		this.keyPair = keyPair || this.generateKeyPair();

		// Cleanup expired refresh tokens every hour
		this.cleanupInterval = setInterval(() => {
			this.cleanupExpiredTokens();
		}, 60 * 60 * 1000);
	}

	/**
	 * Generate JWT token pair (access + refresh tokens)
	 */
	async generateTokenPair(
		userId: string,
		clientId: string,
		scopes: string[],
		options: {
			includeRefreshToken?: boolean;
			customClaims?: Record<string, any>;
		} = {}
	): Promise<TokenPair> {
		const now = Math.floor(Date.now() / 1000);
		const scopeString = scopes.join(' ');
		const jti = uuidv4();

		// Create access token payload
		const accessTokenPayload: TokenPayload = {
			sub: userId,
			aud: this.audience,
			iss: this.issuer,
			iat: now,
			exp: now + this.ACCESS_TOKEN_EXPIRATION,
			nbf: now,
			jti,
			client_id: clientId,
			scope: scopeString,
			token_type: 'access_token',
			...options.customClaims
		};

		// Sign access token
		const accessToken = await this.signToken(accessTokenPayload);

		let refreshToken: string | undefined;

		// Generate refresh token if requested
		if (options.includeRefreshToken) {
			const refreshTokenId = uuidv4();
			const refreshTokenExpires = new Date(Date.now() + (this.REFRESH_TOKEN_EXPIRATION * 1000));

			// Store refresh token metadata
			this.refreshTokens.set(refreshTokenId, {
				tokenId: refreshTokenId,
				userId,
				clientId,
				scopes,
				createdAt: new Date(),
				expiresAt: refreshTokenExpires,
				isRevoked: false
			});

			// Create refresh token payload
			const refreshTokenPayload: TokenPayload = {
				sub: userId,
				aud: this.audience,
				iss: this.issuer,
				iat: now,
				exp: now + this.REFRESH_TOKEN_EXPIRATION,
				nbf: now,
				jti: refreshTokenId,
				client_id: clientId,
				scope: scopeString,
				token_type: 'refresh_token'
			};

			refreshToken = await this.signToken(refreshTokenPayload);
		}

		this.securityLogger.debug(`Token pair generated for user ${userId}, client ${clientId}`);

		return {
			accessToken,
			refreshToken,
			tokenType: 'Bearer',
			expiresIn: this.ACCESS_TOKEN_EXPIRATION,
			scope: scopeString,
			issuedAt: now
		};
	}

	/**
	 * Refresh access token using refresh token
	 */
	async refreshAccessToken(refreshTokenString: string, clientId: string): Promise<TokenPair | null> {
		try {
			// Verify refresh token
			const payload = await this.verifyToken(refreshTokenString);

			if (payload.token_type !== 'refresh_token') {
				this.securityLogger.warn('Invalid token type for refresh');
				return null;
			}

			// Check refresh token metadata
			const refreshTokenMeta = this.refreshTokens.get(payload.jti);
			if (!refreshTokenMeta || refreshTokenMeta.isRevoked) {
				this.securityLogger.warn(`Refresh token not found or revoked: ${payload.jti}`);
				return null;
			}

			// Validate client
			if (refreshTokenMeta.clientId !== clientId) {
				this.securityLogger.warn(`Client mismatch for refresh token: ${payload.jti}`);
				return null;
			}

			// Check expiration
			if (new Date() > refreshTokenMeta.expiresAt) {
				this.securityLogger.warn(`Refresh token expired: ${payload.jti}`);
				this.refreshTokens.delete(payload.jti);
				return null;
			}

			// Generate new access token
			const newTokenPair = await this.generateTokenPair(
				refreshTokenMeta.userId,
				refreshTokenMeta.clientId,
				refreshTokenMeta.scopes,
				{ includeRefreshToken: false }
			);

			this.securityLogger.log(`Access token refreshed for user ${refreshTokenMeta.userId}`);
			return newTokenPair;

		} catch (error: any) {
			this.securityLogger.error('Refresh token validation failed:', error as Error);
			return null;
		}
	}

	/**
	 * Revoke refresh token
	 */
	revokeToken(tokenId: string): boolean {
		const refreshToken = this.refreshTokens.get(tokenId);
		if (refreshToken) {
			refreshToken.isRevoked = true;
			this.securityLogger.log(`Refresh token revoked: ${tokenId}`);
			return true;
		}
		return false;
	}

	/**
	 * Sign JWT token
	 */
	private async signToken(payload: TokenPayload): Promise<string> {
		try {
			if (this.keyPair.algorithm === 'RS256') {
				// Use jsonwebtoken for RS256
				const privateKey = this.keyPair.privateKey;
				return jwt.sign(payload, privateKey, {
					algorithm: 'RS256',
					keyid: this.keyPair.keyId,
					header: {
						typ: 'JWT',
						alg: 'RS256',
						kid: this.keyPair.keyId
					}
				});
			} else {
				// Use jose for ES256
				const privateKey = await importPKCS8(this.keyPair.privateKey, 'ES256');
				const token = await new SignJWT(payload)
					.setProtectedHeader({
						alg: 'ES256',
						typ: 'JWT',
						kid: this.keyPair.keyId
					})
					.sign(privateKey);
				return token;
			}
		} catch (error: any) {
			this.securityLogger.error('Token signing failed:', error);
			throw new Error(`Failed to sign token: ${error.message}`);
		}
	}

	/**
	 * Verify JWT token
	 */
	private async verifyToken(token: string): Promise<TokenPayload> {
		try {
			if (this.keyPair.algorithm === 'RS256') {
				const payload = jwt.verify(token, this.keyPair.publicKey, {
					algorithms: ['RS256'],
					issuer: this.issuer,
					audience: this.audience
				}) as TokenPayload;
				return payload;
			} else {
				// ES256 verification would need jose library
				throw new Error('ES256 verification not implemented');
			}
		} catch (error: any) {
			throw new Error(`Token verification failed: ${error.message}`);
		}
	}

	/**
	 * Get public key for JWT verification (JWKS format)
	 */
	getPublicKeyJWKS(): any {
		if (this.keyPair.algorithm === 'RS256') {
			// Convert PEM to JWK format for RSA
			const publicKey = crypto.createPublicKey(this.keyPair.publicKey);
			const jwk = publicKey.export({ format: 'jwk' }) as any;

			return {
				kty: 'RSA',
				use: 'sig',
				alg: 'RS256',
				kid: this.keyPair.keyId,
				n: jwk.n,
				e: jwk.e
			};
		} else {
			// ES256 JWK conversion would be implemented here
			throw new Error('ES256 JWK conversion not implemented');
		}
	}

	/**
	 * Get JWKS (JSON Web Key Set)
	 */
	getJWKS(): { keys: any[] } {
		return {
			keys: [this.getPublicKeyJWKS()]
		};
	}

	/**
	 * Generate RSA key pair for JWT signing
	 */
	private generateKeyPair(): KeyPair {
		this.securityLogger.log('Generating new RSA key pair for JWT signing');

		const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
			modulusLength: 2048,
			publicKeyEncoding: {
				type: 'spki',
				format: 'pem'
			},
			privateKeyEncoding: {
				type: 'pkcs8',
				format: 'pem'
			}
		});

		const keyId = crypto.randomUUID();

		return {
			publicKey,
			privateKey,
			keyId,
			algorithm: 'RS256'
		};
	}

	/**
	 * Clean up expired refresh tokens
	 */
	private cleanupExpiredTokens(): void {
		const now = new Date();
		let cleanedCount = 0;

		for (const [tokenId, refreshToken] of this.refreshTokens.entries()) {
			if (now > refreshToken.expiresAt || refreshToken.isRevoked) {
				this.refreshTokens.delete(tokenId);
				cleanedCount++;
			}
		}

		if (cleanedCount > 0) {
			this.securityLogger.debug(`Cleaned up ${cleanedCount} expired refresh tokens`);
		}
	}

	/**
	 * Get token statistics
	 */
	getStats(): {
		totalRefreshTokens: number;
		activeRefreshTokens: number;
		revokedTokens: number;
		keyId: string;
		algorithm: string;
	} {
		const now = new Date();
		let activeTokens = 0;
		let revokedTokens = 0;

		for (const refreshToken of this.refreshTokens.values()) {
			if (refreshToken.isRevoked) {
				revokedTokens++;
			} else if (now <= refreshToken.expiresAt) {
				activeTokens++;
			}
		}

		return {
			totalRefreshTokens: this.refreshTokens.size,
			activeRefreshTokens: activeTokens,
			revokedTokens,
			keyId: this.keyPair.keyId,
			algorithm: this.keyPair.algorithm
		};
	}

	/**
	 * Cleanup and destroy
	 */
	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
		this.refreshTokens.clear();
	}
}
