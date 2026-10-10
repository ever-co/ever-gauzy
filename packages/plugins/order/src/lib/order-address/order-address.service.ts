import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { OrderAddress } from './order-address.entity';
import { TypeOrmOrderAddressRepository } from './repository/type-orm-order-address.repository';
import { MikroOrmOrderAddressRepository } from './repository/mikro-orm-order-address.repository';

/**
 * the frozen addresses of an order. The rows are written once at placement and only rewritten by an applied ADDRESS_UPDATE change.
 */
@Injectable()
export class OrderAddressService extends TenantAwareCrudService<OrderAddress> {
	constructor(
		readonly typeOrmOrderAddressRepository: TypeOrmOrderAddressRepository,
		readonly mikroOrmOrderAddressRepository: MikroOrmOrderAddressRepository
	) {
		super(typeOrmOrderAddressRepository, mikroOrmOrderAddressRepository);
	}
}