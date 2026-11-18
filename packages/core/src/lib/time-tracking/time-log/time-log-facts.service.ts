import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { IOutboxWriteInput, ITimeLog } from '@gauzy/contracts';
import { MultiORMEnum, getORMType } from '../../core/utils';
import { locksRowsForChange } from './time-log-history.writer';
import { EventOutboxService } from '../../event-outbox/event-outbox.service';
import { declareStreamedEvents } from '../../graphql/subscriptions/plugin-subscription';
import { SubscriptionCatalogue } from '../../graphql/subscriptions/subscription-catalogue';
import { GraphqlSubscriptionConsumer } from '../../graphql/subscriptions/subscription-consumer';

/** A time entry that starts running: a timer start. */
export const TIME_LOG_STARTED = 'time_log.started';
/** A running time entry that stops: a timer stop, a stop another start makes, a stale run closed. */
export const TIME_LOG_STOPPED = 'time_log.stopped';
/** A time entry created already finished: time added by hand, by a tracker or by an integration. */
export const TIME_LOG_CREATED = 'time_log.created';
/** A time entry changed in any other way: its range, its project, its task, its employee. */
export const TIME_LOG_UPDATED = 'time_log.updated';
/** A time entry deleted, a discarded timer included. */
export const TIME_LOG_DELETED = 'time_log.deleted';

/**
 * The time entry facts, as a catalogue the subscription gate (`tools/scripts/subscription-parity-check.mjs`) reads, so
 * that a webhook subscribed to `time_log.*` receives them.
 */
export const TIME_LOG_STREAMED_EVENTS: readonly string[] = [
	'time_log.started',
	'time_log.stopped',
	'time_log.created',
	'time_log.updated',
	'time_log.deleted'
];

/** The aggregate every `time_log.*` outbox row is written under. */
export const TIME_LOG_AGGREGATE_TYPE = 'TIME_LOG';

/**
 * What a `time_log.*` fact carries: the entry's ids and times, never its description or the reason given for an edit.
 */
export function timeLogFactData(timeLog: Partial<ITimeLog>): Record<string, unknown> {
	return {
		timeLogId: timeLog.id,
		employeeId: timeLog.employeeId ?? null,
		projectId: timeLog.projectId ?? null,
		taskId: timeLog.taskId ?? null,
		organizationContactId: timeLog.organizationContactId ?? null,
		organizationTeamId: timeLog.organizationTeamId ?? null,
		startedAt: timeLog.startedAt ?? null,
		stoppedAt: timeLog.stoppedAt ?? null,
		isRunning: timeLog.isRunning ?? null,
		isBillable: timeLog.isBillable ?? null,
		source: timeLog.source ?? null,
		logType: timeLog.logType ?? null
	};
}

/**
 * Writes the time entry facts to the event outbox, so that the signed webhooks deliver them.
 *
 * A fact commits with the write it tells of, as the outbox asks (`EventOutboxService.append`): it is appended in the
 * transaction of that write, through a savepoint ({@link recordWithin}). Two cases have no such transaction, and
 * there the fact is appended right after the write, in a transaction of its own ({@link record}): under MikroORM,
 * where the entries are written through TypeORM while the outbox writes through MikroORM, and on SQLite, where a
 * transaction begun beside another request's nests into it (see `locksRowsForChange`). A fact that cannot be written
 * is logged and never fails the write of a person's time.
 */
@Injectable()
export class TimeLogFactsService implements OnModuleInit {
	private readonly logger = new Logger(TimeLogFactsService.name);

	constructor(
		private readonly outbox: EventOutboxService,
		private readonly catalogue: SubscriptionCatalogue,
		@Optional() private readonly consumer?: GraphqlSubscriptionConsumer,
		@Optional() private readonly dataSource?: DataSource
	) {}

	/**
	 * Declares {@link TIME_LOG_STREAMED_EVENTS}, and has the outbox consumer listen for them.
	 */
	onModuleInit(): void {
		declareStreamedEvents(this.catalogue, this.consumer, ...TIME_LOG_STREAMED_EVENTS);
	}

	/**
	 * Whether the facts are appended in the transaction of their write ({@link recordWithin}): the entries and the
	 * outbox are written through TypeORM, on a database that locks rows. Otherwise {@link record} appends them after.
	 */
	appendsWithinWrites(): boolean {
		return getORMType() === MultiORMEnum.TypeORM && locksRowsForChange();
	}

	/**
	 * Appends one fact about a time entry in the transaction of its write, through a savepoint: it commits with the
	 * write, and a fact that cannot be written is undone alone and logged. Never throws.
	 *
	 * @param manager The manager of the write's open TypeORM transaction.
	 * @param name One of the `time_log.*` names above.
	 * @param timeLog The entry as the write left it, with its tenant and organization.
	 */
	async recordWithin(
		manager: EntityManager,
		name: string,
		timeLog: Partial<ITimeLog> | null | undefined
	): Promise<void> {
		if (!timeLog?.id) {
			return;
		}
		try {
			await manager.transaction((savepoint) => this.outbox.append(savepoint, factInput(name, timeLog)));
		} catch (error) {
			this.warnNotWritten(name, timeLog, error);
		}
	}

	/**
	 * Appends one fact about a time entry right after its write, in a transaction of its own: for a write that runs in
	 * no transaction the outbox can share (see {@link appendsWithinWrites}). Never throws.
	 *
	 * @param name One of the `time_log.*` names above.
	 * @param timeLog The entry as the write left it, with its tenant and organization.
	 */
	async record(name: string, timeLog: Partial<ITimeLog> | null | undefined): Promise<void> {
		if (!timeLog?.id) {
			return;
		}
		try {
			await this.append(factInput(name, timeLog));
		} catch (error) {
			this.warnNotWritten(name, timeLog, error);
		}
	}

	private warnNotWritten(name: string, timeLog: Partial<ITimeLog>, error: unknown): void {
		this.logger.warn(`The ${name} fact of time entry ${timeLog.id} was not written: ${(error as Error)?.message}`);
	}

	/**
	 * Appends through the ORM `DB_ORM` configures (under MikroORM the outbox's TypeORM entity maps its base columns
	 * only, so the row is written through MikroORM), in a transaction of its own.
	 */
	private async append(input: IOutboxWriteInput): Promise<void> {
		if (getORMType() === MultiORMEnum.MikroORM) {
			const em = this.outbox.mikroOrmEventOutboxRepository?.getEntityManager?.();
			if (em) {
				await em.fork().transactional((transaction) => this.outbox.append(transaction as never, input));
				return;
			}
		}
		if (!this.dataSource) {
			return;
		}
		await this.dataSource.manager.transaction((manager) => this.outbox.append(manager, input));
	}
}

/** The outbox row of one fact about a time entry. */
function factInput(name: string, timeLog: Partial<ITimeLog>): IOutboxWriteInput {
	return {
		name,
		aggregateType: TIME_LOG_AGGREGATE_TYPE,
		aggregateId: timeLog.id,
		data: timeLogFactData(timeLog),
		tenantId: timeLog.tenantId,
		organizationId: timeLog.organizationId
	} as IOutboxWriteInput;
}

/** The fact of an entry just created: a running one starts, a finished one is created. */
export function factOfCreatedLog(timeLog: Partial<ITimeLog>): string {
	if (timeLog.isRunning) {
		return TIME_LOG_STARTED;
	}
	return TIME_LOG_CREATED;
}

/** The fact of an entry just updated: a stop of a run, or another change. */
export function factOfUpdatedLog(stopsRun: boolean): string {
	if (stopsRun) {
		return TIME_LOG_STOPPED;
	}
	return TIME_LOG_UPDATED;
}
