import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IOrganization, ITenant, IUser, IUserOrganization, RolesEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { Organization } from './../core/entities/internal';
import { TypeOrmOrganizationRepository } from '../organization/repository';
import { UserOrganization } from './user-organization.entity';
import { MikroOrmUserOrganizationRepository, TypeOrmUserOrganizationRepository } from './repository';

@Injectable()
export class UserOrganizationService extends TenantAwareCrudService<UserOrganization> {
	constructor(
		@InjectRepository(UserOrganization)
		readonly typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,

		readonly mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository,

		@InjectRepository(Organization)
		readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository
	) {
		super(typeOrmUserOrganizationRepository, mikroOrmUserOrganizationRepository);
	}

	/**
	 * Adds a user to all organizations within a specific tenant.
	 *
	 * @param userId The unique identifier of the user to be added to the organizations.
	 * @param tenantId The unique identifier of the tenant whose organizations the user will be added to.
	 * @returns A promise that resolves to an array of IUserOrganization, where each element represents the user's association with an organization in the tenant.
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
		return await this.typeOrmUserOrganizationRepository.save(entity);
	}

	/**
	 * Adds a user to all organizations within a given tenant..
	 *
	 * @param userId The unique identifier of the user to be added to the organizations.
	 * @param tenantId The unique identifier of the tenant whose organizations the user will be added to.
	 * @returns A promise that resolves to an array of IUserOrganization, representing the user-organization relationships created.
	 */
	private async _addUserToAllOrganizations(
		userId: IUser['id'],
		tenantId: ITenant['id']
	): Promise<IUserOrganization[]> {
		/** Add user to all organizations in the tenant */
		const organizations = await this.typeOrmOrganizationRepository.find({
			where: { tenantId }
		});

		const entities: IUserOrganization[] = organizations.map((organization: IOrganization) => {
			const entity = new UserOrganization();
			entity.organizationId = organization.id;
			entity.tenantId = tenantId;
			entity.userId = userId;
			return entity;
		});

		return await this.typeOrmUserOrganizationRepository.save(entities);
	}
}
