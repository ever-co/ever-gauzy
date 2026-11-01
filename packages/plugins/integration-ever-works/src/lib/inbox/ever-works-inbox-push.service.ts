import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
	Optional
} from '@nestjs/common';
import { DataSource, In, MoreThan } from 'typeorm';
import {
	ID,
	IInboxEmailHandoffs,
	IInboxItem,
	IInboxItemChange,
	IInboxItemFeed,
	IInboxItemObserver,
	IInboxItemRecipient,
	IInboxRecipientActions,
	INBOX_EMAIL_HANDOFFS,
	INBOX_ITEM_FEED,
	INBOX_RECIPIENT_ACTIONS,
	InboxItemSourceEnum,
	InboxItemStatusEnum,
	IntegrationEntity,
	isTaskSyncAllowed
} from '@gauzy/contracts';
import { Employee, Task } from '@gauzy/core';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import type {
	EverWorksEventEnvelope,
	EverWorksFiledInboxItem,
	EverWorksInboxItemCreate,
	EverWorksInboxItemPatch,
	EverWorksInboxWriteState
} from '../client/ever-works-client.types';
import { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EVER_WORKS_NOTICE_SOURCE } from '../connection/ever-works-notifier.service';
import { EverWorksConfig } from '../ever-works-config';
import { EVER_WORKS_CONFIG } from '../ever-works.tokens';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import { entitySynced } from '../mapping/ever-works-mapping.defaults';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import {
	EverWorksEntityLink,
	EverWorksLinkState,
	EverWorksLinkType,
	EverWorksOutboundChange,
	EverWorksOutboundStatus
} from '../sync/entities/ever-works-sync.entities';
import {
	everWorksUserOfGauzyUser,
	EverWorksNoRequestContextError,
	NO_REQUEST_CONTEXT_RETRY_MS,
	runAsGauzyUser
} from '../sync/ever-works-actor';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksSyncLogService } from '../sync/ever-works-sync-log.service';
import type { EverWorksSyncSweeper } from '../sync/ever-works-sync.loop';
import type { EverWorksApplyOutcome } from '../sync/inbound/ever-works-inbound.applier';
import { toEverWorks } from '../sync/initial/ever-works-sync-phases';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import { runDetached } from '../sync/outbound/ever-works-detached';
import type {
	EverWorksOutboundHandler,
	EverWorksPushContext,
	EverWorksPushOutcome
} from '../sync/outbound/ever-works-outbound.pusher';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';
import { everWorksKindOf, EverWorksInboxKind } from './ever-works-inbox-kinds';
import { EverWorksInboxPreferencesService } from './ever-works-inbox-preferences.service';
import {
	filedAnswerOf,
	filedAsShared,
	filedStateOf,
	GAUZY_INBOX_SOURCE_LABEL,
	gauzyInboxExternalId,
	GauzyInboxShared,
	goalOfItem,
	parseGauzyInboxExternalId,
	patchOf,
	sharedOf,
	sourceUrlOf,
	takesDecision,
	taskOfItem
} from './ever-works-inbox-push.mapper';

/**
 * The integration's own Inbox items, which never go to Ever Works: the Ever Works copies (inbox, agent mail), the
 * connection notices (a reconnect or a stopped change: sending a "stopped" notice through the sync that stopped
 * would loop) and the docs conflict notices the sync writes.
 */
const OWN_EXTERNAL_SOURCES: ReadonlyArray<string> = [
	'ever_works',
	'ever_works_email',
	EVER_WORKS_NOTICE_SOURCE,
	'ever_works:docs'
];

/** How often the recovery sweep looks for Inbox changes whose notice was missed, and how far back. */
export const GAUZY_INBOX_SWEEP_MS = 10 * 60_000;
export const GAUZY_INBOX_SWEEP_WINDOW_MS = 60 * 60_000;
/** Copy links one sweep checks for a gone recipient row, per mapping. */
export const GAUZY_INBOX_GONE_PAGE = 200;
/** Recipient rows one sweep reads at most per mapping. */
export const GAUZY_INBOX_SWEEP_LIMIT = 2_000;
/** A change this process cannot read the Inbox for waits this long (a process that hosts the Inbox takes it). */
export const GAUZY_INBOX_WAIT_MS = 15 * 60_000;
/** A copy that keeps moving in Ever Works (a second `412`) is pushed again after this long. */
export const GAUZY_INBOX_CONFLICT_RETRY_MS = 60_000;
/** A copy waits this long when Ever Works does not serve the inbox write (`404`): an Ever Works not updated yet. */
export const GAUZY_INBOX_UNSERVED_RETRY_MS = 6 * 60 * 60_000;
/** Recipient rows one backfill page reads. */
const BACKFILL_PAGE = 500;
/** Backfill pages the sync preview reads at most (100 000 recipient rows). */
const BACKFILL_PREVIEW_PAGES = 200;
/** Ids one `IN` list names at most. */
const IN_CHUNK = 500;

/** What Ever Works was last known to hold for a copy's own state (an event applies only what moved from it). */
interface EverWorksCopySide {
	state?: EverWorksInboxWriteState;
	unread?: boolean;
	/** Who answered the copy in Ever Works: Gauzy (its resolution), or the member there (whose answer then stands). */
	answeredBy?: 'gauzy' | 'member';
	/**
	 * The answer the copy held when last seen ({@link answerKeyOf}), `null` for none: a later event (a read) carries the
	 * same answer again, which is applied once, never to a Gauzy item its source reopened since.
	 */
	answer?: string | null;
}

/** An answer as a comparable key (its choice and text), or `null` for none. */
function answerKeyOf(answer: { optionId?: string; text?: string } | null): string | null {
	return answer ? JSON.stringify([answer.optionId ?? null, answer.text ?? null]) : null;
}

/** The answer key Ever Works holds after `data`: its answer, none when it names its answer fields empty, else `seen`'s. */
function answerSeenAfter(data: Partial<EverWorksFiledInboxItem>, seen: EverWorksCopySide): string | null {
	const answer = filedAnswerOf(data);
	if (answer) return answerKeyOf(answer);
	const named = data.resolution !== undefined || data.answerOptionId !== undefined || data.answerText !== undefined;
	return named ? null : (seen.answer ?? null);
}

/**
 * A patch without Gauzy's own answer when the member answered the copy in Ever Works: that answer stands (Ever Works
 * refuses to let an integration overwrite it, CR-15); the rest of the patch (title, body, an archive) still goes.
 */
function keepingTheMembersAnswer(
	patch: EverWorksInboxItemPatch | null,
	seen: EverWorksCopySide
): EverWorksInboxItemPatch | null {
	if (!patch || seen.answeredBy !== 'member') return patch;
	const kept: EverWorksInboxItemPatch = { ...patch };
	delete kept.resolution;
	// A move to `resolved` is Gauzy's answer, which the member's stands over; out of an archive it only brings the copy
	// back as the member left it (answered), so that move still goes, without a resolution.
	if (kept.state === 'resolved' && seen.state !== 'archived') delete kept.state;
	return Object.keys(kept).length ? kept : null;
}

/** The stored snapshot of a mirrored copy: what Gauzy last sent (`g`), and Ever Works' own state as last seen (`e`). */
interface GauzyInboxSnapshot {
	g?: Partial<GauzyInboxShared>;
	e?: EverWorksCopySide;
}

/** What one person's copy is, read for a push or an inbound change. */
interface CopyOf {
	item: IInboxItem;
	recipient: IInboxItemRecipient;
	kind: EverWorksInboxKind;
}

/**
 * The Gauzy Inbox → Ever Works mirror (owner decision 2026-10-29): Gauzy's own Inbox items (questions, approvals,
 * escalations, notices, emails…) reach the Ever Works inbox of the paired person, and what that person does there
 * (a reply, a decision, read, archive) comes back to the Gauzy item.
 *
 * - **Capture:** an observer of the Gauzy Inbox (`INBOX_ITEM_FEED`) queues one outbound change per paired recipient
 *   (`GAUZY_INBOX_ITEM`, the recipient row), coalesced, retried and dead-lettered by the outbound queue; a recovery
 *   sweep queues a change whose notice was missed. Read and snooze changes are not queued (Ever Works keeps no such
 *   state for a filed item).
 * - **Guards** (each checked again by the push, which recomputes the copy): the item is not Ever Works' own
 *   (`source = EVER_WORKS`, loop guard) nor one of the integration's own notices; the recipient is paired with an Ever
 *   Works member; the mapping's inbox direction writes to Ever Works and its `InboxItem` sync setting is on; the
 *   person's preference sends the item's kind; a task-related item's task may sync (`syncScope`).
 * - **Push:** `POST /inbox/items` with `externalId = <item id>:<recipient row id>` (a replay answers the item filed
 *   before), then `PATCH /inbox/items/:id` with `If-Match` for title, body, choices, resolved and archived. The link
 *   keeps the version and what Gauzy last sent; a field is patched only when Gauzy moved away from it.
 * - **Inbound:** `inbox.item.*` of a copy (an Ever Works user replied, decided, read or archived it) is applied to the
 *   Gauzy item through the Inbox's own reply and state actions, as the recipient; versions only go up.
 */
@Injectable()
export class EverWorksInboxPushService
	implements EverWorksOutboundHandler, EverWorksSyncSweeper, OnModuleInit, OnModuleDestroy
{
	readonly entityTypes = [EverWorksLinkType.GAUZY_INBOX_ITEM];
	readonly sweepIntervalMs = GAUZY_INBOX_SWEEP_MS;
	private readonly logger = new Logger('EverWorksInboxPush');

	/** Per mapping, the last copy link the sweep of gone recipient rows checked (it walks every link, a page a sweep). */
	private readonly goneCursors = new Map<string, string>();

	/** Per mapping, where a sweep that read its limit stopped (its window and the last recipient row read). */
	private readonly sweepCursors = new Map<string, { since: Date; after: string }>();

	readonly observer: IInboxItemObserver = {
		id: 'ever-works-inbox-push',
		changed: (change) => this.changed(change)
	};

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService,
		private readonly queue: EverWorksOutboundQueue,
		private readonly log: EverWorksSyncLogService,
		private readonly preferences: EverWorksInboxPreferencesService,
		@Optional() @Inject(EVER_WORKS_CONFIG) private readonly config?: EverWorksConfig | null,
		@Optional() @Inject(INBOX_ITEM_FEED) private readonly feed?: IInboxItemFeed | null,
		@Optional() @Inject(INBOX_RECIPIENT_ACTIONS) private readonly actions?: IInboxRecipientActions | null,
		@Optional() @Inject(INBOX_EMAIL_HANDOFFS) private readonly handoffs?: IInboxEmailHandoffs | null
	) {}

	onModuleInit(): void {
		if (!this.feed) return;
		try {
			this.feed.register(this.observer);
		} catch (error) {
			this.logger.warn(`The Gauzy Inbox observer was not registered (${(error as Error)?.message ?? 'error'}).`);
		}
	}

	onModuleDestroy(): void {
		this.feed?.unregister(this.observer.id);
	}

	// ── Capture ────────────────────────────────────────────────────────────────────────────────────

	/**
	 * The Inbox wrote something. Read synchronously, in the writer's own context: what the sync itself writes (loop
	 * guard 1), Ever Works' own items (loop guard: they came from there) and read / snooze changes are dropped here;
	 * the rest is queued outside the write's transaction.
	 */
	changed(change: IInboxItemChange): void {
		if (EverWorksSyncContext.isApplying()) {
			// What the sync writes is not sent back (loop guard 1), except an Ever Works member's move on their own copy
			// that changed the shared item (an answer): the copies of the item's other recipients still get it.
			const applied = EverWorksSyncContext.current()?.gauzyRecipientId;
			if (!applied || change.scope !== 'item') return;
			change = {
				...change,
				recipients: (change.recipients ?? []).filter((recipient) => recipient.id !== applied),
				removedRecipients: (change.removedRecipients ?? []).filter((recipient) => recipient.id !== applied)
			};
		}
		if (change.source === InboxItemSourceEnum.EVER_WORKS) return;
		if (change.externalSource && OWN_EXTERNAL_SOURCES.includes(change.externalSource)) return;
		if (change.scope === 'recipient' && !(change.stated ?? []).includes('isArchived')) return;
		if (!change.organizationId || !(change.recipients?.length || change.removedRecipients?.length)) return;
		void runDetached(() => this.capture(change)).catch((error) =>
			this.logger.warn(
				`Inbox item ${change.inboxItemId}: the change could not be queued (${error instanceof Error ? error.name : 'error'}).`
			)
		);
	}

	/** Queues one change per paired recipient of a mapped organization whose inbox direction writes to Ever Works. */
	async capture(change: IInboxItemChange): Promise<number> {
		const context = await this.contexts.forOrganization(change.tenantId, change.organizationId as ID);
		if (!context || !context.isEnabled || !toEverWorks(context.directions.inbox)) return 0;
		// A recipient the write removed is queued too: its copy is archived in Ever Works (its row is gone in Gauzy).
		const recipients = [...(change.recipients ?? []), ...(change.removedRecipients ?? [])];
		const paired = await this.pairedUserIds(
			context,
			recipients.map((recipient) => recipient.userId)
		);
		let queued = 0;
		for (const recipient of recipients) {
			if (!paired.has(recipient.userId)) continue;
			const done = await this.queue.enqueue({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
				gauzyId: recipient.id,
				changedFields: [change.scope],
				actorUserId: change.actorUserId ?? null
			});
			if (done) queued++;
		}
		return queued;
	}

	/**
	 * The recovery sweep (every {@link GAUZY_INBOX_SWEEP_MS}, under the connection's lease): a paired person's copy whose
	 * item or archive changed in the last {@link GAUZY_INBOX_SWEEP_WINDOW_MS} and that no outbound change settled since —
	 * its notice was missed (a restart between the write and the queue) — is queued now. A copy never sent is queued
	 * only for a change of the item itself, never for its recipient's state alone.
	 */
	async sweep(connection: EverWorksConnection, stillOwner?: () => Promise<boolean>): Promise<void> {
		if (!this.feed) return;
		const contexts = (await this.contexts.forConnection(connection)).filter(
			(context) => context.isEnabled && toEverWorks(context.directions.inbox)
		);
		for (const context of contexts) {
			// A window too big for one sweep is carried on by the next one from where this one stopped (same window), so
			// every row of a burst is visited before it leaves the window.
			const saved = this.sweepCursors.get(context.integrationTenantId);
			const since = saved?.since ?? new Date(Date.now() - GAUZY_INBOX_SWEEP_WINDOW_MS);
			let after: string | null = saved?.after ?? null;
			let read = 0;
			do {
				if (stillOwner && !(await stillOwner())) return;
				const page = await this.feed.recipientsChangedSince(context.tenantId, since, {
					organizationId: context.organizationId,
					after,
					limit: 500
				});
				read += page.recipients.length;
				const rows = page.recipients.filter((row) => row.source !== InboxItemSourceEnum.EVER_WORKS);
				const paired = await this.pairedUserIds(
					context,
					rows.map((row) => row.userId)
				);
				const candidates = rows.filter((row) => paired.has(row.userId));
				const settled = await this.lastChanges(
					context,
					candidates.map((row) => row.id)
				);
				const linked = await this.linkedIds(
					context,
					candidates.map((row) => row.id)
				);
				// An item never sent is filed only for a change after the inbox started going to Ever Works (else the sweep
				// would quietly backfill the hour before it, which only the backfill setting may do).
				const pushSince = this.pushSinceOf(context);
				for (const row of candidates) {
					const last = settled.get(row.id);
					if (last?.open) continue; // queued already
					const changedAt = row.changedAt ? new Date(row.changedAt).getTime() : Number.NaN;
					if (last && Number.isFinite(changedAt) && last.at >= changedAt) continue; // pushed after the change
					const itemChanged = row.itemUpdatedAt
						? new Date(row.itemUpdatedAt).getTime() >= since.getTime()
						: false;
					if (!linked.has(row.id) && !itemChanged) continue; // only its read / archive moved: never sent, nothing to send
					const itemAt = row.itemUpdatedAt ? new Date(row.itemUpdatedAt).getTime() : Number.NaN;
					if (!linked.has(row.id) && !(pushSince !== null && itemAt >= pushSince)) continue;
					await this.queue.enqueue({
						tenantId: context.tenantId,
						organizationId: context.organizationId,
						entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
						gauzyId: row.id,
						changedFields: ['sweep']
					});
				}
				after = page.next;
			} while (after && read < GAUZY_INBOX_SWEEP_LIMIT);
			if (after) this.sweepCursors.set(context.integrationTenantId, { since, after });
			else this.sweepCursors.delete(context.integrationTenantId);
			if (stillOwner && !(await stillOwner())) return;
			await this.sweepGone(context);
		}
	}

	/**
	 * Copies whose Gauzy recipient row is gone without a notice (a source that replaced its recipients, a notice lost on
	 * the way): a page of {@link GAUZY_INBOX_GONE_PAGE} links a sweep, in link order, each one whose row is gone queued
	 * (its push archives the copy). An archived copy is left alone.
	 */
	private async sweepGone(context: EverWorksMappingContext): Promise<void> {
		if (!this.feed) return;
		const after = this.goneCursors.get(context.integrationTenantId) ?? null;
		const links = await this.dataSource.getRepository(EverWorksEntityLink).find({
			where: {
				integrationTenantId: context.integrationTenantId,
				entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
				state: EverWorksLinkState.OK,
				...(after ? { id: MoreThan(after) } : {})
			} as never,
			order: { id: 'ASC' } as never,
			take: GAUZY_INBOX_GONE_PAGE
		});
		if (links.length < GAUZY_INBOX_GONE_PAGE) this.goneCursors.delete(context.integrationTenantId);
		else this.goneCursors.set(context.integrationTenantId, links[links.length - 1].id as string);
		const live = links.filter((link) => this.snapshotOf(link).state !== 'archived');
		if (!live.length) return;
		const gone = new Set(
			await this.feed.missingRecipients(
				context.tenantId,
				live.map((link) => link.gauzyId as ID)
			)
		);
		const open = await this.lastChanges(context, [...gone]);
		for (const recipientId of gone) {
			if (open.get(recipientId)?.open) continue;
			await this.queue.enqueue({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
				gauzyId: recipientId,
				changedFields: ['gone']
			});
		}
	}

	// ── Push (G → EW) ──────────────────────────────────────────────────────────────────────────────

	async push(change: EverWorksOutboundChange, pushContext: EverWorksPushContext): Promise<EverWorksPushOutcome> {
		const context = await this.contexts.forOrganization(change.tenantId as ID, change.organizationId as ID);
		if (!context || context.integrationTenantId !== pushContext.mapping.id)
			return { status: 'skipped', message: 'no mapping for the organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!entitySynced(context, IntegrationEntity.INBOX_ITEM))
			return { status: 'skipped', message: 'the InboxItem sync setting is off' };
		if (!toEverWorks(context.directions.inbox))
			return { status: 'skipped', message: 'Gauzy Inbox items are not sent to Ever Works (inbox direction)' };
		if (!this.feed) {
			return process.env['GAUZY_INBOX_ENABLED'] === 'true'
				? {
						status: 'deferred',
						message: 'the Gauzy Inbox is not loaded in this process',
						retryInMs: GAUZY_INBOX_WAIT_MS
					}
				: { status: 'skipped', message: 'the Gauzy Inbox is off (GAUZY_INBOX_ENABLED)' };
		}
		const recipientId = change.gauzyId as ID;
		const link = await this.links.byGauzy(
			context.integrationTenantId,
			EverWorksLinkType.GAUZY_INBOX_ITEM,
			recipientId
		);
		if (link?.state === EverWorksLinkState.UNLINKED)
			return { status: 'skipped', message: 'the Ever Works copy is no longer synced' };
		const observed = await this.feed.readRecipient(context.tenantId, recipientId);
		if (!observed) {
			// The item, or this person's copy of it, is gone in Gauzy: the Ever Works copy is archived (nothing is deleted).
			if (!link) return { status: 'skipped', message: 'the Inbox item is gone' };
			return this.patchCopy(
				context,
				link,
				{ ...this.snapshotOf(link), state: 'archived' } as GauzyInboxShared,
				null
			);
		}
		const refused = await this.refusal(context, observed.item, observed.recipient);
		if (refused) return { status: 'skipped', message: refused.message };
		const copy: CopyOf = { ...observed, kind: this.kindOf(observed.item) };
		const ewUserId = await everWorksUserOfGauzyUser(
			this.dataSource,
			this.links,
			context,
			observed.recipient.userId as ID
		);
		if (!ewUserId) return { status: 'skipped', message: 'the recipient is not paired with an Ever Works member' };
		if (!(await this.preferences.allows(context.tenantId, observed.recipient.userId as ID, copy.kind))) {
			return { status: 'skipped', message: `the recipient keeps ${copy.kind} items out of Ever Works` };
		}
		const now = sharedOf(copy.item, copy.recipient, copy.kind);
		if (!link) {
			if (now.state === 'archived')
				return { status: 'skipped', message: 'archived before it reached Ever Works' };
			return this.createCopy(context, copy, now, ewUserId);
		}
		// The person was paired with another Ever Works member since the copy was filed: the copy stays with the member it
		// was filed for and gets nothing more (a new filing would replay the same externalId and answer that copy).
		const filedFor = this.ewOnlyOf(link).recipientUserId;
		if (filedFor && filedFor !== ewUserId) {
			return {
				status: 'skipped',
				message: 'the recipient is paired with another Ever Works member than the one the copy was filed for'
			};
		}
		return this.patchCopy(context, link, now, copy);
	}

	/**
	 * Why a copy is not sent, or `null`: Ever Works' own items (loop guard), the integration's own notices, an item of
	 * another organization, and a task-related item whose task may not sync (`syncScope`).
	 */
	private async refusal(
		context: EverWorksMappingContext,
		item: IInboxItem,
		recipient: IInboxItemRecipient
	): Promise<{ message: string } | null> {
		if (item.source === InboxItemSourceEnum.EVER_WORKS)
			return { message: 'an Ever Works item is never sent back to Ever Works' };
		if (item.externalSource && OWN_EXTERNAL_SOURCES.includes(item.externalSource))
			return { message: "the integration's own notice" };
		if (item.organizationId !== context.organizationId || recipient.tenantId !== context.tenantId)
			return { message: 'an item of another organization' };
		const taskId = taskOfItem(item);
		if (taskId) {
			const task = await this.dataSource.getRepository(Task).findOne({
				where: { id: taskId, tenantId: context.tenantId } as never,
				select: { id: true, syncScope: true } as never
			});
			if (task && !isTaskSyncAllowed(task as never, 'ever-platform'))
				return { message: 'the task is kept out of every integration (its sync scope is none)' };
		}
		return null;
	}

	private kindOf(item: IInboxItem): EverWorksInboxKind {
		return everWorksKindOf(item.kind, item.metadata ?? null);
	}

	/** Files a copy: `POST /inbox/items` (a replay answers the copy filed before), then whatever it still lacks. */
	private async createCopy(
		context: EverWorksMappingContext,
		copy: CopyOf,
		now: GauzyInboxShared,
		ewUserId: string
	): Promise<EverWorksPushOutcome> {
		const externalId = gauzyInboxExternalId(copy.item.id as string, copy.recipient.id as string);
		const sourceUrl = this.sourceUrl(copy.item);
		const body: EverWorksInboxItemCreate = {
			externalId,
			recipientUserId: ewUserId,
			kind: copy.kind,
			title: now.title,
			body: now.body,
			sourceLabel: GAUZY_INBOX_SOURCE_LABEL,
			...(sourceUrl ? { sourceUrl } : {}),
			...(await this.relatedOf(context, copy.item)),
			...(copy.kind === 'email' ? await this.emailOf(context, copy.item) : {}),
			...(now.choices ? { choices: now.choices } : {}),
			...(copy.item.createdAt ? { occurredAt: new Date(copy.item.createdAt).toISOString() } : {})
		};
		const client = this.client(context);
		let filed: EverWorksFiledInboxItem;
		try {
			// No Idempotency-Key of our own: `externalId` is the permanent de-duplication, and its replay answers the copy as
			// it is now (a key's replay would answer the first response, however old).
			filed = await client.request<EverWorksFiledInboxItem>('POST', '/inbox/items', { body });
		} catch (error) {
			// An Ever Works that does not serve the inbox write yet (released before it): the copy waits, nothing is lost and
			// no dead letter is raised for every item; it goes once Ever Works serves the route.
			if (error instanceof EverWorksApiError && error.status === 404) {
				return {
					status: 'deferred',
					message: 'Ever Works does not serve POST /inbox/items yet (404); retried later',
					retryInMs: GAUZY_INBOX_UNSERVED_RETRY_MS
				};
			}
			throw error;
		}
		if (!filed?.id)
			throw new EverWorksApiError(502, 'invalid_response', 'Ever Works filed the inbox item without an id.');
		// What Ever Works holds. A fresh copy is open and unread; a replay answers the copy filed before, which its person
		// may have answered, archived or read since: those are applied to Gauzy first (never undone by the patch below).
		const held = filedAsShared(filed, now);
		// A replay of a copy filed for another member (the person was paired with someone else since its link was lost):
		// that copy stays the other member's. It is recorded as filed for them, so no push patches it and no event of
		// theirs is applied to this person's item; nothing of it is applied now either.
		const filedFor =
			typeof filed.recipientUserId === 'string' && filed.recipientUserId ? filed.recipientUserId : null;
		if (filedFor && filedFor !== ewUserId) {
			const answer = filedAnswerOf(filed);
			await this.record(
				context,
				copy,
				filed,
				held,
				{ ...this.sideAfter(filed, {}), ...(answer ? { answeredBy: 'member' as const } : {}) },
				filedFor,
				externalId
			);
			return {
				status: 'skipped',
				message:
					'the copy was filed for another Ever Works member than the one the recipient is paired with now'
			};
		}
		const filedAs: Partial<GauzyInboxShared> = { ...held, state: 'open', resolution: null };
		let moves: { done: string[]; e: EverWorksCopySide };
		try {
			moves = await this.applyMoves(
				context,
				copy,
				filed,
				{ state: 'open', unread: true },
				`inbox-file:${filed.id}`
			);
		} catch (error) {
			if (error instanceof EverWorksNoRequestContextError)
				return { status: 'deferred', message: error.message, retryInMs: NO_REQUEST_CONTEXT_RETRY_MS };
			throw error;
		}
		const g = await this.settled(context, copy, filedAs, moves.done);
		const link = await this.record(context, copy, filed, g, moves.e, ewUserId, externalId);
		await this.log.write({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			connectionId: context.connection.id as ID,
			direction: 'outbound',
			entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
			gauzyId: copy.recipient.id as ID,
			ewId: filed.id,
			action: 'inbox_item_filed',
			status: 'ok',
			message: `${copy.kind} "${now.title.slice(0, 80)}" filed in the Ever Works inbox of the paired member`
		});
		// An item answered or archived in Gauzy before it went out, or a replayed copy behind Gauzy: brought up to date.
		const current = moves.done.length ? await this.reread(context, copy) : copy;
		const after = sharedOf(current.item, current.recipient, current.kind);
		if (patchOf(after, g)) return this.patchCopy(context, link, after, current);
		return { status: 'pushed', message: 'filed in Ever Works' };
	}

	/**
	 * Patches a copy with what changed since Gauzy last sent it (`If-Match` the link's version; Ever Works refuses a
	 * PATCH without it). Gauzy never sends its own answer over one the member gave in Ever Works (that answer stands).
	 * A `412` means the member acted on the copy meanwhile (an answer, a read, an archive): the copy is read again, what
	 * the member did is applied to Gauzy first, and only then is Gauzy's own change sent, once, on the current version
	 * (contract v1-draft.17 CR-15). What every answer shows the member did is applied to Gauzy before its version is
	 * recorded, so the event of that change, at or below the recorded version, is not needed any more.
	 */
	private async patchCopy(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink,
		now: GauzyInboxShared,
		copy: CopyOf | null,
		refetched = false
	): Promise<EverWorksPushOutcome> {
		const before = this.snapshotOf(link);
		const seen = this.everWorksSideOf(link);
		const patch = keepingTheMembersAnswer(patchOf(now, before), seen);
		if (!patch) return { status: 'skipped', message: 'nothing changed since the last push' };
		const client = this.client(context);
		const version = link.ewVersion ?? (await this.currentVersion(client, link.ewId));
		if (version === null) {
			return {
				status: 'deferred',
				message: 'the version of the Ever Works copy is unknown',
				retryInMs: GAUZY_INBOX_CONFLICT_RETRY_MS
			};
		}
		let answered: EverWorksFiledInboxItem | undefined;
		try {
			answered = await client.request<EverWorksFiledInboxItem>(
				'PATCH',
				`/inbox/items/${encodeURIComponent(link.ewId)}`,
				{
					body: patch,
					ifMatchVersion: version
				}
			);
		} catch (error) {
			if (error instanceof EverWorksApiError && error.status === 404) {
				// Deleted in Ever Works (a hard delete): the link stays as a tombstone, so the item is never filed again.
				await this.links.unlink(link, 'the Ever Works copy is gone');
				return { status: 'skipped', message: 'the Ever Works copy is gone' };
			}
			if (error instanceof EverWorksApiError && error.status === 412) {
				// Read again and sent once more on the current version: with the member's moves applied first, or, when the
				// Gauzy row is gone (an archive), on that version alone (else the stale If-Match would fail every retry).
				if (!refetched) {
					// A key that writes the inbox but cannot read it (no `inbox:read`) does not read the copy again: it sends once
					// more on the version the 412 names (`details.current`); such a key sees none of the member's moves anyway.
					if (!this.scopesOf(context).has('inbox:read'))
						return this.retryOnNamedVersion(context, link, now, copy, error);
					return this.afterConflict(context, link, copy, now);
				}
				return {
					status: 'deferred',
					message: 'the Ever Works copy keeps moving; retried later',
					retryInMs: GAUZY_INBOX_CONFLICT_RETRY_MS
				};
			}
			throw error;
		}
		// The item as Ever Works answers the PATCH (an empty answer tells nothing new of its side).
		const updated: Partial<EverWorksFiledInboxItem> = answered ?? {};
		// What this patch set itself is not a move of the member's.
		const sentAnswer = patch.resolution
			? answerKeyOf({
					...(patch.resolution.choiceId ? { optionId: patch.resolution.choiceId } : {}),
					...(patch.resolution.text ? { text: patch.resolution.text } : {})
				})
			: undefined;
		const expected: EverWorksCopySide = {
			state: patch.state ?? seen.state,
			unread: seen.unread,
			answeredBy: patch.resolution || patch.state === 'resolved' ? 'gauzy' : seen.answeredBy,
			answer: sentAnswer !== undefined ? sentAnswer : seen.answer
		};
		let moves: { done: string[]; e: EverWorksCopySide };
		if (copy) {
			try {
				moves = await this.applyMoves(
					context,
					copy,
					updated,
					expected,
					`inbox-patch:${link.ewId}:${updated.version ?? version}`
				);
			} catch (error) {
				// Not recorded: the retry patches again and applies the member's change then.
				if (error instanceof EverWorksNoRequestContextError)
					return { status: 'deferred', message: error.message, retryInMs: NO_REQUEST_CONTEXT_RETRY_MS };
				throw error;
			}
		} else {
			moves = { done: [], e: this.sideAfter(updated, expected) };
		}
		const sent = copy
			? await this.settled(context, copy, { ...before, ...now }, moves.done)
			: { ...before, ...now };
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
			gauzyId: link.gauzyId as ID,
			ewId: link.ewId,
			ewVersion: typeof updated.version === 'number' ? updated.version : version,
			ewUpdatedAt: updated.updatedAt ?? null,
			gauzyUpdatedAt: copy?.item.updatedAt ? new Date(copy.item.updatedAt) : undefined,
			snapshot: { g: sent, e: moves.e },
			direction: 'outbound'
		});
		return { status: 'pushed', message: `patched in Ever Works (${Object.keys(patch).join(', ')})` };
	}

	/**
	 * A `412`: the copy is read again (`GET /inbox/items/:id`), what the member did since it was last seen is applied to
	 * Gauzy and recorded with the current version, and Gauzy's own change is sent once more on that version. A copy whose
	 * Gauzy row is gone (`copy` is `null`: its archive) has nothing to apply: `now` is sent on the current version.
	 */
	private async afterConflict(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink,
		copy: CopyOf | null,
		now: GauzyInboxShared
	): Promise<EverWorksPushOutcome> {
		let fetched: Partial<EverWorksFiledInboxItem>;
		try {
			fetched =
				(await this.client(context).request<EverWorksFiledInboxItem>(
					'GET',
					`/inbox/items/${encodeURIComponent(link.ewId)}`
				)) ?? {};
		} catch (error) {
			if (error instanceof EverWorksApiError && error.status === 404) {
				await this.links.unlink(link, 'the Ever Works copy is gone');
				return { status: 'skipped', message: 'the Ever Works copy is gone' };
			}
			throw error;
		}
		if (typeof fetched.version !== 'number') {
			return {
				status: 'deferred',
				message: 'the version of the Ever Works copy is unknown',
				retryInMs: GAUZY_INBOX_CONFLICT_RETRY_MS
			};
		}
		const seen = this.everWorksSideOf(link);
		let moves: { done: string[]; e: EverWorksCopySide } = { done: [], e: this.sideAfter(fetched, seen) };
		if (copy) {
			try {
				moves = await this.applyMoves(
					context,
					copy,
					fetched,
					seen,
					`inbox-412:${link.ewId}:${fetched.version}`
				);
			} catch (error) {
				if (error instanceof EverWorksNoRequestContextError)
					return { status: 'deferred', message: error.message, retryInMs: NO_REQUEST_CONTEXT_RETRY_MS };
				throw error;
			}
		}
		const g = copy ? await this.settled(context, copy, this.snapshotOf(link), moves.done) : this.snapshotOf(link);
		const recorded = await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
			gauzyId: link.gauzyId as ID,
			ewId: link.ewId,
			ewVersion: fetched.version,
			ewUpdatedAt: fetched.updatedAt ?? null,
			snapshot: { g, e: moves.e },
			direction: 'inbound'
		});
		if (!copy) return this.patchCopy(context, recorded, now, null, true);
		const current = await this.reread(context, copy);
		return this.patchCopy(
			context,
			recorded,
			sharedOf(current.item, current.recipient, current.kind),
			current,
			true
		);
	}

	/**
	 * A `412` for a key without `inbox:read`: the version the error names (`details.current`) is recorded and the change
	 * is sent once more on it; without one, the change waits and is tried again.
	 */
	private async retryOnNamedVersion(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink,
		now: GauzyInboxShared,
		copy: CopyOf | null,
		error: EverWorksApiError
	): Promise<EverWorksPushOutcome> {
		const current = error.details?.['current'];
		if (typeof current !== 'number' || (link.ewVersion != null && current <= link.ewVersion)) {
			return {
				status: 'deferred',
				message: 'the Ever Works copy moved, and this key cannot read its version (inbox:read); retried later',
				retryInMs: GAUZY_INBOX_CONFLICT_RETRY_MS
			};
		}
		const recorded = await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
			gauzyId: link.gauzyId as ID,
			ewId: link.ewId,
			ewVersion: current,
			snapshot: { g: this.snapshotOf(link), e: this.everWorksSideOf(link) },
			direction: 'inbound'
		});
		return this.patchCopy(context, recorded, now, copy, true);
	}

	/** Ever Works' side of a copy as an answer of Ever Works shows it (`fallback` for what it leaves out). */
	private sideAfter(item: Partial<EverWorksFiledInboxItem>, fallback: EverWorksCopySide): EverWorksCopySide {
		return {
			state: filedStateOf(item) ?? fallback.state,
			unread: typeof item.unread === 'boolean' ? item.unread : fallback.unread,
			answeredBy: fallback.answeredBy,
			answer: answerSeenAfter(item, fallback)
		};
	}

	/**
	 * Applies to the Gauzy item what Ever Works moved since `seen` — the person's answer, archive (or unarchive), read
	 * (or unread) — through the Inbox's own actions, signed in as the recipient, as the sync (so it is not captured
	 * back). An answer goes only to an open decision; one Gauzy answered first keeps Gauzy's answer. Returns what was
	 * done and Ever Works' side as it is now.
	 */
	private async applyMoves(
		context: EverWorksMappingContext,
		observed: { item: IInboxItem; recipient: IInboxItemRecipient },
		data: Partial<EverWorksFiledInboxItem>,
		seen: EverWorksCopySide,
		eventId: string
	): Promise<{ done: string[]; e: EverWorksCopySide }> {
		const { item, recipient } = observed;
		const answer = filedAnswerOf(data);
		// Only an answer Ever Works did not hold when last seen is the member's move: an event of a later read carries the
		// answer applied before, which must not answer the item again (its source may have reopened it since).
		const answerMoved = !!answer && answerKeyOf(answer) !== (seen.answer ?? null);
		const state = filedStateOf(data);
		// The archive flag moved in Ever Works (not merely its state: an answer turns an open copy resolved, which says
		// nothing about the archive a person made in Gauzy meanwhile).
		const archivedNow = state === 'archived';
		const archiveMoved = state !== null && archivedNow !== (seen.state === 'archived');
		const unreadMoved = typeof data.unread === 'boolean' && data.unread !== seen.unread;
		// An answer (or a copy marked resolved) Gauzy did not send is the member's.
		const memberAnswered =
			(!!answer || state === 'resolved') && seen.state !== 'resolved' && seen.answeredBy !== 'gauzy';
		const e: EverWorksCopySide = {
			state: state ?? seen.state,
			unread: typeof data.unread === 'boolean' ? data.unread : seen.unread,
			answeredBy: memberAnswered ? 'member' : seen.answeredBy,
			answer: answerSeenAfter(data, seen)
		};
		const done: string[] = [];
		const actions = this.actions;
		const answers = answerMoved && takesDecision(item.kind) && item.status === InboxItemStatusEnum.OPEN;
		const archives = archiveMoved && archivedNow !== !!recipient.isArchived;
		const reads = unreadMoved && data.unread === !!recipient.isRead;
		if (!actions || !(answers || archives || reads)) return { done, e };
		await EverWorksSyncContext.run(
			{
				connectionId: context.connection.id as string,
				integrationTenantId: context.integrationTenantId,
				eventId,
				gauzyRecipientId: recipient.id as string
			},
			() =>
				runAsGauzyUser(context, recipient.userId as ID, async () => {
					if (answers) {
						try {
							await actions.reply(item.id as ID, answer as { optionId?: string; text?: string });
							done.push('reply');
						} catch (error) {
							// Answered in Gauzy first (a conflict): Gauzy's answer stays. An answer Gauzy refuses (an option it does
							// not list, no reason where the item asks for one) is not acknowledged: the item stays open in Gauzy,
							// and the next event of the copy tries the member's answer again (one given with a reason then goes).
							if (!(error instanceof ConflictException || error instanceof BadRequestException))
								throw error;
							if (error instanceof BadRequestException) e.answer = seen.answer ?? null;
							this.logger.warn(
								`Inbox item ${item.id}: the answer given in Ever Works was not applied (${error.message}).`
							);
						}
					}
					if (archives) {
						await actions.setState(item.id as ID, { isArchived: state === 'archived' });
						done.push(state === 'archived' ? 'archive' : 'unarchive');
					}
					// A reply marks the item read already.
					if (reads && !done.includes('reply')) {
						await actions.setState(item.id as ID, { isRead: !data.unread });
						done.push(data.unread ? 'unread' : 'read');
					}
				})
		);
		return { done, e };
	}

	/**
	 * The snapshot after applying the person's moves, field by field, so applying one never acknowledges a Gauzy change
	 * of another that is still waiting to be pushed:
	 *
	 * - an answer applied: the answer is Ever Works' own now (`resolution` = what Gauzy recorded), resolved unless archived;
	 * - an archive applied: `archived` (the answer Gauzy last sent stays as it was);
	 * - an unarchive applied: what Ever Works shows again, resolved when it holds an answer (one Gauzy sent, or the one
	 *   just applied), else open; a Gauzy answer not sent yet still differs, and goes with the next push.
	 *
	 * Anything else (a read, a state Gauzy cannot hold such as a notice marked done) leaves the snapshot as Gauzy last sent
	 * it. Title, body and choices are never touched here.
	 */
	private async settled(
		context: EverWorksMappingContext,
		copy: Pick<CopyOf, 'item' | 'recipient'>,
		before: Partial<GauzyInboxShared>,
		done: string[]
	): Promise<Partial<GauzyInboxShared>> {
		if (!done.some((step) => step === 'reply' || step === 'archive' || step === 'unarchive')) return before;
		const g: Partial<GauzyInboxShared> = { ...before };
		if (done.includes('reply')) {
			const after = await this.reread(context, copy);
			g.resolution = sharedOf(after.item, after.recipient, after.kind).resolution;
		}
		const answered = done.includes('reply') || !!g.resolution;
		if (done.includes('archive')) g.state = 'archived';
		else if (done.includes('unarchive')) g.state = answered ? 'resolved' : 'open';
		else if (done.includes('reply') && g.state !== 'archived') g.state = 'resolved';
		return g;
	}

	/** The recipient's copy as it is now (or as it was read, when it is gone meanwhile). */
	private async reread(context: EverWorksMappingContext, copy: Pick<CopyOf, 'item' | 'recipient'>): Promise<CopyOf> {
		const fresh = this.feed ? await this.feed.readRecipient(context.tenantId, copy.recipient.id as ID) : null;
		const current = fresh ?? copy;
		return { item: current.item, recipient: current.recipient, kind: this.kindOf(current.item) };
	}

	/** The current version of a copy (`GET /inbox/items/:id`), for a patch without a recorded one. */
	private async currentVersion(client: EverWorksClient, ewId: string): Promise<number | null> {
		const item = await client.request<EverWorksFiledInboxItem>('GET', `/inbox/items/${encodeURIComponent(ewId)}`);
		return typeof item?.version === 'number' ? item.version : null;
	}

	private async record(
		context: EverWorksMappingContext,
		copy: CopyOf,
		filed: EverWorksFiledInboxItem,
		g: Partial<GauzyInboxShared>,
		e: EverWorksCopySide,
		ewUserId: string,
		externalId: string
	): Promise<EverWorksEntityLink> {
		return this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
			gauzyId: copy.recipient.id as ID,
			ewId: filed.id,
			ewVersion: typeof filed.version === 'number' ? filed.version : null,
			ewUpdatedAt: filed.updatedAt ?? null,
			gauzyUpdatedAt: copy.item.updatedAt ? new Date(copy.item.updatedAt) : null,
			snapshot: { g, e },
			ewOnly: { externalId, inboxItemId: copy.item.id, kind: copy.kind, recipientUserId: ewUserId },
			direction: 'outbound'
		});
	}

	/** The Ever Works records the item is about, as far as they are paired (`related`). */
	private async relatedOf(
		context: EverWorksMappingContext,
		item: IInboxItem
	): Promise<Pick<EverWorksInboxItemCreate, 'related'>> {
		const ewIdOf = async (type: EverWorksLinkType, gauzyId: string | null | undefined): Promise<string | null> => {
			if (!gauzyId) return null;
			const link = await this.links.byGauzy(context.integrationTenantId, type, gauzyId as ID);
			return link && link.state !== EverWorksLinkState.UNLINKED ? link.ewId : null;
		};
		// Ever Works takes a related id only from a key that reads that kind of record (else 403 scope_missing).
		const scopes = this.scopesOf(context);
		const taskId = scopes.has('tasks:read') ? await ewIdOf(EverWorksLinkType.TASK, taskOfItem(item)) : null;
		const workId = scopes.has('works:read') ? await ewIdOf(EverWorksLinkType.PROJECT_WORK, item.projectId) : null;
		const goalId = scopes.has('goals:read') ? await ewIdOf(EverWorksLinkType.GOAL, goalOfItem(item)) : null;
		const related = { ...(taskId ? { taskId } : {}), ...(workId ? { workId } : {}), ...(goalId ? { goalId } : {}) };
		return Object.keys(related).length ? { related } : {};
	}

	/** The email meta of an EMAIL item: the stored message where the Inbox email features run, else the item's own. */
	private async emailOf(
		context: EverWorksMappingContext,
		item: IInboxItem
	): Promise<Pick<EverWorksInboxItemCreate, 'email'>> {
		const metadata = (item.metadata ?? {}) as Record<string, unknown>;
		const message =
			item.emailId && this.handoffs
				? await this.handoffs.read(context.tenantId, item.emailId as ID).catch(() => null)
				: null;
		const from = (message?.from ?? (typeof metadata['from'] === 'string' ? metadata['from'] : '') ?? '').trim();
		if (!from) return {};
		const to = message?.to?.length
			? message.to
			: typeof metadata['mailboxAddress'] === 'string'
				? [metadata['mailboxAddress']]
				: [];
		const receivedAt = message?.receivedAt ?? item.createdAt ?? null;
		return {
			email: {
				from: from.slice(0, 320),
				...(to.length ? { to: to.slice(0, 100) } : {}),
				subject: (message?.subject ?? item.title ?? '').slice(0, 998),
				receivedAt: receivedAt ? new Date(receivedAt).toISOString() : new Date().toISOString()
			}
		};
	}

	private sourceUrl(item: IInboxItem): string | null {
		return sourceUrlOf(this.config?.gauzyAppUrl ?? null, item.id as string);
	}

	// ── Inbound (EW → G) ───────────────────────────────────────────────────────────────────────────

	/**
	 * The link of an Ever Works item this plugin filed; `'pending'` for one it filed whose link is not recorded yet (its
	 * push is still being retried: the event waits for it); `'foreign'` for one this connection's key filed for no Gauzy
	 * item known here (never imported); or `null` for any other item (Ever Works' own, or another integration's).
	 */
	async copyOf(
		context: EverWorksMappingContext,
		ewItemId: string,
		data: Record<string, unknown>
	): Promise<EverWorksEntityLink | 'pending' | 'foreign' | null> {
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.GAUZY_INBOX_ITEM, ewItemId);
		if (link) return link;
		// Ever Works names the key that filed an integration item (CR-15): this connection's key filed it, so it is a copy
		// of a Gauzy item (never an Ever Works item to bring into Gauzy), even when its link is not recorded yet.
		const filedBy = typeof data?.['integrationKeyId'] === 'string' ? (data['integrationKeyId'] as string) : null;
		const keyId = context.connection.keyId || null;
		const ours = !!filedBy && !!keyId && filedBy === keyId;
		// Only a key known to differ rules a copy out: a connection that does not know its key id yet still finds a
		// pending copy by its externalId below (else its event would bring the copy into Gauzy as a second item).
		if (filedBy && keyId && filedBy !== keyId) return null;
		const named = parseGauzyInboxExternalId(data?.['externalId']);
		if (named && this.feed) {
			const observed = await this.feed.readRecipient(context.tenantId, named.recipientId as ID);
			if (
				observed &&
				observed.item.id === named.inboxItemId &&
				observed.item.source !== InboxItemSourceEnum.EVER_WORKS
			) {
				return 'pending';
			}
		}
		return ours ? 'foreign' : null;
	}

	/**
	 * An Ever Works user replied to, decided, read or archived a copy: applied to the Gauzy item through the Inbox's own
	 * actions, signed in as the Gauzy recipient (the reply reaches the item's source like any Gauzy reply). An event
	 * at or below the link's version was applied already (versions only go up); a reply to an item already answered in
	 * Gauzy is not applied twice.
	 */
	async applyFromEverWorks(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink,
		envelope: EverWorksEventEnvelope
	): Promise<EverWorksApplyOutcome> {
		const version = envelope.aggregate?.version ?? null;
		if (link.ewVersion != null && version != null && version <= link.ewVersion)
			return { status: 'skipped', message: 'already applied (version)' };
		if (link.state === EverWorksLinkState.UNLINKED)
			return { status: 'skipped', message: 'the Ever Works copy is no longer synced' };
		const data = (envelope.data ?? {}) as Partial<EverWorksFiledInboxItem>;
		if (envelope.type === 'inbox.item.deleted' || data.deleted === true) {
			await this.links.unlink(link, 'deleted in Ever Works');
			return { status: 'applied', message: 'the Ever Works copy was deleted; the Gauzy item stays' };
		}
		if (!this.feed || !this.actions) {
			return process.env['GAUZY_INBOX_ENABLED'] === 'true'
				? { status: 'deferred', message: 'the Gauzy Inbox is not loaded in this process' }
				: { status: 'skipped', message: 'the Gauzy Inbox is off (GAUZY_INBOX_ENABLED)' };
		}
		const observed = await this.feed.readRecipient(context.tenantId, link.gauzyId as ID);
		if (!observed) return { status: 'skipped', message: 'the Gauzy Inbox item is gone' };
		const { recipient } = observed;
		const ewUserId = await everWorksUserOfGauzyUser(this.dataSource, this.links, context, recipient.userId as ID);
		if (typeof data.recipientUserId === 'string' && ewUserId !== data.recipientUserId) {
			return {
				status: 'skipped',
				message: 'the Gauzy recipient is no longer paired with the Ever Works recipient'
			};
		}
		// Only what Ever Works moved since it was last seen is applied: an event carries the whole state, and its other
		// fields must not undo a Gauzy change still waiting to be pushed (an archive made in Gauzy meanwhile).
		let moves: { done: string[]; e: EverWorksCopySide };
		try {
			moves = await this.applyMoves(
				context,
				observed,
				data,
				this.everWorksSideOf(link),
				envelope.id ?? `inbox-event:${link.ewId}:${version}`
			);
		} catch (error) {
			if (error instanceof EverWorksNoRequestContextError)
				return { status: 'deferred', message: error.message, retryInMs: NO_REQUEST_CONTEXT_RETRY_MS };
			throw error;
		}
		const done = moves.done;
		const g = await this.settled(context, observed, this.snapshotOf(link), done);
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
			gauzyId: link.gauzyId as ID,
			ewId: link.ewId,
			ewVersion: version,
			ewUpdatedAt: data.updatedAt ?? null,
			snapshot: { g, e: moves.e },
			direction: 'inbound'
		});
		return done.length
			? { status: 'applied', message: done.join(', ') }
			: { status: 'skipped', message: 'nothing to apply' };
	}

	// ── Initial sync: backfill and dry run ─────────────────────────────────────────────────────────

	/** Whether this process can backfill (the Gauzy Inbox is loaded here). */
	get canBackfill(): boolean {
		return !!this.feed;
	}

	/**
	 * One backfill page: the open, not archived Gauzy-origin items of the mapping's paired people whose preference sends
	 * their kind, one recipient row each, in id order after `after`. `next` carries on (`null`: done).
	 */
	async backfillPage(
		context: EverWorksMappingContext,
		after: string | null,
		pairedUsers?: ID[]
	): Promise<{ ids: ID[]; next: string | null }> {
		if (!this.feed) return { ids: [], next: null };
		// The paired people, read once by a caller that reads many pages (the preview), else here.
		const users = pairedUsers ?? (await this.pairedUsersOfMapping(context));
		if (!users.length) return { ids: [], next: null };
		const page = await this.feed.openRecipientsOf(context.tenantId, context.organizationId, users, {
			after,
			limit: BACKFILL_PAGE
		});
		// The push's own item rules, read from the page (so the dry run counts what a run sends): never Ever Works' own
		// nor the integration's notices, a task that may sync, the exact kind (a notice may be a mention) as allowed.
		const rows = page.recipients.filter(
			(row) =>
				row.source !== InboxItemSourceEnum.EVER_WORKS &&
				!(row.externalSource && OWN_EXTERNAL_SOURCES.includes(row.externalSource))
		);
		const kept = await this.tasksKept(
			context,
			rows.map((row) => taskOfItem(row))
		);
		const summaries = await this.preferences.summaries(
			context.tenantId,
			rows.map((row) => row.userId)
		);
		const ids = rows
			.filter((row) => {
				const taskId = taskOfItem(row);
				return !taskId || kept.has(taskId);
			})
			.filter((row) => summaries.get(row.userId)?.kinds[everWorksKindOf(row.kind, row.metadata)] !== false)
			.map((row) => row.id);
		return { ids, next: page.next };
	}

	/** Of the tasks named, the ones whose sync scope lets the Ever platform sync them (a task not found is kept). */
	private async tasksKept(context: EverWorksMappingContext, taskIds: Array<string | null>): Promise<Set<string>> {
		const ids = [...new Set(taskIds.filter((id): id is string => !!id))];
		const kept = new Set<string>(ids);
		for (let start = 0; start < ids.length; start += IN_CHUNK) {
			const tasks = await this.dataSource.getRepository(Task).find({
				where: { tenantId: context.tenantId, id: In(ids.slice(start, start + IN_CHUNK)) } as never,
				select: { id: true, syncScope: true } as never
			});
			for (const task of tasks)
				if (!isTaskSyncAllowed(task as never, 'ever-platform')) kept.delete(task.id as string);
		}
		return kept;
	}

	/**
	 * The dry run: open items a backfill would send, and how many of them are in Ever Works already. It reads at most
	 * `maxPages` recipient pages ({@link BACKFILL_PAGE} rows each, whatever the preferences and rules leave of them):
	 * `truncated` when it stopped there, so a preview never scans a whole history.
	 */
	async backfillCounts(
		context: EverWorksMappingContext,
		maxPages = BACKFILL_PREVIEW_PAGES
	): Promise<{ total: number; linked: number; truncated: boolean }> {
		let total = 0;
		let linked = 0;
		let after: string | null = null;
		let pages = 0;
		const users = this.feed ? await this.pairedUsersOfMapping(context) : [];
		do {
			const page = await this.backfillPage(context, after, users);
			total += page.ids.length;
			linked += (await this.linkedIds(context, page.ids)).size;
			after = page.next;
			pages++;
		} while (after && pages < maxPages);
		return { total, linked, truncated: !!after };
	}

	// ── Helpers ────────────────────────────────────────────────────────────────────────────────────

	private snapshotOf(link: EverWorksEntityLink): Partial<GauzyInboxShared> {
		return this.links.snapshot<GauzyInboxSnapshot>(link).g ?? {};
	}

	private everWorksSideOf(link: EverWorksEntityLink): EverWorksCopySide {
		return this.links.snapshot<GauzyInboxSnapshot>(link).e ?? {};
	}

	/** The connection key's scopes (an unreadable list holds none). */
	private scopesOf(context: EverWorksMappingContext): Set<string> {
		try {
			const scopes = JSON.parse(context.connection.scopes || '[]');
			return new Set(Array.isArray(scopes) ? scopes.filter((scope) => typeof scope === 'string') : []);
		} catch {
			return new Set();
		}
	}

	/** When the mapping's inbox direction started writing to Ever Works (ms), or `null` when unknown. */
	private pushSinceOf(context: EverWorksMappingContext): number | null {
		const value = context.mapping.settings?.find(
			(row) => row.settingsName === EverWorksSettingName.INBOX_PUSH_SINCE
		)?.settingsValue;
		const at = value ? Date.parse(value) : Number.NaN;
		return Number.isFinite(at) ? at : null;
	}

	/** The Ever Works-only fields of a copy's link (whom it was filed for). */
	private ewOnlyOf(link: EverWorksEntityLink): { recipientUserId?: string } {
		try {
			return link.ewOnly ? (JSON.parse(link.ewOnly) as { recipientUserId?: string }) : {};
		} catch {
			return {};
		}
	}

	private client(context: EverWorksMappingContext): EverWorksClient {
		return this.connections.client(context.connection, context.everWorksOrganizationSlug);
	}

	/** The Gauzy users among `userIds` whose person in the organization is paired with an Ever Works member. */
	private async pairedUserIds(context: EverWorksMappingContext, userIds: ID[]): Promise<Set<ID>> {
		const users = [...new Set(userIds.filter(Boolean))];
		const paired = new Set<ID>();
		for (let start = 0; start < users.length; start += IN_CHUNK) {
			const employees = await this.dataSource.getRepository(Employee).find({
				where: {
					tenantId: context.tenantId,
					organizationId: context.organizationId,
					userId: In(users.slice(start, start + IN_CHUNK))
				} as never,
				select: { id: true, userId: true } as never
			});
			if (!employees.length) continue;
			const links = await this.dataSource.getRepository(EverWorksEntityLink).find({
				where: {
					integrationTenantId: context.integrationTenantId,
					entityType: EverWorksLinkType.MEMBER,
					gauzyId: In(employees.map((employee) => employee.id as ID))
				} as never,
				select: { id: true, gauzyId: true, state: true } as never
			});
			const live = new Set(
				links.filter((row) => row.state !== EverWorksLinkState.UNLINKED).map((row) => row.gauzyId as ID)
			);
			for (const employee of employees)
				if (live.has(employee.id as ID) && employee.userId) paired.add(employee.userId as ID);
		}
		return paired;
	}

	/** The Gauzy users of every live pairing of the mapping. */
	private async pairedUsersOfMapping(context: EverWorksMappingContext): Promise<ID[]> {
		const links = (await this.links.list(context.integrationTenantId, EverWorksLinkType.MEMBER)).filter(
			(row) => row.state !== EverWorksLinkState.UNLINKED
		);
		const users: ID[] = [];
		for (let start = 0; start < links.length; start += IN_CHUNK) {
			const employees = await this.dataSource.getRepository(Employee).find({
				where: {
					tenantId: context.tenantId,
					organizationId: context.organizationId,
					id: In(links.slice(start, start + IN_CHUNK).map((row) => row.gauzyId as ID))
				} as never,
				select: { id: true, userId: true } as never
			});
			for (const employee of employees) if (employee.userId) users.push(employee.userId as ID);
		}
		return users;
	}

	/** The recipient rows among `ids` that have a copy in Ever Works. */
	private async linkedIds(context: EverWorksMappingContext, ids: ID[]): Promise<Set<ID>> {
		const linked = new Set<ID>();
		for (let start = 0; start < ids.length; start += IN_CHUNK) {
			const rows = await this.dataSource.getRepository(EverWorksEntityLink).find({
				where: {
					integrationTenantId: context.integrationTenantId,
					entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
					gauzyId: In(ids.slice(start, start + IN_CHUNK))
				} as never,
				select: { id: true, gauzyId: true } as never
			});
			for (const row of rows) linked.add(row.gauzyId as ID);
		}
		return linked;
	}

	/** Per recipient row: whether a change of it is still queued, and when its latest change settled. */
	private async lastChanges(
		context: EverWorksMappingContext,
		ids: ID[]
	): Promise<Map<ID, { open: boolean; at: number }>> {
		const result = new Map<ID, { open: boolean; at: number }>();
		const unfinished = new Set<string>([
			EverWorksOutboundStatus.PENDING,
			EverWorksOutboundStatus.PUSHING,
			EverWorksOutboundStatus.DEFERRED,
			EverWorksOutboundStatus.FAILED
		]);
		for (let start = 0; start < ids.length; start += IN_CHUNK) {
			const rows = await this.dataSource.getRepository(EverWorksOutboundChange).find({
				where: {
					integrationTenantId: context.integrationTenantId,
					entityType: EverWorksLinkType.GAUZY_INBOX_ITEM,
					gauzyId: In(ids.slice(start, start + IN_CHUNK))
				} as never,
				select: { id: true, gauzyId: true, status: true, updatedAt: true } as never
			});
			for (const row of rows) {
				const current = result.get(row.gauzyId as ID) ?? { open: false, at: 0 };
				const at = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
				result.set(row.gauzyId as ID, {
					open: current.open || unfinished.has(row.status),
					at: Math.max(current.at, at)
				});
			}
		}
		return result;
	}
}
