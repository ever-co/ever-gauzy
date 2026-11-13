import { Injectable } from '@nestjs/common';
import type { IntegrationRecord, LinkRecord } from '../ever-connect.store';

/**
 * What one integration runs on this installation, once Ever Platform reads it as enabled for a
 * link (or for the installation): the code that makes it more than a row in Integrations & data.
 *
 * - `onEnable`: it became enabled (a consent in app.ever.co). A failure is retried at the next
 *   heartbeat.
 * - `onDisable`: it went off, here or on Ever Platform (switched off, denied, revoked, unlinked,
 *   disconnected). It must not throw: the integration is off whatever it does.
 * - `retry`: at each heartbeat, before Ever Platform is told again about integrations switched off
 *   while it could not be reached: what the handler could not finish (and its periodic work).
 * - `options`: the integration's own settings for one linked organization, shown on its row of
 *   Integrations & data.
 */
export interface IntegrationHandler {
	readonly key: string;
	onEnable?(row: IntegrationRecord): Promise<void>;
	onDisable?(row: IntegrationRecord): Promise<void>;
	retry?(): Promise<void>;
	options?(link: LinkRecord): Promise<Record<string, unknown>>;
}

/** A second handler for a key that already has one. */
export class IntegrationHandlerConflictError extends Error {
	constructor(key: string) {
		super(`The integration ${key} already has a handler.`);
		this.name = 'IntegrationHandlerConflictError';
	}
}

/**
 * The handlers of the integrations this installation can run. An integration Gauzy offers without
 * a handler here (and that is not one of the integrations built into the connection itself) reads
 * "coming soon": nothing of it moves, whatever Ever Platform says. Registering a handler is all it
 * takes to make one available; no other code changes.
 */
@Injectable()
export class IntegrationHandlerRegistry {
	private readonly handlers = new Map<string, IntegrationHandler>();

	/** Adds the handler of `handler.key`; a key has at most one. */
	register(handler: IntegrationHandler): void {
		if (this.handlers.has(handler.key) && this.handlers.get(handler.key) !== handler) {
			throw new IntegrationHandlerConflictError(handler.key);
		}
		this.handlers.set(handler.key, handler);
	}

	/** Whether `key` has a handler. */
	has(key: string): boolean {
		return this.handlers.has(key);
	}

	/** The handler of `key`, or `null`. */
	get(key: string): IntegrationHandler | null {
		return this.handlers.get(key) ?? null;
	}

	/** Every handler, in the order they were registered. */
	all(): IntegrationHandler[] {
		return [...this.handlers.values()];
	}
}
