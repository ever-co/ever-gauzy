import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZapierWebhookSubscription } from './zapier-repository.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TypeOrmZapierWebhookSubscriptionRepository extends Repository<ZapierWebhookSubscription> {
	constructor(
		@InjectRepository(ZapierWebhookSubscription) readonly repository: Repository<ZapierWebhookSubscription>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
