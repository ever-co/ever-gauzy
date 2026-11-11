import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Subscription } from 'rxjs';
import { DataSource } from 'typeorm';
import {
	BaseEntityEnum,
	ID,
	IEmployeeNotification,
	IMentionCreateInput,
	IRealtimeChangeHint,
	REALTIME_EVENT_NAMES,
	RealtimeChangeAction
} from '@gauzy/contracts';
import {
	CommentEvent,
	EmployeeService,
	EventBus,
	EventOutboxService,
	RequestContext,
	TaskEvent
} from '@gauzy/core';
import { DocumentEvent } from '@gauzy/plugin-docs';
import { REALTIME_AGGREGATES, REALTIME_HINT_COALESCE_MS } from './realtime.constants';

/** What {@link RealtimeHintsService.appendHint} needs to file one hint on the outbox. */
export interface IRealtimeHintInput {
	/** `<aggregate>.<action>`, one of the streamed collaboration event names. */
	name: string;
	aggregateType: string;
	aggregateId: ID;
	tenantId: ID;
	/** The organization the fact belongs to; omitted for a tenant-wide fact. */
	organizationId?: ID | null;
	hint: IRealtimeChangeHint;
}

/**
 * The hint a task event becomes: organization-wide on the outbox; who receives it is decided at delivery by the task
 * read rule (`RealtimeAudience`).
 */
export function taskHint(
	task: { id?: ID; tenantId?: ID; organizationId?: ID | null; projectId?: ID | null } | null | undefined,
	action: RealtimeChangeAction,
	actorUserId: ID | null
): IRealtimeHintInput | null {
	// An organization-wide hint needs its organization: a partial save result without one would otherwise be
	// filed tenant-wide and reach every organization of the tenant.
	if (!task?.id || !task.tenantId || !task.organizationId) return null;
	return {
		name: `task.${action}`,
		aggregateType: REALTIME_AGGREGATES.TASK,
		aggregateId: task.id,
		tenantId: task.tenantId,
		organizationId: task.organizationId,
		hint: {
			entity: BaseEntityEnum.Task,
			entityId: task.id,
			action,
			organizationId: task.organizationId ?? null,
			projectId: task.projectId ?? null,
			actorUserId
		}
	};
}

/**
 * The hint a comment event becomes: addressed to nobody, it names the record whose comments changed; who receives
 * it is decided at delivery by that record's read rule (`RealtimeAudience`).
 */
export function commentHint(event: Pick<CommentEvent, 'type' | 'comment' | 'actorUserId'>): IRealtimeHintInput | null {
	const comment = event.comment;
	if (!comment?.id || !comment.tenantId || !comment.organizationId) return null;
	return {
		name: `comment.${event.type}`,
		aggregateType: REALTIME_AGGREGATES.COMMENT,
		aggregateId: comment.id,
		tenantId: comment.tenantId,
		organizationId: comment.organizationId,
		hint: {
			entity: BaseEntityEnum.Comment,
			entityId: comment.id,
			action: event.type,
			organizationId: comment.organizationId ?? null,
			parent: comment.entity && comment.entityId ? { entity: String(comment.entity), entityId: comment.entityId } : null,
			parentCommentId: comment.parentId ?? null,
			actorUserId: event.actorUserId ?? null
		}
	};
}

/** The hint a mention becomes: addressed to the mentioned employee's user. */
export function mentionHint(input: IMentionCreateInput, recipientUserId: ID | null, actorUserId: ID | null): IRealtimeHintInput | null {
	if (!input?.entityId || !input.tenantId || !recipientUserId) return null;
	return {
		name: REALTIME_EVENT_NAMES.MENTION_CREATED,
		aggregateType: REALTIME_AGGREGATES.MENTION,
		aggregateId: input.entityId,
		tenantId: input.tenantId,
		organizationId: input.organizationId ?? null,
		hint: {
			entity: String(input.entity),
			entityId: input.entityId,
			action: 'created',
			organizationId: input.organizationId ?? null,
			parent:
				input.parentEntityType && input.parentEntityId
					? { entity: String(input.parentEntityType), entityId: input.parentEntityId }
					: null,
			mentionedEmployeeId: input.mentionedEmployeeId ?? null,
			actorUserId,
			recipientUserIds: [recipientUserId]
		}
	};
}

/** The hint a saved employee notification becomes: addressed to the receiver's user, named by the row's id. */
export function notificationHint(
	notification: IEmployeeNotification,
	recipientUserId: ID | null,
	actorUserId: ID | null
): IRealtimeHintInput | null {
	if (!notification?.id || !notification.tenantId || !recipientUserId) return null;
	return {
		name: REALTIME_EVENT_NAMES.EMPLOYEE_NOTIFICATION_CREATED,
		aggregateType: REALTIME_AGGREGATES.EMPLOYEE_NOTIFICATION,
		aggregateId: notification.id,
		tenantId: notification.tenantId,
		organizationId: notification.organizationId ?? null,
		hint: {
			entity: String(notification.entity),
			entityId: notification.entityId,
			action: 'created',
			organizationId: notification.organizationId ?? null,
			notificationId: notification.id,
			type: notification.type ?? null,
			receiverEmployeeId: notification.receiverEmployeeId ?? null,
			actorUserId,
			recipientUserIds: [recipientUserId]
		}
	};
}

/**
 * The hint a document event becomes (always `document.updated`; the action says what happened). Who receives it is
 * decided at delivery by the Docs read rule — visibility, team space, shares (`RealtimeAudience`).
 */
export function documentHint(
	document: { id?: ID; tenantId?: ID; organizationId?: ID | null } | null | undefined,
	action: RealtimeChangeAction,
	actorUserId: ID | null
): IRealtimeHintInput | null {
	if (!document?.id || !document.tenantId || !document.organizationId) return null;
	return {
		name: REALTIME_EVENT_NAMES.DOCUMENT_UPDATED,
		aggregateType: REALTIME_AGGREGATES.DOCUMENT,
		aggregateId: document.id,
		tenantId: document.tenantId,
		organizationId: document.organizationId,
		hint: {
			entity: BaseEntityEnum.Document,
			entityId: document.id,
			action,
			organizationId: document.organizationId ?? null,
			actorUserId
		}
	};
}

/** The key two hints are folded under when they say the same thing within the coalescing window. */
export function coalesceKey(input: Pick<IRealtimeHintInput, 'name' | 'aggregateId' | 'tenantId'>): string {
	return `${input.tenantId}|${input.name}|${input.aggregateId}`;
}

/**
 * Turns the platform's in-process facts into durable, content-free change hints on the event outbox.
 *
 * It listens where the domains already publish — `TaskEvent` and `DocumentEvent` on the RxJS bus, `CommentEvent`,
 * `CreateMentionEvent` and `EmployeeNotificationCreatedEvent` on the CQRS bus (through the handlers in
 * `./handlers`) — and appends one hint per fact **after** the write, the way the Inbox appends
 * `inbox_item.created`: a lost hint costs a subscriber the instant update, never the write. Repeated
 * `*.updated` hints of one aggregate within {@link REALTIME_HINT_COALESCE_MS} are folded: the first at once,
 * the latest of the rest when the window closes. A fact without its organization produces no organization-wide
 * hint, so a partial save result never reaches the whole tenant. The task, comment and document hints name no
 * recipients: their readers are decided when the hint is delivered, by `RealtimeAudience`.
 *
 * **Why these hints stay best effort, after the commit.** The facts reach this service after their write committed:
 * `TaskEvent` is published by the task command handlers and `TaskService` once `save`/`update` returned, `CommentEvent`
 * by `CommentService` after its write, `DocumentEvent` by the Docs services, and the mention and notification events
 * after their rows were saved — none of them hands over a transaction, and most of those writes run in none of their
 * own (a repository `update` is one auto-committed statement). Appending inside them would mean changing the task,
 * comment, mention and notification write paths of the platform core, which production depends on, for hints that
 * are refetch triggers carrying no data: a lost one costs a subscriber the instant refresh of one record (its next
 * read, a focus refetch or a reconnect still shows the change), never the write. A TypeORM entity subscriber would
 * join `save` transactions but not the `update`/`delete` statements most of these writes are, and the coalesced
 * trailing hint is appended after its window by design. So the loss window — a crash between the commit and the
 * append, or an append that fails (logged) — stays, for these hints only; the chat plugin, whose writes run in
 * transactions of its own, appends its facts inside them (`ChatRealtime.append`).
 */
@Injectable()
export class RealtimeHintsService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('RealtimeHintsService');
	private readonly subscriptions: Subscription[] = [];
	private readonly recent = new Map<string, number>();
	private readonly trailing = new Map<string, { input: IRealtimeHintInput; timer: NodeJS.Timeout }>();
	private readonly userOfEmployee = new Map<string, { userId: ID | null; at: number }>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly moduleRef: ModuleRef
	) {}

	onModuleInit(): void {
		const bus = this.find(EventBus);
		if (!bus) {
			return;
		}
		this.subscriptions.push(bus.ofType(TaskEvent).subscribe((event) => void this.onTaskEvent(event)));
		this.subscriptions.push(bus.ofType(DocumentEvent).subscribe((event) => void this.onDocumentEvent(event)));
	}

	onModuleDestroy(): void {
		for (const subscription of this.subscriptions.splice(0)) {
			subscription.unsubscribe();
		}
		for (const [key, pending] of this.trailing) {
			clearTimeout(pending.timer);
			this.trailing.delete(key);
		}
	}

	/** A task was created, updated or deleted. */
	async onTaskEvent(event: TaskEvent): Promise<void> {
		await this.appendHint(taskHint(event.entity, event.type, this.actor()));
	}

	/** A document was created, updated or deleted (any phase). */
	async onDocumentEvent(event: DocumentEvent): Promise<void> {
		await this.appendHint(documentHint(event.entity, event.type, this.actor()));
	}

	/** A comment was created, updated or deleted. */
	async onCommentEvent(event: CommentEvent): Promise<void> {
		await this.appendHint(commentHint(event));
	}

	/** Someone was mentioned. */
	async onMention(input: IMentionCreateInput): Promise<void> {
		const recipient = await this.userIdOfEmployee(input?.mentionedEmployeeId, input?.tenantId);
		await this.appendHint(mentionHint(input, recipient, this.actor()));
	}

	/** A notification row exists for an employee (a request the receiver switched off never gets here). */
	async onNotification(notification: IEmployeeNotification): Promise<void> {
		const recipient = await this.userIdOfEmployee(notification?.receiverEmployeeId, notification?.tenantId);
		await this.appendHint(notificationHint(notification, recipient, this.actor()));
	}

	/**
	 * Appends one hint to the outbox. Never throws: a hint that cannot be filed is logged.
	 *
	 * Repeated `updated` hints of one aggregate inside the coalescing window are folded: the first is appended at
	 * once and the latest of the rest is appended when the window closes (trailing edge), so a burst of edits costs
	 * two rows and a subscriber that read again on the first still learns of the last.
	 *
	 * @param input The hint, or `null` for a fact that produces none.
	 * @returns True when a row was appended now.
	 */
	async appendHint(input: IRealtimeHintInput | null): Promise<boolean> {
		if (!input) {
			return false;
		}
		if (input.hint.action !== 'updated') {
			// A `deleted` (or `created`) hint must not be followed by an older `updated` one of the same aggregate.
			await this.flushTrailing(input);
		}
		if (input.hint.action === 'updated' && this.coalesced(input)) {
			return false;
		}
		return this.appendNow(input);
	}

	/** Appends now the pending trailing hints of the input's aggregate, so the outbox keeps the facts in order. */
	private async flushTrailing(input: IRealtimeHintInput): Promise<void> {
		for (const [key, pending] of this.trailing) {
			const sameAggregate =
				pending.input.tenantId === input.tenantId &&
				pending.input.aggregateType === input.aggregateType &&
				pending.input.aggregateId === input.aggregateId;
			if (!sameAggregate) continue;
			clearTimeout(pending.timer);
			this.trailing.delete(key);
			this.recent.set(key, Date.now());
			await this.appendNow(pending.input);
		}
	}

	private async appendNow(input: IRealtimeHintInput): Promise<boolean> {
		const outbox = this.find(EventOutboxService);
		if (!outbox) {
			this.recent.delete(coalesceKey(input));
			return false;
		}
		try {
			await outbox.append(this.dataSource.manager, {
				name: input.name,
				aggregateType: input.aggregateType,
				aggregateId: input.aggregateId,
				tenantId: input.tenantId,
				...(input.organizationId ? { organizationId: input.organizationId } : { tenantWide: true }),
				data: input.hint as unknown as Record<string, unknown>
			});
			return true;
		} catch (error) {
			this.recent.delete(coalesceKey(input));
			this.logger.warn(`${input.name} was not appended for ${input.aggregateId}: ${(error as Error)?.message}`);
			return false;
		}
	}

	/**
	 * Whether an identical hint was appended within the coalescing window. When it was, the latest input is kept
	 * and appended once the window closes, so the final state is never left unannounced.
	 */
	private coalesced(input: IRealtimeHintInput): boolean {
		const now = Date.now();
		const key = coalesceKey(input);
		const last = this.recent.get(key);
		if (last !== undefined && now - last < REALTIME_HINT_COALESCE_MS) {
			const pending = this.trailing.get(key);
			if (pending) {
				pending.input = input;
			} else {
				const timer = setTimeout(() => {
					const latest = this.trailing.get(key);
					this.trailing.delete(key);
					if (latest) {
						this.recent.set(key, Date.now());
						void this.appendNow(latest.input);
					}
				}, Math.max(1, REALTIME_HINT_COALESCE_MS - (now - last)));
				timer.unref?.();
				this.trailing.set(key, { input, timer });
			}
			return true;
		}
		this.recent.set(key, now);
		if (this.recent.size > 10_000) {
			for (const [entry, at] of this.recent) {
				if (now - at >= REALTIME_HINT_COALESCE_MS) this.recent.delete(entry);
			}
		}
		return false;
	}

	/** The user whose request is being handled, when there is one. */
	private actor(): ID | null {
		try {
			return RequestContext.currentUserId();
		} catch {
			return null;
		}
	}

	/** The user behind an employee, remembered for five minutes. */
	private async userIdOfEmployee(employeeId: ID | undefined, tenantId: ID | undefined): Promise<ID | null> {
		if (!employeeId) {
			return null;
		}
		const key = String(employeeId);
		const remembered = this.userOfEmployee.get(key);
		if (remembered && Date.now() - remembered.at < 5 * 60_000) {
			return remembered.userId;
		}
		const employees = this.find(EmployeeService);
		if (!employees) {
			return null;
		}
		try {
			const employee = await employees.findOneByOptions({
				where: { id: employeeId, ...(tenantId ? { tenantId } : {}) }
			} as never);
			const userId = (employee as { userId?: ID } | null)?.userId ?? null;
			this.userOfEmployee.set(key, { userId, at: Date.now() });
			return userId;
		} catch {
			return null;
		}
	}

	private find<T>(token: Type<T>): T | undefined {
		try {
			return this.moduleRef.get(token, { strict: false }) ?? undefined;
		} catch {
			return undefined;
		}
	}
}
