import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommerceCheckoutSession } from '../commerce-checkout-session.entity';

@Injectable()
export class TypeOrmCommerceCheckoutSessionRepository extends Repository<CommerceCheckoutSession> {
	constructor(
		@InjectRepository(CommerceCheckoutSession) readonly repository: Repository<CommerceCheckoutSession>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
