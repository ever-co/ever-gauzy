import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IEquipment, IPagination } from '@gauzy/contracts';
import { Equipment } from './equipment.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class EquipmentService extends TenantAwareCrudService<Equipment> {
	constructor(
		@InjectRepository(Equipment)
		private readonly equipmentRepository: Repository<Equipment>
	) {
		super(equipmentRepository);
	}

	async getAll(): Promise<IPagination<Equipment>> {
		return await this.findAll({
			relations: ['image', 'equipmentSharings', 'tags']
		});
	}

	async save(equipment: Equipment): Promise<IEquipment> {
		return this.equipmentRepository.save(equipment);
	}
}
