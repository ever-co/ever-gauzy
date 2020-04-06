import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindConditions, UpdateResult } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { RolePermissions } from './role-permissions.entity';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RolesEnum } from '@gauzy/models';

@Injectable()
export class RolePermissionsService extends CrudService<RolePermissions> {
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
}
