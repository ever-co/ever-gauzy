import { Injectable, Logger } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import type { Document } from '../entities/document.entity';

/**
 * What the live editing sessions (`DocsLivePlugin`, loaded with `GAUZY_DOCS_LIVE_ENABLED=true`) need to hear from the
 * rest of the plugin.
 */
export interface IDocumentLiveHandler {
	/**
	 * A content write that did not come through a live session (an API save, a Markdown update, a version restore) has
	 * been saved. The handler applies it to the page's live document, so open editors see it.
	 *
	 * @param previous The page as it was loaded before the write.
	 * @param updated The page as saved.
	 */
	contentWritten(previous: Document, updated: Document): Promise<void>;
	/**
	 * Something is about to read the page's stored content to copy it (a duplicate): the live document's latest state
	 * is saved first.
	 *
	 * @param documentId The page.
	 * @param tenantId Its tenant.
	 */
	flush(documentId: ID, tenantId: ID): Promise<void>;
	/**
	 * Who may read or write the page may have changed (a share was created, changed or revoked): the open sessions
	 * are checked again.
	 *
	 * @param documentId The page.
	 */
	accessChanged(documentId: ID): void;
	/** Whether live sessions are served by this process. */
	readonly enabled: boolean;
}

/**
 * The seam between the Documents services and the live editing sessions.
 *
 * The live module imports `DocsModule`, so the Documents services cannot inject it; they call this bridge, which the
 * live module fills in when it starts. Without it (the default: the flag is off) every call is a no-op and the
 * services behave as before. A failure of the handler is logged and never fails the write that called it: the
 * stored content is already saved, and the live document catches up on its next persist.
 */
@Injectable()
export class DocumentLiveBridge {
	private readonly logger = new Logger(DocumentLiveBridge.name);

	private handler: IDocumentLiveHandler | null = null;

	/** Whether live sessions are served by this process. */
	get enabled(): boolean {
		return this.handler?.enabled === true;
	}

	/**
	 * Installs the handler.
	 *
	 * @param handler The live sessions.
	 * @returns A function that removes it.
	 */
	register(handler: IDocumentLiveHandler): () => void {
		this.handler = handler;
		return () => {
			if (this.handler === handler) {
				this.handler = null;
			}
		};
	}

	/** See {@link IDocumentLiveHandler.contentWritten}. */
	async contentWritten(previous: Document, updated: Document): Promise<void> {
		if (!this.handler) {
			return;
		}
		try {
			await this.handler.contentWritten(previous, updated);
		} catch (error) {
			this.logger.warn(
				`The live document of ${updated?.id} did not take a content write: ${(error as Error)?.message ?? error}`
			);
		}
	}

	/** See {@link IDocumentLiveHandler.flush}. */
	async flush(documentId: ID, tenantId: ID): Promise<void> {
		if (!this.handler) {
			return;
		}
		try {
			await this.handler.flush(documentId, tenantId);
		} catch (error) {
			this.logger.warn(
				`The live document of ${documentId} could not be saved before a copy: ${(error as Error)?.message ?? error}`
			);
		}
	}

	/** See {@link IDocumentLiveHandler.accessChanged}. */
	accessChanged(documentId: ID): void {
		try {
			this.handler?.accessChanged(documentId);
		} catch (error) {
			this.logger.warn(
				`The live sessions of ${documentId} were not checked again: ${(error as Error)?.message ?? error}`
			);
		}
	}
}
