import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShippingOption } from '../shipping-option.entity';

@Injectable()
export class TypeOrmShippingOptionRepository extends Repository<ShippingOption> {
	constructor(@InjectRepository(ShippingOption) readonly repository: Repository<ShippingOption>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}