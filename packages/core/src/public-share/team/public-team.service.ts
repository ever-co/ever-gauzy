import {
	IDateRangePicker,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IOrganizationTeamStatisticInput,
	ITimerStatus,
} from '@gauzy/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { parseToBoolean } from '@gauzy/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { OrganizationTeam } from './../../core/entities/internal';
import { StatisticService } from './../../time-tracking/statistic';
import { TimerService } from './../../time-tracking/timer/timer.service';

@Injectable()
export class PublicTeamService {
	constructor(
		@InjectRepository(OrganizationTeam)
		private readonly repository: Repository<OrganizationTeam>,

		private readonly _statisticService: StatisticService,
		private readonly _timerService: TimerService
	) { }

	/**
	 * GET organization team by profile link
	 *
	 * @param options
	 * @param relations
	 * @returns
	 */
	async findOneByProfileLink(
		params: FindOptionsWhere<OrganizationTeam>,
		options: IDateRangePicker & IOrganizationTeamStatisticInput
	): Promise<IOrganizationTeam> {
		try {
			const team = await this.repository.findOneOrFail({
				select: {
					organization: {
						id: true,
						name: true,
						brandColor: true,
					},
					members: {
						id: true,
						organizationTeamId: true,
						employeeId: true,
						employee: {
							id: true,
							userId: true,
							user: {
								id: true,
								firstName: true,
								lastName: true,
								imageUrl: true,
							},
							isActive: true,
							isOnline: true,
						},
					},
				},
				where: {
					public: true,
					...params,
				},
				...(options.relations ? { relations: options.relations, } : {}),
			});
			if ('members' in team) {
				const { members } = team;
				team['members'] = await this.syncMembers(team, members, options);
			}
			return team;
		} catch (error) {
			throw new NotFoundException();
		}
	}

	/**
	 * Synced worked tasks by team members
	 *
	 * @param param0
	 * @returns
	 */
	async syncMembers(
		organizationTeam: IOrganizationTeam,
		members: IOrganizationTeamEmployee[],
		input: IDateRangePicker & IOrganizationTeamStatisticInput
	): Promise<IOrganizationTeamEmployee[]> {
		try {
			const { id: organizationTeamId, organizationId, tenantId } = organizationTeam;
			const { startDate, endDate, withLaskWorkedTask, source } = input;

			const employeeIds = members.map(({ employeeId }) => employeeId);

			//
			const statistics = await this._timerService.getTimerWorkedStatus({
				source,
				employeeIds,
				organizationId,
				tenantId,
				organizationTeamId,
				...(parseToBoolean(withLaskWorkedTask) ? { relations: ['task'] } : {}),
			});

			return await Promise.all(
				members.map(async (member: IOrganizationTeamEmployee) => {
					const { employeeId } = member;
					//
					const timerWorkedStatus = statistics.find(
						(statistic: ITimerStatus) => statistic.lastLog.employeeId === employeeId
					);
					//
					const [totalWorkedTasks, totalTodayTasks] = await Promise.all([
						this._statisticService.getTasks({
							organizationId,
							tenantId,
							organizationTeamId,
							employeeIds: [employeeId],
						}),
						this._statisticService.getTasks({
							organizationId,
							tenantId,
							organizationTeamId,
							employeeIds: [employeeId],
							startDate,
							endDate,
						}),
					]);
					return {
						...member,
						lastWorkedTask: parseToBoolean(withLaskWorkedTask) ? timerWorkedStatus?.lastLog?.task : null,
						timerStatus: timerWorkedStatus?.timerStatus,
						totalWorkedTasks,
						totalTodayTasks,
					};
				})
			);
		} catch (error) {
			console.log(
				'Error while retrieving team members worked tasks',
				error
			);
		}
	}
}
