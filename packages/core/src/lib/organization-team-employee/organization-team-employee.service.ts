import { EventBus } from '@nestjs/cqrs';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { DeleteResult, Equal, FindOptionsWhere, IsNull, Or, UpdateResult } from 'typeorm';
import {
	BaseEntityEnum,
	EntitySubscriptionTypeEnum,
	ID,
	IEmployee,
	IOrganizationTeamEmployeeActiveTaskUpdateInput,
	IOrganizationTeamEmployeeFindInput,
	IOrganizationTeamEmployeeUpdateInput,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { LegacyFindOneOptions } from './../core/utils';
import { Role } from './../core/entities/internal';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { TaskService } from './../tasks/task.service';
import { CreateEntitySubscriptionEvent } from '../entity-subscription/events';
import { EntitySubscriptionService } from '../entity-subscription/entity-subscription.service';
import { TypeOrmOrganizationTeamEmployeeRepository } from './repository/type-orm-organization-team-employee.repository';
import { MikroOrmOrganizationTeamEmployeeRepository } from './repository/mikro-orm-organization-team-employee.repository';
import { IWorkingEmployeeLookup } from '../employee/former-employees';
import { mayFlagTeamManagers, teamRoleAfterEdit } from './team-manager-membership';
import { TrackingTurnedOffEvent } from '../time-tracking/timer/events/tracking-turned-off.event';
import {
	callerRoleRank,
	keepsTrackingSwitch,
	mayActAsTeamManager,
	rankInTeam,
	rankOfRole,
	TrackingSwitchRank
} from '../time-tracking/timer/tracking-switch-rule';

@Injectable()
export class OrganizationTeamEmployeeService extends TenantAwareCrudService<OrganizationTeamEmployee> {
	constructor(
		readonly typeOrmOrganizationTeamEmployeeRepository: TypeOrmOrganizationTeamEmployeeRepository,
		readonly mikroOrmOrganizationTeamEmployeeRepository: MikroOrmOrganizationTeamEmployeeRepository,
		private readonly _eventBus: EventBus,
		private readonly _taskService: TaskService,
		private readonly _entitySubscriptionService: EntitySubscriptionService
	) {
		super(typeOrmOrganizationTeamEmployeeRepository, mikroOrmOrganizationTeamEmployeeRepository);
	}

	/**
	 * Update organization team by managing its members and their roles.
	 *
	 * @param organizationTeamId - ID of the organization team
	 * @param organizationId - ID of the organization
	 * @param employees - Array of employees to be assigned to the team
	 * @param role - The role to assign to managers in the team
	 * @param managerIds - Array of employee IDs to be assigned as managers
	 * @param memberIds - Array of employee IDs to be assigned as members
	 * @param lookup - Which employees still work. With it, the membership of an employee whose work ended is kept
	 *   when the edit leaves them out: the member lists never show them (`former-employees.ts`), so an edit never
	 *   sends them back, and Back to Work restores them.
	 * @returns Promise<void>
	 */
	async updateOrganizationTeam(
		organizationTeamId: ID,
		organizationId: ID,
		employees: IEmployee[],
		role: Role,
		managerIds: ID[],
		memberIds: ID[],
		lookup?: IWorkingEmployeeLookup
	): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		const membersToUpdate = new Set([...managerIds, ...memberIds].filter(Boolean));

		const actsForEveryEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

		// Fetch existing team members with their roles
		// Bypass employee filter since authorization is handled at a higher level
		const teamMembers = await this.withoutEmployeeFilter(() =>
			this.find({
				where: { tenantId, organizationId, organizationTeamId },
				relations: { role: true }
			})
		);

		// `isManager` lets a manager act for the team's members (ManagedEmployeeService). Only a caller who may
		// already act for them (see mayFlagTeamManagers) sets it on a new manager or repairs a manager row that lacks
		// it; any other team manager changes the flag only together with the role, as before.
		const callerEmployeeId = RequestContext.currentEmployeeId();
		const flagsManagers = mayFlagTeamManagers(teamMembers, callerEmployeeId, actsForEveryEmployee);

		// Create a map for fast lookup of current team members
		const existingMemberMap = new Map(teamMembers.map((member) => [member.employeeId, member]));

		// The members whose work ended are never listed, so the edit could not keep them: they stay
		const working = lookup
			? await lookup.findWorkingEmployeeIds(teamMembers.map(({ employeeId }) => employeeId))
			: null;

		// Separate members to remove and to update
		const removedMembers = teamMembers.filter(
			(member) => !membersToUpdate.has(member.employeeId) && (!working || working.has(member.employeeId))
		);
		const updatedMembers = teamMembers.filter((member) => membersToUpdate.has(member.employeeId));

		// 1. Remove members who are no longer in the team
		if (removedMembers.length > 0) {
			/**
			 * Unassign employee all tasks before removing from team
			 */
			await Promise.all(
				removedMembers.map(
					async (member) =>
						await this._taskService.unassignEmployeeFromTeamTasks(member.employeeId, organizationTeamId)
				)
			);

			// Same bypass as the lookup above: with the employee filter on, a team manager without
			// CHANGE_SELECTED_EMPLOYEE only matched their own row, so other members were never removed
			await this.withoutEmployeeFilter(() => this.deleteMany(removedMembers.map((member) => member.id)));

			// Unsubscribe members who were unassigned from team. Not `delete()`: for a manager without
			// CHANGE_SELECTED_EMPLOYEE that would target the manager's own subscription, not the member's.
			try {
				await Promise.all(
					removedMembers.map(
						async (member) =>
							await this._entitySubscriptionService.deleteForEmployee({
								entity: BaseEntityEnum.OrganizationTeam,
								entityId: organizationTeamId,
								employeeId: member.employeeId,
								type: EntitySubscriptionTypeEnum.ASSIGNMENT,
								organizationId,
								tenantId
							})
					)
				);
			} catch (error) {
				console.error('Error unsubscribing team members:', error);
			}
		}

		// 2. Update role for existing members. A member named as a manager gets the manager role; any other member
		// keeps a custom role they were given, and loses a manager role the edit no longer gives them (#6569).
		await Promise.all(
			updatedMembers.map(async (member) => {
				const isManager = managerIds.includes(member.employeeId);
				const newRole = teamRoleAfterEdit(member, isManager, role);

				// Only update if the role or (for a caller who sets the flag) the manager flag has changed. A member
				// without a role is stored with `roleId` null, and `newRole?.id` is undefined for them: compared as
				// they were, every plain member was rewritten on each edit of the team.
				const roleChanged = (newRole?.id ?? null) !== (member.roleId ?? null);
				const flagChanged = !!member.isManager !== isManager;
				// Taking the manager flag away needs no right: a member left out of the managers loses it whoever edits
				// the team, a flag-only manager included. Only giving it needs `flagsManagers`, and a promotion by any
				// other caller gives the role only, as for a new member.
				const clearsFlag = flagChanged && !isManager;
				const grantsFlag = flagChanged && flagsManagers;
				const grantsFlagWithoutRight = isManager && !flagsManagers;
				const changes: Partial<OrganizationTeamEmployee> = { role: newRole };
				if (!grantsFlagWithoutRight) {
					changes.isManager = isManager;
				}
				if (roleChanged || clearsFlag || grantsFlag) {
					await this.withoutEmployeeFilter(() => super.update(member.id, changes));
				}
			})
		);

		// 3. Add new members to the team
		const newMembers = employees.filter((employee) => !existingMemberMap.has(employee.id));

		if (newMembers.length > 0) {
			const newTeamMembers = newMembers.map(
				(employee) =>
					new OrganizationTeamEmployee({
						organizationTeamId,
						employeeId: employee.id,
						tenantId,
						organizationId,
						isManager: flagsManagers && managerIds.includes(employee.id),
						roleId: managerIds.includes(employee.id) ? role.id : null
					})
			);

			// Subscribe new assignees to the team
			try {
				await Promise.all(
					newMembers.map((member: IEmployee) =>
						this._eventBus.publish(
							new CreateEntitySubscriptionEvent({
								entity: BaseEntityEnum.OrganizationTeam,
								entityId: organizationTeamId,
								employeeId: member.id,
								type: EntitySubscriptionTypeEnum.ASSIGNMENT,
								organizationId,
								tenantId
							})
						)
					)
				);
			} catch (error) {
				console.error('Error subscribing new team members:', error);
			}

			await this.saveMany(newTeamMembers);
		}
	}

	/**
	 * Update organization team member entity
	 *
	 * @param memberId - The ID of the organization team member to update
	 * @param entity - The input data for updating the organization team member
	 * @returns The updated OrganizationTeamEmployee or UpdateResult
	 */
	/**
	 * The members of one team as the set-based edit states them: every employee on it, and the managers among
	 * them.
	 *
	 * Read past the employee filter, as `updateOrganizationTeam` reads the same rows: with the filter on, a
	 * manager without `CHANGE_SELECTED_EMPLOYEE` would see only their own row, and a set rebuilt from that
	 * would remove every other member. Scoped by the caller's tenant and the organization named.
	 *
	 * @param organizationTeamId The team.
	 * @param organizationId The organization the team belongs to.
	 * @returns The employees on the team, and the managers among them.
	 */
	async findMemberSets(organizationTeamId: ID, organizationId: ID): Promise<{ memberIds: ID[]; managerIds: ID[] }> {
		const tenantId = RequestContext.currentTenantId();
		const members = await this.withoutEmployeeFilter(() =>
			this.find({
				where: { tenantId, organizationId, organizationTeamId },
				relations: { role: true }
			})
		);

		const memberIds = (members ?? []).map((member) => member.employeeId);
		const managerIds = (members ?? [])
			.filter((member) => member.isManager === true || member.role?.name === RolesEnum.MANAGER)
			.map((member) => member.employeeId);

		return { memberIds, managerIds };
	}

	/**
	 * Whether the employee manages the team: their row holds the MANAGER role or the manager flag. The flag is what
	 * lets a manager act for the team's members (`ManagedEmployeeService`), so it lets them manage the team as well,
	 * on the same terms: a flagged membership that is inactive or archived counts for neither. The role is read as the
	 * team checks always read it.
	 *
	 * @param employeeId - The employee to check. Without one the answer is no: an empty id would match any manager.
	 * @param team - The team's tenant, organization and id.
	 * @param withDeleted - Also read the rows of a soft-deleted team, for its restoration.
	 */
	public async isTeamManager(
		employeeId: ID | undefined,
		team: Pick<FindOptionsWhere<OrganizationTeamEmployee>, 'tenantId' | 'organizationId' | 'organizationTeamId'>,
		withDeleted = false
	): Promise<boolean> {
		if (!employeeId) {
			return false;
		}
		const membership = { ...team, employeeId };
		// Both flags are nullable and their defaults only apply on insert, so a legacy row can hold NULL
		const activeFlaggedMembership = {
			...membership,
			isManager: true,
			isActive: Or(IsNull(), Equal(true)),
			isArchived: Or(IsNull(), Equal(false))
		};
		return await this.typeOrmOrganizationTeamEmployeeRepository.exists({
			where: [{ ...membership, role: { name: RolesEnum.MANAGER } }, activeFlaggedMembership],
			withDeleted
		});
	}

	public async update(
		memberId: ID,
		entity: IOrganizationTeamEmployeeUpdateInput
	): Promise<OrganizationTeamEmployee | UpdateResult> {
		try {
			const { organizationId, organizationTeamId } = entity;
			const tenantId = RequestContext.currentTenantId() || entity.tenantId;

			// Create a where clause for the employee
			const whereClause: FindOptionsWhere<OrganizationTeamEmployee> = {
				tenantId,
				organizationId,
				organizationTeamId
			};

			// Write the membership's own fields only. The REST body also carries `tenantId`, `tenant` and
			// `organization`: they select nothing here, and writing them could clear or move the row's scope.
			// Both bodies (`UpdateTeamMemberDTO`, `UpdateOrganizationTeamEmployeeInput`) carry `activeTaskId`.
			const { activeTaskId, isTrackingEnabled, order } = entity as IOrganizationTeamEmployeeUpdateInput &
				Pick<IOrganizationTeamEmployeeActiveTaskUpdateInput, 'activeTaskId'>;
			const changes = Object.fromEntries(
				Object.entries({ organizationId, organizationTeamId, activeTaskId, isTrackingEnabled, order }).filter(
					([, value]) => value !== undefined
				)
			) as IOrganizationTeamEmployeeUpdateInput;

			// Check if user has permission to change the selected employee
			if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				try {
					// Retrieve the current employee ID — the manager check below needs one (an empty id
					// used to be dropped from the where, degrading it to "the team has any manager").
					const employeeId = RequestContext.currentEmployeeId();
					if (!employeeId) {
						throw new ForbiddenException('You do not have sufficient permissions to perform this action.');
					}

					const isManager = await this.isTeamManager(employeeId, whereClause);
					if (!isManager) {
						throw new ForbiddenException('You do not have sufficient permissions to perform this action.');
					}

					// If the employee is a manager, proceed with the update (bypassed: the filter would only match
					// the manager's own row)
					return await this.withoutEmployeeFilter(() =>
						super.update({ id: memberId, ...whereClause }, changes)
					);
				} catch (error) {
					throw new ForbiddenException('You do not have sufficient permissions to perform this action.');
				}
			}

			// If user has permission, proceed with the update
			return await super.update({ id: memberId, ...whereClause }, changes);
		} catch (error) {
			throw new ForbiddenException('An error occurred while updating the organization team member.');
		}
	}

	/**
	 * Update organization team member active task entity
	 *
	 * @param memberId - The ID of the organization team member to update
	 * @param entity - The input data for updating the active task
	 * @returns The updated OrganizationTeamEmployee or UpdateResult
	 */
	public async updateActiveTask(
		memberId: ID,
		entity: IOrganizationTeamEmployeeActiveTaskUpdateInput
	): Promise<OrganizationTeamEmployee | UpdateResult> {
		try {
			const { organizationId, organizationTeamId, activeTaskId } = entity;
			const tenantId = RequestContext.currentTenantId();

			// Create a where clause for the employee
			const whereClause: FindOptionsWhere<OrganizationTeamEmployee> = {
				tenantId,
				organizationId,
				organizationTeamId
			};

			// Admins and Super Admins can update the activeTaskId of any employee
			if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				const member = await this.findOneByWhereOptions({
					id: memberId,
					...whereClause
				});

				// Update the active task ID
				return await super.update(member.id, { activeTaskId });
			}

			// Non-admin: Employee must update their own task or manage their team as a manager
			const employeeId = RequestContext.currentEmployeeId();

			if (employeeId) {
				const isManager = await this.isTeamManager(employeeId, whereClause);

				if (isManager) {
					// Manager can update any team member's active task
					// Bypass the employee filter since manager authorization is verified
					const member = await this.withoutEmployeeFilter(() =>
						this.findOneByWhereOptions({ ...whereClause, id: memberId })
					);

					// Update the active task ID (still bypassed: the filter would only match the manager's own row)
					return await this.withoutEmployeeFilter(() =>
						super.update({ id: member.id, organizationId, organizationTeamId, tenantId }, { activeTaskId })
					);
				}

				// Non-manager can only update their own active task
				whereClause.employeeId = employeeId;
				const member = await this.findOneByWhereOptions(whereClause);

				// Update the active task ID
				return await super.update(
					{ id: member.id, organizationId, organizationTeamId, tenantId },
					{ activeTaskId }
				);
			}

			throw new ForbiddenException('You do not have permission to update this active task.');
		} catch (error) {
			throw new ForbiddenException('An error occurred while updating the active task.');
		}
	}

	/**
	 * Finds a team member by id.
	 *
	 * A manager without `CHANGE_SELECTED_EMPLOYEE` may change any member of a team they manage, but the
	 * employee filter limits this read to their own row, so reading the member back after such a change
	 * (the GraphQL update fields do) answered not found. On a miss, the row is read past the filter and
	 * returned only to a manager of its team, checked as `update` checks it; anyone else keeps the miss.
	 *
	 * @param id - ID of the team member
	 * @param options - Options for the team member find query
	 * @returns The team member
	 */
	public async findOneByIdString(
		id: ID,
		options?: LegacyFindOneOptions<OrganizationTeamEmployee>
	): Promise<OrganizationTeamEmployee> {
		try {
			return await super.findOneByIdString(id, options);
		} catch (error) {
			const employeeId = RequestContext.currentEmployeeId();

			// Only a caller held to their own row by the employee filter can miss a member they manage
			if (!employeeId || RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				throw error;
			}

			try {
				const member = await this.withoutEmployeeFilter(() => super.findOneByIdString(id, options));

				// Without the member's team, the check below would accept a manager of any team
				if (member.organizationTeamId) {
					const isManager = await this.isTeamManager(employeeId, {
						tenantId: RequestContext.currentTenantId(),
						organizationId: member.organizationId,
						organizationTeamId: member.organizationTeamId
					});
					if (isManager) {
						return member;
					}
				}
			} catch {
				// Not a member of the caller's tenant, or not of a team the caller manages
			}

			throw error;
		}
	}

	/**
	 * Delete a team member by their ID.
	 *
	 * @param memberId - ID of the team member to delete
	 * @param options - Options for the team member find query
	 * @returns A promise resolving to the result of the deletion operation
	 */
	async deleteTeamMember(
		memberId: ID,
		options: IOrganizationTeamEmployeeFindInput
	): Promise<DeleteResult | OrganizationTeamEmployee> {
		const { organizationId, organizationTeamId } = options;
		const tenantId = RequestContext.currentTenantId() || options.tenantId;

		// create a where clause for the employee
		const whereClause: FindOptionsWhere<OrganizationTeamEmployee> = {
			tenantId,
			organizationId,
			organizationTeamId
		};

		try {
			if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				// Get member
				const member = await this.findOneByWhereOptions({
					id: memberId,
					...whereClause
				});

				// Unassign employee all tasks before removing from team
				await this._taskService.unassignEmployeeFromTeamTasks(member.employeeId, organizationTeamId);

				// Remove the team member
				return await this.delete(member.id);
			} else {
				const employeeId = RequestContext.currentEmployeeId();

				// Check if the current user has an employee context
				if (!employeeId) {
					throw new ForbiddenException('You do not have permission to delete this team member.');
				}

				const isManager = await this.isTeamManager(employeeId, whereClause);

				if (isManager) {
					// Manager can delete any team member
					// Bypass the employee filter since manager authorization is verified
					const member = await this.withoutEmployeeFilter(() =>
						this.findOneByWhereOptions({ ...whereClause, id: memberId })
					);

					// Unassign employee all tasks before removing from the team
					await this._taskService.unassignEmployeeFromTeamTasks(member.employeeId, organizationTeamId);

					// Remove the team member (still bypassed: the filter would only match the manager's own row)
					return await this.withoutEmployeeFilter(() => this.delete(member.id));
				}

				// Non-manager can only remove themselves from the team
				whereClause.employeeId = employeeId;
				const member = await this.findOneByWhereOptions(whereClause);

				// Unassign employee all tasks before removing from the team
				await this._taskService.unassignEmployeeFromTeamTasks(member.employeeId, organizationTeamId);

				// Remove the team member
				return await this.delete(member.id);
			}
		} catch (error) {
			throw new ForbiddenException('An error occurred while deleting the team member.');
		}
	}

	/**
	 * Updates a team member, as {@link update} does, and when the update turns their time tracking off for the team,
	 * stops the timer they still have running for that team. Without it the timer kept counting: the clients hide it
	 * once tracking is off. An update that turns their tracking on or off is refused to a caller whose rank in the team
	 * is not above theirs, and such a caller never writes the switch (see {@link withTrackingSwitchAllowed}).
	 *
	 * @param memberId The membership to update.
	 * @param entity The changes, scoped by organization and team as for {@link update}.
	 * @returns The update result.
	 */
	public async updateMember(
		memberId: ID,
		entity: IOrganizationTeamEmployeeUpdateInput
	): Promise<OrganizationTeamEmployee | UpdateResult> {
		const changes = await this.withTrackingSwitchAllowed(memberId, entity);
		const membershipTurnedOff = await this.membershipTrackingTurnsOff(memberId, changes);
		const result = await this.update(memberId, changes);
		if (membershipTurnedOff) {
			const { employeeId, organizationId, tenantId, organizationTeamId } = membershipTurnedOff;
			this._eventBus.publish(
				new TrackingTurnedOffEvent({ employeeId, organizationId, tenantId, organizationTeamId })
			);
		}
		return result;
	}

	/**
	 * The membership whose tracking the update turns off, read before the update, or null when the update leaves
	 * tracking as it is. Read past the employee filter: a team manager changes another member's row.
	 */
	private async membershipTrackingTurnsOff(
		memberId: ID,
		entity: IOrganizationTeamEmployeeUpdateInput
	): Promise<OrganizationTeamEmployee | null> {
		const turnsTrackingOff = entity.isTrackingEnabled === false;
		if (!turnsTrackingOff) {
			return null;
		}
		const tenantId = RequestContext.currentTenantId() || entity.tenantId;
		const { organizationId, organizationTeamId } = entity;
		try {
			const membership = await this.withoutEmployeeFilter(() =>
				this.findOneByWhereOptions({ id: memberId, tenantId, organizationId, organizationTeamId })
			);
			const wasTracking = membership.isTrackingEnabled !== false;
			if (!wasTracking) {
				return null;
			}
			return membership;
		} catch {
			return null;
		}
	}

	/**
	 * The update as the caller may make it. Where the team's organization restricts the switch to higher roles
	 * (`restrictTrackingSwitchToHigherRoles`), the member's time tracking switch is the caller's to write only when
	 * their rank in the team is above the member's: an admin acts on anyone, admins included; a team manager on the
	 * team's members only, never on themselves or another manager; a member on no one. A rank in a team is the tenant
	 * role's (SUPER_ADMIN and ADMIN, then MANAGER, then any other role), raised to MANAGER for a manager of the team:
	 * the MANAGER role or the manager flag on the membership. Elsewhere, the default, whoever may update the membership
	 * writes it, as before.
	 *
	 * Anyone else is refused a change of the switch. When they send it back as stored, it is left out of the write: it
	 * was read before, and an admin may have changed it since, which that copy would overwrite.
	 *
	 * An update that names no membership of the team is left as it is: `update` changes no row then. The membership is
	 * read with its roles past the employee filter, as a team manager's change reads it.
	 *
	 * @param memberId The membership to update.
	 * @param entity The changes, scoped by organization and team as for {@link update}.
	 * @returns The changes to write.
	 * @throws ForbiddenException When the caller may not turn this member's tracking on or off and the update would.
	 */
	private async withTrackingSwitchAllowed(
		memberId: ID,
		entity: IOrganizationTeamEmployeeUpdateInput
	): Promise<IOrganizationTeamEmployeeUpdateInput> {
		if (entity.isTrackingEnabled === undefined) {
			return entity;
		}
		const tenantId = RequestContext.currentTenantId() || entity.tenantId;
		const { organizationId, organizationTeamId } = entity;
		const membership = await this.typeOrmOrganizationTeamEmployeeRepository.findOne({
			where: { id: memberId, tenantId, organizationId, organizationTeamId },
			relations: { role: true, employee: { user: { role: true } }, organization: true }
		});
		if (!membership) {
			return entity;
		}
		if (membership.organization?.restrictTrackingSwitchToHigherRoles !== true) {
			return entity;
		}

		const managesTeam = membership.isManager === true || membership.role?.name === RolesEnum.MANAGER;
		const memberRank = rankInTeam(rankOfRole(membership.employee?.user?.role?.name), managesTeam);
		// The membership's own team, never the body's: without a team the manager check would match any team
		const callerRank = await this.callerRankInTeam({
			tenantId,
			organizationId: membership.organizationId,
			organizationTeamId: membership.organizationTeamId
		});
		// NULL reads as on, as the timer reads it: a null sent for a member switched off would turn them back on
		const turnsOn = entity.isTrackingEnabled !== false;
		const isOn = membership.isTrackingEnabled !== false;
		if (keepsTrackingSwitch(callerRank, memberRank, turnsOn !== isOn)) {
			return entity;
		}
		const changes = { ...entity };
		delete changes.isTrackingEnabled;
		return changes;
	}

	/**
	 * The caller's rank in a team: their role's, raised to MANAGER when they manage the team. Their employee is read off
	 * the user, since `currentEmployeeId` answers nothing to a holder of CHANGE_SELECTED_EMPLOYEE.
	 *
	 * @param team The team's tenant, organization and id.
	 */
	private async callerRankInTeam(
		team: Pick<FindOptionsWhere<OrganizationTeamEmployee>, 'tenantId' | 'organizationId' | 'organizationTeamId'>
	): Promise<TrackingSwitchRank> {
		const roleRank = callerRoleRank();
		if (roleRank === TrackingSwitchRank.ADMIN) {
			return roleRank;
		}
		// A third-party OAuth app's token keeps its role's rank: managing the team does not raise it
		if (!mayActAsTeamManager()) {
			return roleRank;
		}
		const callerEmployeeId = RequestContext.currentUser()?.employeeId ?? undefined;
		const managesTeam = await this.isTeamManager(callerEmployeeId, team);
		return rankInTeam(roleRank, managesTeam);
	}
}
