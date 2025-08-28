import { Logger } from '@nestjs/common';
import { SessionStore, SessionData, ConnectionData, SessionStoreConfig } from './session-store';
import { authManager } from '../common/auth-manager';

const logger = new Logger('SessionManager');

export interface SessionCreateOptions {
	userId?: string;
	userEmail?: string;
	organizationId?: string;
	tenantId?: string;
	metadata?: Record<string, any>;
	ttl?: number;
	ipAddress?: string;
	userAgent?: string;
	loginSource?: 'api' | 'websocket' | 'http';
	autoAuthenticate?: boolean;
}

export interface SessionValidationResult {
	valid: boolean;
	session?: SessionData;
	user?: {
		id: string;
		email?: string;
		organizationId?: string;
		tenantId?: string;
		permissions?: string[];
	};
	reason?: string;
}

export interface UserContext {
	userId: string;
	userEmail?: string;
	organizationId?: string;
	tenantId?: string;
	sessionId: string;
	connectionId?: string;
	permissions?: string[];
	metadata: Record<string, any>;
}

export class SessionManager {
	private static instance: SessionManager;
	private sessionStore: SessionStore;
	private _isInitialized = false;

	private constructor(config?: Partial<SessionStoreConfig>) {
		this.sessionStore = new SessionStore(config);
	}

	public static getInstance(config?: Partial<SessionStoreConfig>): SessionManager {
		if (!SessionManager.instance) {
			SessionManager.instance = new SessionManager(config);
		}
		return SessionManager.instance;
	}

	/**
	 * Initialize the session manager
	 */
	public async initialize(): Promise<void> {
		if (this._isInitialized) {
			return;
		}

		// Initialize auth manager if not already done
		await authManager.initialize();

		this._isInitialized = true;
		logger.log('SessionManager initialized successfully');
	}

	/**
	 * Check if the session manager has been initialized
	 */
	public isInitialized(): boolean {
		return this._isInitialized;
	}

	/**
	 * Create a new session with optional authentication
	 */
	public async createSession(options: SessionCreateOptions = {}): Promise<SessionData> {
		const {
			userId,
			userEmail,
			organizationId,
			tenantId,
			metadata = {},
			ttl,
			ipAddress,
			userAgent,
			loginSource = 'api',
			autoAuthenticate = false
		} = options;

		let finalUserId = userId;
		let finalUserEmail = userEmail;
		let finalOrganizationId = organizationId;
		let finalTenantId = tenantId;

		// If auto-authenticate is enabled and no user info provided, use auth manager
		if (autoAuthenticate && !finalUserId) {
			if (authManager.isAuthenticated()) {
				finalUserId = authManager.getUserId() || undefined;
				finalOrganizationId = authManager.getOrganizationId() || undefined;
				finalTenantId = authManager.getTenantId() || undefined;
			} else {
				try {
					// Attempt to authenticate
					const loginSuccessful = await authManager.ensureValidToken();
					if (loginSuccessful) {
						finalUserId = authManager.getUserId() || undefined;
						finalOrganizationId = authManager.getOrganizationId() || undefined;
						finalTenantId = authManager.getTenantId() || undefined;
					}
				} catch (error) {
					logger.warn('Auto-authentication failed:', error);
					// Continue without authentication rather than failing the session creation
				}
			}
		}

		if (!finalUserId) {
			throw new Error('User ID is required to create a session');
		}

		// Add authentication context to metadata
		const enrichedMetadata = {
			...metadata,
			hasAuthToken: authManager.isAuthenticated(),
			authTokenExpiry: authManager.getAuthStatus().tokenExpiresAt,
			createdBy: 'SessionManager',
			sessionVersion: '1.0',
		};

		return this.sessionStore.createSession(
			finalUserId,
			finalUserEmail,
			finalOrganizationId,
			finalTenantId,
			enrichedMetadata,
			ttl,
			ipAddress,
			userAgent,
			loginSource
		);
	}

	/**
	 * Validate session with comprehensive security checks
	 */
	public async validateSession(
		sessionId: string,
		ipAddress?: string,
		userAgent?: string,
		requireActiveAuth = true
	): Promise<SessionValidationResult> {
		const validation = this.sessionStore.validateSession(sessionId, ipAddress, userAgent);

		if (!validation.valid || !validation.session) {
			return validation;
		}

		const session = validation.session;

		// Check if authentication is still valid if required
		if (requireActiveAuth) {
			const isAuthValid = await this.validateAuthentication(session);
			if (!isAuthValid) {
				try {
					// Try to refresh token if possible
					const refreshed = await authManager.ensureValidToken();
					if (!refreshed) {
						return {
							valid: false,
							reason: 'Authentication expired and refresh failed',
						};
					}
				} catch (error) {
					logger.error('Token refresh error during session validation:', error);
					return {
						valid: false,
						reason: 'Authentication validation error',
					};
				}
			}
		}

		// Build user context
		const user = {
			id: session.userId,
			email: session.userEmail,
			organizationId: session.organizationId,
			tenantId: session.tenantId,
			permissions: session.permissions,
		};

		return {
			valid: true,
			session,
			user,
		};
	}

	/**
	 * Get user context for a session
	 */
	public async getUserContext(sessionId: string, connectionId?: string): Promise<UserContext | null> {
		const session = this.sessionStore.getSession(sessionId);
		if (!session) {
			return null;
		}

		return {
			userId: session.userId,
			userEmail: session.userEmail,
			organizationId: session.organizationId,
			tenantId: session.tenantId,
			sessionId: session.id,
			connectionId,
			permissions: session.permissions,
			metadata: session.metadata,
		};
	}

	/**
	 * Add connection to session
	 */
	public addConnection(
		sessionId: string,
		connectionId: string,
		type: 'http' | 'websocket',
		metadata: Record<string, any> = {}
	): boolean {
		const enrichedMetadata = {
			...metadata,
			addedAt: new Date().toISOString(),
			version: '1.0',
		};

		const success = this.sessionStore.addConnection(sessionId, connectionId, type, enrichedMetadata);

		if (success) {
			logger.debug(`Connection ${connectionId} (${type}) added to session ${sessionId}`);
		}

		return success;
	}

	/**
	 * Remove connection from session
	 */
	public removeConnection(connectionId: string): boolean {
		const success = this.sessionStore.removeConnection(connectionId);

		if (success) {
			logger.debug(`Connection ${connectionId} removed`);
		}

		return success;
	}

	/**
	 * Update session activity and metadata
	 */
	public updateSessionActivity(
		sessionId: string,
		metadata?: Record<string, any>,
		extendTTL?: number
	): boolean {
		const updated = this.sessionStore.updateSessionActivity(sessionId, metadata);

		if (updated && extendTTL) {
			this.sessionStore.extendSession(sessionId, extendTTL);
		}

		return updated;
	}

	/**
	 * Destroy session and all its connections
	 */
	public destroySession(sessionId: string): boolean {
		return this.sessionStore.destroySession(sessionId);
	}

	/**
	 * Invalidate all sessions for a user (useful for logout)
	 */
	public invalidateUserSessions(userId: string): number {
		return this.sessionStore.invalidateUserSessions(userId);
	}

	/**
	 * Get session by ID
	 */
	public getSession(sessionId: string): SessionData | null {
		return this.sessionStore.getSession(sessionId);
	}

	/**
	 * Get all active sessions for a user
	 */
	public getUserSessions(userId: string): SessionData[] {
		return this.sessionStore.getUserSessions(userId);
	}

	/**
	 * Get connection information
	 */
	public getConnection(connectionId: string): ConnectionData | null {
		return this.sessionStore.getConnection(connectionId);
	}

	/**
	 * Get session connections
	 */
	public getSessionConnections(sessionId: string): ConnectionData[] {
		return this.sessionStore.getSessionConnections(sessionId);
	}

	/**
	 * Cleanup expired sessions
	 */
	public cleanup(): { sessionsRemoved: number; connectionsRemoved: number } {
		return this.sessionStore.cleanup();
	}

	/**
	 * Get session statistics
	 */
	public getStats() {
		return this.sessionStore.getStats();
	}

	/**
	 * Get session metrics
	 */
	public getMetrics() {
		return this.sessionStore.getMetrics();
	}

	/**
	 * Check if a user is authorized for specific actions
	 */
	public async checkUserAuthorization(
		sessionId: string,
		requiredPermissions: string[] = [],
		organizationId?: string,
		tenantId?: string
	): Promise<{ authorized: boolean; reason?: string }> {
		const session = this.sessionStore.getSession(sessionId);

		if (!session) {
			return { authorized: false, reason: 'Session not found' };
		}

		// Check organization isolation
		if (organizationId && session.organizationId !== organizationId) {
			return { authorized: false, reason: 'Organization access denied' };
		}

		// Check tenant isolation
		if (tenantId && session.tenantId !== tenantId) {
			return { authorized: false, reason: 'Tenant access denied' };
		}

		// Check permissions if specified
		if (requiredPermissions.length > 0 && session.permissions) {
			const sessionPermSet = new Set(session.permissions);
			const hasPermissions = requiredPermissions.every(permission =>
				sessionPermSet.has(permission)
			);
			if (!hasPermissions) {
				return {
					authorized: false,
					reason: `Missing required permissions: ${requiredPermissions.join(', ')}`
				};
			}
		}

		return { authorized: true };
	}

	/**
	 * Create session from authenticated user
	 */
	public async createSessionFromAuth(
		options: Omit<SessionCreateOptions, 'autoAuthenticate'> = {}
	): Promise<SessionData> {
		if (!authManager.isAuthenticated()) {
			throw new Error('User must be authenticated to create session');
		}

		return this.createSession({
			...options,
			userId: authManager.getUserId() || undefined,
			organizationId: authManager.getOrganizationId() || undefined,
			tenantId: authManager.getTenantId() || undefined,
			autoAuthenticate: false, // Already authenticated
		});
	}

	/**
	 * Shutdown the session manager
	 */
	public shutdown(): void {
		this.sessionStore.shutdown();
		this._isInitialized = false;
		logger.log('SessionManager shutdown completed');
	}

	/**
	 * Check if current authentication is valid for session
	 */
	private async validateAuthentication(session: SessionData): Promise<boolean> {
		if (!authManager.isAuthenticated()) {
			return false;
		}

		const authUserId = authManager.getUserId();
		const authOrgId = authManager.getOrganizationId();
		const authTenantId = authManager.getTenantId();

		// Validate user ID match
		if (session.userId !== authUserId) {
			return false;
		}

		// Validate organization match if both are available
		if (session.organizationId && authOrgId && session.organizationId !== authOrgId) {
			return false;
		}

		// Validate tenant match if both are available
		if (session.tenantId && authTenantId && session.tenantId !== authTenantId) {
			return false;
		}

		return true;
	}
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();
