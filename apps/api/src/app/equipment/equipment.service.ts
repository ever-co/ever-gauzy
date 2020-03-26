import { CrudService, IPagination } from '../core';
import { Equipment } from './equipment.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EquipmentService extends CrudService<Equipment> {
	constructor(
		@InjectRepository(Equipment)
		private readonly equipmentRepository: Repository<Equipment>
	) {
		super(equipmentRepository);
	}

	async getAll(): Promise<IPagination<Equipment>> {
		const items = await this.equipmentRepository.find({
			relations: ['equipmentSharings']
		});

		const total = await this.equipmentRepository.count();

		return { items, total };
	}
}
