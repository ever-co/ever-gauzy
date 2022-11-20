import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetOrganizationTeamStatisticQuery } from '../get-organization-team-statistic.query';
import { OrganizationTeamService } from '../../organization-team.service';
import { TimerService } from '../../../time-tracking/timer/timer.service';

@QueryHandler(GetOrganizationTeamStatisticQuery)
export class GetOrganizationTeamStatisticHandler implements IQueryHandler<GetOrganizationTeamStatisticQuery> {

	constructor(
		private readonly timerService: TimerService,
		private readonly organizationTeamService: OrganizationTeamService,
	) {}

	public async execute(
		query: GetOrganizationTeamStatisticQuery
	): Promise<any> {
		const { teamId, options } = query;
		try {
			const organizationTeam = await this.organizationTeamService.findOneByIdString(teamId, {
				...(
					(options['relations']) ? {
						relations: options['relations']
					} : {}
				),
			});
			if ('members' in organizationTeam) {
				const { source } = options;
				const { members } = organizationTeam;

				if (options.withLaskWorkedTask && Boolean(JSON.parse(options.withLaskWorkedTask as any))) {
					organizationTeam['members'] = await Promise.all(
						members.map(
							async (member) => {
								const { employeeId } = member;
								const timerStatus = await this.timerService.getTimerWorkedStatus({
									source,
									employeeId,
									...(
										(options.withLaskWorkedTask && Boolean(JSON.parse(options.withLaskWorkedTask as any))) ? {
											relations: ['task']
										} : {}
									),
								});
								return {
									...member,
									...(
										(options.withLaskWorkedTask && Boolean(JSON.parse(options.withLaskWorkedTask as any))) ? {
											lastWorkedTask: timerStatus.lastLog ? timerStatus.lastLog.task : null
										} : {
											lastWorkedTask: null
										}
									),
									running: timerStatus.running,
									duration: timerStatus.duration
								}
							}
						)
					);
				}
			}
			return organizationTeam;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
