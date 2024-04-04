import { TenantAwareCrudService } from './../core/crud';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IEquipmentSharingPolicy } from '@gauzy/contracts';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { TypeOrmEquipmentSharingPolicyRepository } from './repository/type-orm-equipment-sharing-policy.repository';
import { MikroOrmEquipmentSharingPolicyRepository } from './repository/mikro-orm-equipment-sharing-policy.repository';

@Injectable()
export class EquipmentSharingPolicyService extends TenantAwareCrudService<EquipmentSharingPolicy> {
	constructor(
		@InjectRepository(EquipmentSharingPolicy)
		typeOrmEquipmentSharingPolicyRepository: TypeOrmEquipmentSharingPolicyRepository,

		mikroOrmEquipmentSharingPolicyRepository: MikroOrmEquipmentSharingPolicyRepository
	) {
		super(typeOrmEquipmentSharingPolicyRepository, mikroOrmEquipmentSharingPolicyRepository);
	}

	/**
	 *
	 * @param entity
	 * @returns
	 */
	async create(entity: IEquipmentSharingPolicy): Promise<EquipmentSharingPolicy> {
		try {
			const policy = new EquipmentSharingPolicy();
			policy.name = entity.name;
			policy.organizationId = entity.organizationId;
			policy.tenantId = entity.tenantId;
			policy.description = entity.description;
			return this.typeOrmRepository.save(policy);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	async update(id: string, entity: IEquipmentSharingPolicy): Promise<EquipmentSharingPolicy> {
		try {
			const policy = await this.typeOrmRepository.findOneBy({ id });
			policy.name = entity.name;
			policy.organizationId = entity.organizationId;
			policy.description = entity.description;
			return this.typeOrmRepository.save(policy);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}
}
