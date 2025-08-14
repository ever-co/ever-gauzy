import { Request, Response, NextFunction } from 'express';
import { Logger } from '@nestjs/common';
import { sessionManager, UserContext, SessionValidationResult } from './session-manager';
import { rateLimit } from 'express-rate-limit';
import crypto from 'node:crypto';

const logger = new Logger('SessionMiddleware');

// Extend Express Request interface to include session data
declare global {
	namespace Express {
		interface Request {
			sessionId?: string;
			userContext?: UserContext;
			sessionValidation?: SessionValidationResult;
			csrfToken?: string;
			connectionId?: string;
		}
	}
}

export interface SessionMiddlewareConfig {
	requireAuth: boolean;
	validateIP: boolean;
	validateUserAgent: boolean;
	enableCSRF: boolean;
	enableRateLimit: boolean;
	rateLimitOptions?: {
		windowMs: number;
		max: number;
		skipSuccessfulRequests?: boolean;
	};
	sessionHeader: string;
	csrfHeader: string;
	allowedPaths?: string[];
	excludedPaths?: string[];
	trustedProxies?: string[];
}

export interface CSRFTokenData {
	token: string;
	sessionId: string;
	created: Date;
	expiresAt: Date;
}

class SessionMiddleware {
	private csrfTokens = new Map<string, CSRFTokenData>();
	private csrfCleanupTimer: NodeJS.Timeout | null = null;
	private readonly CSRF_TOKEN_TTL = 30 * 60 * 1000; // 30 minutes
	private readonly CSRF_CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

	constructor() {
		this.startCSRFCleanup();
	}

	/**
	 * Create session validation middleware
	 */
	createSessionMiddleware(config: Partial<SessionMiddlewareConfig> = {}) {
		const finalConfig: SessionMiddlewareConfig = {
			requireAuth: true,
			validateIP: false,
			validateUserAgent: false,
			enableCSRF: false,
			enableRateLimit: false,
			sessionHeader: 'mcp-session-id',
			csrfHeader: 'mcp-csrf-token',
			trustedProxies: [],
			...config,
		};

		return async (req: Request, res: Response, next: NextFunction) => {
			try {
				// Check if path should be excluded
				if (this.shouldExcludePath(req.path, finalConfig.excludedPaths)) {
					return next();
				}

				// Check if path is in allowed paths (if specified)
				if (finalConfig.allowedPaths && !this.isPathAllowed(req.path, finalConfig.allowedPaths)) {
					return this.sendUnauthorized(res, 'Path not allowed');
				}

				// Extract session ID from header or query parameter
				const sessionId = this.extractSessionId(req, finalConfig.sessionHeader);

				if (!sessionId) {
					if (finalConfig.requireAuth) {
						return this.sendUnauthorized(res, 'Session ID required');
					}
					return next();
				}

				// Validate session
				const ipAddress = finalConfig.validateIP ? this.getClientIP(req, finalConfig.trustedProxies) : undefined;
				const userAgent = finalConfig.validateUserAgent ? req.get('User-Agent') : undefined;

				const validation = await sessionManager.validateSession(
					sessionId,
					ipAddress,
					userAgent,
					finalConfig.requireAuth
				);

				if (!validation.valid) {
					return this.sendUnauthorized(res, validation.reason || 'Invalid session');
				}

				// CSRF protection
				if (finalConfig.enableCSRF && this.requiresCSRFProtection(req)) {
					const csrfValid = this.validateCSRFToken(req, sessionId, finalConfig.csrfHeader);
					if (!csrfValid) {
						return this.sendForbidden(res, 'CSRF token invalid or missing');
					}
				}

				// Generate connection ID for this request
				req.connectionId = this.generateConnectionId('http');

				// Add connection to session
				if (validation.session) {
					sessionManager.addConnection(
						sessionId,
						req.connectionId,
						'http',
						{
							ipAddress: this.getClientIP(req, finalConfig.trustedProxies),
							userAgent: req.get('User-Agent'),
							path: req.path,
							method: req.method,
						}
					);
				}

				// Update session activity
				sessionManager.updateSessionActivity(sessionId, {
					lastPath: req.path,
					lastMethod: req.method,
					lastIP: this.getClientIP(req, finalConfig.trustedProxies),
					lastUserAgent: req.get('User-Agent'),
				});

				// Get user context
				const userContext = await sessionManager.getUserContext(sessionId, req.connectionId);

				// Attach session data to request
				req.sessionId = sessionId;
				req.sessionValidation = validation;
				req.userContext = userContext || undefined;

				// Add cleanup handler
				res.on('finish', () => {
					if (req.connectionId) {
						sessionManager.removeConnection(req.connectionId);
					}
				});

				next();
			} catch (error) {
				logger.error('Session middleware error:', error);
				this.sendInternalError(res);
			}
		};
	}

	/**
	 * Create WebSocket session middleware
	 */
	createWebSocketSessionMiddleware(config: Partial<SessionMiddlewareConfig> = {}) {
		const finalConfig: SessionMiddlewareConfig = {
			requireAuth: true,
			validateIP: false,
			validateUserAgent: false,
			enableCSRF: false,
			enableRateLimit: false,
			sessionHeader: 'mcp-session-id',
			csrfHeader: 'mcp-csrf-token',
			...config,
		};

		return async (
			sessionId: string,
			connectionId: string,
			metadata: { ipAddress?: string; userAgent?: string; origin?: string } = {}
		): Promise<{ valid: boolean; userContext?: UserContext; reason?: string }> => {
			try {
				// Validate session
				const validation = await sessionManager.validateSession(
					sessionId,
					finalConfig.validateIP ? metadata.ipAddress : undefined,
					finalConfig.validateUserAgent ? metadata.userAgent : undefined,
					finalConfig.requireAuth
				);

				if (!validation.valid) {
					return { valid: false, reason: validation.reason || 'Invalid session' };
				}

				// Add connection to session
				if (validation.session) {
					const success = sessionManager.addConnection(
						sessionId,
						connectionId,
						'websocket',
						{
							ipAddress: metadata.ipAddress,
							userAgent: metadata.userAgent,
							origin: metadata.origin,
							connectedAt: new Date().toISOString(),
						}
					);

					if (!success) {
						return { valid: false, reason: 'Failed to add connection to session' };
					}
				}

				// Update session activity
				sessionManager.updateSessionActivity(sessionId, {
					lastConnectionType: 'websocket',
					lastIP: metadata.ipAddress,
					lastUserAgent: metadata.userAgent,
					lastOrigin: metadata.origin,
				});

				// Get user context
				const userContext = await sessionManager.getUserContext(sessionId, connectionId);

				return {
					valid: true,
					userContext: userContext || undefined,
				};
			} catch (error) {
				logger.error('WebSocket session middleware error:', error);
				return { valid: false, reason: 'Internal session validation error' };
			}
		};
	}

	/**
	 * Create rate limiting middleware
	 */
	createRateLimitMiddleware(config: {
		windowMs?: number;
		max?: number;
		skipSuccessfulRequests?: boolean;
		keyGenerator?: (req: Request) => string;
		trustedProxies?: string[];
	} = {}) {
		const finalConfig = {
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 100, // Limit each session to 100 requests per windowMs
			skipSuccessfulRequests: false,
			trustedProxies: [],
			...config,
		};

		return rateLimit({
			...finalConfig,
			keyGenerator: (req: Request) => {
				// Use session ID if available, otherwise fall back to IP
				return req.sessionId || this.getClientIP(req, finalConfig.trustedProxies);
			},
			handler: (req: Request, res: Response) => {
				logger.warn(`Rate limit exceeded for session: ${req.sessionId || 'unknown'} from IP: ${this.getClientIP(req, finalConfig.trustedProxies)}`);
				res.status(429).json({
					error: 'Too Many Requests',
					message: 'Rate limit exceeded. Please try again later.',
					retryAfter: Math.round(finalConfig.windowMs / 1000),
				});
			},
			standardHeaders: true,
			legacyHeaders: false,
		});
	}

	/**
	 * Generate CSRF token for session
	 */
	generateCSRFToken(sessionId: string): string {
		const token = crypto.randomBytes(32).toString('hex');
		const now = new Date();
		const expiresAt = new Date(now.getTime() + this.CSRF_TOKEN_TTL);

		this.csrfTokens.set(token, {
			token,
			sessionId,
			created: now,
			expiresAt,
		});

		return token;
	}

	/**
	 * Validate CSRF token
	 */
	validateCSRFToken(req: Request, sessionId: string, csrfHeader: string): boolean {
		const token = req.get(csrfHeader) || req.body?.csrfToken || req.query?.csrfToken;

		if (!token) {
			return false;
		}

		const tokenData = this.csrfTokens.get(token);

		if (!tokenData) {
			return false;
		}

		// Check if token is expired
		if (new Date() > tokenData.expiresAt) {
			this.csrfTokens.delete(token);
			return false;
		}

		// Check if token belongs to the session
		// Use constant-time comparison to prevent timing attacks
		const a = Buffer.from(tokenData.sessionId);
    	const b = Buffer.from(sessionId);
    	if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
			return false;
		}

		// Update CSRF token in request for downstream use
		req.csrfToken = token;

		return true;
	}

	/**
	 * Create authorization middleware
	 */
	createAuthorizationMiddleware(requiredPermissions: string[] = []) {
		return async (req: Request, res: Response, next: NextFunction) => {
			try {
				if (!req.sessionId) {
					return this.sendUnauthorized(res, 'Session required for authorization');
				}

				const { authorized, reason } = await sessionManager.checkUserAuthorization(
					req.sessionId,
					requiredPermissions,
					req.body?.organizationId || req.query?.organizationId,
					req.body?.tenantId || req.query?.tenantId
				);

				if (!authorized) {
					return this.sendForbidden(res, reason || 'Authorization failed');
				}

				next();
			} catch (error) {
				logger.error('Authorization middleware error:', error);
				this.sendInternalError(res);
			}
		};
	}

	/**
	 * Shutdown middleware
	 */
	shutdown(): void {
		if (this.csrfCleanupTimer) {
			clearInterval(this.csrfCleanupTimer);
			this.csrfCleanupTimer = null;
		}

		this.csrfTokens.clear();
		logger.log('SessionMiddleware shutdown completed');
	}

	private extractSessionId(req: Request, headerName: string): string | null {
		// Try header first
		let sessionId = req.get(headerName);

		// Try query parameter
		if (!sessionId) {
			sessionId = req.query.sessionId as string;
		}

		// Try cookies
		if (!sessionId && req.cookies) {
			sessionId = req.cookies['mcp-session-id'] || req.cookies['session-id'];
		}

		return sessionId || null;
	}

	private getClientIP(req: Request, trustedProxies: string[] = []): string {
		// If no trusted proxies configured, use socket address
		if (trustedProxies.length === 0) {
			return req.socket.remoteAddress || 'unknown';
		}

		// Only trust headers if request comes from a trusted proxy
		const remoteAddress = req.socket.remoteAddress || '';
		if (!trustedProxies.includes(remoteAddress)) {
			return remoteAddress;
		}

		const forwarded = req.get('X-Forwarded-For');
		const realIP = req.get('X-Real-IP');

		if (forwarded) {
			return forwarded.split(',')[0].trim();
		}

		if (realIP) {
			return realIP.trim();
		}

		return req.socket.remoteAddress || 'unknown';
	}

	private shouldExcludePath(path: string, excludedPaths?: string[]): boolean {
		if (!excludedPaths) return false;

		return excludedPaths.some(excludedPath => {
			if (excludedPath.includes('*')) {
				// Simple glob pattern matching
				// Escape special regex characters except *
				// Use a safe glob matcher instead of dynamic RegExp
            	return require('minimatch')(path, excludedPath, { nocase: false, dot: true });
			}
			return path === excludedPath;
		});
	}

	private isPathAllowed(path: string, allowedPaths: string[]): boolean {
		return allowedPaths.some(allowedPath => {
			if (allowedPath.includes('*')) {
				// Simple glob pattern matching
				// Escape special regex characters except *
				const escaped = allowedPath
					.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
					.replace(/\*/g, '.*');
				// Limit pattern complexity to prevent ReDoS
				if (escaped.length > 100 || (escaped.match(/\.\*/g) || []).length > 5) {
					logger.warn(`Skipping complex path pattern: ${allowedPath}`);
					return false;
				}
				const regex = new RegExp(`^${escaped}$`);
				return regex.test(path);
			}
			return path === allowedPath || path.startsWith(allowedPath);
		});
	}

	private requiresCSRFProtection(req: Request): boolean {
		// CSRF protection for state-changing methods
		return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
	}

	private generateConnectionId(prefix: string): string {
		const timestamp = Date.now().toString(36);
		const randomBytes = crypto.randomBytes(8).toString('hex');
		return `${prefix}_${timestamp}_${randomBytes}`;
	}

	private sendUnauthorized(res: Response, message: string): void {
		res.status(401).json({
			error: 'Unauthorized',
			message,
			code: 'SESSION_UNAUTHORIZED',
		});
	}

	private sendForbidden(res: Response, message: string): void {
		res.status(403).json({
			error: 'Forbidden',
			message,
			code: 'SESSION_FORBIDDEN',
		});
	}

	private sendInternalError(res: Response): void {
		res.status(500).json({
			error: 'Internal Server Error',
			message: 'An internal error occurred during session validation',
			code: 'SESSION_INTERNAL_ERROR',
		});
	}

	private startCSRFCleanup(): void {
		this.csrfCleanupTimer = setInterval(() => {
			this.cleanupExpiredCSRFTokens();
		}, this.CSRF_CLEANUP_INTERVAL);

		// Prevent cleanup timer from keeping the process alive
		this.csrfCleanupTimer.unref?.();
	}

	private cleanupExpiredCSRFTokens(): void {
		const now = new Date();
		let cleanedCount = 0;

		for (const [token, tokenData] of this.csrfTokens) {
			if (now > tokenData.expiresAt) {
				this.csrfTokens.delete(token);
				cleanedCount++;
			}
		}

		if (cleanedCount > 0) {
			logger.debug(`Cleaned up ${cleanedCount} expired CSRF tokens`);
		}
	}
}

// Export singleton instance
export const sessionMiddleware = new SessionMiddleware();
