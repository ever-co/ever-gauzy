import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, In, Not } from 'typeorm';
import * as moment from 'moment';
import 'moment-timezone';
import { ID, IInvoiceScheduleRun, InvoiceScheduleGroupingEnum, InvoiceScheduleRunStatusEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { Organization, OrganizationContact } from '../core/entities/internal';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { invoiceTimeZoneOf } from '../invoice/invoice-date.util';
import {
	CreateInvoiceScheduleDTO,
	InvoiceScheduleListQueryDTO,
	MAX_INVOICE_SCHEDULE_RUNS_PER_PAGE,
	UpdateInvoiceScheduleDTO
} from './dto/invoice-schedule.dto';
import { InvoiceScheduleRun } from './invoice-schedule-run.entity';
import { InvoiceSchedule } from './invoice-schedule.entity';
import { duePeriodOf, isRealDay, nextPeriodOf, periodView } from './invoice-schedule.rules';
import { MikroOrmInvoiceScheduleRepository } from './repository/mikro-orm-invoice-schedule.repository';
import { TypeOrmInvoiceScheduleRepository } from './repository/type-orm-invoice-schedule.repository';

/** The refusal of a second schedule for a client. */
export const INVOICE_SCHEDULE_EXISTS =
	'INVOICE_SCHEDULE_EXISTS: this client already has a billing schedule. Change that one instead.';

/** The refusal of a start day that does not exist, or that is too late for its periods to be counted. */
export const INVOICE_SCHEDULE_START_DAY =
	'INVOICE_SCHEDULE_START_DAY: the start day must be a day that exists, written YYYY-MM-DD, no later than 9998-12-31.';

/**
 * The last start day a schedule takes: its first period, a month at most, must end on a day that can be written
 * `YYYY-MM-DD`. A start day in 9999 would put its run day in the year 10000, which no day key spells, and every read of
 * the organization's schedules would fail on it.
 */
const LAST_START_DAY = '9998-12-31';

/**
 * The refusal of a new timeline (frequency or start day) that would bill again days a run already billed: it starts
 * after the last period billed.
 */
export const INVOICE_SCHEDULE_START_AFTER_BILLED =
	'INVOICE_SCHEDULE_START_AFTER_BILLED: a schedule that already billed periods can only change its timeline from a ' +
	'start day after the last period billed.';

/** The refusal of a client that is not one of the organization's. */
export const INVOICE_SCHEDULE_CLIENT = 'INVOICE_SCHEDULE_CLIENT: no such client in this organization.';

/** How many runs a read of a schedule's runs answers when it does not say. */
const DEFAULT_RUNS_PER_PAGE = 12;

/** What an invoice is read with beside its run: enough to list it and open it. */
const RUN_INVOICE_FIELDS = {
	id: true,
	invoiceNumber: true,
	status: true,
	totalValue: true,
	currency: true,
	invoiceDate: true
} as const;

/** A run that ended in a failure is tried again while its period is due: it does not count as billed. */
function billsItsPeriod(run: Pick<InvoiceScheduleRun, 'status'>): boolean {
	return run.status !== InvoiceScheduleRunStatusEnum.FAILED;
}

/**
 * The billing schedules of an organization's clients (ever-co/ever-gauzy#11855): one per client at most, read, created,
 * changed, paused, resumed and deleted by whoever may edit the organization's invoices. Every lookup is scoped by the
 * caller's tenant (the base service) and by the organization the route names, which the caller must belong to.
 *
 * Each schedule is answered with its next period, computed from today in the organization's time zone, and its latest
 * run. The runs themselves are made by the schedule's sweep, with the access of the schedule's author: whoever created
 * or last changed it, so saving a schedule is also taking it over.
 */
@Injectable()
export class InvoiceScheduleService extends TenantAwareCrudService<InvoiceSchedule> {
	private readonly logger = new Logger(InvoiceScheduleService.name);

	constructor(
		readonly typeOrmInvoiceScheduleRepository: TypeOrmInvoiceScheduleRepository,
		readonly mikroOrmInvoiceScheduleRepository: MikroOrmInvoiceScheduleRepository,
		private readonly dataSource: DataSource
	) {
		super(typeOrmInvoiceScheduleRepository, mikroOrmInvoiceScheduleRepository);
	}

	/**
	 * The schedules of an organization, or of one of its clients, each with its client's name, its next period and its
	 * latest run.
	 *
	 * @param query The organization, and optionally the client.
	 */
	async list(query: InvoiceScheduleListQueryDTO): Promise<InvoiceSchedule[]> {
		const where: Partial<InvoiceSchedule> = { organizationId: query.organizationId };
		if (query.organizationContactId) {
			where.organizationContactId = query.organizationContactId;
		}
		const schedules = await this.find({
			where,
			relations: { organizationContact: true },
			order: { createdAt: 'ASC' }
		});
		return await this.withComputedFields(schedules, query.organizationId);
	}

	/**
	 * One schedule, with its client's name, its next period and its latest run.
	 *
	 * @throws NotFoundException when the organization has no such schedule.
	 */
	async findOneInOrganization(id: ID, organizationId: ID): Promise<InvoiceSchedule> {
		const schedule = await this.scheduleOrFail(id, organizationId);
		const [read] = await this.withComputedFields([schedule], organizationId);
		return read;
	}

	/**
	 * A schedule's latest runs, newest first, each with the invoice it made.
	 *
	 * @throws NotFoundException when the organization has no such schedule.
	 */
	async runsOf(id: ID, organizationId: ID, take = DEFAULT_RUNS_PER_PAGE): Promise<IInvoiceScheduleRun[]> {
		const schedule = await this.scheduleOrFail(id, organizationId);
		return await this.dataSource.getRepository(InvoiceScheduleRun).find({
			where: { invoiceScheduleId: schedule.id, tenantId: schedule.tenantId, organizationId },
			relations: { invoice: true },
			select: this.runFields(),
			order: { claimedAt: 'DESC' },
			take: Math.min(take, MAX_INVOICE_SCHEDULE_RUNS_PER_PAGE)
		});
	}

	/**
	 * Sets a client's billing schedule. It runs from now: a period whose invoice day is already past is never billed.
	 *
	 * @throws BadRequestException for a start day that does not exist, or a client that is not the organization's.
	 * @throws ConflictException when the client already has a schedule.
	 */
	async createSchedule(input: CreateInvoiceScheduleDTO): Promise<InvoiceSchedule> {
		this.assertStartDay(input.startDay);
		await this.assertClientOf(input.organizationContactId, input.organizationId);
		const existing = await this.count({ where: { organizationContactId: input.organizationContactId } });
		if (existing > 0) {
			throw new ConflictException(INVOICE_SCHEDULE_EXISTS);
		}

		let created: InvoiceSchedule;
		try {
			created = await this.create({
				organizationId: input.organizationId,
				organizationContactId: input.organizationContactId,
				frequency: input.frequency,
				startDay: input.startDay,
				grouping: input.grouping ?? InvoiceScheduleGroupingEnum.PROJECT,
				sendInvoice: input.sendInvoice ?? false,
				pausedAt: null,
				activeSince: new Date(),
				authorId: RequestContext.currentUserId()
			});
		} catch (error) {
			// Two requests for the same client at once: the unique key lets one through. The base service answers the
			// losing insert with its own safe error, without the driver's, so the conflict is told by the row that won.
			const wonElsewhere = await this.count({ where: { organizationContactId: input.organizationContactId } });
			if (isUniqueViolation(error) || wonElsewhere > 0) {
				throw new ConflictException(INVOICE_SCHEDULE_EXISTS);
			}
			throw error;
		}

		this.logger.log(`Invoice schedule created: id=${created.id} clientId=${created.organizationContactId}`);
		return await this.findOneInOrganization(created.id, input.organizationId);
	}

	/**
	 * Changes a schedule. Pausing it stops its invoices; resuming it starts them again from today, so the periods it
	 * skipped are not billed. Whoever saves it becomes its author: the runs use their access from now on.
	 *
	 * @throws NotFoundException when the organization has no such schedule.
	 * @throws BadRequestException for a start day that does not exist.
	 */
	async updateSchedule(id: ID, input: UpdateInvoiceScheduleDTO): Promise<InvoiceSchedule> {
		const stored = await this.scheduleOrFail(id, input.organizationId);
		if (input.startDay !== undefined) {
			this.assertStartDay(input.startDay);
		}
		await this.assertTimelineKeepsBilledDays(stored, input);

		const changes: Partial<InvoiceSchedule> = { authorId: RequestContext.currentUserId() };
		if (input.frequency !== undefined) {
			changes.frequency = input.frequency;
		}
		if (input.startDay !== undefined) {
			changes.startDay = input.startDay;
		}
		if (input.grouping !== undefined) {
			changes.grouping = input.grouping;
		}
		if (input.sendInvoice !== undefined) {
			changes.sendInvoice = input.sendInvoice;
		}
		const isPaused = !!stored.pausedAt;
		const pauses = input.paused === true && !isPaused;
		const resumes = input.paused === false && isPaused;
		if (pauses) {
			changes.pausedAt = new Date();
		}
		if (resumes) {
			changes.pausedAt = null;
			changes.activeSince = new Date();
		}

		await this.update({ id: stored.id, organizationId: input.organizationId }, changes);
		this.logger.log(
			`Invoice schedule changed: id=${stored.id}${pauses ? ' (paused)' : ''}${resumes ? ' (resumed)' : ''}`
		);
		return await this.findOneInOrganization(stored.id, input.organizationId);
	}

	/**
	 * Deletes a schedule and its runs. The invoices it made stay.
	 *
	 * @throws NotFoundException when the organization has no such schedule.
	 */
	async deleteSchedule(id: ID, organizationId: ID): Promise<void> {
		const stored = await this.scheduleOrFail(id, organizationId);
		await this.delete({ id: stored.id, organizationId });
		this.logger.log(`Invoice schedule deleted: id=${stored.id}`);
	}

	/** The organization's schedule of that id. */
	private async scheduleOrFail(id: ID, organizationId: ID): Promise<InvoiceSchedule> {
		const schedule = await this.findOneByOptions({
			where: { id, organizationId },
			relations: { organizationContact: true }
		});
		if (!schedule) {
			throw new NotFoundException();
		}
		return schedule;
	}

	/**
	 * Refuses a new timeline that would bill again days a run already billed: once a period is billed, a change of
	 * frequency or start day must start after the last period billed. A run that failed billed nothing.
	 */
	private async assertTimelineKeepsBilledDays(
		stored: InvoiceSchedule,
		input: UpdateInvoiceScheduleDTO
	): Promise<void> {
		const frequency = input.frequency ?? stored.frequency;
		const startDay = input.startDay ?? stored.startDay;
		const changesTimeline = frequency !== stored.frequency || startDay !== stored.startDay;
		if (!changesTimeline) {
			return;
		}
		const lastBilled = await this.dataSource.getRepository(InvoiceScheduleRun).findOne({
			where: {
				invoiceScheduleId: stored.id,
				tenantId: stored.tenantId,
				status: Not(InvoiceScheduleRunStatusEnum.FAILED)
			},
			select: { id: true, periodEnd: true },
			order: { periodEnd: 'DESC' }
		});
		if (lastBilled && startDay <= lastBilled.periodEnd) {
			throw new BadRequestException(INVOICE_SCHEDULE_START_AFTER_BILLED);
		}
	}

	private assertStartDay(startDay: string): void {
		if (!isRealDay(startDay) || startDay > LAST_START_DAY) {
			throw new BadRequestException(INVOICE_SCHEDULE_START_DAY);
		}
	}

	/** Refuses a client that is not one of the organization's, in the caller's tenant. */
	private async assertClientOf(organizationContactId: ID, organizationId: ID): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		const client = await this.dataSource.getRepository(OrganizationContact).findOne({
			where: { id: organizationContactId, organizationId, tenantId },
			select: { id: true }
		});
		if (!client) {
			throw new BadRequestException(INVOICE_SCHEDULE_CLIENT);
		}
	}

	/** Each schedule with its next period, counted from today in the organization's zone, and its latest run. */
	private async withComputedFields(schedules: InvoiceSchedule[], organizationId: ID): Promise<InvoiceSchedule[]> {
		if (schedules.length === 0) {
			return schedules;
		}
		const tenantId = schedules[0].tenantId;
		const organization = await this.dataSource.getRepository(Organization).findOne({
			where: { id: organizationId, tenantId },
			select: { id: true, timeZone: true }
		});
		const timeZone = invoiceTimeZoneOf(organization);
		const today = dayIn(new Date(), timeZone);

		const runs = await this.latestRunsOf(schedules, tenantId, organizationId);
		const dueRuns = await this.dueRunsOf(schedules, tenantId, organizationId, today, timeZone);
		return schedules.map((schedule) => {
			schedule.lastRun = runs.get(schedule.id) ?? null;
			schedule.nextPeriod = null;
			if (!schedule.pausedAt) {
				const activeSinceDay = dayIn(schedule.activeSince, timeZone);
				const billed = dueRuns.get(schedule.id) ?? new Set<string>();
				const next = nextPeriodOf(schedule, today, activeSinceDay, (start) => billed.has(start));
				schedule.nextPeriod = periodView(next);
			}
			return schedule;
		});
	}

	/** The latest run of each schedule, with its invoice. */
	private async latestRunsOf(
		schedules: InvoiceSchedule[],
		tenantId: ID,
		organizationId: ID
	): Promise<Map<ID, InvoiceScheduleRun>> {
		// One row per schedule, its latest: a read never grows with a schedule's history
		const runs = await Promise.all(
			schedules.map((schedule) =>
				this.dataSource.getRepository(InvoiceScheduleRun).findOne({
					where: { invoiceScheduleId: schedule.id, tenantId, organizationId },
					relations: { invoice: true },
					select: this.runFields(),
					order: { claimedAt: 'DESC' }
				})
			)
		);
		const latest = new Map<ID, InvoiceScheduleRun>();
		for (const run of runs) {
			if (run) {
				latest.set(run.invoiceScheduleId, run);
			}
		}
		return latest;
	}

	/** For each schedule, the first day of its period due today when a run has billed it. */
	private async dueRunsOf(
		schedules: InvoiceSchedule[],
		tenantId: ID,
		organizationId: ID,
		today: string,
		timeZone: string
	): Promise<Map<ID, Set<string>>> {
		const due = schedules
			.map((schedule) => ({
				schedule,
				period: duePeriodOf(schedule, today, dayIn(schedule.activeSince, timeZone))
			}))
			.filter(({ period }) => !!period);
		const billed = new Map<ID, Set<string>>();
		if (due.length === 0) {
			return billed;
		}
		const runs = await this.dataSource.getRepository(InvoiceScheduleRun).find({
			where: {
				invoiceScheduleId: In(due.map(({ schedule }) => schedule.id)),
				periodStart: In([...new Set(due.map(({ period }) => period.startDay))]),
				tenantId,
				organizationId
			},
			select: { id: true, invoiceScheduleId: true, periodStart: true, status: true }
		});
		for (const run of runs.filter(billsItsPeriod)) {
			const starts = billed.get(run.invoiceScheduleId) ?? new Set<string>();
			starts.add(run.periodStart);
			billed.set(run.invoiceScheduleId, starts);
		}
		return billed;
	}

	/** The columns a run is answered with, and its invoice's. */
	private runFields() {
		return {
			id: true,
			invoiceScheduleId: true,
			periodStart: true,
			periodEnd: true,
			status: true,
			reason: true,
			claimedAt: true,
			finishedAt: true,
			leftOutSeconds: true,
			invoiceId: true,
			invoice: RUN_INVOICE_FIELDS
		};
	}
}

/** The calendar day an instant falls on in a time zone, `YYYY-MM-DD`. */
export function dayIn(instant: Date | string, timeZone: string): string {
	return moment.utc(instant).tz(timeZone).format('YYYY-MM-DD');
}
