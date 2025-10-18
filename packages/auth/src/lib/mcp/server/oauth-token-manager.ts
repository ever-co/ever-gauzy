/**
 * OAuth 2.0 JWT Token Management
 *
 * Manages JWT access tokens and refresh tokens for OAuth 2.0 flows
 */

import * as crypto from 'node:crypto';
import { SecurityLogger } from '../utils/security-logger';

// Dynamic import type for jose library
type JoseModule = typeof import('jose');

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
	private josePromise: Promise<JoseModule> | null = null;

	// Token expiration times
	private readonly ACCESS_TOKEN_EXPIRATION = 15 * 60; // 15 minutes
	private readonly REFRESH_TOKEN_EXPIRATION = 30 * 24 * 60 * 60; // 30 days
	private readonly MAX_REFRESH_TOKENS = 10000;
	private readonly CLOCK_SKEW_SECONDS = 30;

	constructor(
		private issuer: string,
		private audience: string,
		keyPair?: KeyPair
	) {
		this.securityLogger = new SecurityLogger();

		// Use provided key pair or generate new one
		this.keyPair = keyPair || this.generateKeyPair();

		this.cleanupInterval = setInterval(() => this.cleanupExpiredTokens(), 60 * 60 * 1000);
		// Do not keep process alive just for cleanup
		this.cleanupInterval.unref();
	}

	/**
	 * Dynamically import jose library to handle ESM compatibility
	 */
	private async getJose(): Promise<JoseModule> {
		if (!this.josePromise) {
			this.josePromise = import('jose');
		}
		return this.josePromise;
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
		const jti = crypto.randomUUID();

		// Create access token payload
		const reserved: (keyof TokenPayload)[] = ['sub','aud','iss','iat','exp','nbf','jti','client_id','scope','token_type'];
		const safeCustomClaims = Object.fromEntries(
			Object.entries(options.customClaims ?? {}).filter(([k]) => !reserved.includes(k as keyof TokenPayload))
		);
		const accessTokenPayload: TokenPayload = {
			sub: userId,
			aud: this.audience,
			iss: this.issuer,
			iat: now,
			exp: now + this.ACCESS_TOKEN_EXPIRATION,
			// Tolerate small clock skew
      		nbf: now - this.CLOCK_SKEW_SECONDS,
			jti,
			client_id: clientId,
			scope: scopeString,
			token_type: 'access_token',
			...safeCustomClaims
		};

		// Sign access token
		const accessToken = await this.signToken(accessTokenPayload);

		let refreshToken: string | undefined;

		// Generate refresh token if requested
		if (options.includeRefreshToken) {
			const refreshTokenId = crypto.randomUUID();
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
			const reserved: (keyof TokenPayload)[] = ['sub','aud','iss','iat','exp','nbf','jti','client_id','scope','token_type'];
			const safeCustomClaims = Object.fromEntries(
				Object.entries(options.customClaims ?? {}).filter(([k]) => !reserved.includes(k as keyof TokenPayload))
			);
			const refreshTokenPayload: TokenPayload = {
				sub: userId,
				aud: this.audience,
				iss: this.issuer,
				iat: now,
				exp: now + this.REFRESH_TOKEN_EXPIRATION,
				// Tolerate small clock skew like access tokens
				nbf: now - this.CLOCK_SKEW_SECONDS,
				jti: refreshTokenId,
				client_id: clientId,
				scope: scopeString,
				token_type: 'refresh_token',
				...safeCustomClaims
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
			const jose = await this.getJose();

			if (this.keyPair.algorithm === 'RS256') {
				// Use jose for RS256
				const privateKey = await jose.importPKCS8(this.keyPair.privateKey, 'RS256');
				const token = await new jose.SignJWT(payload)
					.setProtectedHeader({
						alg: 'RS256',
						typ: 'JWT',
						kid: this.keyPair.keyId
					})
					.sign(privateKey);
				return token;
			} else {
				// Use jose for ES256
				const privateKey = await jose.importPKCS8(this.keyPair.privateKey, 'ES256');
				const token = await new jose.SignJWT(payload)
					.setProtectedHeader({
						alg: 'ES256',
						typ: 'JWT',
						kid: this.keyPair.keyId
					})
					.sign(privateKey);
				return token;
			}
		} catch (error: any) {
			this.securityLogger.error('Token signing failed', error as Error);
			throw new Error(`Failed to sign token: ${error.message}`);
		}
	}

	/**
	 * Verify JWT token
	 */
	private async verifyToken(token: string): Promise<TokenPayload> {
		try {
			const jose = await this.getJose();

			if (this.keyPair.algorithm === 'RS256') {
				// RS256 verification using jose library
				const publicKey = await jose.importSPKI(this.keyPair.publicKey, 'RS256');
				const { payload } = await jose.jwtVerify(token, publicKey, {
					algorithms: ['RS256'],
					issuer: this.issuer,
					audience: this.audience,
					clockTolerance: 30
				});
				return payload as TokenPayload;
			} else if (this.keyPair.algorithm === 'ES256') {
				// ES256 verification using jose library
				const publicKey = await jose.importSPKI(this.keyPair.publicKey, 'ES256');
				const { payload } = await jose.jwtVerify(token, publicKey, {
					issuer: this.issuer,
					audience: this.audience,
					algorithms: ['ES256'],
					clockTolerance: 30
				});
				return payload as TokenPayload;
			} else {
				throw new Error(`Unsupported algorithm: ${this.keyPair.algorithm}`);
			}
		} catch (error: any) {
			this.securityLogger.error('Token verification failed', error as Error);
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
		} else if (this.keyPair.algorithm === 'ES256') {
			// Convert PEM to JWK format for ECDSA
			const publicKey = crypto.createPublicKey(this.keyPair.publicKey);
			const jwk = publicKey.export({ format: 'jwk' }) as any;

			return {
				kty: 'EC',
				use: 'sig',
				alg: 'ES256',
				kid: this.keyPair.keyId,
				crv: jwk.crv,
				x: jwk.x,
				y: jwk.y
			};
		} else {
			throw new Error(`Unsupported algorithm for JWK conversion: ${this.keyPair.algorithm}`);
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
	 * Get public key in PEM format for JWT validation
	 */
	getPublicKeyPEM(): string {
		return this.keyPair.publicKey;
	}

	/**
	 * Generate key pair for JWT signing (RSA or ECDSA)
	 */
	private generateKeyPair(algorithm: 'RS256' | 'ES256' = 'RS256'): KeyPair {
		const keyId = crypto.randomUUID();

		if (algorithm === 'RS256') {
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

			return {
				publicKey,
				privateKey,
				keyId,
				algorithm: 'RS256'
			};
		} else if (algorithm === 'ES256') {
			this.securityLogger.log('Generating new ECDSA P-256 key pair for JWT signing');

			const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
				namedCurve: 'prime256v1', // P-256 curve for ES256
				publicKeyEncoding: {
					type: 'spki',
					format: 'pem'
				},
				privateKeyEncoding: {
					type: 'pkcs8',
					format: 'pem'
				}
			});

			return {
				publicKey,
				privateKey,
				keyId,
				algorithm: 'ES256'
			};
		} else {
			throw new Error(`Unsupported algorithm: ${algorithm}`);
		}
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

		// Evict oldest if above cap
		while (this.refreshTokens.size > this.MAX_REFRESH_TOKENS) {
			const oldest = this.refreshTokens.keys().next().value;
			if (!oldest) break;
			this.refreshTokens.delete(oldest);
			cleanedCount++;
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
