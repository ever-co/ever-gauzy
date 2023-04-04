import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IDateRangePicker, IOrganizationTeam, IOrganizationTeamEmployee, IOrganizationTeamStatisticInput } from '@gauzy/contracts';
import { GetOrganizationTeamStatisticQuery } from '../get-organization-team-statistic.query';
import { OrganizationTeamService } from '../../organization-team.service';
import { TimerService } from '../../../time-tracking/timer/timer.service';
import { StatisticService } from './../../../time-tracking/statistic';

@QueryHandler(GetOrganizationTeamStatisticQuery)
export class GetOrganizationTeamStatisticHandler
	implements IQueryHandler<GetOrganizationTeamStatisticQuery> {

	constructor(
		private readonly timerService: TimerService,
		private readonly organizationTeamService: OrganizationTeamService,
		private readonly _statisticService: StatisticService
	) { }

	public async execute(
		query: GetOrganizationTeamStatisticQuery
	): Promise<IOrganizationTeam> {
		try {
			const { organizationTeamId, options } = query;
			const { withLaskWorkedTask } = options;

			const organizationTeam = await this.organizationTeamService.findOneByIdString(organizationTeamId, {
				...(options['relations']
					? {
						relations: options['relations'],
					}
					: {}),
			});
			if ('members' in organizationTeam) {
				const { members, organizationId, tenantId } = organizationTeam;
				if (Boolean(withLaskWorkedTask)) {
					organizationTeam['members'] = await this.syncLastWorkedTask({ members, organizationId, tenantId }, options);
				}
			}
			return organizationTeam;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Synced last worked tasks by every team members
	 *
	 * @param param0
	 * @returns
	 */
	async syncLastWorkedTask(
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
				await members.map(async (member: IOrganizationTeamEmployee) => {
					const { employeeId, organizationTeamId } = member;
					const timerWorkedStatus =
						await this.timerService.getTimerWorkedStatus({
							source,
							employeeId,
							organizationTeamId,
							organizationId,
							tenantId,
							...(Boolean(withLaskWorkedTask)
								? {
									relations: ['task'],
								}
								: {}),
						});

					return {
						...member,
						lastWorkedTask: Boolean(withLaskWorkedTask) ? timerWorkedStatus.lastLog?.task : null,
						running: timerWorkedStatus?.running,
						duration: timerWorkedStatus?.duration,
						timerStatus: timerWorkedStatus?.timerStatus,
						totalWorkedTasks: await this._statisticService.getTasks({
							organizationId,
							tenantId,
							organizationTeamId,
							employeeIds: [employeeId],
						}),
						totalTodayTasks: await this._statisticService.getTasks({
							organizationId,
							tenantId,
							organizationTeamId,
							employeeIds: [employeeId],
							startDate,
							endDate,
						}),
					};
				})
			);
		} catch (error) {
			console.log(
				'Error while retrieving team members last worked task',
				error
			);
		}
	}
}
