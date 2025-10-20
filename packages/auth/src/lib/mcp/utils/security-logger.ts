import { Logger } from '@nestjs/common';
import { Request } from 'express';
import { sanitizeForLogging } from './security-utils';
import { inspect } from 'node:util';

// Use environment variables directly
const isProduction = process.env.NODE_ENV === 'production';

const logger = new Logger('SecurityLogger');

export interface SecurityEvent {
	event: string;
	severity: 'low' | 'medium' | 'high' | 'critical';
	ip: string;
	userAgent?: string;
	sessionId?: string;
	userId?: string;
	details: Record<string, unknown>;
	timestamp: Date;
}

export class SecurityLogger {
	private static events: SecurityEvent[] = [];
	private static readonly MAX_EVENTS = 1000;

	static logSecurityEvent(
		event: string,
		severity: SecurityEvent['severity'],
		details: Record<string, unknown>,
		req?: Request
	): void {
		const securityEvent: SecurityEvent = {
			event,
			severity,
			ip: req?.ip || 'unknown',
			userAgent: req?.get('User-Agent'),
			sessionId:
				((req as any)?.sessionID as string) ||
				((req as any)?.session?.id as string) ||
				((req as any)?.headers?.['x-session-id'] as string) ||
				undefined,
			userId:
				((req as any)?.user?.id as string) ||
				((req as any)?.userContext?.userId as string) ||
				undefined,
			details: sanitizeForLogging(details),
			timestamp: new Date()
		};

		// Add to in-memory store (with rotation)
		this.events.push(securityEvent);
		if (this.events.length > this.MAX_EVENTS) {
			this.events = this.events.slice(-this.MAX_EVENTS);
		}

		// Log based on severity
		const message = `Security Event: ${event} (${severity}) from ${securityEvent.ip}`;
		const payload = SecurityLogger.safeStringify(securityEvent as unknown as Record<string, unknown>);
		switch (severity) {
			case 'critical':
				logger.error(message, payload);
				break;
			case 'high':
				logger.warn(message, payload);
				break;
			default:
				logger.log(message, payload);
		}

		// In production, send to external monitoring
		if (isProduction && ['high', 'critical'].includes(severity)) {
			this.sendToExternalMonitoring(securityEvent);
		}
	}

	static getRecentEvents(limit = 100): SecurityEvent[] {
		return this.events.slice(-limit);
	}

	static getEventsByIP(ip: string, hours = 24): SecurityEvent[] {
		const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
		return this.events.filter(e => e.ip === ip && e.timestamp > cutoff);
	}

	private static sendToExternalMonitoring(event: SecurityEvent): void {
		// Placeholder for external monitoring integration
		// e.g., Splunk, ELK, Datadog, etc.
		logger.debug(`Would send to external monitoring: ${event.event}`);
	}

	private static safeStringify(obj?: Record<string, unknown>): string {
				if (!obj) return '';
				try {
				const seen = new WeakSet();
					return JSON.stringify(sanitizeForLogging(obj), (_k, v) => {
						if (typeof v === 'object' && v !== null) {
							if (seen.has(v)) return '[Circular]';
							seen.add(v);
					}
						return v;
					});
				} catch {
					try {
						return inspect(obj, { depth: 3, breakLength: 120 });
					} catch {
						return '[Unserializable]';
					}
				}
			}

	// Instance methods for easier usage in middleware
	debug(message: string, data?: Record<string, unknown>): void {
		if (!isProduction || process.env.GAUZY_MCP_DEBUG === 'true') {
			logger.debug(message, SecurityLogger.safeStringify(data));
		}
	}

	log(message: string, data?: Record<string, unknown>): void {
		logger.log(message, SecurityLogger.safeStringify(data));
	}

	warn(message: string, data?: Record<string, unknown>): void {
		logger.warn(message, SecurityLogger.safeStringify(data));
	}

	error(message: string, error?: Error | Record<string, unknown>): void {
		if (error instanceof Error) {
			logger.error(message, error.stack || error.message);
		} else if (error) {
			logger.error(message, SecurityLogger.safeStringify(error as Record<string, unknown>));
		} else {
			logger.error(message);
		}
	}

	info(message: string, data?: Record<string, unknown>): void {
		logger.log(message, SecurityLogger.safeStringify(data));
	}
	// Instance method to log security events with request context
	logSecurityEvent(
		event: string,
		severity: SecurityEvent['severity'],
		details: Record<string, unknown>,
		req?: Request
	): void {
		SecurityLogger.logSecurityEvent(event, severity, details, req);
	}
}

// Pre-defined security events
export const SecurityEvents = {
	INVALID_AUTH: 'invalid_authentication',
	BRUTE_FORCE: 'brute_force_attempt',
	SUSPICIOUS_PAYLOAD: 'suspicious_payload',
	RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
	INVALID_SESSION: 'invalid_session',
	CSRF_VIOLATION: 'csrf_violation',
	TOOL_VALIDATION_FAILED: 'tool_validation_failed',
	LARGE_REQUEST: 'large_request_blocked',
	UNAUTHORIZED_ORIGIN: 'unauthorized_origin',
	SUSPICIOUS_USER_AGENT: 'suspicious_user_agent'
} as const;
