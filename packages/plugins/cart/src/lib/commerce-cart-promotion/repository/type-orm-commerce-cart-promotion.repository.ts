import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommerceCartPromotion } from '../commerce-cart-promotion.entity';

@Injectable()
export class TypeOrmCommerceCartPromotionRepository extends Repository<CommerceCartPromotion> {
	constructor(
		@InjectRepository(CommerceCartPromotion) readonly repository: Repository<CommerceCartPromotion>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
