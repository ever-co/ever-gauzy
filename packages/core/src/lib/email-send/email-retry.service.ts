import { Injectable, Logger, Optional } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { FindOptionsWhere, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { EmailStatusEnum, ID } from '@gauzy/contracts';
import { runInMikroOrmContext } from '../core/context/mikro-orm-context';
import { EmailHistory } from '../core/entities/internal';
import { readAffectedRows } from '../database/database.helper';
import { TypeOrmEmailHistoryRepository } from '../email-history/repository/type-orm-email-history.repository';
import { describeEmailSendError } from './email-send-error';
import { EmailSendService } from './email-send.service';
import {
	classifyEmailSendError,
	EMAIL_RETRY_BATCH_SIZE,
	EMAIL_RETRY_MAX_AGE_MS,
	EMAIL_RETRY_MAX_ATTEMPTS,
	EMAIL_RETRY_SWEEP_TIME_BUDGET_MS,
	emailRetryDueAt,
	emailSendErrorCode,
	isEmailRetryEnabled,
	isEmailRetryTemplate,
	smtpTransportOf
} from './email-retry.policy';

/** What one sweep did. */
export interface IEmailRetrySweepReport {
	/** The failed emails whose retry was due. */
	due: number;
	/** Sent on this retry. */
	sent: number;
	/** Failed again for a reason a retry can fix, and given their next retry. */
	rescheduled: number;
	/** Failed again for another reason, or on their last retry: never retried again. */
	gaveUp: number;
	/** Claimed by another sweep, or re-sent by hand, between the read and the claim: not sent by this sweep. */
	taken: number;
	/** Taken out of the retries without a send: a template no longer retried, or nothing left to send. */
	dropped: number;
}

/** An `Email` instance as far as the retry uses it. */
interface IEmailInstance {
	send(options: unknown): Promise<unknown>;
}

/**
 * Sends again the failed emails whose automatic retry is due (see `email-retry.policy.ts` for which ones and how
 * often). Asked for by the queue's worker every five minutes, or by an in-process timer in an API without a queue.
 *
 * - **Only rows scheduled for a retry.** A row is due when it is `FAILED`, has a `nextRetryAt` that has come, has
 *   retries left, and is younger than the maximum age. `nextRetryAt` is set only by a send that failed before the
 *   server accepted the message (`EmailService`), so a row written before the retry existed, or one that failed for
 *   any other reason, is never read here.
 * - **Claimed before it is sent, by one process.** One conditional `UPDATE` moves `retryCount` on and clears
 *   `nextRetryAt`, and it matches only while the row is still failed, due, young enough and on the retry that was
 *   read: of two sweeps that read a row together, one changes it and sends it, the other changes nothing and sends
 *   nothing. A process that stops between its claim and its send leaves the row with no retry due: that email is lost
 *   rather than risked twice, since a message the server may have accepted cannot be taken back.
 * - **Never a burst.** At most `EMAIL_RETRY_BATCH_SIZE` emails a sweep, one after another, and no new send once the
 *   sweep's time budget is spent; the queue holds at most one sweep at a time for the whole installation.
 * - **The same message, through the same mail settings.** The row keeps the subject and HTML the original send
 *   rendered, and the retry hands them to the transport of the row's organization and tenant (`getEmailInstance`, as
 *   the manual resend does), with no template rendered again. Under DB_ORM=mikro-orm the mail settings are read
 *   through MikroORM, so each send runs in a MikroORM context of its own; the rows are read and claimed through
 *   TypeORM, which this platform initialises under both ORMs.
 * - **What it did, without whom.** The log names the row, the template and the error code, never an address or the
 *   content.
 *
 * 🛑 **Runtime only — never reachable from a request.** It reads every tenant's rows.
 */
@Injectable()
export class EmailRetryService {
	private readonly logger = new Logger(EmailRetryService.name);

	constructor(
		private readonly typeOrmEmailHistoryRepository: TypeOrmEmailHistoryRepository,
		private readonly emailSendService: EmailSendService,
		/** Opens the MikroORM request context a retry is sent in under DB_ORM=mikro-orm. */
		@Optional() private readonly orm?: MikroORM
	) {}

	/**
	 * Sends the retries that are due, oldest first, one after another, until the batch is done or the time budget is
	 * spent; the rest wait for the next sweep. Does nothing while retries are off.
	 *
	 * @param now The moment the retries are due at.
	 * @param budgetMs How long the sweep may keep starting sends.
	 * @returns What it did.
	 * @throws When the due rows could not be read: nothing was sent, and the queue's own failure handling sees it.
	 */
	async sweep(
		now: Date = new Date(),
		budgetMs: number = EMAIL_RETRY_SWEEP_TIME_BUDGET_MS
	): Promise<IEmailRetrySweepReport> {
		const report: IEmailRetrySweepReport = { due: 0, sent: 0, rescheduled: 0, gaveUp: 0, taken: 0, dropped: 0 };
		if (!isEmailRetryEnabled(process.env, (message) => this.logger.warn(message))) {
			return report;
		}

		const due = await this.findDue(now);
		report.due = due.length;
		const startedAt = Date.now();
		for (const row of due) {
			if (Date.now() - startedAt >= budgetMs) {
				break;
			}
			try {
				await this.retry(row, now, report);
			} catch (error) {
				// A write the store refused. The row keeps what it had: claimed rows are never sent again.
				this.logger.error(
					`The retry of email ${row.id} could not be settled: ${describeEmailSendError(error)}`
				);
			}
		}

		if (report.due > 0) {
			this.logger.log(
				`Email retries: ${report.sent} sent, ${report.rescheduled} rescheduled, ${report.gaveUp} given up, ` +
					`${report.taken} taken elsewhere, ${report.dropped} dropped, of ${report.due} due`
			);
		}
		return report;
	}

	/** The rows whose retry is due, oldest due first, at most a batch. */
	private findDue(now: Date): Promise<EmailHistory[]> {
		return this.typeOrmEmailHistoryRepository
			.createQueryBuilder('email')
			.innerJoin('email.emailTemplate', 'template')
			.select([
				'email.id',
				'email.tenantId',
				'email.organizationId',
				'email.email',
				'email.name',
				'email.content',
				'email.retryCount',
				'email.nextRetryAt',
				'email.createdAt',
				'template.id',
				'template.name'
			])
			.where('email.status = :status', { status: EmailStatusEnum.FAILED })
			.andWhere('email.nextRetryAt IS NOT NULL')
			.andWhere('email.nextRetryAt <= :now', { now })
			.andWhere('email.retryCount < :retries', { retries: EMAIL_RETRY_MAX_ATTEMPTS - 1 })
			.andWhere('email.createdAt >= :since', { since: this.oldestRetried(now) })
			.orderBy('email.nextRetryAt', 'ASC')
			.limit(EMAIL_RETRY_BATCH_SIZE)
			.getMany();
	}

	/** Claims one due row, then sends it, or takes it out of the retries when it is not to be sent. */
	private async retry(row: EmailHistory, now: Date, report: IEmailRetrySweepReport): Promise<void> {
		// The claim's criteria are built from these: TypeORM drops an `undefined` criterion rather than matching it.
		if (typeof row.id !== 'string' || !row.id || !Number.isInteger(row.retryCount)) {
			report.dropped += 1;
			return;
		}
		if (!(await this.claim(row, now))) {
			report.taken += 1;
			return;
		}
		const template = row.emailTemplate?.name;
		if (!isEmailRetryTemplate(template) || !row.email || !row.name || !row.content?.trim()) {
			this.logger.warn(`Email ${row.id} ("${template}") was taken out of the automatic retries unsent.`);
			report.dropped += 1;
			return;
		}
		await this.send(row, now, report);
	}

	/**
	 * Takes a row for one retry: one conditional write, so the store settles a race between two sweeps that read the
	 * row together. It matches only while the row is failed, due, young enough and still on the retry that was read,
	 * moves `retryCount` on and clears `nextRetryAt`, so no other sweep matches it after.
	 *
	 * @returns True when this sweep holds the row.
	 */
	private async claim(row: EmailHistory, now: Date): Promise<boolean> {
		const result = await this.typeOrmEmailHistoryRepository.update(
			{
				id: row.id,
				status: EmailStatusEnum.FAILED,
				retryCount: row.retryCount,
				// One second of slack: MySQL keeps this column to the second, rounded, so a row made due just now can
				// read up to half a second ahead.
				nextRetryAt: LessThanOrEqual(new Date(now.getTime() + 1_000)),
				createdAt: MoreThanOrEqual(this.oldestRetried(now))
			} as FindOptionsWhere<EmailHistory>,
			{ retryCount: row.retryCount + 1, nextRetryAt: null }
		);
		return readAffectedRows(result) === 1;
	}

	/** Sends a claimed row's stored message through its organization's and tenant's mail settings, then records how it went. */
	private async send(row: EmailHistory, now: Date, report: IEmailRetrySweepReport): Promise<void> {
		const attempt = row.retryCount + 1;
		const template = row.emailTemplate?.name;
		let instance: IEmailInstance | undefined;
		try {
			await runInMikroOrmContext(this.orm, async () => {
				instance = (await this.emailSendService.getEmailInstance({
					organizationId: (row.organizationId ?? null) as ID,
					tenantId: (row.tenantId ?? null) as ID
				})) as IEmailInstance;
				await instance.send({ message: { to: row.email, subject: row.name, html: row.content } });
			});
		} catch (error) {
			await this.settleFailure(row, attempt, error, instance, now, report);
			return;
		}
		await this.typeOrmEmailHistoryRepository.update({ id: row.id }, { status: EmailStatusEnum.SENT });
		report.sent += 1;
		this.logger.log(`Email ${row.id} ("${template}") was sent on automatic retry ${attempt}.`);
	}

	/**
	 * Records a retry that failed: with its next retry due when the failure is one a retry can fix, retries are left and
	 * the next one would not come after the maximum age; otherwise with none, for good. The next retry is written only
	 * while the row is still this sweep's (failed, not due, on this retry), so a row re-sent by hand meanwhile is not
	 * put back in the retries.
	 */
	private async settleFailure(
		row: EmailHistory,
		attempt: number,
		error: unknown,
		instance: IEmailInstance | undefined,
		now: Date,
		report: IEmailRetrySweepReport
	): Promise<void> {
		const template = row.emailTemplate?.name;
		const lastErrorCode = emailSendErrorCode(error);
		const transient = !!smtpTransportOf(instance) && classifyEmailSendError(error).retry;
		let dueAt = transient ? emailRetryDueAt(attempt, now) : null;
		if (dueAt && dueAt.getTime() > new Date(row.createdAt).getTime() + EMAIL_RETRY_MAX_AGE_MS) {
			dueAt = null;
		}

		if (dueAt) {
			const result = await this.typeOrmEmailHistoryRepository.update(
				{
					id: row.id,
					status: EmailStatusEnum.FAILED,
					retryCount: attempt,
					nextRetryAt: IsNull()
				} as FindOptionsWhere<EmailHistory>,
				{ nextRetryAt: dueAt, lastErrorCode }
			);
			if (readAffectedRows(result) === 1) {
				report.rescheduled += 1;
				this.logger.warn(
					`Email ${row.id} ("${template}") failed again on automatic retry ${attempt} (${lastErrorCode}); ` +
						`the next is due at ${dueAt.toISOString()}.`
				);
				return;
			}
		} else {
			await this.typeOrmEmailHistoryRepository.update({ id: row.id }, { lastErrorCode });
		}
		report.gaveUp += 1;
		this.logger.warn(
			`Email ${row.id} ("${template}") failed on automatic retry ${attempt} and is not retried again: ` +
				describeEmailSendError(error)
		);
	}

	/** The oldest original send a retry is still made for. */
	private oldestRetried(now: Date): Date {
		return new Date(now.getTime() - EMAIL_RETRY_MAX_AGE_MS);
	}
}
