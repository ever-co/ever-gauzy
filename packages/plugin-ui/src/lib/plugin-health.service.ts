import { inject, Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { PluginEventBusService } from './plugin-extension/plugin-event-bus.service';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Health status for a single plugin.
 */
export interface PluginHealthStatus {
	/** Plugin ID. */
	pluginId: string;
	/** Current health state. */
	state: 'healthy' | 'degraded' | 'error';
	/** Boot duration in milliseconds (0 if not yet booted). */
	bootTimeMs: number;
	/** Number of errors recorded. */
	errorCount: number;
	/** Most recent error (if any). */
	lastError?: { message: string; timestamp: number };
	/** Timestamp of first boot. */
	bootedAt?: number;
	/** Whether the plugin is currently loaded. */
	loaded: boolean;
}

/**
 * Aggregate health snapshot across all plugins.
 */
export interface PluginHealthSnapshot {
	/** Total plugins being tracked. */
	total: number;
	/** Healthy count. */
	healthy: number;
	/** Degraded count. */
	degraded: number;
	/** Errored count. */
	errored: number;
	/** Per-plugin statuses. */
	plugins: PluginHealthStatus[];
	/** Total boot time across all plugins (ms). */
	totalBootTimeMs: number;
}

// ─── Service ────────────────────────────────────────────────────────────────

/**
 * Plugin Health Monitoring Service.
 *
 * Tracks plugin boot times, error counts, and health state.
 * Provides reactive observation and snapshot queries for debugging
 * and DevTools panels.
 *
 * @example
 * ```ts
 * const health = inject(PluginHealthService);
 *
 * // Record boot
 * health.recordBootStart('my-plugin');
 * // ... bootstrap logic ...
 * health.recordBootEnd('my-plugin');
 *
 * // Record error
 * health.recordError('my-plugin', new Error('Something broke'));
 *
 * // Query
 * const status = health.getStatus('my-plugin');
 * console.log(status?.bootTimeMs, status?.errorCount);
 *
 * // Observe all
 * health.snapshot$.subscribe(snap => {
 *   console.log(`${snap.healthy}/${snap.total} plugins healthy`);
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class PluginHealthService implements OnDestroy {
	private readonly _eventBus = inject(PluginEventBusService);
	private readonly _statuses$ = new BehaviorSubject<Map<string, PluginHealthStatus>>(new Map());

	/** Pending boot start timestamps. */
	private readonly _bootStarts = new Map<string, number>();

	// ─── Recording ──────────────────────────────────────────────

	/**
	 * Marks the start of a plugin boot sequence.
	 */
	recordBootStart(pluginId: string): void {
		this._bootStarts.set(pluginId, performance.now());
		this._ensureEntry(pluginId);
	}

	/**
	 * Marks the end of a plugin boot sequence.
	 * Calculates boot duration from the matching `recordBootStart`.
	 */
	recordBootEnd(pluginId: string): void {
		const start = this._bootStarts.get(pluginId);
		const bootTimeMs = start != null ? Math.round(performance.now() - start) : 0;
		this._bootStarts.delete(pluginId);

		this._updateStatus(pluginId, (status) => ({
			...status,
			bootTimeMs,
			bootedAt: Date.now(),
			loaded: true,
			state: status.errorCount > 0 ? 'degraded' : 'healthy'
		}));

		this._eventBus.emit('plugin:health:booted', { pluginId, bootTimeMs }, { source: 'plugin-health' });
	}

	/**
	 * Records an error for a plugin.
	 * Transitions the plugin to 'degraded' (1–4 errors) or 'error' (5+).
	 */
	recordError(pluginId: string, error: Error | string): void {
		const message = typeof error === 'string' ? error : error.message;

		this._updateStatus(pluginId, (status) => {
			const errorCount = status.errorCount + 1;
			return {
				...status,
				errorCount,
				lastError: { message, timestamp: Date.now() },
				state: errorCount >= 5 ? 'error' : errorCount > 0 ? 'degraded' : 'healthy'
			};
		});

		this._eventBus.emit('plugin:health:error', { pluginId, message }, { source: 'plugin-health' });
	}

	/**
	 * Marks a plugin as unloaded.
	 */
	recordUnloaded(pluginId: string): void {
		this._updateStatus(pluginId, (status) => ({
			...status,
			loaded: false
		}));
	}

	/**
	 * Resets the health status for a plugin.
	 */
	reset(pluginId: string): void {
		const statuses = new Map(this._statuses$.value);
		statuses.delete(pluginId);
		this._statuses$.next(statuses);
	}

	/**
	 * Clears all health records.
	 */
	clear(): void {
		this._statuses$.next(new Map());
		this._bootStarts.clear();
	}

	// ─── Queries ────────────────────────────────────────────────

	/**
	 * Gets the health status of a single plugin.
	 */
	getStatus(pluginId: string): PluginHealthStatus | undefined {
		return this._statuses$.value.get(pluginId);
	}

	/**
	 * Gets a snapshot of all plugin health statuses.
	 */
	getSnapshot(): PluginHealthSnapshot {
		return this._buildSnapshot(this._statuses$.value);
	}

	/**
	 * Observable of the full health snapshot (reactive).
	 */
	get snapshot$(): Observable<PluginHealthSnapshot> {
		return this._statuses$.pipe(map((statuses) => this._buildSnapshot(statuses)));
	}

	/**
	 * Observable of a single plugin's health status.
	 */
	getStatus$(pluginId: string): Observable<PluginHealthStatus | undefined> {
		return this._statuses$.pipe(map((statuses) => statuses.get(pluginId)));
	}

	/**
	 * Returns all plugin IDs in error or degraded state.
	 */
	getUnhealthy(): PluginHealthStatus[] {
		return Array.from(this._statuses$.value.values()).filter((s) => s.state !== 'healthy');
	}

	ngOnDestroy(): void {
		this._statuses$.complete();
	}

	// ─── Private ────────────────────────────────────────────────

	private _ensureEntry(pluginId: string): void {
		if (!this._statuses$.value.has(pluginId)) {
			this._updateStatus(pluginId, () => ({
				pluginId,
				state: 'healthy',
				bootTimeMs: 0,
				errorCount: 0,
				loaded: false
			}));
		}
	}

	private _updateStatus(
		pluginId: string,
		updater: (current: PluginHealthStatus) => PluginHealthStatus
	): void {
		const statuses = new Map(this._statuses$.value);
		const current = statuses.get(pluginId) ?? {
			pluginId,
			state: 'healthy' as const,
			bootTimeMs: 0,
			errorCount: 0,
			loaded: false
		};
		statuses.set(pluginId, updater(current));
		this._statuses$.next(statuses);
	}

	private _buildSnapshot(statuses: Map<string, PluginHealthStatus>): PluginHealthSnapshot {
		const plugins = Array.from(statuses.values());
		return {
			total: plugins.length,
			healthy: plugins.filter((s) => s.state === 'healthy').length,
			degraded: plugins.filter((s) => s.state === 'degraded').length,
			errored: plugins.filter((s) => s.state === 'error').length,
			plugins,
			totalBootTimeMs: plugins.reduce((sum, s) => sum + s.bootTimeMs, 0)
		};
	}
}
