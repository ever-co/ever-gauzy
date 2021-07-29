import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, SelectQueryBuilder } from 'typeorm';
import { TenantAwareCrudService } from './../../core/crud';
import { Timesheet } from '../timesheet.entity';
import * as moment from 'moment';
import {
	IUpdateTimesheetStatusInput,
	IGetTimesheetInput,
	ISubmitTimesheetInput,
	PermissionsEnum,
	ITimesheet
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { CommandBus } from '@nestjs/cqrs';
import { getConfig } from '@gauzy/config';
import {
	TimesheetFirstOrCreateCommand,
	TimesheetSubmitCommand,
	TimesheetUpdateStatusCommand
} from './commands';
const config = getConfig();

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

	async getTimeSheetCount(request: IGetTimesheetInput) {
		const timesheets = await this.getTimeSheets(request);
		return timesheets.length;
	}

	async getTimeSheets(request: IGetTimesheetInput): Promise<ITimesheet[]> {
		let employeeIds: string[];
		let startDate: any = moment.utc(request.startDate);
		let endDate: any = moment.utc(request.endDate);

		if (config.dbConnectionOptions.type === 'sqlite') {
			startDate = startDate.format('YYYY-MM-DD HH:mm:ss');
			endDate = endDate.format('YYYY-MM-DD HH:mm:ss');
		} else {
			startDate = startDate.toDate();
			endDate = endDate.toDate();
		}

		const tenantId = RequestContext.currentTenantId();
		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			if (request.employeeIds) {
				employeeIds = request.employeeIds;
			}
		} else {
			const user = RequestContext.currentUser();
			employeeIds = [user.employeeId];
		}

		const timesheet = await this.timeSheetRepository.find({
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
			where: (qb: SelectQueryBuilder<Timesheet>) => {
				qb.where({
					startedAt: Between(startDate, endDate),
					...(employeeIds ? { employeeId: In(employeeIds) } : {})
				});
				qb.andWhere(`"${qb.alias}"."deletedAt" IS NULL`);
				//check organization and tenant for timelogs
				const { organizationId = null } = request;
				if (typeof organizationId === 'string') {
					qb.andWhere(
						`"${qb.alias}"."organizationId" = :organizationId`,
						{ organizationId: request.organizationId }
					);
				}
				//check organization and tenant for timelogs
				if (tenantId) {
					qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
				}
			}
		});
		return timesheet;
	}
}
