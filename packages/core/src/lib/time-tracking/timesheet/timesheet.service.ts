import { ForbiddenException, Injectable } from '@nestjs/common';
import { Between, In, SelectQueryBuilder, Brackets, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { ID, IGetTimesheetInput, PermissionsEnum, ITimesheet, TimesheetStatus } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { TenantAwareCrudService } from './../../core/crud';
import { getDateRangeFormat, MultiORMEnum, parseFindOptionsRelations } from './../../core/utils';
import { ManagedEmployeeService } from './../../employee/managed-employee.service';
import { Timesheet } from './timesheet.entity';
import { prepareSQLQuery as p } from './../../database/database.helper';
import { TypeOrmTimesheetRepository } from './repository/type-orm-timesheet.repository';
import { MikroOrmTimesheetRepository } from './repository/mikro-orm-timesheet.repository';

const NOT_A_MANAGED_EMPLOYEE_TIMESHEET = 'You can only change the status of timesheets of employees you manage';

@Injectable()
export class TimeSheetService extends TenantAwareCrudService<Timesheet> {
	constructor(
		typeOrmTimesheetRepository: TypeOrmTimesheetRepository,
		mikroOrmTimesheetRepository: MikroOrmTimesheetRepository,
		private readonly _managedEmployeeService: ManagedEmployeeService
	) {
		super(typeOrmTimesheetRepository, mikroOrmTimesheetRepository);
	}

	/**
	 * Runs a status change on timesheets of employees the caller manages in a team.
	 *
	 * A caller without CAN_APPROVE_TIMESHEET may move a timesheet only when it belongs to a member of a
	 * team they manage, and never their own. Every timesheet named has to pass, or nothing is written.
	 * The callback then runs without the caller's employee filter, which would keep the update and the
	 * read back on the caller's own rows.
	 *
	 * @param ids - The timesheets the change names.
	 * @param organizationId - The organization the change is made in.
	 * @param callback - The change to run once the check passes.
	 * @returns The callback's result.
	 * @throws ForbiddenException When a timesheet is the caller's own or belongs to an employee they do not manage.
	 */
	public async forManagedEmployeeTimesheets<R>(
		ids: ID[],
		organizationId: ID,
		callback: () => Promise<R>
	): Promise<R> {
		await this.assertManagesTimesheetEmployees(ids, organizationId);

		return await this.withoutEmployeeFilter(callback);
	}

	/**
	 * Refuses a status change unless every timesheet it names belongs to another employee the caller
	 * manages in a team.
	 *
	 * `canManageEmployees` also accepts the caller's own employee when they belong to a team they manage,
	 * so the caller's own timesheets are refused first. A timesheet not found in the organization counts
	 * as one the caller does not manage.
	 *
	 * @param ids - The timesheets the change names.
	 * @param organizationId - The organization the change is made in.
	 */
	private async assertManagesTimesheetEmployees(ids: ID[], organizationId: ID): Promise<void> {
		const uniqueIds = [...new Set(ids)];
		const where = { id: In(uniqueIds), organizationId };
		const timesheets = await this.withoutEmployeeFilter(() => this.find({ where }));

		const everyTimesheetFound = timesheets.length === uniqueIds.length;
		if (!everyTimesheetFound) {
			throw new ForbiddenException(NOT_A_MANAGED_EMPLOYEE_TIMESHEET);
		}

		const ownEmployeeId = RequestContext.currentUser()?.employeeId;
		const includesOwnTimesheet = timesheets.some((timesheet) => timesheet.employeeId === ownEmployeeId);
		if (includesOwnTimesheet) {
			throw new ForbiddenException('You cannot change the status of your own timesheet');
		}

		const timesheetEmployeeIds = timesheets.map((timesheet) => timesheet.employeeId);
		const employeeIds = [...new Set(timesheetEmployeeIds)];
		const managesEveryEmployee = await this._managedEmployeeService.canManageEmployees(employeeIds);
		if (!managesEveryEmployee) {
			throw new ForbiddenException(NOT_A_MANAGED_EMPLOYEE_TIMESHEET);
		}
	}

	/**
	 * Runs the timesheet bookkeeping of a time log write for that log's employee, whoever the caller is.
	 *
	 * The write has already cleared the caller for that employee. Under the caller's employee filter, a
	 * team manager adding time for a member would create the member's timesheet as their own, and the
	 * recalculation would not find the member's timesheet at all.
	 *
	 * @param callback - The timesheet reads and writes to run.
	 * @returns The callback's result.
	 */
	public async forTimeLogEmployee<R>(callback: () => Promise<R>): Promise<R> {
		return await this.withoutEmployeeFilter(callback);
	}

	/**
	 * GET timesheets count in date range for the same tenant
	 *
	 * @param request
	 * @returns number - Count of timesheets
	 */
	async getTimeSheetCount(request: IGetTimesheetInput): Promise<number> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				let {
					organizationId,
					startDate,
					endDate,
					employeeIds = [],
					status = [],
					onlyMe: isOnlyMeSelected
				} = request;
				const tenantId = RequestContext.currentTenantId() ?? request.tenantId;
				const user = RequestContext.currentUser();
				const hasChangeSelectedEmployeePermission = RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				);
				if (user.employeeId && (isOnlyMeSelected || !hasChangeSelectedEmployeePermission)) {
					employeeIds = [user.employeeId];
				}
				const { start, end } = getDateRangeFormat(
					moment.utc(startDate || moment().startOf('month')),
					moment.utc(endDate || moment().endOf('month'))
				);
				const where: any = {
					tenantId,
					organizationId,
					startedAt: { $gte: start, $lte: end }
				};
				if (employeeIds.length > 0) where.employeeId = { $in: employeeIds };
				if (status.length > 0)
					where.status = { $in: status.filter((s) => Object.values(TimesheetStatus).includes(s)) };

				return await this.mikroOrmRepository.count(where);
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.typeOrmRepository.createQueryBuilder('timesheet');
				query.innerJoin(`${query.alias}.employee`, 'employee');

				// Apply filters to the query
				await this.getFilterTimesheetQuery(query, request);

				// Return the total count of timesheets
				return query.getCount();
			}
		}
	}

	/**
	 * GET timesheets in date range for the same tenant
	 *
	 * @param request
	 * @returns Promise<ITimesheet[]> - List of timesheets
	 */
	async getTimeSheets(request: IGetTimesheetInput): Promise<ITimesheet[]> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		this.assertRelationsPermitted(request);

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				let {
					organizationId,
					startDate,
					endDate,
					employeeIds = [],
					status = [],
					onlyMe: isOnlyMeSelected
				} = request;
				const tenantId = RequestContext.currentTenantId() ?? request.tenantId;
				const user = RequestContext.currentUser();
				const hasChangeSelectedEmployeePermission = RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				);
				if (user.employeeId && (isOnlyMeSelected || !hasChangeSelectedEmployeePermission)) {
					employeeIds = [user.employeeId];
				}
				const { start, end } = getDateRangeFormat(
					moment.utc(startDate || moment().startOf('month')),
					moment.utc(endDate || moment().endOf('month'))
				);
				const where: any = {
					tenantId,
					organizationId,
					startedAt: { $gte: start, $lte: end }
				};
				if (employeeIds.length > 0) where.employeeId = { $in: employeeIds };
				if (status.length > 0)
					where.status = { $in: status.filter((s) => Object.values(TimesheetStatus).includes(s)) };

				const items = await this.mikroOrmRepository.find(where, {
					populate: (request?.relations || []) as any[]
				});
				return items.map((e) => this.serialize(e)) as ITimesheet[];
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.typeOrmRepository.createQueryBuilder('timesheet');
				query.innerJoin(`${query.alias}.employee`, 'employee');

				// Set select options and optional relations
				query.setFindOptions({
					select: {
						employee: {
							id: true,
							user: {
								firstName: true,
								lastName: true,
								email: true
							}
						},
						organization: {
							name: true,
							brandColor: true
						}
					},
					...(request.relations ? { relations: parseFindOptionsRelations(request.relations) } : {})
				});

				// Apply filters to the query
				await this.getFilterTimesheetQuery(query, request);

				// Return the list of timesheets
				return await query.getMany();
			}
		}
	}

	/**
	 * GET timesheet QueryBuilder
	 *
	 * @param qb
	 * @param request
	 * @returns
	 */
	async getFilterTimesheetQuery(qb: SelectQueryBuilder<Timesheet>, request: IGetTimesheetInput) {
		let { organizationId, startDate, endDate, onlyMe: isOnlyMeSelected, employeeIds = [], status = [] } = request;

		const tenantId = RequestContext.currentTenantId() ?? request.tenantId; // Retrieve the tenant ID from the request
		const user = RequestContext.currentUser(); // Retrieve the current user

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		if (user.employeeId && (isOnlyMeSelected || !hasChangeSelectedEmployeePermission)) {
			employeeIds = [user.employeeId];
		}

		// Calculate start and end dates using a utility function
		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('month')), // use current start of the month if startDate not found
			moment.utc(endDate || moment().endOf('month')) // use current end of the month if endDate not found
		);

		qb.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.where({
					startedAt: Between(start, end),
					...(status.length > 0
						? {
								status: In(status.filter((s) => Object.values(TimesheetStatus).includes(s)))
						  }
						: {}),
					...(employeeIds.length > 0 ? { employeeId: In(employeeIds) } : {})
				});
			})
		);

		// Additional conditions for filtering by tenantId and organizationId
		qb.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });
		qb.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), { organizationId });

		return qb;
	}
}
