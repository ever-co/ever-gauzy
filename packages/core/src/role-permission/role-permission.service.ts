import { Injectable, BadRequestException, NotAcceptableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Repository, FindConditions, UpdateResult, getManager, FindManyOptions, Not, In, DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
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

	public async findAllRolePermissions(
		filter?: FindManyOptions<RolePermission>,
	): Promise<IPagination<RolePermission>> {

		const tenantId = RequestContext.currentTenantId();
		const roleId = RequestContext.currentRoleId();

		const { role } = await this.repository.findOne({
			where: { roleId },
			relations: ['role']
		});

		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)) {
			/**
			 * GET Roles Permissions for all roles for "SUPER ADMIN" users
			 */
			if (role.name === RolesEnum.SUPER_ADMIN) {
				return await this.findAll(filter);
			}
			const roles = (await this.roleService.findAll({
				select: ['id'],
				where: {
					name: Not(RolesEnum.SUPER_ADMIN),
					tenantId
				}
			})).items;
			if (!filter.where) {
				/**
				 * GET Roles Permissions for all roles except "SUPER ADMIN" role for "ADMIN" user, if not found any filter
				 */
				filter['where'] = {
					roleId: In(pluck(roles, 'id')),
					tenantId
				}
			} else if(filter.where && filter.where['roleId']) {
				/**
				 * GET Roles Permissions for "ADMIN" role only
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
		 * Use user default role, if not found
		 */
		if (!filter.where) {
			filter['where'] = {
				roleId
			}
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
			const tenantId = RequestContext.currentTenantId();
			const roleId = RequestContext.currentRoleId();

			const { role } = await this.repository.findOne({
				where: {
					roleId,
					tenantId
				},
				relations: ['role']
			});
			
			const wantToCreateRole = await this.roleService.findOneByIdString(partialEntity['roleId']);
			if (role.name === RolesEnum.SUPER_ADMIN) {
				/**
				 * Reject request, if SUPER ADMIN try to update itself permissions
				 */
				 if (wantToCreateRole.name === RolesEnum.SUPER_ADMIN) {
					throw new NotAcceptableException(
						'Cannot modify Permissions for Super Admin'
					);
				}
				return await this.create(partialEntity);
			} else if (role.name === RolesEnum.ADMIN) {
				/**
				 * Reject request, if ADMIN try to create SUPER ADMIN permissions
				 */
				if (wantToCreateRole.name === RolesEnum.SUPER_ADMIN) {
					throw new NotAcceptableException(
						'Cannot modify Permissions for Super Admin, please contact to Super Admin'
					);
				}

				/**
				 * Reject request, if ADMIN try to create themself permissions
				 */
				if (wantToCreateRole.name === RolesEnum.ADMIN) {
					throw new NotAcceptableException(
						'Can not modify permissions for itself, please contact to Super Admin'
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
			const tenantId = RequestContext.currentTenantId();
			const roleId = RequestContext.currentRoleId();

			const { role } = await this.repository.findOne({
				where: {
					roleId,
					tenantId
				},
				relations: ['role']
			});

			const wantToUpdateRole = await this.roleService.findOneByIdString(partialEntity['roleId']);
			if (role.name === RolesEnum.SUPER_ADMIN) {
				/**
				 * Reject request, if SUPER ADMIN try to update itself permissions
				 */
				 if (wantToUpdateRole.name === RolesEnum.SUPER_ADMIN) {
					throw new NotAcceptableException(
						'Cannot modify Permissions for Super Admin'
					);
				}
				return await this.update(id, partialEntity);
			} else if (role.name === RolesEnum.ADMIN) {
				/**
				 * Reject request, if ADMIN try to update SUPER ADMIN permissions
				 */
				 if (wantToUpdateRole.name === RolesEnum.SUPER_ADMIN) {
					throw new NotAcceptableException(
						'Cannot modify Permissions for Super Admin, please contact to Super Admin'
					);
				}

				/**
				 * Reject request, if ADMIN try to update themself permissions
				 */
				if (wantToUpdateRole.name === RolesEnum.ADMIN) {
					throw new NotAcceptableException(
						'Can not modify permissions for itself, please contact to Super Admin'
					);
				}
				return await this.update(id, partialEntity);
			}
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err.message);
		}
	}

	public async deletePermission(id: string | number) {
		try {
			const { role } = await this.repository.findOne({
				where: { id },
				relations: ['role']
			});
			if (role.name === RolesEnum.SUPER_ADMIN) {
				throw new NotAcceptableException(
					'Cannot delete Permissions for Super Admin'
				);
			}
			return await this.delete(id);
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
				if (
					defaultPermissions &&
					defaultPermissions['defaultEnabledPermissions']
				) {
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
