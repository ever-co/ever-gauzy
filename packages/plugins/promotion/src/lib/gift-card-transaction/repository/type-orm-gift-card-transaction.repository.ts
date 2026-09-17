import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GiftCardTransaction } from '../gift-card-transaction.entity';

/**
 * TypeORM repository of GiftCardTransaction. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<GiftCardTransaction>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmGiftCardTransactionRepository extends Repository<GiftCardTransaction> {
	constructor(@InjectRepository(GiftCardTransaction) readonly repository: Repository<GiftCardTransaction>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
