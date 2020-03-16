import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { EquipmentSharing } from './equipment-sharing.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EquipmentSharingService extends CrudService<EquipmentSharing> {
	constructor(
		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<
			EquipmentSharing
		>
	) {
		super(equipmentSharingRepository);
	}

	async findAllEquipmentSharings(): Promise<any> {
		return await this.equipmentSharingRepository
			.createQueryBuilder('equipment_sharing')
			.leftJoinAndSelect('equipment_sharing.equipment', 'equipment')
			.leftJoinAndSelect('equipment_sharing.employees', 'employee')
			.leftJoinAndSelect('equipment_sharing.teams', 'team')
			.getMany();
	}
}
