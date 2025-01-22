import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOneOptions, FindOptionsWhere } from 'typeorm';
import {
	IDateRangePicker,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IOrganizationTeamStatisticInput,
	ITimerStatus
} from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/utils';
import { OrganizationTeam } from './../../core/entities/internal';
import { StatisticService } from './../../time-tracking/statistic';
import { TimerService } from './../../time-tracking/timer/timer.service';
import { TypeOrmOrganizationTeamRepository } from '../../organization-team/repository/type-orm-organization-team.repository';

@Injectable()
export class PublicTeamService {
	constructor(
		protected readonly typeOrmOrganizationTeamRepository: TypeOrmOrganizationTeamRepository,
		protected readonly statisticService: StatisticService,
		protected readonly timerService: TimerService
	) {}

	/**
	 * Find a public organization team by profile link with the specified options.
	 *
	 * @param params - Conditions for finding the team
	 * @param options - Additional query options like date range or related entities
	 * @returns The found organization team
	 */
	async findOneByProfileLink(
		params: FindOptionsWhere<OrganizationTeam>,
		options: IDateRangePicker & IOrganizationTeamStatisticInput
	): Promise<IOrganizationTeam> {
		const findOptions: FindOneOptions<OrganizationTeam> = {
			select: {
				organization: {
					id: true,
					name: true,
					brandColor: true
				},
				members: {
					id: true,
					organizationTeamId: true,
					employeeId: true,
					employee: {
						id: true,
						userId: true,
						isActive: true,
						isOnline: true,
						user: {
							id: true,
							firstName: true,
							lastName: true,
							imageUrl: true,
							isActive: true
						}
					}
				}
			},
			where: {
				public: true,
				...params
			},
			...(options.relations ? { relations: options.relations } : {})
		};

		try {
			const team = await this.typeOrmOrganizationTeamRepository.findOneOrFail(findOptions);

			if (team.members?.length) {
				team.members = await this.syncMembers(team, team.members, options);
			}
			return team;
		} catch (error) {
			throw new NotFoundException('Organization team not found');
		}
	}

	/**
	 * Syncs team members' data with worked tasks and timer status.
	 *
	 * @param organizationTeam - The team to which members belong
	 * @param members - Members of the team
	 * @param options - Additional options like date range and task source
	 * @returns A promise resolving to an array of updated team members
	 */
	async syncMembers(
		organizationTeam: IOrganizationTeam,
		members: IOrganizationTeamEmployee[],
		options: IDateRangePicker & IOrganizationTeamStatisticInput
	): Promise<IOrganizationTeamEmployee[]> {
		const { startDate, endDate, withLastWorkedTask, source } = options;

		const employeeIds = members.map((member: IOrganizationTeamEmployee) => member.employeeId);

		try {
			const { id: organizationTeamId, organizationId, tenantId } = organizationTeam;

			// Retrieve timer statistics with optional task relation
			const statistics = await this.timerService.getTimerWorkedStatus({
				source,
				employeeIds,
				organizationId,
				tenantId,
				organizationTeamId,
				...(parseToBoolean(withLastWorkedTask) ? { relations: ['task'] } : {})
			});

			// Map the timer statistics by employee ID for easier lookup
			const timerStatusMap = new Map<string, ITimerStatus>();
			statistics.forEach((statistic) => {
				if (statistic.lastLog?.employeeId) {
					timerStatusMap.set(statistic.lastLog.employeeId, statistic);
				}
			});

			// Create a promise array to fetch tasks and map results
			const memberPromises = members.map(async (member: IOrganizationTeamEmployee) => {
				const { employeeId } = member;

				// Retrieve the corresponding timer status from the map
				const timerWorkedStatus = timerStatusMap.get(employeeId);

				// Fetch tasks for the specific employee
				const [totalWorkedTasks, totalTodayTasks] = await Promise.all([
					this.statisticService.getTasks({
						organizationId,
						tenantId,
						organizationTeamId,
						employeeIds: [employeeId]
					}),
					this.statisticService.getTasks({
						organizationId,
						tenantId,
						organizationTeamId,
						employeeIds: [employeeId],
						startDate,
						endDate
					})
				]);

				// Return the updated member with additional information
				return {
					...member,
					lastWorkedTask: parseToBoolean(withLastWorkedTask) ? timerWorkedStatus?.lastLog?.task : null,
					timerStatus: timerWorkedStatus?.timerStatus,
					totalWorkedTasks,
					totalTodayTasks
				};
			});

			// Execute all promises and return the result
			return await Promise.all(memberPromises);
		} catch (error) {
			console.error('Error while retrieving team members worked tasks', error);
		}
	}
}
