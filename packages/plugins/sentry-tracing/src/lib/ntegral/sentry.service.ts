import { Inject, Injectable, ConsoleLogger, OnApplicationShutdown } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { RequestContext } from '@gauzy/core';
import { SENTRY_MODULE_OPTIONS } from './sentry.constants';
import { SentryModuleOptions } from './sentry.interfaces';

@Injectable()
export class SentryService extends ConsoleLogger implements OnApplicationShutdown {
	private readonly prefix = '@ntegral/nestjs-sentry: ';
	private static serviceInstance: SentryService;

	constructor(
		@Inject(SENTRY_MODULE_OPTIONS)
		readonly opts?: SentryModuleOptions
	) {
		super();
		this.initSentry();
	}

	/**
	 * Initialize Sentry with options from environment.
	 */
	private initSentry(): void {
		if (!this.opts?.dsn) {
			console.log('Sentry options not found. Did you use SentryModule.forRoot?');
			return;
		}

		const { integrations = [], ...sentryOptions } = this.opts;
		Sentry.init({
			...sentryOptions,
			integrations: [
				Sentry.onUncaughtExceptionIntegration({
					onFatalError: async (error) => {
						console.error('Uncaught Exception Handler in Sentry Service', error);
						if (error.name === 'SentryError') {
							console.log(error);
						} else {
							Sentry.getClient()?.captureException(error);
							Sentry.flush(3000).then(() => process.exit(1));
						}
					}
				}),
				Sentry.onUnhandledRejectionIntegration({ mode: 'warn' }),
				...integrations
			]
		});
	}

	/**
	 * Check if Sentry is enabled based on resolvedSettings or default config.
	 */
	private isEnabled(): boolean {
		try {
			const request = RequestContext.currentRequest();
			const settings = request?.['resolvedSettings'];
			if (settings?.sentryEnabled !== undefined) {
				return settings.sentryEnabled === 'true' || settings.sentryEnabled === true;
			}
		} catch {
			// No request context
		}
		return !!this.opts?.dsn;
	}

	public static SentryServiceInstance(): SentryService {
		if (!SentryService.serviceInstance) {
			SentryService.serviceInstance = new SentryService();
		}
		return SentryService.serviceInstance;
	}

	log(message: string, context?: string, asBreadcrumb?: boolean) {
		const msg = `${this.prefix}${message}`;
		try {
			super.log(msg, context);
			if (!this.isEnabled()) return;
			asBreadcrumb
				? Sentry.addBreadcrumb({ message: msg, level: 'log', data: { context } })
				: Sentry.captureMessage(msg, 'log');
		} catch {
			// Silently ignore to avoid blocking the application
		}
	}

	error(message: string, trace?: string, context?: string) {
		const msg = `${this.prefix}${message}`;
		try {
			super.error(msg, trace, context);
			if (!this.isEnabled()) return;
			Sentry.captureMessage(msg, 'error');
		} catch {
			// Silently ignore to avoid blocking the application
		}
	}

	warn(message: string, context?: string, asBreadcrumb?: boolean) {
		const msg = `${this.prefix}${message}`;
		try {
			super.warn(msg, context);
			if (!this.isEnabled()) return;
			asBreadcrumb
				? Sentry.addBreadcrumb({ message: msg, level: 'warning', data: { context } })
				: Sentry.captureMessage(msg, 'warning');
		} catch {
			// Silently ignore to avoid blocking the application
		}
	}

	debug(message: string, context?: string, asBreadcrumb?: boolean) {
		const msg = `${this.prefix}${message}`;
		try {
			super.debug(msg, context);
			if (!this.isEnabled()) return;
			asBreadcrumb
				? Sentry.addBreadcrumb({ message: msg, level: 'debug', data: { context } })
				: Sentry.captureMessage(msg, 'debug');
		} catch {
			// Silently ignore to avoid blocking the application
		}
	}

	verbose(message: string, context?: string, asBreadcrumb?: boolean) {
		const msg = `${this.prefix}${message}`;
		try {
			super.verbose(msg, context);
			if (!this.isEnabled()) return;
			asBreadcrumb
				? Sentry.addBreadcrumb({ message: msg, level: 'info', data: { context } })
				: Sentry.captureMessage(msg, 'info');
		} catch {
			// Silently ignore to avoid blocking the application
		}
	}

	instance() {
		return this.isEnabled() ? Sentry : null;
	}

	async onApplicationShutdown() {
		if (this.opts?.close?.enabled) {
			await Sentry.close(this.opts.close.timeout);
		}
	}
}
