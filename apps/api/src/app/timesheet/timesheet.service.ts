import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Timesheet } from './timesheet.entity';
import * as moment from 'moment';
import {
	RolesEnum,
	IUpdateTimesheetStatusInput,
	IGetTimeSheetInput,
	ISubmitTimesheetInput,
	TimesheetStatus
} from '@gauzy/models';
import { RequestContext } from '../core/context';

@Injectable()
export class TimeSheetService extends CrudService<Timesheet> {
	constructor(
		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>
	) {
		super(timeSheetRepository);
	}

	async createOrFindTimeSheet(employeeId, date: Date = new Date()) {
		const from_date = moment(date).startOf('week');
		const to_date = moment(date).endOf('week');

		let timesheet = await this.timeSheetRepository.findOne({
			where: {
				startedAt: Between(from_date, to_date),
				employeeId: employeeId
			}
		});

		if (!timesheet) {
			timesheet = await this.timeSheetRepository.save({
				employeeId: employeeId,
				startedAt: from_date.toISOString(),
				stoppedAt: to_date.toISOString()
			});
		}
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
			approvedBy = user.id;
		}

		const timesheet = await this.timeSheetRepository.update(
			{
				id: In(ids)
			},
			{
				status: status,
				approvedById: approvedBy
			}
		);
		return timesheet;
	}

	async getTimeSheets(request: IGetTimeSheetInput, role?: RolesEnum) {
		let employeeId: string;
		const startDate = moment(request.startDate).format(
			'YYYY-MM-DD HH:mm:ss'
		);
		const endDate = moment(request.endDate).format('YYYY-MM-DD HH:mm:ss');

		if (role === RolesEnum.ADMIN) {
			if (request.employeeId) {
				employeeId = request.employeeId;
			}
		} else {
			const user = RequestContext.currentUser();
			employeeId = user.employeeId;
		}

		const timesheet = await this.timeSheetRepository.find({
			join: {
				alias: 'timesheet',
				innerJoin: {
					employee: 'timesheet.employee'
				}
			},
			relations: [
				...(role === RolesEnum.ADMIN
					? ['employee', 'employee.organization', 'employee.user']
					: [])
			],
			where: (qb) => {
				qb.where({
					startedAt: Between(startDate, endDate),
					deletedAt: null,
					...(employeeId ? { employeeId } : {})
				});
				qb.andWhere('"startedAt" Between :startDate AND :endDate', {
					startDate,
					endDate
				});
				qb.andWhere('"deletedAt" IS NULL');
				if (request.employeeId) {
					qb.andWhere('"employeeId" = :employeeId', {
						employeeId: request.employeeId
					});
				}
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
