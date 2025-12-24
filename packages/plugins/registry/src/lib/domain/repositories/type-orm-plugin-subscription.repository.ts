import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginSubscription } from '../entities/plugin-subscription.entity';

@Injectable()
export class TypeOrmPluginSubscriptionRepository extends Repository<PluginSubscription> {
	constructor(@InjectRepository(PluginSubscription) readonly repository: Repository<PluginSubscription>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
