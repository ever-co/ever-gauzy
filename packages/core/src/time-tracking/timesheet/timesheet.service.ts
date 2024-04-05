import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, SelectQueryBuilder, Brackets, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { IGetTimesheetInput, PermissionsEnum, ITimesheet } from '@gauzy/contracts';
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
		@InjectRepository(Timesheet)
		typeOrmTimesheetRepository: TypeOrmTimesheetRepository,

		mikroOrmTimesheetRepository: MikroOrmTimesheetRepository
	) {
		super(typeOrmTimesheetRepository, mikroOrmTimesheetRepository);
	}

	/**
	 * GET timesheets count in date range for same tenant
	 *
	 * @param request
	 * @returns
	 */
	async getTimeSheetCount(request: IGetTimesheetInput): Promise<number> {
		const query = this.typeOrmRepository.createQueryBuilder('timesheet');
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.where((query: SelectQueryBuilder<Timesheet>) => {
			this.getFilterTimesheetQuery(query, request);
		});
		return await query.getCount();
	}

	/**
	 * GET timesheets in date range for same tenant
	 *
	 * @param request
	 * @returns
	 */
	async getTimeSheets(request: IGetTimesheetInput): Promise<ITimesheet[]> {
		const query = this.typeOrmRepository.createQueryBuilder('timesheet');
		query.innerJoin(`${query.alias}.employee`, 'employee');
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
			...(request && request.relations
				? {
					relations: request.relations
				}
				: {})
		});
		query.where((query: SelectQueryBuilder<Timesheet>) => {
			this.getFilterTimesheetQuery(query, request);
		});
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
		const { organizationId, startDate, endDate } = request;
		let { employeeIds = [] } = request;

		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const user = RequestContext.currentUser();

		// Calculate start and end dates using a utility function
		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('month')), // use current start of the month if startDate not found
			moment.utc(endDate || moment().endOf('month')) // use current end of the month if endDate not found
		);

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Determine if the request specifies to retrieve data for the current user only
		const isOnlyMeSelected: boolean = request.onlyMe;

		if ((user.employeeId && isOnlyMeSelected) || (!hasChangeSelectedEmployeePermission && user.employeeId)) {
			employeeIds = [user.employeeId];
		}

		qb.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.where({
					startedAt: Between(start, end),
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
