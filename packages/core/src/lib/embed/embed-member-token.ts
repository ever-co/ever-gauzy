import { ID } from '@gauzy/contracts';
import { MultiORM, MultiORMEnum, parseTypeORMFindToMikroOrm } from '../core/utils';
import { AuthService } from '../auth/auth.service';
import { Employee, UserOrganization } from '../core/entities/internal';
import { MikroOrmEmployeeRepository } from '../employee/repository/mikro-orm-employee.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { MikroOrmUserOrganizationRepository } from '../user-organization/repository/mikro-orm-user-organization.repository';
import { TypeOrmUserOrganizationRepository } from '../user-organization/repository/type-orm-user-organization.repository';
import { IEmbedMemberScope } from './embed-member.service';
import { embedTokenTtlSeconds } from './embed.utils';

/** The repositories the member of a timer token is read from, under either ORM. */
export interface IEmbedMemberRepositories {
	typeOrmEmployeeRepository: TypeOrmEmployeeRepository;
	mikroOrmEmployeeRepository: MikroOrmEmployeeRepository;
	typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository;
	mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository;
}

/** What a timer token is bound to besides its member: who it comes from, the site, and a client if any. */
export interface IEmbedTokenBinding {
	/** The credential the token was exchanged with. */
	credentialId: ID;
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
 * on, and an active membership of the organization (the token names it, and `JwtStrategy` refuses it without one). The
 * token is an ordinary access token held to the timer (`AuthService.issueEmbedSession`), living
 * `GAUZY_EMBED_TOKEN_TTL_SECONDS`.
 */
export class EmbedMemberTokens {
	constructor(
		private readonly repositories: IEmbedMemberRepositories,
		private readonly authService: Pick<AuthService, 'issueEmbedSession'>,
		private readonly ormTypeOf: () => MultiORM
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
