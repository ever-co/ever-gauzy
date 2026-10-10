import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentWebhookEvent } from '../payment-webhook-event.entity';

/**
 * TypeORM repository of PaymentWebhookEvent. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<PaymentWebhookEvent>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmPaymentWebhookEventRepository extends Repository<PaymentWebhookEvent> {
	constructor(@InjectRepository(PaymentWebhookEvent) readonly repository: Repository<PaymentWebhookEvent>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
