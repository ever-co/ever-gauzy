import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IUserOrganization, RolesEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { Organization, User, UserOrganization } from './../core/entities/internal';

@Injectable()
export class UserOrganizationService extends TenantAwareCrudService<UserOrganization> {
	constructor(
		@InjectRepository(UserOrganization)
		private readonly userOrganizationRepository: Repository<UserOrganization>,

		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>
	) {
		super(userOrganizationRepository);
	}

	async addUserToOrganization(
		user: User,
		organizationId: string
	): Promise<IUserOrganization | IUserOrganization[]> {
		const roleName: string = user.role.name;

		if (roleName === RolesEnum.SUPER_ADMIN)
			return this._addUserToAllOrganizations(user.id, user.tenant.id);

		const entity: IUserOrganization = new UserOrganization();
		entity.organizationId = organizationId;
		entity.tenantId = user.tenantId;
		entity.userId = user.id;
		return await this.create(entity);
	}

	private async _addUserToAllOrganizations(
		userId: string,
		tenantId: string
	): Promise<IUserOrganization[]> {
		const organizations = await this.organizationRepository.find({
			select: ['id'],
			where: { tenant: { id: tenantId } },
			relations: ['tenant']
		});
		const entities: IUserOrganization[] = [];

		for await (const organization of organizations) {
			const entity: IUserOrganization = new UserOrganization();
			entity.organizationId = organization.id;
			entity.tenantId = tenantId;
			entity.userId = userId;
			entities.push(entity);
		}
		return await this.repository.save(entities);
	}
}
