import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Repository } from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { Contact } from 'contact/contact.entity';

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
}
