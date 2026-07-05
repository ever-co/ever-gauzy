import { logger as log } from '@gauzy/desktop-core';
import { IProtocolHandler } from '../interfaces/protocol-handler.interface';

/**
 * Template-Method base class shared by all concrete handlers (DRY).
 *
 * Provides:
 *  - A default `canHandle` implementation (strict equality) so subclasses
 *    do not repeat the same boilerplate — satisfying the DRY principle.
 *  - A pre-wired `log` accessor so concrete classes can write structured
 *    log lines without re-importing the logger.
 *
 * Subclasses must declare the `action` string and implement `handle`.
 */
export abstract class AbstractProtocolHandler implements IProtocolHandler {
	/**
	 * Identifies the deep-link action this handler serves.
	 * Must match the `hostname` (or first path segment) of a `gauzy://` URL.
	 */
	abstract readonly action: string;

	/** Pre-wired logger available to all subclasses (DRY). */
	protected readonly log = log;

	/**
	 * Default guard: performs a strict string equality check.
	 * Override when a handler needs to match several action names or
	 * apply pattern-based matching.
	 *
	 * @param action The action segment from the incoming deep-link URL.
	 */
	canHandle(action: string): boolean {
		return this.action === action;
	}

	/** @inheritdoc */
	abstract handle(url: URL): Promise<void>;
}
