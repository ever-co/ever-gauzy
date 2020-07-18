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

		const query = await this.activityRepository.createQueryBuilder();
		if (request.limit > 0) {
			query.take(request.limit);
			query.skip((request.page || 0) * request.limit);
		}

		//query.addSelect(`array_agg("${query.alias}"."id")`, 'ids');
		//query.addSelect(`SUM(${query.alias}.duration)`, 'duration');

		query.innerJoin(`${query.alias}.employee`, 'employee');

		query.where((qb) => {
			if (request.startDate && request.endDate) {
				const startDate = moment(request.startDate).format(
					'YYYY-MM-DD HH:mm:ss'
				);
				const endDate = moment(request.endDate).format(
					'YYYY-MM-DD HH:mm:ss'
				);
				qb.andWhere(
					`${query.alias}."date" Between :startDate AND :endDate`,
					{
						startDate,
						endDate
					}
				);
			}
			if (employeeIds) {
				qb.andWhere(`${query.alias}."employeeId" IN (:...employeeId)`, {
					employeeId: employeeIds
				});
			}
			if (request.organizationId) {
				qb.andWhere('"employee"."organizationId" = :organizationId', {
					organizationId: request.organizationId
				});
			}
			if (request.activityLevel) {
				qb.andWhere(
					`${query.alias}."duration" BETWEEN :start AND :end`,
					request.activityLevel
				);
			}
			if (request.source) {
				if (request.source instanceof Array) {
					qb.andWhere(`${query.alias}."source" IN (:...source)`, {
						source: request.source
					});
				} else {
					qb.andWhere(`${query.alias}."source" = :source`, {
						source: request.source
					});
				}
			}
			if (request.logType) {
				if (request.logType instanceof Array) {
					qb.andWhere(`${query.alias}."logType" IN (:...logType)`, {
						logType: request.logType
					});
				} else {
					qb.andWhere(`${query.alias}."logType" = :logType`, {
						logType: request.logType
					});
				}
			}

			if (request.type) {
				qb.andWhere(`${query.alias}."type" = :type`, {
					type: request.type
				});
			}
		});

		query.orderBy(`${query.alias}.duration`, 'DESC');

		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			query.leftJoinAndSelect(
				`${query.alias}.employee`,
				'activiyEmployee'
			);
			query.leftJoinAndSelect(
				`activiyEmployee.user`,
				'activiyUser',
				'"employee"."userId" = activiyUser.id'
			);
		}

		// switch (request.groupBy) {
		// 	case 'title_date':

		// 		break;

		// 	default:
		// 		query.groupBy(`${query.alias}.id`);
		// 		break;
		// }
		return await query.getManyAndCount();
	}

	bulkSave(activities: Activity[]) {
		return (
			this.activityRepository
				.createQueryBuilder()
				.insert()
				.values(activities)
				//.onConflict('("employeeId", "date") DO UPDATE SET duration = EXCLUDED.duration + duration;')
				.returning('*')
				.execute()
		);
	}
}
