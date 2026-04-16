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
	 * FIFO queue of URLs that failed routing (e.g. target window not yet
	 * initialized).  Each entry is retried in order on the next
	 * `processPending()` call; a URL is removed only after it succeeds.
	 */
	private readonly _pendingUrls: string[] = [];

	/** Reentrancy guard — prevents concurrent `processPending()` loops. */
	private _processingPending = false;

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
	 * Non-retriable failures (invalid URL, no registered handler) are logged
	 * and discarded — they are never queued.
	 *
	 * @param rawUrl The raw `gauzy://…` string received from the OS.
	 */
	async route(rawUrl: string): Promise<void> {
		log.info('[ProtocolRouter] Routing deep link:', rawUrl);

		// Non-retriable: a malformed URL can never succeed on retry.
		let parsed: URL;
		try {
			parsed = new URL(rawUrl);
		} catch (error) {
			log.error('[ProtocolRouter] Invalid URL — discarding:', rawUrl, error);
			return;
		}

		const action = this.extractAction(parsed);
		log.info('[ProtocolRouter] Resolved action:', action);

		// Non-retriable: no handler will appear for an unknown action on retry.
		const handler = this.handlers.find((h) => h.canHandle(action));
		if (!handler) {
			log.warn('[ProtocolRouter] No handler registered for action:', action);
			return;
		}

		// Transient failure (e.g. target window not yet ready) — safe to retry.
		try {
			await handler.handle(parsed);
		} catch (error) {
			log.error('[ProtocolRouter] Error during routing — queuing as pending:', error);
			this._pendingUrls.push(rawUrl);
		}
	}

	/**
	 * Retries all queued URLs in FIFO order.  A URL is dequeued only after it
	 * is processed successfully; if it fails again it remains at the front of
	 * the queue so the next `processPending()` call can retry it.
	 *
	 * Concurrent invocations are ignored — only one loop mutates the queue at
	 * a time.  Non-retriable entries (invalid URL, no handler) are discarded
	 * rather than stalling the queue.
	 *
	 * Call this once the application is fully initialized.
	 */
	async processPending(): Promise<void> {
		if (this._processingPending) {
			return;
		}
		this._processingPending = true;
		try {
			while (this._pendingUrls.length > 0) {
				const url = this._pendingUrls[0];
				log.info('[ProtocolRouter] Retrying pending deep link:', url);

				// Non-retriable: discard and continue rather than stalling the queue.
				let parsed: URL;
				try {
					parsed = new URL(url);
				} catch (error) {
					log.warn('[ProtocolRouter] Invalid URL in pending queue — discarding:', url, error);
					this._pendingUrls.shift();
					continue;
				}

				const action = this.extractAction(parsed);
				const handler = this.handlers.find((h) => h.canHandle(action));

				if (!handler) {
					log.warn('[ProtocolRouter] No handler for pending action — discarding:', action);
					this._pendingUrls.shift();
					continue;
				}

				try {
					await handler.handle(parsed);
					this._pendingUrls.shift();
				} catch (error) {
					log.error('[ProtocolRouter] Retry failed — keeping in queue:', error);
					break;
				}
			}
		} finally {
			this._processingPending = false;
		}
	}

	/** `true` when there is at least one URL waiting to be retried. */
	get hasPending(): boolean {
		return this._pendingUrls.length > 0;
	}

	/**
	 * Extracts the action segment from a `gauzy://` URL.
	 *
	 * Examples:
	 *  - `gauzy://install-plugin?foo=bar`  → `"install-plugin"`
	 *  - `gauzy:////install-plugin`        → `"install-plugin"`
	 *
	 * Centralized here (DRY) — previously this logic was inlined inside the
	 * `handleDeepLink` function.
	 */
	private extractAction(url: URL): string {
		return url.hostname || url.pathname.replace(/^\/\//, '').split('/')[0];
	}
}
