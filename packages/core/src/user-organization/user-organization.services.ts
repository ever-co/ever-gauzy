import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IOrganization, ITenant, IUser, IUserOrganization, RolesEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { Organization } from './../core/entities/internal';
import { UserOrganization } from './user-organization.entity';
import { TypeOrmUserOrganizationRepository } from './repository/type-orm-user-organization.repository';
import { MikroOrmUserOrganizationRepository } from './repository/mikro-orm-user-organization.repository';
import { TypeOrmOrganizationRepository } from '../organization/repository/type-orm-organization.repository';

@Injectable()
export class UserOrganizationService extends TenantAwareCrudService<UserOrganization> {

	constructor(
		@InjectRepository(UserOrganization)
		typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,

		mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository,

		@InjectRepository(Organization)
		private typeOrmOrganizationRepository: TypeOrmOrganizationRepository
	) {
		super(typeOrmUserOrganizationRepository, mikroOrmUserOrganizationRepository);
	}

	/**
	 *
	 * @param user
	 * @param organizationId
	 * @returns
	 */
	async addUserToOrganization(
		user: IUser,
		organizationId: IOrganization['id']
	): Promise<IUserOrganization | IUserOrganization[]> {
		/** If role is SUPER_ADMIN, add user to all organizations in the tenant */
		if (user.role.name === RolesEnum.SUPER_ADMIN) {
			return await this._addUserToAllOrganizations(user.id, user.tenantId);
		}

		const entity: IUserOrganization = new UserOrganization();
		entity.organizationId = organizationId;
		entity.tenantId = user.tenantId;
		entity.userId = user.id;
		return await this.repository.save(entity);
	}

	/**
	 *
	 * @param userId
	 * @param tenantId
	 * @returns
	 */
	private async _addUserToAllOrganizations(
		userId: IUser['id'],
		tenantId: ITenant['id']
	): Promise<IUserOrganization[]> {
		/** Add user to all organizations in the tenant */
		const organizations = await this.typeOrmOrganizationRepository.find({
			where: {
				tenantId
			}
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
