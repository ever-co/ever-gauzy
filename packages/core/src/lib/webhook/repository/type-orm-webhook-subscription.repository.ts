import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookSubscription } from '../webhook-subscription.entity';

@Injectable()
export class TypeOrmWebhookSubscriptionRepository extends Repository<WebhookSubscription> {
	constructor(@InjectRepository(WebhookSubscription) readonly repository: Repository<WebhookSubscription>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
