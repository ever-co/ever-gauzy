import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Repository } from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { Contact } from 'contact/contact.entity';
import { IPagination } from '@gauzy/contracts';

@Injectable()
export class WarehouseService extends CrudService<Warehouse> {
	constructor(
		@InjectRepository(Warehouse)
		private readonly warehouseRepository: Repository<Warehouse>
	) {
		super(warehouseRepository);
	}

	create(warehouseInput: Warehouse): Promise<Warehouse> {
		let contact = new Contact();
		Object.assign(contact, warehouseInput.contact);

		let warehouse = new Warehouse();
		Object.assign(warehouse, { ...warehouseInput, contact });

		return this.warehouseRepository.save(warehouse);
	}

	updateWarehouse(id: string, warehouse: Warehouse): Promise<Warehouse> {
		return this.warehouseRepository.save({ id, ...warehouse });
	}

	async findAllWarehouses(
		relations?: string[],
		findInput?: any
	): Promise<IPagination<Warehouse>> {
		const warehouses = await this.warehouseRepository.find({
			where: findInput,
			relations
		});

		return {
			items: warehouses,
			total: warehouses.length
		};
	}
}
