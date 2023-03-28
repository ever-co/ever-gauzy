import {
	IDateRangePicker,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IOrganizationTeamStatisticInput
} from '@gauzy/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
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
						brandColor: true
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
								imageUrl: true
							}
						}
					}
				},
				where: {
					public: true,
					...params
				},
				...(
					(options.relations) ? {
						relations: options.relations
					} : {}
				),
			});
			if ('members' in team) {
				const { members, organizationId, tenantId } = team;
				team['members'] = await this.syncMembers({ organizationId, tenantId, members }, options);
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
		{
			organizationId,
			tenantId,
			members
		},
		options: IDateRangePicker & IOrganizationTeamStatisticInput
	): Promise<IOrganizationTeamEmployee[]> {
		try {
			const { startDate, endDate, withLaskWorkedTask, source } = options;
			return await Promise.all(
				await members.map(
					async (member: IOrganizationTeamEmployee) => {
						const { employeeId, organizationTeamId } = member;
						const timerWorkedStatus = await this._timerService.getTimerWorkedStatus({
							source,
							employeeId,
							organizationTeamId,
							organizationId,
							tenantId,
							...(
								(Boolean(withLaskWorkedTask)) ? {
									relations: ['task']
								} : {}
							),
						});
						return {
							...member,
							lastWorkedTask: Boolean(withLaskWorkedTask) ? timerWorkedStatus.lastLog?.task : null,
							timerStatus: timerWorkedStatus?.timerStatus,
							totalWorkedTasks: await this._statisticService.getTasks({
								organizationId,
								tenantId,
								employeeIds: [employeeId]
							}),
							totalTodayTasks: await this._statisticService.getTasks({
								organizationId,
								tenantId,
								employeeIds: [employeeId],
								startDate,
								endDate
							}),
						}
					}
				)
			);
		} catch (error) {
			console.log('Error while retrieving team members worked tasks', error);
		}
	}
}
