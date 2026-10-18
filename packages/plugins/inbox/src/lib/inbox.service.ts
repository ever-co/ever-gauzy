import {
	BadGatewayException,
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpException,
	Injectable,
	Logger,
	NotFoundException,
	Optional,
	ServiceUnavailableException
} from '@nestjs/common';
import { Brackets, DataSource, In, SelectQueryBuilder } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ID,
	IInboxItem,
	IInboxItemCounts,
	IInboxItemFindInput,
	IInboxItemOption,
	IInboxItemPage,
	IInboxItemResponse,
	IInboxItemUpsertInput,
	IInboxItemUpsertResult,
	IInboxItemWithState,
	IInboxItemWriter,
	IInboxRecipientStateInput,
	IInboxReplyInput,
	IInboxSourceReplyResult,
	INBOX_DECISION_KINDS,
	InboxItemBodyFormatEnum,
	InboxItemKindEnum,
	InboxItemPriorityEnum,
	InboxItemSourceEnum,
	InboxItemStatusEnum,
	InboxTabEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { InboxItem } from './entities/inbox-item.entity';
import { InboxItemRecipient } from './entities/inbox-item-recipient.entity';
import { InboxSourceHandlerRegistry } from './inbox-source-handler.registry';
import { InboxRealtime } from './realtime/inbox-realtime';

/** A recipient row's own state change (the columns are nullable; the base entity types them optional). */
type RecipientChange = {
	isRead?: boolean;
	readAt?: Date | null;
	isArchived?: boolean;
	archivedAt?: Date | null;
	snoozedUntil?: Date | null;
};
type RecipientUpdate = QueryDeepPartialEntity<InboxItemRecipient>;
type ItemUpdate = QueryDeepPartialEntity<InboxItem>;

/** The sources whose replies stay in Gauzy (no handler needed). */
const LOCAL_SOURCES: readonly string[] = [InboxItemSourceEnum.GAUZY, InboxItemSourceEnum.SYSTEM];
export const INBOX_PAGE_SIZE = 20;
export const INBOX_MAX_PAGE_SIZE = 100;
const MAX_TEXT = 10_000;
/** A canonical UUID (Postgres refuses anything else in a uuid column, with an error rather than no match). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The item fields a source's re-delivery may change, each only when the source states it. */
const UPDATABLE_FIELDS = [
	'organizationId',
	'kind',
	'title',
	'body',
	'bodyFormat',
	'options',
	'requireReason',
	'status',
	'response',
	'priority',
	'dueAt',
	'entity',
	'entityId',
	'taskId',
	'projectId',
	'agentEmployeeId',
	'mailboxId',
	'emailId',
	'metadata'
] as const satisfies ReadonlyArray<keyof IInboxItemUpsertInput & keyof InboxItem>;

/** Parses a JSON column; a malformed document reads as `null` rather than failing the whole page. */
function parseJson<T>(value: string | null | undefined): T | null {
	if (value === null || value === undefined || value === '') return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

function toJson(value: unknown): string | null {
	return value === null || value === undefined ? null : JSON.stringify(value);
}

/** The item as the API answers it (JSON columns parsed). */
export function toInboxItem(row: InboxItem): IInboxItem {
	return {
		...(row as unknown as IInboxItem),
		options: parseJson<IInboxItemOption[]>(row.options),
		response: parseJson<IInboxItemResponse>(row.response),
		metadata: parseJson<Record<string, unknown>>(row.metadata),
		requireReason: !!row.requireReason
	};
}

/**
 * Where a page starts: after an item (the last one of the previous page, by the list's order), or at an offset (the
 * cursors this API issued before, still read so a client paging across an upgrade does not fail).
 */
type InboxCursor = { offset: number } | { afterId: ID; afterAt: Date };

function encodeCursor(offset: number): string {
	return Buffer.from(`o:${offset}`, 'utf8').toString('base64url');
}

/**
 * The cursor after an item: its id and its creation time, compact enough for the 64-character limit of the
 * `cursor` parameter. `null` when the item cannot anchor a page (not a UUID id, no creation time).
 */
function encodeKeyCursor(item: Pick<InboxItem, 'id' | 'createdAt'>): string | null {
	const at = item.createdAt instanceof Date ? item.createdAt.getTime() : new Date(item.createdAt as never).getTime();
	if (typeof item.id !== 'string' || !UUID.test(item.id) || !Number.isFinite(at) || at < 0) return null;
	return Buffer.from(`k:${at.toString(36)}:${item.id.replace(/-/g, '')}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string): InboxCursor {
	if (!cursor) return { offset: 0 };
	const text = Buffer.from(cursor, 'base64url').toString('utf8');
	const offset = /^o:(\d{1,9})$/.exec(text);
	if (offset) return { offset: Number(offset[1]) };
	const key = /^k:([0-9a-z]{1,11}):([0-9a-f]{32})$/i.exec(text);
	const afterAt = key ? new Date(parseInt(key[1], 36)) : null;
	if (!key || !afterAt || Number.isNaN(afterAt.getTime())) {
		throw new BadRequestException('The cursor is not one this API issued.');
	}
	const hex = key[2];
	const afterId =
		`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as ID;
	return { afterId, afterAt };
}

/**
 * The Inbox (plan 04 §2–4). Every read and action is scoped to the caller as a recipient, in the caller's
 * tenant: the recipient is taken from the credential, never from an argument. A holder of
 * `INBOX_MAILBOX_READ_ALL` may also read (not act on) any item of the tenant.
 *
 * Replies go to the item's source handler synchronously (so a source's refusal reaches the user). The reply
 * is claimed first (`OPEN` → `ANSWERED` in one conditional update), so two overlapping replies dispatch once;
 * when the source refuses, the claim is released and the item is `OPEN` again.
 *
 * Sources write items through `upsertExternal` (`INBOX_ITEM_WRITER`): idempotent on the item's external
 * identity, recipients limited to users of the item's tenant.
 */
@Injectable()
export class InboxService implements IInboxItemWriter {
	private readonly logger = new Logger(InboxService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly registry: InboxSourceHandlerRegistry,
		/** Streams `inbox_item.created` to the recipients (G-P3-6); absent in bare test wiring. */
		@Optional() private readonly realtime?: InboxRealtime
	) {}

	// ---------------------------------------------------------------- reads

	/**
	 * A page of the caller's items for a tab, newest first. The next page starts after the last item of this one
	 * (by creation time, then id), not at an offset: items that arrive, or that the user archives or reads
	 * elsewhere, between two pages neither repeat an item nor skip one (review F105).
	 */
	async list(input: IInboxItemFindInput = {}): Promise<IInboxItemPage> {
		const { tenantId, userId } = this.caller();
		const limit = Math.min(Math.max(Number(input.limit) || INBOX_PAGE_SIZE, 1), INBOX_MAX_PAGE_SIZE);
		const position = decodeCursor(input.cursor);

		const query = this.recipientItems(tenantId, userId, input)
			.orderBy('item.createdAt', 'DESC')
			.addOrderBy('item.id', 'DESC')
			.limit(limit + 1);
		if ('offset' in position) {
			query.offset(position.offset);
		} else {
			// The anchor's own creation time, read in the database: compared at the column's precision (a
			// JavaScript date keeps milliseconds only). The time in the cursor stands in for an anchor that is gone.
			const anchor = query
				.subQuery()
				.select('anchor.createdAt')
				.from(InboxItem, 'anchor')
				.where('anchor.id = :cursorId')
				.getQuery();
			const at = `COALESCE(${anchor}, :cursorAt)`;
			query.andWhere(
				new Brackets((where) => {
					where.where(`item.createdAt < ${at}`);
					where.orWhere(
						new Brackets((same) => {
							same.where(`item.createdAt = ${at}`);
							same.andWhere('item.id < :cursorId');
						})
					);
				})
			);
			query.setParameters({ cursorId: position.afterId, cursorAt: position.afterAt });
		}
		const rows = await query.getMany();
		const page = rows.slice(0, limit);
		const states = await this.recipientStates(
			tenantId,
			userId,
			page.map((row) => row.id as ID)
		);

		const last = page[page.length - 1];
		const nextCursor =
			rows.length > limit
				? (encodeKeyCursor(last) ?? ('offset' in position ? encodeCursor(position.offset + limit) : null))
				: null;
		return {
			items: page.map((row) => ({ ...toInboxItem(row), recipient: states.get(row.id as ID) ?? null })),
			nextCursor
		};
	}

	/**
	 * The caller's badge numbers. `byMailbox`: the caller's unread items of each mailbox, counted as `unread` is (the
	 * All tab), one entry per mailbox with at least one, by mailbox id (review F106).
	 */
	async counts(): Promise<IInboxItemCounts> {
		const { tenantId, userId } = this.caller();
		const [unread, decisionsOpen, mailboxes] = await Promise.all([
			this.recipientItems(tenantId, userId, { tab: InboxTabEnum.ALL, unread: true }).getCount(),
			this.recipientItems(tenantId, userId, { tab: InboxTabEnum.DECISIONS }).getCount(),
			this.recipientItems(tenantId, userId, { tab: InboxTabEnum.ALL, unread: true })
				.select('item.mailboxId', 'mailboxId')
				.addSelect('COUNT(*)', 'unread')
				.andWhere('item.mailboxId IS NOT NULL')
				.groupBy('item.mailboxId')
				.getRawMany<{ mailboxId: ID; unread: number | string }>()
		]);
		const byMailbox = mailboxes
			.map((row) => ({ mailboxId: row.mailboxId, unread: Number(row.unread) || 0 }))
			.filter((row) => !!row.mailboxId && row.unread > 0)
			.sort((a, b) => String(a.mailboxId).localeCompare(String(b.mailboxId)));
		return { unread, decisionsOpen, byMailbox };
	}

	/**
	 * One item with the caller's state. A reader of every mailbox (`INBOX_MAILBOX_READ_ALL`) may also read the
	 * mailbox items of the organizations they belong to — never an item addressed to another user personally (a
	 * question, an approval or a notice of theirs), which only its recipients read.
	 */
	async get(id: ID): Promise<IInboxItemWithState> {
		const { tenantId, userId } = this.caller();
		const item = await this.findItem(tenantId, id);
		const recipient = item ? await this.findRecipient(tenantId, id, userId) : null;
		if (!item || (!recipient && !(await this.readsAsMailboxReader(item, tenantId, userId)))) {
			throw new NotFoundException('The inbox item does not exist, or it is not addressed to you.');
		}
		return { ...toInboxItem(item), recipient: recipient ? this.stateOf(recipient) : null };
	}

	// ---------------------------------------------------------------- actions

	/** Answers a question, an approval or an escalation, through its source. */
	async reply(id: ID, input: IInboxReplyInput): Promise<IInboxItemWithState> {
		const { tenantId, userId } = this.caller();
		const { item, recipient } = await this.forRecipient(tenantId, id, userId);
		const text = typeof input?.text === 'string' ? input.text.trim() : '';
		const optionId = typeof input?.optionId === 'string' ? input.optionId.trim() : '';

		if (!INBOX_DECISION_KINDS.includes(item.kind)) {
			throw new BadRequestException('Only questions, approvals and escalations take a reply.');
		}
		if (item.status !== InboxItemStatusEnum.OPEN) {
			throw new ConflictException('This item was already answered.');
		}
		if (!text && !optionId) {
			throw new BadRequestException('A reply needs a text or an option.');
		}
		if (text.length > MAX_TEXT) {
			throw new BadRequestException(`A reply is at most ${MAX_TEXT} characters.`);
		}
		const options = parseJson<IInboxItemOption[]>(item.options) ?? [];
		if (optionId && options.length > 0 && !options.some((option) => option.id === optionId)) {
			throw new BadRequestException('The option is not one of the item’s options.');
		}
		if (item.requireReason && !text) {
			throw new BadRequestException('This item asks for a reason with the reply.');
		}

		const response: IInboxItemResponse = {
			text: text || null,
			optionId: optionId || null,
			answeredByUserId: userId,
			answeredAt: new Date().toISOString(),
			routed: null
		};

		// Claim the reply: only one of two overlapping replies turns the OPEN item ANSWERED.
		const claim = await this.dataSource
			.createQueryBuilder()
			.update(InboxItem)
			.set({ status: InboxItemStatusEnum.ANSWERED, response: toJson(response) })
			.where('id = :id AND tenantId = :tenantId AND status = :open', {
				id,
				tenantId,
				open: InboxItemStatusEnum.OPEN
			})
			.execute();
		if (!claim.affected) {
			throw new ConflictException('This item was already answered.');
		}

		let routed = 'local';
		/** The answer the source holds, when another answer won there (recorded after the claim is settled). */
		let sourceAnswer: IInboxSourceReplyResult['response'] = null;
		try {
			const handler = this.registry.get(item.source);
			if (handler) {
				const answered = toInboxItem({
					...item,
					status: InboxItemStatusEnum.ANSWERED,
					response: toJson(response)
				} as InboxItem);
				const result = await handler.onReply(
					answered,
					{ text: text || undefined, optionId: optionId || undefined },
					{
						id: userId,
						tenantId
					}
				);
				routed = result?.routed || 'delivered';
				sourceAnswer = result?.response ?? null;
			} else if (!LOCAL_SOURCES.includes(item.source)) {
				throw new ServiceUnavailableException(
					'The source of this item is not connected, so the reply cannot be delivered. Try again later.'
				);
			}
		} catch (error) {
			// The source did not take it: release the claim so the item can be answered again.
			await this.dataSource
				.createQueryBuilder()
				.update(InboxItem)
				.set({ status: InboxItemStatusEnum.OPEN, response: null })
				.where('id = :id AND tenantId = :tenantId AND status = :answered', {
					id,
					tenantId,
					answered: InboxItemStatusEnum.ANSWERED
				})
				.execute();
			if (error instanceof HttpException) throw error;
			this.logger.warn(
				`The ${item.source} handler refused the reply to inbox item ${id}: ${(error as Error)?.message}`
			);
			throw new BadGatewayException('The source of this item did not take the reply. Try again later.');
		}

		// The source took the reply: the claim stays whatever happens next (nothing below may re-open the item,
		// or a second reply would be delivered again).
		response.routed = routed;
		if (sourceAnswer) {
			// Another answer won at the source: record that one, so the item shows what was decided there. A
			// malformed date from the source keeps the claim's time.
			response.text = sourceAnswer.text ?? null;
			response.optionId = sourceAnswer.optionId ?? null;
			const answeredAt = sourceAnswer.answeredAt ? new Date(sourceAnswer.answeredAt) : null;
			if (answeredAt && !Number.isNaN(answeredAt.getTime())) response.answeredAt = answeredAt.toISOString();
		}
		// Where it was routed is bookkeeping; the source's own answer is not, so its write is tried twice and a
		// failure is an error in the log. Either way the source re-delivers its state (an answered event, a
		// reconcile through `upsertExternal`), which corrects the item.
		for (let attempt = 1; ; attempt++) {
			try {
				await this.dataSource.getRepository(InboxItem).update({ id, tenantId }, { response: toJson(response) });
				break;
			} catch (error) {
				if (sourceAnswer && attempt < 2) continue;
				const message = `The reply to inbox item ${id} was delivered (${routed}), but recording ${
					sourceAnswer ? "the source's answer" : 'it'
				} failed: ${(error as Error)?.message}`;
				if (sourceAnswer) this.logger.error(message);
				else this.logger.warn(message);
				break;
			}
		}

		if (!recipient.isRead) {
			await this.dataSource
				.getRepository(InboxItemRecipient)
				.update({ id: recipient.id }, { isRead: true, readAt: new Date() });
		}
		return this.get(id);
	}

	/** The caller's read / archive / snooze state of one item. */
	async setState(id: ID, input: IInboxRecipientStateInput): Promise<IInboxItemWithState> {
		const { tenantId, userId } = this.caller();
		const { item, recipient } = await this.forRecipient(tenantId, id, userId);
		const now = new Date();
		const change: RecipientChange = {};
		const stated: IInboxRecipientStateInput = {};

		if (typeof input?.isRead === 'boolean') {
			change.isRead = input.isRead;
			change.readAt = input.isRead ? (recipient.readAt ?? now) : null;
			stated.isRead = input.isRead;
		}
		if (typeof input?.isArchived === 'boolean') {
			change.isArchived = input.isArchived;
			change.archivedAt = input.isArchived ? now : null;
			stated.isArchived = input.isArchived;
		}
		// `!== undefined`, not `in`: a validated DTO may carry the key with no value.
		if (input && input.snoozedUntil !== undefined) {
			if (input.snoozedUntil === null) {
				change.snoozedUntil = null;
			} else {
				const until = new Date(input.snoozedUntil as string);
				if (Number.isNaN(until.getTime())) {
					throw new BadRequestException('snoozedUntil must be a date-time, or null to un-snooze.');
				}
				change.snoozedUntil = until;
			}
			stated.snoozedUntil = change.snoozedUntil ?? null;
		}
		if (Object.keys(change).length === 0) {
			throw new BadRequestException('State a change: isRead, isArchived or snoozedUntil.');
		}

		await this.dataSource.getRepository(InboxItemRecipient).update({ id: recipient.id }, change as RecipientUpdate);

		// The source mirrors the state (for example read / archived in Ever Works); best effort.
		const handler = this.registry.get(item.source);
		if (handler?.onStateChange) {
			try {
				await handler.onStateChange(toInboxItem(item), { ...recipient, ...change } as never, stated);
			} catch (error) {
				this.logger.warn(
					`The ${item.source} handler did not take a state change of inbox item ${id}: ${(error as Error)?.message}`
				);
			}
		}
		return this.get(id);
	}

	/** Marks every unread item of the caller (of a tab) read. */
	async markAllRead(tab?: InboxTabEnum): Promise<{ updated: number }> {
		const { tenantId, userId } = this.caller();
		const rows = await this.recipientItems(tenantId, userId, { tab: tab ?? InboxTabEnum.ALL, unread: true })
			.select('recipient.id', 'recipientId')
			.addSelect('item.id', 'itemId')
			.addSelect('item.source', 'source')
			.getRawMany<{ recipientId: ID; itemId: ID; source: string }>();
		const ids = rows.map((row) => row.recipientId);

		const repository = this.dataSource.getRepository(InboxItemRecipient);
		const now = new Date();
		for (let start = 0; start < ids.length; start += 500) {
			await repository.update({ id: In(ids.slice(start, start + 500)) }, { isRead: true, readAt: now });
		}
		// The sources mirror the state, as for one item; in the background (a source may be slow, and it is best
		// effort either way), one item after the other.
		const mirrored = rows.filter((row) => !!this.registry.get(row.source)?.onStateChange);
		if (mirrored.length) {
			void this.mirrorReads(tenantId, userId, mirrored);
		}
		return { updated: ids.length };
	}

	/** Tells each item's source that the caller read it (`markAllRead`); a failure is logged, the state stays. */
	private async mirrorReads(
		tenantId: ID,
		userId: ID,
		rows: Array<{ recipientId: ID; itemId: ID; source: string }>
	): Promise<void> {
		for (const row of rows) {
			try {
				const item = await this.findItem(tenantId, row.itemId);
				const handler = item ? this.registry.get(item.source) : undefined;
				if (!item || !handler?.onStateChange) continue;
				// Read again just before telling the source: a later choice of the user (marked unread meanwhile,
				// already told to the source by that request) is never overwritten by this older bulk read.
				const recipient = await this.findRecipient(tenantId, row.itemId, userId);
				if (!recipient?.isRead) continue;
				await handler.onStateChange(toInboxItem(item), recipient, { isRead: true });
			} catch (error) {
				this.logger.warn(
					`The ${row.source} handler did not take the read state of inbox item ${row.itemId}: ${(error as Error)?.message}`
				);
			}
		}
	}

	// ---------------------------------------------------------------- writes by sources

	/**
	 * Creates or updates the item a source knows by `externalSource` + `externalId` (unique per tenant), and its
	 * recipients. A source's re-delivery updates the item; recipients are added, and a stated `isRead` /
	 * `isArchived` (the state in the source) is applied. Recipients that are not users of the tenant are left
	 * out and reported.
	 */
	async upsertExternal(input: IInboxItemUpsertInput): Promise<IInboxItemUpsertResult> {
		const externalSource = typeof input?.externalSource === 'string' ? input.externalSource.trim() : '';
		const externalId = typeof input?.externalId === 'string' ? input.externalId.trim() : '';
		if (!externalSource || !externalId) {
			throw new BadRequestException('upsertExternal needs externalSource and externalId.');
		}
		return this.write({ ...input, externalSource, externalId });
	}

	/** Creates an item without a source identity (platform notices, `source = SYSTEM` / `GAUZY`). */
	async create(input: IInboxItemUpsertInput): Promise<IInboxItemUpsertResult> {
		return this.write({ ...input, externalSource: undefined, externalId: undefined });
	}

	private async write(input: IInboxItemUpsertInput): Promise<IInboxItemUpsertResult> {
		const values = this.itemValues(input);
		const tenantId = values.tenantId as ID;
		await this.assertOrganizationOfTenant(tenantId, values.organizationId);
		const repository = this.dataSource.getRepository(InboxItem);

		let created = false;
		let item: InboxItem | null = values.externalSource
			? await repository.findOne({
					where: { tenantId, externalSource: values.externalSource, externalId: values.externalId as string }
				})
			: null;
		if (item) {
			await repository.update({ id: item.id }, this.updatableValues(values, input) as ItemUpdate);
		} else {
			try {
				item = await repository.save(repository.create(values as InboxItem));
				created = true;
			} catch (error) {
				// Another delivery of the same source item created it between the read and the insert.
				item = values.externalSource
					? await repository.findOne({
							where: {
								tenantId,
								externalSource: values.externalSource,
								externalId: values.externalId as string
							}
						})
					: null;
				if (!item) throw error;
				await repository.update({ id: item.id }, this.updatableValues(values, input) as ItemUpdate);
			}
		}

		const { recipientUserIds, skippedUserIds, addedUserIds } = await this.writeRecipients(
			item,
			input.recipients ?? [],
			input.replaceRecipients === true
		);
		const stored = (await repository.findOne({ where: { id: item.id } })) as InboxItem;
		// The item reached these users' Inbox now: announced to their subscriptions (never fails the write). Also on
		// a re-delivery: a recipient the first delivery could not add (a failed write, a pairing made later) is told
		// too, and one who already had the item is not told again (review F104).
		if (addedUserIds.length) await this.realtime?.itemCreated(stored, addedUserIds);
		return { item: toInboxItem(stored), created, recipientUserIds, skippedUserIds };
	}

	private itemValues(input: IInboxItemUpsertInput): Partial<InboxItem> {
		if (!input?.tenantId) {
			throw new BadRequestException('An inbox item needs a tenant.');
		}
		if (!Object.values(InboxItemKindEnum).includes(input.kind)) {
			throw new BadRequestException('An inbox item needs a kind.');
		}
		const source = typeof input.source === 'string' ? input.source.trim() : '';
		if (!source || source.length > 32) {
			throw new BadRequestException('An inbox item needs a source (at most 32 characters).');
		}
		const title = typeof input.title === 'string' ? input.title.trim() : '';
		if (!title) {
			throw new BadRequestException('An inbox item needs a title.');
		}
		const dueAt = input.dueAt ? new Date(input.dueAt) : null;
		return {
			tenantId: input.tenantId,
			organizationId: input.organizationId ?? null,
			kind: input.kind,
			source,
			status: input.status ?? InboxItemStatusEnum.OPEN,
			title: title.slice(0, 300),
			body: input.body ?? null,
			bodyFormat: input.bodyFormat ?? InboxItemBodyFormatEnum.PLAIN,
			options: toJson(input.options ?? null),
			requireReason: !!input.requireReason,
			response: toJson(input.response ?? null),
			priority: input.priority ?? InboxItemPriorityEnum.NORMAL,
			dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
			entity: input.entity ?? null,
			entityId: input.entityId ?? null,
			taskId: input.taskId ?? null,
			projectId: input.projectId ?? null,
			agentEmployeeId: input.agentEmployeeId ?? null,
			mailboxId: input.mailboxId ?? null,
			emailId: input.emailId ?? null,
			externalSource: input.externalSource ?? null,
			externalId: input.externalId ?? null,
			metadata: toJson(input.metadata ?? null)
		} as Partial<InboxItem>;
	}

	/**
	 * What a re-delivery changes: the fields the source states, never the tenant, the source or the identity. A
	 * field the source leaves out keeps its value, so a re-delivered "created" payload (no status, no response)
	 * cannot re-open an answered item, wipe its answer or clear its links.
	 */
	private updatableValues(values: Partial<InboxItem>, input: IInboxItemUpsertInput): Partial<InboxItem> {
		const update: Record<string, unknown> = {};
		for (const key of UPDATABLE_FIELDS) {
			if (input[key] !== undefined) update[key] = values[key];
		}
		return update as Partial<InboxItem>;
	}

	/** An item's organization must be one of its tenant's (a source names both). */
	private async assertOrganizationOfTenant(tenantId: ID, organizationId?: ID | null): Promise<void> {
		// Only an omitted organization is skipped: an empty or malformed one is refused like an unknown one.
		if (organizationId === null || organizationId === undefined) return;
		const found =
			typeof organizationId === 'string' &&
			UUID.test(organizationId) &&
			(await this.dataSource
				.createQueryBuilder()
				.select('o.id', 'id')
				.from('organization', 'o')
				.where('o.id = :organizationId', { organizationId })
				.andWhere('o.tenantId = :tenantId', { tenantId })
				.getRawOne<{ id: ID }>());
		if (!found) {
			throw new BadRequestException('The organization of an inbox item must be one of its tenant’s.');
		}
	}

	/**
	 * Whether a reader of every mailbox may read this item without being its recipient: only an EMAIL item of a
	 * mailbox (P4), of an organization the reader is an active member of. Any other kind is personal, even when a
	 * source linked it to a mailbox.
	 */
	private async readsAsMailboxReader(item: InboxItem, tenantId: ID, userId: ID): Promise<boolean> {
		if (item.kind !== InboxItemKindEnum.EMAIL || !item.mailboxId || !item.organizationId) return false;
		if (!RequestContext.hasPermission(PermissionsEnum.INBOX_MAILBOX_READ_ALL)) return false;
		const membership = await this.dataSource
			.createQueryBuilder()
			.select('membership.id', 'id')
			.from('user_organization', 'membership')
			.where('membership.tenantId = :tenantId', { tenantId })
			.andWhere('membership.userId = :userId', { userId })
			.andWhere('membership.organizationId = :organizationId', { organizationId: item.organizationId })
			.andWhere('membership.isActive = :active', { active: true })
			.andWhere('membership.deletedAt IS NULL')
			.getRawOne<{ id: ID }>();
		return !!membership;
	}

	private async writeRecipients(
		item: InboxItem,
		recipients: IInboxItemUpsertInput['recipients'],
		replace = false
	): Promise<{ recipientUserIds: ID[]; skippedUserIds: ID[]; addedUserIds: ID[] }> {
		const stated = new Map<ID, IInboxItemUpsertInput['recipients'][number]>();
		for (const recipient of recipients) {
			if (recipient?.userId) stated.set(recipient.userId, recipient);
		}
		const userIds = [...stated.keys()];
		// Not a UUID: no user of any tenant (and Postgres would refuse the whole lookup), so it is skipped.
		const candidates = userIds.filter((id) => typeof id === 'string' && UUID.test(id));
		const known = new Set<ID>(
			candidates.length === 0
				? []
				: (
						await this.dataSource
							.createQueryBuilder()
							.select('u.id', 'id')
							.from('user', 'u')
							.where('u.tenantId = :tenantId', { tenantId: item.tenantId })
							.andWhere('u.id IN (:...userIds)', { userIds: candidates })
							.getRawMany<{ id: ID }>()
					).map((row) => row.id)
		);
		const repository = this.dataSource.getRepository(InboxItemRecipient);
		const existing = new Map(
			(await repository.find({ where: { inboxItemId: item.id } })).map((row) => [row.userId, row])
		);
		const now = new Date();
		/** The recipient rows this write inserted (an overlapping delivery that inserted one reports it itself). */
		const added: ID[] = [];

		for (const userId of userIds.filter((id) => known.has(id))) {
			const recipient = stated.get(userId);
			const row = existing.get(userId);
			const state: RecipientChange = {};
			if (typeof recipient?.isRead === 'boolean') {
				state.isRead = recipient.isRead;
				state.readAt = recipient.isRead ? (row?.readAt ?? now) : null;
			}
			if (typeof recipient?.isArchived === 'boolean') {
				state.isArchived = recipient.isArchived;
				state.archivedAt = recipient.isArchived ? (row?.archivedAt ?? now) : null;
			}
			if (row) {
				if (Object.keys(state).length > 0) await repository.update({ id: row.id }, state as RecipientUpdate);
				continue;
			}
			try {
				await repository.save(
					repository.create({
						tenantId: item.tenantId,
						organizationId: item.organizationId ?? null,
						inboxItemId: item.id,
						userId,
						isRead: false,
						isArchived: false,
						deliveredAt: now,
						...state
					} as InboxItemRecipient)
				);
				added.push(userId);
			} catch (error) {
				// Added by an overlapping delivery (unique on item + user): apply the state to that row.
				const raced = await repository.findOne({ where: { inboxItemId: item.id, userId } });
				if (!raced) throw error;
				if (Object.keys(state).length > 0) await repository.update({ id: raced.id }, state as RecipientUpdate);
			}
		}
		// `replaceRecipients`: whoever the source no longer addresses the item to loses it (a pairing replaced in the source).
		const kept = new Set<ID>(userIds.filter((id) => known.has(id)));
		const removed =
			replace && kept.size > 0 ? [...existing.keys()].filter((userId) => !kept.has(userId as ID)) : [];
		if (removed.length > 0) {
			await repository.delete({ inboxItemId: item.id, userId: In(removed) } as never);
		}
		return {
			recipientUserIds: [
				...new Set([...[...existing.keys()].filter((userId) => !removed.includes(userId)), ...kept])
			] as ID[],
			skippedUserIds: userIds.filter((id) => !known.has(id)),
			addedUserIds: added
		};
	}

	// ---------------------------------------------------------------- helpers

	private caller(): { tenantId: ID; userId: ID } {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();
		if (!tenantId || !userId) {
			throw new ForbiddenException('The inbox needs a signed-in user of a tenant.');
		}
		return { tenantId, userId };
	}

	/** The caller's (not deleted) items for a tab and filters, joined to the caller's recipient row. */
	private recipientItems(tenantId: ID, userId: ID, input: IInboxItemFindInput): SelectQueryBuilder<InboxItem> {
		const query = this.dataSource
			.getRepository(InboxItem)
			.createQueryBuilder('item')
			.innerJoin(
				InboxItemRecipient,
				'recipient',
				'recipient.inboxItemId = item.id AND recipient.userId = :userId AND recipient.tenantId = :tenantId',
				{ userId, tenantId }
			)
			.where('item.tenantId = :tenantId', { tenantId })
			.andWhere('item.deletedAt IS NULL')
			.andWhere('recipient.deletedAt IS NULL');

		const tab = input.tab ?? InboxTabEnum.ALL;
		if (tab === InboxTabEnum.ARCHIVED) {
			query.andWhere('recipient.isArchived = :archived', { archived: true });
		} else if (tab === InboxTabEnum.SNOOZED) {
			// Snoozed and not archived: where a snoozed item can be found (and woken) before its time.
			query.andWhere(
				new Brackets((where) => {
					where.where('recipient.isArchived = :notArchived', { notArchived: false });
					where.orWhere('recipient.isArchived IS NULL');
				})
			);
			query.andWhere('recipient.snoozedUntil > :now', { now: new Date() });
		} else {
			query.andWhere(
				new Brackets((where) => {
					where.where('recipient.isArchived = :notArchived', { notArchived: false });
					where.orWhere('recipient.isArchived IS NULL');
				})
			);
			// A snoozed item comes back when its time has come.
			query.andWhere(
				new Brackets((where) => {
					where.where('recipient.snoozedUntil IS NULL');
					where.orWhere('recipient.snoozedUntil <= :now', { now: new Date() });
				})
			);
		}
		if (tab === InboxTabEnum.DECISIONS) {
			query.andWhere('item.kind IN (:...decisionKinds)', { decisionKinds: [...INBOX_DECISION_KINDS] });
			query.andWhere('item.status = :openStatus', { openStatus: InboxItemStatusEnum.OPEN });
		}
		if (tab === InboxTabEnum.EMAIL) {
			query.andWhere('item.kind = :emailKind', { emailKind: InboxItemKindEnum.EMAIL });
		}

		const equals: Array<keyof IInboxItemFindInput & keyof InboxItem> = [
			'kind',
			'source',
			'mailboxId',
			'projectId',
			'taskId',
			'agentEmployeeId'
		];
		for (const column of equals) {
			const value = input[column];
			if (value !== undefined && value !== null && value !== '') {
				query.andWhere(`item.${column} = :${column}`, { [column]: value });
			}
		}
		if (input.unread === true || (input.unread as unknown) === 'true') {
			query.andWhere('recipient.isRead = :unreadFlag', { unreadFlag: false });
		}
		const search = typeof input.q === 'string' ? input.q.trim().toLowerCase() : '';
		if (search) {
			// `!` escapes the wildcards: a backslash means different things in MySQL and Postgres string literals.
			const like = `%${search.replace(/[!%_]/g, (character) => `!${character}`)}%`;
			query.andWhere(
				new Brackets((where) => {
					where.where("LOWER(item.title) LIKE :search ESCAPE '!'", { search: like });
					where.orWhere("LOWER(item.body) LIKE :search ESCAPE '!'", { search: like });
				})
			);
		}
		return query;
	}

	private async recipientStates(
		tenantId: ID,
		userId: ID,
		itemIds: ID[]
	): Promise<Map<ID, IInboxItemWithState['recipient']>> {
		if (itemIds.length === 0) return new Map();
		const rows = await this.dataSource
			.getRepository(InboxItemRecipient)
			.find({ where: { tenantId, userId, inboxItemId: In(itemIds) } });
		return new Map(rows.map((row) => [row.inboxItemId, this.stateOf(row)]));
	}

	private stateOf(row: InboxItemRecipient): NonNullable<IInboxItemWithState['recipient']> {
		return {
			isRead: !!row.isRead,
			readAt: row.readAt ?? null,
			isArchived: !!row.isArchived,
			archivedAt: row.archivedAt ?? undefined,
			snoozedUntil: row.snoozedUntil ?? null
		};
	}

	private async findItem(tenantId: ID, id: ID): Promise<InboxItem | null> {
		return this.dataSource.getRepository(InboxItem).findOne({ where: { id, tenantId } });
	}

	private async findRecipient(tenantId: ID, inboxItemId: ID, userId: ID): Promise<InboxItemRecipient | null> {
		return this.dataSource.getRepository(InboxItemRecipient).findOne({ where: { tenantId, inboxItemId, userId } });
	}

	/** The item and the caller's recipient row; 404 when the item is not addressed to the caller. */
	private async forRecipient(
		tenantId: ID,
		id: ID,
		userId: ID
	): Promise<{ item: InboxItem; recipient: InboxItemRecipient }> {
		const [item, recipient] = await Promise.all([
			this.findItem(tenantId, id),
			this.findRecipient(tenantId, id, userId)
		]);
		if (!item || !recipient) {
			throw new NotFoundException('The inbox item does not exist, or it is not addressed to you.');
		}
		return { item, recipient };
	}
}
