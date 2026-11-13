import { ConflictException, Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource, In, IsNull, LessThanOrEqual, ObjectLiteral } from 'typeorm';
import {
	ID,
	INBOX_NOTIFICATION_EXTERNAL_SOURCE,
	InboxDeliveryChannelEnum,
	InboxDeliveryModeEnum,
	InboxItemKindEnum,
	InboxItemSourceEnum
} from '@gauzy/contracts';
import { InboxItem } from '../entities/inbox-item.entity';
import { InboxItemRecipient } from '../entities/inbox-item-recipient.entity';
import { InboxNamedLocks } from '../email/database/named-locks';
import { isInboxNotificationEmailEnabled, isInboxWebPushEnabled } from '../inbox-enabled';
import { InboxDelivery } from './inbox-delivery.entity';
import { InboxDeliveryMailer, IInboxDeliveryLine, IInboxDeliveryRecipient } from './inbox-delivery-mailer';
import { deliveryUserOf, InboxDeliveryContextUnavailableError, runInDeliveryContext } from './inbox-delivery-context';
import {
	INBOX_DELIVERY_DIGEST_MAX_ITEMS,
	INBOX_DELIVERY_INTAKE_LOOKBACK_MS,
	INBOX_DELIVERY_SKIPPED_READ,
	INBOX_DELIVERY_SWEEP_LOCK,
	readInboxDeliveryBatch
} from './inbox-delivery.constants';
import {
	decideEmailDelivery,
	decidePushDelivery,
	excerptOf,
	inboxItemLinkOf,
	isSentOnlyWhileUnread,
	kindLabelOf,
	metadataOf,
	retryDelayMs
} from './inbox-delivery-rules';
import { InboxDeliveryPusher, InboxPushGoneError, InboxPushRefusedError } from './push/inbox-delivery-pusher';
import { InboxPushSubscriptionService } from './push/inbox-push-subscription.service';
import { INBOX_PUSH_FOCUSED_WINDOW_MS, INBOX_PUSH_NO_SUBSCRIPTION, INBOX_PUSH_SKIPPED_FOCUSED } from './push/inbox-push.constants';

/** What one sweep did. */
export interface IInboxDeliverySweepReport {
	decided: number;
	immediateSent: number;
	digestsSent: number;
	/** Pushes that a push service accepted for at least one of the person's devices. */
	pushesSent: number;
	/** Pushes closed unsent because the person had an active, focused session (FR-13). */
	pushesSkipped: number;
	/** Emails and pushes of a timer reminder closed unsent: the person had read it in the app by the time it was due. */
	readSkipped: number;
	failed: number;
}

/** An entry awaiting a decision: its recipient row and the entry's own fields. */
interface IIntakeRow {
	recipientId: ID;
	inboxItemId: ID;
	userId: ID;
	tenantId: ID;
	organizationId: ID | null;
	metadata: unknown;
	/** The recipient's read state when the entry is decided (a boolean, or 0 / 1 as some drivers answer it). */
	isRead: unknown;
}

/** A read flag as the drivers answer it: a boolean, or 0 / 1. */
function isReadFlag(value: unknown): boolean {
	return value === true || Number(value) === 1;
}

/** The person an email goes to. */
interface IDeliveryUser {
	id: ID;
	email: string | null;
	firstName: string | null;
	lastName: string | null;
	preferredLanguage: string | null;
	timeZone: string | null;
}

/**
 * The delivery lane's sweep (the Inbox spec, "Preferences and channels" / FR-10–FR-12), run by the worker every
 * minute:
 *
 * 1. **Intake** — every notification entry filed in the last day whose recipient has no delivery row yet gets one,
 *    with what the employee's setting decides: nothing, an email at once (after the do-not-disturb window when the
 *    entry falls inside it), or a place in the next digest at the employee's hour.
 * 2. **Immediate** — the emails that are due go out, one per entry.
 * 3. **Digests** — the digest rows that are due go out as one email per person (one per person and day: the rows
 *    of a day share the person's digest hour), the entries listed newest first.
 *
 * The rows are the outbox: a send that fails is tried again later (doubling waits, five attempts, then given up
 * with its error on the row), a worker that was down catches up from the rows, two workers never both file the
 * same entry (the row is unique on entry, person and channel) nor both send one: the sweep runs under a named
 * lock across the workers (a sweep that finds it held is skipped, the next minute's takes over). Nothing here
 * changes the entry or its read state.
 */
@Injectable()
export class InboxDeliveryService {
	private readonly logger = new Logger(InboxDeliveryService.name);
	/** One sweep at a time across the workers (a transaction-scoped advisory lock on PostgreSQL, `GET_LOCK` on MySQL). */
	private readonly locks: InboxNamedLocks;

	constructor(
		private readonly dataSource: DataSource,
		private readonly mailer: InboxDeliveryMailer,
		/** The web push sender and the devices (FR-13); absent in bare test wiring, when nothing is pushed. */
		@Optional() private readonly pusher?: InboxDeliveryPusher,
		@Optional() private readonly subscriptions?: InboxPushSubscriptionService
	) {
		this.locks = new InboxNamedLocks(dataSource);
	}

	async sweep(now = new Date()): Promise<IInboxDeliverySweepReport> {
		try {
			return await this.locks.run(INBOX_DELIVERY_SWEEP_LOCK, () => this.runSweep(now));
		} catch (error) {
			if (error instanceof ConflictException) {
				this.logger.log('Inbox delivery sweep: another worker holds the sweep; this one is skipped');
				return { decided: 0, immediateSent: 0, digestsSent: 0, pushesSent: 0, pushesSkipped: 0, readSkipped: 0, failed: 0 };
			}
			throw error;
		}
	}

	private async runSweep(now: Date): Promise<IInboxDeliverySweepReport> {
		const batch = readInboxDeliveryBatch();
		const report: IInboxDeliverySweepReport = { decided: 0, immediateSent: 0, digestsSent: 0, pushesSent: 0, pushesSkipped: 0, readSkipped: 0, failed: 0 };
		report.decided = await this.intake(now, batch);
		const immediate = await this.sendImmediate(now, batch);
		const digests = await this.sendDigests(now, batch);
		const pushes = await this.sendPushes(now, batch);
		report.immediateSent = immediate.sent;
		report.digestsSent = digests.sent;
		report.pushesSent = pushes.sent;
		report.pushesSkipped = pushes.skipped;
		report.readSkipped = immediate.read + digests.read + pushes.read;
		report.failed = immediate.failed + digests.failed + pushes.failed;
		if (report.decided || report.immediateSent || report.digestsSent || report.pushesSent || report.pushesSkipped || report.readSkipped || report.failed) {
			this.logger.log(
				`Inbox delivery sweep: decided ${report.decided}, sent ${report.immediateSent} at once, ${report.digestsSent} digests and ${report.pushesSent} pushes (${report.pushesSkipped} skipped for a focused session, ${report.readSkipped} timer reminders read in the app first), ${report.failed} failed`
			);
		}
		return report;
	}

	/**
	 * The channels this process decides and sends: email under its switch; web push under its switch, with the VAPID keys
	 * and the devices' store. The plugin is loaded for either, so a process on one switch leaves the other channel alone.
	 */
	private channels(): InboxDeliveryChannelEnum[] {
		const channels: InboxDeliveryChannelEnum[] = [];
		if (isInboxNotificationEmailEnabled()) channels.push(InboxDeliveryChannelEnum.EMAIL);
		if (isInboxWebPushEnabled() && this.pusher?.configured() && this.subscriptions) channels.push(InboxDeliveryChannelEnum.PUSH);
		return channels;
	}

	// ---------------------------------------------------------------- intake

	/** Decides the entries with no delivery row yet, for each channel this process serves; answers how many rows were written. */
	async intake(now: Date, batch: number): Promise<number> {
		let decided = 0;
		for (const channel of this.channels()) decided += await this.intakeChannel(channel, now, batch);
		return decided;
	}

	private async intakeChannel(channel: InboxDeliveryChannelEnum, now: Date, batch: number): Promise<number> {
		const since = new Date(now.getTime() - INBOX_DELIVERY_INTAKE_LOOKBACK_MS);
		const rows = (await this.dataSource
			.getRepository(InboxItemRecipient)
			.createQueryBuilder('recipient')
			.innerJoin(InboxItem, 'item', 'item.id = recipient.inboxItemId AND item.tenantId = recipient.tenantId')
			.select('recipient.id', 'recipientId')
			.addSelect('recipient.inboxItemId', 'inboxItemId')
			.addSelect('recipient.userId', 'userId')
			.addSelect('recipient.tenantId', 'tenantId')
			.addSelect('item.organizationId', 'organizationId')
			.addSelect('item.metadata', 'metadata')
			.addSelect('recipient.isRead', 'isRead')
			.where('recipient.createdAt >= :since', { since })
			.andWhere('item.kind = :kind AND item.source = :source', { kind: InboxItemKindEnum.NOTIFICATION, source: InboxItemSourceEnum.GAUZY })
			.andWhere((qb) => {
				const decided = qb
					.subQuery()
					.select('1')
					.from(InboxDelivery, 'delivery')
					.where('delivery.inboxItemId = recipient.inboxItemId AND delivery.userId = recipient.userId AND delivery.channel = :channel')
					.getQuery();
				return `NOT EXISTS ${decided}`;
			})
			.setParameter('channel', channel)
			.orderBy('recipient.createdAt', 'ASC')
			.limit(batch)
			.getRawMany()) as IIntakeRow[];
		let decided = 0;
		for (const row of rows) {
			try {
				if (await this.decide(row, now, channel)) decided += 1;
			} catch (error) {
				this.logger.warn(`Inbox delivery: entry ${row.inboxItemId} for user ${row.userId} was not decided (${(error as Error)?.message ?? error})`);
			}
		}
		return decided;
	}

	/** Writes the decision for one entry, person and channel (false when a concurrent sweep wrote it first). */
	private async decide(row: IIntakeRow, now: Date, channel: InboxDeliveryChannelEnum): Promise<boolean> {
		const metadata = metadataOf(row.metadata);
		const employeeId = typeof metadata['receiverEmployeeId'] === 'string' ? (metadata['receiverEmployeeId'] as ID) : null;
		const type = typeof metadata['notificationType'] === 'string' ? metadata['notificationType'] : null;
		const setting = employeeId ? await this.settingOf(employeeId, row.tenantId) : null;
		const user = await this.userOf(row.userId, row.tenantId);
		// A timer reminder read already (an open tab showed it and marked it read) is decided as nothing, which also
		// keeps it from being taken in again; the read state changes nothing for any other kind.
		const alreadyRead = isReadFlag(row.isRead);
		const decision =
			channel === InboxDeliveryChannelEnum.PUSH
				? decidePushDelivery({
						now,
						type,
						setting,
						userTimeZone: user?.timeZone ?? null,
						hasSubscription: !!(await this.subscriptions?.hasAny(row.tenantId, row.userId)),
						alreadyRead
					})
				: decideEmailDelivery({ now, type, setting, userTimeZone: user?.timeZone ?? null, alreadyRead });
		const repository = this.dataSource.getRepository(InboxDelivery);
		try {
			await repository.insert({
				tenantId: row.tenantId,
				organizationId: row.organizationId ?? undefined,
				inboxItemId: row.inboxItemId,
				userId: row.userId,
				employeeId: employeeId ?? undefined,
				channel,
				mode: decision.mode,
				notificationType: type ?? undefined,
				dueAt: decision.dueAt ?? undefined,
				digestKey: decision.digestKey ?? undefined,
				attempts: 0
			});
			return true;
		} catch (error) {
			// Unique on (entry, person, channel): another sweep decided it in the meantime.
			if (await repository.exists({ where: { inboxItemId: row.inboxItemId, userId: row.userId, channel } })) return false;
			throw error;
		}
	}

	// ---------------------------------------------------------------- sending

	/** The rows of a mode that are due now: not sent, not given up, due, and not waiting for a retry; a person's alone when given. */
	private async due(channel: InboxDeliveryChannelEnum, mode: InboxDeliveryModeEnum, now: Date, batch: number | null, person?: { tenantId: ID; userId: ID }): Promise<InboxDelivery[]> {
		const base = {
			channel,
			mode,
			sentAt: IsNull(),
			failedAt: IsNull(),
			dueAt: LessThanOrEqual(now),
			...(person ? { tenantId: person.tenantId, userId: person.userId } : {})
		};
		return this.dataSource.getRepository(InboxDelivery).find({
			where: [
				{ ...base, nextAttemptAt: IsNull() },
				{ ...base, nextAttemptAt: LessThanOrEqual(now) }
			],
			order: { dueAt: 'ASC' },
			...(batch === null ? {} : { take: batch })
		});
	}

	/** The people with a due row of the mode, earliest due first, `batch` of them at most: a digest is a person's whole due set, never a page of it. */
	private async duePeople(channel: InboxDeliveryChannelEnum, mode: InboxDeliveryModeEnum, now: Date, batch: number): Promise<Array<{ tenantId: ID; userId: ID }>> {
		const rows = (await this.dataSource
			.getRepository(InboxDelivery)
			.createQueryBuilder('delivery')
			.select('delivery.tenantId', 'tenantId')
			.addSelect('delivery.userId', 'userId')
			.where('delivery.channel = :channel AND delivery.mode = :mode AND delivery.sentAt IS NULL AND delivery.failedAt IS NULL AND delivery.dueAt <= :now', {
				channel,
				mode,
				now
			})
			.andWhere('(delivery.nextAttemptAt IS NULL OR delivery.nextAttemptAt <= :now)')
			.groupBy('delivery.tenantId')
			.addGroupBy('delivery.userId')
			.orderBy('MIN(delivery.dueAt)', 'ASC')
			.limit(batch)
			.getRawMany()) as Array<{ tenantId: ID; userId: ID }>;
		return rows.filter((row) => row.tenantId && row.userId);
	}

	async sendImmediate(now: Date, batch: number): Promise<{ sent: number; failed: number; read: number }> {
		let sent = 0;
		let failed = 0;
		let read = 0;
		// A process on the push switch alone leaves the email rows to one on the email switch (a deferred or retried email is
		// still an email): the rows wait, they are not sent by a channel the operator turned off.
		if (!this.channels().includes(InboxDeliveryChannelEnum.EMAIL)) return { sent, failed, read };
		const rows = await this.due(InboxDeliveryChannelEnum.EMAIL, InboxDeliveryModeEnum.IMMEDIATE, now, batch);
		if (!rows.length) return { sent, failed, read };
		const items = await this.itemsOf(rows.map((row) => row.inboxItemId));
		for (const row of rows) {
			const item = items.get(String(row.inboxItemId));
			if (item && (await this.isReadFirst(row, item))) {
				await this.giveUp([row], INBOX_DELIVERY_SKIPPED_READ, now);
				read += 1;
				continue;
			}
			const recipient = await this.recipientOf(row);
			if (!item || !recipient) {
				await this.giveUp([row], !item ? 'The entry is gone.' : 'The user has no email address.', now);
				failed += 1;
				continue;
			}
			try {
				await runInDeliveryContext(deliveryUserOf(this.scopeOf(row), row.userId), () => this.mailer.sendNotification(recipient, this.lineOf(item)));
				await this.markSent([row], now);
				sent += 1;
			} catch (error) {
				// This process cannot open a tenant-scoped context: the sweep's failure (the queue retries it), not the row's.
				if (error instanceof InboxDeliveryContextUnavailableError) throw error;
				await this.recordFailure([row], error, now);
				failed += 1;
			}
		}
		return { sent, failed, read };
	}

	async sendDigests(now: Date, batch: number): Promise<{ sent: number; failed: number; read: number }> {
		let sent = 0;
		let failed = 0;
		let read = 0;
		if (!this.channels().includes(InboxDeliveryChannelEnum.EMAIL)) return { sent, failed, read };
		// The people first (a bounded set), then each person's whole due set: a digest is never a page of one.
		const people = await this.duePeople(InboxDeliveryChannelEnum.EMAIL, InboxDeliveryModeEnum.DIGEST, now, batch);
		if (!people.length) return { sent, failed, read };
		const groups: InboxDelivery[][] = [];
		for (const person of people) {
			const group = await this.due(InboxDeliveryChannelEnum.EMAIL, InboxDeliveryModeEnum.DIGEST, now, null, person);
			if (group.length) groups.push(group);
		}
		const items = await this.itemsOf(groups.flat().map((row) => row.inboxItemId));
		for (const group of groups) {
			const first = group[0];
			const recipient = await this.recipientOf(first);
			if (!recipient) {
				await this.giveUp(group, 'The user has no email address.', now);
				failed += 1;
				continue;
			}
			// Newest first; an entry that is gone is not in the digest, and its row is done with. So is a timer reminder
			// the person read in the app meanwhile.
			const listed = group.filter((row) => items.has(String(row.inboxItemId)));
			const gone = group.filter((row) => !items.has(String(row.inboxItemId)));
			if (gone.length) await this.giveUp(gone, 'The entry is gone.', now);
			const present: InboxDelivery[] = [];
			const readFirst: InboxDelivery[] = [];
			for (const row of listed) {
				if (await this.isReadFirst(row, items.get(String(row.inboxItemId)) as InboxItem)) readFirst.push(row);
				else present.push(row);
			}
			if (readFirst.length) {
				await this.giveUp(readFirst, INBOX_DELIVERY_SKIPPED_READ, now);
				read += readFirst.length;
			}
			if (!present.length) continue;
			const lines = present
				.map((row) => items.get(String(row.inboxItemId)) as InboxItem)
				.sort((a, b) => new Date(b.createdAt as Date).getTime() - new Date(a.createdAt as Date).getTime())
				.slice(0, INBOX_DELIVERY_DIGEST_MAX_ITEMS)
				.map((item) => this.lineOf(item));
			try {
				await runInDeliveryContext(deliveryUserOf(this.scopeOf(first), first.userId), () => this.mailer.sendDigest(recipient, lines, present.length));
				await this.markSent(present, now);
				sent += 1;
			} catch (error) {
				if (error instanceof InboxDeliveryContextUnavailableError) throw error;
				await this.recordFailure(present, error, now);
				failed += 1;
			}
		}
		return { sent, failed, read };
	}

	/**
	 * Pushes the due rows to each of the person's devices (FR-13) — unless the person has an active, focused session,
	 * when the row is closed as skipped: they are looking at the app, where the entry already is. A device the push
	 * service no longer knows is removed, and so is one whose endpoint the outbound-endpoint policy refuses (it was
	 * supplied, not issued by a push service); one that failed again is counted, and removed at the limit. The row is
	 * sent once one device took it; it is tried again when every device refused, and closed when the person has none.
	 */
	async sendPushes(now: Date, batch: number): Promise<{ sent: number; skipped: number; failed: number; read: number }> {
		const outcome = { sent: 0, skipped: 0, failed: 0, read: 0 };
		if (!this.pusher || !this.subscriptions || !this.channels().includes(InboxDeliveryChannelEnum.PUSH)) return outcome;
		const rows = await this.due(InboxDeliveryChannelEnum.PUSH, InboxDeliveryModeEnum.IMMEDIATE, now, batch);
		if (!rows.length) return outcome;
		const items = await this.itemsOf(rows.map((row) => row.inboxItemId));
		const host = this.mailer.host();
		for (const row of rows) {
			const item = items.get(String(row.inboxItemId));
			if (!item) {
				await this.giveUp([row], 'The entry is gone.', now);
				outcome.failed += 1;
				continue;
			}
			if (await this.isReadFirst(row, item)) {
				await this.giveUp([row], INBOX_DELIVERY_SKIPPED_READ, now);
				outcome.read += 1;
				continue;
			}
			if (await this.hasFocusedSession(row, now)) {
				await this.giveUp([row], INBOX_PUSH_SKIPPED_FOCUSED, now);
				outcome.skipped += 1;
				continue;
			}
			const devices = await this.subscriptions.devicesOf(row.tenantId as ID, row.userId);
			if (!devices.length) {
				await this.giveUp([row], INBOX_PUSH_NO_SUBSCRIPTION, now);
				outcome.failed += 1;
				continue;
			}
			const line = this.lineOf(item);
			const payload = { title: line.title, body: line.body, kindLabel: line.kindLabel, url: inboxItemLinkOf(host, line.itemId), itemId: String(line.itemId), tag: `inbox-${line.itemId}` };
			let delivered = 0;
			let lastError: unknown = null;
			for (const device of devices) {
				try {
					await this.pusher.send(device, payload);
					delivered += 1;
					await this.subscriptions.markUsed(device.id as ID, now);
				} catch (error) {
					if (error instanceof InboxPushGoneError) {
						await this.subscriptions.gone(device.id as ID);
						continue;
					}
					if (error instanceof InboxPushRefusedError) {
						this.logger.warn(`Inbox delivery: device ${device.id} of user ${row.userId} removed, its endpoint is refused (${error.message})`);
						await this.subscriptions.gone(device.id as ID);
						continue;
					}
					lastError = error;
					await this.subscriptions.recordFailure(device);
				}
			}
			if (delivered) {
				await this.markSent([row], now);
				outcome.sent += 1;
			} else if (lastError) {
				await this.recordFailure([row], lastError, now);
				outcome.failed += 1;
			} else {
				await this.giveUp([row], INBOX_PUSH_NO_SUBSCRIPTION, now);
				outcome.failed += 1;
			}
		}
		return outcome;
	}

	/**
	 * FR-13: whether the person's employee record reported active (not idle) input within the window — the heartbeat the
	 * clients send through the real-time channel's presence — which is a focused session on the account.
	 */
	private async hasFocusedSession(row: InboxDelivery, now: Date): Promise<boolean> {
		if (!row.employeeId) return false;
		const employee = (await this.dataSource.getRepository<ObjectLiteral>('Employee').findOne({
			select: { id: true, lastSeenAt: true, isIdle: true },
			where: { id: row.employeeId, tenantId: row.tenantId }
		} as never)) as { lastSeenAt?: Date | string | null; isIdle?: boolean | null } | null;
		if (!employee?.lastSeenAt || employee.isIdle) return false;
		const seen = new Date(employee.lastSeenAt).getTime();
		return Number.isFinite(seen) && now.getTime() - seen <= INBOX_PUSH_FOCUSED_WINDOW_MS;
	}

	/**
	 * Whether a row is of a kind sent only while unread (a timer reminder) whose entry the person has read by now. The
	 * Ever Teams tab that showed the reminder marks the notification read through the notification API, and the bridge
	 * carries that to the entry, best effort: a mark made while the entry was being filed can miss it. So the
	 * notification's own read state counts too, read in the row's tenant. Every other kind is sent read or not, and is
	 * not looked up.
	 */
	private async isReadFirst(row: InboxDelivery, item: InboxItem): Promise<boolean> {
		if (!isSentOnlyWhileUnread(row.notificationType)) return false;
		const recipient = await this.dataSource.getRepository(InboxItemRecipient).findOne({
			select: { id: true, isRead: true },
			where: { inboxItemId: row.inboxItemId, userId: row.userId, tenantId: row.tenantId }
		});
		if (isReadFlag(recipient?.isRead)) return true;
		if (item?.externalSource !== INBOX_NOTIFICATION_EXTERNAL_SOURCE || !item.externalId) return false;
		const notification = (await this.dataSource.getRepository<ObjectLiteral>('EmployeeNotification').findOne({
			select: { id: true, isRead: true },
			where: { id: item.externalId, tenantId: row.tenantId }
		} as never)) as { isRead?: unknown } | null;
		return isReadFlag(notification?.isRead);
	}

	// ---------------------------------------------------------------- reads and marks

	private lineOf(item: InboxItem): IInboxDeliveryLine {
		const metadata = metadataOf(item.metadata);
		return {
			itemId: item.id as ID,
			title: String(item.title ?? '').trim() || 'Notification',
			body: excerptOf(item.body),
			kindLabel: kindLabelOf(typeof metadata['notificationType'] === 'string' ? metadata['notificationType'] : null)
		};
	}

	private async itemsOf(ids: ID[]): Promise<Map<string, InboxItem>> {
		const unique = [...new Set(ids.map(String))];
		if (!unique.length) return new Map();
		const rows = await this.dataSource.getRepository(InboxItem).find({ where: { id: In(unique) } });
		return new Map(rows.map((row) => [String(row.id), row]));
	}

	/** The tenant and organization a row is sent for. */
	private scopeOf(row: InboxDelivery): { tenantId: ID; organizationId: ID | null } {
		return { tenantId: row.tenantId as ID, organizationId: (row.organizationId as ID | undefined) ?? null };
	}

	private async recipientOf(row: InboxDelivery): Promise<IInboxDeliveryRecipient | null> {
		const user = await this.userOf(row.userId, row.tenantId as ID);
		const email = String(user?.email ?? '').trim();
		if (!user || !email) return null;
		const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || email;
		return { tenantId: row.tenantId as ID, organizationId: row.organizationId ?? null, email, name, locale: user.preferredLanguage ?? null };
	}

	private async userOf(userId: ID, tenantId: ID): Promise<IDeliveryUser | null> {
		const user = (await this.dataSource.getRepository<ObjectLiteral>('User').findOne({
			select: { id: true, email: true, firstName: true, lastName: true, preferredLanguage: true, timeZone: true },
			where: { id: userId, tenantId }
		} as never)) as IDeliveryUser | null;
		return user ?? null;
	}

	private async settingOf(employeeId: ID, tenantId: ID): Promise<ObjectLiteral | null> {
		return (await this.dataSource.getRepository<ObjectLiteral>('EmployeeNotificationSetting').findOne({ where: { employeeId, tenantId } } as never)) ?? null;
	}

	private async markSent(rows: InboxDelivery[], now: Date): Promise<void> {
		await this.dataSource.getRepository(InboxDelivery).update({ id: In(rows.map((row) => row.id as ID)) }, { sentAt: now, attempts: () => 'attempts + 1', lastError: () => 'NULL', nextAttemptAt: () => 'NULL' } as never);
	}

	private async giveUp(rows: InboxDelivery[], reason: string, now: Date): Promise<void> {
		await this.dataSource.getRepository(InboxDelivery).update({ id: In(rows.map((row) => row.id as ID)) }, { failedAt: now, lastError: reason } as never);
	}

	/** Records a failed attempt on the rows: the next attempt later (doubling), or given up after the last one. */
	private async recordFailure(rows: InboxDelivery[], error: unknown, now: Date): Promise<void> {
		const message = String((error as Error)?.message ?? error).slice(0, 2000);
		const attempts = Math.max(...rows.map((row) => Number(row.attempts) || 0)) + 1;
		const delay = retryDelayMs(attempts);
		this.logger.warn(`Inbox delivery: ${rows.length} row(s) of user ${rows[0]?.userId} failed (attempt ${attempts}): ${message}`);
		await this.dataSource.getRepository(InboxDelivery).update(
			{ id: In(rows.map((row) => row.id as ID)) },
			delay === null ? ({ attempts, lastError: message, failedAt: now } as never) : ({ attempts, lastError: message, nextAttemptAt: new Date(now.getTime() + delay) } as never)
		);
	}
}
