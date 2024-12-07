import { Injectable } from '@nestjs/common';
import { IWarehouse } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { MikroOrmWarehouseRepository } from './repository/mikro-orm-warehouse.repository';
import { TypeOrmWarehouseRepository } from './repository/type-orm-warehouse.repository';
import { Warehouse } from './warehouse.entity';

@Injectable()
export class WarehouseService extends TenantAwareCrudService<Warehouse> {
	constructor(
		readonly typeOrmWarehouseRepository: TypeOrmWarehouseRepository,
		readonly mikroOrmWarehouseRepository: MikroOrmWarehouseRepository,
	) {
		super(typeOrmWarehouseRepository, mikroOrmWarehouseRepository);
	}

	/**
	 *
	 * @param id
	 * @param relations
	 * @returns
	 */
	async findById(id: IWarehouse['id'], relations: string[] = []): Promise<IWarehouse> {
		return await super.findOneByIdString(id, { relations });
	}
}
