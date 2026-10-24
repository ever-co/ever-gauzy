import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, SaveOptions, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID, IOrganization, IPagination, IUser, IUserOrganization, RolesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { RequestContext } from '../core/context';
import { BaseQueryDTO, TenantAwareCrudService } from '../core/crud';
import { IFindOneOptions, IPartialEntity } from '../core/crud/icrud.service';
import {
	IOrganizationBoundary,
	currentOrganizationBoundary,
	isWithinOrganizationBoundary
} from '../core/crud/organization-boundary';
import { Employee, User } from '../core/entities/internal';
import { EmployeeService } from '../employee/employee.service';
import { TypeOrmOrganizationRepository } from '../organization/repository/type-orm-organization.repository';
import { UserOrganization } from './user-organization.entity';
import { TypeOrmUserOrganizationRepository } from './repository/type-orm-user-organization.repository';
import { MikroOrmUserOrganizationRepository } from './repository/mikro-orm-user-organization.repository';

@Injectable()
export class UserOrganizationService extends TenantAwareCrudService<UserOrganization> {
	constructor(
		readonly typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,
		readonly mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository,
		readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		readonly employeeService: EmployeeService
	) {
		super(typeOrmUserOrganizationRepository, mikroOrmUserOrganizationRepository);
	}

	/**
	 * Off for memberships: a membership is what grants an organization, so it is read across organizations by
	 * design — the organization switcher lists the caller's memberships of every organization
	 * (`GET /user-organization`, `userOrganizations`), switching checks the membership of the organization switched to
	 * while the token still names the previous one, counting a user's memberships decides whether removing one removes
	 * the user, and creating an organization adds its admins' memberships of it. The organization a request names is
	 * still checked by `@IsOrganizationBelongsToUser()`.
	 *
	 * Writes are another matter: {@link create}, {@link update}, {@link softRemove} and {@link softRecover} keep a
	 * confined caller inside their boundary themselves (see {@link assertMembershipWithinBoundary}).
	 *
	 * @returns False.
	 */
	protected override appliesOrganizationBoundary(): boolean {
		return false;
	}

	/**
	 * Adds a membership, inside the caller's organization boundary.
	 *
	 * **The organization boundary (owner decision 1, 2026-10-22).** A tenant admin (`SUPER_ADMIN`, `ADMIN`) adds a
	 * membership of any organization of the tenant; anyone else only of the organization of their token. A membership
	 * is what grants an organization: once one exists, `POST /auth/switch-organization` (open to every role) moves the
	 * caller into it. The REST route validated no organization while its GraphQL twin did, so a holder of
	 * `ORG_USERS_EDIT` could add themselves (or anyone) to any organization of the tenant and then switch into it.
	 *
	 * The REST body and the GraphQL input name the organization through `@IsOrganizationBelongsToUser()`; this states
	 * the same rule where every caller of the service meets it. A flow that crosses organizations by design (creating
	 * an organization adds its admins to it) runs inside `runOutsideOrganizationBoundary`, and a job or a public route
	 * (no user in context) is not confined, as everywhere else.
	 *
	 * @param entity The membership to add.
	 * @returns The added membership.
	 * @throws ForbiddenException when a confined caller names another organization, or none.
	 * @throws NotFoundException when the payload upserts onto a stored membership outside the boundary.
	 */
	public override async create(entity: IPartialEntity<UserOrganization>): Promise<UserOrganization> {
		const boundary = currentOrganizationBoundary();
		if (boundary) {
			const named = entity?.organizationId ?? (entity?.organization as { id?: ID } | undefined)?.id;
			if (!isNotEmpty(boundary.organizationId) || String(named) !== String(boundary.organizationId)) {
				throw new ForbiddenException('The organization is outside the caller’s reach');
			}
			// `create` is an upsert by id: a payload carrying the id of a stored membership rewrites that row
			const id = (entity as { id?: ID })?.id;
			if (isNotEmpty(id)) {
				await this.assertMembershipWithinBoundary(id, true, boundary);
			}
		}
		return await super.create(entity);
	}

	/**
	 * Changes a membership, inside the caller's organization boundary.
	 *
	 * A confined caller (see {@link create}) changes only a membership of the organization of their token: reactivating
	 * their own membership of another organization (`isActive: true`) would reopen it to them, and deactivating
	 * someone's membership elsewhere is not theirs to do. A membership outside the boundary is answered as one that
	 * does not exist. A confined caller never moves a membership to another person or organization either; the REST
	 * body and the GraphQL input do not carry those members for anyone.
	 *
	 * @param id The membership, or the criteria of an internal caller.
	 * @param partialEntity The columns to change.
	 * @returns The result of the update.
	 * @throws NotFoundException when the membership is outside the boundary.
	 */
	public override async update(
		id: string | FindOptionsWhere<UserOrganization>,
		partialEntity: QueryDeepPartialEntity<UserOrganization>
	): Promise<UserOrganization | UpdateResult> {
		const boundary = currentOrganizationBoundary();
		if (!boundary) {
			return await super.update(id, partialEntity);
		}

		let criteria = id;
		if (typeof id === 'string') {
			await this.assertMembershipWithinBoundary(id, false, boundary);
		} else if (id && typeof id === 'object') {
			// Criteria, from code rather than a route: kept to the caller's organization, and to none without one.
			// An organization the criteria name is narrowed by the boundary, never replaced by it: one other than the
			// caller's (or one stated as an operator) matches no membership inside it, so nothing is written.
			if (!isNotEmpty(boundary.organizationId)) {
				throw new NotFoundException('The requested record was not found');
			}
			const stated = id as Record<string, unknown>;
			const named =
				'organizationId' in stated ? stated.organizationId : (stated.organization as { id?: unknown })?.id;
			if (named !== undefined && !(typeof named === 'string' && named === String(boundary.organizationId))) {
				throw new NotFoundException('The requested record was not found');
			}
			criteria = { ...id, organizationId: boundary.organizationId } as FindOptionsWhere<UserOrganization>;
		}

		const patch = { ...((partialEntity ?? {}) as Record<string, unknown>) };
		delete patch['organizationId'];
		delete patch['organization'];
		delete patch['userId'];
		delete patch['user'];

		return await super.update(criteria, patch as QueryDeepPartialEntity<UserOrganization>);
	}

	/**
	 * Withdraws a membership, inside the caller's organization boundary (see {@link update}).
	 */
	public override async softRemove(
		id: ID,
		options?: IFindOneOptions<UserOrganization>,
		saveOptions?: SaveOptions
	): Promise<UserOrganization> {
		await this.assertMembershipWithinBoundary(id, false);
		return await super.softRemove(id, options, saveOptions);
	}

	/**
	 * Restores a withdrawn membership, inside the caller's organization boundary (see {@link update}): restoring one's
	 * own membership of another organization would reopen it, as reactivating it would.
	 */
	public override async softRecover(
		id: ID,
		options?: IFindOneOptions<UserOrganization>,
		saveOptions?: SaveOptions
	): Promise<UserOrganization> {
		await this.assertMembershipWithinBoundary(id, true);
		return await super.softRecover(id, options, saveOptions);
	}

	/**
	 * Refuses a write to a stored membership outside the caller's organization boundary, answering it as a membership
	 * that does not exist (as the CRUD base answers a row outside the boundary). A membership that is not stored at all
	 * is left to the write, which answers it the way it always has.
	 *
	 * Reads of memberships stay unconfined ({@link appliesOrganizationBoundary}); the delete command, which reads the
	 * membership itself, applies the same rule through {@link isMembershipWithinBoundary}.
	 *
	 * @param id The membership.
	 * @param withDeleted Whether a withdrawn membership is looked up as well (a restore, an upsert).
	 * @param boundary The caller's boundary; the current request's when omitted.
	 * @throws NotFoundException when the membership is outside the boundary.
	 */
	async assertMembershipWithinBoundary(
		id: ID,
		withDeleted: boolean,
		boundary: IOrganizationBoundary | null = currentOrganizationBoundary()
	): Promise<void> {
		if (!boundary) {
			return;
		}

		let membership: UserOrganization;
		try {
			membership = await this.findOneByIdString(id, withDeleted ? { withDeleted: true } : undefined);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return;
			}
			throw error;
		}

		if (!this.isMembershipWithinBoundary(membership, boundary)) {
			throw new NotFoundException('The requested record was not found');
		}
	}

	/**
	 * Whether the caller may write a stored membership. A tenant admin, a job and a call inside
	 * `runOutsideOrganizationBoundary` may write any membership of the tenant; anyone else only a membership of the
	 * organization of their token.
	 *
	 * @param membership The stored membership.
	 * @param boundary The caller's boundary; the current request's when omitted.
	 * @returns True when the membership lies inside the boundary.
	 */
	isMembershipWithinBoundary(
		membership: Pick<IUserOrganization, 'organizationId'>,
		boundary: IOrganizationBoundary | null = currentOrganizationBoundary()
	): boolean {
		if (!boundary) {
			return true;
		}
		// A membership always names its organization: one that does not is written by a tenant admin only
		return (
			isNotEmpty(membership?.organizationId) && isWithinOrganizationBoundary(membership.organizationId, boundary)
		);
	}

	/**
	 * Finds all user organizations based on the provided filter options.
	 *
	 * Every loaded `user` relation is handed back as a real `User` instance, whichever ORM loaded it
	 * and whether or not employees were requested, so the global `TransformInterceptor` can apply the
	 * `@Exclude({ toPlainOnly: true })` redaction of the `User` credential columns.
	 *
	 * @param filter Optional filter options to apply when querying user organizations.
	 * @param includeEmployee When true, attaches each user's employee record as `user.employee`.
	 * @returns A promise resolving to the paginated user organizations.
	 */
	async findUserOrganizations(
		filter: BaseQueryDTO<UserOrganization>,
		includeEmployee: boolean
	): Promise<IPagination<UserOrganization>> {
		// Use the filter as-is, permission handling is now handled by the interceptor
		const { items, total } = await super.findAll(filter ?? ({} as BaseQueryDTO<UserOrganization>));

		// Employee details keyed by user ID; stays empty unless 'includeEmployee' is set to true
		const employeeMap = new Map<string, Employee>();

		// If 'includeEmployee' is set to true, fetch employee details associated with each user organization
		if (includeEmployee) {
			try {
				// Get the tenant ID from the current request context
				const tenantId = RequestContext.currentTenantId();

				// Extract user IDs from the items array
				const userIds =
					items
						.filter((organization: IUserOrganization) => organization?.user) // Filter out user organizations without a user object
						.map((organization: IUserOrganization) => organization?.user?.id) || [];

				// Fetch all employee details in bulk for the extracted user IDs
				const employees = await this.employeeService.findEmployeesByUserIds(userIds, tenantId);

				employees.forEach((employee: Employee) => {
					// If user ID is available, add employee details to the map
					if (employee.userId) {
						// Add employee details to the map
						employeeMap.set(employee.userId, employee);
					}
				});
			} catch (error) {
				console.error(`Error fetching employee details: ${error.message}`);
			}
		}

		// Redaction runs on EVERY path, including the employee-lookup failure above
		return { items: items.map((organization) => this.restoreUserPrototype(organization, employeeMap)), total };
	}

	/**
	 * Ensures a user organization row carries its loaded `user` as a `User` instance, merging in the
	 * matching employee when one was found.
	 *
	 * SECURITY: `User.hash`, `refreshToken`, `code`, `codeExpireAt`, `emailVerifiedAt` and
	 * `emailToken` are redacted only by class-transformer's `@Exclude({ toPlainOnly: true })`, whose
	 * metadata is reached through the class prototype. A prototype-less user object therefore has
	 * every credential column serialized verbatim by the global `TransformInterceptor`
	 * (`instanceToPlain`). Such an object arises two ways: rebuilding a loaded entity with an object
	 * spread (never do that here), and the MikroORM branch of `CrudService.findAll`, which returns
	 * `wrap(entity).toJSON()` plain objects. The user is re-wrapped whenever it is not already a
	 * `User` or an employee has to be attached — the same pattern as `UserService.findMeUser`.
	 *
	 * The employee is looked up by `userId`, falling back to the loaded `user.id` so a projection
	 * that omits `userId` neither skips the re-wrap nor loses the employee.
	 *
	 * @param organization The user organization row as returned by `findAll` (mutated in place).
	 * @param employeeMap Employee records keyed by user ID.
	 * @returns The same row, with `user` safe to serialize.
	 */
	private restoreUserPrototype(organization: UserOrganization, employeeMap: Map<string, Employee>): UserOrganization {
		const user = organization?.user;
		if (!user || typeof user !== 'object') {
			return organization;
		}

		const employee = employeeMap.get(organization.userId ?? user.id);
		if (!(user instanceof User) || employee) {
			organization.user = new User({
				...user,
				...(employee && { employee })
			});
		}

		// Return the row itself, never a spread copy of it
		return organization;
	}

	/**
	 * Adds a user to all organizations within a specific tenant.
	 *
	 * @param userId The unique identifier of the user to be added to the organizations.
	 * @param tenantId The unique identifier of the tenant whose organizations the user will be added to.
	 * @returns A promise that resolves to an array of IUserOrganization, where each element represents the user's association with an organization in the tenant.
	 */
	async addUserToOrganization(user: IUser, organizationId: ID): Promise<IUserOrganization | IUserOrganization[]> {
		/** If role is SUPER_ADMIN, add user to all organizations in the tenant */
		if (user.role.name === RolesEnum.SUPER_ADMIN) {
			return await this._addUserToAllOrganizations(user.id, user.tenantId);
		}

		/** An active membership already links the user to the organization: reuse it instead of adding a duplicate row */
		const existing = await this.typeOrmUserOrganizationRepository.findOne({
			where: { userId: user.id, organizationId, tenantId: user.tenantId, isActive: true }
		});
		if (existing) {
			return existing;
		}

		const entity = new UserOrganization({
			organizationId,
			tenantId: user.tenantId,
			userId: user.id
		});

		return await this.typeOrmUserOrganizationRepository.save(entity);
	}

	/**
	 * Adds a user to all organizations within a given tenant..
	 *
	 * @param userId The unique identifier of the user to be added to the organizations.
	 * @param tenantId The unique identifier of the tenant whose organizations the user will be added to.
	 * @returns A promise that resolves to an array of IUserOrganization, representing the user's existing and newly created user-organization relationships.
	 */
	private async _addUserToAllOrganizations(userId: ID, tenantId: ID): Promise<IUserOrganization[]> {
		/** Add user to all organizations in the tenant */
		const organizations = await this.typeOrmOrganizationRepository.find({
			where: { tenantId }
		});

		/** Organizations the user is already an active member of are left as they are, so no duplicate row is added */
		const memberships = await this.typeOrmUserOrganizationRepository.find({
			where: { userId, tenantId, isActive: true }
		});
		const joined = new Set(memberships.map(({ organizationId }: IUserOrganization) => organizationId));

		const entities = organizations
			.filter(({ id }: IOrganization) => !joined.has(id))
			.map(({ id: organizationId }: IOrganization) => {
				const entity = new UserOrganization();
				entity.organizationId = organizationId;
				entity.tenantId = tenantId;
				entity.userId = userId;
				return entity;
			});

		const created = entities.length > 0 ? await this.typeOrmUserOrganizationRepository.save(entities) : [];
		return [...memberships, ...created];
	}
}
