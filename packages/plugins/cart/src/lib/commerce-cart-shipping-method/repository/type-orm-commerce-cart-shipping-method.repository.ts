import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommerceCartShippingMethod } from '../commerce-cart-shipping-method.entity';

@Injectable()
export class TypeOrmCommerceCartShippingMethodRepository extends Repository<CommerceCartShippingMethod> {
	constructor(
		@InjectRepository(CommerceCartShippingMethod)
		readonly repository: Repository<CommerceCartShippingMethod>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
