import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionItem } from '../subscription-item.entity';

@Injectable()
export class TypeOrmSubscriptionItemRepository extends Repository<SubscriptionItem> {
	constructor(@InjectRepository(SubscriptionItem) readonly repository: Repository<SubscriptionItem>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
