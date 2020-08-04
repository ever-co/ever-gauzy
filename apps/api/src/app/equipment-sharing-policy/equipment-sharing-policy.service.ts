import { CrudService, IPagination } from '../core';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { EquipmentSharingPolicy as IEquipmentSharingPolicy } from '@gauzy/models';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';

@Injectable()
export class EquipmentSharingPolicyService extends CrudService<
	EquipmentSharingPolicy
> {
	constructor(
		@InjectRepository(EquipmentSharingPolicy)
		private readonly equipmentSharingRepository: Repository<
			EquipmentSharingPolicy
		>
	) {
		super(equipmentSharingRepository);
	}

	async findAllPolicies(
		filter?: FindManyOptions<EquipmentSharingPolicy>
	): Promise<IPagination<IEquipmentSharingPolicy>> {
		const total = await this.equipmentSharingRepository.count(filter);
		const items = await this.equipmentSharingRepository.find(filter);

		return { items, total };
	}

	async create(
		entity: IEquipmentSharingPolicy
	): Promise<EquipmentSharingPolicy> {
		try {
			const policy = new EquipmentSharingPolicy();

			policy.name = entity.name;
			policy.organizationId = entity.organizationId;
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
