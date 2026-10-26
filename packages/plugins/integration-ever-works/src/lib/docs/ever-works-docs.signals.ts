import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { EventSubscriber } from 'typeorm';
import { DocumentKindEnum, ID } from '@gauzy/contracts';
import { BaseEntityEventSubscriber, RequestContext } from '@gauzy/core';
import { Document } from '@gauzy/plugin-docs';
import { EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';
import { runDetached } from '../sync/outbound/ever-works-detached';

/** A Gauzy Docs node (a page or a folder) changed. */
export interface EverWorksDocumentSignal {
	tenantId: ID;
	organizationId: ID;
	documentId: ID;
	/** `undefined` when the write did not carry it (both link types are queued then). */
	kind: DocumentKindEnum | undefined;
	deleted: boolean;
	actorUserId: ID | null;
}

/**
 * Outbound trigger 2 (plan 03 §C.2) for docs: the ORM subscriber on `Document` signals through this static
 * subject (subscribers are created by the ORM, outside Nest), which {@link EverWorksDocumentCapture} drains.
 * The Docs plugin's own events are in-process hints of the same writes, so this is the one trigger; the
 * docs sweep is the durable backstop.
 */
export const EVER_WORKS_DOCUMENT_SIGNALS = new Subject<EverWorksDocumentSignal>();

function signal(entity: Partial<Document> | undefined, deleted: boolean): void {
	// Loop guard level 1: what the inbound applier writes is never captured.
	if (EverWorksSyncContext.isApplying()) return;
	if (!entity?.id || !entity.tenantId || !entity.organizationId) return;
	// Files are not synced (plan 05 §1: until P5).
	if (entity.kind !== undefined && entity.kind !== DocumentKindEnum.PAGE && entity.kind !== DocumentKindEnum.FOLDER) return;
	let actorUserId: ID | null = null;
	try {
		actorUserId = (RequestContext.currentUserId() as ID) ?? null;
	} catch {
		actorUserId = null;
	}
	EVER_WORKS_DOCUMENT_SIGNALS.next({
		tenantId: entity.tenantId as ID,
		organizationId: entity.organizationId as ID,
		documentId: entity.id as ID,
		kind: entity.kind,
		deleted,
		actorUserId
	});
}

/** A Docs page or folder created, edited, moved, archived or deleted. */
@EventSubscriber()
export class EverWorksDocumentSubscriber extends BaseEntityEventSubscriber<Document> {
	override listenTo() {
		return Document;
	}

	override async afterEntityCreate(entity: Document): Promise<void> {
		signal(entity, false);
	}

	override async afterEntityUpdate(entity: Document): Promise<void> {
		signal(entity, false);
	}

	override async afterEntitySoftRemove(entity: Document): Promise<void> {
		signal(entity, true);
	}

	override async afterEntityDelete(entity: Document): Promise<void> {
		signal(entity, true);
	}
}

/** Drains the document signals into the outbound queue (one coalesced `DOC` / `DOC_FOLDER` change per node). */
@Injectable()
export class EverWorksDocumentCapture implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverWorksDocs');
	private subscription: Subscription | null = null;

	constructor(private readonly queue: EverWorksOutboundQueue) {}

	onModuleInit(): void {
		this.subscription = EVER_WORKS_DOCUMENT_SIGNALS.subscribe((change) => {
			const types =
				change.kind === DocumentKindEnum.PAGE
					? [EverWorksLinkType.DOC]
					: change.kind === DocumentKindEnum.FOLDER
						? [EverWorksLinkType.DOC_FOLDER]
						: [EverWorksLinkType.DOC, EverWorksLinkType.DOC_FOLDER];
			for (const entityType of types) {
				// Outside the document write's transaction context (see ever-works-detached.ts).
				void runDetached(() =>
					this.queue.enqueue({
						tenantId: change.tenantId,
						organizationId: change.organizationId,
						entityType,
						gauzyId: change.documentId,
						op: change.deleted ? 'delete' : 'upsert',
						actorUserId: change.actorUserId
					})
				).catch((error) => this.logger.warn(`A document change could not be queued (${error instanceof Error ? error.name : 'error'}).`));
			}
		});
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
	}
}
