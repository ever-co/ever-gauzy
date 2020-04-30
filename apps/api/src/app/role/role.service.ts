import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { Role } from './role.entity';

@Injectable()
export class RoleService extends TenantAwareCrudService<Role> {
	constructor(
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>
	) {
		super(roleRepository);
	}
}
