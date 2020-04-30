import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindConditions, UpdateResult } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RolePermissions } from './role-permissions.entity';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RolesEnum, ITenant } from '@gauzy/models';
import { Role } from '../role/role.entity';
import { defaultRolePermissions } from './role-permissions.seed';

@Injectable()
export class RolePermissionsService extends TenantAwareCrudService<
	RolePermissions
> {
	constructor(
		@InjectRepository(RolePermissions)
		private readonly RolePermissionsRepository: Repository<RolePermissions>
	) {
		super(RolePermissionsRepository);
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
		const { defaultEnabledPermissions } = defaultRolePermissions.find(
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
}
