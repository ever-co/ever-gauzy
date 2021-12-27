import { Injectable, BadRequestException, NotAcceptableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Repository, FindConditions, UpdateResult, getManager, FindManyOptions, Not, In, DeepPartial } from 'typeorm';
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
import { isNotEmpty } from '@gauzy/common';
import { pluck } from 'underscore';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { ImportRecordUpdateOrCreateCommand } from './../export-import/import-record';
import { RolePermission } from './role-permission.entity';
import { Role } from '../role/role.entity';
import { RoleService } from './../role/role.service';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';

@Injectable()
export class RolePermissionService extends TenantAwareCrudService<RolePermission> {
	constructor(
		@InjectRepository(RolePermission)
		private readonly rolePermissionRepository: Repository<RolePermission>,
		private readonly roleService: RoleService,
		private readonly _commandBus: CommandBus
	) {
		super(rolePermissionRepository);
	}

	/**
	 * GET all roler-permissions using API filter
	 * 
	 * @param filter 
	 * @returns 
	 */
	public async findAllRolePermissions(
		filter?: FindManyOptions<RolePermission>,
	): Promise<IPagination<RolePermission>> {

		const tenantId = RequestContext.currentTenantId();
		const roleId = RequestContext.currentRoleId();

		/**
		 * Find current user role
		 */
		const { role } = await this.repository.findOne({
			where: { roleId },
			relations: ['role']
		});

		/**
		 * Only SUPER_ADMIN/ADMIN can have `PermissionsEnum.CHANGE_ROLES_PERMISSIONS` permission
		 * SUPER_ADMIN can retrieve all role-permissions for assign TENANT.
		 * ADMIN can retrieve role-permissions for lower roles (DATA_ENTRY, EMPLOYEE, CANDIDATE, MANAGER, VIEWER) & themself (ADMIN)
		 */
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)) {
			/**
			 * If, SUPER_ADMIN users try to retrieve all role-permissions allow them.
			 */
			if (role.name === RolesEnum.SUPER_ADMIN) {
				return await this.findAll(filter);
			}
			/**
			 * Retrieve all role-permissions except "SUPER_ADMIN" role
			 */
			const roles = (await this.roleService.findAll({
				select: ['id'],
				where: {
					name: Not(RolesEnum.SUPER_ADMIN),
					tenantId
				}
			})).items;
			if (!filter.where) {
				/**
				 * GET all role-permissions for (DATA_ENTRY, EMPLOYEE, CANDIDATE, MANAGER, VIEWER) roles themself (ADMIN), if specific role filter not used in API.
				 * 
				 */
				filter['where'] = {
					roleId: In(pluck(roles, 'id')),
					tenantId
				}
			} else if(filter.where && filter.where['roleId']) {
				/**
				 * If, ADMIN try to retrieve "SUPER_ADMIN" role-permissions via API filter, not allow them.
				 * Retrieve current user role (ADMIN) all role-permissons.
				 */
				if (!pluck(roles, 'id').includes(filter.where['roleId'])) {
					filter['where'] = {
						roleId,
						tenantId
					}
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
		}
		return await this.findAll(filter);
	}

	/**
	 * Create permissions for lower roles users
	 * 
	 * @param partialEntity 
	 * @returns 
	 */
	public async createPermission(
		partialEntity: DeepPartial<IRolePermission>
	): Promise<IRolePermission> {
		try {
			const currentTenantId = RequestContext.currentTenantId();
			const currentRoleId = RequestContext.currentRoleId();

			/**
			 * Find current user role
			 */
			const { role } = await this.repository.findOne({
				where: {
					roleId: currentRoleId,
					tenantId: currentTenantId
				},
				relations: ['role']
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
				 if (wantToCreatePermissionForRole.name === RolesEnum.SUPER_ADMIN) {
					throw new NotAcceptableException(
						'You can not change/add your permissions for SUPER_ADMIN'
					);
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
				if (wantToCreatePermissionForRole.name === RolesEnum.ADMIN) {
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
		id: string | number | FindConditions<IRolePermission>,
		partialEntity: DeepPartial<IRolePermission>
	): Promise<UpdateResult | IRolePermission> {
		try {
			const currentTenantId = RequestContext.currentTenantId();
			const currentRoleId = RequestContext.currentRoleId();

			const { role } = await this.repository.findOne({
				where: {
					roleId: currentRoleId,
					tenantId: currentTenantId
				},
				relations: ['role']
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
				 if (wantToUpdatePermissionForRole.name === RolesEnum.SUPER_ADMIN) {
					throw new NotAcceptableException(
						'You can not change/add your permissions for SUPER_ADMIN'
					);
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
				if (wantToUpdatePermissionForRole.name === RolesEnum.ADMIN) {
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

			const { role } = await this.repository.findOne({
				where: {
					roleId: currentRoleId,
					tenantId: currentTenantId
				},
				relations: ['role']
			});

			/**
			 * User try to delete permission for below role
			 */
			const { role: wantToDeletePermissionForRole } = await this.repository.findOne({
				where: { id },
				relations: ['role']
			});
			if (role.name === RolesEnum.SUPER_ADMIN) {
				/**
				 * Reject request, if SUPER ADMIN try to delete permissions for SUPER ADMIN role.
				 */
				if (wantToDeletePermissionForRole.name === RolesEnum.SUPER_ADMIN) {
					throw new NotAcceptableException(
						'You can not delete your permissions to SUPER_ADMIN'
					);
				}
				return await this.delete(id);
			} else if (role.name === RolesEnum.ADMIN) {
				/**
				 * Reject request, if ADMIN try to update permissions for SUPER ADMIN role.
				 */
				 if (wantToDeletePermissionForRole.name === RolesEnum.SUPER_ADMIN) {
					throw new NotAcceptableException(
						'You can not delete SUPER_ADMINpermisson, please ask your SUPER_ADMIN to give you more permissions'
					);
				}

				/**
				 * Reject request, if ADMIN try to create permissions for ADMIN role.
				 */
				if (wantToDeletePermissionForRole.name === RolesEnum.ADMIN) {
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

	public async updateRolesAndPermissions(
		tenants: ITenant[],
		roles: IRole[]
	): Promise<IRolePermission[]> {
		if (!tenants.length) {
			return;
		}

		const rolesPermissions: IRolePermission[] = [];
		for await (const tenant of tenants) {
			for await (const role of roles) {
				const defaultPermissions = DEFAULT_ROLE_PERMISSIONS.find(
					(defaultRole) => role.name === defaultRole.role
				);
				if (defaultPermissions && isNotEmpty(defaultPermissions['defaultEnabledPermissions'])) {
					const { defaultEnabledPermissions } = defaultPermissions;
					for await (const permission of defaultEnabledPermissions) {
						const rolePermission = new RolePermission();
						rolePermission.roleId = role.id;
						rolePermission.permission = permission;
						rolePermission.enabled = true;
						rolePermission.tenant = tenant;
						rolesPermissions.push(rolePermission);
					}
				}
			}
		}
		await this.rolePermissionRepository.save(rolesPermissions);
		return rolesPermissions;
	}

	public async migratePermissions(): Promise<IRolePermissionMigrateInput[]> {
		const permissions: IRolePermission[] = await this.rolePermissionRepository.find({
			where: {
				tenantId: RequestContext.currentTenantId()
			},
			relations: ['role']
		})
		const payload: IRolePermissionMigrateInput[] = []; 
		for await (const item of permissions) {
			const { id: sourceId, permission, role: { name } } = item;
			payload.push({
				permission,
				isImporting: true,
				sourceId,
				role: name
			})
		}
		return payload;
	}

	public async migrateImportRecord(
		permissions: IRolePermissionMigrateInput[]
	) {
		let records: IImportRecord[] = [];
		const roles: IRole[] = await getManager().getRepository(Role).find({
			tenantId: RequestContext.currentTenantId(),
		});
		for await (const item of permissions) {
			const { isImporting, sourceId } = item;
			if (isImporting && sourceId) {
				const { permission, role: name } = item;
				const role = roles.find((role: IRole) => role.name === name);
				const destinantion = await this.rolePermissionRepository.findOne({
					tenantId: RequestContext.currentTenantId(), 
					permission,
					role
				});
				if (destinantion) {
					records.push(
						await this._commandBus.execute(
							new ImportRecordUpdateOrCreateCommand({
								entityType: getManager().getRepository(RolePermission).metadata.tableName,
								sourceId,
								destinationId: destinantion.id,
								tenantId: RequestContext.currentTenantId()
							})
						)
					);
				}
			}
		}
		return records;
	}
}
