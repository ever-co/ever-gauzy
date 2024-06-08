import { Injectable, BadRequestException, NotAcceptableException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { UpdateResult, FindManyOptions, Not, In, DeepPartial, FindOptionsWhere } from 'typeorm';
import { pluck } from 'underscore';
import {
	RolesEnum,
	ITenant,
	IRole,
	IRolePermission,
	IImportRecord,
	IRolePermissionMigrateInput,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { MultiORMEnum } from '../core/utils';
import { ImportRecordUpdateOrCreateCommand } from './../export-import/import-record';
import { RolePermission } from './role-permission.entity';
import { Role } from '../role/role.entity';
import { RoleService } from './../role/role.service';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';
import { MikroOrmRolePermissionRepository } from './repository/mikro-orm-role-permission.repository';
import { TypeOrmRolePermissionRepository } from './repository/type-orm-role-permission.repository';

@Injectable()
export class RolePermissionService extends TenantAwareCrudService<RolePermission> {
	constructor(
		readonly typeOrmRolePermissionRepository: TypeOrmRolePermissionRepository,
		readonly mikroOrmRolePermissionRepository: MikroOrmRolePermissionRepository,
		private readonly roleService: RoleService,
		private readonly _commandBus: CommandBus
	) {
		super(typeOrmRolePermissionRepository, mikroOrmRolePermissionRepository);
	}

	/**
	 * Retrieves the permissions of the current user.
	 *
	 * @return {Promise<IPagination<RolePermission>>} A promise that resolves to a paginated list of RolePermission objects.
	 */
	async findMePermissions(): Promise<IPagination<IRolePermission>> {
		const tenantId = RequestContext.currentTenantId();
		const roleId = RequestContext.currentRoleId();

		return await this.findAll({
			where: {
				role: { id: roleId, tenantId },
				tenant: { id: tenantId },
				enabled: true,
				isActive: true,
				isArchived: false
			}
		});
	}

	/**
	 * GET all role-permissions using API filter
	 *
	 * @param filter
	 * @returns
	 */
	public async findAllRolePermissions(
		filter?: FindManyOptions<RolePermission>
	): Promise<IPagination<RolePermission>> {
		const tenantId = RequestContext.currentTenantId();
		const roleId = RequestContext.currentRoleId();

		/**
		 * Find current user role
		 */
		const role = await this.roleService.findOneByWhereOptions({
			id: roleId,
			tenantId
		});

		/**
		 * If, SUPER_ADMIN users try to retrieve all role-permissions allow them.
		 */
		if (role.name === RolesEnum.SUPER_ADMIN) {
			return await this.findAll(filter);
		}
		/**
		 * Only SUPER_ADMIN/ADMIN can have `PermissionsEnum.CHANGE_ROLES_PERMISSIONS` permission
		 * SUPER_ADMIN can retrieve all role-permissions for assign TENANT.
		 * ADMIN can retrieve role-permissions for lower roles (DATA_ENTRY, EMPLOYEE, CANDIDATE, MANAGER, VIEWER) & them self (ADMIN)
		 */
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)) {
			/**
			 * Retrieve all role-permissions except "SUPER_ADMIN" role
			 */
			const roles = (
				await this.roleService.findAll({
					select: ['id'],
					where: {
						name: Not(RolesEnum.SUPER_ADMIN),
						tenantId
					}
				})
			).items;
			if (!filter.where) {
				/**
				 * GET all role-permissions for (DATA_ENTRY, EMPLOYEE, CANDIDATE, MANAGER, VIEWER) roles them self (ADMIN), if specific role filter not used in API.
				 *
				 */
				filter['where'] = {
					roleId: In(pluck(roles, 'id')),
					tenantId
				};
			} else if (filter.where && filter.where['roleId']) {
				/**
				 * If, ADMIN try to retrieve "SUPER_ADMIN" role-permissions via API filter, not allow them.
				 * Retrieve current user role (ADMIN) all role-permissions.
				 */
				if (!pluck(roles, 'id').includes(filter.where['roleId'])) {
					filter['where'] = {
						roleId,
						tenantId
					};
				}
			}
			return await this.findAll(filter);
		}

		/**
		 * If (DATA_ENTRY, EMPLOYEE, CANDIDATE, MANAGER, VIEWER) roles users try to retrieve role-permissions.
		 * Allow only to retrieve current users role-permissions.
		 */
		filter['where'] = {
			roleId,
			tenantId
		};
		return await this.findAll(filter);
	}

	/**
	 * Create permissions for lower roles users
	 *
	 * @param partialEntity
	 * @returns
	 */
	public async createPermission(partialEntity: DeepPartial<IRolePermission>): Promise<IRolePermission> {
		try {
			const currentTenantId = RequestContext.currentTenantId();
			const currentRoleId = RequestContext.currentRoleId();

			/**
			 * Find current user role
			 */
			const role = await this.roleService.findOneByWhereOptions({
				id: currentRoleId,
				tenantId: currentTenantId
			});

			let { roleId } = partialEntity;
			if (partialEntity['role'] instanceof Role) {
				roleId = partialEntity['role']['id'];
			}
			/**
			 * User try to create permission for below role
			 */
			const wantToCreatePermissionForRole = await this.roleService.findOneByIdString(roleId);
			/**
			 * If current user has SUPER_ADMIN
			 */
			if (role.name === RolesEnum.SUPER_ADMIN) {
				/**
				 * Reject request, if SUPER ADMIN try to create permissions for SUPER ADMIN role.
				 */
				if (
					wantToCreatePermissionForRole.name === RolesEnum.SUPER_ADMIN ||
					!RequestContext.hasPermission(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
				) {
					throw new NotAcceptableException('You can not change/add your permissions for SUPER_ADMIN');
				}
				return await this.create(partialEntity);
			} else if (role.name === RolesEnum.ADMIN) {
				/**
				 * Reject request, if ADMIN try to create permissions for SUPER ADMIN role.
				 */
				if (wantToCreatePermissionForRole.name === RolesEnum.SUPER_ADMIN) {
					throw new NotAcceptableException(
						'You can not change your role to SUPER_ADMIN, please ask your SUPER_ADMIN to give you more permissions'
					);
				}

				/**
				 * Reject request, if ADMIN try to create permissions for ADMIN role.
				 */
				if (
					wantToCreatePermissionForRole.name === RolesEnum.ADMIN ||
					!RequestContext.hasPermission(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
				) {
					throw new NotAcceptableException(
						'You can not change/add your permissions to ADMIN, please ask your SUPER_ADMIN to give you more permissions'
					);
				}
				return await this.create(partialEntity);
			}
		} catch (error) {
			throw new BadRequestException(error.message);
		}
	}

	public async updatePermission(
		id: string | FindOptionsWhere<IRolePermission>,
		partialEntity: DeepPartial<IRolePermission>
	): Promise<UpdateResult | IRolePermission> {
		try {
			const currentTenantId = RequestContext.currentTenantId();
			const currentRoleId = RequestContext.currentRoleId();

			/**
			 * Find current user role
			 */
			const role = await this.roleService.findOneByWhereOptions({
				id: currentRoleId,
				tenantId: currentTenantId
			});

			let { roleId } = partialEntity;
			if (partialEntity['role'] instanceof Role) {
				roleId = partialEntity['role']['id'];
			}
			/**
			 * User try to update permission for below role
			 */
			const wantToUpdatePermissionForRole = await this.roleService.findOneByIdString(roleId);
			if (role.name === RolesEnum.SUPER_ADMIN) {
				/**
				 * Reject request, if SUPER ADMIN try to update permissions for SUPER ADMIN role.
				 */
				if (
					wantToUpdatePermissionForRole.name === RolesEnum.SUPER_ADMIN ||
					!RequestContext.hasPermission(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
				) {
					throw new NotAcceptableException('You can not change/add your permissions for SUPER_ADMIN');
				}
				return await this.update(id, partialEntity);
			} else if (role.name === RolesEnum.ADMIN) {
				/**
				 * Reject request, if ADMIN try to update permissions for SUPER ADMIN role.
				 */
				if (wantToUpdatePermissionForRole.name === RolesEnum.SUPER_ADMIN) {
					throw new NotAcceptableException(
						'You can not change your role to SUPER_ADMIN, please ask your SUPER_ADMIN to give you more permissions'
					);
				}

				/**
				 * Reject request, if ADMIN try to create permissions for ADMIN role.
				 */
				if (
					wantToUpdatePermissionForRole.name === RolesEnum.ADMIN ||
					!RequestContext.hasPermission(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
				) {
					throw new NotAcceptableException(
						'You can not change/add your permissions to ADMIN, please ask your SUPER_ADMIN to give you more permissions'
					);
				}
				return await this.update(id, partialEntity);
			}
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err.message);
		}
	}

	/**
	 * DELETE role permissions
	 *
	 * @param id
	 * @returns
	 */
	public async deletePermission(id: string) {
		try {
			const currentTenantId = RequestContext.currentTenantId();
			const currentRoleId = RequestContext.currentRoleId();

			/**
			 * Find current user role
			 */
			const role = await this.roleService.findOneByWhereOptions({
				id: currentRoleId,
				tenantId: currentTenantId
			});

			/**
			 * User try to delete permission for below role
			 */
			const { role: wantToDeletePermissionForRole } = await this.typeOrmRepository.findOne({
				where: { id },
				relations: ['role']
			});
			if (role.name === RolesEnum.SUPER_ADMIN) {
				/**
				 * Reject request, if SUPER ADMIN try to delete permissions for SUPER ADMIN role.
				 */
				if (
					wantToDeletePermissionForRole.name === RolesEnum.SUPER_ADMIN ||
					!RequestContext.hasPermission(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
				) {
					throw new NotAcceptableException('You can not delete your permissions to SUPER_ADMIN');
				}
				return await this.delete(id);
			} else if (role.name === RolesEnum.ADMIN) {
				/**
				 * Reject request, if ADMIN try to update permissions for SUPER ADMIN role.
				 */
				if (wantToDeletePermissionForRole.name === RolesEnum.SUPER_ADMIN) {
					throw new NotAcceptableException(
						'You can not delete SUPER_ADMIN permission, please ask your SUPER_ADMIN to give you more permissions'
					);
				}

				/**
				 * Reject request, if ADMIN try to create permissions for ADMIN role.
				 */
				if (
					wantToDeletePermissionForRole.name === RolesEnum.ADMIN ||
					!RequestContext.hasPermission(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
				) {
					throw new NotAcceptableException(
						'You can not delete your permissions to ADMIN, please ask your SUPER_ADMIN to give you more permissions'
					);
				}
				return await this.delete(id);
			}
		} catch (error /*: WriteError*/) {
			throw new BadRequestException(error);
		}
	}

	public async updateRoles(tenant: ITenant, role: Role) {
		const { defaultEnabledPermissions } = DEFAULT_ROLE_PERMISSIONS.find(
			(defaultRole) => role.name === defaultRole.role
		);
		for await (const permission of defaultEnabledPermissions) {
			const rolePermission = new RolePermission();
			rolePermission.roleId = role.id;
			rolePermission.permission = permission;
			rolePermission.enabled = true;
			rolePermission.tenant = tenant;
			await this.create(rolePermission);
		}
	}

	public async updateRolesAndPermissions(tenants: ITenant[]): Promise<IRolePermission[] & RolePermission[]> {
		if (!tenants.length) {
			return;
		}
		// removed permissions for all users in DEMO mode
		const deniedPermissions = [PermissionsEnum.ACCESS_DELETE_ACCOUNT, PermissionsEnum.ACCESS_DELETE_ALL_DATA];
		const rolesPermissions: IRolePermission[] = [];
		for await (const tenant of tenants) {
			const roles = (
				await this.roleService.findAll({
					where: {
						tenantId: tenant.id
					}
				})
			).items;
			for await (const role of roles) {
				const defaultPermissions = DEFAULT_ROLE_PERMISSIONS.find(
					(defaultRole) => role.name === defaultRole.role
				);
				const permissions = Object.values(PermissionsEnum).filter((permission: PermissionsEnum) =>
					environment.demo ? !deniedPermissions.includes(permission) : true
				);
				for await (const permission of permissions) {
					if (defaultPermissions) {
						const { defaultEnabledPermissions = [] } = defaultPermissions;
						const rolePermission = new RolePermission();
						rolePermission.roleId = role.id;
						rolePermission.permission = permission;
						rolePermission.enabled = defaultEnabledPermissions.includes(permission);
						rolePermission.tenant = tenant;
						rolesPermissions.push(rolePermission);
					}
				}
			}
		}
		await this.typeOrmRepository.save(rolesPermissions);
		return rolesPermissions;
	}

	public async migratePermissions(): Promise<IRolePermissionMigrateInput[]> {
		const permissions: IRolePermission[] = await this.typeOrmRepository.find({
			where: {
				tenantId: RequestContext.currentTenantId()
			},
			relations: {
				role: true
			}
		});
		const payload: IRolePermissionMigrateInput[] = [];
		for await (const item of permissions) {
			const {
				id: sourceId,
				permission,
				role: { name },
				description
			} = item;
			payload.push({
				permission,
				description,
				isImporting: true,
				sourceId,
				role: name
			});
		}
		return payload;
	}

	public async migrateImportRecord(permissions: IRolePermissionMigrateInput[]) {
		let records: IImportRecord[] = [];
		const roles: IRole[] = (
			await this.roleService.findAll({
				where: {
					tenantId: RequestContext.currentTenantId()
				}
			})
		).items;

		for await (const item of permissions) {
			const { isImporting, sourceId } = item;
			if (isImporting && sourceId) {
				const { permission, role: name } = item;
				const role = roles.find((role: IRole) => role.name === name);

				const destination = await this.typeOrmRepository.findOneBy({
					tenantId: RequestContext.currentTenantId(),
					permission,
					roleId: role.id
				});
				if (destination) {
					records.push(
						await this._commandBus.execute(
							new ImportRecordUpdateOrCreateCommand({
								entityType: this.typeOrmRepository.metadata.tableName,
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
	 * Checks if the given role permissions are valid for the current tenant.
	 * @param permissions - An array of role permissions to check.
	 * @param includeRole - Optional parameter to include role-specific checks.
	 * @returns A Promise with a boolean indicating if the role permissions are valid.
	 * @throws Error if the ORM type is not implemented.
	 */
	public async checkRolePermission(
		tenantId: string,
		roleId: string,
		permissions: string[],
		includeRole: boolean = false
	): Promise<boolean> {
		switch (this.ormType) {
			case MultiORMEnum.TypeORM:
				// Create a query builder for the 'role_permission' entity
				const query = this.typeOrmRepository.createQueryBuilder('rp');
				// Add the condition for the current tenant ID
				query.where('rp.tenantId = :tenantId', { tenantId });

				// If includeRole is true, add the condition for the current role ID
				if (includeRole) {
					query.andWhere('rp.roleId = :roleId', { roleId });
				}

				// Add conditions for permissions, enabled, isActive, and isArchived
				query.andWhere('rp.permission IN (:...permissions)', { permissions });
				query.andWhere('rp.enabled = :enabled', { enabled: true });
				query.andWhere('rp.isActive = :isActive', { isActive: true });
				query.andWhere('rp.isArchived = :isArchived', { isArchived: false });

				// Execute the query and get the count
				const count = await query.getCount();

				// Return true if the count is greater than 0, indicating valid permissions
				return count > 0;

			// MikroORM implementation
			case MultiORMEnum.MikroORM:
				// Create a query builder for the 'RolePermission' entity
				const totalCount = await this.mikroOrmRepository.count({
					tenantId,
					...(includeRole ? { roleId } : {}),
					permission: { $in: [...permissions] },
					enabled: true,
					isActive: true,
					isArchived: false
				});

				// Return true if the count is greater than 0, indicating valid permissions
				return totalCount > 0;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}
}
