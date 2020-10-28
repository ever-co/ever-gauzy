import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Tenant } from './tenant.entity';
import {
	ITenantCreateInput,
	RolesEnum,
	ITenant,
	IUser,
	IRole
} from '@gauzy/models';
import { UserService } from '../user/user.service';
import { TenantRoleBulkCreateCommand } from '../role/commands/tenant-role-bulk-create.command';

@Injectable()
export class TenantService extends CrudService<Tenant> {
	constructor(
		@InjectRepository(Tenant)
		private readonly tenantRepository: Repository<Tenant>,
		private readonly userService: UserService,
		private readonly commandBus: CommandBus
	) {
		super(tenantRepository);
	}

	public async onboardTenant(
		entity: ITenantCreateInput,
		user: IUser
	): Promise<ITenant> {
		const tenant = await this.create(entity);

		//after create tenant, create role/permissions for relative tenants
		const roles = await this.commandBus.execute(
			new TenantRoleBulkCreateCommand([tenant])
		);
		const role = await roles.find(
			(defaultRole: IRole) => defaultRole.name === RolesEnum.SUPER_ADMIN
		);

		await this.userService.update(user.id, {
			tenant: {
				id: tenant.id
			},
			role: {
				id: role.id
			}
		});
		return tenant;
	}
}
