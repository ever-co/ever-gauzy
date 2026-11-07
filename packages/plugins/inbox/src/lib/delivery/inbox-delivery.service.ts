import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In, IsNull, LessThanOrEqual, ObjectLiteral } from 'typeorm';
import { ID, InboxDeliveryChannelEnum, InboxDeliveryModeEnum, InboxItemKindEnum, InboxItemSourceEnum } from '@gauzy/contracts';
import { InboxItem } from '../entities/inbox-item.entity';
import { InboxItemRecipient } from '../entities/inbox-item-recipient.entity';
import { InboxDelivery } from './inbox-delivery.entity';
import { InboxDeliveryMailer, IInboxDeliveryLine, IInboxDeliveryRecipient } from './inbox-delivery-mailer';
import { deliveryUserOf, runInDeliveryContext } from './inbox-delivery-context';
import {
	INBOX_DELIVERY_DIGEST_MAX_ITEMS,
	INBOX_DELIVERY_INTAKE_LOOKBACK_MS,
	readInboxDeliveryBatch
} from './inbox-delivery.constants';
import { decideEmailDelivery, excerptOf, kindLabelOf, metadataOf, retryDelayMs } from './inbox-delivery-rules';

/** What one sweep did. */
export interface IInboxDeliverySweepReport {
	decided: number;
	immediateSent: number;
	digestsSent: number;
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
 * same entry (the row is unique on entry, person and channel). Nothing here changes the entry or its read state.
 */
@Injectable()
export class InboxDeliveryService {
	private readonly logger = new Logger(InboxDeliveryService.name);

	constructor(private readonly dataSource: DataSource, private readonly mailer: InboxDeliveryMailer) {}

	async sweep(now = new Date()): Promise<IInboxDeliverySweepReport> {
		const batch = readInboxDeliveryBatch();
		const report: IInboxDeliverySweepReport = { decided: 0, immediateSent: 0, digestsSent: 0, failed: 0 };
		report.decided = await this.intake(now, batch);
		const immediate = await this.sendImmediate(now, batch);
		const digests = await this.sendDigests(now, batch);
		report.immediateSent = immediate.sent;
		report.digestsSent = digests.sent;
		report.failed = immediate.failed + digests.failed;
		if (report.decided || report.immediateSent || report.digestsSent || report.failed) {
			this.logger.log(`Inbox delivery sweep: decided ${report.decided}, sent ${report.immediateSent} at once and ${report.digestsSent} digests, ${report.failed} failed`);
		}
		return report;
	}

	// ---------------------------------------------------------------- intake

	/** Decides the entries with no delivery row yet; answers how many rows were written. */
	async intake(now: Date, batch: number): Promise<number> {
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
			.setParameter('channel', InboxDeliveryChannelEnum.EMAIL)
			.orderBy('recipient.createdAt', 'ASC')
			.limit(batch)
			.getRawMany()) as IIntakeRow[];
		let decided = 0;
		for (const row of rows) {
			try {
				if (await this.decide(row, now)) decided += 1;
			} catch (error) {
				this.logger.warn(`Inbox delivery: entry ${row.inboxItemId} for user ${row.userId} was not decided (${(error as Error)?.message ?? error})`);
			}
		}
		return decided;
	}

	/** Writes the decision for one entry and person (false when a concurrent sweep wrote it first). */
	private async decide(row: IIntakeRow, now: Date): Promise<boolean> {
		const metadata = metadataOf(row.metadata);
		const employeeId = typeof metadata.receiverEmployeeId === 'string' ? (metadata.receiverEmployeeId as ID) : null;
		const type = typeof metadata.notificationType === 'string' ? metadata.notificationType : null;
		const setting = employeeId ? await this.settingOf(employeeId, row.tenantId) : null;
		const user = await this.userOf(row.userId, row.tenantId);
		const decision = decideEmailDelivery({ now, type, setting, userTimeZone: user?.timeZone ?? null });
		const repository = this.dataSource.getRepository(InboxDelivery);
		try {
			await repository.insert({
				tenantId: row.tenantId,
				organizationId: row.organizationId ?? undefined,
				inboxItemId: row.inboxItemId,
				userId: row.userId,
				employeeId: employeeId ?? undefined,
				channel: InboxDeliveryChannelEnum.EMAIL,
				mode: decision.mode,
				notificationType: type ?? undefined,
				dueAt: decision.dueAt ?? undefined,
				digestKey: decision.digestKey ?? undefined,
				attempts: 0
			});
			return true;
		} catch (error) {
			// Unique on (entry, person, channel): another sweep decided it in the meantime.
			if (await repository.exists({ where: { inboxItemId: row.inboxItemId, userId: row.userId, channel: InboxDeliveryChannelEnum.EMAIL } })) return false;
			throw error;
		}
	}

	// ---------------------------------------------------------------- sending

	/** The rows of a mode that are due now: not sent, not given up, due, and not waiting for a retry. */
	private async due(mode: InboxDeliveryModeEnum, now: Date, batch: number): Promise<InboxDelivery[]> {
		const base = { channel: InboxDeliveryChannelEnum.EMAIL, mode, sentAt: IsNull(), failedAt: IsNull(), dueAt: LessThanOrEqual(now) };
		return this.dataSource.getRepository(InboxDelivery).find({
			where: [
				{ ...base, nextAttemptAt: IsNull() },
				{ ...base, nextAttemptAt: LessThanOrEqual(now) }
			],
			order: { dueAt: 'ASC' },
			take: batch
		});
	}

	async sendImmediate(now: Date, batch: number): Promise<{ sent: number; failed: number }> {
		const rows = await this.due(InboxDeliveryModeEnum.IMMEDIATE, now, batch);
		let sent = 0;
		let failed = 0;
		if (!rows.length) return { sent, failed };
		const items = await this.itemsOf(rows.map((row) => row.inboxItemId));
		for (const row of rows) {
			const item = items.get(String(row.inboxItemId));
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
				await this.recordFailure([row], error, now);
				failed += 1;
			}
		}
		return { sent, failed };
	}

	async sendDigests(now: Date, batch: number): Promise<{ sent: number; failed: number }> {
		const rows = await this.due(InboxDeliveryModeEnum.DIGEST, now, batch);
		let sent = 0;
		let failed = 0;
		if (!rows.length) return { sent, failed };
		const groups = new Map<string, InboxDelivery[]>();
		for (const row of rows) {
			const key = `${row.tenantId}:${row.userId}`;
			groups.set(key, [...(groups.get(key) ?? []), row]);
		}
		const items = await this.itemsOf(rows.map((row) => row.inboxItemId));
		for (const group of groups.values()) {
			const first = group[0];
			const recipient = await this.recipientOf(first);
			if (!recipient) {
				await this.giveUp(group, 'The user has no email address.', now);
				failed += 1;
				continue;
			}
			// Newest first; an entry that is gone is not in the digest, and its row is done with.
			const present = group.filter((row) => items.has(String(row.inboxItemId)));
			const gone = group.filter((row) => !items.has(String(row.inboxItemId)));
			if (gone.length) await this.giveUp(gone, 'The entry is gone.', now);
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
				await this.recordFailure(present, error, now);
				failed += 1;
			}
		}
		return { sent, failed };
	}

	// ---------------------------------------------------------------- reads and marks

	private lineOf(item: InboxItem): IInboxDeliveryLine {
		const metadata = metadataOf(item.metadata);
		return {
			itemId: item.id as ID,
			title: String(item.title ?? '').trim() || 'Notification',
			body: excerptOf(item.body),
			kindLabel: kindLabelOf(typeof metadata.notificationType === 'string' ? metadata.notificationType : null)
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
