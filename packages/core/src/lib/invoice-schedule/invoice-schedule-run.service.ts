import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In, IsNull, LessThan, MoreThan } from 'typeorm';
import * as moment from 'moment';
import 'moment-timezone';
import {
	ID,
	IInvoice,
	InvoiceScheduleRunReasonEnum,
	InvoiceScheduleRunStatusEnum,
	InvoiceStatusTypesEnum,
	InvoiceTypeEnum,
	LanguagesEnum,
	PermissionsEnum,
	DiscountTaxTypeEnum
} from '@gauzy/contracts';
import { isDeactivatedEmployee } from '../auth/deactivated-employee';
import { IAuthenticatedUser } from '../core/context/types';
import { RequestContext } from '../core/context/request-context';
import {
	Employee,
	Invoice,
	Organization,
	OrganizationContact,
	OrganizationProject,
	OrganizationProjectEmployee,
	Task,
	UserOrganization
} from '../core/entities/internal';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { invoiceTimeZoneOf } from '../invoice/invoice-date.util';
import { InvoiceService } from '../invoice/invoice.service';
import { CURRENT_MEMBERSHIP } from '../organization-project/organization-project-rate.service';
import { RoleAuthorizationService } from '../role/role-authorization.service';
import { canViewTrackedData } from '../shared/guards/employee-tracked-data.guard';
import { defaultBillRateOf } from '../time-tracking/time-log/default-bill-rate';
import { TimeLogService } from '../time-tracking/time-log/time-log.service';
import { UserService } from '../user/user.service';
import { InvoiceScheduleRun } from './invoice-schedule-run.entity';
import { InvoiceSchedule } from './invoice-schedule.entity';
import {
	INVOICE_SCHEDULE_RETRY_AFTER_MS,
	INVOICE_SCHEDULE_SWEEP_PAGE_SIZE,
	INVOICE_SCHEDULE_SWEEP_TIME_BUDGET_MS
} from './invoice-schedule.constants';
import {
	billableEntriesOf,
	durationRoundingRuleOf,
	IScheduledInvoiceLine,
	invoiceTimeOf,
	linePriceOf,
	oneCurrencyInvoiceOf,
	totalOfLines
} from './invoice-schedule-pricing';
import { addDaysToDay, duePeriodOf, IRankedInvoiceSchedulePeriod } from './invoice-schedule.rules';
import { dayIn } from './invoice-schedule.service';

/** What one sweep did. */
export interface IInvoiceScheduleSweepReport {
	/** The schedules read: not paused. */
	checked: number;
	/** The invoices made, kept as drafts or sent. */
	invoiced: number;
	/** Of those, the invoices emailed and marked Sent. */
	sent: number;
	/** The periods without billable time to bill. */
	empty: number;
	/** The runs that made no invoice, or could not send it; the next sweep tries a failure again while it is due. */
	failed: number;
}

/** How a run ended. */
interface IRunEnd {
	status: InvoiceScheduleRunStatusEnum;
	reason?: InvoiceScheduleRunReasonEnum | null;
	invoiceId?: ID | null;
	leftOutSeconds?: number | null;
}

/** The permissions that read the time a manual invoice is made from (`GET /timesheet/time-log`). */
const TIME_READ_PERMISSIONS = [
	PermissionsEnum.TIME_TRACKER,
	PermissionsEnum.ALL_ORG_EDIT,
	PermissionsEnum.ALL_ORG_VIEW
];

/** The first line of an invoice's terms: the period, in the one form the Invoices page reads back. */
export function invoiceTermsOf(period: { startDay: string; endDay: string }): string {
	return `Billable time from ${period.startDay} to ${period.endDay}`;
}

/** The term of an invoice whose client and organization state none, in days. */
export const STANDARD_DUE_DAYS = 30;

/**
 * How many days after its issue an invoice is due: the client's own payment terms, where zero is due on receipt, else
 * the organization's setting, where zero is no setting, else thirty days.
 */
export function dueDaysOf(clientTermDays: unknown, organizationDaysUntilDue: unknown): number {
	const clientDays = Number(clientTermDays);
	const hasClientTerm = clientTermDays !== null && clientTermDays !== undefined && Number.isInteger(clientDays);
	if (hasClientTerm && clientDays >= 0) {
		return clientDays;
	}
	const organizationDays = Number(organizationDaysUntilDue);
	if (Number.isInteger(organizationDays) && organizationDays >= 1) {
		return organizationDays;
	}
	return STANDARD_DUE_DAYS;
}

/** A claim's time, to the second: MySQL keeps no fraction of a second. */
function claimTimeOf(now: Date): Date {
	return new Date(Math.floor(now.getTime() / 1000) * 1000);
}

/**
 * Makes the invoices that billing schedules are due to make (ever-co/ever-gauzy#11855).
 *
 * - **Which periods.** For each schedule that is not paused, the period whose run day has come in its organization's
 *   time zone, if it is not more than a week past and came after the schedule started running (see
 *   `invoice-schedule.rules.ts`): one invoice per run, never a burst of the past.
 * - **Once, whatever the processes.** The sweep inserts the period's `invoice_schedule_run` row before it builds
 *   anything, and the row is unique on the schedule and the period: when several processes sweep at once, one insert
 *   goes through and the others build nothing. A run that failed (no access, no rate, a save refused) is taken again
 *   by a later sweep, an hour after, while the period is due; so is a claim a stopped process left behind, after it is
 *   checked for an invoice that process made.
 * - **As its author.** The run reads the time and saves the invoice with the access of the schedule's author, read
 *   again at each run, exactly as the author's own request would: they must still be an active member who may make
 *   invoices and read the organization's tracked time, and someone who may only bill their own time bills only theirs.
 * - **Priced as a manual invoice.** The billable time not billed yet, of the client's projects, started in the period,
 *   is grouped and priced as the manual invoice does (see `invoice-schedule-pricing.ts`), its lines name the time logs
 *   they bill (so no other invoice can bill them again), and the invoice states the period as the first line of its
 *   terms, which the Invoices page reads back. It is dated on the run day, and due after the client's payment terms.
 * - **Draft or sent.** With Send on, it goes to the client's email with its PDF, through the organization's mail
 *   settings and in the author's language, and is marked Sent; a send that fails keeps it as a draft and says so.
 */
@Injectable()
export class InvoiceScheduleRunService {
	private readonly logger = new Logger(InvoiceScheduleRunService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly userService: UserService,
		private readonly roleAuthorizationService: RoleAuthorizationService,
		private readonly timeLogService: TimeLogService,
		private readonly invoiceService: InvoiceService
	) {}

	/**
	 * Runs the schedules whose period is due: reads the schedules that are not paused a page at a time, until the list
	 * is read or the time budget of the pass is spent.
	 *
	 * @param now The moment the periods are due at.
	 * @param budgetMs How long the pass may keep reading pages.
	 */
	async sweep(
		now: Date = new Date(),
		budgetMs: number = INVOICE_SCHEDULE_SWEEP_TIME_BUDGET_MS
	): Promise<IInvoiceScheduleSweepReport> {
		const report: IInvoiceScheduleSweepReport = { checked: 0, invoiced: 0, sent: 0, empty: 0, failed: 0 };
		const startedAt = Date.now();
		let afterId: ID | null = null;
		for (;;) {
			const page = await this.schedulesAfter(afterId);
			report.checked += page.length;
			for (const schedule of page) {
				await this.runIfDue(schedule, now, report);
			}
			if (page.length) {
				afterId = page[page.length - 1].id;
			}
			if (page.length < INVOICE_SCHEDULE_SWEEP_PAGE_SIZE || Date.now() - startedAt >= budgetMs) {
				break;
			}
		}
		if (report.invoiced || report.empty || report.failed) {
			this.logger.log(
				`Invoice schedules: ${report.invoiced} invoices made (${report.sent} sent), ${report.empty} periods without time, ${report.failed} runs failed`
			);
		}
		return report;
	}

	/** A page of the schedules that are not paused, in id order, after the one given. */
	private async schedulesAfter(afterId: ID | null): Promise<InvoiceSchedule[]> {
		const where = { pausedAt: IsNull(), ...(afterId ? { id: MoreThan(afterId) } : {}) };
		return await this.dataSource.getRepository(InvoiceSchedule).find({
			where,
			order: { id: 'ASC' },
			take: INVOICE_SCHEDULE_SWEEP_PAGE_SIZE
		});
	}

	/** Runs a schedule when its period is due and this process claims it. */
	private async runIfDue(schedule: InvoiceSchedule, now: Date, report: IInvoiceScheduleSweepReport): Promise<void> {
		try {
			const organization = await this.organizationOf(schedule);
			if (!organization) {
				return;
			}
			const timeZone = invoiceTimeZoneOf(organization);
			const period = duePeriodOf(schedule, dayIn(now, timeZone), dayIn(schedule.activeSince, timeZone));
			if (!period) {
				return;
			}
			const run = await this.claim(schedule, period, now);
			if (!run) {
				return;
			}
			const end = await this.runAsAuthor(schedule, period, organization, timeZone);
			await this.finish(run, end);
			this.count(end, report);
		} catch (error) {
			report.failed++;
			this.logger.error(`Invoice schedule ${schedule.id} could not run: ${(error as Error)?.message ?? error}`);
		}
	}

	/** Counts a run's end in the sweep's report. */
	private count(end: IRunEnd, report: IInvoiceScheduleSweepReport): void {
		switch (end.status) {
			case InvoiceScheduleRunStatusEnum.SENT:
				report.invoiced++;
				report.sent++;
				break;
			case InvoiceScheduleRunStatusEnum.DRAFTED:
				report.invoiced++;
				break;
			case InvoiceScheduleRunStatusEnum.NOT_SENT:
				report.invoiced++;
				report.failed++;
				break;
			case InvoiceScheduleRunStatusEnum.NO_TIME:
				report.empty++;
				break;
			default:
				report.failed++;
		}
	}

	/** The schedule's organization, with what a run reads of it. */
	private async organizationOf(schedule: InvoiceSchedule): Promise<Organization | null> {
		return await this.dataSource.getRepository(Organization).findOne({
			where: { id: schedule.organizationId, tenantId: schedule.tenantId },
			select: {
				id: true,
				tenantId: true,
				timeZone: true,
				currency: true,
				daysUntilDue: true,
				defaultBillRateValue: true,
				defaultBillRateCurrency: true,
				durationRoundingInterval: true,
				durationRoundingDirection: true
			}
		});
	}

	/**
	 * Claims the period's run: inserts it, or takes again a run of the period that failed, or that a stopped process
	 * left claimed, an hour after it was claimed. Null when another process holds it, or it already ended.
	 */
	private async claim(
		schedule: InvoiceSchedule,
		period: IRankedInvoiceSchedulePeriod,
		now: Date
	): Promise<InvoiceScheduleRun | null> {
		const runs = this.dataSource.getRepository(InvoiceScheduleRun);
		const claimedAt = claimTimeOf(now);
		const key = { invoiceScheduleId: schedule.id, periodStart: period.startDay, tenantId: schedule.tenantId };
		try {
			await runs.insert({
				...key,
				organizationId: schedule.organizationId,
				periodEnd: period.endDay,
				status: InvoiceScheduleRunStatusEnum.CLAIMED,
				claimedAt
			});
			return await runs.findOneBy(key);
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}
		}

		const earlier = await runs.findOneBy(key);
		const isRetryable =
			!!earlier &&
			[InvoiceScheduleRunStatusEnum.FAILED, InvoiceScheduleRunStatusEnum.CLAIMED].includes(earlier.status) &&
			new Date(earlier.claimedAt).getTime() <= now.getTime() - INVOICE_SCHEDULE_RETRY_AFTER_MS;
		if (!isRetryable) {
			return null;
		}
		// Only one process takes it again: the update matches the run as it was read
		const taken = await runs.update(
			{ id: earlier.id, status: earlier.status, claimedAt: earlier.claimedAt },
			{ status: InvoiceScheduleRunStatusEnum.CLAIMED, reason: null, finishedAt: null, claimedAt }
		);
		if (taken.affected !== 1) {
			return null;
		}
		if (earlier.status === InvoiceScheduleRunStatusEnum.CLAIMED) {
			const made = await this.invoiceMadeBy(schedule, earlier);
			if (made) {
				const status =
					made.status === InvoiceStatusTypesEnum.SENT
						? InvoiceScheduleRunStatusEnum.SENT
						: InvoiceScheduleRunStatusEnum.DRAFTED;
				await this.finish(earlier, { status, invoiceId: made.id });
				return null;
			}
		}
		return await runs.findOneBy({ id: earlier.id });
	}

	/** The invoice a stopped process made for a claimed run before it could record it, if it made one. */
	private async invoiceMadeBy(schedule: InvoiceSchedule, run: InvoiceScheduleRun): Promise<Invoice | null> {
		return await this.dataSource.getRepository(Invoice).findOne({
			where: {
				tenantId: schedule.tenantId,
				organizationId: schedule.organizationId,
				organizationContactId: schedule.organizationContactId,
				terms: invoiceTermsOf({ startDay: run.periodStart, endDay: run.periodEnd }),
				isEstimate: false,
				createdAt: MoreThan(new Date(new Date(run.claimedAt).getTime() - 1000))
			},
			select: { id: true, status: true }
		});
	}

	/** Records how a run ended. */
	private async finish(run: Pick<InvoiceScheduleRun, 'id'>, end: IRunEnd): Promise<void> {
		await this.dataSource.getRepository(InvoiceScheduleRun).update(
			{ id: run.id },
			{
				status: end.status,
				reason: end.reason ?? null,
				invoiceId: end.invoiceId ?? null,
				leftOutSeconds: end.leftOutSeconds ?? null,
				finishedAt: new Date()
			}
		);
	}

	/**
	 * Runs the period with the access of the schedule's author, as their own request would: inside a request context of
	 * theirs, read again now.
	 */
	private async runAsAuthor(
		schedule: InvoiceSchedule,
		period: IRankedInvoiceSchedulePeriod,
		organization: Organization,
		timeZone: string
	): Promise<IRunEnd> {
		const author = await this.authorAsTheyAreNow(schedule);
		if (!author) {
			return {
				status: InvoiceScheduleRunStatusEnum.FAILED,
				reason: InvoiceScheduleRunReasonEnum.AUTHOR_CANNOT_INVOICE
			};
		}
		const request = { user: author, headers: {}, query: {}, params: {}, body: {} };
		return await RequestContext.runWithRequest(
			request as never,
			async () => {
				if (!(await this.authorMayInvoice(schedule))) {
					return {
						status: InvoiceScheduleRunStatusEnum.FAILED,
						reason: InvoiceScheduleRunReasonEnum.AUTHOR_CANNOT_INVOICE
					};
				}
				return await this.bill(schedule, period, organization, timeZone, author);
			},
			{ id: randomUUID() as ID }
		);
	}

	/**
	 * The schedule's author as they are now: an active account of the schedule's tenant, an active member of its
	 * organization, not a deactivated employee there, with their role's permissions as a sign-in reads them. Null
	 * otherwise: the run makes nothing.
	 */
	private async authorAsTheyAreNow(schedule: InvoiceSchedule): Promise<IAuthenticatedUser | null> {
		if (!schedule.authorId) {
			return null;
		}
		const user: IAuthenticatedUser = await this.userService.getIfExists(schedule.authorId);
		const isActiveAccount = !!user && user.isActive === true && user.isArchived === false;
		if (!isActiveAccount || user.tenantId !== schedule.tenantId) {
			return null;
		}
		const membership = await this.dataSource.getRepository(UserOrganization).findOne({
			where: {
				userId: user.id,
				organizationId: schedule.organizationId,
				tenantId: schedule.tenantId,
				isActive: true,
				isArchived: false
			},
			select: { id: true }
		});
		if (!membership) {
			return null;
		}
		const employees = await this.dataSource.getRepository(Employee).find({
			where: { userId: user.id, organizationId: schedule.organizationId, tenantId: schedule.tenantId },
			select: { id: true, isActive: true, isArchived: true }
		});
		if (isDeactivatedEmployee(employees)) {
			return null;
		}
		await this.roleAuthorizationService.attachAuthorizationState(user);
		const activeEmployee = employees.find((employee) => employee.isActive && !employee.isArchived);
		user.employeeId = activeEmployee?.id;
		user.lastOrganizationId = schedule.organizationId;
		return user;
	}

	/** Whether the author may make invoices and read the time they are made from, as the routes a manual invoice uses. */
	private async authorMayInvoice(schedule: InvoiceSchedule): Promise<boolean> {
		const mayEditInvoices = RequestContext.hasPermission(PermissionsEnum.INVOICES_EDIT);
		const mayReadTime = RequestContext.hasAnyPermission(TIME_READ_PERMISSIONS);
		if (!mayEditInvoices || !mayReadTime) {
			return false;
		}
		try {
			return await canViewTrackedData(this.dataSource, [schedule.organizationId]);
		} catch {
			return false;
		}
	}

	/** Builds the period's invoice, saves it, and sends it when the schedule says so. */
	private async bill(
		schedule: InvoiceSchedule,
		period: IRankedInvoiceSchedulePeriod,
		organization: Organization,
		timeZone: string,
		author: IAuthenticatedUser
	): Promise<IRunEnd> {
		const { tenantId, organizationId } = schedule;
		const client = await this.dataSource.getRepository(OrganizationContact).findOne({
			where: { id: schedule.organizationContactId, tenantId, organizationId },
			select: { id: true, name: true, primaryEmail: true, paymentTermsDays: true }
		});
		const projects = await this.dataSource.getRepository(OrganizationProject).find({
			where: { organizationContactId: schedule.organizationContactId, tenantId, organizationId },
			select: { id: true, name: true, billRateValue: true, currency: true }
		});
		if (!client || projects.length === 0) {
			return {
				status: InvoiceScheduleRunStatusEnum.NO_TIME,
				reason: InvoiceScheduleRunReasonEnum.NO_BILLABLE_TIME
			};
		}

		const projectIds = projects.map(({ id }) => id);
		const logs = await this.timeLogService.getTimeLogs({
			tenantId,
			organizationId,
			startDate: moment.tz(period.startDay, timeZone).startOf('day').toDate(),
			endDate: moment.tz(period.endDay, timeZone).endOf('day').toDate(),
			timeZone,
			projectIds,
			billableOnly: true,
			notInvoiced: true
		} as never);
		const entries = billableEntriesOf(logs, new Set(projectIds), durationRoundingRuleOf(organization));
		if (entries.length === 0) {
			return {
				status: InvoiceScheduleRunStatusEnum.NO_TIME,
				reason: InvoiceScheduleRunReasonEnum.NO_BILLABLE_TIME
			};
		}

		const priceOf = await this.pricesOf(entries, projects, organization);
		const time = invoiceTimeOf(entries, schedule.grouping, priceOf);
		const invoice = oneCurrencyInvoiceOf(time.lines);
		const leftOutSeconds = time.unpricedSeconds + invoice.otherCurrencySeconds;
		if (invoice.lines.length === 0 || !invoice.currency) {
			return {
				status: InvoiceScheduleRunStatusEnum.FAILED,
				reason: InvoiceScheduleRunReasonEnum.NO_PRICED_TIME,
				leftOutSeconds
			};
		}

		let saved: IInvoice;
		try {
			saved = await this.save(schedule, period, organization, timeZone, client, projects, invoice);
		} catch (error) {
			this.logger.warn(
				`Invoice schedule ${schedule.id} could not save the invoice of ${period.startDay}: ${(error as Error)?.message ?? error}`
			);
			return {
				status: InvoiceScheduleRunStatusEnum.FAILED,
				reason: InvoiceScheduleRunReasonEnum.INVOICE_NOT_SAVED,
				leftOutSeconds
			};
		}
		const leftOut = leftOutSeconds > 0 ? InvoiceScheduleRunReasonEnum.TIME_LEFT_OUT : null;
		const drafted = { invoiceId: saved.id, leftOutSeconds: leftOutSeconds || null };
		if (!schedule.sendInvoice) {
			return { ...drafted, status: InvoiceScheduleRunStatusEnum.DRAFTED, reason: leftOut };
		}
		return { ...drafted, ...(await this.send(saved, client, author, leftOut)) };
	}

	/** The price of each member's time on each project of the client. */
	private async pricesOf(
		entries: ReturnType<typeof billableEntriesOf>,
		projects: OrganizationProject[],
		organization: Organization
	) {
		const employeeIds = [...new Set(entries.map(({ employeeId }) => employeeId))];
		const employees = await this.dataSource.getRepository(Employee).find({
			where: { id: In(employeeIds), tenantId: organization.tenantId },
			select: { id: true, billRateValue: true, billRateCurrency: true }
		});
		const memberships = await this.dataSource.getRepository(OrganizationProjectEmployee).find({
			where: {
				organizationProjectId: In(projects.map(({ id }) => id)),
				employeeId: In(employeeIds),
				tenantId: organization.tenantId,
				...CURRENT_MEMBERSHIP
			},
			select: { id: true, organizationProjectId: true, employeeId: true, billRateValue: true }
		});
		const projectsById = new Map(projects.map((project) => [project.id, project]));
		const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
		const defaultRate = defaultBillRateOf(organization);
		return (projectId: ID, employeeId: ID) => {
			const project = projectsById.get(projectId);
			const employee = employeesById.get(employeeId);
			const membership = memberships.find(
				(row) => row.organizationProjectId === projectId && row.employeeId === employeeId
			);
			return linePriceOf({
				memberRate: membership?.billRateValue,
				projectRate: project?.billRateValue,
				projectCurrency: project?.currency ?? null,
				employeeRate: employee?.billRateValue,
				employeeCurrency: employee?.billRateCurrency ?? null,
				organizationCurrency: organization.currency ?? null,
				defaultRate
			});
		};
	}

	/**
	 * Saves the invoice and its lines, which name the time logs they bill, as the manual invoice's create does: a draft,
	 * dated on the run day and due after the client's payment terms. Its number is the next one of the tenant; a manual
	 * invoice taking that number at the same moment makes it try the next one.
	 */
	private async save(
		schedule: InvoiceSchedule,
		period: IRankedInvoiceSchedulePeriod,
		organization: Organization,
		timeZone: string,
		client: OrganizationContact,
		projects: OrganizationProject[],
		invoice: ReturnType<typeof oneCurrencyInvoiceOf>
	): Promise<IInvoice> {
		const { tenantId, organizationId } = schedule;
		const descriptions = await this.descriptionsOf(invoice.lines, schedule, projects);
		const dueDay = addDaysToDay(period.runDay, dueDaysOf(client.paymentTermsDays, organization.daysUntilDue));
		const id = randomUUID() as ID;
		const lines = [...invoice.lines].sort((first, second) =>
			descriptions.get(first.key).localeCompare(descriptions.get(second.key))
		);
		const request = {
			id,
			invoiceDate: moment.tz(period.runDay, timeZone).startOf('day').toDate(),
			dueDate: moment.tz(dueDay, timeZone).endOf('day').toDate(),
			currency: invoice.currency,
			discountValue: 0,
			discountType: DiscountTaxTypeEnum.PERCENT,
			tax: 0,
			taxType: DiscountTaxTypeEnum.PERCENT,
			tax2: 0,
			tax2Type: DiscountTaxTypeEnum.PERCENT,
			terms: invoiceTermsOf(period),
			paid: false,
			totalValue: totalOfLines(lines),
			status: InvoiceStatusTypesEnum.DRAFT,
			isEstimate: false,
			invoiceType: InvoiceTypeEnum.BY_PROJECT_HOURS,
			organizationContactId: client.id,
			toContactId: client.id,
			fromOrganizationId: organizationId,
			organizationId,
			tenantId,
			invoiceItems: lines.map((line) => ({
				description: descriptions.get(line.key),
				price: line.rate,
				quantity: line.hours,
				totalValue: line.amount,
				invoiceId: id,
				projectId: line.projectId,
				...(line.employeeId ? { employeeId: line.employeeId } : {}),
				...(line.taskId ? { taskId: line.taskId } : {}),
				applyTax: false,
				applyDiscount: false,
				organizationId,
				tenantId,
				timeLogIds: [...line.timeLogIds]
			}))
		};

		for (let attempt = 1; ; attempt++) {
			const highest = await this.invoiceService.getHighestInvoiceNumber();
			const invoiceNumber = Number((highest as unknown as { max?: unknown })?.max ?? 0) + 1;
			try {
				return await this.invoiceService.createWithBilledTime({ ...request, invoiceNumber } as never);
			} catch (error) {
				const isNumberTaken =
					isUniqueViolation(error) || isUniqueViolation((error as { cause?: unknown })?.cause);
				if (!isNumberTaken || attempt >= 3) {
					throw error;
				}
			}
		}
	}

	/** What each line says: the project, the member, or the task and the member, as the manual invoice labels them. */
	private async descriptionsOf(
		lines: IScheduledInvoiceLine[],
		schedule: InvoiceSchedule,
		projects: OrganizationProject[]
	): Promise<Map<string, string>> {
		const employeeIds = [...new Set(lines.map(({ employeeId }) => employeeId).filter(Boolean))];
		const taskIds = [...new Set(lines.map(({ taskId }) => taskId).filter(Boolean))];
		const employees = employeeIds.length
			? await this.dataSource.getRepository(Employee).find({
					where: { id: In(employeeIds), tenantId: schedule.tenantId },
					relations: { user: true },
					select: { id: true, user: { id: true, firstName: true, lastName: true } }
				})
			: [];
		const tasks = taskIds.length
			? await this.dataSource.getRepository(Task).find({
					where: { id: In(taskIds), tenantId: schedule.tenantId },
					select: { id: true, title: true, number: true }
				})
			: [];
		const projectNames = new Map(projects.map((project) => [project.id, project.name?.trim() || 'Project']));
		const memberNames = new Map(
			employees.map((employee) => {
				const user = employee.user;
				const fullName = [user?.firstName?.trim(), user?.lastName?.trim()].filter(Boolean).join(' ');
				return [employee.id, fullName || 'Member'];
			})
		);
		const taskTitles = new Map(
			tasks.map((task) => {
				const title = task.title?.trim() ?? '';
				return [task.id, typeof task.number === 'number' ? `#${task.number} ${title}`.trim() : title];
			})
		);
		const descriptions = new Map<string, string>();
		for (const line of lines) {
			const project = projectNames.get(line.projectId) ?? 'Project';
			if (!line.employeeId) {
				descriptions.set(line.key, project);
				continue;
			}
			const member = memberNames.get(line.employeeId) ?? 'Member';
			if (schedule.grouping === 'TASK') {
				const task = (line.taskId && taskTitles.get(line.taskId)) || 'No task';
				descriptions.set(line.key, `${project} · ${task} · ${member}`);
				continue;
			}
			descriptions.set(line.key, `${project} · ${member}`);
		}
		return descriptions;
	}

	/**
	 * Emails the invoice to the client with its PDF, as the invoice's own email does, then marks it Sent while it is
	 * still a draft. A failed send keeps the invoice as a draft.
	 */
	private async send(
		invoice: IInvoice,
		client: OrganizationContact,
		author: IAuthenticatedUser,
		leftOut: InvoiceScheduleRunReasonEnum | null
	): Promise<Pick<IRunEnd, 'status' | 'reason'>> {
		const email = client.primaryEmail?.trim();
		if (!email) {
			return {
				status: InvoiceScheduleRunStatusEnum.NOT_SENT,
				reason: InvoiceScheduleRunReasonEnum.CLIENT_HAS_NO_EMAIL
			};
		}
		const language = (author.preferredLanguage as LanguagesEnum) || LanguagesEnum.ENGLISH;
		const outcome = await this.invoiceService.sendEmail(
			language,
			email,
			invoice.invoiceNumber,
			invoice.id,
			false,
			undefined,
			invoice.organizationId
		);
		if (!outcome.sent) {
			return {
				status: InvoiceScheduleRunStatusEnum.NOT_SENT,
				reason: InvoiceScheduleRunReasonEnum.EMAIL_NOT_SENT
			};
		}
		const change = {
			id: invoice.id,
			status: InvoiceStatusTypesEnum.SENT,
			organizationId: invoice.organizationId,
			tenantId: invoice.tenantId
		};
		await this.invoiceService.writeKeepingFinalStatus(change, (service) => service.create(change));
		return { status: InvoiceScheduleRunStatusEnum.SENT, reason: leftOut };
	}
}
