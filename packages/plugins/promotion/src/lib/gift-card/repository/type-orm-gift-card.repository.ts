import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GiftCard } from '../gift-card.entity';

/**
 * TypeORM repository of GiftCard. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<GiftCard>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmGiftCardRepository extends Repository<GiftCard> {
	constructor(@InjectRepository(GiftCard) readonly repository: Repository<GiftCard>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
