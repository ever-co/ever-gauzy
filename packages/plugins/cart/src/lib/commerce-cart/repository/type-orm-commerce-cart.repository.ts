import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommerceCart } from '../commerce-cart.entity';

@Injectable()
export class TypeOrmCommerceCartRepository extends Repository<CommerceCart> {
	constructor(@InjectRepository(CommerceCart) readonly repository: Repository<CommerceCart>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
