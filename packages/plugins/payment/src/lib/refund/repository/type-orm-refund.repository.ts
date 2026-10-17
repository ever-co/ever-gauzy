import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Refund } from '../refund.entity';

/**
 * TypeORM repository of Refund. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<Refund>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmRefundRepository extends Repository<Refund> {
	constructor(@InjectRepository(Refund) readonly repository: Repository<Refund>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
