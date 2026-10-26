import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult, In, Not, SaveOptions, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { MultiORMEnum } from './../core/utils';
import {
	IPagination,
	IRole,
	ITenant,
	RolesEnum,
	IRoleMigrateInput,
	IImportRecord,
	ID,
	SYSTEM_DEFAULT_ROLES
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IFindOneOptions, IPartialEntity } from './../core/crud/icrud.service';
import { Role } from './role.entity';
import { RequestContext } from './../core/context';
import { Tenant } from './../core/entities/internal';
import { ImportRecordUpdateOrCreateCommand } from './../export-import/import-record';
import { MikroOrmRoleRepository } from './repository/mikro-orm-role.repository';
import { TypeOrmRoleRepository } from './repository/type-orm-role.repository';

@Injectable()
export class RoleService extends TenantAwareCrudService<Role> {
	constructor(
		readonly typeOrmRoleRepository: TypeOrmRoleRepository,
		readonly mikroOrmRoleRepository: MikroOrmRoleRepository,
		private readonly _commandBus: CommandBus
	) {
		super(typeOrmRoleRepository, mikroOrmRoleRepository);
	}

	/**
	 * Creates multiple roles for each tenant and saves them.
	 * @param tenants - An array of tenants for which roles will be created.
	 * @returns A promise that resolves to an array of created roles.
	 */
	async createBulk(
		tenants: ITenant[],
		rolesNames: RolesEnum[] = Object.values(RolesEnum)
	): Promise<IRole[] & Role[]> {
		const roles: IRole[] = [];

		for await (const tenant of tenants) {
			for await (const name of rolesNames) {
				const role = new Role();
				role.name = name;
				role.tenant = tenant;
				role.isSystem = SYSTEM_DEFAULT_ROLES.includes(name);
				roles.push(role);
			}
		}
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const em = this.mikroOrmRoleRepository.getEntityManager();
				roles.forEach((r) => em.persist(r));
				await em.flush();
				return roles as IRole[] & Role[];
			}
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmRoleRepository.save(roles);
		}
	}

	/**
	 * Creates, in the caller's own tenant, every default role the tenant does not hold — through
	 * `createBulk`, the same bulk write tenant onboarding uses.
	 *
	 * Scoped to the credential's tenant and to nothing else: `createBulk` takes any list of tenants, and a
	 * caller naming another tenant's identifier would be writing roles into a tenant it does not belong to.
	 * Idempotent: a role the tenant already holds — including one it has withdrawn, which is recovered rather
	 * than duplicated — is not created again, so calling this on a complete tenant creates nothing. A role
	 * created here starts with no permission rows; its grants are switched on through the role-permission
	 * routes, so a restored role is never wider than an administrator made it.
	 *
	 * @returns The roles created, which is empty when the tenant already held every default role.
	 * @throws ForbiddenException when the request carries no tenant.
	 */
	async createMissingDefaultRoles(): Promise<IRole[]> {
		const tenantId = RequestContext.currentTenantId();

		if (!tenantId) {
			throw new ForbiddenException();
		}

		const held = await this.find({ where: { tenantId }, withDeleted: true } as never);
		const names = new Set((held ?? []).map((role) => role.name));
		const missing = Object.values(RolesEnum).filter((name) => !names.has(name));

		if (missing.length === 0) {
			return [];
		}

		// `createBulk` sets the tenant relation on each row it builds. MikroORM needs a managed reference
		// there; TypeORM writes the foreign key from the identifier alone.
		const tenant = (
			this.ormType === MultiORMEnum.MikroORM
				? this.mikroOrmRoleRepository.getEntityManager().getReference(Tenant, tenantId)
				: { id: tenantId }
		) as ITenant;

		return await this.createBulk([tenant], missing);
	}

	async migrateRoles(): Promise<IRoleMigrateInput[]> {
		const roles: IRole[] = await this.find({
			where: {
				tenantId: RequestContext.currentTenantId()
			}
		});
		const payload: IRoleMigrateInput[] = [];
		for await (const item of roles) {
			const { id: sourceId, name } = item;
			payload.push({
				name,
				isImporting: true,
				sourceId
			});
		}
		return payload;
	}

	async migrateImportRecord(roles: IRoleMigrateInput[]) {
		let records: IImportRecord[] = [];
		for await (const item of roles) {
			const { isImporting, sourceId, name } = item;
			if (isImporting && sourceId) {
				const destination = await this.findOneByOptions({
					where: {
						tenantId: RequestContext.currentTenantId(),
						name
					},
					order: {
						createdAt: 'DESC'
					}
				});
				if (destination) {
					records.push(
						await this._commandBus.execute(
							new ImportRecordUpdateOrCreateCommand({
								entityType: this.tableName,
								sourceId,
								destinationId: destination.id,
								tenantId: RequestContext.currentTenantId()
							})
						)
					);
				}
			}
		}
		return records;
	}

	/**
	 * Finds the roles a team manager can give to a team member (EMPLOYEE and MANAGER) in the current tenant.
	 *
	 * @returns The matching roles, paginated like `findAll`.
	 */
	async findTeamAssignableRoles(): Promise<IPagination<IRole>> {
		return await this.findAll({
			where: {
				name: In([RolesEnum.EMPLOYEE, RolesEnum.MANAGER])
			}
		});
	}

	/**
	 * Few Roles can't be removed/delete for tenant
	 * RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN, RolesEnum.EMPLOYEE, RolesEnum.VIEWER, RolesEnum.CANDIDATE
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: IRole['id']): Promise<DeleteResult> {
		return await super.delete({
			id,
			isSystem: false,
			name: Not(In(SYSTEM_DEFAULT_ROLES))
		});
	}

	/**
	 * Creates a role in the caller's tenant — the path `POST /roles` and `createRole` both take.
	 *
	 * A role's NAME is an authorization identity (`RequestContext.hasRoles` compares it; `RoleGuard` and the
	 * super-admin bypass of `TenantPermissionGuard` key on it), so creating one is held to the rules in
	 * {@link assertAssignableName} and {@link assertNameFree}: no platform role name, no name the tenant already uses.
	 * The platform's own roles are created by `createBulk` / `createMissingDefaultRoles`, never through here.
	 *
	 * @param entity - The role to create; only its name is a caller's to choose.
	 * @returns The created role.
	 * @throws {BadRequestException} When the name is empty, reserved or already used in the tenant.
	 */
	public async create(entity: IPartialEntity<Role>): Promise<Role> {
		const name = this.assertAssignableName((entity as Partial<IRole>)?.name, BadRequestException);
		await this.assertNameFree(name);

		return super.create({ ...entity, name } as IPartialEntity<Role>);
	}

	/**
	 * Updates a role of the caller's tenant — the path `PUT /roles/:id` and `updateRole` both take.
	 *
	 * R7-01: an ADMIN (who holds `CHANGE_ROLES_PERMISSIONS` by default) could rename the ADMIN role to
	 * `SUPER_ADMIN` in one GraphQL call and so make every ADMIN a SUPER_ADMIN; over REST, rename the real
	 * SUPER_ADMIN role away and then do the same. So: a platform role (a system role, or one named after a
	 * `RolesEnum` value) keeps its name; no role may take a platform role's name; a new name must be free in the
	 * tenant; and whether a role is a system role is not a caller's to change. A role may "rename" to its own name.
	 *
	 * @param id - The role, or criteria naming it.
	 * @param partialEntity - The columns to write.
	 * @returns What the base update answers.
	 * @throws {ForbiddenException} When a platform role would be renamed, a name would be a platform role's, or
	 * `isSystem` would change.
	 * @throws {BadRequestException} When the name is empty or already used by another role of the tenant.
	 */
	public async update(
		id: string | Record<string, any>,
		partialEntity: QueryDeepPartialEntity<Role>
	): Promise<Role | UpdateResult> {
		const changes = (partialEntity ?? {}) as Partial<IRole>;

		if ('isSystem' in changes) {
			throw new ForbiddenException('Whether a role is a system role cannot be changed.');
		}

		if (changes.name !== undefined) {
			const roleId = typeof id === 'string' ? id : (id as { id?: ID })?.id;
			if (!roleId) {
				throw new ForbiddenException('A role is renamed by its id.');
			}
			const role = await this.findOneByIdString(roleId);
			const name = this.assertAssignableName(changes.name, BadRequestException, role.name);

			if (name !== role.name) {
				if (RoleService.isPlatformRole(role)) {
					throw new ForbiddenException(`The '${role.name}' role is a platform role and cannot be renamed.`);
				}
				await this.assertNameFree(name, role.id);
			}

			return super.update(id as any, { ...partialEntity, name } as QueryDeepPartialEntity<Role>);
		}

		return super.update(id as any, partialEntity);
	}

	/**
	 * Withdraws a role of the caller's tenant without removing it — refused for a platform role, whose removal
	 * {@link delete} already refuses: withdrawing the SUPER_ADMIN or ADMIN role locks every holder out as surely.
	 *
	 * @param id - The role to withdraw.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The withdrawn role.
	 * @throws {ForbiddenException} When the role is a platform role.
	 */
	public async softRemove(id: ID, options?: IFindOneOptions<Role>, saveOptions?: SaveOptions): Promise<Role> {
		const role = await this.findOneByIdString(id);
		if (RoleService.isPlatformRole(role)) {
			throw new ForbiddenException(`The '${role.name}' role is a platform role and cannot be withdrawn.`);
		}

		return super.softRemove(id, options, saveOptions);
	}

	/**
	 * Whether a role is one of the platform's own: a system role, or one named after a `RolesEnum` value (the
	 * names `hasRoles`, `RoleGuard` and the permission rules recognise).
	 */
	static isPlatformRole(role: Pick<IRole, 'name' | 'isSystem'>): boolean {
		return !!role?.isSystem || RoleService.isReservedName(role?.name);
	}

	/** Whether a name is a platform role's, compared case-insensitively and ignoring surrounding spaces. */
	static isReservedName(name: unknown): boolean {
		if (typeof name !== 'string') return false;
		const normalized = name.trim().toUpperCase();
		return (Object.values(RolesEnum) as string[]).includes(normalized);
	}

	/**
	 * The name a caller may give a role, trimmed: not empty, and not a platform role's (unless it is the role's
	 * own current name, which a no-op update restates).
	 *
	 * @param name - The requested name.
	 * @param emptyError - The exception class for an empty name.
	 * @param current - The role's current name, when the role exists.
	 * @returns The trimmed name.
	 */
	private assertAssignableName(
		name: unknown,
		emptyError: typeof BadRequestException,
		current?: string
	): string {
		const trimmed = typeof name === 'string' ? name.trim() : '';
		if (!trimmed) {
			throw new emptyError('A role name is required.');
		}
		if (trimmed !== current && RoleService.isReservedName(trimmed)) {
			throw new (current === undefined ? BadRequestException : ForbiddenException)(
				`'${trimmed}' is the name of a platform role and cannot be given to a role.`
			);
		}
		return trimmed;
	}

	/**
	 * Refuses a name another role of the caller's tenant already uses (withdrawn roles included: restoring one
	 * would otherwise create the duplicate). The same rule `@IsRoleAlreadyExist()` states on the REST DTO.
	 *
	 * @param name - The name to check.
	 * @param exceptId - The role being renamed, which may keep its own name.
	 * @throws {BadRequestException} When another role of the tenant uses the name.
	 */
	private async assertNameFree(name: string, exceptId?: ID): Promise<void> {
		const holders = (await this.find({ where: { name }, withDeleted: true } as never)) ?? [];
		if (holders.some((role) => role.id !== exceptId)) {
			throw new BadRequestException(`A role named '${name}' already exists in this tenant.`);
		}
	}
}
