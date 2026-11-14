import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, In } from 'typeorm';
import {
	ID,
	IPagination,
	ITimeGoal,
	ITimeGoalCreateInput,
	ITimeGoalFindInput,
	ITimeGoalProgress,
	ITimeGoalProgressFindInput,
	ITimeGoalUpdateInput,
	PermissionsEnum,
	TimeGoalPeriodEnum,
	TimeGoalScopeEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { TenantAwareCrudService } from '../../core/crud';
import { moment } from '../../core/moment-extend';
import { getDateRangeFormat } from '../../core/utils';
import {
	Employee,
	Organization,
	OrganizationContact,
	OrganizationProject,
	OrganizationTeam,
	OrganizationTeamEmployee,
	TimeLog
} from '../../core/entities/internal';
import {
	activeGroupWhere,
	activeMembershipWhere,
	ManagedEmployeeService,
	NO_ACCESSIBLE_EMPLOYEE_ID
} from '../../employee/managed-employee.service';
import { TimeGoal } from './time-goal.entity';
import {
	isTargetWithinPeriod,
	maxHoursOfPeriod,
	periodRangeOf,
	stateOf,
	targetSecondsOf,
	TimeGoalCountedLog,
	todayIn,
	trackedSecondsOf
} from './time-goal.rules';
import { MikroOrmTimeGoalRepository } from './repository/mikro-orm-time-goal.repository';
import { TypeOrmTimeGoalRepository } from './repository/type-orm-time-goal.repository';

/** The relations a goal is answered with: the projects and clients it counts. */
const GOAL_RELATIONS = { projects: true, organizationContacts: true } as const;

/** The owner fields of a goal: who it counts, and where. */
type TimeGoalOwner = Pick<ITimeGoal, 'scope' | 'employeeId' | 'organizationTeamId' | 'organizationId'>;

/**
 * Time goals: how many hours a member, or each member of a team or of the organization, holds to per day, week or
 * month, and where each member stands against them.
 *
 * Who may do what, on top of the route's permissions:
 * - a member reads and writes her own goals, and reads the goals of her teams and of her organization;
 * - someone who manages a team (its `isManager` membership) reads and writes the goals of its members and of the
 *   team itself, as `ManagedEmployeeService` decides for daily plans and time logs;
 * - a holder of `CHANGE_SELECTED_EMPLOYEE` acts for every employee, and alone sets organization goals.
 *
 * The automatic "own employee" filter of the base service is bypassed on purpose: a team or organization goal has
 * no employee, and every read and write here applies the rules above itself. Reads go through the TypeORM data
 * source, which runs under both ORMs, so both answer the same; writes go through the base service.
 */
@Injectable()
export class TimeGoalService extends TenantAwareCrudService<TimeGoal> {
	constructor(
		readonly typeOrmTimeGoalRepository: TypeOrmTimeGoalRepository,
		readonly mikroOrmTimeGoalRepository: MikroOrmTimeGoalRepository,
		private readonly _managedEmployeeService: ManagedEmployeeService
	) {
		super(typeOrmTimeGoalRepository, mikroOrmTimeGoalRepository);
	}

	/**
	 * Creates a goal. A member goal without an employee is the caller's own.
	 *
	 * @throws BadRequestException when the goal names no member or team for its scope, a target over its period,
	 * or a member, team, project or client outside its organization.
	 * @throws ForbiddenException when the caller may not set a goal for whom it counts.
	 */
	async createGoal(input: ITimeGoalCreateInput): Promise<ITimeGoal> {
		const tenantId = RequestContext.currentTenantId();
		const owner = this.ownerOf(input, this.organizationOf(input));

		this.assertTargetFits(input.period, input.targetHours);
		if (!(await this.mayWrite(owner))) {
			throw new ForbiddenException(
				'You can set goals for yourself, for the members of the teams you manage, or for those teams.'
			);
		}
		await this.assertOwnerInOrganization(owner, tenantId);

		const projects = await this.resolveLinked(
			OrganizationProject,
			input.projectIds,
			owner.organizationId,
			tenantId
		);
		const organizationContacts = await this.resolveLinked(
			OrganizationContact,
			input.organizationContactIds,
			owner.organizationId,
			tenantId
		);

		const created = await this.withoutEmployeeFilter(() =>
			super.create({
				name: input.name,
				comparison: input.comparison,
				targetHours: input.targetHours,
				period: input.period,
				scope: owner.scope,
				billableOnly: input.billableOnly === true,
				employeeId: owner.employeeId,
				organizationTeamId: owner.organizationTeamId,
				organizationId: owner.organizationId,
				tenantId,
				projects: projects ?? [],
				organizationContacts: organizationContacts ?? [],
				listedProjectsOnly: (projects ?? []).length > 0,
				listedClientsOnly: (organizationContacts ?? []).length > 0
			})
		);
		return await this.findGoalOrFail(created.id);
	}

	/**
	 * Changes what a goal asks for. A list of projects or clients replaces the goal's when sent.
	 */
	async updateGoal(id: ID, input: ITimeGoalUpdateInput): Promise<ITimeGoal> {
		const goal = await this.findWritableGoal(id, this.organizationOf(input));
		const tenantId = RequestContext.currentTenantId();

		const period = input.period ?? goal.period;
		const targetHours = input.targetHours ?? goal.targetHours;
		this.assertTargetFits(period, targetHours);

		const projects = await this.resolveLinked(OrganizationProject, input.projectIds, goal.organizationId, tenantId);
		const organizationContacts = await this.resolveLinked(
			OrganizationContact,
			input.organizationContactIds,
			goal.organizationId,
			tenantId
		);

		// A field sent as null is left as it is, as one left out: every one of them is required on a goal.
		const isSent = (value: unknown) => value !== undefined && value !== null;
		const changes: Partial<TimeGoal> = { id: goal.id };
		if (isSent(input.name)) changes.name = input.name;
		if (isSent(input.comparison)) changes.comparison = input.comparison;
		if (isSent(input.targetHours)) changes.targetHours = input.targetHours;
		if (isSent(input.period)) changes.period = input.period;
		if (isSent(input.billableOnly)) changes.billableOnly = input.billableOnly;
		if (projects) {
			changes.projects = projects;
			changes.listedProjectsOnly = projects.length > 0;
		}
		if (organizationContacts) {
			changes.organizationContacts = organizationContacts;
			changes.listedClientsOnly = organizationContacts.length > 0;
		}

		await this.withoutEmployeeFilter(() => super.create(changes));
		return await this.findGoalOrFail(goal.id);
	}

	/**
	 * Archives a goal: it stays, out of the lists and the progress, until it is restored.
	 */
	async archiveGoal(id: ID, organizationId: ID): Promise<ITimeGoal> {
		return await this.setArchived(id, organizationId, true);
	}

	/**
	 * Restores an archived goal.
	 */
	async restoreGoal(id: ID, organizationId: ID): Promise<ITimeGoal> {
		return await this.setArchived(id, organizationId, false);
	}

	/**
	 * Deletes a goal, with its links to projects and clients.
	 */
	async deleteGoal(id: ID, organizationId: ID): Promise<DeleteResult> {
		const goal = await this.findWritableGoal(id, organizationId);
		return await this.withoutEmployeeFilter(() => super.delete(goal.id));
	}

	/**
	 * Reads one goal the caller may read.
	 */
	async findGoal(id: ID, organizationId: ID): Promise<ITimeGoal> {
		const goal = await this.findStoredGoal(id, organizationId);
		const mayRead = !!goal && (await this.mayRead(goal));
		if (!mayRead) {
			throw new NotFoundException('Time goal not found');
		}
		return goal;
	}

	/**
	 * Lists the goals the caller may read in an organization: all of them for someone who acts for every employee;
	 * otherwise her own goals and those of the members she manages, the goals of her teams, and the organization's.
	 */
	async findGoals(input: ITimeGoalFindInput): Promise<IPagination<ITimeGoal>> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = this.organizationOf(input);

		const readable = await this.readableGoalsWhere(input, organizationId, tenantId);
		if (readable.length === 0) {
			return { items: [], total: 0 };
		}
		const base: FindOptionsWhere<TimeGoal> = { tenantId, organizationId };
		if (input.includeArchived !== true) base.isArchived = false;

		const where = readable.map((alternative) => ({ ...alternative, ...base }));
		const [items, total] = await this.typeOrmRepository.findAndCount({
			where,
			relations: GOAL_RELATIONS,
			order: { createdAt: 'ASC' }
		});
		return { items, total };
	}

	/**
	 * Where each member stands against every goal that counts her (her own goals, those of her teams and those of
	 * the organization), for the period of each goal that holds `date` in her time zone (today when absent).
	 *
	 * The members read are the caller, unless the read names members or a team: a manager then reads the members of
	 * the teams she manages, someone who acts for every employee reads anyone, and anyone else reads herself.
	 *
	 * @param now - The instant a running timer counts up to.
	 */
	async getProgress(input: ITimeGoalProgressFindInput, now: Date = new Date()): Promise<ITimeGoalProgress[]> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = this.organizationOf(input);

		const memberIds = await this.readableMemberIds(input, organizationId);
		if (memberIds.length === 0) {
			return [];
		}

		const manager = this.typeOrmRepository.manager;
		const [organization, members, memberships] = await Promise.all([
			manager.findOne(Organization, {
				where: { id: organizationId, tenantId },
				select: { id: true, startWeekOn: true, timeZone: true }
			}),
			manager.find(Employee, {
				where: { id: In(memberIds), organizationId, tenantId },
				relations: { user: true },
				select: { id: true, user: { id: true, timeZone: true } }
			}),
			manager.find(OrganizationTeamEmployee, {
				where: {
					employeeId: In(memberIds),
					tenantId,
					...activeMembershipWhere(),
					organizationTeam: { ...activeGroupWhere(), organizationId }
				},
				select: { employeeId: true, organizationTeamId: true }
			})
		]);
		if (!organization || members.length === 0) {
			return [];
		}

		const teamIdsByMember = new Map<ID, ID[]>();
		for (const membership of memberships) {
			const teamIds = teamIdsByMember.get(membership.employeeId) ?? [];
			teamIds.push(membership.organizationTeamId);
			teamIdsByMember.set(membership.employeeId, teamIds);
		}
		const countedGoals = await this.goalsCounting(
			members.map(({ id }) => id),
			memberships.map(({ organizationTeamId }) => organizationTeamId),
			organizationId,
			tenantId,
			input.goalIds
		);
		// A goal the caller may not read stays out of the rows, as it does out of `findGoal`: a manager reading a member
		// does not see the goals of the member's other teams.
		const readable = await Promise.all(countedGoals.map((goal) => this.mayRead(goal)));
		const goals = countedGoals.filter((_, index) => readable[index]);
		if (goals.length === 0) {
			return [];
		}

		// Each member's goals, with the period of each in her own time zone.
		const rows: Array<{ goal: TimeGoal; employeeId: ID; timeZone: string } & ReturnType<typeof periodRangeOf>> = [];
		for (const member of members) {
			const timeZone = this.timeZoneOf(member.user?.timeZone, organization.timeZone);
			const date = input.date ?? todayIn(timeZone, now);
			const memberTeamIds = teamIdsByMember.get(member.id) ?? [];
			for (const goal of goals) {
				const isOwnGoal = goal.scope === TimeGoalScopeEnum.EMPLOYEE && goal.employeeId === member.id;
				const isTeamGoal =
					goal.scope === TimeGoalScopeEnum.TEAM && memberTeamIds.includes(goal.organizationTeamId);
				const isOrganizationGoal = goal.scope === TimeGoalScopeEnum.ORGANIZATION;
				const countsMember = isOwnGoal || isTeamGoal || isOrganizationGoal;
				if (!countsMember) {
					continue;
				}
				const range = periodRangeOf(goal.period, date, timeZone, organization.startWeekOn);
				rows.push({ goal, employeeId: member.id, timeZone, ...range });
			}
		}
		if (rows.length === 0) {
			return [];
		}

		const logsByMember = await this.countedLogsByMember(rows, organizationId, tenantId);
		return rows.map(({ goal, employeeId, timeZone, start, end, startDate, endDate }) => {
			const trackedSeconds = trackedSecondsOf(
				logsByMember.get(employeeId) ?? [],
				{
					projectIds: (goal.projects ?? []).map(({ id }) => id),
					organizationContactIds: (goal.organizationContacts ?? []).map(({ id }) => id),
					billableOnly: goal.billableOnly === true,
					listedProjectsOnly: goal.listedProjectsOnly === true,
					listedClientsOnly: goal.listedClientsOnly === true
				},
				{ start, end },
				now
			);
			const targetSeconds = targetSecondsOf(goal.targetHours);
			return {
				goalId: goal.id,
				goal,
				employeeId,
				period: goal.period,
				startDate,
				endDate,
				timeZone,
				trackedSeconds,
				targetSeconds,
				state: stateOf(goal.comparison, trackedSeconds, targetSeconds)
			};
		});
	}

	/**
	 * Who a new goal counts, from its scope: a member goal names its member (the caller when absent) and no team, a
	 * team goal its team and no member, an organization goal neither.
	 */
	private ownerOf(input: ITimeGoalCreateInput, organizationId: ID): TimeGoalOwner {
		const { scope } = input;
		if (scope === TimeGoalScopeEnum.EMPLOYEE) {
			const employeeId = input.employeeId ?? RequestContext.currentUser()?.employeeId;
			if (!employeeId) {
				throw new BadRequestException('A member goal names the member it counts.');
			}
			return { scope, employeeId, organizationTeamId: null, organizationId };
		}
		if (scope === TimeGoalScopeEnum.TEAM) {
			if (!input.organizationTeamId) {
				throw new BadRequestException('A team goal names the team it counts.');
			}
			return { scope, employeeId: null, organizationTeamId: input.organizationTeamId, organizationId };
		}
		return { scope, employeeId: null, organizationTeamId: null, organizationId };
	}

	/**
	 * The organization a read or a write names, by `organizationId` or by `organization.id`. A read or write that names
	 * none is refused: its organization predicate would be dropped (an undefined where value is ignored), or a goal
	 * stored without one.
	 */
	private organizationOf(input: { organizationId?: ID; organization?: { id?: ID } }): ID {
		const organizationId = input.organizationId ?? input.organization?.id;
		if (!organizationId) {
			throw new BadRequestException('A time goal is read and written in an organization: send organizationId.');
		}
		return organizationId;
	}

	/**
	 * Refuses a target the period cannot hold, such as 30 hours a day.
	 */
	private assertTargetFits(period: TimeGoalPeriodEnum, targetHours: number): void {
		if (!isTargetWithinPeriod(period, targetHours)) {
			throw new BadRequestException(
				`A goal per ${period.toLowerCase()} asks for at most ${maxHoursOfPeriod(period)} hours.`
			);
		}
	}

	/**
	 * Whether the caller may create, change or delete a goal counting this owner.
	 */
	private async mayWrite(owner: TimeGoalOwner): Promise<boolean> {
		const actsForEveryEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		if (actsForEveryEmployee) {
			return true;
		}
		if (owner.scope === TimeGoalScopeEnum.EMPLOYEE) {
			return await this._managedEmployeeService.canManageEmployee(
				owner.employeeId,
				undefined,
				owner.organizationId
			);
		}
		if (owner.scope === TimeGoalScopeEnum.TEAM) {
			const currentEmployeeId = RequestContext.currentUser()?.employeeId;
			if (!currentEmployeeId) {
				return false;
			}
			return await this._managedEmployeeService.isManagerOfTeamsOrProjects(currentEmployeeId, [
				owner.organizationTeamId
			]);
		}
		return false;
	}

	/**
	 * Whether the caller may read a goal: one she may write, a goal of a team she belongs to, or an organization goal.
	 */
	private async mayRead(goal: TimeGoalOwner): Promise<boolean> {
		if (await this.mayWrite(goal)) {
			return true;
		}
		if (goal.scope === TimeGoalScopeEnum.ORGANIZATION) {
			return true;
		}
		if (goal.scope === TimeGoalScopeEnum.TEAM) {
			const currentEmployeeId = RequestContext.currentUser()?.employeeId;
			return await this._managedEmployeeService.isMemberOfTeam(currentEmployeeId, goal.organizationTeamId);
		}
		return false;
	}

	/**
	 * Refuses a goal whose member or team is not one of its organization.
	 */
	private async assertOwnerInOrganization(owner: TimeGoalOwner, tenantId: ID): Promise<void> {
		const manager = this.typeOrmRepository.manager;
		const { organizationId } = owner;
		if (owner.scope === TimeGoalScopeEnum.EMPLOYEE) {
			const exists = await manager.exists(Employee, {
				where: { id: owner.employeeId, organizationId, tenantId }
			});
			if (!exists) {
				throw new BadRequestException('The member of a goal must be a member of its organization.');
			}
		}
		if (owner.scope === TimeGoalScopeEnum.TEAM) {
			const exists = await manager.exists(OrganizationTeam, {
				where: { id: owner.organizationTeamId, organizationId, tenantId }
			});
			if (!exists) {
				throw new BadRequestException('The team of a goal must be a team of its organization.');
			}
		}
	}

	/**
	 * The projects or clients a goal write names, each one of the goal's organization.
	 *
	 * @returns The records to link (an empty list unlinks them all), or `undefined` to leave the goal's as they are.
	 * @throws BadRequestException when an identifier names no record of the organization.
	 */
	private async resolveLinked<T extends OrganizationProject | OrganizationContact>(
		entity: new () => T,
		ids: ID[] | undefined,
		organizationId: ID,
		tenantId: ID
	): Promise<T[] | undefined> {
		if (ids === undefined || ids === null) {
			return undefined;
		}
		const unique = [...new Set(ids)];
		if (unique.length === 0) {
			return [];
		}
		const found = await this.typeOrmRepository.manager.find(entity, {
			where: { id: In(unique), organizationId, tenantId } as FindOptionsWhere<T>,
			select: { id: true } as never
		});
		if (found.length !== unique.length) {
			throw new BadRequestException('Every project and client a goal counts must be one of its organization.');
		}
		return unique.map((id) => ({ id }) as T);
	}

	/**
	 * A goal of the organization, with its projects and clients, whoever may read it.
	 */
	private async findStoredGoal(id: ID, organizationId: ID): Promise<TimeGoal | null> {
		const tenantId = RequestContext.currentTenantId();
		return await this.typeOrmRepository.findOne({
			where: { id, organizationId: this.organizationOf({ organizationId }), tenantId },
			relations: GOAL_RELATIONS
		});
	}

	/**
	 * A goal of the organization the caller may change.
	 *
	 * @throws NotFoundException when the goal does not exist or the caller may not even read it.
	 * @throws ForbiddenException when the caller reads the goal but may not change it.
	 */
	private async findWritableGoal(id: ID, organizationId: ID): Promise<TimeGoal> {
		const goal = await this.findStoredGoal(id, organizationId);
		if (!goal) {
			throw new NotFoundException('Time goal not found');
		}
		if (await this.mayWrite(goal)) {
			return goal;
		}
		if (await this.mayRead(goal)) {
			throw new ForbiddenException('You can only change your own goals or those of the teams you manage.');
		}
		throw new NotFoundException('Time goal not found');
	}

	/** A goal just written, as answered. */
	private async findGoalOrFail(id: ID): Promise<TimeGoal> {
		const tenantId = RequestContext.currentTenantId();
		return await this.typeOrmRepository.findOneOrFail({ where: { id, tenantId }, relations: GOAL_RELATIONS });
	}

	/** Archives or restores a goal the caller may change. */
	private async setArchived(id: ID, organizationId: ID, isArchived: boolean): Promise<ITimeGoal> {
		const goal = await this.findWritableGoal(id, organizationId);
		const archivedAt = isArchived ? new Date() : null;
		await this.withoutEmployeeFilter(() => super.create({ id: goal.id, isArchived, archivedAt }));
		return await this.findGoalOrFail(goal.id);
	}

	/**
	 * The alternatives a list read matches: what the caller may read, narrowed by the read's filters. A filter only
	 * ever narrows an alternative, and an alternative a filter cannot match is left out, so no filter reaches a goal
	 * the caller may not read. No alternative left means nothing to read.
	 */
	private async readableGoalsWhere(
		input: ITimeGoalFindInput,
		organizationId: ID,
		tenantId: ID
	): Promise<FindOptionsWhere<TimeGoal>[]> {
		const { scope, employeeId, organizationTeamId } = input;
		const actsForEveryEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		if (actsForEveryEmployee) {
			const everything: FindOptionsWhere<TimeGoal> = {};
			if (scope) everything.scope = scope;
			if (employeeId) everything.employeeId = employeeId;
			if (organizationTeamId) everything.organizationTeamId = organizationTeamId;
			return [everything];
		}

		const { memberIds, teamIds } = await this.readableOwners(organizationId, tenantId);
		const wantsScope = (wanted: TimeGoalScopeEnum) => !scope || scope === wanted;
		const alternatives: FindOptionsWhere<TimeGoal>[] = [];

		// A member goal has a member and no team.
		const readsMemberGoals = wantsScope(TimeGoalScopeEnum.EMPLOYEE) && !organizationTeamId;
		const readableMemberIds = memberIds.filter((id) => !employeeId || id === employeeId);
		if (readsMemberGoals && readableMemberIds.length > 0) {
			alternatives.push({ scope: TimeGoalScopeEnum.EMPLOYEE, employeeId: In(readableMemberIds) });
		}
		// A team goal has a team and no member.
		const readsTeamGoals = wantsScope(TimeGoalScopeEnum.TEAM) && !employeeId;
		const readableTeamIds = teamIds.filter((id) => !organizationTeamId || id === organizationTeamId);
		if (readsTeamGoals && readableTeamIds.length > 0) {
			alternatives.push({ scope: TimeGoalScopeEnum.TEAM, organizationTeamId: In(readableTeamIds) });
		}
		// An organization goal has neither.
		const readsOrganizationGoals = wantsScope(TimeGoalScopeEnum.ORGANIZATION) && !employeeId && !organizationTeamId;
		if (readsOrganizationGoals) {
			alternatives.push({ scope: TimeGoalScopeEnum.ORGANIZATION });
		}
		return alternatives;
	}

	/**
	 * Whose goals the caller reads, beyond the organization's: her own and those of the members of the teams she
	 * manages, and those of the teams she belongs to. Nobody's for a caller without an employee.
	 */
	private async readableOwners(organizationId: ID, tenantId: ID): Promise<{ memberIds: ID[]; teamIds: ID[] }> {
		const currentEmployeeId = RequestContext.currentUser()?.employeeId;
		if (!currentEmployeeId) {
			return { memberIds: [], teamIds: [] };
		}

		const memberships = await this.typeOrmRepository.manager.find(OrganizationTeamEmployee, {
			where: {
				employeeId: currentEmployeeId,
				tenantId,
				...activeMembershipWhere(),
				organizationTeam: { ...activeGroupWhere(), organizationId }
			},
			select: { organizationTeamId: true, isManager: true }
		});
		const teamIds = memberships.map(({ organizationTeamId }) => organizationTeamId);
		const managedTeamIds = memberships
			.filter(({ isManager }) => isManager === true)
			.map(({ organizationTeamId }) => organizationTeamId);

		const memberIds = new Set<ID>([currentEmployeeId]);
		if (managedTeamIds.length > 0) {
			const managedMembers = await this.typeOrmRepository.manager.find(OrganizationTeamEmployee, {
				where: { organizationTeamId: In(managedTeamIds), tenantId, ...activeMembershipWhere() },
				select: { employeeId: true }
			});
			managedMembers.forEach(({ employeeId }) => memberIds.add(employeeId));
		}
		return { memberIds: [...memberIds], teamIds };
	}

	/**
	 * The members a progress read covers, after the rules of {@link getProgress}.
	 */
	private async readableMemberIds(input: ITimeGoalProgressFindInput, organizationId: ID): Promise<ID[]> {
		const requested = [...new Set(input.employeeIds ?? [])];
		const teamIds = input.organizationTeamId ? [input.organizationTeamId] : [];
		let memberIds: ID[] = [];

		if (teamIds.length > 0) {
			memberIds = await this._managedEmployeeService.filterAccessibleEmployeeIds(requested, teamIds, [], false);
			// Someone who acts for every employee gets the requested list back as is, empty when the read names the
			// team only: she then reads every member of the team.
			const readsWholeTeam = memberIds.length === 0 && requested.length === 0;
			if (readsWholeTeam) {
				memberIds = await this._managedEmployeeService.findMembersOfReadableTeams(teamIds);
			}
		} else if (requested.length > 0) {
			const allowed = await Promise.all(
				requested.map((employeeId) =>
					this._managedEmployeeService.canManageEmployee(employeeId, undefined, organizationId)
				)
			);
			memberIds = requested.filter((_, index) => allowed[index]);
		} else {
			const currentEmployeeId = RequestContext.currentUser()?.employeeId;
			if (currentEmployeeId) {
				memberIds = [currentEmployeeId];
			}
		}
		return memberIds.filter((employeeId) => employeeId !== NO_ACCESSIBLE_EMPLOYEE_ID);
	}

	/**
	 * The goals, not archived, that count at least one of the members: their own, those of their teams, and the
	 * organization's.
	 */
	private async goalsCounting(
		memberIds: ID[],
		teamIds: ID[],
		organizationId: ID,
		tenantId: ID,
		goalIds?: ID[]
	): Promise<TimeGoal[]> {
		const base: FindOptionsWhere<TimeGoal> = { organizationId, tenantId, isArchived: false };
		if (goalIds?.length) {
			base.id = In(goalIds);
		}
		const where: FindOptionsWhere<TimeGoal>[] = [
			{ ...base, scope: TimeGoalScopeEnum.EMPLOYEE, employeeId: In(memberIds) },
			{ ...base, scope: TimeGoalScopeEnum.ORGANIZATION }
		];
		const uniqueTeamIds = [...new Set(teamIds)];
		if (uniqueTeamIds.length > 0) {
			where.push({ ...base, scope: TimeGoalScopeEnum.TEAM, organizationTeamId: In(uniqueTeamIds) });
		}
		return await this.typeOrmRepository.find({ where, relations: GOAL_RELATIONS, order: { createdAt: 'ASC' } });
	}

	/**
	 * The time logs of the members that start in any of the periods read, with what a goal filters on, as the
	 * statistics read tracked time (soft-deleted logs left out, a running log included).
	 */
	private async countedLogsByMember(
		periods: Array<{ employeeId: ID; start: Date; end: Date }>,
		organizationId: ID,
		tenantId: ID
	): Promise<Map<ID, TimeGoalCountedLog[]>> {
		const memberIds = [...new Set(periods.map(({ employeeId }) => employeeId))];
		const earliest = Math.min(...periods.map(({ start }) => start.getTime()));
		const latest = Math.max(...periods.map(({ end }) => end.getTime()));
		const { start, end } = getDateRangeFormat(moment.utc(earliest), moment.utc(latest));

		const logs = await this.typeOrmRepository.manager
			.createQueryBuilder(TimeLog, 'time_log')
			.leftJoin('time_log.project', 'project')
			.select([
				'time_log.id',
				'time_log.employeeId',
				'time_log.startedAt',
				'time_log.stoppedAt',
				'time_log.isBillable',
				'time_log.projectId',
				'time_log.organizationContactId',
				'project.id',
				'project.organizationContactId'
			])
			.where('time_log.tenantId = :tenantId', { tenantId })
			.andWhere('time_log.organizationId = :organizationId', { organizationId })
			.andWhere('time_log.employeeId IN (:...memberIds)', { memberIds })
			.andWhere('time_log.startedAt >= :start', { start })
			.andWhere('time_log.startedAt < :end', { end })
			.getMany();

		const logsByMember = new Map<ID, TimeGoalCountedLog[]>();
		for (const log of logs) {
			const counted: TimeGoalCountedLog = {
				startedAt: log.startedAt,
				stoppedAt: log.stoppedAt ?? null,
				isBillable: log.isBillable ?? null,
				projectId: log.projectId ?? null,
				organizationContactId: log.organizationContactId ?? null,
				projectOrganizationContactId: log.project?.organizationContactId ?? null
			};
			const memberLogs = logsByMember.get(log.employeeId) ?? [];
			memberLogs.push(counted);
			logsByMember.set(log.employeeId, memberLogs);
		}
		return logsByMember;
	}

	/**
	 * The time zone a member's periods are counted in: hers, else the organization's, else UTC.
	 */
	private timeZoneOf(userTimeZone: string | undefined, organizationTimeZone: string | undefined): string {
		for (const candidate of [userTimeZone, organizationTimeZone]) {
			const isKnownZone = !!candidate && moment.tz.zone(candidate) !== null;
			if (isKnownZone) {
				return candidate;
			}
		}
		return 'UTC';
	}
}
