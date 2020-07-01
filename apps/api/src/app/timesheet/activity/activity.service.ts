import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../../core/crud/crud.service';
import { Activity } from '../activity.entity';
import * as moment from 'moment';
import { RequestContext } from '../../core/context';
import { PermissionsEnum, IGetActivitiesInput } from '@gauzy/models';

@Injectable()
export class ActivityService extends CrudService<Activity> {
	constructor(
		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>
	) {
		super(activityRepository);
	}

	async getActivites(request: IGetActivitiesInput) {
		let employeeIds: string[];

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

		return await this.activityRepository.find({
			join: {
				alias: 'activity',
				innerJoin: {
					employee: 'activity.employee'
				}
			},
			relations: [
				...(RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
					? ['employee', 'employee.user']
					: [])
			],
			order: {
				duration: 'DESC'
			},
			where: (qb) => {
				if (request.startDate && request.endDate) {
					const startDate = moment(request.startDate).format(
						'YYYY-MM-DD HH:mm:ss'
					);
					const endDate = moment(request.endDate).format(
						'YYYY-MM-DD HH:mm:ss'
					);
					qb.andWhere('"date" Between :startDate AND :endDate', {
						startDate,
						endDate
					});
				}
				if (employeeIds) {
					qb.andWhere('"employeeId" IN (:...employeeId)', {
						employeeId: employeeIds
					});
				}
				if (request.organizationId) {
					qb.andWhere(
						'"employee"."organizationId" = :organizationId',
						{ organizationId: request.organizationId }
					);
				}
				if (request.activityLevel) {
					qb.andWhere(
						'"duration" BETWEEN :start AND :end',
						request.activityLevel
					);
				}
				if (request.source) {
					if (request.source instanceof Array) {
						qb.andWhere('"source" IN (:...source)', {
							source: request.source
						});
					} else {
						qb.andWhere('"source" = :source', {
							source: request.source
						});
					}
				}
				if (request.logType) {
					if (request.logType instanceof Array) {
						qb.andWhere('"logType" IN (:...logType)', {
							logType: request.logType
						});
					} else {
						qb.andWhere('"logType" = :logType', {
							logType: request.logType
						});
					}
				}

				if (request.type) {
					qb.andWhere('"type" = :type', {
						type: request.type
					});
				}
			}
		});
	}
}
