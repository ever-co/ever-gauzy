import { Injectable, Optional, Inject } from '@angular/core';
import { LOGGER_CONTEXT } from './logger.tokens';

/**
 * Contextual logger API returned by {@link LoggerService.withContext}.
 * All methods use the same context/prefix.
 */
export interface ContextLogger {
	log(message: string, ...args: unknown[]): void;
	error(message: unknown, trace?: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
	verbose(message: string, ...args: unknown[]): void;
}

/**
 * Angular logger service similar to NestJS LoggerModule.
 *
 * - Uses `console` in the browser; output can be overridden by replacing the logger implementation.
 * - Supports an optional **context/prefix** (e.g. component or feature name) so logs appear as `[Context] message`.
 * - Context can be set per-call, via {@link withContext}, or by providing {@link LOGGER_CONTEXT} in the injector.
 *
 * @example
 * ```ts
 * // Inject and use with optional context per call
 * constructor(private readonly logger: LoggerService) {}
 * this.logger.log('User logged in');
 * this.logger.warn('Slow request', 'AuthService');
 *
 * // Or use a fixed context (like NestJS prefixed logger)
 * private readonly log = this.logger.withContext('MyComponent');
 * this.log.log('init');
 * this.log.error('Failed', stack);
 * ```
 *
 * @example
 * ```ts
 * // Provide a default context for a component subtree
 * @Component({
 *   providers: [{ provide: LOGGER_CONTEXT, useValue: 'MyComponent' }]
 * })
 * ```
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
	private enabled = false;
	private readonly _defaultContext: string | undefined;

	constructor(@Optional() @Inject(LOGGER_CONTEXT) defaultContext?: string) {
		this._defaultContext = defaultContext ?? undefined;
	}

	/**
	 * Sets the enabled state of the logger.
	 * @param value - Whether the logger should be enabled.
	 */
	setEnabled(value: boolean): void {
		this.enabled = value;
	}

	/**
	 * Returns a logger that always uses the given context (prefix).
	 * Similar to NestJS prefixed loggers (`Logger${prefix}`).
	 */
	withContext(context: string): ContextLogger {
		const ctx = context || this._defaultContext;
		return {
			log: (msg: string, ...args: unknown[]) => this.log(msg, ctx, ...args),
			error: (msg: unknown, trace?: string, ...args: unknown[]) => this.error(msg, trace, ctx, ...args),
			warn: (msg: string, ...args: unknown[]) => this.warn(msg, ctx, ...args),
			debug: (msg: string, ...args: unknown[]) => this.debug(msg, ctx, ...args),
			verbose: (msg: string, ...args: unknown[]) => this.verbose(msg, ctx, ...args)
		};
	}

	/** Formats message with optional context prefix. */
	private formatMessage(message: string, context?: string): string {
		const prefix = context ?? this._defaultContext;
		return prefix ? `[${prefix}] ${message}` : message;
	}

	log(message: string, context?: string, ...args: unknown[]): void {
		if (!this.enabled) return;
		console.log(this.formatMessage(message, context), ...args);
	}

	error(message: unknown, trace?: string, context?: string, ...args: unknown[]): void {
		if (!this.enabled) return;
		const prefix = context ?? this._defaultContext;
		const label = prefix ? `[${prefix}]` : '';
		console.error(label, message, ...(trace ? [trace] : []), ...args);
	}

	warn(message: string, context?: string, ...args: unknown[]): void {
		if (!this.enabled) return;
		console.warn(this.formatMessage(message, context), ...args);
	}

	debug(message: string, context?: string, ...args: unknown[]): void {
		if (!this.enabled) return;
		if (typeof console.debug === 'function') {
			console.debug(this.formatMessage(message, context), ...args);
		} else {
			console.log(this.formatMessage(message, context), ...args);
		}
	}

	verbose(message: string, context?: string, ...args: unknown[]): void {
		if (!this.enabled) return;
		// In browser we treat verbose as debug
		this.debug(message, context, ...args);
	}
}
