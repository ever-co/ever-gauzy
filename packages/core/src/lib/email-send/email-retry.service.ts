import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
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
	EMAIL_RETRY_SWEEP_MS,
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
	/**
	 * Whether the sweep stopped at the installation-wide cap: `EMAIL_RETRY_BATCH_SIZE` rows had been claimed in the
	 * last `EMAIL_RETRY_SWEEP_MS`, by this process or any other. The rest waits for a later sweep.
	 */
	capped: boolean;
}

/** An `Email` instance as far as the retry uses it. */
interface IEmailInstance {
	send(options: unknown): Promise<unknown>;
}

/** The injection token of {@link IEmailRetryTiming}, for a deployment or a spec that sets the sweep's clock. */
export const EMAIL_RETRY_TIMING = Symbol('EMAIL_RETRY_TIMING');

/** The sweep's clock and waits: the real ones by default, a spec's own to stay deterministic. */
export interface IEmailRetryTiming {
	/** The current moment. */
	now?: () => Date;
	/** Waits `ms` milliseconds. */
	sleep?: (ms: number) => Promise<void>;
	/**
	 * The waits between the attempts to record a sent retry as SENT: one more attempt per entry. Never a second send.
	 */
	sentWriteDelaysMs?: readonly number[];
}

/** By default the SENT write is tried 3 times, 1 s and then 2 s apart. */
const SENT_WRITE_DELAYS_MS: readonly number[] = Object.freeze([1_000, 2_000]);

/** The `lastErrorCode` of a claimed row that reached the maximum age before its send started. */
export const EMAIL_RETRY_EXPIRED_CODE = 'EXPIRED';

/** How a claimed retry's send went. */
type SendOutcome =
	| { kind: 'sent' }
	| { kind: 'expired' }
	| { kind: 'failed'; error: unknown; instance: IEmailInstance | undefined; failedAt: Date };

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
 *   rather than risked twice, since a message the server may have accepted cannot be taken back. Nothing ever gives
 *   a claimed row back.
 * - **Never a burst, for the whole installation.** Every claim stamps `lastRetryAt` with the moment it is made, and
 *   before each claim the sweep counts, at that moment, the rows of the whole table stamped in the last
 *   `EMAIL_RETRY_SWEEP_MS`, by any process and whatever their status now. Once that count has reached
 *   `EMAIL_RETRY_BATCH_SIZE`, the sweep stops and the rest waits for a later one. So the cap holds across every API
 *   process, with or without a queue (the queue only adds that one sweep runs at a time), and for a slow sweep as for
 *   a quick one. Processes that count at the same moment can each still claim one row: the bound is
 *   `EMAIL_RETRY_BATCH_SIZE` plus one per process sweeping at that moment beyond the first, never a batch per
 *   process. Within a sweep the emails go one after another, and no claim is made once its time budget is spent
 *   (checked again after the count). A count that cannot be read stops the sweep before any claim.
 * - **Never late.** The maximum age is checked against the clock at the claim, and again once the mail settings are
 *   read, right before the message goes: a row that reaches it meanwhile is not sent (`lastErrorCode` `EXPIRED`). The
 *   next retry of a row that failed again is due one backoff after that failure, and is not scheduled past the age.
 * - **The same message, through the same mail settings.** The row keeps the subject and HTML the original send
 *   rendered, and the retry hands them to the transport of the row's organization and tenant (`getEmailInstance`, as
 *   the manual resend does), with no template rendered again. Under DB_ORM=mikro-orm the mail settings are read
 *   through MikroORM, so each send runs in a MikroORM context of its own; the rows are read and claimed through
 *   TypeORM, which this platform initialises under both ORMs.
 * - **Sent once, recorded after.** A send that went through is recorded as `SENT` by a write that is tried again a
 *   few times if the store refuses it, and only while the row is still this sweep's; the message is never sent again.
 * - **What it did, without whom.** The log names the row, the template and the error code, never an address or the
 *   content.
 *
 * 🛑 **Runtime only — never reachable from a request.** It reads every tenant's rows.
 */
@Injectable()
export class EmailRetryService {
	private readonly logger = new Logger(EmailRetryService.name);
	private readonly clock: () => Date;
	private readonly sleep: (ms: number) => Promise<void>;
	private readonly sentWriteDelaysMs: readonly number[];

	constructor(
		private readonly typeOrmEmailHistoryRepository: TypeOrmEmailHistoryRepository,
		private readonly emailSendService: EmailSendService,
		/** Opens the MikroORM request context a retry is sent in under DB_ORM=mikro-orm. */
		@Optional() private readonly orm?: MikroORM,
		@Optional() @Inject(EMAIL_RETRY_TIMING) timing?: IEmailRetryTiming
	) {
		this.clock = timing?.now ?? (() => new Date());
		this.sleep = timing?.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
		this.sentWriteDelaysMs = timing?.sentWriteDelaysMs ?? SENT_WRITE_DELAYS_MS;
	}

	/**
	 * Sends the retries that are due, oldest first, one after another, until the batch is done, the time budget is
	 * spent or the installation-wide cap is reached; the rest wait for a later sweep. Does nothing while retries are
	 * off.
	 *
	 * @param now The moment the retries are due at: which rows are candidates, and how due a claim requires them to be.
	 * Every other decision (the cap, the age, the stamps, the backoff) reads the clock when it is made.
	 * @param budgetMs How long the sweep may keep claiming.
	 * @returns What it did.
	 * @throws When the due rows or the count of recent claims could not be read: nothing more is sent, and the queue's
	 * own failure handling sees it.
	 */
	async sweep(
		now: Date = this.clock(),
		budgetMs: number = EMAIL_RETRY_SWEEP_TIME_BUDGET_MS
	): Promise<IEmailRetrySweepReport> {
		const report: IEmailRetrySweepReport = {
			due: 0,
			sent: 0,
			rescheduled: 0,
			gaveUp: 0,
			taken: 0,
			dropped: 0,
			capped: false
		};
		if (!isEmailRetryEnabled(process.env, (message) => this.logger.warn(message))) {
			return report;
		}

		const due = await this.findDue(now);
		report.due = due.length;
		const deadline = this.clock().getTime() + budgetMs;
		for (const row of due) {
			if (this.clock().getTime() >= deadline) {
				break;
			}
			// Before each claim, at this moment, and outside the per-row catch: a count that cannot be read stops the
			// sweep unsent.
			if ((await this.claimedInThePeriod(this.clock())) >= EMAIL_RETRY_BATCH_SIZE) {
				report.capped = true;
				break;
			}
			// The count may have taken a while: no claim once the budget is spent.
			if (this.clock().getTime() >= deadline) {
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
					`${report.taken} taken elsewhere, ${report.dropped} dropped, of ${report.due} due` +
					(report.capped ? '; stopped at the installation-wide cap, the rest waits for a later sweep' : '')
			);
		}
		return report;
	}

	/** The rows whose retry is due at `now`, oldest due first, at most a batch. */
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
			.andWhere('email.createdAt >= :since', { since: oldestRetriedAt(now) })
			.orderBy('email.nextRetryAt', 'ASC')
			.limit(EMAIL_RETRY_BATCH_SIZE)
			.getMany();
	}

	/**
	 * How many rows were claimed for a retry in the period that ends at `at`, by any process, whatever their status
	 * now: the installation-wide count the cap is checked against. Soft-deleted rows count too, since their claim was
	 * made. Read only while a retry is due, at most once per claim.
	 */
	private claimedInThePeriod(at: Date): Promise<number> {
		return this.typeOrmEmailHistoryRepository.count({
			where: { lastRetryAt: MoreThanOrEqual(new Date(at.getTime() - EMAIL_RETRY_SWEEP_MS)) },
			withDeleted: true
		});
	}

	/** Claims one due row, then sends it, or takes it out of the retries when it is not to be sent. */
	private async retry(row: EmailHistory, now: Date, report: IEmailRetrySweepReport): Promise<void> {
		// The claim's criteria are built from these: TypeORM drops an `undefined` criterion rather than matching it.
		if (typeof row.id !== 'string' || !row.id || !Number.isInteger(row.retryCount)) {
			report.dropped += 1;
			return;
		}
		const template = row.emailTemplate?.name;
		// A row that reached the maximum age while the ones before it were sent: never claimed, never read again.
		if (isPastMaxAge(row, this.clock())) {
			this.logger.warn(`Email ${row.id} ("${template}") reached the maximum age before its retry: not sent.`);
			report.dropped += 1;
			return;
		}
		if (!(await this.claim(row, now))) {
			report.taken += 1;
			return;
		}
		if (!isEmailRetryTemplate(template) || !row.email || !row.name || !row.content?.trim()) {
			this.logger.warn(`Email ${row.id} ("${template}") was taken out of the automatic retries unsent.`);
			report.dropped += 1;
			return;
		}
		await this.send(row, report);
	}

	/**
	 * Takes a row for one retry: one conditional write, so the store settles a race between two sweeps that read the
	 * row together. It matches only while the row is failed, due at the sweep's moment, younger than the maximum age at
	 * the claim's moment, and still on the retry that was read; it moves `retryCount` on and clears `nextRetryAt`, so no
	 * other sweep matches it after, and stamps `lastRetryAt` with the claim's moment, which the installation-wide cap
	 * counts (a claim counts whether or not it then sends).
	 *
	 * @param row The row as the sweep read it.
	 * @param now The sweep's moment, which the row must be due at.
	 * @returns True when this sweep holds the row.
	 */
	private async claim(row: EmailHistory, now: Date): Promise<boolean> {
		const claimedAt = this.clock();
		const result = await this.typeOrmEmailHistoryRepository.update(
			{
				id: row.id,
				status: EmailStatusEnum.FAILED,
				retryCount: row.retryCount,
				// One second of slack: MySQL keeps this column to the second, rounded, so a row made due just now can
				// read up to half a second ahead.
				nextRetryAt: LessThanOrEqual(new Date(now.getTime() + 1_000)),
				createdAt: MoreThanOrEqual(oldestRetriedAt(claimedAt))
			} as FindOptionsWhere<EmailHistory>,
			{ retryCount: row.retryCount + 1, nextRetryAt: null, lastRetryAt: claimedAt }
		);
		return readAffectedRows(result) === 1;
	}

	/**
	 * Sends a claimed row's stored message through its organization's and tenant's mail settings, then records how it
	 * went. The age is checked again once the mail settings are read, right before the message goes.
	 */
	private async send(row: EmailHistory, report: IEmailRetrySweepReport): Promise<void> {
		const attempt = row.retryCount + 1;
		const template = row.emailTemplate?.name;
		const outcome = await runInMikroOrmContext(this.orm, async (): Promise<SendOutcome> => {
			let instance: IEmailInstance | undefined;
			try {
				instance = (await this.emailSendService.getEmailInstance({
					organizationId: (row.organizationId ?? null) as ID,
					tenantId: (row.tenantId ?? null) as ID
				})) as IEmailInstance;
				if (isPastMaxAge(row, this.clock())) {
					return { kind: 'expired' };
				}
				await instance.send({ message: { to: row.email, subject: row.name, html: row.content } });
				return { kind: 'sent' };
			} catch (error) {
				return { kind: 'failed', error, instance, failedAt: this.clock() };
			}
		});

		switch (outcome.kind) {
			case 'sent':
				report.sent += 1;
				this.logger.log(`Email ${row.id} ("${template}") was sent on automatic retry ${attempt}.`);
				await this.recordSent(row, attempt);
				return;
			case 'expired':
				await this.whileOurs(row, attempt, { lastErrorCode: EMAIL_RETRY_EXPIRED_CODE });
				report.dropped += 1;
				this.logger.warn(`Email ${row.id} ("${template}") reached the maximum age before it went: not sent.`);
				return;
			case 'failed':
				await this.settleFailure(row, attempt, outcome, report);
				return;
		}
	}

	/**
	 * Records a sent retry as `SENT`, while the row is still this sweep's. A write the store refuses is tried again
	 * after each of `sentWriteDelaysMs`; the message is never sent again. A write that never goes through leaves the row
	 * claimed and failed, which no sweep sends again, and is logged by the row's id alone.
	 */
	private async recordSent(row: EmailHistory, attempt: number): Promise<void> {
		for (let tries = 0; tries <= this.sentWriteDelaysMs.length; tries++) {
			if (tries > 0) {
				await this.sleep(this.sentWriteDelaysMs[tries - 1]);
			}
			try {
				await this.whileOurs(row, attempt, { status: EmailStatusEnum.SENT });
				return;
			} catch {
				// Tried again below, or logged once the attempts are spent.
			}
		}
		this.logger.error(`Email ${row.id} was sent on its automatic retry but could not be recorded as sent.`);
	}

	/**
	 * Records a retry that failed: with its next retry due one backoff after the failure when the failure is one a
	 * retry can fix, retries are left and that moment is within the maximum age; otherwise with none, for good. Written
	 * only while the row is still this sweep's (failed, not due, on this retry), so a row re-sent by hand meanwhile is
	 * not put back in the retries.
	 */
	private async settleFailure(
		row: EmailHistory,
		attempt: number,
		failure: { error: unknown; instance: IEmailInstance | undefined; failedAt: Date },
		report: IEmailRetrySweepReport
	): Promise<void> {
		const template = row.emailTemplate?.name;
		const lastErrorCode = emailSendErrorCode(failure.error);
		const transient = !!smtpTransportOf(failure.instance) && classifyEmailSendError(failure.error).retry;
		const nextAt = transient ? emailRetryDueAt(attempt, failure.failedAt) : null;
		const dueAt = nextAt && !isPastMaxAge(row, nextAt) ? nextAt : null;

		const written = await this.whileOurs(
			row,
			attempt,
			dueAt ? { nextRetryAt: dueAt, lastErrorCode } : { lastErrorCode }
		);
		if (dueAt && written) {
			report.rescheduled += 1;
			this.logger.warn(
				`Email ${row.id} ("${template}") failed again on automatic retry ${attempt} (${lastErrorCode}); ` +
					`the next is due at ${dueAt.toISOString()}.`
			);
			return;
		}
		report.gaveUp += 1;
		this.logger.warn(
			`Email ${row.id} ("${template}") failed on automatic retry ${attempt} and is not retried again: ` +
				describeEmailSendError(failure.error)
		);
	}

	/**
	 * Writes `values` on a claimed row while it is still this sweep's: failed, with no retry due, on the retry this
	 * sweep claimed. A row re-sent by hand meanwhile (its status or its retry time changed) is left as it is.
	 *
	 * @returns Whether the row was written.
	 */
	private async whileOurs(
		row: EmailHistory,
		attempt: number,
		values: { status?: EmailStatusEnum; nextRetryAt?: Date; lastErrorCode?: string }
	): Promise<boolean> {
		const result = await this.typeOrmEmailHistoryRepository.update(
			{
				id: row.id,
				status: EmailStatusEnum.FAILED,
				retryCount: attempt,
				nextRetryAt: IsNull()
			} as FindOptionsWhere<EmailHistory>,
			values
		);
		return readAffectedRows(result) === 1;
	}
}

/** The oldest original send a retry is still made for at `at`. */
function oldestRetriedAt(at: Date): Date {
	return new Date(at.getTime() - EMAIL_RETRY_MAX_AGE_MS);
}

/** Whether `at` is past the maximum age of a row's original send; a send time that cannot be read is past it. */
function isPastMaxAge(row: EmailHistory, at: Date): boolean {
	const sentAt = new Date(row.createdAt).getTime();
	return !Number.isFinite(sentAt) || at.getTime() > sentAt + EMAIL_RETRY_MAX_AGE_MS;
}
