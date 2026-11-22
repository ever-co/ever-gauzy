import { ID, PermissionsEnum } from '@gauzy/contracts';
import { MultiORM, MultiORMEnum, parseTypeORMFindToMikroOrm } from '../core/utils';
import { AuthService } from '../auth/auth.service';
import { Employee, User, UserOrganization } from '../core/entities/internal';
import { MikroOrmEmployeeRepository } from '../employee/repository/mikro-orm-employee.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { MikroOrmUserOrganizationRepository } from '../user-organization/repository/mikro-orm-user-organization.repository';
import { TypeOrmUserOrganizationRepository } from '../user-organization/repository/type-orm-user-organization.repository';
import { MikroOrmUserRepository } from '../user/repository/mikro-orm-user.repository';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import type { RolePermissionService } from '../role-permission/role-permission.service';
import { IEmbedMemberScope } from './embed-member.service';
import { embedTokenTtlSeconds } from './embed.utils';

/** The repositories the member of a timer token is read from, under either ORM. */
export interface IEmbedMemberRepositories {
	typeOrmEmployeeRepository: TypeOrmEmployeeRepository;
	mikroOrmEmployeeRepository: MikroOrmEmployeeRepository;
	typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository;
	mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository;
	typeOrmUserRepository: TypeOrmUserRepository;
	mikroOrmUserRepository: MikroOrmUserRepository;
}

/** What a timer token is bound to besides its member: who it comes from, the site, and a client if any. */
export interface IEmbedTokenBinding {
	/** The credential the token was exchanged with, or the site grant of a person's sign-in. */
	credentialId: ID;
	/** The site grant of a person's sign-in; none for a credential's token. */
	grantId?: ID;
	origin: string;
	clientId?: ID | null;
}

/** A minted timer token and when it expires. */
export interface IEmbedMintedToken {
	token: string;
	expiresAt: Date;
}

/**
 * The member a timer token acts for, and the token: what the credential exchange and a person's sign-in from an allowed
 * site share. A member gets a token only while they are an active, unarchived employee with an account, time tracking
 * on, an active membership of the organization (the token names it, and `JwtStrategy` refuses it without one) and a
 * role that holds the time tracker permission, which every timer route asks for (ever-co/ever-gauzy#12134). The
 * token is an ordinary access token held to the timer (`AuthService.issueEmbedSession`), living
 * `GAUZY_EMBED_TOKEN_TTL_SECONDS`.
 */
export class EmbedMemberTokens {
	constructor(
		private readonly repositories: IEmbedMemberRepositories,
		private readonly authService: Pick<AuthService, 'issueEmbedSession'>,
		private readonly ormTypeOf: () => MultiORM,
		private readonly rolePermissions: Pick<RolePermissionService, 'checkRolePermission'>
	) {}

	/**
	 * Why the member cannot get a timer token, for a log line, or null when they can.
	 *
	 * @param employee The member, as found among the organization's active employees; null when none was.
	 * @param scope The organization the token is for.
	 */
	async refusalOf(employee: Employee | null, scope: IEmbedMemberScope): Promise<string | null> {
		if (!employee) {
			return 'not an active member of the organization';
		}
		if (!employee.userId || employee.isPlaceholder) {
			return 'a member without an account';
		}
		if (!employee.isTrackingEnabled) {
			return 'time tracking is off for this member';
		}
		if (!(await this.isActiveMember(employee.userId, scope))) {
			return 'no active membership of the organization';
		}
		if (!(await this.roleTracksTime(employee.userId, scope))) {
			return "the member's role holds no time tracker permission";
		}
		return null;
	}

	/**
	 * A timer token for the member, bound to the site, living `GAUZY_EMBED_TOKEN_TTL_SECONDS` from `now`.
	 *
	 * @param employee A member {@link refusalOf} accepted.
	 * @param scope The organization the token is for.
	 * @param binding Who the token comes from, the site and the client.
	 * @param now The time of the request.
	 */
	async mint(
		employee: Employee,
		scope: IEmbedMemberScope,
		binding: IEmbedTokenBinding,
		now: Date
	): Promise<IEmbedMintedToken> {
		const expiresAt = new Date(now.getTime() + embedTokenTtlSeconds() * 1000);
		const token = await this.authService.issueEmbedSession({
			userId: employee.userId,
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			credentialId: binding.credentialId,
			employeeId: employee.id,
			origin: binding.origin,
			clientId: binding.clientId,
			grantId: binding.grantId,
			expiresAt
		});
		return { token, expiresAt };
	}

	/** An employee, by the conditions given, from the repository: the routes that ask may run before any tenant is known. */
	async findEmployee(where: Record<string, unknown>): Promise<Employee | null> {
		const { typeOrmEmployeeRepository, mikroOrmEmployeeRepository } = this.repositories;
		switch (this.ormTypeOf()) {
			case MultiORMEnum.MikroORM: {
				const parsed = parseTypeORMFindToMikroOrm<Employee>({ where } as any);
				return (await mikroOrmEmployeeRepository.findOne(parsed.where, parsed.mikroOptions)) as Employee | null;
			}
			case MultiORMEnum.TypeORM:
				return await typeOrmEmployeeRepository.findOne({ where });
			default:
				throw new Error(`ORM type not implemented: ${this.ormTypeOf()}`);
		}
	}

	/** Whether the user's role holds the time tracker permission that every timer route asks for. */
	private async roleTracksTime(userId: ID, scope: IEmbedMemberScope): Promise<boolean> {
		const roleId = await this.roleIdOf(userId, scope);
		if (!roleId) {
			return false;
		}
		return await this.rolePermissions.checkRolePermission(scope.tenantId, roleId, [PermissionsEnum.TIME_TRACKER], true);
	}

	/** The role of the user, in the token's tenant; null for a user without one. */
	private async roleIdOf(userId: ID, scope: IEmbedMemberScope): Promise<ID | null> {
		const where = { id: userId, tenantId: scope.tenantId };
		const { typeOrmUserRepository, mikroOrmUserRepository } = this.repositories;
		let user: Pick<User, 'roleId'> | null;
		switch (this.ormTypeOf()) {
			case MultiORMEnum.MikroORM: {
				const parsed = parseTypeORMFindToMikroOrm<User>({ where } as any);
				user = (await mikroOrmUserRepository.findOne(parsed.where, parsed.mikroOptions)) as User | null;
				break;
			}
			case MultiORMEnum.TypeORM:
				user = await typeOrmUserRepository.findOne({ where, select: { id: true, roleId: true } });
				break;
			default:
				throw new Error(`ORM type not implemented: ${this.ormTypeOf()}`);
		}
		return user?.roleId ?? null;
	}

	/** Whether the user is an active, unarchived member of the organization. */
	private async isActiveMember(userId: ID, scope: IEmbedMemberScope): Promise<boolean> {
		const where = {
			userId,
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			isActive: true,
			isArchived: false
		};
		const { typeOrmUserOrganizationRepository, mikroOrmUserOrganizationRepository } = this.repositories;
		switch (this.ormTypeOf()) {
			case MultiORMEnum.MikroORM: {
				const parsed = parseTypeORMFindToMikroOrm<UserOrganization>({ where } as any);
				return !!(await mikroOrmUserOrganizationRepository.findOne(parsed.where, parsed.mikroOptions));
			}
			case MultiORMEnum.TypeORM:
				return !!(await typeOrmUserOrganizationRepository.findOne({ where }));
			default:
				throw new Error(`ORM type not implemented: ${this.ormTypeOf()}`);
		}
	}
}
