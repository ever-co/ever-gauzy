import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import { IMeasurementAuditReport, MeasurementAuditService } from './measurement-audit.service';

/** The scheduled entry's name, which is also the key its run is recorded under. */
export const MEASUREMENT_AUDIT_SCHEDULE = 'measurement-audit-schedule';

/**
 * The nightly run of the measurement audit.
 *
 * It exists because the audit is the compensating measure for the rules a dialect cannot state. The
 * write path refuses a row that would break one, but a row can reach the table by a path the write
 * path does not guard — an import, a data fix applied by hand, a restore, or a constraint the
 * dialect declined to add — and nothing on the write path will ever see it again. A rule that is only
 * enforced going forward is a rule with no answer for what is already there, and this is that answer.
 *
 * It runs at two in the morning, in the deployment's own time zone, and it is scheduled rather than
 * fanned out to a queue: the work is a handful of set-based counts over the kernel's own tables, it
 * holds nothing, and it must not compete with the request path for a worker. `preventOverlap` is set
 * because a second run started while the first is still counting would double the load to produce
 * the same report.
 *
 * A failure inside the run is caught and logged rather than allowed out. The scheduler's own retry
 * record is about the schedule; a database that was briefly unreachable at two in the morning should
 * not also mark the job as broken, because the next night's run is the retry.
 */
@Injectable()
export class MeasurementAuditScheduler {
	private readonly logger = new Logger(MeasurementAuditScheduler.name);

	constructor(private readonly audit: MeasurementAuditService) {}

	/**
	 * Runs the audit once.
	 *
	 * @returns The report, so the run is observable from a test as well as from the log.
	 */
	@ScheduledJob({
		name: MEASUREMENT_AUDIT_SCHEDULE,
		description:
			'Checks every declared unit reference for rows the dialect cannot constrain, and reports them.',
		cron: CronExpression.EVERY_DAY_AT_2AM,
		preventOverlap: true
	})
	async runMeasurementAudit(): Promise<IMeasurementAuditReport | undefined> {
		try {
			return await this.audit.audit();
		} catch (error) {
			this.logger.error(`The measurement audit could not run: ${describe(error)}`);

			return undefined;
		}
	}
}

/**
 * @param error The failure.
 * @returns A one-line description.
 */
function describe(error: unknown): string {
	return error instanceof Error ? error.message.split('\n')[0] : String(error);
}
