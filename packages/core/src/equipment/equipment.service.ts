import { IPagination } from '../core';
import { Equipment } from './equipment.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { IEquipment } from '@gauzy/contracts';

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
