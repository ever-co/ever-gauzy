import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IOrganizationTeam, IOrganizationTeamEmployee } from '@gauzy/contracts';
import * as moment from 'moment';
import { GetOrganizationTeamStatisticQuery } from '../get-organization-team-statistic.query';
import { OrganizationTeamService } from '../../organization-team.service';
import { TimerService } from '../../../time-tracking/timer/timer.service';

@QueryHandler(GetOrganizationTeamStatisticQuery)
export class GetOrganizationTeamStatisticHandler implements IQueryHandler<GetOrganizationTeamStatisticQuery> {

	constructor(
		private readonly timerService: TimerService,
		private readonly organizationTeamService: OrganizationTeamService,
	) { }

	public async execute(
		query: GetOrganizationTeamStatisticQuery
	): Promise<IOrganizationTeam> {
		try {
			const { organizationTeamId, options } = query;
			const organizationTeam = await this.organizationTeamService.findOneByIdString(organizationTeamId, {
				...(
					(options['relations']) ? {
						relations: options['relations']
					} : {}
				),
			});
			if ('members' in organizationTeam) {
				const { members } = organizationTeam;
				if (options.withLaskWorkedTask && Boolean(JSON.parse(options.withLaskWorkedTask as any))) {
					organizationTeam['members'] = await this.syncLastWorkedTask({ members, options }, organizationTeamId);
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
	async syncLastWorkedTask({ members, options }, organizationTeamId: IOrganizationTeam['id']): Promise<IOrganizationTeamEmployee[]> {
		try {
			const { source } = options;
			return await Promise.all(
				await members.map(
					async (member: IOrganizationTeamEmployee) => {
						const { employeeId } = member
						const timerStatus = await this.timerService.getTimerWorkedStatus({
							source,
							employeeId,
							organizationTeamId,
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
							duration: timerStatus.duration,
							timerStatus: timerStatus.running ? 'running' : 
							timerStatus?.lastLog?.stoppedAt && moment(timerStatus.lastLog.stoppedAt).diff(new Date(), 'day') === 0 ? 
							'pause' : 'idle'
						}
					}
				)
			);
		} catch (error) {
			console.log('Error while retrieving team members last worked task', error);
		}
	}
}
