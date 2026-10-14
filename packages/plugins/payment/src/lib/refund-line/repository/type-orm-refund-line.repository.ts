import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefundLine } from '../refund-line.entity';

/**
 * TypeORM repository of RefundLine. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<RefundLine>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmRefundLineRepository extends Repository<RefundLine> {
	constructor(@InjectRepository(RefundLine) readonly repository: Repository<RefundLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
