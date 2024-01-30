import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { MikroOrmWarehouseRepository } from './repository/mikro-orm-warehouse.repository';
import { TypeOrmWarehouseRepository } from './repository/type-orm-warehouse.repository';
import { Warehouse } from './warehouse.entity';

@Injectable()
export class WarehouseService extends TenantAwareCrudService<Warehouse> {
	constructor(
		@InjectRepository(Warehouse)
		typeOrmWarehouseRepository: TypeOrmWarehouseRepository,

		mikroOrmWarehouseRepository: MikroOrmWarehouseRepository,
	) {
		super(typeOrmWarehouseRepository, mikroOrmWarehouseRepository);
	}
}
