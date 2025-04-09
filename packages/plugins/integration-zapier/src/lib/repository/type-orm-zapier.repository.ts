import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZapierWebhookSubscription } from '../zapier-webhook-subscription.entity';

@Injectable()
export class TypeOrmZapierWebhookSubscriptionRepository extends Repository<ZapierWebhookSubscription> {
	constructor(
		@InjectRepository(ZapierWebhookSubscription) readonly repository: Repository<ZapierWebhookSubscription>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
