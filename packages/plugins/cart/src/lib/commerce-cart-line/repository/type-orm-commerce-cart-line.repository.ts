import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommerceCartLine } from '../commerce-cart-line.entity';

@Injectable()
export class TypeOrmCommerceCartLineRepository extends Repository<CommerceCartLine> {
	constructor(@InjectRepository(CommerceCartLine) readonly repository: Repository<CommerceCartLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
