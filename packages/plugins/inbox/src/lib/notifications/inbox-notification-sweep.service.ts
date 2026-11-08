import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Brackets, DataSource } from 'typeorm';
import { ID, INBOX_NOTIFICATION_EXTERNAL_SOURCE } from '@gauzy/contracts';
import { EmployeeNotification } from '@gauzy/core';
import { InboxNamedLocks } from '../email/database/named-locks';
import { InboxItem } from '../entities/inbox-item.entity';
import { InboxItemRecipient } from '../entities/inbox-item-recipient.entity';
import { InboxSweepCheckpoint } from '../entities/inbox-sweep-checkpoint.entity';
import {
	INBOX_MENTION_DEDUPE_WINDOW_MS,
	INBOX_NOTIFICATION_SWEEP_BATCH,
	INBOX_NOTIFICATION_SWEEP_CHECKPOINT,
	INBOX_NOTIFICATION_SWEEP_GRACE_MS,
	INBOX_NOTIFICATION_SWEEP_LOCK,
	INBOX_NOTIFICATION_SWEEP_MAX_ATTEMPTS
} from '../inbox.constants';
import { InboxNotificationBridge, InboxNotificationFiling } from './inbox-notification.bridge';

/** What one sweep did. */
export interface IInboxNotificationSweepReport {
	/** The notifications read from the checkpoint on. */
	read: number;
	/** Filed now: their live filing never happened, or failed. */
	filed: number;
	/** Mentions folded now into their twin's entry (FR-4). */
	folded: number;
	/** Already filed or folded (the live filing's work). */
	present: number;
	/** No entry can be addressed (no receiver, or a receiver with no user), as for the live filing. */
	unaddressed: number;
	/** Given up: refused by the Inbox, or failed for `INBOX_NOTIFICATION_SWEEP_MAX_ATTEMPTS` sweeps in a row. */
	skipped: number;
	/** The sweep stopped at a notification it could not file, and the next one tries it again. */
	held: boolean;
}

const emptyReport = (): IInboxNotificationSweepReport => ({
	read: 0,
	filed: 0,
	folded: 0,
	present: 0,
	unaddressed: 0,
	skipped: 0,
	held: false
});

/**
 * The recovery sweep of the notification filing (the Inbox spec §4 Reliability: no lost entries). The live filing
 * (`InboxNotificationBridge.fileNotification`, on `EmployeeNotificationCreatedEvent`) runs after the notification's
 * row is committed, in the process that wrote it: a process that stops between the two, or a filing that fails,
 * leaves a notification with no entry. This sweep files those.
 *
 * - **In order, from a durable checkpoint.** It reads the notifications by creation time, then id, from the last one
 *   it settled (`inbox_sweep_checkpoint`), with no age limit: a worker that was down for a week resumes where it
 *   stopped. The migration that creates the table writes the first place — where the Inbox started filing (its
 *   oldest notification entry), or the moment the Inbox is switched on — so a filing that fails before any worker
 *   ran is still caught up. The comparison is made in the database (the checkpoint's own row is the anchor), at the
 *   column's precision.
 * - **Behind the live filing.** Only notifications older than `INBOX_NOTIFICATION_SWEEP_GRACE_MS` are read: the live
 *   filing has had its chance, and a notification whose transaction commits later than that is not passed over.
 * - **Once per notification.** It files through `InboxNotificationBridge.settleNotification`, as the live filing
 *   does: a notification that has its entry, or is recorded on its twin's (`metadata.twinNotificationIds`), is left
 *   alone, and a mention is checked and filed under the same twin lock as the live filing's — the two never make two
 *   entries of one notification, nor file a folded twin as an entry of its own. An entry a failed write left without
 *   its recipient row is completed. A recovered entry is dated as its notification, so it sorts where it belongs and
 *   two lost mentions of one record still fold.
 * - **Never stuck.** A notification whose filing fails holds the checkpoint (it is tried again by the next sweep);
 *   after `INBOX_NOTIFICATION_SWEEP_MAX_ATTEMPTS` sweeps, or at once when the Inbox refuses it, it is given up with
 *   an error in the log, so the ones after it are filed.
 *
 * One sweep at a time across the workers (`InboxNamedLocks`): a sweep that finds the lock held is skipped.
 */
@Injectable()
export class InboxNotificationSweepService {
	private readonly logger = new Logger(InboxNotificationSweepService.name);
	private readonly locks: InboxNamedLocks;

	constructor(
		private readonly dataSource: DataSource,
		private readonly bridge: InboxNotificationBridge
	) {
		this.locks = new InboxNamedLocks(dataSource);
	}

	/** One sweep: at most `batch` notifications from the checkpoint on (`INBOX_NOTIFICATION_SWEEP_BATCH`). */
	async sweep(now = new Date(), batch = INBOX_NOTIFICATION_SWEEP_BATCH): Promise<IInboxNotificationSweepReport> {
		try {
			return await this.locks.run(INBOX_NOTIFICATION_SWEEP_LOCK, () =>
				this.runSweep(now, Math.max(1, Math.floor(batch) || 1))
			);
		} catch (error) {
			if (error instanceof ConflictException) {
				this.logger.log('Inbox notification sweep: another worker holds the sweep; this one is skipped');
				return emptyReport();
			}
			throw error;
		}
	}

	private async runSweep(now: Date, batch: number): Promise<IInboxNotificationSweepReport> {
		const report = emptyReport();
		const checkpoints = this.dataSource.getRepository(InboxSweepCheckpoint);
		const checkpoint =
			(await checkpoints.findOne({ where: { id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT } })) ??
			(await this.start(now));
		const page = await this.page(checkpoint, new Date(now.getTime() - INBOX_NOTIFICATION_SWEEP_GRACE_MS), batch);
		report.read = page.length;
		if (!page.length) {
			return report;
		}
		const filed = await this.filedIds(page);
		let cursor: { at: Date; id: string } | null = null;
		let heldId = checkpoint.heldId ?? null;
		let heldAttempts = Number(checkpoint.heldAttempts) || 0;

		for (const notification of page) {
			const id = String(notification.id);
			if (filed.has(id)) {
				report.present += 1;
			} else {
				try {
					const outcome: InboxNotificationFiling = await this.bridge.settleNotification(notification, {
						now: now.getTime(),
						recovered: true
					});
					report[outcome] += 1;
				} catch (error) {
					const message = (error as Error)?.message ?? String(error);
					if (error instanceof BadRequestException) {
						this.logger.warn(
							`Inbox notification sweep: notification ${id} is refused by the Inbox and given up (${message})`
						);
					} else {
						const attempts = (heldId === id ? heldAttempts : 0) + 1;
						if (attempts < INBOX_NOTIFICATION_SWEEP_MAX_ATTEMPTS) {
							this.logger.warn(
								`Inbox notification sweep: notification ${id} was not filed (attempt ${attempts} of ${INBOX_NOTIFICATION_SWEEP_MAX_ATTEMPTS}; the next sweep tries again): ${message}`
							);
							heldId = id;
							heldAttempts = attempts;
							report.held = true;
							break;
						}
						this.logger.error(
							`Inbox notification sweep: notification ${id} was not filed after ${attempts} sweeps and is given up: ${message}`
						);
					}
					report.skipped += 1;
				}
			}
			if (heldId === id) {
				heldId = null;
				heldAttempts = 0;
			}
			cursor = { at: notification.createdAt as Date, id };
		}

		await checkpoints.update(
			{ id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT },
			{ ...(cursor ? { cursorAt: cursor.at, cursorId: cursor.id } : {}), heldId, heldAttempts, updatedAt: now }
		);
		if (report.filed || report.folded || report.skipped || report.held) {
			this.logger.log(
				`Inbox notification sweep: read ${report.read}, filed ${report.filed}, folded ${report.folded}, ${report.present} already in the Inbox, ${report.unaddressed} with no user, ${report.skipped} given up${report.held ? '; held at a notification to try again' : ''}`
			);
		}
		return report;
	}

	/**
	 * The sweep's place when its row is missing (the migration writes it when the Inbox is switched on, so this is a
	 * fallback): where the Inbox started filing (its oldest notification entry), or now when nothing was filed yet.
	 */
	private async start(now: Date): Promise<InboxSweepCheckpoint> {
		const first = await this.dataSource.getRepository(InboxItem).findOne({
			select: { id: true, createdAt: true },
			where: { externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE },
			order: { createdAt: 'ASC' }
		});
		const firstAt = first?.createdAt ? new Date(first.createdAt).getTime() : NaN;
		const checkpoint: InboxSweepCheckpoint = {
			id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT,
			cursorAt: new Date(Math.min(Number.isNaN(firstAt) ? now.getTime() : firstAt, now.getTime())),
			cursorId: null,
			heldId: null,
			heldAttempts: 0,
			updatedAt: now
		};
		const checkpoints = this.dataSource.getRepository(InboxSweepCheckpoint);
		try {
			await checkpoints.insert(checkpoint);
		} catch (error) {
			// Written meanwhile by a sweep that did not take the lock (a database without named locks): use that one.
			const written = await checkpoints.findOne({ where: { id: INBOX_NOTIFICATION_SWEEP_CHECKPOINT } });
			if (!written) throw error;
			return written;
		}
		return checkpoint;
	}

	/**
	 * The next notifications after the checkpoint, oldest first, created before `until`: after the checkpoint's own
	 * notification, compared in the database at the column's precision (the time in the checkpoint stands in for a
	 * row that is gone). A checkpoint that names no notification yet (the place the migration or `start` wrote) is a
	 * starting time: read from the dedupe window before it on, so a notification created just before the Inbox's
	 * first filing is not passed over.
	 */
	private async page(checkpoint: InboxSweepCheckpoint, until: Date, batch: number): Promise<EmployeeNotification[]> {
		const query = this.dataSource
			.getRepository(EmployeeNotification)
			.createQueryBuilder('notification')
			.where('notification.createdAt <= :until', { until })
			.orderBy('notification.createdAt', 'ASC')
			.addOrderBy('notification.id', 'ASC')
			.limit(batch);
		const cursorAt = checkpoint.cursorAt ? new Date(checkpoint.cursorAt) : new Date(0);
		if (checkpoint.cursorId) {
			const anchor = query
				.subQuery()
				.select('anchor.createdAt')
				.from(EmployeeNotification, 'anchor')
				.where('anchor.id = :cursorId')
				.getQuery();
			const at = `COALESCE(${anchor}, :cursorAt)`;
			query.andWhere(
				new Brackets((where) => {
					where.where(`notification.createdAt > ${at}`);
					where.orWhere(
						new Brackets((same) => {
							same.where(`notification.createdAt = ${at}`);
							same.andWhere('notification.id > :cursorId');
						})
					);
				})
			);
			query.setParameters({ cursorId: checkpoint.cursorId, cursorAt });
		} else {
			query.andWhere('notification.createdAt >= :cursorAt', {
				cursorAt: new Date(cursorAt.getTime() - INBOX_MENTION_DEDUPE_WINDOW_MS)
			});
		}
		return query.getMany();
	}

	/**
	 * Which of the notifications already have their complete entry — the item and a recipient row (the receiver's:
	 * a notification's item has no other) — in one read. An item a failed write left without its recipient row is not
	 * one of them: `settleNotification` completes it.
	 */
	private async filedIds(notifications: EmployeeNotification[]): Promise<Set<string>> {
		const tenantIds = [...new Set(notifications.map((row) => row.tenantId).filter((id): id is ID => !!id))];
		if (!tenantIds.length) {
			return new Set();
		}
		const rows = (await this.dataSource
			.getRepository(InboxItem)
			.createQueryBuilder('item')
			.innerJoin(
				InboxItemRecipient,
				'recipient',
				'recipient.inboxItemId = item.id AND recipient.tenantId = item.tenantId'
			)
			.select('item.externalId', 'externalId')
			.where('item.tenantId IN (:...tenantIds)', { tenantIds })
			.andWhere('item.externalSource = :externalSource', { externalSource: INBOX_NOTIFICATION_EXTERNAL_SOURCE })
			.andWhere('item.externalId IN (:...externalIds)', {
				externalIds: notifications.map((row) => String(row.id))
			})
			.getRawMany()) as Array<{ externalId: string }>;
		return new Set(rows.map((row) => String(row.externalId)));
	}
}
