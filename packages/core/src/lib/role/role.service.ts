import { ForbiddenException, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult, In, Not } from 'typeorm';
import { MultiORMEnum } from './../core/utils';
import { IRole, ITenant, RolesEnum, IRoleMigrateInput, IImportRecord, SYSTEM_DEFAULT_ROLES } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
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
}
