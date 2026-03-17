import { logger as log } from '@gauzy/desktop-core';
import { IProtocolHandler } from './interfaces/protocol-handler.interface';

/**
 * Routes incoming `gauzy://` deep-link URLs to the correct handler using the
 *
 * Registered handlers are evaluated in insertion order; the first one whose
 * `canHandle()` returns `true` receives the request.
 *
 * The router is a **Singleton** (consistent with `AppWindowManager.getInstance()`)
 * so a single instance manages both handler registration and the pending-URL
 * queue across the entire application lifecycle.
 *
 */
export class ProtocolRouter {
	private static _instance: ProtocolRouter;

	/** Registered handlers evaluated in order (Chain of Responsibility). */
	private readonly handlers: IProtocolHandler[] = [];

	/**
	 * URL stored when a handler threw during processing (e.g. target window
	 * not yet initialised).  Retried on the next `processPending()` call.
	 */
	private _pendingUrl: string | null = null;

	/** Returns the application-wide singleton instance. */
	static getInstance(): ProtocolRouter {
		if (!ProtocolRouter._instance) {
			ProtocolRouter._instance = new ProtocolRouter();
		}
		return ProtocolRouter._instance;
	}

	/**
	 * Registers a handler and returns `this` for fluent chaining:
	 * ```ts
	 * ProtocolRouter.getInstance()
	 *   .register(new InstallPluginHandler(ui))
	 *   .register(new AnotherHandler());
	 * ```
	 */
	register(handler: IProtocolHandler): this {
		this.handlers.push(handler);
		return this;
	}

	/**
	 * Parses `rawUrl`, resolves the action segment, finds the matching handler
	 * via the Chain of Responsibility, and awaits execution.
	 *
	 * When the selected handler throws (e.g. the target window is not ready),
	 * `rawUrl` is stored internally so it can be retried later via
	 * `processPending()`.
	 *
	 * @param rawUrl The raw `gauzy://…` string received from the OS.
	 */
	async route(rawUrl: string): Promise<void> {
		try {
			log.info('[ProtocolRouter] Routing deep link:', rawUrl);

			const parsed = new URL(rawUrl);
			const action = this.extractAction(parsed);

			log.info('[ProtocolRouter] Resolved action:', action);

			const handler = this.handlers.find((h) => h.canHandle(action));

			if (!handler) {
				log.warn('[ProtocolRouter] No handler registered for action:', action);
				return;
			}

			await handler.handle(parsed);
		} catch (error) {
			log.error('[ProtocolRouter] Error during routing — queuing as pending:', error);
			this._pendingUrl = rawUrl;
		}
	}

	/**
	 * Retries the pending URL (if any) that was stored after a previous
	 * routing failure.  Call this once the application is fully initialised.
	 */
	async processPending(): Promise<void> {
		if (!this._pendingUrl) {
			return;
		}

		const url = this._pendingUrl;
		this._pendingUrl = null;

		log.info('[ProtocolRouter] Retrying pending deep link:', url);
		await this.route(url);
	}

	/** `true` when there is a URL waiting to be retried. */
	get hasPending(): boolean {
		return this._pendingUrl !== null;
	}

	/**
	 * Extracts the action segment from a `gauzy://` URL.
	 *
	 * Examples:
	 *  - `gauzy://install-plugin?foo=bar`  → `"install-plugin"`
	 *  - `gauzy:////install-plugin`        → `"install-plugin"`
	 *
	 * Centralised here (DRY) — previously this logic was inlined inside the
	 * `handleDeepLink` function.
	 */
	private extractAction(url: URL): string {
		return url.hostname || url.pathname.replace(/^\/\//, '').split('/')[0];
	}
}
