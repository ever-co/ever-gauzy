import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FulfillmentLine } from '../fulfillment-line.entity';

@Injectable()
export class TypeOrmFulfillmentLineRepository extends Repository<FulfillmentLine> {
	constructor(@InjectRepository(FulfillmentLine) readonly repository: Repository<FulfillmentLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}