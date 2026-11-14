import {
	Injectable,
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpException,
	NotAcceptableException,
	NotFoundException
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
	SelectQueryBuilder,
	Brackets,
	WhereExpressionBuilder,
	DeleteResult,
	UpdateResult,
	FindOptionsWhere,
	LessThan,
	Not
} from 'typeorm';
import { chain, pluck } from 'underscore';
import {
	IManualTimeInput,
	PermissionsEnum,
	IDateRange,
	IGetTimeLogConflictInput,
	IGetTimeLogReportInput,
	ITimeLog,
	ITimeSlot,
	TimeLogType,
	IAmountOwedReport,
	OwedRateSource,
	IGetTimeLimitReportInput,
	ITimeLimitReport,
	IProjectBudgetLimitReport,
	OrganizationProjectBudgetTypeEnum,
	OrganizationContactBudgetTypeEnum,
	IClientBudgetLimitReport,
	ReportGroupFilterEnum,
	IOrganizationProject,
	IDeleteTimeLog,
	IOrganizationContact,
	IEmployee,
	IOrganization,
	IPaginationParam,
	ID,
	RolesEnum
} from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { isEmpty, isNotEmpty } from '@gauzy/utils';
import { TenantAwareCrudService } from './../../core/crud';
import {
	DeleteTimeSpanCommand,
	GetTimeLogGroupByClientCommand,
	GetTimeLogGroupByDateCommand,
	GetTimeLogGroupByEmployeeCommand,
	GetTimeLogGroupByProjectCommand,
	IGetConflictTimeLogCommand,
	TimeLogCreateCommand,
	TimeLogDeleteCommand,
	TimeLogUpdateCommand
} from './commands';
import {
	getDateRangeFormat,
	getDaysBetweenDates,
	MultiORMEnum,
	parseFindOptionsRelations,
	resolveRequestedPage,
	resolveTimeZone
} from './../../core/utils';
import { RequestContext } from '../../core/context';
import { moment } from './../../core/moment-extend';
import { addDecimalStrings } from '../../money/decimal';
import {
	calculateAverage,
	calculateAverageActivity,
	calculateBillableAmount,
	calculateDuration
} from './time-log.utils';
import { prepareSQLQuery as p } from './../../database/database.helper';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { isTrackerSource } from './tracker-source';
import { MikroOrmTimeLogRepository } from './repository/mikro-orm-time-log.repository';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { TypeOrmOrganizationProjectRepository } from '../../organization-project/repository/type-orm-organization-project.repository';
import { TypeOrmOrganizationContactRepository } from '../../organization-contact/repository/type-orm-organization-contact.repository';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { Organization } from '../../organization/organization.entity';
import { findStoredPayRates, isPayRateSet, mayReadPayRateOf, StoredPayRate } from '../../employee/pay-rate';
import { TimeLog } from './time-log.entity';
import { owedRateOf, payRateNeedsOrganizationCurrency } from './owed-rate';
import {
	mikroOrmNotOnLiveInvoiceKey,
	NOT_ON_LIVE_INVOICE_PARAMETERS,
	notOnLiveInvoice
} from '../../invoice-item/invoice-item-billed-time';
import {
	IManualTimeEntry,
	assertRequiredContext,
	projectIdForEntry,
	teamIdForEntry
} from './organization-tracking-requirements';

/** The code of the refusal of manual time over a timer that is still running (409). */
export const RUNNING_TIMER_OVERLAP = 'RUNNING_TIMER_OVERLAP';

@Injectable()
export class TimeLogService extends TenantAwareCrudService<TimeLog> {
	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository,
		readonly typeOrmOrganizationContactRepository: TypeOrmOrganizationContactRepository,
		private readonly commandBus: CommandBus,
		private readonly _managedEmployeeService: ManagedEmployeeService
	) {
		super(typeOrmTimeLogRepository, mikroOrmTimeLogRepository);
	}

	/**
	 * Time logs are personal: a caller without CHANGE_SELECTED_EMPLOYEE and without an employee record
	 * of their own (a custom role holding TIME_TRACKER, say) must not fall back to the tenant-wide scope
	 * of the CRUD reads and deletes (GHSA-6qvm-3wg4-26w4). They match nothing instead.
	 */
	protected findConditionsWithoutOwnEmployee(): FindOptionsWhere<TimeLog> {
		return this.neverMatchingEmployeeCondition();
	}

	/**
	 * Retrieves time logs based on the provided input.
	 * @param request The input parameters for fetching time logs, with an optional page (`take`, and
	 * `skip` as a 1-based page number). Without `take` every matching log is returned.
	 * @returns A Promise that resolves to an array of time logs.
	 */
	async getTimeLogs(request: IGetTimeLogReportInput & Pick<IPaginationParam, 'take' | 'skip'>): Promise<ITimeLog[]> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		this.assertRelationsPermitted(request);

		const page = resolveRequestedPage(request);

		// A plain `timeSlots` relation is read for its activity figures (the Teams dashboard sums
		// `overall` over `duration`): load just those columns, as the weekly report does, instead
		// of whole slots with their raw keyboard / mouse / location / custom activity. A request for
		// relations below the slots (`timeSlots.screenshots`, …) keeps whole slots.
		const relations = request.relations ?? [];
		const slotActivityOnly =
			relations.includes('timeSlots') && !relations.some((relation) => relation.startsWith('timeSlots.'));

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const where = await this.buildMikroOrmTimeLogWhere(request);
				const populate = [
					'employee',
					'employee.user',
					'timeSlots',
					'project',
					'task',
					'organizationContact',
					...relations
				];
				// `fields` is a whitelist for loading AND serializing, so everything else is named in full:
				// every time-log column (`*`) and every other populated relation (`<path>.*`).
				const fields = slotActivityOnly
					? [
							'*',
							...[...new Set(populate)].filter((path) => path !== 'timeSlots').map((path) => `${path}.*`),
							'timeSlots.id',
							'timeSlots.overall',
							'timeSlots.duration'
					  ]
					: undefined;
				const items = await this.mikroOrmRepository.find(where, {
					populate: populate as any[],
					...(fields ? { fields: fields as any[] } : {}),
					orderBy: { startedAt: 'ASC' as any, ...(page ? { id: 'ASC' as const } : {}) },
					...(page ? { limit: page.limit, offset: page.offset } : {})
				});
				return items.map((e) => this.serialize(e)) as ITimeLog[];
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Create a query builder for the TimeLog entity
				const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

				// Inner join with the employee. The time slots are NOT joined here: a log qualifies when it has a
				// slot (in the activity range, if one is given), which `getFilterTimeLogQuery` asks with an EXISTS
				// sub-query (see `requireTimeSlot`). Joined, the slots multiplied every log by its slot count — and
				// by it again when the caller also asked for the `timeSlots` relation.
				query.innerJoin(`${query.alias}.employee`, 'employee');

				// Set up the find options for the query
				query.setFindOptions({
					select: {
						project: {
							id: true,
							name: true,
							imageUrl: true,
							membersCount: true,
							color: true
						},
						...(slotActivityOnly ? { timeSlots: { id: true, overall: true, duration: true } } : {}),
						task: TimeLogService.TASK_SELECT_FIELDS,
						organizationContact: {
							id: true,
							name: true,
							imageUrl: true
						},
						employee: {
							id: true,
							isAway: true,
							isOnline: true,
							user: {
								id: true,
								firstName: true,
								lastName: true,
								imageUrl: true
							}
						}
					},
					relations: parseFindOptionsRelations([...relations]),
					order: {
						// Order results by the 'startedAt' field in ascending order
						startedAt: 'ASC',
						// On a page, the id breaks ties so that no log repeats or goes missing between pages
						...(page ? { id: 'ASC' as const } : {})
					},
					...(page ? { skip: page.offset, take: page.limit } : {})
				});

				// Apply filters to the query
				await this.getFilterTimeLogQuery(query, request);

				const timeLogs = await query.getMany();

				// Set up the where clause using the provided filter function
				return timeLogs;
			}
		}
	}

	/**
	 * The days a report covers and the time zone its rows are grouped by, resolved together.
	 *
	 * They have to come from one and the same zone: the day list is what the response is keyed by, so a
	 * grouping key built in another zone lands in a bucket nobody reads. A request that names no zone falls
	 * back to the server zone rather than formatting an undefined moment.
	 *
	 * @param request The report input.
	 * @returns The day list and the zone that produced it.
	 */
	private reportDateRange(request: IGetTimeLogReportInput): { days: string[]; timeZone: string } {
		const timeZone = resolveTimeZone(request.timeZone);
		return { days: getDaysBetweenDates(request.startDate, request.endDate, timeZone), timeZone };
	}

	/**
	 * Fetches time logs for a weekly report based on the provided input.
	 * @param request The input parameters for fetching time logs.
	 * @returns A Promise that resolves to an array of weekly report data.
	 */
	async getWeeklyReport(request: IGetTimeLogReportInput) {
		let logs: ITimeLog[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const where = await this.buildMikroOrmTimeLogWhere(request);
				const items = await this.mikroOrmRepository.find(where, {
					populate: ['employee', 'employee.user', 'timeSlots'] as any[],
					orderBy: { startedAt: 'ASC' as any }
				});
				logs = items.map((e) => this.serialize(e)) as ITimeLog[];
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Create a query builder for the TimeLog entity
				const query = this.typeOrmRepository.createQueryBuilder('time_log');

				// Inner join with the employee. The slots are not joined: joined onto the logs they multiplied every log into
				// one row per slot (and, where the slots were also loaded as a relation, per slot squared), tens of
				// thousands of wide rows for a month; `getFilterTimeLogQuery` requires a slot in the activity range with
				// an EXISTS sub-query instead, which answers the same set of logs.
				query.innerJoin(`${query.alias}.employee`, 'employee');

				// Set find options for the query
				query.setFindOptions({
					select: {
						// Selected fields for the result
						id: true,
						employeeId: true,
						startedAt: true,
						stoppedAt: true,
						employee: {
							id: true,
							userId: true,
							isAway: true,
							isOnline: true,
							// The rate the week's `spent` is priced at, as the owed-amount report reads it
							billRateValue: true,
							billRateCurrency: true,
							user: {
								id: true,
								firstName: true,
								lastName: true,
								imageUrl: true
							}
						}
					},
					relations: {
						// Related entities to be included in the result (the slots' figures are loaded apart, see below)
						employee: {
							user: true
						}
					},
					order: {
						// Order results by the 'startedAt' field in ascending order
						startedAt: 'ASC'
					}
				});
				// Apply additional conditions to the query based on request filters
				await this.getFilterTimeLogQuery(query, request);

				// Execute the query and retrieve time logs, then the figures of their slots the activity is averaged from
				logs = await query.getMany();
				await this.loadTimeSlotFigures(logs);
				break;
			}
		}

		// The days the report covers, and the zone its rows are grouped by
		const { days, timeZone } = this.reportDateRange(request);

		// A rate that states no currency is in the organization's, as the report page shows it; read only when needed
		const organizationCurrency = await this.findCurrencyForRatesWithoutOne(logs, request.organizationId);

		// Process weekly logs using lodash and Moment.js
		const weeklyLogs = chain(logs)
			.groupBy('employeeId')
			.map((logs: ITimeLog[]) => {
				// Calculate average duration for specific employee.
				const weeklyDuration = calculateAverage(pluck(logs, 'duration'));

				// Calculate average weekly activity for specific employee.
				const weeklyActivity = calculateAverageActivity(chain(logs).pluck('timeSlots').flatten(true).value());

				const byDate = chain(logs)
					.groupBy((log: ITimeLog) => moment.utc(log.startedAt).tz(timeZone).format('YYYY-MM-DD'))
					.mapObject((logs: ITimeLog[]) => {
						// Calculate average duration of the employee for specific date range.
						const sum = calculateAverage(pluck(logs, 'duration'));
						return { sum, logs };
					})
					.value();

				// Retrieve employee details
				const employee = logs.length > 0 ? logs[0].employee : null;

				const dates: Record<string, any> = {};
				days.forEach((date) => {
					dates[date] = byDate[date] || 0;
				});

				// What the week's time costs at the employee's bill rate; null when they have no rate
				const currency = employee?.billRateCurrency || organizationCurrency;
				const spent = calculateBillableAmount(weeklyDuration, employee?.billRateValue, currency);

				// Return the processed weekly logs data
				return {
					employee,
					dates,
					sum: weeklyDuration || null,
					activity: parseFloat(parseFloat(weeklyActivity + '').toFixed(2)),
					spent,
					currency: spent === null ? null : currency || null
				};
			})
			.value();

		return weeklyLogs;
	}

	/**
	 * Whether an employee has a bill rate but states no currency for it.
	 *
	 * @param employee - The employee, as a report loaded it.
	 */
	private hasRateWithoutCurrency(employee: IEmployee | null | undefined): boolean {
		return !!employee && !employee.billRateCurrency && Number(employee.billRateValue) > 0;
	}

	/**
	 * The currency of the rates that state none: the organization's, read only when some log has such a rate.
	 *
	 * @param logs - The logs a report prices, each with its employee.
	 * @param organizationId - The organization the report is about.
	 * @returns The currency, or null when no rate needs one or the organization states none.
	 */
	private async findCurrencyForRatesWithoutOne(
		logs: ITimeLog[],
		organizationId: ID | undefined
	): Promise<string | null> {
		return logs.some(({ employee }) => this.hasRateWithoutCurrency(employee))
			? await this.findOrganizationCurrency(organizationId)
			: null;
	}

	/**
	 * What the owed-amount report and its chart answer for an employee's day: priced once, in exact decimals, to
	 * the decimals of the rate's currency, as the weekly report prices a week. The employee's pay rate prices it once
	 * a rate editor set it, else their billing rate, as before pay rates existed (see `owedRateOf`).
	 *
	 * @param duration - The seconds of the day.
	 * @param employee - The employee, with their bill rate and its currency.
	 * @param payRates - The pay rates set, by employee id.
	 * @param organizationCurrency - The currency of a rate that states none.
	 * @returns The amount, the rate that priced it and its currency. An employee without a rate is owed nothing,
	 *   which both surfaces declare as a number.
	 */
	private owedLine(
		duration: number,
		employee: IEmployee | null | undefined,
		payRates: Map<ID, StoredPayRate>,
		organizationCurrency: string | null
	): { amount: number; rateSource: OwedRateSource; currency: string | null } {
		const payRate = payRates.get(employee?.id ?? '');
		const owed = owedRateOf(employee, payRate, organizationCurrency);
		const amount = calculateBillableAmount(duration, owed.rate, owed.currency) ?? 0;
		return { amount, rateSource: owed.rateSource, currency: owed.currency };
	}

	/**
	 * The pay rates a rate editor set for the employees whose logs a report prices, by employee id: only the ones the
	 * caller may read (their own, or anyone's for a holder of ORG_EMPLOYEES_EDIT). An amount over a duration would
	 * otherwise tell a manager a teammate's pay rate, so the others' time is priced at their billing rate.
	 */
	private async findPayRatesOf(logs: ITimeLog[], organizationId?: ID): Promise<Map<ID, StoredPayRate>> {
		const payRates = new Map<ID, StoredPayRate>();
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			return payRates;
		}
		const loggedEmployeeIds = logs.map((log) => log.employeeId);
		const knownEmployeeIds = loggedEmployeeIds.filter(Boolean);
		const readableEmployeeIds = knownEmployeeIds.filter((employeeId) => mayReadPayRateOf(employeeId));
		const employeeIds = Array.from(new Set(readableEmployeeIds));
		const rows = await findStoredPayRates(this.typeOrmRepository.manager, employeeIds, tenantId, organizationId);
		for (const row of rows) {
			if (isPayRateSet(row.payRateValue)) {
				payRates.set(row.id, row);
			}
		}
		return payRates;
	}

	/** The organization's currency, read only when a billing rate or a pay rate that prices the report states none. */
	private async findCurrencyForOwedAmounts(
		logs: ITimeLog[],
		payRates: Map<ID, StoredPayRate>,
		organizationId: ID | undefined
	): Promise<string | null> {
		const currency = await this.findCurrencyForRatesWithoutOne(logs, organizationId);
		if (currency) {
			return currency;
		}
		const setPayRates = Array.from(payRates.values());
		const payRateNeedsIt = setPayRates.some((payRate) => payRateNeedsOrganizationCurrency(payRate));
		if (!payRateNeedsIt) {
			return null;
		}
		return await this.findOrganizationCurrency(organizationId);
	}

	/**
	 * The currency of an organization of the current tenant.
	 *
	 * @param organizationId - The organization.
	 * @returns Its currency, or null when it is not set or there is no organization to read.
	 */
	private async findOrganizationCurrency(organizationId: ID | undefined): Promise<string | null> {
		const tenantId = RequestContext.currentTenantId();
		if (!organizationId || !tenantId) {
			return null;
		}
		let organization: Pick<IOrganization, 'currency'> | null;
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				organization = await this.mikroOrmRepository
					.getEntityManager()
					.findOne(Organization, { id: organizationId, tenantId });
				break;
			case MultiORMEnum.TypeORM:
			default:
				organization = await this.typeOrmRepository.manager.findOne(Organization, {
					where: { id: organizationId, tenantId },
					select: { id: true, currency: true }
				});
				break;
		}
		return organization?.currency || null;
	}

	/**
	 * Fetches daily time logs for chart reports based on the provided input.
	 * @param request The input parameters for fetching daily time logs.
	 * @returns An array of daily time log chart reports.
	 */
	async getDailyReportCharts(request: IGetTimeLogReportInput) {
		let logs: ITimeLog[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const where = await this.buildMikroOrmTimeLogWhere(request);
				const items = await this.mikroOrmRepository.find(where, {
					populate: ['employee', 'timeSlots'] as any[],
					orderBy: { startedAt: 'ASC' as any }
				});
				logs = items.map((e) => this.serialize(e)) as ITimeLog[];
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Create a query builder for the TimeLog entity
				const query = this.typeOrmRepository.createQueryBuilder('time_log');

				// Inner join with the employee. The slots are not joined: joined onto the logs they multiplied every log into
				// one row per slot (and, where the slots were also loaded as a relation, per slot squared), tens of
				// thousands of wide rows for a month; `getFilterTimeLogQuery` requires a slot in the activity range with
				// an EXISTS sub-query instead, which answers the same set of logs.
				query.innerJoin(`${query.alias}.employee`, 'employee');

				// Set find options for the query
				query.setFindOptions({
					order: {
						// Order results by the 'startedAt' field in ascending order
						startedAt: 'ASC'
					}
				});
				// Apply additional conditions to the query based on request filters
				await this.getFilterTimeLogQuery(query, request);

				// Execute the query and retrieve time logs
				logs = await query.getMany();
				break;
			}
		}

		// The days the report covers, and the zone its rows are grouped by
		const { days, timeZone } = this.reportDateRange(request);

		// Group time logs by date and calculate tracked, manual, idle, and resumed durations
		const byDate = chain(logs)
			.groupBy((log: ITimeLog) => moment.utc(log.startedAt).tz(timeZone).format('YYYY-MM-DD'))
			.mapObject((logs: ITimeLog[], date) => {
				const tracked = calculateDuration(logs, TimeLogType.TRACKED); //
				const manual = calculateDuration(logs, TimeLogType.MANUAL); //
				const ideal = calculateDuration(logs, TimeLogType.IDLE); //
				const resumed = calculateDuration(logs, TimeLogType.RESUMED); //

				return {
					date,
					value: {
						[TimeLogType.TRACKED]: parseFloat((tracked / 3600).toFixed(1)),
						[TimeLogType.MANUAL]: parseFloat((manual / 3600).toFixed(1)),
						[TimeLogType.IDLE]: parseFloat((ideal / 3600).toFixed(1)),
						[TimeLogType.RESUMED]: parseFloat((resumed / 3600).toFixed(1))
					}
				};
			})
			.value();

		// Map the calculated values to each date, ensuring no missing dates
		const dates = days.map((date) => {
			return (
				byDate[date] || {
					date,
					value: {
						[TimeLogType.TRACKED]: 0,
						[TimeLogType.MANUAL]: 0,
						[TimeLogType.IDLE]: 0,
						[TimeLogType.RESUMED]: 0
					}
				}
			);
		});

		// Return the array of daily time log chart reports
		return dates;
	}

	/**
	 * Retrieves a daily time logs report based on the provided input parameters.
	 * @param request - Input parameters for querying the daily time logs report.
	 * @returns A report containing time logs grouped by specified filters.
	 */
	async getDailyReport(request: IGetTimeLogReportInput) {
		// Extract timezone from the request
		const { timeZone } = request;
		const statesTeam = request.includeTimeWithoutTeam === true;

		let logs: ITimeLog[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const where = await this.buildMikroOrmTimeLogWhere(request);
				const items = await this.mikroOrmRepository.find(where, {
					populate: [
						'employee',
						'employee.user',
						'timeSlots',
						'project',
						'project.organizationContact',
						'task',
						'task.taskStatus',
						'organizationContact'
					] as any[],
					orderBy: { startedAt: 'ASC' as any }
				});
				logs = items.map((e) => this.serialize(e)) as ITimeLog[];
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Create a query builder for the TimeLog entity
				const query = this.typeOrmRepository.createQueryBuilder('time_log');

				// Inner join with the employee. The slots are not joined: joined onto the logs they multiplied every log into
				// one row per slot (and, where the slots were also loaded as a relation, per slot squared), tens of
				// thousands of wide rows for a month; `getFilterTimeLogQuery` requires a slot in the activity range with
				// an EXISTS sub-query instead, which answers the same set of logs.
				query.innerJoin(`${query.alias}.employee`, 'employee');

				// Set find options for the query
				query.setFindOptions({
					select: {
						// Selected fields for the result
						id: true,
						employeeId: true,
						startedAt: true,
						stoppedAt: true,
						description: true,
						projectId: true,
						taskId: true,
						organizationContactId: true,
						organizationTeamId: statesTeam,
						project: {
							id: true,
							name: true,
							imageUrl: true,
							membersCount: true,
							organizationContact: {
								id: true,
								name: true,
								imageUrl: true
							}
						},
						task: TimeLogService.TASK_SELECT_FIELDS,
						organizationContact: {
							id: true,
							name: true,
							imageUrl: true
						},
						employee: {
							id: true,
							userId: true,
							isAway: true,
							isOnline: true,
							user: {
								id: true,
								firstName: true,
								lastName: true,
								imageUrl: true
							}
						}
					},
					relations: {
						// Related entities to be included in the result
						project: { organizationContact: true },
						task: { taskStatus: true },
						organizationContact: true,
						employee: { user: true }
					},
					order: {
						// Order results by the 'startedAt' field in ascending order
						startedAt: 'ASC'
					}
				});
				// Apply additional conditions to the query based on request filters
				await this.getFilterTimeLogQuery(query, request);

				// Execute the query and retrieve time logs, then the figures of their slots the activity is averaged from
				logs = await query.getMany();
				await this.loadTimeSlotFigures(logs);
				break;
			}
		}

		// Group time logs based on the specified 'groupBy' filter
		let dailyLogs: any;
		switch (request.groupBy) {
			case ReportGroupFilterEnum.employee:
				dailyLogs = await this.commandBus.execute(
					new GetTimeLogGroupByEmployeeCommand(logs, timeZone, statesTeam)
				);
				break;
			case ReportGroupFilterEnum.project:
				dailyLogs = await this.commandBus.execute(
					new GetTimeLogGroupByProjectCommand(logs, timeZone, statesTeam)
				);
				break;
			case ReportGroupFilterEnum.client:
				dailyLogs = await this.commandBus.execute(
					new GetTimeLogGroupByClientCommand(logs, timeZone, statesTeam)
				);
				break;
			default:
				dailyLogs = await this.commandBus.execute(new GetTimeLogGroupByDateCommand(logs, timeZone, statesTeam));
				break;
		}

		// Return the generated daily time logs report
		return dailyLogs;
	}

	/**
	 * Fetches an owed amount report based on the provided input.
	 * @param request The input parameters for fetching the owed amount report.
	 * @returns A Promise that resolves to an array of owed amount report data.
	 */
	async getOwedAmountReport(request: IGetTimeLogReportInput): Promise<IAmountOwedReport[]> {
		// The zone the rows are grouped by; a request without one would format an undefined moment
		const timeZone = resolveTimeZone(request.timeZone);

		let timeLogs: ITimeLog[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const where = await this.buildMikroOrmTimeLogWhere(request);
				const items = await this.mikroOrmRepository.find(where, {
					populate: ['employee', 'employee.user'] as any[],
					orderBy: { startedAt: 'ASC' as any }
				});
				timeLogs = items.map((e) => this.serialize(e)) as ITimeLog[];
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Create a query builder for the TimeLog entity
				const query = this.typeOrmRepository.createQueryBuilder('time_log');

				// Inner join with the employee. The slots are not joined: joined onto the logs they multiplied every log into
				// one row per slot (and, where the slots were also loaded as a relation, per slot squared), tens of
				// thousands of wide rows for a month; `getFilterTimeLogQuery` requires a slot in the activity range with
				// an EXISTS sub-query instead, which answers the same set of logs.
				query.innerJoin(`${query.alias}.employee`, 'employee');

				// Set up the find options for the query
				query.setFindOptions({
					select: {
						employee: {
							id: true,
							userId: true,
							isAway: true,
							isOnline: true,
							billRateValue: true,
							// The currency the amounts grid prints the amount in
							billRateCurrency: true,
							user: {
								id: true,
								firstName: true,
								lastName: true,
								imageUrl: true
							}
						}
					},
					relations: {
						// Related entities to be included in the result
						employee: {
							user: true
						}
					},
					order: {
						// Order results by the 'startedAt' field in ascending order
						startedAt: 'ASC'
					}
				});

				// Apply additional conditions to the query based on request filters
				await this.getFilterTimeLogQuery(query, request);

				// Execute the query and retrieve time logs
				timeLogs = await query.getMany();
				break;
			}
		}

		// A rate that states no currency is in the organization's, as on the weekly report
		const payRates = await this.findPayRatesOf(timeLogs, request.organizationId);
		const organizationCurrency = await this.findCurrencyForOwedAmounts(timeLogs, payRates, request.organizationId);

		const dailyLogs: any = chain(timeLogs)
			.groupBy((log) => moment.utc(log.startedAt).tz(timeZone).format('YYYY-MM-DD'))
			.map((byDateLogs: ITimeLog[], date: string) => {
				const byEmployee = chain(byDateLogs)
					.groupBy('employeeId')
					.map((byEmployeeLogs: ITimeLog[]) => {
						// Calculate average duration for specific employee.
						const durationSum = calculateAverage(pluck(byEmployeeLogs, 'duration'));

						// Retrieve employee details
						const employee = byEmployeeLogs.length > 0 ? byEmployeeLogs[0].employee : null;

						const owed = this.owedLine(durationSum, employee, payRates, organizationCurrency);

						return {
							employee,
							amount: owed.amount,
							duration: durationSum,
							rateSource: owed.rateSource,
							currency: owed.currency
						};
					})
					.value();

				return {
					date,
					employees: byEmployee
				};
			})
			.value();

		return dailyLogs;
	}

	/**
	 * Fetches owed amount report data for charts based on the provided input.
	 * @param request The input parameters for fetching owed amount report charts.
	 * @returns An array of owed amount report chart data.
	 */
	async getOwedAmountReportCharts(request: IGetTimeLogReportInput) {
		let timeLogs: ITimeLog[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const where = await this.buildMikroOrmTimeLogWhere(request);
				const items = await this.mikroOrmRepository.find(where, {
					populate: ['employee', 'employee.user'] as any[],
					orderBy: { startedAt: 'ASC' as any }
				});
				timeLogs = items.map((e) => this.serialize(e)) as ITimeLog[];
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Step 1: Create a query builder for the TimeLog entity
				const query = this.typeOrmRepository.createQueryBuilder('time_log');

				// Inner join with the employee. The slots are not joined: joined onto the logs they multiplied every log into
				// one row per slot (and, where the slots were also loaded as a relation, per slot squared), tens of
				// thousands of wide rows for a month; `getFilterTimeLogQuery` requires a slot in the activity range with
				// an EXISTS sub-query instead, which answers the same set of logs.
				query.innerJoin(`${query.alias}.employee`, 'employee');

				// Set find options for the query
				query.setFindOptions({
					select: {
						// Selected fields for the result
						employee: {
							id: true,
							billRateValue: true,
							// The currency sets the decimals the amount is rounded to
							billRateCurrency: true,
							userId: true,
							isAway: true,
							isOnline: true,
							user: {
								id: true,
								firstName: true,
								lastName: true,
								imageUrl: true
							}
						}
					},
					relations: {
						employee: {
							user: true
						}
					},
					order: {
						// Order results by the 'startedAt' field in ascending order
						startedAt: 'ASC'
					}
				});
				// Apply additional conditions to the query based on request filters
				await this.getFilterTimeLogQuery(query, request);

				// Execute the query and retrieve time logs
				timeLogs = await query.getMany();
				break;
			}
		}

		// The days the report covers, and the zone its rows are grouped by
		const { days, timeZone } = this.reportDateRange(request);

		// A rate that states no currency is in the organization's, as on the weekly report
		const payRates = await this.findPayRatesOf(timeLogs, request.organizationId);
		const organizationCurrency = await this.findCurrencyForOwedAmounts(timeLogs, payRates, request.organizationId);

		const byDate: any = chain(timeLogs)
			.groupBy((log: ITimeLog) => moment.utc(log.startedAt).tz(timeZone).format('YYYY-MM-DD'))
			.mapObject((byDateLogs: ITimeLog[], date) => {
				const byEmployee = chain(byDateLogs)
					.groupBy('employeeId')
					.map((byEmployeeLogs: ITimeLog[]) => {
						// Calculate average duration for specific employee.
						const durationSum = calculateAverage(pluck(byEmployeeLogs, 'duration'));

						// Retrieve employee details
						const employee = byEmployeeLogs.length > 0 ? byEmployeeLogs[0].employee : null;

						const owed = this.owedLine(durationSum, employee, payRates, organizationCurrency);

						return {
							employee,
							amount: owed.amount,
							duration: durationSum
						};
					})
					.value();

				// The total owed for all employees on a specific date, added exactly: as doubles, 1.1 + 2.2 is
				// 3.3000000000000003
				const value = byEmployee.reduce((total: number, item: any) => {
					return Number(addDecimalStrings(total, item.amount));
				}, 0);

				return { date, value };
			})
			.value();

		// Map the result to an array of owed amount report chart data
		const dates = days.map((date) => ({
			date,
			value: byDate[date]?.value || 0
		}));

		// Return the array of owed amount report chart data
		return dates;
	}

	/**
	 * It retrieves time log data, processes it, and calculates time limits for each employee based on the specified duration (day, month, etc.).
	 * @param request - An object containing input parameters for the time limit report.
	 * @returns An array of ITimeLimitReport containing information about time limits and durations for each date and employee.
	 */
	async getTimeLimit(request: IGetTimeLimitReportInput) {
		// Set a default duration ('day') if not provided in the request.
		if (!request.duration) {
			request.duration = 'day';
		}

		let timeLogs: ITimeLog[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const where = await this.buildMikroOrmTimeLogWhere(request);
				const items = await this.mikroOrmRepository.find(where, {
					populate: ['employee', 'employee.user'] as any[],
					orderBy: { startedAt: 'ASC' as any }
				});
				timeLogs = items.map((e) => this.serialize(e)) as ITimeLog[];
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Create a query builder for the TimeLog entity
				const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

				// Inner join with the employee. The slots are not joined: joined onto the logs they multiplied every log into
				// one row per slot (and, where the slots were also loaded as a relation, per slot squared), tens of
				// thousands of wide rows for a month; `getFilterTimeLogQuery` requires a slot in the activity range with
				// an EXISTS sub-query instead, which answers the same set of logs.
				query.innerJoin(`${query.alias}.employee`, 'employee');

				// Set find options for the query
				query.setFindOptions({
					select: {
						// Specify the fields to be selected in the query result.
						employee: {
							id: true,
							reWeeklyLimit: true,
							userId: true,
							isOnline: true,
							isAway: true,
							user: {
								id: true,
								firstName: true,
								lastName: true,
								imageUrl: true
							}
						}
					},
					relations: {
						employee: {
							user: true
						}
					},
					order: {
						// Order results by the 'startedAt' field in ascending order
						startedAt: 'ASC'
					}
				});
				// Apply additional conditions to the query based on request filters
				await this.getFilterTimeLogQuery(query, request);

				// Execute the query and retrieve time logs
				timeLogs = await query.getMany();
				break;
			}
		}

		// The days the report covers, and the zone its rows are grouped by
		const { days, timeZone } = this.reportDateRange(request);

		// Process time log data and calculate time limits for each employee and date
		const byDate: any = chain(timeLogs)
			.groupBy((log) => moment.utc(log.startedAt).tz(timeZone).startOf(request.duration).format('YYYY-MM-DD'))
			.mapObject((byDateLogs: ITimeLog[], date) => {
				const byEmployee = chain(byDateLogs)
					.groupBy('employeeId')
					.map((byEmployeeLogs: ITimeLog[]) => {
						// Calculate average duration for specific employee.
						const durationSum = calculateAverage(pluck(byEmployeeLogs, 'duration'));

						// Retrieve employee details
						const employee = byEmployeeLogs.length > 0 ? byEmployeeLogs[0].employee : null;

						let limit = employee ? employee.reWeeklyLimit * 60 * 60 : 0;

						// Define a mapping object for duration multipliers
						const multipliers = {
							day: 1 / 5,
							month: 4
						};

						// Check if the requested duration is in the mapping object
						if (request.duration in multipliers) {
							const durationMultiplier = multipliers[request.duration];

							// Update the limit using the corresponding multiplier
							limit *= durationMultiplier;
						}

						// Calculate duration percentage, handling the case where limit is 0
						const durationPercentage = limit !== 0 ? (durationSum * 100) / limit : 0;

						return {
							employee,
							duration: durationSum,
							durationPercentage: Number.isFinite(durationPercentage) ? durationPercentage.toFixed(2) : 0,
							limit
						};
					})
					.value();

				return { date, employees: byEmployee };
			})
			.value();

		// Create an array of ITimeLimitReport for each date.
		const dates = days.map((date) => (byDate[date] ? byDate[date] : { date, employees: [] }));

		// Return the final result as an array of ITimeLimitReport.
		return dates as ITimeLimitReport[];
	}

	/**
	 * Fetches project budget limit report data based on the provided input.
	 * @param request The input parameters for fetching project budget limit report data.
	 * @returns An array of project budget limit report data.
	 */
	async getProjectBudgetLimit(request: IGetTimeLogReportInput) {
		const { organizationId, employeeIds = [], projectIds = [], startDate, endDate } = request;
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		let organizationProjects: IOrganizationProject[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				organizationProjects = await this.getMikroOrmBudgetTargets(
					{
						table: 'organization_project',
						timeLogKey: 'projectId',
						columns: ['id', 'name', 'budget', 'budgetType', 'imageUrl', 'membersCount', 'currency', 'color']
					},
					{ tenantId, organizationId, employeeIds, projectIds, startDate, endDate }
				);
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Step 1: Create a query builder for the OrganizationProject entity
				const query = this.typeOrmOrganizationProjectRepository.createQueryBuilder('organization_project');

				// Inner join with related entities (employee, timeLogs)
				query.innerJoin(`${query.alias}.timeLogs`, 'timeLogs');
				query.innerJoin(`timeLogs.employee`, 'employee');

				// Set find options for the query
				query.setFindOptions({
					select: {
						id: true,
						name: true,
						budget: true,
						budgetType: true,
						imageUrl: true,
						membersCount: true,
						currency: true,
						color: true
					},
					relations: {
						timeLogs: {
							employee: true
						}
					}
				});
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"${query.alias}"."organizationId" =:organizationId`), {
							organizationId
						});
						qb.andWhere(p(`"${query.alias}"."tenantId" =:tenantId`), {
							tenantId
						});
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"employee"."organizationId" =:organizationId`), {
							organizationId
						});
						qb.andWhere(p(`"employee"."tenantId" =:tenantId`), {
							tenantId
						});
						if (isNotEmpty(employeeIds)) {
							qb.andWhere(p(`"employee"."id" IN (:...employeeIds)`), {
								employeeIds
							});
						}
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"timeLogs"."organizationId" =:organizationId`), {
							organizationId
						});
						qb.andWhere(p(`"timeLogs"."tenantId" =:tenantId`), { tenantId });

						// Date range condition
						const { start, end } = getDateRangeFormat(moment.utc(startDate), moment.utc(endDate));
						qb.andWhere(p(`"timeLogs"."startedAt" >= :startDate AND "timeLogs"."startedAt" < :endDate`), {
							startDate: start,
							endDate: end
						});

						if (isNotEmpty(employeeIds)) {
							qb.andWhere(p(`"timeLogs"."employeeId" IN (:...employeeIds)`), {
								employeeIds
							});
						}
						if (isNotEmpty(projectIds)) {
							qb.andWhere(p(`"timeLogs"."projectId" IN (:...projectIds)`), {
								projectIds
							});
						}
					})
				);

				// Execute the query and retrieve organization projects
				organizationProjects = await query.getMany();
				break;
			}
		}

		const projects = organizationProjects.map(
			(organizationProject: IOrganizationProject): IProjectBudgetLimitReport => {
				const { budgetType, timeLogs = [] } = organizationProject;
				const budget = organizationProject.budget || 0;

				let spent = 0;
				let spentPercentage = 0;
				let remainingBudget = 0;

				if (budgetType == OrganizationProjectBudgetTypeEnum.HOURS) {
					spent = timeLogs.reduce(
						(totalDuration: number, log: ITimeLog) => totalDuration + log.duration / 3600,
						0
					);
				} else {
					spent = timeLogs.reduce((totalAmount: number, log: ITimeLog) => {
						const logAmount = log.employee ? (log.duration / 3600) * log.employee.billRateValue : 0;
						return totalAmount + logAmount;
					}, 0);
				}

				spentPercentage = (spent * 100) / budget;
				remainingBudget = Math.max(budget - spent, 0);

				// Remove timeLogs property from the organizationProject object
				const { timeLogs: _, ...projectWithoutTimeLogs } = organizationProject;

				return {
					project: projectWithoutTimeLogs,
					budgetType,
					budget,
					spent: parseFloat(spent.toFixed(2)),
					remainingBudget: Number.isFinite(remainingBudget) ? parseFloat(remainingBudget.toFixed(2)) : 0,
					spentPercentage: Number.isFinite(spentPercentage) ? parseFloat(spentPercentage.toFixed(2)) : 0
				};
			}
		);

		return projects;
	}

	/**
	 * MikroORM side of the project / client budget reports: the budget targets (projects or contacts) that
	 * have time logged in the range, each with those time logs and the employee bill rate.
	 *
	 * Raw knex bypasses MikroORM's soft-delete filter, so every table read excludes soft-deleted rows itself,
	 * as TypeORM's query builder does in the other branch.
	 */
	private async getMikroOrmBudgetTargets(
		target: { table: string; timeLogKey: string; columns: string[] },
		filters: {
			tenantId: string;
			organizationId: string;
			employeeIds: string[];
			projectIds: string[];
			startDate: Date | string;
			endDate: Date | string;
		}
	): Promise<any[]> {
		const { table, timeLogKey, columns } = target;
		const { tenantId, organizationId, employeeIds, projectIds, startDate, endDate } = filters;
		const knex = (this.mikroOrmTimeLogRepository as any).getKnex();
		const { start, end } = getDateRangeFormat(moment.utc(startDate), moment.utc(endDate));

		// Time logs of the tenant / organization in the range, from non-deleted employees
		const scopeTimeLogs = (query: any) => {
			query = query
				.where('time_log.tenantId', tenantId)
				.andWhere('time_log.organizationId', organizationId)
				.andWhere('time_log.startedAt', '>=', start)
				.andWhere('time_log.startedAt', '<', end)
				.whereNull('time_log.deletedAt')
				.whereNull('employee.deletedAt');
			if (isNotEmpty(employeeIds)) query = query.whereIn('time_log.employeeId', employeeIds);
			if (isNotEmpty(projectIds)) query = query.whereIn('time_log.projectId', projectIds);
			return query;
		};

		// Step 1: Distinct targets with matching time logs
		const matched = await scopeTimeLogs(
			knex(table)
				.innerJoin('time_log', `${table}.id`, `time_log.${timeLogKey}`)
				.innerJoin('employee', 'time_log.employeeId', 'employee.id')
				.select(`${table}.id as id`)
				.andWhere(`${table}.tenantId`, tenantId)
				.andWhere(`${table}.organizationId`, organizationId)
				.andWhere('employee.tenantId', tenantId)
				.andWhere('employee.organizationId', organizationId)
				.whereNull(`${table}.deletedAt`)
				.groupBy(`${table}.id`)
		);
		const matchedIds = matched.map((row: any) => row.id);
		if (matchedIds.length === 0) {
			return [];
		}

		// Step 2: Target details
		const rows = await knex(table).select(...columns).whereIn('id', matchedIds).whereNull('deletedAt');

		// Step 3: Their time logs with the employee bill rate
		const timeLogRows = await scopeTimeLogs(
			knex('time_log')
				.innerJoin('employee', 'time_log.employeeId', 'employee.id')
				.select(
					'time_log.id as id',
					'time_log.startedAt as startedAt',
					'time_log.stoppedAt as stoppedAt',
					`time_log.${timeLogKey} as targetId`,
					'employee.billRateValue as employee_billRateValue'
				)
				.whereIn(`time_log.${timeLogKey}`, matchedIds)
		);

		// Step 4: Attach the time logs to their target
		const timeLogsByTarget: Record<string, any[]> = {};
		for (const row of timeLogRows) {
			const timeLogs = timeLogsByTarget[row.targetId] || [];
			timeLogs.push({
				id: row.id,
				// No column holds a log's duration: the entity works it out when it loads, and this read loads none
				duration: moment.utc(row.stoppedAt || new Date()).diff(moment.utc(row.startedAt), 'seconds'),
				employee: { billRateValue: row.employee_billRateValue }
			});
			timeLogsByTarget[row.targetId] = timeLogs;
		}
		return rows.map((row: any) => ({ ...row, timeLogs: timeLogsByTarget[row.id] || [] }));
	}

	/**
	 * Calculate client budget limit report for a given organization contact.
	 * @param organizationContact The organization contact for which to calculate the budget limit report.
	 * @returns The client budget limit report.
	 */
	async getClientBudgetLimit(request: IGetTimeLogReportInput) {
		const { organizationId, employeeIds = [], projectIds = [], startDate, endDate } = request;
		const tenantId = RequestContext.currentTenantId();

		let organizationContacts: IOrganizationContact[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				organizationContacts = await this.getMikroOrmBudgetTargets(
					{
						table: 'organization_contact',
						timeLogKey: 'organizationContactId',
						columns: ['id', 'name', 'budget', 'budgetType']
					},
					{ tenantId, organizationId, employeeIds, projectIds, startDate, endDate }
				);
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Step 1: Create a query builder for the OrganizationClient entity
				const query = this.typeOrmOrganizationContactRepository.createQueryBuilder('organization_contact');

				// Inner join with related entities (employee, timeLogs)
				query.innerJoin(`${query.alias}.timeLogs`, 'timeLogs');
				query.innerJoin(`timeLogs.employee`, 'employee');

				// Set find options for the query
				query.setFindOptions({
					select: {
						id: true,
						name: true,
						budget: true,
						budgetType: true
					},
					relations: {
						timeLogs: {
							employee: true
						}
					}
				});
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"${query.alias}"."organizationId" =:organizationId`), { organizationId });
						qb.andWhere(p(`"${query.alias}"."tenantId" =:tenantId`), { tenantId });
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"employee"."organizationId" =:organizationId`), { organizationId });
						qb.andWhere(p(`"employee"."tenantId" =:tenantId`), { tenantId });

						if (isNotEmpty(employeeIds)) {
							qb.andWhere(p(`"employee"."id" IN (:...employeeIds)`), { employeeIds });
						}
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(p(`"timeLogs"."organizationId" =:organizationId`), { organizationId });
						qb.andWhere(p(`"timeLogs"."tenantId" =:tenantId`), { tenantId });

						const { start, end } = getDateRangeFormat(moment.utc(startDate), moment.utc(endDate));
						qb.andWhere(p(`"timeLogs"."startedAt" >= :startDate AND "timeLogs"."startedAt" < :endDate`), {
							startDate: start,
							endDate: end
						});

						if (isNotEmpty(employeeIds)) {
							qb.andWhere(p(`"timeLogs"."employeeId" IN (:...employeeIds)`), {
								employeeIds
							});
						}

						if (isNotEmpty(projectIds)) {
							qb.andWhere(p(`"timeLogs"."projectId" IN (:...projectIds)`), {
								projectIds
							});
						}
					})
				);

				// Execute the query and retrieve organization contacts
				organizationContacts = await query.getMany();
				break;
			}
		}

		const clients = organizationContacts.map(
			(organizationContact: IOrganizationContact): IClientBudgetLimitReport => {
				const { budgetType, timeLogs = [], ...contactWithoutTimeLogs } = organizationContact;
				const budget = organizationContact.budget || 0;

				const spent = timeLogs.reduce((total: number, log: ITimeLog) => {
					const amount =
						budgetType === OrganizationContactBudgetTypeEnum.HOURS
							? total + log.duration / 3600
							: total + (log.duration / 3600) * (log.employee?.billRateValue || 0);
					return amount;
				}, 0);

				const spentPercentage = (spent * 100) / budget;
				const remainingBudget = Math.max(budget - spent, 0);

				return {
					organizationContact: { ...contactWithoutTimeLogs },
					budgetType,
					budget,
					spent: parseFloat(spent.toFixed(2)),
					remainingBudget: Number.isFinite(remainingBudget) ? parseFloat(remainingBudget.toFixed(2)) : 0,
					spentPercentage: Number.isFinite(spentPercentage) ? parseFloat(spentPercentage.toFixed(2)) : 0
				};
			}
		);

		return clients;
	}

	/**
	 * Modifies the provided query to filter TimeLogs based on the given criteria.
	 * @param query - The query to be modified.
	 * @param request - The criteria for filtering TimeLogs.
	 * @returns The modified query.
	 */
	async getFilterTimeLogQuery(query: SelectQueryBuilder<TimeLog>, request: IGetTimeLogReportInput) {
		const { organizationId, projectIds = [], teamIds = [], taskIds = [] } = request;
		let { employeeIds = [] } = request;

		const tenantId = RequestContext.currentTenantId();
		const user = RequestContext.currentUser();

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Determine if the request specifies to retrieve data for the current user only
		const isOnlyMeSelected: boolean = request.onlyMe;

		// Set employeeIds based on permissions and request
		if (user.employeeId && isOnlyMeSelected) {
			// Case 1: User explicitly requests "Only Me"
			employeeIds = [user.employeeId];
		} else if (!hasChangeSelectedEmployeePermission && user.employeeId) {
			// Case 2: User doesn't have global permission → Check if manager of requested employees
			if (isNotEmpty(employeeIds)) {
				// Verify if user can manage ALL requested employees in the specified teams
				const canManageAll = await this._managedEmployeeService.canManageEmployees(employeeIds, teamIds);

				if (!canManageAll) {
					// User is NOT manager of all requested employees → Override with currentEmployeeId
					employeeIds = [user.employeeId];
				}
				// Otherwise → Keep the requested employeeIds (no override)
			} else {
				// No specific employeeIds requested → Override with currentEmployeeId
				employeeIds = [user.employeeId];
			}
		}

		// Fail closed for a caller who may not act for other employees and has no employee record of
		// their own: there is no personal scope to narrow to, and every filter below is optional, so the
		// query would return the whole organization (GHSA-6qvm-3wg4-26w4). The CRUD reads already match
		// nothing in that state (findConditionsWithoutOwnEmployee); these hand-built report queries
		// never reach that hook, so they carry the same rule here.
		if (!hasChangeSelectedEmployeePermission && !user.employeeId) {
			query.andWhere('1 = 0');
			return query;
		}

		// Filters records based on the timesheetId.
		if (isNotEmpty(request.timesheetId)) {
			const { timesheetId } = request;
			query.andWhere(p(`"${query.alias}"."timesheetId" = :timesheetId`), { timesheetId });
		}

		// Filters records based on the date range.
		if (isNotEmpty(request.startDate) && isNotEmpty(request.endDate)) {
			const { start: startDate, end: endDate } = getDateRangeFormat(
				moment.utc(request.startDate || moment().startOf('day')),
				moment.utc(request.endDate || moment().endOf('day'))
			);
			query.andWhere(
				new Brackets((qb) => {
					qb.where(p(`"${query.alias}"."startedAt" >= :startDate`), { startDate });
					qb.andWhere(p(`"${query.alias}"."startedAt" < :endDate`), { endDate });
				})
			);
		}

		// Filter by organization employee IDs if used in the request
		if (isNotEmpty(employeeIds)) {
			query.andWhere(p(`"${query.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds });
		}

		// Filter by organization task IDs if used in the request
		if (isNotEmpty(taskIds)) {
			query.andWhere(p(`"${query.alias}"."taskId" IN (:...taskIds)`), { taskIds });
		}

		// Filter by organization project IDs if used in the request
		if (isNotEmpty(projectIds)) {
			query.andWhere(p(`"${query.alias}"."projectId" IN (:...projectIds)`), { projectIds });
		}

		// Filter by organization team IDs if used in the request
		if (isNotEmpty(teamIds)) {
			const memberIdsWithoutTeam = await this.membersCountedWithoutTeam(request, teamIds);
			this.filterByTeams(query, teamIds, memberIdsWithoutTeam);
		}

		// Filters records based on the overall column, representing the activity level.
		/**
		 * Activity Level should be 0-100%
		 * Convert it into a 10-minute time slot by multiplying by 6
		 */
		const activityRange = isNotEmpty(request.activityLevel)
			? { start: request.activityLevel.start * 6, end: request.activityLevel.end * 6 }
			: undefined;

		// The report queries join the slots (`timeSlots`) to read their activity figures, and are filtered on
		// that join; a query that does not join them is filtered with an EXISTS sub-query instead.
		const joinsTimeSlots = this.joinsTimeSlots(query);

		if (activityRange && joinsTimeSlots) {
			query.andWhere(p(`"timeSlots"."overall" BETWEEN :start AND :end`), activityRange);
		}

		// Filters records based on the source column.
		if (isNotEmpty(request.source)) {
			const { source } = request;
			const condition =
				source instanceof Array
					? p(`"${query.alias}"."source" IN (:...source)`)
					: p(`"${query.alias}"."source" = :source`);

			query.andWhere(condition, { source });
		}

		// Filters records based on the logType column.
		if (isNotEmpty(request.logType)) {
			const { logType } = request;
			const condition =
				logType instanceof Array
					? p(`"${query.alias}"."logType" IN (:...logType)`)
					: p(`"${query.alias}"."logType" = :logType`);

			query.andWhere(condition, { logType });
		}

		/**
		 * Apply a condition to the TypeORM query based on the 'isEdited' property in the request.
		 * If 'isEdited' is true, filter rows where the 'editedAt' column is not null.
		 * If 'isEdited' is false, filter rows where the 'editedAt' column is null.
		 * A key present with no value (GraphQL resolvers pass every optional argument, so an omitted
		 * `isEdited` arrives as `undefined`) applies no filter, so edited logs stay in the report.
		 */
		if ('isEdited' in request && request.isEdited !== undefined && request.isEdited !== null) {
			if (request.isEdited) {
				query.andWhere(p(`"${query.alias}"."editedAt" IS NOT NULL`));
			} else {
				query.andWhere(p(`"${query.alias}"."editedAt" IS NULL`));
			}
		}

		// Opt-in: a report that does not ask keeps counting every log, billable or not, as its clients expect.
		if (request.billableOnly === true) {
			query.andWhere(p(`"${query.alias}"."isBillable" = :isBillable`), { isBillable: true });
		}

		// Opt-in, as above: a read that does not ask keeps counting every log, invoiced or not.
		if (request.notInvoiced === true) {
			query.andWhere(notOnLiveInvoice(`"${query.alias}"."invoiceItemId"`), NOT_ON_LIVE_INVOICE_PARAMETERS);
		}

		query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
		query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
		if (joinsTimeSlots) {
			query.andWhere(p(`"timeSlots"."tenantId" = :tenantId`), { tenantId });
			query.andWhere(p(`"timeSlots"."organizationId" = :organizationId`), { organizationId });
		} else {
			this.requireTimeSlot(query, { tenantId, organizationId, ...activityRange });
		}

		return query;
	}

	/**
	 * Whether the query joins the log's time slots under the `timeSlots` alias, as the report queries do to
	 * read the slots' activity figures.
	 *
	 * @param query The time-log query.
	 */
	private joinsTimeSlots(query: SelectQueryBuilder<TimeLog>): boolean {
		return (query.expressionMap?.joinAttributes ?? []).some((join) => join.alias?.name === 'timeSlots');
	}

	/**
	 * Keeps the logs that have at least one time slot of the organization — and, given an activity range, one
	 * whose activity lies in it — without joining the slots onto the log rows.
	 *
	 * `getTimeLogs` used to INNER JOIN the slots for this. When the caller also asked for the `timeSlots`
	 * relation, TypeORM joined them a second time for the relation, and every log came back once per
	 * (slot × slot): on production 120 logs became 21,291 rows, 1.6 s in PostgreSQL and a 24 MB sort, before the
	 * API hydrated them (497 calls at 5.8 s mean, 35 s max). The EXISTS sub-query answers the same logs, once
	 * each; the relation, when asked for, still carries every slot of the log, as it did.
	 *
	 * @param query The time-log query.
	 * @param scope The organization the slots must belong to, and the activity range (`overall`, in seconds
	 * of a ten-minute slot) one of them must lie in, if any.
	 */
	/**
	 * Loads, onto each log, the activity figures of its slots (`id`, `overall`, `duration`, and the `percentage` the
	 * subscriber derives on load), which the report groupings average (`calculateAverageActivity`) and the weekly
	 * report answers per log: every slot linked to the log that is not deleted, as the
	 * `timeSlots` relation loaded them when it was joined (the join carried the soft-delete condition only, so the
	 * activity-level range the logs are filtered on does not narrow a log's slots). One query per thousand logs
	 * instead of one row per (log × slot × slot); a log without slots keeps an empty list.
	 *
	 * @param logs - The logs of a report, as read with their other relations.
	 */
	private async loadTimeSlotFigures(logs: ITimeLog[]): Promise<void> {
		const figures = new Map<ID, ITimeSlot[]>();
		const ids = [...new Set(logs.map((log) => log.id))];
		for (let offset = 0; offset < ids.length; offset += TimeLogService.SLOT_FIGURES_CHUNK) {
			const timeLogIds = ids.slice(offset, offset + TimeLogService.SLOT_FIGURES_CHUNK);
			const rows = await this.typeOrmRepository.manager
				.createQueryBuilder()
				.select(p(`"slotLog"."timeLogId"`), 'timeLogId')
				.addSelect(p(`"slot"."id"`), 'id')
				.addSelect(p(`"slot"."overall"`), 'overall')
				.addSelect(p(`"slot"."duration"`), 'duration')
				.from(p('time_slot_time_logs'), p('slotLog'))
				.innerJoin(p('time_slot'), p('slot'), p(`"slot"."id" = "slotLog"."timeSlotId"`))
				.where(p(`"slotLog"."timeLogId" IN (:...timeLogIds)`), { timeLogIds })
				.andWhere(p(`"slot"."deletedAt" IS NULL`))
				.orderBy(p(`"slot"."startedAt"`), 'ASC')
				.addOrderBy(p(`"slot"."id"`), 'ASC')
				.getRawMany<{ timeLogId: ID; id: ID; overall: number; duration: number }>();
			for (const { timeLogId, id, overall, duration } of rows) {
				// `percentage` as `TimeSlotSubscriber.afterEntityLoad` set it on the joined slots (the weekly report
				// answers each log's slots): the slot's activity share, rounded as there, 0 for an empty duration.
				const percentage = duration === 0 ? 0 : parseFloat(Math.round((overall * 100) / duration).toFixed(2));
				if (!figures.has(timeLogId)) figures.set(timeLogId, []);
				figures.get(timeLogId).push({ id, overall, duration, percentage } as ITimeSlot);
			}
		}
		// Assigned once every row is read: a log without slots keeps an empty list
		for (const log of logs) {
			log.timeSlots = figures.get(log.id) ?? [];
		}
	}

	private requireTimeSlot(
		query: SelectQueryBuilder<TimeLog>,
		scope: { tenantId: ID; organizationId: ID; start?: number; end?: number }
	): void {
		const { tenantId, organizationId, start, end } = scope;
		query.andWhere((qb: SelectQueryBuilder<TimeLog>) => {
			const subQuery = qb
				.subQuery()
				.select('1')
				.from(p('time_slot_time_logs'), p('slotLog'))
				.innerJoin(p('time_slot'), p('slot'), p(`"slot"."id" = "slotLog"."timeSlotId"`))
				.where(p(`"slotLog"."timeLogId" = "${query.alias}"."id"`))
				.andWhere(p(`"slot"."deletedAt" IS NULL`))
				.andWhere(p(`"slot"."tenantId" = :slotTenantId`), { slotTenantId: tenantId })
				.andWhere(p(`"slot"."organizationId" = :slotOrganizationId`), { slotOrganizationId: organizationId });
			if (start !== undefined && end !== undefined) {
				subQuery.andWhere(p(`"slot"."overall" BETWEEN :slotActivityStart AND :slotActivityEnd`), {
					slotActivityStart: start,
					slotActivityEnd: end
				});
			}
			return `EXISTS ${subQuery.getQuery()}`;
		});
	}

	/**
	 * The members whose time logged without a team a team-scoped report also counts: nobody unless the report asks
	 * for it (`includeTimeWithoutTeam`), and then only the members of the requested teams the caller may read as
	 * those teams' (see `ManagedEmployeeService.findMembersOfReadableTeams`), never anyone else's.
	 *
	 * @param request The report input.
	 * @param teamIds The teams the report is scoped to.
	 * @returns The members' employeeIds, empty when the report counts no time without a team.
	 */
	private async membersCountedWithoutTeam(request: IGetTimeLogReportInput, teamIds: ID[]): Promise<ID[]> {
		const includesTimeWithoutTeam = request.includeTimeWithoutTeam === true;
		if (!includesTimeWithoutTeam) {
			return [];
		}
		return await this._managedEmployeeService.findMembersOfReadableTeams(teamIds);
	}

	/**
	 * Narrows a report to the logs of the given teams and, when members are given, to those members' logs without a
	 * team as well.
	 *
	 * @param query The report query.
	 * @param teamIds The teams the report is scoped to.
	 * @param memberIdsWithoutTeam The members whose logs without a team the report also counts.
	 */
	private filterByTeams(query: SelectQueryBuilder<TimeLog>, teamIds: ID[], memberIdsWithoutTeam: ID[]): void {
		const teamCondition = p(`"${query.alias}"."organizationTeamId" IN (:...teamIds)`);
		if (!isNotEmpty(memberIdsWithoutTeam)) {
			query.andWhere(teamCondition, { teamIds });
			return;
		}
		query.andWhere(
			new Brackets((teamOrMember) => {
				teamOrMember.where(teamCondition, { teamIds });
				teamOrMember.orWhere(
					new Brackets((withoutTeam) => {
						withoutTeam.where(p(`"${query.alias}"."organizationTeamId" IS NULL`));
						withoutTeam.andWhere(p(`"${query.alias}"."employeeId" IN (:...memberIdsWithoutTeam)`), {
							memberIdsWithoutTeam
						});
					})
				);
			})
		);
	}

	/**
	 * The MikroORM twin of `filterByTeams`.
	 *
	 * @param teamIds The teams the report is scoped to.
	 * @param memberIdsWithoutTeam The members whose logs without a team the report also counts.
	 * @returns The where conditions on the team.
	 */
	private mikroOrmTeamWhere(teamIds: ID[], memberIdsWithoutTeam: ID[]): Record<string, unknown> {
		const teamCondition = { organizationTeamId: { $in: teamIds } };
		if (!isNotEmpty(memberIdsWithoutTeam)) {
			return teamCondition;
		}
		const withoutTeamCondition = { organizationTeamId: null, employeeId: { $in: memberIdsWithoutTeam } };
		return { $or: [teamCondition, withoutTeamCondition] };
	}

	/**
	 * Builds a MikroORM-compatible where object for filtering TimeLogs.
	 * This mirrors the getFilterTimeLogQuery logic for MikroORM.
	 *
	 * @param request - The criteria for filtering TimeLogs.
	 * @returns A MikroORM-compatible where object.
	 */
	private async buildMikroOrmTimeLogWhere(request: IGetTimeLogReportInput): Promise<any> {
		const { organizationId, projectIds = [], teamIds = [], taskIds = [] } = request;
		let { employeeIds = [] } = request;

		const tenantId = RequestContext.currentTenantId();
		const user = RequestContext.currentUser();

		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		const isOnlyMeSelected: boolean = request.onlyMe;

		if (user.employeeId && isOnlyMeSelected) {
			employeeIds = [user.employeeId];
		} else if (!hasChangeSelectedEmployeePermission && user.employeeId) {
			if (isNotEmpty(employeeIds)) {
				const canManageAll = await this._managedEmployeeService.canManageEmployees(employeeIds, teamIds);
				if (!canManageAll) {
					employeeIds = [user.employeeId];
				}
			} else {
				employeeIds = [user.employeeId];
			}
		}

		// Fail closed for a caller with neither the permission nor an employee record. See the TypeORM
		// branch in getFilterTimeLogQuery.
		if (!hasChangeSelectedEmployeePermission && !user.employeeId) {
			return { id: { $in: [] } };
		}

		const where: any = { tenantId, organizationId };

		if (isNotEmpty(request.timesheetId)) {
			where.timesheetId = request.timesheetId;
		}

		if (isNotEmpty(request.startDate) && isNotEmpty(request.endDate)) {
			const { start, end } = getDateRangeFormat(
				moment.utc(request.startDate || moment().startOf('day')),
				moment.utc(request.endDate || moment().endOf('day'))
			);
			where.startedAt = { $gte: start, $lt: end };
		}

		if (isNotEmpty(employeeIds)) where.employeeId = { $in: employeeIds };
		if (isNotEmpty(taskIds)) where.taskId = { $in: taskIds };
		if (isNotEmpty(projectIds)) where.projectId = { $in: projectIds };
		if (isNotEmpty(teamIds)) {
			const memberIdsWithoutTeam = await this.membersCountedWithoutTeam(request, teamIds);
			Object.assign(where, this.mikroOrmTeamWhere(teamIds, memberIdsWithoutTeam));
		}

		if (isNotEmpty(request.source)) {
			where.source = request.source instanceof Array ? { $in: request.source } : request.source;
		}
		if (isNotEmpty(request.logType)) {
			where.logType = request.logType instanceof Array ? { $in: request.logType } : request.logType;
		}

		// An `isEdited` key with no value applies no filter, as in getFilterTimeLogQuery.
		if ('isEdited' in request && request.isEdited !== undefined && request.isEdited !== null) {
			where.editedAt = request.isEdited ? { $ne: null } : null;
		}

		if (request.billableOnly === true) {
			where.isBillable = true;
		}

		if (request.notInvoiced === true) {
			where[mikroOrmNotOnLiveInvoiceKey()] = [];
		}

		if (isNotEmpty(request.activityLevel)) {
			const { activityLevel } = request;
			where.timeSlots = {
				...(where.timeSlots || {}),
				overall: { $gte: activityLevel.start * 6, $lte: activityLevel.end * 6 }
			};
		}

		return where;
	}

	/**
	 * Returns the time logs of an employee that overlap a date range, for a REQUEST-BORNE input.
	 *
	 * `GET /timesheet/time-log/conflict` used to hand the caller's query straight to
	 * `IGetConflictTimeLogCommand`, which uses `employeeId` and `organizationId` verbatim. The route
	 * only requires the TIME_TRACKER permission — which the default EMPLOYEE role holds — so any
	 * employee could name a colleague's employee id and read that colleague's time logs (start/stop
	 * times, description, source, plus any joined relation) over any date range they liked.
	 *
	 * This wrapper puts the same authorization the report and delete paths already use in front of
	 * it, and is the ONLY entry point the controller should use. `addManualTime` and `updateManualTime`
	 * keep executing the command directly once `assertCanWriteTimeFor` has cleared their `employeeId`,
	 * and the timer service only passes the employee of the log it is stopping.
	 *
	 * @param input The validated conflict query.
	 * @returns The conflicting time logs the caller is allowed to see.
	 */
	async getConflictTimeLogs(input: IGetTimeLogConflictInput): Promise<ITimeLog[]> {
		// Fail closed. The tenant is never taken from the caller's query here: the command falls
		// back to `input.tenantId` when the context has none, which on a request would be a
		// caller-chosen tenant.
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new ForbiddenException('A tenant context is required to read conflicting time logs');
		}

		await this.assertCanReadEmployeeTimeLogs(input.employeeId);

		return await this.commandBus.execute(new IGetConflictTimeLogCommand({ ...input, tenantId }));
	}

	/**
	 * Refuses a read of an employee's time logs unless the caller is that employee, manages them, or
	 * holds CHANGE_SELECTED_EMPLOYEE.
	 *
	 * Shared by `getConflictTimeLogs` and `TimeLogConflictAccessGuard`. The guard is what checks the
	 * `timeLogConflicts` GraphQL field, which dispatches the conflict command without going through this
	 * service.
	 *
	 * @param employeeId The employee whose time logs are read.
	 */
	async assertCanReadEmployeeTimeLogs(employeeId: ID): Promise<void> {
		if (!employeeId) {
			throw new ForbiddenException('An employee is required to read conflicting time logs');
		}

		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			// `currentEmployeeId()` returns null for CHANGE_SELECTED_EMPLOYEE holders by design, so
			// it is only meaningful in this branch; fall back to the user's own employee id.
			const currentEmployeeId = RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId;

			// Own logs are always readable. Otherwise the caller has to actually manage that
			// employee — the same check `getFilterTimeLogQuery` and `deleteTimeLogs` apply. A caller
			// with no employee identity at all matches neither and is refused.
			const isOwnEmployee = !!currentEmployeeId && String(currentEmployeeId) === String(employeeId);
			if (!isOwnEmployee && !(await this._managedEmployeeService.canManageEmployees([employeeId], []))) {
				throw new ForbiddenException('You do not have permission to read time logs for this employee');
			}
		}
	}

	/**
	 * Loads the employee a manual time log is written for, inside the caller's tenant.
	 *
	 * The raw repository has no tenant scoping, and an undefined id would be dropped from the where
	 * clause and match an arbitrary employee, so both a missing id and a missing tenant fail closed
	 * (GHSA-6qvm-3wg4-26w4).
	 *
	 * @param employeeId - The employee from the request.
	 * @param tenantId - The caller's tenant.
	 * @returns The employee, with its organization.
	 */
	private async findEmployeeInTenant(employeeId: ID, tenantId: ID): Promise<IEmployee> {
		const employee =
			employeeId && tenantId
				? await this.typeOrmEmployeeRepository.findOne({
						where: { id: employeeId, tenantId },
						relations: { organization: true }
					})
				: null;
		if (!employee) {
			throw new NotFoundException('The employee was not found');
		}
		return employee;
	}

	/**
	 * Refuses a manual time write for an employee the caller may not act for.
	 *
	 * `TimeLogBodyTransformPipe` only fills a missing `employeeId`, so a named one reaches the service
	 * as sent. The caller must be that employee, hold CHANGE_SELECTED_EMPLOYEE, or manage them in a
	 * team of their organization; anything else is a 403 rather than time booked to someone else.
	 *
	 * @param employeeId - The employee the time is written for, already resolved in the tenant.
	 * @param organizationId - That employee's organization, which anchors the team lookup.
	 */
	private async assertCanWriteTimeFor(employeeId: ID, organizationId: ID): Promise<void> {
		if (!(await this._managedEmployeeService.canManageEmployee(employeeId, undefined, organizationId))) {
			throw new ForbiddenException('You do not have permission to log time for this employee');
		}
	}

	/**
	 * Refuses to move a log whose time slots carry what was captured while its employee was tracked.
	 *
	 * Screenshots name the user whose screen they show, activities the employee whose applications and
	 * pages they list, and the per-minute records are that employee's keyboard and mouse: moving them with
	 * the log would attribute one person's tracked evidence to another. A log without any (manual time, a
	 * browser timer) moves whole — its slots are blank and are recreated for the new employee.
	 *
	 * @param id The time log to move.
	 * @throws ForbiddenException When one of its slots carries screenshots, activities or minute activity.
	 */
	private async assertMovableToAnotherEmployee(id: ID): Promise<void> {
		const timeLog = await this.withoutEmployeeFilter(() =>
			this.findOneByIdString(id, {
				relations: { timeSlots: { screenshots: true, activities: true, timeSlotMinutes: true } }
			})
		);

		const tracked = (timeLog?.timeSlots ?? []).some(
			(slot) =>
				isNotEmpty(slot.screenshots) ||
				isNotEmpty(slot.activities) ||
				isNotEmpty(slot.timeSlotMinutes) ||
				Boolean(slot.keyboard) ||
				Boolean(slot.mouse)
		);

		if (tracked) {
			throw new ForbiddenException(
				'A time log with tracked activity or screenshots cannot be moved to another employee'
			);
		}
	}

	/**
	 * Refuses manual time in an organization whose policy forbids it.
	 *
	 * The rule is `OrganizationPermissionGuard`'s for `ALLOW_MANUAL_TIME`, applied to the organization the log
	 * is written under: the policy must be on — a missing or unset policy refuses, as the guard's query counts
	 * only `allowManualTime = true` — and the guard's one exemption holds here too, a SUPER_ADMIN while the
	 * installation lets that role bypass the organization policy (`allowSuperAdminRole`).
	 *
	 * @param organization The employee's organization, as the employee was read with it.
	 * @throws ForbiddenException When the organization does not allow manual time.
	 */
	private assertManualTimeAllowedIn(organization: IOrganization | undefined): void {
		if (env.allowSuperAdminRole && RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])) {
			return;
		}

		if (!organization?.allowManualTime) {
			throw new ForbiddenException("Manual time is not allowed in the employee's organization");
		}
	}

	/**
	 * Refuses manual time over a timer that is still running.
	 *
	 * The overlap cleanup never cuts a running log (`DeleteTimeSpanHandler`), so recording the time anyway would count
	 * those minutes twice, on the new log and on the running one, whose ten-minute slots the new log would also share.
	 * The request is refused instead, before anything is trimmed or written. The desktop timer and the agent keep an
	 * upload refused this way and send it again at their next sync: their offline time is recorded once that timer stops.
	 *
	 * @param conflicts The logs the new range overlaps.
	 * @throws ConflictException with the code RUNNING_TIMER_OVERLAP.
	 */
	private assertNoRunningTimerIn(conflicts: ITimeLog[] | null | undefined): void {
		if ((conflicts ?? []).some((log) => log.isRunning)) {
			throw new ConflictException({
				message: 'A timer is running over this time range. Stop it first, or choose a range outside it.',
				code: RUNNING_TIMER_OVERLAP
			});
		}
	}

	/**
	 * The employee's timers still running that started before `end` (#11886).
	 *
	 * Such a run keeps going until it is stopped, so a manual range ending after its start falls over it, wherever its
	 * stored range ends. The overlap lookup (`IGetConflictTimeLogCommand`) misses those: it matches the stored range,
	 * whose `stoppedAt` is a running log's last heartbeat (its start, for a client that sends none: the web timer, the
	 * API clients), and on TypeORM it only returns logs with time slots.
	 *
	 * A tracker's upload of the time it tracked offline leaves out a tracker's run (the desktop timer and the agent),
	 * as before: that run may have been left open on the server while the tracker was offline, and it keeps the end its
	 * time slots give it, which the overlap lookup reads. Manual time a person adds or edits counts every running timer.
	 *
	 * @param end Where the manual range ends.
	 * @param employeeId The employee the time is for.
	 * @param organizationId Their organization.
	 * @param tenantId Their tenant.
	 * @param ignoreId The log being edited, which never counts.
	 * @param isTrackerUpload Whether a tracker uploads the range (`uploadedByTracker`).
	 */
	private async findRunningTimersStartedBefore(
		end: Date | string,
		employeeId: ID,
		organizationId: ID,
		tenantId: ID,
		ignoreId?: ID,
		isTrackerUpload = false
	): Promise<ITimeLog[]> {
		const before = moment.utc(end).toDate();
		let running: ITimeLog[];
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const items = await this.mikroOrmTimeLogRepository.find({
					employeeId,
					organizationId,
					tenantId,
					isRunning: true,
					startedAt: { $lt: before },
					...(ignoreId ? { id: { $ne: ignoreId } } : {})
				} as any);
				running = items.map((item) => this.serialize(item)) as ITimeLog[];
				break;
			}
			case MultiORMEnum.TypeORM:
			default:
				running = await this.typeOrmTimeLogRepository.find({
					where: {
						employeeId,
						organizationId,
						tenantId,
						isRunning: true,
						startedAt: LessThan(before),
						...(ignoreId ? { id: Not(ignoreId) } : {})
					}
				});
		}
		return isTrackerUpload ? running.filter((log) => !isTrackerSource(log.source)) : running;
	}

	/**
	 * The manual entry as it is recorded under its organization's switches: the team and the project filled where they
	 * can be (see `teamIdForEntry` and `projectIdForEntry`), and refused when a required field is still missing, unless
	 * a tracker uploaded it. The employee is the one the time is for, so the team is theirs, not the caller's.
	 *
	 * @param request The entry as sent.
	 * @param employee The employee the time is for, with their organization.
	 * @param organizationId That employee's organization.
	 * @param tenantId The caller's tenant.
	 * @throws BadRequestException with the code TRACKING_FIELD_REQUIRED.
	 */
	private async withRequiredContext(
		request: IManualTimeEntry,
		employee: IEmployee,
		organizationId: ID,
		tenantId: ID
	): Promise<IManualTimeInput> {
		const { uploadedByTracker, ...sent } = request;
		const requirements = employee.organization;
		const trackedEmployee = { employeeId: employee.id, organizationId, tenantId };
		const manager = this.typeOrmTimeLogRepository.manager;
		const takesTaskProject = false;

		const organizationTeamId = await teamIdForEntry(manager, trackedEmployee, sent, requirements);
		const teamContext = { ...sent, organizationTeamId };
		const projectId = await projectIdForEntry(
			manager,
			trackedEmployee,
			teamContext,
			requirements,
			takesTaskProject
		);
		const entry = { ...teamContext, projectId };
		const isTrackerUpload = uploadedByTracker === true;
		if (!isTrackerUpload) {
			assertRequiredContext(requirements, entry);
		}
		return entry;
	}

	/**
	 * Adds a manual time log entry.
	 *
	 * @param request The input data for the manual time log.
	 * @returns The created time log entry.
	 */
	async addManualTime(request: IManualTimeEntry): Promise<ITimeLog> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { employeeId, startedAt, stoppedAt } = request;

			// Validate input
			if (!startedAt || !stoppedAt) {
				throw new BadRequestException('Please select valid Date, start time and end time');
			}

			// Retrieve employee information
			const employee: IEmployee = await this.findEmployeeInTenant(employeeId, tenantId);

			// The organization is the EMPLOYEE's, not the body's. The policy consulted right below is
			// `employee.organization`'s, so honouring a different organizationId of the same tenant would
			// judge the write by one organization's rules and then persist it — log, slots and timesheet —
			// under another's. The body value is only a fallback for an employee without an organization.
			const organizationId = employee.organizationId ?? request.organizationId;

			await this.assertCanWriteTimeFor(employeeId, organizationId);

			// The manual-time policy of that same organization. `OrganizationPermissionGuard` judges the
			// organization the request names and the caller's own, never the employee's — and a caller who may
			// choose the employee (CHANGE_SELECTED_EMPLOYEE reaches every employee of the tenant) could name a
			// permissive organization, or none, and record time in an organization whose policy forbids it.
			this.assertManualTimeAllowedIn(employee.organization);

			// Check if future dates are allowed for the organization
			const futureDateAllowed: IOrganization['futureDateAllowed'] = employee.organization.futureDateAllowed;

			// Check if the selected date and time range is allowed for the organization
			const isDateAllow = this.allowDate(startedAt, stoppedAt, futureDateAllowed);
			if (!isDateAllow) {
				throw new BadRequestException('Please select valid Date, start time and end time');
			}

			const entry = await this.withRequiredContext(request, employee, organizationId, tenantId);

			// Check for conflicts with existing time logs
			const conflicts = await this.commandBus.execute(
				new IGetConflictTimeLogCommand({
					startDate: startedAt,
					endDate: stoppedAt,
					employeeId,
					organizationId,
					tenantId,
					...(request.id && { ignoreId: request.id }) // Simplified ternary check
				})
			);

			// A running timer in the range is refused, never cut, including one the range falls over after its last
			// heartbeat or before its first time slot, which the lookup above misses (#11886). Only a tracker's upload
			// passes over a tracker's run, left open on the server while it was offline
			this.assertNoRunningTimerIn(conflicts);
			const isTrackerUpload = request.uploadedByTracker === true;
			this.assertNoRunningTimerIn(
				await this.findRunningTimersStartedBefore(
					stoppedAt,
					employeeId,
					organizationId,
					tenantId,
					request.id,
					isTrackerUpload
				)
			);

			// Resolve conflicts by deleting conflicting time slots
			if (conflicts?.length) {
				const times: IDateRange = {
					start: new Date(startedAt),
					end: new Date(stoppedAt)
				};
				// Loop through each conflicting time log
				for await (const timeLog of conflicts) {
					const { timeSlots = [] } = timeLog;
					// Delete conflicting time slots
					for await (const timeSlot of timeSlots) {
						await this.commandBus.execute(new DeleteTimeSpanCommand(times, timeLog, timeSlot));
					}
				}
			}

			// Create the new time log entry. The handler reads it back through this service, whose employee
			// filter would not find a log written for a member the caller manages.
			return await this.withoutEmployeeFilter(() =>
				this.commandBus.execute(new TimeLogCreateCommand({ ...entry, organizationId }))
			);
		} catch (error) {
			// Never swallow the reason: a blanket message here hid a real database failure indefinitely.
			if (error instanceof HttpException) {
				throw error;
			}
			throw new BadRequestException(`Failed to add manual time log: ${error?.message ?? error}`);
		}
	}

	/**
	 * Updates a manual time log entry.
	 *
	 * @param id The ID of the time log entry to be updated.
	 * @param request The updated data for the manual time log.
	 * @returns The updated time log entry.
	 */
	async updateManualTime(id: ID, request: IManualTimeInput): Promise<ITimeLog> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { startedAt, stoppedAt, employeeId } = request;

			// Validate input
			if (!startedAt || !stoppedAt) {
				throw new BadRequestException('Please select valid Date start and end time');
			}

			// Retrieve employee information
			const employee: IEmployee = await this.findEmployeeInTenant(employeeId, tenantId);

			// The employee's organization, never the body's — see `addManualTime`. It must also be the log's own
			// (checked below, once the log is read), and the overlap cleanup runs in the log's organization.
			const organizationId = employee.organizationId ?? request.organizationId;

			await this.assertCanWriteTimeFor(employeeId, organizationId);

			// Check if future dates are allowed for the organization
			const futureDateAllowed: IOrganization['futureDateAllowed'] = employee.organization.futureDateAllowed;

			// Check if the selected date and time range is allowed for the organization
			const isDateAllow = this.allowDate(startedAt, stoppedAt, futureDateAllowed);
			if (!isDateAllow) {
				throw new BadRequestException('Please select valid Date, start time and end time');
			}

			// The stored log, read past this service's own-employee filter: a team manager edits a member's log, and
			// that filter would answer "not found" for any log but the manager's own. `assertCanWriteTimeFor` above
			// has already checked that the caller may write `employeeId`'s time, and the owner check below refuses any
			// other log, so the read reaches nothing the caller could not have edited.
			const timeLog = await this.withoutEmployeeFilter(() => this.findOneByIdString(id));

			// The update keeps the log's timesheet and time slots, while the conflict cleanup below deletes
			// slots of `employeeId`: naming anyone but the log's owner would move the log without its time
			// and erase that employee's overlapping work. Hence a refusal, before that cleanup runs.
			if (
				!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) &&
				String(timeLog.employeeId) !== String(employeeId)
			) {
				throw new ForbiddenException('A time log cannot be moved to another employee');
			}

			// A log stays in its organization, for every caller. The update keeps the stored row's organization
			// (`TimeLogUpdateHandler` never takes it from the input), but `employeeId` is not a scope field, and
			// CHANGE_SELECTED_EMPLOYEE reaches every employee of the tenant: an employee of another organization
			// would re-point the log at them across organizations and run the overlap cleanup below in theirs,
			// deleting that organization's time slots under a policy (`allowModifyTime`) judged on the log's.
			if (String(employee.organizationId ?? '') !== String(timeLog.organizationId ?? '')) {
				throw new ForbiddenException('A time log cannot be moved to an employee of another organization');
			}

			// A move within the organization takes the log's timesheet, time slots and hours with it
			// (`TimeLogUpdateHandler`), but never what was captured while the previous employee was tracked.
			if (String(timeLog.employeeId) !== String(employeeId)) {
				await this.assertMovableToAnotherEmployee(id);
			}

			// Check for conflicts with existing time logs — in the log's own organization, which is the employee's.
			const conflicts = await this.commandBus.execute(
				new IGetConflictTimeLogCommand({
					startDate: startedAt,
					endDate: stoppedAt,
					employeeId,
					organizationId: timeLog.organizationId,
					tenantId,
					...(id && { ignoreId: id }) // Simplified check for id
				})
			);

			// A running timer in the range is refused, never cut (the edited log itself is not among the conflicts),
			// including one the range falls over after its last heartbeat or before its first time slot (#11886)
			this.assertNoRunningTimerIn(conflicts);
			this.assertNoRunningTimerIn(
				await this.findRunningTimersStartedBefore(stoppedAt, employeeId, timeLog.organizationId, tenantId, id)
			);

			// Resolve conflicts by deleting conflicting time slots
			if (conflicts?.length) {
				const times: IDateRange = { start: new Date(startedAt), end: new Date(stoppedAt) };

				// Loop through each conflicting time log
				for await (const conflict of conflicts) {
					const { timeSlots = [] } = conflict;
					// Delete conflicting time slots
					for await (const timeSlot of timeSlots) {
						await this.commandBus.execute(new DeleteTimeSpanCommand(times, conflict, timeSlot));
					}
				}
			}

			// Update the last edited date for the manual time log
			request.editedAt = new Date();

			// Execute the command to update the time log
			await this.commandBus.execute(new TimeLogUpdateCommand(request, timeLog));

			// Retrieve the updated time log entry (a member's log, for a manager: same scope as the read above)
			return await this.withoutEmployeeFilter(() => this.findOneByIdString(id));
		} catch (error) {
			// Never swallow the reason (same blanket catch as `addManualTime`).
			if (error instanceof HttpException) {
				throw error;
			}
			throw new BadRequestException(`Failed to update manual time log: ${error?.message ?? error}`);
		}
	}

	/**
	 * Deletes time logs based on the provided parameters.
	 *
	 * @param params - The parameters for deleting the time logs, including `logIds`, `organizationId`, and `forceDelete`.
	 * @returns A promise that resolves to the result of the delete or soft delete operation.
	 * @throws NotAcceptableException if no log IDs are provided.
	 */
	async deleteTimeLogs(params: IDeleteTimeLog): Promise<DeleteResult | UpdateResult> {
		// Early return if no logIds are provided
		if (isEmpty(params.logIds)) {
			throw new NotAcceptableException('You cannot delete time logs without IDs');
		}

		// Ensure logIds is an array
		const logIds: ID[] = Array.isArray(params.logIds) ? params.logIds : [params.logIds];

		// Get the tenant ID from the request context or the provided tenant ID
		const tenantId = RequestContext.currentTenantId() ?? params.tenantId;
		const { organizationId, forceDelete } = params;

		// Create a query builder for the TimeLog entity
		let timeLogs: TimeLog[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const items = await this.mikroOrmRepository.find(
					{ id: { $in: logIds }, tenantId, organizationId } as any,
					{ populate: ['timeSlots'] as any[] }
				);
				timeLogs = items.map((e) => this.serialize(e)) as TimeLog[];
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.typeOrmRepository.createQueryBuilder();

				// Set find options for the query
				query.setFindOptions({
					relations: { timeSlots: true }
				});

				// Add where clauses to the query
				query.where(p(`"${query.alias}"."id" IN (:...logIds)`), { logIds });
				query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

				// Get the time logs from the database
				timeLogs = await query.getMany();
				break;
			}
		}

		if (isEmpty(timeLogs)) {
			throw new NotAcceptableException('No time logs found with the provided IDs');
		}

		// If user doesn't have permission to change selected employee, check manager access
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			const currentEmployeeId = RequestContext.currentEmployeeId();

			// Extract unique employeeIds and teamIds from the fetched time logs. The caller's own logs are
			// left out: for logs without a team, `canManageEmployees` has no self case and would refuse them
			// to an employee who manages no team.
			const uniqueEmployeeIds = [...new Set(timeLogs.map((log) => log.employeeId))].filter(
				(employeeId) => !currentEmployeeId || employeeId !== currentEmployeeId
			);
			const uniqueTeamIds = [...new Set(timeLogs.map((log) => log.organizationTeamId).filter(Boolean))];

			// Check if user can manage all employees in the time logs
			const canManageAll = await this._managedEmployeeService.canManageEmployees(
				uniqueEmployeeIds,
				uniqueTeamIds
			);

			if (!canManageAll) {
				throw new NotAcceptableException('You do not have permission to delete time logs for these employees');
			}
		}

		// Invoke the command bus to delete the time logs
		return await this.commandBus.execute(new TimeLogDeleteCommand(timeLogs, forceDelete));
	}

	/**
	 * Check if the provided date range is allowed.
	 *
	 * @param start - Start date
	 * @param end - End date
	 * @param organization - Organization object
	 * @returns {boolean} - Returns true if the date range is allowed, otherwise false.
	 */
	private allowDate(start: Date, end: Date, futureDateAllowed: boolean): boolean {
		// Check if the start date is before the end date
		if (!moment.utc(start).isBefore(moment.utc(end))) {
			return false;
		}
		// Check if future dates are allowed for the organization
		if (futureDateAllowed) {
			return true;
		}
		// Check if the end date is on or before the current date
		return moment(end).isSameOrBefore(moment());
	}

	/** Logs per slot-figures query (`loadTimeSlotFigures`): keeps the IN list within every database's limits. */
	private static readonly SLOT_FIGURES_CHUNK = 1000;

	private static readonly TASK_SELECT_FIELDS = {
		id: true,
		isActive: true,
		isArchived: true,
		tenantId: true,
		organizationId: true,
		number: true,
		prefix: true,
		title: true,
		description: true,
		status: true,
		priority: true,
		size: true,
		issueType: true,
		estimate: true,
		dueDate: true,
		startDate: true,
		resolvedAt: true,
		version: true,
		taskStatus: {
			name: true,
			value: true,
			description: true,
			icon: true,
			color: true,
			order: true,
			isCollapsed: true,
			isDefault: true
		}
	} as const;
}
