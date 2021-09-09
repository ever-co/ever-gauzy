import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Repository, Between, In, SelectQueryBuilder, Brackets, WhereExpression } from 'typeorm';
import * as moment from 'moment';
import {
	IUpdateTimesheetStatusInput,
	IGetTimesheetInput,
	ISubmitTimesheetInput,
	PermissionsEnum,
	ITimesheet
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { getDateRangeFormat } from './../core/utils';
import { Timesheet } from './timesheet.entity';
import {
	TimesheetFirstOrCreateCommand,
	TimesheetSubmitCommand,
	TimesheetUpdateStatusCommand
} from './commands';

@Injectable()
export class TimeSheetService extends TenantAwareCrudService<Timesheet> {
	constructor(
		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>,

		private readonly commandBus: CommandBus
	) {
		super(timeSheetRepository);
	}

	async createOrFindTimeSheet(
		employeeId: string, 
		date: Date = new Date()
	): Promise<ITimesheet> {
		return await this.commandBus.execute(
			new TimesheetFirstOrCreateCommand(date, employeeId)
		);
	}

	async submitTimeheet(
		input: ISubmitTimesheetInput
	): Promise<ITimesheet[]> {
		return await this.commandBus.execute(
			new TimesheetSubmitCommand(input)
		);
	}

	async updateStatus(
		input: IUpdateTimesheetStatusInput
	): Promise<ITimesheet[]> {
		return await this.commandBus.execute(
			new TimesheetUpdateStatusCommand(input)
		);
	}

	/**
	 * GET timesheets count in date range for same tenant
	 * 
	 * @param request 
	 * @returns 
	 */
	async getTimeSheetCount(request: IGetTimesheetInput): Promise<number> {
		return await this.timeSheetRepository.count({
			join: {
				alias: 'timesheet',
				innerJoin: {
					employee: 'timesheet.employee',
					timeLogs: 'timesheet.timeLogs'
				}
			},
			where: (query: SelectQueryBuilder<Timesheet>) => {
				this.getFilterTimesheetQuery(query, request);
			}
		});
	}

	/**
	 * GET timesheets in date range for same tenant
	 * 
	 * @param request 
	 * @returns 
	 */
	async getTimeSheets(request: IGetTimesheetInput): Promise<ITimesheet[]> {
		return await this.timeSheetRepository.find({
			join: {
				alias: 'timesheet',
				innerJoin: {
					employee: 'timesheet.employee',
					timeLogs: 'timesheet.timeLogs'
				}
			},
			relations: [
				...(RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
					? ['employee', 'employee.organization', 'employee.user']
					: [])
			],
			where: (query: SelectQueryBuilder<Timesheet>) => {
				this.getFilterTimesheetQuery(query, request);
			}
		});
	}

	/**
	 * GET timesheet QueryBuilder
	 * 
	 * @param qb 
	 * @param request 
	 * @returns 
	 */
	async getFilterTimesheetQuery(
		qb: SelectQueryBuilder<Timesheet>,
		request: IGetTimesheetInput
	) {
		// use current start of the month if startDate not found
		const startDate: any = (request.startDate) ?
							moment.utc(request.startDate) :
							moment.utc().startOf('month');

		// use current end of the month if endDate not found
		const endDate: any = (request.endDate) ?
							moment.utc(request.endDate) :
							moment.utc().endOf('month');

		const { start, end } = getDateRangeFormat(startDate, endDate);
		const tenantId = RequestContext.currentTenantId();
		
		const employeeIds: string[] = [];
		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			if (request.employeeIds) {
				employeeIds.push(...request.employeeIds);
			}
		} else {
			const { employeeId } = RequestContext.currentUser();
			employeeIds.push(employeeId);
		}

		qb.andWhere(
			new Brackets((qb: WhereExpression) => { 
				qb.where(						{
					startedAt: Between( start, end ),
					...(employeeIds.length > 0 ? { employeeId: In(employeeIds) } : {})
				});
			})
		);

		qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
		qb.andWhere(`"${qb.alias}"."deletedAt" IS NULL`);

		if (isNotEmpty(request.organizationId)) {
			qb.andWhere( `"${qb.alias}"."organizationId" = :organizationId`, {
				organizationId: request.organizationId
			});
		}
		return qb;
	}
}
