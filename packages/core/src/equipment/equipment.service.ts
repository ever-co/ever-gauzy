import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository, Like } from 'typeorm';
import { IPagination } from '@gauzy/contracts';
import { Equipment } from './equipment.entity';
import { TenantAwareCrudService } from './../core/crud';
import { isNotEmpty } from '@gauzy/common';

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

	public pagination(filter: any) {
		if ('where' in filter) {
			const { where } = filter;
			['name', 'type', 'serialNumber'].forEach((param) => {
        if (param in where) {
          const value = where[param];
					if (isNotEmpty(value)) filter.where[param] = Like(`%${value}%`);
				}
			});
		}
		return super.paginate(filter);
	}
}
