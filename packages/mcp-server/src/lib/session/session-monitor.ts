import { Logger } from '@nestjs/common';
import { sessionManager } from './session-manager';
import { EventEmitter } from 'node:events';

const logger = new Logger('SessionMonitor');

export interface SessionEvent {
	type: 'session_created' | 'session_destroyed' | 'connection_added' | 'connection_removed' | 'session_expired' | 'user_login' | 'user_logout';
	timestamp: Date;
	sessionId: string;
	userId?: string;
	connectionId?: string;
	metadata?: Record<string, any>;
}

export interface SessionAlert {
	level: 'info' | 'warning' | 'error';
	message: string;
	timestamp: Date;
	sessionId?: string;
	userId?: string;
	details?: Record<string, any>;
}

export interface SessionMonitorConfig {
	enableEventTracking: boolean;
	enableAlerts: boolean;
	enablePerformanceMetrics: boolean;
	alertThresholds: {
		maxSessionsPerUser: number;
		maxConnectionsPerSession: number;
		sessionDurationWarning: number; // milliseconds
		inactivityWarning: number; // milliseconds
		memoryUsageWarning: number; // bytes
	};
	metricsInterval: number; // milliseconds
	eventHistoryLimit: number;
	alertHistoryLimit: number;
}

class SessionMonitor extends EventEmitter {
	private config: SessionMonitorConfig;
	private eventHistory: SessionEvent[] = [];
	private alertHistory: SessionAlert[] = [];
	private metricsTimer: NodeJS.Timeout | null = null;
	private eventTrackingTimer: NodeJS.Timeout | null = null;
	private sessionTimeouts = new Map<string, NodeJS.Timeout>();
	private performanceMetrics = {
		sessionCreationRate: 0,
		sessionDestructionRate: 0,
		averageSessionDuration: 0,
		peakSessions: 0,
		peakConnections: 0,
		memoryUsage: 0,
		lastMetricsUpdate: new Date(),
	};
	private rateCounters = {
		sessionsCreated: 0,
		sessionsDestroyed: 0,
		lastReset: new Date(),
	};
	private isEnabled = false;

	constructor(config?: Partial<SessionMonitorConfig>) {
		super();

		this.config = {
			enableEventTracking: true,
			enableAlerts: true,
			enablePerformanceMetrics: true,
			alertThresholds: {
				maxSessionsPerUser: 5,
				maxConnectionsPerSession: 10,
				sessionDurationWarning: 4 * 60 * 60 * 1000, // 4 hours
				inactivityWarning: 30 * 60 * 1000, // 30 minutes
				memoryUsageWarning: 100 * 1024 * 1024, // 100MB
			},
			metricsInterval: 60 * 1000, // 1 minute
			eventHistoryLimit: 1000,
			alertHistoryLimit: 500,
			...config,
		};
	}

	/**
	 * Start session monitoring
	 */
	start(): void {
		if (this.isEnabled) {
			logger.warn('SessionMonitor is already running');
			return;
		}

		this.isEnabled = true;

		if (this.config.enablePerformanceMetrics) {
			this.startMetricsCollection();
		}

		// Set up event listeners for session events
		this.setupEventListeners();

		logger.log('SessionMonitor started successfully');
		this.logEvent({
			type: 'session_created',
			timestamp: new Date(),
			sessionId: 'monitor',
			metadata: { action: 'monitor_started' },
		});
	}

	/**
	 * Stop session monitoring
	 */
	stop(): void {
		if (!this.isEnabled) {
			return;
		}

		this.isEnabled = false;

		if (this.metricsTimer) {
			clearInterval(this.metricsTimer);
			this.metricsTimer = null;
		}

		if (this.eventTrackingTimer) {
			clearInterval(this.eventTrackingTimer);
			this.eventTrackingTimer = null;
		}

		// Clear all session timeout timers
		for (const timeout of this.sessionTimeouts.values()) {
			clearTimeout(timeout);
		}
		this.sessionTimeouts.clear();

		this.removeAllListeners();

		logger.log('SessionMonitor stopped');
	}

	/**
	 * Log a session event
	 */
	logEvent(event: SessionEvent): void {
		if (!this.config.enableEventTracking || !this.isEnabled) {
			return;
		}

		// Add to event history
		this.eventHistory.push(event);

		// Trim history if it exceeds the limit
		if (this.eventHistory.length > this.config.eventHistoryLimit) {
			this.eventHistory = this.eventHistory.slice(-this.config.eventHistoryLimit);
		}

		// Emit event for external listeners
		this.emit('session_event', event);

		// Check for alert conditions
		if (this.config.enableAlerts) {
			this.checkForAlerts(event);
		}

		logger.debug(`Session event: ${event.type} for session ${event.sessionId}`);
	}

	/**
	 * Log an alert
	 */
	logAlert(alert: SessionAlert): void {
		if (!this.config.enableAlerts || !this.isEnabled) {
			return;
		}

		// Add to alert history
		this.alertHistory.push(alert);

		// Trim history if it exceeds the limit
		if (this.alertHistory.length > this.config.alertHistoryLimit) {
			this.alertHistory = this.alertHistory.slice(-this.config.alertHistoryLimit);
		}

		// Emit alert for external listeners
		this.emit('session_alert', alert);

		// Log based on severity
		const logMessage = `Session Alert [${alert.level.toUpperCase()}]: ${alert.message}`;
		switch (alert.level) {
			case 'error':
				logger.error(logMessage, alert.details);
				break;
			case 'warning':
				logger.warn(logMessage);
				break;
			case 'info':
			default:
				logger.log(logMessage);
				break;
		}
	}

	/**
	 * Get current session statistics with monitoring data
	 */
	getMonitoringStats(): {
		sessions: any;
		monitoring: {
			isEnabled: boolean;
			eventCount: number;
			alertCount: number;
			performanceMetrics: {
				sessionCreationRate: number;
				sessionDestructionRate: number;
				averageSessionDuration: number;
				peakSessions: number;
				peakConnections: number;
				memoryUsage: number;
				lastMetricsUpdate: Date;
			};
			recentEvents: SessionEvent[];
			recentAlerts: SessionAlert[];
		};
	} {
		const sessionStats = sessionManager.getStats();

		return {
			sessions: sessionStats,
			monitoring: {
				isEnabled: this.isEnabled,
				eventCount: this.eventHistory.length,
				alertCount: this.alertHistory.length,
				performanceMetrics: { ...this.performanceMetrics },
				recentEvents: this.eventHistory.slice(-10),
				recentAlerts: this.alertHistory.slice(-10),
			},
		};
	}

	/**
	 * Get event history with optional filtering
	 */
	getEventHistory(filter?: {
		type?: string;
		userId?: string;
		sessionId?: string;
		since?: Date;
		limit?: number;
	}): SessionEvent[] {
		let events = [...this.eventHistory];

		if (filter) {
			if (filter.type) {
				events = events.filter(e => e.type === filter.type);
			}
			if (filter.userId) {
				events = events.filter(e => e.userId === filter.userId);
			}
			if (filter.sessionId) {
				events = events.filter(e => e.sessionId === filter.sessionId);
			}
			if (filter.since) {
				events = events.filter(e => e.timestamp >= filter.since!);
			}
			if (filter.limit && filter.limit > 0) {
				events = events.slice(-filter.limit);
			}
		}

		return events.reverse(); // Most recent first
	}

	/**
	 * Get alert history with optional filtering
	 */
	getAlertHistory(filter?: {
		level?: string;
		userId?: string;
		sessionId?: string;
		since?: Date;
		limit?: number;
	}): SessionAlert[] {
		let alerts = [...this.alertHistory];

		if (filter) {
			if (filter.level) {
				alerts = alerts.filter(a => a.level === filter.level);
			}
			if (filter.userId) {
				alerts = alerts.filter(a => a.userId === filter.userId);
			}
			if (filter.sessionId) {
				alerts = alerts.filter(a => a.sessionId === filter.sessionId);
			}
			if (filter.since) {
				alerts = alerts.filter(a => a.timestamp >= filter.since!);
			}
			if (filter.limit && filter.limit > 0) {
				alerts = alerts.slice(-filter.limit);
			}
		}

		return alerts.reverse(); // Most recent first
	}

	/**
	 * Force a monitoring check on all current sessions
	 */
	performMonitoringCheck(): {
		sessionsChecked: number;
		alertsGenerated: number;
		issues: string[];
	} {
		const stats = sessionManager.getStats();
		const issues: string[] = [];
		let alertsGenerated = 0;

		// Check overall memory usage
		if (stats.memoryUsage.total > this.config.alertThresholds.memoryUsageWarning) {
			this.logAlert({
				level: 'warning',
				message: `High memory usage detected: ${Math.round(stats.memoryUsage.total / 1024 / 1024)}MB`,
				timestamp: new Date(),
				details: { memoryUsage: stats.memoryUsage },
			});
			issues.push('High memory usage');
			alertsGenerated++;
		}

		// Check for users with too many sessions
		for (const [userId, sessionCount] of stats.userSessions) {
			if (sessionCount > this.config.alertThresholds.maxSessionsPerUser) {
				this.logAlert({
					level: 'warning',
					message: `User ${userId} has ${sessionCount} active sessions (limit: ${this.config.alertThresholds.maxSessionsPerUser})`,
					timestamp: new Date(),
					userId,
					details: { sessionCount, limit: this.config.alertThresholds.maxSessionsPerUser },
				});
				issues.push(`User ${userId} has too many sessions`);
				alertsGenerated++;
			}
		}

		logger.debug(`Monitoring check completed: ${stats.totalSessions} sessions checked, ${alertsGenerated} alerts generated`);

		return {
			sessionsChecked: stats.totalSessions,
			alertsGenerated,
			issues,
		};
	}

	private setupEventListeners(): void {
		// Note: In a real implementation, you would set up listeners on the session manager
		// For now, we'll create a polling mechanism to check for changes
		if (this.config.enableEventTracking && !this.eventTrackingTimer) {
			this.eventTrackingTimer = setInterval(() => {
				this.checkForSessionChanges();
			}, 5000); // Check every 5 seconds

			// Prevent timer from keeping process alive
			this.eventTrackingTimer.unref?.();
		}
	}

	private checkForSessionChanges(): void {
		// This is a simplified implementation
		// In practice, you'd have proper event emission from the session manager
		const stats = sessionManager.getStats();

		// Update performance metrics
		if (stats.totalSessions > this.performanceMetrics.peakSessions) {
			this.performanceMetrics.peakSessions = stats.totalSessions;
		}

		if (stats.totalConnections > this.performanceMetrics.peakConnections) {
			this.performanceMetrics.peakConnections = stats.totalConnections;
		}

		this.performanceMetrics.memoryUsage = stats.memoryUsage.total;
	}

	private startMetricsCollection(): void {
		this.metricsTimer = setInterval(() => {
			this.updatePerformanceMetrics();
		}, this.config.metricsInterval);

		// Prevent timer from keeping process alive
		this.metricsTimer.unref?.();
	}

	private updatePerformanceMetrics(): void {
		const now = new Date();
		const timeSinceLastReset = now.getTime() - this.rateCounters.lastReset.getTime();

		// Calculate rates (per minute)
		const minutesSinceReset = timeSinceLastReset / (1000 * 60);
		if (minutesSinceReset > 0) {
			this.performanceMetrics.sessionCreationRate = this.rateCounters.sessionsCreated / minutesSinceReset;
			this.performanceMetrics.sessionDestructionRate = this.rateCounters.sessionsDestroyed / minutesSinceReset;
		}

		// Reset counters
		this.rateCounters.sessionsCreated = 0;
		this.rateCounters.sessionsDestroyed = 0;
		this.rateCounters.lastReset = now;

		this.performanceMetrics.lastMetricsUpdate = now;

		logger.debug('Performance metrics updated', {
			creationRate: this.performanceMetrics.sessionCreationRate,
			destructionRate: this.performanceMetrics.sessionDestructionRate,
			peakSessions: this.performanceMetrics.peakSessions,
			peakConnections: this.performanceMetrics.peakConnections,
		});
	}

	private checkForAlerts(event: SessionEvent): void {
		// Check for session duration warnings
		if (event.type === 'session_created') {
			// Clear any existing timeout for this session first
			const existingTimeout = this.sessionTimeouts.get(event.sessionId);
			if (existingTimeout) {
				clearTimeout(existingTimeout);
			}

			const timeout = setTimeout(() => {
				this.logAlert({
					level: 'info',
					message: `Long-running session detected: ${event.sessionId} (${this.config.alertThresholds.sessionDurationWarning / 1000 / 60} minutes)`,
					timestamp: new Date(),
					sessionId: event.sessionId,
					userId: event.userId,
				});
				// Clean up the timeout reference after it fires
				this.sessionTimeouts.delete(event.sessionId);
			}, this.config.alertThresholds.sessionDurationWarning);

			// Store the timeout reference for cleanup
			this.sessionTimeouts.set(event.sessionId, timeout);
		} else if (event.type === 'session_destroyed') {
			// Clear the timeout for this session if it exists
			const timeout = this.sessionTimeouts.get(event.sessionId);
			if (timeout) {
				clearTimeout(timeout);
				this.sessionTimeouts.delete(event.sessionId);
			}
		}

		// Increment rate counters
		if (event.type === 'session_created') {
			this.rateCounters.sessionsCreated++;
		} else if (event.type === 'session_destroyed') {
			this.rateCounters.sessionsDestroyed++;
		}
	}
}

// Export singleton instance
export const sessionMonitor = new SessionMonitor();
