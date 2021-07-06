import { IRole, ITenant, RolesEnum } from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IRoleMigrateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { Role } from './role.entity';
import { RequestContext } from './../core/context';

@Injectable()
export class RoleService extends TenantAwareCrudService<Role> {
	constructor(
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>
	) {
		super(roleRepository);
	}

	async createBulk(tenants: ITenant[]): Promise<IRole[]> {
		const roles: IRole[] = [];
		const rolesNames = Object.values(RolesEnum);
		
		for await (const tenant of tenants) {
			for await (const name of rolesNames) {
				const role = new Role();
				role.name = name;
				role.tenant = tenant;
				roles.push(role);
			}
		}
		await this.roleRepository.save(roles);
		return roles;
	}

	async migrateRoles(): Promise<IRoleMigrateInput[]> {
		const roles: IRole[] = await this.roleRepository.find({
			where: {
				tenantId: RequestContext.currentTenantId()
			}
		})
		const payload: IRoleMigrateInput[] = []; 
		for await (const role of roles) {
			const { name, tenantId } = role;
			payload.push({
				name,
				tenantId,
				isImporting: true
			})
		}
		return payload;
	}
}
