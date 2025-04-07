import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZapierWebhookSubscriptionRepository } from './zapier-repository.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TypeOrmZapierWebhookSubscriptionRepository extends Repository<ZapierWebhookSubscriptionRepository> {
	constructor(
		@InjectRepository(ZapierWebhookSubscriptionRepository) readonly repository: Repository<ZapierWebhookSubscriptionRepository>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
