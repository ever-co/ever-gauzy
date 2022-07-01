import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Repository, Between, In, SelectQueryBuilder, Brackets, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import {
	IUpdateTimesheetStatusInput,
	IGetTimesheetInput,
	ISubmitTimesheetInput,
	PermissionsEnum,
	ITimesheet
} from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { TenantAwareCrudService } from './../../core/crud';
import { getDateRangeFormat } from './../../core/utils';
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

	async submitTimeSheet(
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
				...(request.relations ? request.relations : [])
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
		const user = RequestContext.currentUser();
		const tenantId = RequestContext.currentTenantId();
		
		const { organizationId, startDate, endDate } = request;
		const { start, end } = (startDate && endDate) ?
								getDateRangeFormat(
									moment.utc(startDate),
									moment.utc(endDate)
								) :
								// use current start of the month if startDate not found
								// use current end of the month if endDate not found
								getDateRangeFormat(
									moment().startOf('month').utc(),
									moment().endOf('month').utc()
								);

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
			employeeIds.push(user.employeeId);
		}

		qb.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => { 
				qb.where(						{
					startedAt: Between(start, end),
					...(employeeIds.length > 0 ? { employeeId: In(employeeIds) } : {})
				});
			})
		);

		qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
		qb.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, { organizationId });
		qb.andWhere(`"${qb.alias}"."deletedAt" IS NULL`);
		return qb;
	}
}
