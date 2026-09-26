import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefundReason } from '../refund-reason.entity';

/**
 * TypeORM repository of RefundReason. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<RefundReason>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmRefundReasonRepository extends Repository<RefundReason> {
	constructor(@InjectRepository(RefundReason) readonly repository: Repository<RefundReason>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
