import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderShippingMethod } from '../order-shipping-method.entity';

@Injectable()
export class TypeOrmOrderShippingMethodRepository extends Repository<OrderShippingMethod> {
	constructor(@InjectRepository(OrderShippingMethod) readonly repository: Repository<OrderShippingMethod>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}