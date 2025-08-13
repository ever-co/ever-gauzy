import { Logger } from '@nestjs/common';
import crypto from 'node:crypto';

const logger = new Logger('SessionStore');

export interface SessionData {
	id: string;
	userId: string;
	userEmail?: string;
	organizationId?: string;
	tenantId?: string;
	created: Date;
	lastAccessed: Date;
	lastActivity: Date;
	expiresAt: Date;
	metadata: Record<string, any>;
	permissions?: string[];
	connectionIds: Set<string>;
	isActive: boolean;
	ipAddress?: string;
	userAgent?: string;
	loginSource: 'api' | 'websocket' | 'http';
}

export interface ConnectionData {
	id: string;
	sessionId: string;
	type: 'http' | 'websocket';
	created: Date;
	lastSeen: Date;
	isActive: boolean;
	metadata: Record<string, any>;
}

export interface SessionStoreStats {
	totalSessions: number;
	activeSessions: number;
	expiredSessions: number;
	totalConnections: number;
	activeConnections: number;
	userSessions: Map<string, number>;
	sessionsByType: Record<string, number>;
	connectionsByType: Record<string, number>;
	memoryUsage: {
		sessions: number;
		connections: number;
		total: number;
	};
}

export interface SessionStoreConfig {
	defaultTTL: number;
	cleanupInterval: number;
	maxSessionsPerUser: number;
	maxConnectionsPerSession: number;
	enableMetrics: boolean;
	enableLogging: boolean;
	securityOptions: {
		enforceIPBinding: boolean;
		enforceUserAgentBinding: boolean;
		allowConcurrentSessions: boolean;
		sessionRotation: boolean;
		sessionRotationThreshold: number;
	};
}

export class SessionStore {
	private sessions = new Map<string, SessionData>();
	private connections = new Map<string, ConnectionData>();
	private userSessions = new Map<string, Set<string>>();
	private cleanupTimer: NodeJS.Timeout | null = null;
	private config: SessionStoreConfig;
	private metrics = {
		sessionsCreated: 0,
		sessionsDestroyed: 0,
		connectionsCreated: 0,
		connectionsDestroyed: 0,
		cleanupRuns: 0,
		lastCleanup: new Date(),
	};

	constructor(config?: Partial<SessionStoreConfig>) {
		this.config = {
			defaultTTL: 30 * 60 * 1000, // 30 minutes
			cleanupInterval: 5 * 60 * 1000, // 5 minutes
			maxSessionsPerUser: 5,
			maxConnectionsPerSession: 10,
			enableMetrics: true,
			enableLogging: true,
			securityOptions: {
				enforceIPBinding: false,
				enforceUserAgentBinding: false,
				allowConcurrentSessions: true,
				sessionRotation: false,
				sessionRotationThreshold: 24 * 60 * 60 * 1000, // 24 hours
			},
			...config,
		};

		this.startCleanupTimer();

		if (this.config.enableLogging) {
			logger.log(`SessionStore initialized with TTL: ${this.config.defaultTTL}ms`);
		}
	}

	/**
	 * Create a new session for a user
	 */
	createSession(
		userId: string,
		userEmail?: string,
		organizationId?: string,
		tenantId?: string,
		metadata: Record<string, any> = {},
		ttl?: number,
		ipAddress?: string,
		userAgent?: string,
		loginSource: 'api' | 'websocket' | 'http' = 'api'
	): SessionData {
		const sessionId = this.generateSecureId('session');
		const now = new Date();
		const expiresAt = new Date(now.getTime() + (ttl || this.config.defaultTTL));

		// Check if user has reached session limit
		if (!this.config.securityOptions.allowConcurrentSessions) {
			this.invalidateUserSessions(userId);
		} else {
			this.enforceUserSessionLimit(userId);
		}

		const session: SessionData = {
			id: sessionId,
			userId,
			userEmail,
			organizationId,
			tenantId,
			created: now,
			lastAccessed: now,
			lastActivity: now,
			expiresAt,
			metadata: { ...metadata },
			connectionIds: new Set(),
			isActive: true,
			ipAddress,
			userAgent,
			loginSource,
		};

		this.sessions.set(sessionId, session);

		// Track user sessions
		if (!this.userSessions.has(userId)) {
			this.userSessions.set(userId, new Set());
		}
		this.userSessions.get(userId)!.add(sessionId);

		this.metrics.sessionsCreated++;

		if (this.config.enableLogging) {
			logger.log(`Session created: ${sessionId} for user ${userId} (${userEmail || 'unknown'})`);
		}

		return session;
	}

	/**
	 * Get session by ID
	 */
	getSession(sessionId: string): SessionData | null {
		const session = this.sessions.get(sessionId);

		if (!session) {
			return null;
		}

		// Check if session is expired
		if (this.isSessionExpired(session)) {
			this.destroySession(sessionId);
			return null;
		}

		// Update last accessed time
		session.lastAccessed = new Date();
		return session;
	}

	/**
	 * Update session activity
	 */
	updateSessionActivity(sessionId: string, metadata?: Record<string, any>): boolean {
		const session = this.sessions.get(sessionId);

		if (!session || this.isSessionExpired(session)) {
			return false;
		}

		session.lastActivity = new Date();
		session.lastAccessed = new Date();

		if (metadata) {
			session.metadata = { ...session.metadata, ...metadata };
		}

		return true;
	}

	/**
	 * Extend session TTL
	 */
	extendSession(sessionId: string, additionalTime: number): boolean {
		const session = this.sessions.get(sessionId);

		if (!session || this.isSessionExpired(session)) {
			return false;
		}

		session.expiresAt = new Date(session.expiresAt.getTime() + additionalTime);
		session.lastAccessed = new Date();

		if (this.config.enableLogging) {
			logger.debug(`Session extended: ${sessionId} by ${additionalTime}ms`);
		}

		return true;
	}

	/**
	 * Validate session with security checks
	 */
	validateSession(
		sessionId: string,
		ipAddress?: string,
		userAgent?: string
	): { valid: boolean; session?: SessionData; reason?: string } {
		const session = this.sessions.get(sessionId);

		if (!session) {
			return { valid: false, reason: 'Session not found' };
		}

		if (this.isSessionExpired(session)) {
			this.destroySession(sessionId);
			return { valid: false, reason: 'Session expired' };
		}

		if (!session.isActive) {
			return { valid: false, reason: 'Session inactive' };
		}

		// Security validations
		if (this.config.securityOptions.enforceIPBinding && session.ipAddress && ipAddress !== session.ipAddress) {
			return { valid: false, reason: 'IP address mismatch' };
		}

		if (this.config.securityOptions.enforceUserAgentBinding && session.userAgent && userAgent !== session.userAgent) {
			return { valid: false, reason: 'User agent mismatch' };
		}

		// Check for session rotation requirement
		if (this.config.securityOptions.sessionRotation) {
			const sessionAge = Date.now() - session.created.getTime();
			if (sessionAge > this.config.securityOptions.sessionRotationThreshold) {
				// Mark session for rotation but allow current request
				session.metadata._rotationRequired = true;
				return { valid: true, session, reason: 'Session rotation recommended' };
			}
		}

		// Update activity
		session.lastAccessed = new Date();
		return { valid: true, session };
	}

	/**
	 * Add connection to session
	 */
	addConnection(
		sessionId: string,
		connectionId: string,
		type: 'http' | 'websocket',
		metadata: Record<string, any> = {}
	): boolean {
		const session = this.sessions.get(sessionId);

		if (!session || this.isSessionExpired(session)) {
			return false;
		}

		// Check connection limit per session
		if (session.connectionIds.size >= this.config.maxConnectionsPerSession) {
			if (this.config.enableLogging) {
				logger.warn(`Connection limit reached for session ${sessionId}`);
			}
			return false;
		}

		const connection: ConnectionData = {
			id: connectionId,
			sessionId,
			type,
			created: new Date(),
			lastSeen: new Date(),
			isActive: true,
			metadata: { ...metadata },
		};

		this.connections.set(connectionId, connection);
		session.connectionIds.add(connectionId);
		session.lastActivity = new Date();

		this.metrics.connectionsCreated++;

		if (this.config.enableLogging) {
			logger.debug(`Connection added: ${connectionId} to session ${sessionId}`);
		}

		return true;
	}

	/**
	 * Remove connection from session
	 */
	removeConnection(connectionId: string): boolean {
		const connection = this.connections.get(connectionId);

		if (!connection) {
			return false;
		}

		const session = this.sessions.get(connection.sessionId);
		if (session) {
			session.connectionIds.delete(connectionId);
		}

		this.connections.delete(connectionId);
		this.metrics.connectionsDestroyed++;

		if (this.config.enableLogging) {
			logger.debug(`Connection removed: ${connectionId} from session ${connection.sessionId}`);
		}

		return true;
	}

	/**
	 * Get connection data
	 */
	getConnection(connectionId: string): ConnectionData | null {
		const connection = this.connections.get(connectionId);

		if (!connection) {
			return null;
		}

		connection.lastSeen = new Date();
		return connection;
	}

	/**
	 * Get all sessions for a user
	 */
	getUserSessions(userId: string): SessionData[] {
		const sessionIds = this.userSessions.get(userId);
		if (!sessionIds) {
			return [];
		}

		const sessions: SessionData[] = [];
		for (const sessionId of sessionIds) {
			const session = this.getSession(sessionId);
			if (session) {
				sessions.push(session);
			}
		}

		return sessions;
	}

	/**
	 * Get all active connections for a session
	 */
	getSessionConnections(sessionId: string): ConnectionData[] {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return [];
		}

		const connections: ConnectionData[] = [];
		for (const connectionId of session.connectionIds) {
			const connection = this.connections.get(connectionId);
			if (connection && connection.isActive) {
				connections.push(connection);
			}
		}

		return connections;
	}

	/**
	 * Destroy a session and all its connections
	 */
	destroySession(sessionId: string): boolean {
		const session = this.sessions.get(sessionId);

		if (!session) {
			return false;
		}

		// Remove all connections
		for (const connectionId of session.connectionIds) {
			this.connections.delete(connectionId);
			this.metrics.connectionsDestroyed++;
		}

		// Remove from user sessions
		const userSessionIds = this.userSessions.get(session.userId);
		if (userSessionIds) {
			userSessionIds.delete(sessionId);
			if (userSessionIds.size === 0) {
				this.userSessions.delete(session.userId);
			}
		}

		this.sessions.delete(sessionId);
		this.metrics.sessionsDestroyed++;

		if (this.config.enableLogging) {
			logger.log(`Session destroyed: ${sessionId} for user ${session.userId}`);
		}

		return true;
	}

	/**
	 * Invalidate all sessions for a user
	 */
	invalidateUserSessions(userId: string): number {
		const sessionIds = this.userSessions.get(userId);
		if (!sessionIds) {
			return 0;
		}

		let destroyedCount = 0;
		for (const sessionId of Array.from(sessionIds)) {
			if (this.destroySession(sessionId)) {
				destroyedCount++;
			}
		}

		if (this.config.enableLogging) {
			logger.log(`Invalidated ${destroyedCount} sessions for user ${userId}`);
		}

		return destroyedCount;
	}

	/**
	 * Clean up expired sessions and connections
	 */
	cleanup(): { sessionsRemoved: number; connectionsRemoved: number } {
		let sessionsRemoved = 0;
		let connectionsRemoved = 0;

		// Clean up expired sessions
		for (const [sessionId, session] of this.sessions) {
			if (this.isSessionExpired(session)) {
				this.destroySession(sessionId);
				sessionsRemoved++;
			}
		}

		// Clean up orphaned connections
		for (const [connectionId, connection] of this.connections) {
			if (!this.sessions.has(connection.sessionId)) {
				this.connections.delete(connectionId);
				connectionsRemoved++;
				this.metrics.connectionsDestroyed++;
			}
		}

		this.metrics.cleanupRuns++;
		this.metrics.lastCleanup = new Date();

		if (this.config.enableLogging && (sessionsRemoved > 0 || connectionsRemoved > 0)) {
			logger.debug(`Cleanup completed: ${sessionsRemoved} sessions, ${connectionsRemoved} connections removed`);
		}

		return { sessionsRemoved, connectionsRemoved };
	}

	/**
	 * Get comprehensive statistics
	 */
	getStats(): SessionStoreStats {
		const now = new Date();
		let activeSessions = 0;
		let expiredSessions = 0;
		const sessionsByType: Record<string, number> = {};

		for (const session of this.sessions.values()) {
			if (this.isSessionExpired(session)) {
				expiredSessions++;
			} else {
				activeSessions++;
			}

			sessionsByType[session.loginSource] = (sessionsByType[session.loginSource] || 0) + 1;
		}

		let activeConnections = 0;
		const connectionsByType: Record<string, number> = {};

		for (const connection of this.connections.values()) {
			if (connection.isActive) {
				activeConnections++;
			}
			connectionsByType[connection.type] = (connectionsByType[connection.type] || 0) + 1;
		}

		// Calculate memory usage (simplified estimation for monitoring purposes)
		// Note: These are rough estimates. Actual memory usage varies based on metadata and connection counts
		const AVG_SESSION_SIZE = 500; // Base estimate in bytes
		const AVG_CONNECTION_SIZE = 200; // Base estimate in bytes
		const sessionMemory = this.sessions.size * AVG_SESSION_SIZE;
		const connectionMemory = this.connections.size * AVG_CONNECTION_SIZE;

		return {
			totalSessions: this.sessions.size,
			activeSessions,
			expiredSessions,
			totalConnections: this.connections.size,
			activeConnections,
			userSessions: new Map(Array.from(this.userSessions.entries()).map(([userId, sessionIds]) => [userId, sessionIds.size])),
			sessionsByType,
			connectionsByType,
			memoryUsage: {
				sessions: sessionMemory,
				connections: connectionMemory,
				total: sessionMemory + connectionMemory,
			},
		};
	}

	/**
	 * Get metrics
	 */
	getMetrics() {
		return {
			...this.metrics,
			currentStats: this.getStats(),
		};
	}

	/**
	 * Shutdown the session store
	 */
	shutdown(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}

		if (this.config.enableLogging) {
			logger.log('SessionStore shutdown completed');
		}
	}

	private isSessionExpired(session: SessionData): boolean {
		return new Date() > session.expiresAt;
	}

	private enforceUserSessionLimit(userId: string): void {
		const sessionIds = this.userSessions.get(userId);
		if (!sessionIds || sessionIds.size < this.config.maxSessionsPerUser) {
			return;
		}

		// Get sessions sorted by last accessed time (oldest first)
		const sessions = Array.from(sessionIds)
			.map(id => this.sessions.get(id))
			.filter(Boolean) as SessionData[];

		sessions.sort((a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

		// Remove oldest sessions to make room for new one
		const sessionsToRemove = sessions.length - this.config.maxSessionsPerUser + 1;
		for (let i = 0; i < sessionsToRemove; i++) {
			this.destroySession(sessions[i].id);
		}
	}

	private startCleanupTimer(): void {
		this.cleanupTimer = setInterval(() => {
			this.cleanup();
		}, this.config.cleanupInterval);

		// Prevent cleanup timer from keeping the process alive
		this.cleanupTimer.unref?.();
	}

	private generateSecureId(prefix: string): string {
		const timestamp = Date.now().toString(36);
		const randomBytes = crypto.randomBytes(16).toString('hex');
		return `${prefix}_${timestamp}_${randomBytes}`;
	}
}
