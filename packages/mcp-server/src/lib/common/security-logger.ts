/**
 * Security logging utilities for MCP server
 *
 * These utilities are defined locally to avoid importing from @gauzy/auth,
 * which causes TypeScript compilation performance issues due to its complex
 * dependency chain in the monorepo.
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('SecurityLogger');

// Use environment variables directly
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Security event types
 */
export const SecurityEvents = {
	// Authentication events
	LOGIN_SUCCESS: 'LOGIN_SUCCESS',
	LOGIN_FAILURE: 'LOGIN_FAILURE',
	LOGOUT: 'LOGOUT',
	TOKEN_REFRESH: 'TOKEN_REFRESH',
	TOKEN_EXPIRED: 'TOKEN_EXPIRED',

	// Authorization events
	ACCESS_GRANTED: 'ACCESS_GRANTED',
	ACCESS_DENIED: 'ACCESS_DENIED',
	UNAUTHORIZED: 'UNAUTHORIZED',
	FORBIDDEN: 'FORBIDDEN',

	// Rate limiting events
	RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

	// Session events
	SESSION_CREATED: 'SESSION_CREATED',
	SESSION_DESTROYED: 'SESSION_DESTROYED',
	SESSION_EXPIRED: 'SESSION_EXPIRED',

	// Connection events
	CONNECTION_OPENED: 'CONNECTION_OPENED',
	CONNECTION_CLOSED: 'CONNECTION_CLOSED',

	// Security violation events
	INVALID_TOKEN: 'INVALID_TOKEN',
	INVALID_REQUEST: 'INVALID_REQUEST',
	SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
	CSRF_VIOLATION: 'CSRF_VIOLATION',

	// MCP-specific events
	TOOL_EXECUTED: 'TOOL_EXECUTED',
	TOOL_ERROR: 'TOOL_ERROR',
	RESOURCE_ACCESSED: 'RESOURCE_ACCESSED',

	// Additional security events (matching @gauzy/auth API)
	LARGE_REQUEST: 'LARGE_REQUEST',
	SUSPICIOUS_PAYLOAD: 'SUSPICIOUS_PAYLOAD',
	TOOL_VALIDATION_FAILED: 'TOOL_VALIDATION_FAILED',
	UNAUTHORIZED_ORIGIN: 'UNAUTHORIZED_ORIGIN',
	SUSPICIOUS_USER_AGENT: 'SUSPICIOUS_USER_AGENT'
} as const;

export type SecurityEventType = (typeof SecurityEvents)[keyof typeof SecurityEvents];

/**
 * Security log entry structure
 */
export interface SecurityLogEntry {
	event: SecurityEventType;
	timestamp: Date;
	userId?: string;
	sessionId?: string;
	ip?: string;
	userAgent?: string;
	resource?: string;
	action?: string;
	success: boolean;
	message?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Security logger for auditing and monitoring
 * Supports both singleton pattern and direct instantiation for compatibility
 */
export class SecurityLogger {
	private static instance: SecurityLogger;
	private static events: SecurityLogEntry[] = [];
	private static readonly MAX_EVENTS = 10000;
	private logs: SecurityLogEntry[] = [];
	private maxLogs = 10000;

	// Allow both private (singleton) and public (direct) instantiation
	constructor() {}

	public static getInstance(): SecurityLogger {
		if (!SecurityLogger.instance) {
			SecurityLogger.instance = new SecurityLogger();
		}
		return SecurityLogger.instance;
	}

	/**
	 * Static method to log security events (matching @gauzy/auth API)
	 */
	public static logSecurityEvent(
		event: string,
		severity: 'low' | 'medium' | 'high' | 'critical',
		details: Record<string, unknown>
	): void {
		const entry: SecurityLogEntry = {
			event: event as SecurityEventType,
			timestamp: new Date(),
			success: severity === 'low',
			message: `Security Event: ${event} (${severity})`,
			metadata: details
		};

		// Add to static events store
		this.events.push(entry);
		if (this.events.length > this.MAX_EVENTS) {
			this.events = this.events.slice(-this.MAX_EVENTS);
		}

		// Log based on severity
		const message = `Security Event: ${event} (${severity})`;
		switch (severity) {
			case 'critical':
				logger.error(message, JSON.stringify(details));
				break;
			case 'high':
				logger.warn(message, JSON.stringify(details));
				break;
			default:
				logger.log(message, JSON.stringify(details));
		}
	}

	/**
	 * Instance debug method (matching @gauzy/auth API)
	 */
	public debug(message: string, data?: Record<string, unknown>): void {
		if (!isProduction || process.env.GAUZY_MCP_DEBUG === 'true') {
			logger.debug(message, data ? JSON.stringify(data) : '');
		}
	}

	/**
	 * Instance warn method (matching @gauzy/auth API)
	 */
	public warn(message: string, data?: Record<string, unknown>): void {
		logger.warn(message, data ? JSON.stringify(data) : '');
	}

	/**
	 * Instance error method (matching @gauzy/auth API)
	 */
	public error(message: string, error?: Error | Record<string, unknown>): void {
		if (error instanceof Error) {
			logger.error(message, error.stack || error.message);
		} else if (error) {
			logger.error(message, JSON.stringify(error));
		} else {
			logger.error(message);
		}
	}

	/**
	 * Log a security event (instance method)
	 */
	public log(entry: Omit<SecurityLogEntry, 'timestamp'>): void {
		const fullEntry: SecurityLogEntry = {
			...entry,
			timestamp: new Date()
		};

		// Add to in-memory log
		this.logs.push(fullEntry);

		// Trim logs if exceeding max
		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(-this.maxLogs);
		}

		// Log to console with appropriate level
		const logMessage = `[${entry.event}] ${entry.message || ''} ${entry.userId ? `User: ${entry.userId}` : ''} ${
			entry.resource ? `Resource: ${entry.resource}` : ''
		}`.trim();

		if (entry.success) {
			logger.log(logMessage);
		} else {
			logger.warn(logMessage);
		}
	}

	/**
	 * Log successful authentication
	 */
	public logAuthSuccess(userId: string, metadata?: Record<string, unknown>): void {
		this.log({
			event: SecurityEvents.LOGIN_SUCCESS,
			userId,
			success: true,
			message: 'Authentication successful',
			metadata
		});
	}

	/**
	 * Log failed authentication
	 */
	public logAuthFailure(reason: string, metadata?: Record<string, unknown>): void {
		this.log({
			event: SecurityEvents.LOGIN_FAILURE,
			success: false,
			message: `Authentication failed: ${reason}`,
			metadata
		});
	}

	/**
	 * Log access denied
	 */
	public logAccessDenied(
		userId: string | undefined,
		resource: string,
		reason: string,
		metadata?: Record<string, unknown>
	): void {
		this.log({
			event: SecurityEvents.ACCESS_DENIED,
			userId,
			resource,
			success: false,
			message: `Access denied: ${reason}`,
			metadata
		});
	}

	/**
	 * Log rate limit exceeded
	 */
	public logRateLimitExceeded(ip: string, metadata?: Record<string, unknown>): void {
		this.log({
			event: SecurityEvents.RATE_LIMIT_EXCEEDED,
			ip,
			success: false,
			message: 'Rate limit exceeded',
			metadata
		});
	}

	/**
	 * Log tool execution
	 */
	public logToolExecution(
		toolName: string,
		userId: string | undefined,
		success: boolean,
		metadata?: Record<string, unknown>
	): void {
		this.log({
			event: success ? SecurityEvents.TOOL_EXECUTED : SecurityEvents.TOOL_ERROR,
			userId,
			resource: toolName,
			success,
			message: success ? `Tool executed: ${toolName}` : `Tool error: ${toolName}`,
			metadata
		});
	}

	/**
	 * Get recent logs
	 */
	public getRecentLogs(count = 100): SecurityLogEntry[] {
		return this.logs.slice(-count);
	}

	/**
	 * Get logs by event type
	 */
	public getLogsByEvent(event: SecurityEventType, count = 100): SecurityLogEntry[] {
		return this.logs.filter((log) => log.event === event).slice(-count);
	}

	/**
	 * Get logs by user
	 */
	public getLogsByUser(userId: string, count = 100): SecurityLogEntry[] {
		return this.logs.filter((log) => log.userId === userId).slice(-count);
	}

	/**
	 * Clear all logs
	 */
	public clearLogs(): void {
		this.logs = [];
	}
}

// Export singleton instance
export const securityLogger = SecurityLogger.getInstance();
