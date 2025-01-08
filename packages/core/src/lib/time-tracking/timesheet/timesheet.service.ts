import { Injectable } from '@nestjs/common';
import { Between, In, SelectQueryBuilder, Brackets, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { IGetTimesheetInput, PermissionsEnum, ITimesheet, TimesheetStatus } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { TenantAwareCrudService } from './../../core/crud';
import { getDateRangeFormat } from './../../core/utils';
import { Timesheet } from './timesheet.entity';
import { prepareSQLQuery as p } from './../../database/database.helper';
import { TypeOrmTimesheetRepository } from './repository/type-orm-timesheet.repository';
import { MikroOrmTimesheetRepository } from './repository/mikro-orm-timesheet.repository';

@Injectable()
export class TimeSheetService extends TenantAwareCrudService<Timesheet> {
	constructor(
		typeOrmTimesheetRepository: TypeOrmTimesheetRepository,
		mikroOrmTimesheetRepository: MikroOrmTimesheetRepository
	) {
		super(typeOrmTimesheetRepository, mikroOrmTimesheetRepository);
	}

	/**
	 * GET timesheets count in date range for the same tenant
	 *
	 * @param request
	 * @returns number - Count of timesheets
	 */
	async getTimeSheetCount(request: IGetTimesheetInput): Promise<number> {
		const query = this.typeOrmRepository.createQueryBuilder('timesheet');
		query.innerJoin(`${query.alias}.employee`, 'employee');

		// Apply filters to the query
		query.where((query: SelectQueryBuilder<Timesheet>) => {
			this.getFilterTimesheetQuery(query, request);
		});

		// Return the total count of timesheets
		return query.getCount();
	}

	/**
	 * GET timesheets in date range for the same tenant
	 *
	 * @param request
	 * @returns Promise<ITimesheet[]> - List of timesheets
	 */
	async getTimeSheets(request: IGetTimesheetInput): Promise<ITimesheet[]> {
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
			...(request?.relations ? { relations: request.relations } : {})
		});

		// Apply filters to the query
		query.where((query: SelectQueryBuilder<Timesheet>) => {
			this.getFilterTimesheetQuery(query, request);
		});

		// Return the list of timesheets
		return await query.getMany();
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
