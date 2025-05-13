import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivepiecesWebhookSubscription } from '../activepieces-webhook-subscription.entity';

@Injectable()
export class TypeOrmActivepiecesWebhookSubscriptionRepository extends Repository<ActivepiecesWebhookSubscription> {
    constructor(
        @InjectRepository(ActivepiecesWebhookSubscription) readonly repository: Repository<ActivepiecesWebhookSubscription>
    ) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
