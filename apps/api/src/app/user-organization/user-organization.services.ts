import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { UserOrganization } from './user-organization.entity';
import { User } from '../user/user.entity';
import { RolesEnum } from '@gauzy/models';
import { Organization } from '../organization/organization.entity';

@Injectable()
export class UserOrganizationService extends CrudService<UserOrganization> {
	constructor(
		@InjectRepository(UserOrganization)
		private readonly userOrganizationRepository: Repository<
			UserOrganization
		>,
		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>
	) {
		super(userOrganizationRepository);
	}

	async addUserToOrganization(
		user: User,
		organizationId: string
	): Promise<UserOrganization | UserOrganization[]> {
		const roleName: string = user.role.name;

		if (roleName === RolesEnum.SUPER_ADMIN)
			return this._addUserToAllOrganizations(user.id, user.tenant.id);

		const entity: UserOrganization = new UserOrganization();
		entity.organizationId = organizationId;
		entity.userId = user.id;
		return this.create(entity);
	}

	private async _addUserToAllOrganizations(
		userId: string,
		tenantId: string
	): Promise<UserOrganization[]> {
		const organizations = await this.organizationRepository.find({
			select: ['id'],
			where: { tenant: { id: tenantId } },
			relations: ['tenant']
		});
		const entities: UserOrganization[] = [];

		organizations.forEach((organization) => {
			const entity: UserOrganization = new UserOrganization();
			entity.organizationId = organization.id;
			entity.userId = userId;
			entities.push(entity);
		});

		return this.repository.save(entities);
	}
}
