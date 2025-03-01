import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntitySubscription } from '../entity-subscription.entity';

@Injectable()
export class TypeOrmEntitySubscriptionRepository extends Repository<EntitySubscription> {
	constructor(@InjectRepository(EntitySubscription) readonly repository: Repository<EntitySubscription>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
