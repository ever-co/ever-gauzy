import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderAddress } from '../order-address.entity';

@Injectable()
export class TypeOrmOrderAddressRepository extends Repository<OrderAddress> {
	constructor(@InjectRepository(OrderAddress) readonly repository: Repository<OrderAddress>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}