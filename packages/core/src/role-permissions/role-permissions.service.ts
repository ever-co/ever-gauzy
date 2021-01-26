import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindConditions, UpdateResult } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RolePermissions } from './role-permissions.entity';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RolesEnum, ITenant, IRole, IRolePermission } from '@gauzy/contracts';
import { Role } from '../role/role.entity';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';

@Injectable()
export class RolePermissionsService extends TenantAwareCrudService<RolePermissions> {
	constructor(
		@InjectRepository(RolePermissions)
		private readonly rolePermissionsRepository: Repository<RolePermissions>
	) {
		super(rolePermissionsRepository);
	}

	public async update(
		id: string | number | FindConditions<RolePermissions>,
		partialEntity: QueryDeepPartialEntity<RolePermissions>,
		...options: any[]
	): Promise<UpdateResult | RolePermissions> {
		try {
			if (partialEntity['hash']) {
				const hashPassword = await this.getPasswordHash(
					partialEntity['hash']
				);
				partialEntity['hash'] = hashPassword;
			}

			const { role } = await this.repository.findOne({
				where: { id },
				relations: ['role']
			});

			if (role.name === RolesEnum.SUPER_ADMIN)
				throw new Error('Cannot modify Permissions for Super Admin');

			return await this.repository.update(id, partialEntity);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err.message);
		}
	}

	public async updateRoles(tenant: ITenant, role: Role) {
		const { defaultEnabledPermissions } = DEFAULT_ROLE_PERMISSIONS.find(
			(defaultRole) => role.name === defaultRole.role
		);

		defaultEnabledPermissions.forEach((p) => {
			const rolePermission = new RolePermissions();
			rolePermission.roleId = role.id;
			rolePermission.permission = p;
			rolePermission.enabled = true;
			rolePermission.tenant = tenant;
			this.create(rolePermission);
		});
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
					defaultEnabledPermissions.forEach((p) => {
						const rolePermission = new RolePermissions();
						rolePermission.roleId = role.id;
						rolePermission.permission = p;
						rolePermission.enabled = true;
						rolePermission.tenant = tenant;
						rolesPermissions.push(rolePermission);
					});
				}
			}
		}

		await this.rolePermissionsRepository.save(rolesPermissions);
		return rolesPermissions;
	}
}
