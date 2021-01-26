import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, SelectQueryBuilder } from 'typeorm';
import { CrudService } from '../../core/crud/crud.service';
import { Timesheet } from '../timesheet.entity';
import * as moment from 'moment';
import {
	IUpdateTimesheetStatusInput,
	IGetTimesheetInput,
	ISubmitTimesheetInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { CommandBus } from '@nestjs/cqrs';
import { TimesheetFirstOrCreateCommand } from './commands/timesheet-first-or-create.command';
import { TimesheetUpdateStatusCommand } from './commands/timesheet-update-status.command';
import { TimesheetSubmitCommand } from './commands/timesheet-submit.command';

@Injectable()
export class TimeSheetService extends CrudService<Timesheet> {
	constructor(
		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>,
		private readonly commandBus: CommandBus
	) {
		super(timeSheetRepository);
	}

	async createOrFindTimeSheet(employeeId, date: Date = new Date()) {
		const timesheet = await this.commandBus.execute(
			new TimesheetFirstOrCreateCommand(date, employeeId)
		);

		return timesheet;
	}

	submitTimeheet(input: ISubmitTimesheetInput) {
		return this.commandBus.execute(new TimesheetSubmitCommand(input));
	}

	updateStatus(input: IUpdateTimesheetStatusInput) {
		return this.commandBus.execute(new TimesheetUpdateStatusCommand(input));
	}

	async getTimeSheetCount(request: IGetTimesheetInput) {
		const timesheets = await this.getTimeSheets(request);
		return timesheets.length;
	}
	async getTimeSheets(request: IGetTimesheetInput) {
		let employeeIds: string[];
		const startDate = moment(request.startDate).format(
			'YYYY-MM-DD HH:mm:ss'
		);
		const endDate = moment(request.endDate).format('YYYY-MM-DD HH:mm:ss');

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
				qb.andWhere(
					`"${qb.alias}"."startedAt" Between :startDate AND :endDate`,
					{
						startDate,
						endDate
					}
				);
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
				let { tenantId = null } = request;
				//if not found tenantId then get from current user session
				if (typeof tenantId !== 'string') {
					const user = RequestContext.currentUser();
					tenantId = user.tenantId;
				}
				if (tenantId) {
					qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
						tenantId
					});
				}
			}
		});
		return timesheet;
	}
}
