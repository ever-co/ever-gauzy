import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { ActionTypeEnum, ActorTypeEnum, BaseEntityEnum, ID } from '@gauzy/contracts';
import { ActivityLogService, EventBus, RequestContext } from '@gauzy/core';
import { Document } from '../entities/document.entity';
import { DocumentEvent, IDocumentEventContext } from '../events/document.event';

/**
 * The `ActionTypeEnum` each `BaseEntityEventType` maps onto.
 */
const ACTION_BY_EVENT_TYPE: Record<'created' | 'updated' | 'deleted', ActionTypeEnum> = {
	created: ActionTypeEnum.Created,
	updated: ActionTypeEnum.Updated,
	deleted: ActionTypeEnum.Deleted
};

/**
 * The document column each lifecycle phase transitions. `crud` has none by default — a move or
 * an archive names its own through `IDocumentEventContext.field`.
 */
const FIELD_BY_PHASE: Record<IDocumentEventContext['phase'], string | undefined> = {
	crud: undefined,
	status: 'status',
	knowledge: 'knowledgeStatus',
	review: 'reviewStatus'
};

/**
 * The compact projection stored as the activity entry's `data`.
 *
 * 🛑 Deliberately NOT the whole entity: a `Document` carries `contentJson`, `contentHtml`,
 * `contentBinary` and `extractedText`, which run to megabytes and are exactly the columns every
 * other read path in this plugin refuses to project. Copying them into a jsonb activity row per
 * transition would bloat the table without telling a reader anything a timeline needs.
 */
export interface IDocumentActivitySnapshot {
	id: ID;
	kind: string;
	name: string;
	parentId: ID | null;
	status: string;
	knowledgeStatus: string;
	reviewStatus: string;
	visibility: string;
	source: string;
	isArchived: boolean;
	version: number;
}

/**
 * Activity-log writer for the Documents hub (`00-product-spec.md` R-COL-03).
 *
 * Every mutation and every pipeline/knowledge/review transition already publishes a
 * `DocumentEvent` on the core RxJS event bus (`DocumentService.emitDocumentEvent` /
 * `DocumentProcessingService.emitEvent`). Rather than sprinkling `logActivity` calls across
 * ~20 handlers — where the next one added would inevitably forget it — this subscriber sits on
 * that one seam and turns each event into an `ActivityLog` row through the platform's own
 * `ActivityLogService`. The detail panel's timeline reads those rows back with
 * `entity: 'Document', entityId: <id>`.
 *
 * **Attribution.** `context.actor` wins when the emitter states it (every pipeline-owned
 * transition sets `'system'`), otherwise it is inferred from the request identity. The
 * explicit marker is load-bearing: in inline dispatch mode the pipeline runs on a
 * `setImmediate` **inside the uploader's async context**, so inference alone would credit the
 * extractor's status writes to whoever uploaded the file.
 *
 * **Best-effort by contract.** `logActivity` publishes on the CQRS bus and the row is written by
 * the core handler; anything that throws on this path is logged and swallowed, because an
 * activity row must never roll back the mutation that produced it.
 */
@Injectable()
export class DocumentActivityLogSubscriber implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(DocumentActivityLogSubscriber.name);

	private subscription?: Subscription;

	constructor(private readonly eventBus: EventBus, private readonly activityLogService: ActivityLogService) {}

	/** Whether the event-bus subscription is live. */
	public get isActive(): boolean {
		return !!this.subscription;
	}

	/**
	 * Subscribes to every `DocumentEvent` on the core event bus.
	 */
	onModuleInit(): void {
		try {
			this.subscription = this.eventBus.ofType(DocumentEvent).subscribe({
				next: (event: DocumentEvent) => this.record(event),
				error: (error: unknown) =>
					this.logger.warn(`Document activity-log stream error: ${(error as Error)?.message}`)
			});
			this.logger.log('Documents activity log active — subscribed to DocumentEvent.');
		} catch (error) {
			this.logger.warn(`Failed to subscribe to DocumentEvent: ${(error as Error).message}`);
		}
	}

	/** Drops the subscription on teardown. */
	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = undefined;
	}

	/**
	 * Writes one activity entry for a document event.
	 *
	 * @param event The published document event.
	 */
	public record(event: DocumentEvent): void {
		try {
			const document = event?.entity;
			// Tenant + organization are the activity row's own scope columns, so an event that
			// cannot supply both has nothing to write against.
			if (!document?.id || !document.tenantId || !document.organizationId) {
				return;
			}

			const context = event.context ?? { phase: 'crud' };
			const action = ACTION_BY_EVENT_TYPE[event.type] ?? ActionTypeEnum.Updated;
			const { originalValues, newValues } = this.transitionValues(context);

			this.activityLogService.logActivity<IDocumentActivitySnapshot>(
				BaseEntityEnum.Document,
				action,
				this.resolveActor(context),
				document.id,
				document.name ?? '',
				this.snapshotOf(document),
				document.organizationId,
				document.tenantId,
				originalValues,
				newValues
			);
		} catch (error) {
			this.logger.warn(`Failed to write the document activity log entry: ${(error as Error).message}`);
		}
	}

	/**
	 * Resolves the actor of a transition: the emitter's explicit marker first, then the request
	 * identity (present on a request thread, absent on a queue thread).
	 *
	 * @param context The lifecycle-phase context of the event.
	 * @returns `User` or `System`.
	 */
	private resolveActor(context: IDocumentEventContext): ActorTypeEnum {
		if (context.actor === 'system') {
			return ActorTypeEnum.System;
		}
		if (context.actor === 'user') {
			return ActorTypeEnum.User;
		}
		return this.currentUserId() ? ActorTypeEnum.User : ActorTypeEnum.System;
	}

	/**
	 * Reads the current user id, tolerating a thread with no request context at all.
	 */
	private currentUserId(): ID | undefined {
		try {
			return RequestContext.currentUserId() ?? undefined;
		} catch {
			return undefined; // queue threads have no request context
		}
	}

	/**
	 * Turns the event's `previous`/`next` pair into the before/after maps
	 * `ActivityLogService.logActivity` diffs into `updatedFields` + `previousValues` +
	 * `updatedValues`. A transition that names no field (a plain metadata save) yields
	 * `undefined` for both, and the entry records the action alone.
	 *
	 * @param context The lifecycle-phase context of the event.
	 * @returns The before/after maps, or `{}` when the event carries no transition.
	 */
	private transitionValues(context: IDocumentEventContext): {
		originalValues?: Partial<IDocumentActivitySnapshot>;
		newValues?: Partial<IDocumentActivitySnapshot>;
	} {
		const field = context.field ?? FIELD_BY_PHASE[context.phase];
		if (!field || context.previous === undefined || context.next === undefined) {
			return {};
		}
		return {
			originalValues: { [field]: context.previous } as Partial<IDocumentActivitySnapshot>,
			newValues: { [field]: context.next } as Partial<IDocumentActivitySnapshot>
		};
	}

	/**
	 * Projects the document onto the compact snapshot stored as the entry's `data`.
	 */
	private snapshotOf(document: Document): IDocumentActivitySnapshot {
		return {
			id: document.id,
			kind: document.kind,
			name: document.name,
			parentId: document.parentId ?? null,
			status: document.status,
			knowledgeStatus: document.knowledgeStatus,
			reviewStatus: document.reviewStatus,
			visibility: document.visibility,
			source: document.source,
			isArchived: document.isArchived === true,
			version: document.version ?? 1
		};
	}
}
