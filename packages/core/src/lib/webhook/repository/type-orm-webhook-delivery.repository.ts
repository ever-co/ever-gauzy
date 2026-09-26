import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookDelivery } from '../webhook-delivery.entity';

@Injectable()
export class TypeOrmWebhookDeliveryRepository extends Repository<WebhookDelivery> {
	constructor(@InjectRepository(WebhookDelivery) readonly repository: Repository<WebhookDelivery>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
