import { IDocumentCreateInput, IDocumentUpdateInput } from '@gauzy/contracts';
import { BaseEntityEvent, BaseEntityEventType, RequestContext } from '@gauzy/core';
import { Document } from '../entities/document.entity';

type DocumentInputTypes = IDocumentCreateInput | IDocumentUpdateInput;

/**
 * The lifecycle phase a `DocumentEvent` describes: plain CRUD, a processing-status transition,
 * a knowledge-status transition, or a review-status transition.
 */
export interface IDocumentEventContext {
	phase: 'crud' | 'status' | 'knowledge' | 'review';
	previous?: string;
	next?: string;
}

/**
 * Event class representing Documents events on the core RxJS event bus.
 *
 * Emitted on every CRUD mutation and every pipeline/knowledge/review transition; consumers
 * subscribe via `eventBus.ofType(DocumentEvent)` — this is the hook future capture paths
 * (chat/email attachments → documents) and other plugins build on.
 */
export class DocumentEvent extends BaseEntityEvent<Document, DocumentInputTypes> {
	public readonly context: IDocumentEventContext;

	/**
	 * Creates an instance of DocumentEvent.
	 *
	 * @param {RequestContext} ctx - The context object containing information about the request.
	 * @param {Document} entity - The document entity associated with the event.
	 * @param {BaseEntityEventType} type - The type of the event.
	 * @param {IDocumentEventContext} context - The lifecycle phase of the event.
	 * @param {DocumentInputTypes} [input] - Optional input data for the event.
	 */
	constructor(
		ctx: RequestContext,
		entity: Document,
		type: BaseEntityEventType,
		context: IDocumentEventContext = { phase: 'crud' },
		input?: DocumentInputTypes
	) {
		super(entity, type, ctx, input);
		this.context = context;
	}
}
