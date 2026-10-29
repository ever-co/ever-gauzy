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
import { createHash } from 'node:crypto';
import { DataSource, In } from 'typeorm';
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
	InboxItemKindEnum,
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
	EverWorksInboxWriteState
} from '../client/ever-works-client.types';
import { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EVER_WORKS_NOTICE_SOURCE } from '../connection/ever-works-notifier.service';
import { EverWorksConfig } from '../ever-works-config';
import { EVER_WORKS_CONFIG } from '../ever-works.tokens';
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
/** Recipient rows one sweep reads at most per mapping. */
export const GAUZY_INBOX_SWEEP_LIMIT = 2_000;
/** A change this process cannot read the Inbox for waits this long (a process that hosts the Inbox takes it). */
export const GAUZY_INBOX_WAIT_MS = 15 * 60_000;
/** A copy waits this long when Ever Works does not serve the inbox write (`404`): an Ever Works not updated yet. */
export const GAUZY_INBOX_UNSERVED_RETRY_MS = 6 * 60 * 60_000;
/** Recipient rows one backfill page reads. */
const BACKFILL_PAGE = 500;
/** Ids one `IN` list names at most. */
const IN_CHUNK = 500;

/** What Ever Works was last known to hold for a copy's own state (an event applies only what moved from it). */
interface EverWorksCopySide {
	state?: EverWorksInboxWriteState;
	unread?: boolean;
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
		if (EverWorksSyncContext.isApplying()) return;
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
				for (const row of candidates) {
					const last = settled.get(row.id);
					if (last?.open) continue; // queued already
					const changedAt = row.changedAt ? new Date(row.changedAt).getTime() : Number.NaN;
					if (last && Number.isFinite(changedAt) && last.at >= changedAt) continue; // pushed after the change
					const itemChanged = row.itemUpdatedAt
						? new Date(row.itemUpdatedAt).getTime() >= since.getTime()
						: false;
					if (!linked.has(row.id) && !itemChanged) continue; // only its read / archive moved: never sent, nothing to send
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
			filed = await client.request<EverWorksFiledInboxItem>('POST', '/inbox/items', {
				body,
				// One copy per person and item: a retry (or another process) replays the first answer.
				idempotencyKey: createHash('sha256')
					.update(`${context.connection.id}:gauzy-inbox:${externalId}`)
					.digest('hex')
			});
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
	 * Patches a copy with what changed since Gauzy last sent it (`If-Match` the link's version). A `412` (an Ever Works
	 * user acted on it meanwhile) is retried once on the current version: only Gauzy's own changes are sent, so what
	 * the person did there stays; and what the answer shows they did that Gauzy has not applied yet (an answer, an
	 * archive, a read) is applied to Gauzy before the newer version is recorded, so the event of that change, at or
	 * below the recorded version, is not needed any more.
	 */
	private async patchCopy(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink,
		now: GauzyInboxShared,
		copy: CopyOf | null
	): Promise<EverWorksPushOutcome> {
		const before = this.snapshotOf(link);
		const patch = patchOf(now, before);
		if (!patch) return { status: 'skipped', message: 'nothing changed since the last push' };
		const client = this.client(context);
		let version = link.ewVersion ?? (await this.currentVersion(client, link.ewId));
		let updated: EverWorksFiledInboxItem | null = null;
		for (let attempt = 0; attempt < 2 && !updated; attempt++) {
			try {
				updated = await client.request<EverWorksFiledInboxItem>(
					'PATCH',
					`/inbox/items/${encodeURIComponent(link.ewId)}`,
					{
						body: patch,
						...(version !== null ? { ifMatchVersion: version } : {})
					}
				);
			} catch (error) {
				if (error instanceof EverWorksApiError && error.status === 404) {
					await this.links.unlink(link, 'the Ever Works copy is gone');
					return { status: 'skipped', message: 'the Ever Works copy is gone' };
				}
				if (!(error instanceof EverWorksApiError && error.status === 412) || attempt === 1) throw error;
				const current = error.details?.['current'];
				version = typeof current === 'number' ? current : await this.currentVersion(client, link.ewId);
			}
		}
		const seen = this.everWorksSideOf(link);
		// What this patch set itself is not a move of the person's.
		const expected: EverWorksCopySide = { state: patch.state ?? seen.state, unread: seen.unread };
		let moves: { done: string[]; e: EverWorksCopySide } = { done: [], e: expected };
		if (updated && copy) {
			try {
				moves = await this.applyMoves(
					context,
					copy,
					updated,
					expected,
					`inbox-patch:${link.ewId}:${updated.version}`
				);
			} catch (error) {
				// Not recorded: the retry patches again and applies the person's change then.
				if (error instanceof EverWorksNoRequestContextError)
					return { status: 'deferred', message: error.message, retryInMs: NO_REQUEST_CONTEXT_RETRY_MS };
				throw error;
			}
		} else if (updated) {
			moves = {
				done: [],
				e: {
					state: filedStateOf(updated) ?? expected.state,
					unread: typeof updated.unread === 'boolean' ? updated.unread : expected.unread
				}
			};
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
			ewVersion: typeof updated?.version === 'number' ? updated.version : (version ?? null),
			ewUpdatedAt: updated?.updatedAt ?? null,
			gauzyUpdatedAt: copy?.item.updatedAt ? new Date(copy.item.updatedAt) : undefined,
			snapshot: { g: sent, e: moves.e },
			direction: 'outbound'
		});
		return { status: 'pushed', message: `patched in Ever Works (${Object.keys(patch).join(', ')})` };
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
		const state = filedStateOf(data);
		const stateMoved = state !== null && state !== seen.state;
		const unreadMoved = typeof data.unread === 'boolean' && data.unread !== seen.unread;
		const e: EverWorksCopySide = {
			state: state ?? seen.state,
			unread: typeof data.unread === 'boolean' ? data.unread : seen.unread
		};
		const done: string[] = [];
		const actions = this.actions;
		const answers = !!answer && takesDecision(item.kind) && item.status === InboxItemStatusEnum.OPEN;
		const archives = stateMoved && (state === 'archived') !== !!recipient.isArchived;
		const reads = unreadMoved && data.unread === !!recipient.isRead;
		if (!actions || !(answers || archives || reads)) return { done, e };
		await EverWorksSyncContext.run(
			{
				connectionId: context.connection.id as string,
				integrationTenantId: context.integrationTenantId,
				eventId
			},
			() =>
				runAsGauzyUser(context, recipient.userId as ID, async () => {
					if (answers) {
						try {
							await actions.reply(item.id as ID, answer as { optionId?: string; text?: string });
							done.push('reply');
						} catch (error) {
							// Answered in Gauzy first, or an answer Gauzy cannot take (an option it does not list): Gauzy's stays.
							if (!(error instanceof ConflictException || error instanceof BadRequestException))
								throw error;
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
	 * The snapshot after applying the person's moves: where an answer or an archive was applied, the copy's state is
	 * what Gauzy holds after it (the next push sends nothing back); otherwise (a read, or a state Gauzy cannot hold,
	 * such as a notice marked done) it stays what Gauzy last sent, so a Gauzy change still waiting to be pushed is not
	 * lost. Title, body and choices are never touched here.
	 */
	private async settled(
		context: EverWorksMappingContext,
		copy: Pick<CopyOf, 'item' | 'recipient'>,
		before: Partial<GauzyInboxShared>,
		done: string[]
	): Promise<Partial<GauzyInboxShared>> {
		if (!done.some((step) => step === 'reply' || step === 'archive' || step === 'unarchive')) return before;
		const after = await this.reread(context, copy);
		const shared = sharedOf(after.item, after.recipient, after.kind);
		return { ...before, state: shared.state, resolution: shared.resolution };
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
		const taskId = await ewIdOf(EverWorksLinkType.TASK, taskOfItem(item));
		const workId = await ewIdOf(EverWorksLinkType.PROJECT_WORK, item.projectId);
		const goalId = await ewIdOf(EverWorksLinkType.GOAL, goalOfItem(item));
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
	 * The link of an Ever Works item this plugin filed, `'pending'` for one it filed whose link is not recorded yet
	 * (its push is still being retried: the event waits for it), or `null` for any other item (one of Ever Works' own).
	 */
	async copyOf(
		context: EverWorksMappingContext,
		ewItemId: string,
		data: Record<string, unknown>
	): Promise<EverWorksEntityLink | 'pending' | null> {
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.GAUZY_INBOX_ITEM, ewItemId);
		if (link) return link;
		const named = parseGauzyInboxExternalId(data?.['externalId']);
		if (!named || !this.feed) return null;
		const observed = await this.feed.readRecipient(context.tenantId, named.recipientId as ID);
		if (
			!observed ||
			observed.item.id !== named.inboxItemId ||
			observed.item.source === InboxItemSourceEnum.EVER_WORKS
		)
			return null;
		return 'pending';
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
		after: string | null
	): Promise<{ ids: ID[]; next: string | null }> {
		if (!this.feed) return { ids: [], next: null };
		const users = await this.pairedUsersOfMapping(context);
		if (!users.length) return { ids: [], next: null };
		const page = await this.feed.openRecipientsOf(context.tenantId, context.organizationId, users, {
			after,
			limit: BACKFILL_PAGE
		});
		const summaries = await this.preferences.summaries(
			context.tenantId,
			page.recipients.map((row) => row.userId)
		);
		const ids = page.recipients
			.filter((row) => row.source !== InboxItemSourceEnum.EVER_WORKS)
			.filter((row) => {
				const kinds = summaries.get(row.userId)?.kinds;
				if (!kinds) return true;
				// A notice may be a mention or an assignment (its metadata says, which this page does not read): it is kept
				// while any of the three is sent, and the push checks its exact kind.
				if (row.kind === InboxItemKindEnum.NOTICE) return kinds.notice || kinds.mention || kinds.assignment;
				return kinds[everWorksKindOf(row.kind)];
			})
			.map((row) => row.id);
		return { ids, next: page.next };
	}

	/** The dry run: open items a backfill would send, and how many of them are in Ever Works already. */
	async backfillCounts(context: EverWorksMappingContext, max = 100_000): Promise<{ total: number; linked: number }> {
		let total = 0;
		let linked = 0;
		let after: string | null = null;
		do {
			const page = await this.backfillPage(context, after);
			total += page.ids.length;
			linked += (await this.linkedIds(context, page.ids)).size;
			after = page.next;
		} while (after && total < max);
		return { total, linked };
	}

	// ── Helpers ────────────────────────────────────────────────────────────────────────────────────

	private snapshotOf(link: EverWorksEntityLink): Partial<GauzyInboxShared> {
		return this.links.snapshot<GauzyInboxSnapshot>(link).g ?? {};
	}

	private everWorksSideOf(link: EverWorksEntityLink): EverWorksCopySide {
		return this.links.snapshot<GauzyInboxSnapshot>(link).e ?? {};
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
