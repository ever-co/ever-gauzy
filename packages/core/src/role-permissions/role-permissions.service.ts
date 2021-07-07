import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Repository, FindConditions, UpdateResult, getManager } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RolePermissions } from './role-permissions.entity';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RolesEnum, ITenant, IRole, IRolePermission, IImportRecord, IRolePermissionMigrateInput, IRoleMigrateInput } from '@gauzy/contracts';
import { Role } from '../role/role.entity';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';
import { RequestContext } from './../core/context';
import { ImportRecordUpdateOrCreateCommand } from './../export-import/import-record';

@Injectable()
export class RolePermissionsService extends TenantAwareCrudService<RolePermissions> {
	constructor(
		@InjectRepository(RolePermissions)
		private readonly rolePermissionsRepository: Repository<RolePermissions>,

		private readonly _commandBus: CommandBus
	) {
		super(rolePermissionsRepository);
	}

	public async update(
		id: string | number | FindConditions<RolePermissions>,
		partialEntity: QueryDeepPartialEntity<RolePermissions>
	): Promise<UpdateResult | RolePermissions> {
		try {
			const { role } = await this.repository.findOne({
				where: { id },
				relations: ['role']
			});

			if (role.name === RolesEnum.SUPER_ADMIN) {
				throw new Error('Cannot modify Permissions for Super Admin');
			}

			return await this.repository.update(id, partialEntity);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err.message);
		}
	}

	public async updateRoles(tenant: ITenant, role: Role) {
		const { defaultEnabledPermissions } = DEFAULT_ROLE_PERMISSIONS.find(
			(defaultRole) => role.name === defaultRole.role
		);
		for await (const permission of defaultEnabledPermissions) {
			const rolePermission = new RolePermissions();
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
						const rolePermission = new RolePermissions();
						rolePermission.roleId = role.id;
						rolePermission.permission = permission;
						rolePermission.enabled = true;
						rolePermission.tenant = tenant;
						rolesPermissions.push(rolePermission);
					}
				}
			}
		}
		
		await this.rolePermissionsRepository.save(rolesPermissions);
		return rolesPermissions;
	}

	public async migratePermissions(): Promise<IRolePermissionMigrateInput[]> {
		const permissions: IRolePermission[] = await this.repository.find({
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
		if (permissions.length > 0) {
			for await (const item of permissions) {
				const { isImporting, sourceId, permission } = item;
				if (isImporting && sourceId) {
					const destinantion = await this.repository.findOne({ tenantId: RequestContext.currentTenantId(), permission }, { 
						order: { createdAt: 'DESC' }
					});
					records.push(
						await this._commandBus.execute(
							new ImportRecordUpdateOrCreateCommand({
								entityType: getManager().getRepository(RolePermissions).metadata.tableName,
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
