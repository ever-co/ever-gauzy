import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmBaseEntityRepository } from '@gauzy/core';
import { PluginSubscription } from '../entities/plugin-subscription.entity';

@Injectable()
export class TypeOrmPluginSubscriptionRepository extends TypeOrmBaseEntityRepository<PluginSubscription> {
	constructor(@InjectRepository(PluginSubscription) readonly repository: Repository<PluginSubscription>) {
		super(repository);
	}
}
