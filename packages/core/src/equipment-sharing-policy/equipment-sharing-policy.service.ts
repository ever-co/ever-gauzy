import { TenantAwareCrudService } from './../core/crud';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IEquipmentSharingPolicy } from '@gauzy/contracts';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';

@Injectable()
export class EquipmentSharingPolicyService extends TenantAwareCrudService<EquipmentSharingPolicy> {
	constructor(
		@InjectRepository(EquipmentSharingPolicy)
		private readonly equipmentSharingRepository: Repository<EquipmentSharingPolicy>
	) {
		super(equipmentSharingRepository);
	}

	async create(
		entity: IEquipmentSharingPolicy
	): Promise<EquipmentSharingPolicy> {
		try {
			const policy = new EquipmentSharingPolicy();
			policy.name = entity.name;
			policy.organizationId = entity.organizationId;
			policy.tenantId = entity.tenantId;
			policy.description = entity.description;
			return this.equipmentSharingRepository.save(policy);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	async update(
		id: string,
		entity: IEquipmentSharingPolicy
	): Promise<EquipmentSharingPolicy> {
		try {
			const policy = await this.equipmentSharingRepository.findOne(id);
			policy.name = entity.name;
			policy.organizationId = entity.organizationId;
			policy.description = entity.description;
			return this.equipmentSharingRepository.save(policy);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}
}
