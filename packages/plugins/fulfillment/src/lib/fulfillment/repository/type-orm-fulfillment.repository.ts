import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fulfillment } from '../fulfillment.entity';

@Injectable()
export class TypeOrmFulfillmentRepository extends Repository<Fulfillment> {
	constructor(@InjectRepository(Fulfillment) readonly repository: Repository<Fulfillment>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}