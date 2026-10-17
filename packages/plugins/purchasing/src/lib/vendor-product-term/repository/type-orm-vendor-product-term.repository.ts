import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorProductTerm } from '../vendor-product-term.entity';

@Injectable()
export class TypeOrmVendorProductTermRepository extends Repository<VendorProductTerm> {
	constructor(@InjectRepository(VendorProductTerm) readonly repository: Repository<VendorProductTerm>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
