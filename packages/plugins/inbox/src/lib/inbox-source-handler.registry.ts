import { Injectable, Logger } from '@nestjs/common';
import { IInboxSourceHandler, IInboxSourceHandlerRegistry } from '@gauzy/contracts';

/**
 * The sources that act on the replies of their inbox items (plan 04 §4). A plugin that feeds the inbox — the
 * Ever Works integration registers `EVER_WORKS` — registers its handler at bootstrap, through the
 * `INBOX_SOURCE_HANDLER_REGISTRY` token (optional injection), so the inbox never depends on it.
 *
 * One handler per source: registering a second, different handler for a taken source is refused (two
 * handlers would both act on one reply). Registering the same handler again is a no-op.
 */
@Injectable()
export class InboxSourceHandlerRegistry implements IInboxSourceHandlerRegistry {
	private readonly logger = new Logger(InboxSourceHandlerRegistry.name);
	private readonly handlers = new Map<string, IInboxSourceHandler>();

	register(handler: IInboxSourceHandler): void {
		const source = typeof handler?.source === 'string' ? handler.source.trim() : '';
		if (!source || typeof handler.onReply !== 'function') {
			throw new Error('An inbox source handler needs a source and an onReply function.');
		}
		const current = this.handlers.get(source);
		if (current && current !== handler) {
			throw new Error(`An inbox source handler is already registered for ${source}.`);
		}
		this.handlers.set(source, handler);
		this.logger.log(`Inbox source handler registered: ${source}`);
	}

	unregister(source: string): void {
		this.handlers.delete(typeof source === 'string' ? source.trim() : source);
	}

	get(source: string): IInboxSourceHandler | undefined {
		return this.handlers.get(typeof source === 'string' ? source.trim() : source);
	}

	/** The registered sources (diagnostics). */
	sources(): string[] {
		return [...this.handlers.keys()];
	}
}
