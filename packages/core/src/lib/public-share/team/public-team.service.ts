import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOneOptions, FindOptionsWhere, In } from 'typeorm';
import { pick } from 'underscore';
import {
	IDateRangePicker,
	IEmployee,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IOrganizationTeamStatisticInput,
	ITask,
	ITimerStatus
} from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/utils';
import { parseFindOptionsRelations } from '../../core/utils';
import { OrganizationTeam, Task } from './../../core/entities/internal';
import { StatisticService } from './../../time-tracking/statistic';
import { TimerService } from './../../time-tracking/timer/timer.service';
import { TypeOrmOrganizationTeamRepository } from '../../organization-team/repository/type-orm-organization-team.repository';
import { applyEmployeeVisibility } from '../employee/public-employee.service';

/**
 * Fields kept on each task assignee. `tasks.members` has no `select` key, so the whole employee row is
 * loaded; only the public employee profile fields and what `members.employee` returns may leave this
 * anonymous endpoint, the financial ones still behind the employee's `show_*` flags.
 */
const PUBLIC_TASK_MEMBER_FIELDS: string[] = [
	'id',
	'userId',
	'isActive',
	'isOnline',
	'organizationId',
	'tenantId',
	'createdAt',
	'updatedAt',
	'short_description',
	'startedWorkOn',
	'payPeriod',
	'billRateValue',
	'billRateCurrency',
	'averageIncome',
	'averageExpenses',
	'averageBonus',
	'show_billrate',
	'show_payperiod',
	'show_start_work_on',
	'show_average_income',
	'show_average_expenses',
	'show_average_bonus'
];

/**
 * Fields kept on the team a task is filed under. `tasks.teams` has no `select` key either, so each task came with the
 * whole row of every team it is shared with: the organization's other teams too, private ones included, with their
 * share link (`profile_link`), settings and image. The link shows one team. Ever Teams files a task under it by id
 * (`task.teams.some((team) => team.id === activeTeam.id)`) and its task schema needs the team's `name`, so a task keeps
 * that one team, with fields the link already answers for it at its root.
 */
const PUBLIC_TASK_TEAM_FIELDS: string[] = ['id', 'name', 'prefix', 'color', 'emoji', 'logo'];

/**
 * The teams of a task the anonymous team link may show: the team the link was shared for, with
 * {@link PUBLIC_TASK_TEAM_FIELDS} only. The task's other teams are left out, whether public or not.
 *
 * @param teams - The task's teams, as `tasks.teams` loads them.
 * @param teamId - The team the link was shared for.
 */
export function publicTaskTeams(teams: IOrganizationTeam[], teamId: IOrganizationTeam['id']): IOrganizationTeam[] {
	return teams
		.filter((taskTeam) => !!taskTeam && !!teamId && taskTeam.id === teamId)
		.map((taskTeam) => pick(taskTeam, PUBLIC_TASK_TEAM_FIELDS) as IOrganizationTeam);
}

/**
 * Whether the anonymous team link may show a task: one its team did not mark private (`public: false`, "This task is
 * Private" in Ever Teams) and that is not a draft. The link used to answer every task of the team in full, so anyone
 * holding it read the private tasks and the drafts, and their titles through the members' last worked task and task
 * statistics.
 *
 * @param task - The task, with its `public` and `isDraft` columns.
 */
export function isPubliclyVisibleTask(task: Pick<ITask, 'public' | 'isDraft'> | null | undefined): boolean {
	return !!task && task.public !== false && task.isDraft !== true;
}

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
			}
		};

		// One query per relation rather than joins: the Teams app asks for `tasks`, `tasks.members`, `tasks.teams`,
		// `tasks.tags`, `members`, `members.employee.user` on every public team page, and joined onto one another those
		// multiplied the team into one row per (task × assignee × tag × team member) — thousands of wide rows for a
		// team of 113 tasks and 11 members, 2.4–10 s on production for a 400 KB answer. The team's own relations load
		// with `relationLoadStrategy: 'query'` (the `select` above still applies to each); the tasks are read from
		// their own side (`loadPublicTasks`), because a team's `tasks` is the inverse side of the many-to-many and
		// TypeORM's query strategy answers an inverse side empty.
		const { teamRelations, taskRelations } = PublicTeamService.splitTaskRelations(options.relations);
		if (teamRelations.length > 0) {
			findOptions.relations = parseFindOptionsRelations(teamRelations);
			findOptions.relationLoadStrategy = 'query';
		}

		try {
			const team = await this.typeOrmOrganizationTeamRepository.findOneOrFail(findOptions);

			if (taskRelations) {
				team.tasks = await this.loadPublicTasks(team.id, taskRelations);
			}

			if (team.tasks) {
				team.tasks = team.tasks.filter(isPubliclyVisibleTask);
			}
			team.tasks?.forEach((task) => {
				if (task.members) {
					task.members = task.members.map(
						(member) => applyEmployeeVisibility(pick(member, PUBLIC_TASK_MEMBER_FIELDS)) as IEmployee
					);
				}
				if (task.teams) {
					task.teams = publicTaskTeams(task.teams, team.id);
				}
			});

			if (team.members?.length) {
				team.members = await this.syncMembers(team, team.members, options);
			}
			return team;
		} catch (error) {
			throw new NotFoundException('Organization team not found');
		}
	}

	/**
	 * The requested relations, split into the team's own and the tasks': `tasks` and everything under it
	 * (`tasks.members` → `members`), or `undefined` when the tasks are not asked for.
	 *
	 * @param relations - The relations the request names, if any.
	 */
	private static splitTaskRelations(relations: string[] | undefined): {
		teamRelations: string[];
		taskRelations: string[] | undefined;
	} {
		const requested = relations ?? [];
		const isTaskRelation = (relation: string) => relation === 'tasks' || relation.startsWith('tasks.');
		const teamRelations = requested.filter((relation) => !isTaskRelation(relation));
		// A nested task relation alone (`tasks.members` without `tasks`) asks for the tasks too, as a join would have.
		const taskRelations = requested.some(isTaskRelation)
			? requested.filter((relation) => relation.startsWith('tasks.')).map((relation) => relation.slice('tasks.'.length))
			: undefined;
		return { teamRelations, taskRelations };
	}

	/**
	 * The tasks of a team with the relations asked for under `tasks`, read from the task's side: `members`, `teams`
	 * and `tags` are owned there (`@JoinTable`), where the query strategy answers them.
	 *
	 * @param teamId - The team.
	 * @param relations - The relations under `tasks`, as sent (`members.user`).
	 */
	private async loadPublicTasks(teamId: string, relations: string[]): Promise<ITask[]> {
		return (await this.typeOrmOrganizationTeamRepository.manager.find(Task, {
			where: { teams: { id: teamId } },
			...(relations.length > 0 ? { relations: parseFindOptionsRelations(relations) } : {}),
			relationLoadStrategy: 'query'
		})) as ITask[];
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

			// Execute all promises, then leave out what the link may not show: the last worked task when it is private or
			// a draft, and the private and draft tasks of the statistics (which carry their titles)
			const synced = await Promise.all(memberPromises);
			const hidden = await this.hiddenTaskIds(
				synced.flatMap((member) => [...(member.totalWorkedTasks ?? []), ...(member.totalTodayTasks ?? [])]),
				tenantId
			);
			return synced.map((member) => ({
				...member,
				lastWorkedTask: isPubliclyVisibleTask(member.lastWorkedTask) ? member.lastWorkedTask : null,
				totalWorkedTasks: member.totalWorkedTasks?.filter((task) => !hidden.has(task.id)),
				totalTodayTasks: member.totalTodayTasks?.filter((task) => !hidden.has(task.id))
			}));
		} catch (error) {
			console.error('Error while retrieving team members worked tasks', error);
		}
	}

	/**
	 * The ids, among the given statistics rows, of the tasks the link may not show (see {@link isPubliclyVisibleTask}).
	 * The statistics rows carry a task's id and title only, so its `public` and `isDraft` columns are read here.
	 *
	 * @param tasks - The statistics rows of the members.
	 * @param tenantId - The team's tenant.
	 */
	private async hiddenTaskIds(tasks: Pick<ITask, 'id'>[], tenantId: string): Promise<Set<string>> {
		const ids = [...new Set(tasks.map((task) => task?.id).filter(Boolean))] as string[];
		if (ids.length === 0) {
			return new Set();
		}
		const rows = await this.typeOrmOrganizationTeamRepository.manager.find(Task, {
			select: { id: true },
			where: [
				{ id: In(ids), tenantId, public: false },
				{ id: In(ids), tenantId, isDraft: true }
			]
		});
		return new Set(rows.map((row) => row.id));
	}
}
