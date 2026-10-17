import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionBilling } from '../subscription-billing.entity';

@Injectable()
export class TypeOrmSubscriptionBillingRepository extends Repository<SubscriptionBilling> {
	constructor(@InjectRepository(SubscriptionBilling) readonly repository: Repository<SubscriptionBilling>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
