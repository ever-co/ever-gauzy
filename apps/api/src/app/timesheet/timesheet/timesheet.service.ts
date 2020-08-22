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
	TimesheetStatus,
	PermissionsEnum
} from '@gauzy/models';
import { RequestContext } from '../../core/context';
import { CommandBus } from '@nestjs/cqrs';
import { TimesheetFirstOrCreateCommand } from './commands/timesheet-first-or-create.command';

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

	async submitTimeheet({ ids, status }: ISubmitTimesheetInput) {
		if (typeof ids === 'string') {
			ids = [ids];
		}
		const timesheet = await this.timeSheetRepository.update(
			{
				id: In(ids)
			},
			{
				submittedAt: status === 'submit' ? new Date() : null
			}
		);
		return timesheet;
	}

	async updateStatus({ ids, status }: IUpdateTimesheetStatusInput) {
		if (typeof ids === 'string') {
			ids = [ids];
		}

		let approvedBy: string = null;
		if (status === TimesheetStatus.APPROVED) {
			const user = RequestContext.currentUser();
			approvedBy = user.employeeId;
		}

		const timesheet = await this.timeSheetRepository.update(
			{
				id: In(ids)
			},
			{
				status: status,
				approvedById: approvedBy,
				approvedAt:
					status === TimesheetStatus.APPROVED ? new Date() : null
			}
		);
		return timesheet;
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
				if (request.organizationId) {
					qb.andWhere(
						'"employee"."organizationId" = :organizationId',
						{ organizationId: request.organizationId }
					);
				}
			}
		});
		return timesheet;
	}
}
