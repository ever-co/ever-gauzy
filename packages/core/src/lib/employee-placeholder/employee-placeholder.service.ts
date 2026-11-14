import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { EntityManager, In, Raw } from 'typeorm';
import {
	EmployeeKindEnum,
	ICreateEmailInvitesInput,
	ICreateEmailInvitesOutput,
	ID,
	IEmployee,
	IEmployeePlaceholderBulkCreateInput,
	IEmployeePlaceholderBulkCreateItem,
	IEmployeePlaceholderBulkCreateResult,
	IEmployeePlaceholderClaimInput,
	IEmployeePlaceholderCreateInput,
	IEmployeePlaceholderMemberInput,
	IEmployeePlaceholderMergeInput,
	IEmployeePlaceholderMergePreview,
	IEmployeePlaceholderMergeResult,
	IInvite,
	InvitationTypeEnum,
	LanguagesEnum,
	RolesEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import {
	Employee,
	Organization,
	OrganizationTeam,
	OrganizationTeamEmployee,
	Role,
	User
} from '../core/entities/internal';
import { findOneForUpdate } from '../employee/agent-employee';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { InviteBulkCreateCommand } from '../invite/commands/invite.bulk.create.command';
import { EmployeePlaceholderTransferService } from './employee-placeholder-transfer.service';

/** A member to create, as stored: trimmed names, a lowercase email or none. */
interface PlaceholderMember {
	firstName: string;
	lastName: string | null;
	email: string | null;
}

/** Where members are created, read once per call. */
interface CreationScope {
	tenantId: ID;
	organizationId: ID;
	role: Role;
	teams: OrganizationTeam[];
}

/**
 * Members without an account (placeholders, ever-co/ever-gauzy#11913): a person who worked with a team and has no
 * account in it, kept for time and reports only. They get no email, cannot sign in (their user has no email and no
 * password, and `AuthService.getJwtAccessToken` refuses them) and never run a timer. The person can claim their time
 * later through an invitation, or an admin merges the placeholder into a member who has an account.
 *
 * Writes go through the TypeORM connection under either ORM setting, as the agent employee provisioning does.
 */
@Injectable()
export class EmployeePlaceholderService {
	constructor(
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly transferService: EmployeePlaceholderTransferService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * Creates one member without an account in an organization of the caller, optionally in some of its teams.
	 *
	 * @throws ConflictException when a member of the organization, with or without an account, already has the email.
	 */
	async create(input: IEmployeePlaceholderCreateInput): Promise<IEmployee> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = requiredOrganization(input.organizationId);
		const member = normalizedMember(input);

		return await this.typeOrmEmployeeRepository.manager.transaction(async (manager: EntityManager) => {
			const scope = await this.readScope(manager, tenantId, organizationId, input.teamIds);
			if (member.email) {
				const existing = await findMemberByEmail(manager, member.email, organizationId, tenantId);
				if (existing?.isPlaceholder) {
					throw new ConflictException('A member without an account already has this email.');
				}
				if (existing) {
					throw new ConflictException('A member of the organization already has this email.');
				}
			}
			return await insertPlaceholder(manager, member, scope);
		});
	}

	/**
	 * Creates many members without an account at once, for an import. A row whose email a member of the organization
	 * already has (with or without an account, or an earlier row of the same call) stands for that member and creates
	 * nothing, so importing the same file twice creates each person once.
	 */
	async createBulk(input: IEmployeePlaceholderBulkCreateInput): Promise<IEmployeePlaceholderBulkCreateResult> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = requiredOrganization(input.organizationId);
		const members = (input.members ?? []).map(normalizedMember);

		return await this.typeOrmEmployeeRepository.manager.transaction(async (manager: EntityManager) => {
			const scope = await this.readScope(manager, tenantId, organizationId, input.teamIds);
			const items: IEmployeePlaceholderBulkCreateItem[] = [];

			// The transaction reads its own writes: a row repeating an email of an earlier row finds its member.
			for (const member of members) {
				if (member.email) {
					const existing = await findMemberByEmail(manager, member.email, organizationId, tenantId);
					if (existing) {
						items.push({ employee: existing, created: false });
						continue;
					}
				}
				const employee = await insertPlaceholder(manager, member, scope);
				items.push({ employee, created: true });
			}
			return { items };
		});
	}

	/**
	 * Sends a claim invitation for a member without an account: an employee invitation of its organization, accepted
	 * like any other with a new or an existing account, which also hands the placeholder over to the person who
	 * accepts it (see `InviteAcceptEmployeeHandler`).
	 *
	 * @throws ConflictException when a member of the organization with an account already has the email: an admin
	 * merges the placeholder into that member instead.
	 */
	async sendClaim(
		placeholderId: ID,
		input: IEmployeePlaceholderClaimInput,
		languageCode: LanguagesEnum
	): Promise<IInvite> {
		const tenantId = RequestContext.currentTenantId();
		const manager = this.typeOrmEmployeeRepository.manager;
		const placeholder = await findPlaceholder(manager, placeholderId, input.organizationId, tenantId);
		const email = normalizedEmail(input.email);
		if (!email) {
			throw new BadRequestException('A claim invitation needs an email.');
		}

		const member = await findMemberByEmail(manager, email, placeholder.organizationId, tenantId);
		const isAnotherMember = !!member && member.id !== placeholder.id;
		if (isAnotherMember) {
			throw new ConflictException(
				'A member of the organization already has this email: merge the member without an account into theirs.'
			);
		}

		// Accepting a claim signs in with the invitation alone, which must never open an existing account: the person
		// behind an email that has one is reached by merging the placeholder into their member instead.
		if (await hasAccount(manager, email, tenantId)) {
			throw new ConflictException(
				"This email already has an account: merge the member without an account into that person's member instead."
			);
		}

		const role = await findEmployeeRole(manager, tenantId);
		const fullName = [placeholder.user?.firstName, placeholder.user?.lastName].filter(Boolean).join(' ');
		const link = input.callbackUrl
			? { callbackUrl: input.callbackUrl, queryParams: { email: 'email', code: 'code' } }
			: {};
		const invitation = {
			emailIds: [email],
			roleId: role.id,
			inviteType: InvitationTypeEnum.EMPLOYEE,
			organizationId: placeholder.organizationId,
			tenantId,
			fullName,
			invitationExpirationPeriod: input.invitationExpirationPeriod,
			...link
		} as ICreateEmailInvitesInput;
		// The invitation is written as a claim before its email goes, so whoever accepts it gets the placeholder's time.
		const output: ICreateEmailInvitesOutput = await this.commandBus.execute(
			new InviteBulkCreateCommand(invitation, languageCode, placeholder.id)
		);
		const invite = output?.items?.[0];
		if (!invite) {
			throw new ConflictException('The claim invitation could not be created.');
		}
		// The invitation's token and code are the email's to use: its sender never gets them.
		const sent: Partial<IInvite> & { code?: string } = { ...invite };
		delete sent.token;
		delete sent.code;
		return sent as IInvite;
	}

	/** What merging a member without an account into a member would move. Writes nothing. */
	async previewMerge(
		placeholderId: ID,
		input: IEmployeePlaceholderMergeInput
	): Promise<IEmployeePlaceholderMergePreview> {
		const tenantId = RequestContext.currentTenantId();
		await findPlaceholder(this.typeOrmEmployeeRepository.manager, placeholderId, input.organizationId, tenantId);
		return await this.transferService.preview(placeholderId, input.targetEmployeeId, tenantId);
	}

	/** Merges a member without an account into a member of the same organization who has an account. */
	async merge(placeholderId: ID, input: IEmployeePlaceholderMergeInput): Promise<IEmployeePlaceholderMergeResult> {
		const tenantId = RequestContext.currentTenantId();
		await findPlaceholder(this.typeOrmEmployeeRepository.manager, placeholderId, input.organizationId, tenantId);
		const moved = await this.transferService.transfer(placeholderId, input.targetEmployeeId, tenantId);
		return { targetEmployeeId: input.targetEmployeeId, ...moved };
	}

	/**
	 * Locks the organization for the transaction, so that two creations of the same email in it run one after the
	 * other, and reads the EMPLOYEE role and the teams asked for.
	 */
	private async readScope(
		manager: EntityManager,
		tenantId: ID,
		organizationId: ID,
		teamIds: ID[] | undefined
	): Promise<CreationScope> {
		const organization = await findOneForUpdate(manager, Organization, { id: organizationId, tenantId });
		if (!organization) {
			throw new NotFoundException('The organization does not exist in this tenant.');
		}
		const role = await findEmployeeRole(manager, tenantId);
		const teams = await findTeams(manager, teamIds, organizationId, tenantId);
		return { tenantId, organizationId, role, teams };
	}
}

/** Creates the placeholder's user (no email, no password), the placeholder, and its team memberships. */
async function insertPlaceholder(
	manager: EntityManager,
	member: PlaceholderMember,
	scope: CreationScope
): Promise<IEmployee> {
	const { tenantId, organizationId, role, teams } = scope;
	const user = await manager.save(
		User,
		manager.create(User, {
			tenantId,
			tenant: { id: tenantId },
			role,
			roleId: role.id,
			firstName: member.firstName,
			lastName: member.lastName,
			email: null,
			hash: null
		} as Partial<User>)
	);
	const employee = await manager.save(
		Employee,
		manager.create(Employee, {
			tenantId,
			tenant: { id: tenantId },
			organizationId,
			organization: { id: organizationId },
			user,
			userId: user.id,
			kind: EmployeeKindEnum.HUMAN,
			isPlaceholder: true,
			placeholderEmail: member.email,
			isActive: true,
			isArchived: false,
			isTrackingEnabled: false,
			allowScreenshotCapture: false
		} as Partial<Employee>)
	);
	// A membership keeps the team's default for time tracking: a claim or a merge moves it to a member who tracks time
	// there, while the placeholder itself never starts a timer.
	for (const team of teams) {
		await manager.save(
			OrganizationTeamEmployee,
			manager.create(OrganizationTeamEmployee, {
				tenantId,
				organizationId,
				organizationTeamId: team.id,
				organizationTeam: { id: team.id },
				employeeId: employee.id,
				employee: { id: employee.id }
			} as Partial<OrganizationTeamEmployee>)
		);
	}
	return Object.assign(employee, { user });
}

/**
 * The member of the organization who has this email: a member without an account by the email it was created with,
 * else a member with an account by their user's email, compared without regard to case.
 */
async function findMemberByEmail(
	manager: EntityManager,
	email: string,
	organizationId: ID,
	tenantId: ID
): Promise<Employee | null> {
	const placeholder = await manager.findOne(Employee, {
		where: { organizationId, tenantId, isPlaceholder: true, placeholderEmail: email },
		relations: { user: true }
	});
	if (placeholder) {
		return placeholder;
	}
	return await manager.findOne(Employee, {
		where: {
			organizationId,
			tenantId,
			isPlaceholder: false,
			user: { email: Raw((column) => `LOWER(${column}) = :email`, { email }) }
		},
		relations: { user: true }
	});
}

/** Whether an account of the tenant has this email, compared without regard to case. */
async function hasAccount(manager: EntityManager, email: string, tenantId: ID): Promise<boolean> {
	const account = await manager.findOne(User, {
		where: { tenantId, email: Raw((column) => `LOWER(${column}) = :email`, { email }) }
	});
	return !!account;
}

/**
 * A member without an account of the request's tenant, in the organization the caller named (and was checked to
 * belong to): another organization's placeholder reads as missing.
 */
async function findPlaceholder(
	manager: EntityManager,
	placeholderId: ID,
	organizationId: ID | undefined,
	tenantId: ID
): Promise<Employee> {
	const organization = requiredOrganization(organizationId);
	const placeholder = await manager.findOne(Employee, {
		where: { id: placeholderId, tenantId, organizationId: organization },
		relations: { user: true }
	});
	if (!placeholder) {
		throw new NotFoundException('The member without an account does not exist.');
	}
	if (!placeholder.isPlaceholder) {
		throw new BadRequestException('This member has an account: only a member without one is claimed or merged.');
	}
	return placeholder;
}

/** The tenant's EMPLOYEE role, which members without an account carry like every member. */
async function findEmployeeRole(manager: EntityManager, tenantId: ID): Promise<Role> {
	const role = await manager.findOne(Role, { where: { name: RolesEnum.EMPLOYEE, tenantId } });
	if (!role) {
		throw new NotFoundException('The tenant has no EMPLOYEE role.');
	}
	return role;
}

/** The teams asked for, each of which must belong to the organization. */
async function findTeams(
	manager: EntityManager,
	teamIds: ID[] | undefined,
	organizationId: ID,
	tenantId: ID
): Promise<OrganizationTeam[]> {
	const ids = [...new Set(teamIds ?? [])];
	if (ids.length === 0) {
		return [];
	}
	const teams = await manager.find(OrganizationTeam, {
		where: { id: In(ids), organizationId, tenantId },
		select: { id: true },
		loadEagerRelations: false
	});
	if (teams.length !== ids.length) {
		throw new BadRequestException('Every team must belong to the organization.');
	}
	return teams;
}

/** The organization a call names, which every call must. */
function requiredOrganization(organizationId: ID | undefined): ID {
	if (!organizationId) {
		throw new BadRequestException('organizationId is required.');
	}
	return organizationId;
}

/** A member as stored: trimmed names (an empty last name is none) and a lowercase email or none. */
function normalizedMember(input: IEmployeePlaceholderMemberInput): PlaceholderMember {
	const firstName = (input.firstName ?? '').trim();
	if (!firstName) {
		throw new BadRequestException('A member without an account needs a name.');
	}
	const lastName = (input.lastName ?? '').trim();
	return { firstName, lastName: lastName || null, email: normalizedEmail(input.email) };
}

/** An email trimmed and lowercased, or null when none is given. */
function normalizedEmail(email: string | undefined): string | null {
	const trimmed = (email ?? '').trim().toLowerCase();
	if (!trimmed) {
		return null;
	}
	return trimmed;
}
