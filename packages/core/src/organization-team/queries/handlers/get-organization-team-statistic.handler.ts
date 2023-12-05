import { BadRequestException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
	IDateRangePicker,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IOrganizationTeamStatisticInput,
} from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/common';
import { GetOrganizationTeamStatisticQuery } from '../get-organization-team-statistic.query';
import { OrganizationTeamService } from '../../organization-team.service';
import { TimerService } from '../../../time-tracking/timer/timer.service';
import { StatisticService } from './../../../time-tracking/statistic';
import { RequestContext } from 'core';

@QueryHandler(GetOrganizationTeamStatisticQuery)
export class GetOrganizationTeamStatisticHandler implements IQueryHandler<GetOrganizationTeamStatisticQuery> {

	constructor(
		private readonly _timerService: TimerService,
		private readonly _organizationTeamService: OrganizationTeamService,
		private readonly _statisticService: StatisticService
	) { }

	/**
 * Execute the GetOrganizationTeamStatisticQuery.
 *
 * @param input - The input query for getting organization team statistics.
 * @returns The organization team with optional statistics.
 */
	public async execute(
		input: GetOrganizationTeamStatisticQuery
	): Promise<IOrganizationTeam> {
		try {
			const { organizationTeamId, query } = input;
			const { withLaskWorkedTask } = query;

			/**
			 * Find the organization team by ID with optional relations.
			 */
			const organizationTeam = await this._organizationTeamService.findOneByIdString(
				organizationTeamId,
				query['relations'] ? { relations: query['relations'] } : {}
			);

			/**
			 * If the organization team has 'members', sync last worked tasks based on the query.
			 */
			if ('members' in organizationTeam && Boolean(withLaskWorkedTask)) {
				organizationTeam['members'] = await this.syncLastWorkedTask(
					organizationTeamId,
					organizationTeam['members'],
					query
				);
			}

			return organizationTeam;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Synchronize last worked task information for members of an organization team.
	 *
	 * @param members - Array of organization team members.
	 * @param input - Input parameters including date range and statistics options.
	 * @returns A promise resolving to an array of organization team members with updated statistics.
	 */
	async syncLastWorkedTask(
		organizationTeamId: IOrganizationTeam['id'],
		members: IOrganizationTeamEmployee[],
		input: IDateRangePicker & IOrganizationTeamStatisticInput
	): Promise<IOrganizationTeamEmployee[]> {
		try {
			const { organizationId, startDate, endDate, withLaskWorkedTask, source } = input;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			const employeeIds = members.map(({ employeeId }) => employeeId);
			console.log({ employeeIds });

			// this._timerService.getTimerWorkedStatus({
			// 	source,
			// 	employeeId,
			// 	organizationId,
			// 	tenantId,
			// 	organizationTeamId,
			// 	...(parseToBoolean(withLaskWorkedTask) ? { relations: ['task'] } : {}),
			// })


			const memberPromises = members.map(async (member: IOrganizationTeamEmployee) => {
				const { employeeId } = member;
				/**
				 *
				 */
				const [timerWorkedStatus, totalWorkedTasks, totalTodayTasks] = await Promise.all([
					this._timerService.getTimerWorkedStatus({
						source,
						employeeId,
						organizationId,
						tenantId,
						organizationTeamId,
						...(parseToBoolean(withLaskWorkedTask) ? { relations: ['task'] } : {}),
					}),
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
					lastWorkedTask: parseToBoolean(withLaskWorkedTask) ? timerWorkedStatus[0]?.lastLog?.task : null,
					running: timerWorkedStatus[0]?.running,
					duration: timerWorkedStatus[0]?.duration,
					timerStatus: timerWorkedStatus[0]?.timerStatus,
					totalWorkedTasks,
					totalTodayTasks,
				};
			});

			return await Promise.all(memberPromises);
		} catch (error) {
			console.error('Error while retrieving team members last worked task', error);
			return []; // or handle the error in an appropriate way
		}
	}
}
