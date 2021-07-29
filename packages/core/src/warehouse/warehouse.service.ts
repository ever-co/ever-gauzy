import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from '../core/crud';
import { Repository } from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { Contact } from 'contact/contact.entity';
import { IPagination } from '@gauzy/contracts';

@Injectable()
export class WarehouseService extends TenantAwareCrudService<Warehouse> {
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
		findInput?: any,
		pageOptions?
	): Promise<IPagination<Warehouse>> {

		const total = await this.warehouseRepository.count(findInput);
		const searchInput: any =  {where: findInput, relations};

		if(pageOptions) {
			searchInput.skip = (pageOptions.page - 1) * pageOptions.limit,
			searchInput.take = pageOptions.limit
		}

		const allWarehouses = await this.warehouseRepository.find(searchInput);

		return {
			items: allWarehouses,
			total: total
		};
	}
}
