import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { RolePermissions } from './role-permissions.entity';

@Injectable()
export class RolePermissionsService extends CrudService<RolePermissions> {
	constructor(
		@InjectRepository(RolePermissions)
		private readonly RolePermissionsRepository: Repository<RolePermissions>
	) {
		super(RolePermissionsRepository);
	}
}
